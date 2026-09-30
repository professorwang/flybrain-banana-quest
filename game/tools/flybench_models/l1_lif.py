"""l1_lif —— Banana Quest 的 postsynaptic L1 归一化 LIF，移植为 flybench 模型接口。

与 game/src/sim-core.js 的等价关系（逐条声明，详见
game/docs/flybench-report.md §等价性声明）：

完全一致：
  * 权重拓扑：同一批 FlyWire Codex connections（snedea/flybrain 再分发）；
  * 递质符号规则：与 snedea/flybrain 打包一致的 NT_SIGN
    {ACH:+1, GLUT:+1, DA:+1, OA:+1, SER:+1, GABA:−1; 无 histamine 项→默认 +1}。
    flybench 构建缓存用的是 Shiu 规则（GLUT:−1），本模型在初始化时按
    nt 表把 GLUT 能神经元的出边符号翻转回来（--extra nt_csv=...）。
  * postsynaptic L1 归一化公式：对每个突触后神经元 j，
    w_ij ← w_ij / Σ_i|w_ij| × target_input_mv（符号保留），
    与 sim-core.js 的 per-neuron 归一化逐行对应。

因接口差异的近似（如实声明）：
  * 神经元时间常数采用 flybench/Shiu 基准默认（tau_m 20ms、tau_syn 5ms、
    delay 1.8ms、refractory 2.2ms、dt 0.1ms），而非 sim-core 的粗粒度
    tick 语义（100ms/tick、leak 0.95、不应期 3 tick≈300ms）——后者的
    100ms 步长会破坏基准的毫秒级测量窗口，不可移植；
  * target_input_mv 的换算：sim-core 中 threshold=1.0、归一化总预算
    ti=3.0（≈3×阈值）；按阈值差 v_th−v_rest=7mV 等比换算为 21mV 起步，
    工作点以与 flybench 增益扫描相同的方法粗扫确定（见
    game/docs/results/ 的 TI 扫描存档），不按任务逐拟合。

刺激语义：flybench 惯例（对所选群体施加 Poisson 强制放电），与本项目
游戏层的"持续电流注入池"在"群体放电率"期望上对应，但不逐点等价。
"""
from __future__ import annotations

import gzip
import csv
import numpy as np
import scipy.sparse as sp

from flybench.sim import LIFSimulator, LIFParams

# snedea/flybrain scripts/build_connectome.py 的 NT_SIGN（无 histamine 项，默认 +1）
SNEDEA_NT_SIGN = {"ACH": 1, "GLUT": 1, "DA": 1, "OA": 1, "SER": 1, "GABA": -1}
# flybench 构建时的 Shiu 规则（connectome.py NT_SIGN）
FLYBENCH_NT_SIGN = {"ACH": 1, "GABA": -1, "GLUT": -1, "DA": 1, "OCT": 1, "SER": 1}

MODEL_CARD = {
    "name": "postsynaptic L1-normalized LIF (Banana Quest l1_lif)",
    "engine": "flybench.sim:LIFSimulator (subclass, weight-rule override)",
    "division": "open",
    "n_free_parameters": 1,
    "free_parameters": {
        "target_input_mv": "postsynaptic 总输入预算（mV）；以 sim-core ti=3.0×7mV=21mV 为锚点粗扫，取核心层全种子通过的最宽窗口，不按任务逐拟合",
    },
    "normalization": "postsynaptic L1: w_ij ← w_ij / Σ_i|w_ij| × target_input_mv（保留符号），与 Banana Quest game/src/sim-core.js 一致",
    "sign_rule": "snedea/flybrain NT_SIGN（GLUT 兴奋性；histamine 无类别）",
    "not_modelled": ["neuromodulation", "plasticity", "gap junctions", "dendritic computation", "a body"],
    "fit_data": "target_input_mv 经粗扫（不针对任何单任务拟合）",
    "maintainer": "Banana Quest project",
    "conflict_of_interest": "无；本项目为第三方提交，非 flybench 官方认证",
}


def _load_nt_flip(nt_csv: str, root_ids: np.ndarray, sign_rule: str) -> np.ndarray:
    """计算出边翻转系数（相对 flybench 构建缓存的 Shiu 符号）。
    sign_rule='snedea'：整套 NT_SIGN 对照（GLUT 由 −1 翻为 +1）；
    sign_rule='minecraft'：仅 histamine 翻为 −1（MaleCNS 包规则：glut 本即 −1，
    与 Shiu 一致，唯一差异是 histamine）。"""
    flip = np.ones(len(root_ids), dtype=np.int8)
    lookup = {int(r): i for i, r in enumerate(root_ids)}
    opener = gzip.open if nt_csv.endswith(".gz") else open
    with opener(nt_csv, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            nt = row.get("nt_type", "").strip().upper()
            if not nt:
                continue
            if sign_rule == "minecraft":
                if nt != "HISTAMINE":
                    continue
            else:
                s_sn = SNEDEA_NT_SIGN.get(nt, 1)
                s_fb = FLYBENCH_NT_SIGN.get(nt, 1)
                if s_sn == s_fb:
                    continue
            i = lookup.get(int(row["root_id"]))
            if i is not None:
                flip[i] = -1
    return flip


class L1LIFSimulator(LIFSimulator):
    """postsynaptic L1 归一化的 LIF。

    与参考实现的唯一结构差异在权重矩阵的构建：
    1. （可选）按 nt_csv 把符号从 flybench 构建规则翻转为 snedea 规则；
    2. 每个突触后神经元的入边绝对值归一化到 target_input_mv。
    其余（积分、阈值、不应期、延迟、Poisson 刺激）与 flybench.sim 完全一致。
    """

    model_card = MODEL_CARD
    normalization = "postsynaptic-l1"

    def __init__(self, connectome, params: LIFParams | None = None):
        params = params or LIFParams()
        ti = float(params.extra.get("target_input_mv", 21.0))
        W = connectome.W.tocsr().astype(np.float64)

        # 1. 符号翻转；nt_csv 缺失时保持构建符号并记录
        nt_csv = params.extra.get("nt_csv")
        if nt_csv:
            sign_rule = params.extra.get("sign_rule", "snedea")
            flip = _load_nt_flip(nt_csv, connectome.root_ids, sign_rule)
            n_flip = int((flip < 0).sum())
            if n_flip:
                W = sp.diags(flip.astype(np.float64)).dot(W)
            self._sign_note = f"sign_rule={sign_rule} via nt_csv（{n_flip} 个神经元的出边符号相对构建缓存翻转）"
        else:
            self._sign_note = "no nt_csv — 保持 flybench 构建符号（Shiu 规则）"

        # 2. postsynaptic L1 归一化（列 = post）
        absW = W.copy()
        absW.data = np.abs(absW.data)
        col_sum = np.asarray(absW.sum(axis=0)).ravel()
        scale = np.divide(ti, col_sum, out=np.zeros_like(col_sum), where=col_sum > 0)
        Wn = W.dot(sp.diags(scale))
        self._Wn = Wn.tocsr()

        # 走父类初始化，但用归一化后的矩阵替换按 w_syn*gain 构建的 Wrow
        super().__init__(connectome, params)
        self.Wrow = self._Wn.tocsr()
        self.Wrow.sort_indices()

    def note(self) -> str:
        return self._sign_note
