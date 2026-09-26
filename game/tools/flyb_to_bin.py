#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""flyb_to_bin.py —— 把 MaleCNS v1.0 的 FLYB v1 二进制转换为本项目 sim-core 的格式三件套。

输入（只读）：vendor/fly-brain-minecraft/src/main/resources/connectome/malecns-v1.0.flyb.gz
  FLYB v1 格式规范见 vendor/fly-brain-minecraft/PROVENANCE.md 第 4 节（本解析器按其实现）。
输出（写 game/data/）：
  1. connectome-malecns.bin.gz   sim-core 格式：u32 N + u32 E；E×(u32 pre, u32 post, f32 w)；
                                 N×(u8 region_type, u16 group_id)。w = 突触计数 × ntSign[pre]，
                                 边按 pre 排序（flyb 本身即 CSR，直接按序导出）。
  2. neuron_meta_malecns.json    与 neuron_meta.json 同构的 26 个功能组定义。
  3. pools_malecns.json          脑-游戏接口池（组排序后索引空间），用 MaleCNS 原生注释
                                 （somaSide/superclass/class/type）而非坐标近似。

仅用 Python 标准库。用法：python game/tools/flyb_to_bin.py
"""
from __future__ import annotations

import gzip
import json
import random
import re
import struct
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FLYB = ROOT / "vendor" / "fly-brain-minecraft" / "src" / "main" / "resources" / "connectome" / "malecns-v1.0.flyb.gz"
OUT = ROOT / "game" / "data"

VIS_SAMPLE = 2000
RANDOM_SEED = 42

# ---------------- 功能组定义（id, 名称, region） ----------------
# region 编码与 FlyWire 版一致：sensory=0, central=1, drives=2, motor=3（brain-view 兼容）
GROUPS: list[tuple[str, str]] = [
    ("VIS_PHOTO", "sensory"),        # 0  光受体（ol_sensory）
    ("VIS_OL", "sensory"),           # 1  视叶内在神经元（ol_intrinsic）
    ("VIS_VPN", "sensory"),          # 2  视觉投射/离心神经元
    ("OLF_ORN", "sensory"),          # 3  嗅觉受体神经元（class=olfactory）
    ("OLF_PN", "sensory"),           # 4  触角叶投射神经元（ALPN/ALON）
    ("OLF_LN", "sensory"),           # 5  触角叶局部神经元（ALLN/ALIN）
    ("GUS", "sensory"),              # 6  味觉受体神经元（gustatory）
    ("MECH_BRISTLE", "sensory"),     # 7  刚毛机械感觉（subclass=mechanosensory bristle）
    ("MECH_JO", "sensory"),          # 8  风/重力/听觉（wind_gravity/auditory，Johnston 器）
    ("MECH_OTHER", "sensory"),       # 9  其余机械感觉（本体/触觉等）
    ("THERMO_HYGRO", "sensory"),     # 10 温度/湿度感觉
    ("VNC_SENSORY", "sensory"),      # 11 VNC 感觉传入
    ("GENERIC_SENSORY", "sensory"),  # 12 其余感觉（cb_sensory、unknown_sensory 等）
    ("MB_KC", "central"),            # 13 蘑菇体 Kenyon 细胞
    ("MBON", "central"),             # 14 蘑菇体输出神经元
    ("DAN", "central"),              # 15 多巴胺能神经元
    ("CX", "central"),               # 16 中央复合体
    ("CB_INTRINSIC", "central"),     # 17 其余中央脑内在神经元
    ("AN", "central"),               # 18 上行神经元（VNC→脑）
    ("VNC_INTRINSIC", "central"),    # 19 VNC 内在神经元（含 CPG 网络）
    ("GENERIC_CENTRAL", "central"),  # 20 其余（无注释等）
    ("DRIVE_ENDO", "drives"),        # 21 内分泌/神经分泌（cb/vnc_endocrine）
    ("DN", "motor"),                 # 22 下行神经元（脑→VNC 运动命令）
    ("MN_VNC", "motor"),             # 23 VNC 运动神经元（腿/翅，真实内容！）
    ("MN_CB", "motor"),              # 24 脑运动神经元（cb_motor，含 MN9 等喙肌 MN）
    ("MN_VNC_EFF", "motor"),         # 25 VNC 传出（非肌肉运动类）
]
GID = {name: i for i, (name, _) in enumerate(GROUPS)}
REGION_CODE = {"sensory": 0, "central": 1, "drives": 2, "motor": 3}


def classify(sup: str, cls: str, sub: str) -> int:
    """按 MaleCNS 原生注释把神经元归入功能组。优先级自上而下。"""
    # 视觉系统（superclass 优先，避免 class=visual 与 ol_sensory 的归属歧义）
    if sup == "ol_sensory":
        return GID["VIS_PHOTO"]
    if sup == "ol_intrinsic":
        return GID["VIS_OL"]
    if sup in ("visual_projection", "visual_centrifugal", "visual_projection_tbc"):
        return GID["VIS_VPN"]
    # 具名感觉类
    if cls == "olfactory":
        return GID["OLF_ORN"]
    if cls in ("ALPN", "ALON"):
        return GID["OLF_PN"]
    if cls in ("ALLN", "ALIN"):
        return GID["OLF_LN"]
    if cls == "gustatory":
        return GID["GUS"]
    if sub == "mechanosensory bristle":
        return GID["MECH_BRISTLE"]
    if sub in ("wind_gravity", "auditory"):
        return GID["MECH_JO"]
    if cls in ("thermosensory", "hygrosensory"):
        return GID["THERMO_HYGRO"]
    if cls.startswith("mechanosensory"):
        return GID["MECH_OTHER"]
    # 具名中枢类
    if cls == "Kenyon_Cell":
        return GID["MB_KC"]
    if cls == "MBON":
        return GID["MBON"]
    if cls == "DAN":
        return GID["DAN"]
    if cls == "CX":
        return GID["CX"]
    # 大结构
    if sup in ("descending_neuron", "descending_neuron_tbc", "sensory_descending", "efferent_descending"):
        return GID["DN"]
    if sup in ("ascending_neuron", "sensory_ascending", "sensory_ascending_tbc", "efferent_ascending"):
        return GID["AN"]
    if sup == "vnc_motor":
        return GID["MN_VNC"]
    if sup in ("cb_motor", "cb_efferent"):
        return GID["MN_CB"]
    if sup == "vnc_efferent":
        return GID["MN_VNC_EFF"]
    if sup in ("cb_endocrine", "vnc_endocrine"):
        return GID["DRIVE_ENDO"]
    if sup == "vnc_intrinsic":
        return GID["VNC_INTRINSIC"]
    if sup == "cb_intrinsic":
        return GID["CB_INTRINSIC"]
    if sup in ("vnc_sensory", "vnc_sensory_tbc"):
        return GID["VNC_SENSORY"]
    if sup in ("cb_sensory", "cb_sensory_tbc"):
        return GID["GENERIC_SENSORY"]
    if cls in ("unknown_sensory", "chemosensory"):
        return GID["GENERIC_SENSORY"]
    return GID["GENERIC_CENTRAL"]


# ---------------- FLYB v1 解析 ----------------

def parse_flyb(path: Path):
    raw = gzip.open(path, "rb").read()
    off = 4  # magic "FLYB"

    def u32():
        nonlocal off
        v = struct.unpack_from("<I", raw, off)[0]
        off += 4
        return v

    def u16():
        nonlocal off
        v = struct.unpack_from("<H", raw, off)[0]
        off += 2
        return v

    def str16():
        nonlocal off
        n = u16()
        s = raw[off:off + n].decode("utf-8")
        off += n
        return s

    version, N, E, n_retina = u32(), u32(), u32(), u32()
    assert version == 1, f"FLYB version {version} != 1"
    dataset = str16()
    meta_len = u32()
    off += meta_len  # metaJson 跳过（统计信息已在 connectome-stats.json）
    tables = {}
    for name in ["types", "superclasses", "classes", "subclasses", "nts", "sides",
                 "dimorphisms", "fruDsx", "neuromeres", "nerves"]:
        tables[name] = [str16() for _ in range(u16())]

    body_ids = struct.unpack_from(f"<{N}q", raw, off)
    off += 8 * N
    type_idx = struct.unpack_from(f"<{N}i", raw, off)
    off += 4 * N
    sup = raw[off:off + N]; off += N
    cls = raw[off:off + N]; off += N
    sub = struct.unpack_from(f"<{N}H", raw, off); off += 2 * N
    nt_idx = raw[off:off + N]; off += N
    sign = struct.unpack_from(f"<{N}b", raw, off)
    off += N
    side = raw[off:off + N]; off += N
    off += 2 * N   # hex1/hex2
    off += 4 * N   # dimorphism/fruDsx/neuromere/nerve
    off += 12 * N  # soma xyz（本转换不需要坐标）
    off += 8 * N   # pre/postSynapses
    row_ptr = struct.unpack_from(f"<{N + 1}i", raw, off)
    off += 4 * (N + 1)
    post_idx = struct.unpack_from(f"<{E}i", raw, off)
    off += 4 * E
    weight = struct.unpack_from(f"<{E}H", raw, off)
    off += 2 * E
    print(f"解析 {dataset}: N={N} E={E} retina={n_retina}（bodyId {body_ids[0]}..{body_ids[-1]}）",
          file=sys.stderr)
    return {
        "N": N, "E": E, "dataset": dataset, "tables": tables,
        "body_ids": body_ids, "type_idx": type_idx, "sup": sup, "cls": cls,
        "sub": sub, "sign": sign, "side": side, "nt_idx": nt_idx,
        "row_ptr": row_ptr, "post_idx": post_idx, "weight": weight,
    }


# ---------------- 主流程 ----------------

def main() -> None:
    # --glut-excitatory：生成"谷氨酸兴奋性"变体（直接检验符号规则假说：
    # FlyWire 打包把 GLUT 当兴奋性、MaleCNS 打包当抑制性，§5.3 视觉点燃差异的
    # 候选解释。变体只改符号、其余不变，输出 connectome-malecns-glutexc.bin.gz，
    # 组与池定义与标准版完全一致（pools_malecns.json 可直接复用）。）
    glut_exc = "--glut-excitatory" in sys.argv
    d = parse_flyb(FLYB)
    N, E = d["N"], d["E"]
    T = d["tables"]["types"]
    S = d["tables"]["superclasses"]
    C = d["tables"]["classes"]
    SB = d["tables"]["subclasses"]
    SD = d["tables"]["sides"]
    if glut_exc:
        nts = d["tables"]["nts"]
        glut_idx = nts.index("glutamate")
        sign = list(d["sign"])
        flipped = 0
        for i in range(N):
            if d["nt_idx"][i] == glut_idx and sign[i] < 0:
                sign[i] = 1
                flipped += 1
        d["sign"] = sign
        print(f"[变体] GLUT 翻转为兴奋性：{flipped} 个谷氨酸能神经元", file=sys.stderr)

    sup_s = [S[i] for i in d["sup"]]
    cls_s = [C[i] for i in d["cls"]]
    sub_s = [SB[i] for i in d["sub"]]
    side_s = [SD[i] for i in d["side"]]
    type_s = [T[i] for i in d["type_idx"]]

    # 1. 分组
    group = [0] * N
    for i in range(N):
        group[i] = classify(sup_s[i], cls_s[i], sub_s[i])
    counts = Counter(group)
    print("功能组规模：", file=sys.stderr)
    for gid, (name, region) in enumerate(GROUPS):
        print(f"  {gid:2d} {name:16s} {region:8s} {counts.get(gid, 0)}", file=sys.stderr)

    # 2. 写 connectome-malecns.bin.gz（边按 CSR 序 = 按 pre 排序；w = 计数 × ntSign[pre]）
    OUT.mkdir(parents=True, exist_ok=True)
    bin_path = OUT / ("connectome-malecns-glutexc.bin.gz" if glut_exc
                      else "connectome-malecns.bin.gz")
    row_ptr, post_idx, weight, sign = d["row_ptr"], d["post_idx"], d["weight"], d["sign"]
    buf = bytearray(8 + E * 12)
    struct.pack_into("<II", buf, 0, N, E)
    pos = 8
    max_w = 0
    sample = []
    for i in range(N):
        s = sign[i]
        end = row_ptr[i + 1]
        for j in range(row_ptr[i], end):
            w = weight[j]
            if w > max_w:
                max_w = w
            if (j & 255) == 0:      # 抽样用于分位数统计
                sample.append(w)
            struct.pack_into("<IIf", buf, pos, i, post_idx[j], float(w) * s)
            pos += 12
    meta_buf = bytearray(N * 3)
    for i in range(N):
        g = group[i]
        struct.pack_into("<BH", meta_buf, i * 3, REGION_CODE[GROUPS[g][1]], g)
    with gzip.open(bin_path, "wb", compresslevel=6) as f:
        f.write(buf)
        f.write(meta_buf)
    sample.sort()
    pct = lambda p: sample[min(len(sample) - 1, int(len(sample) * p))]
    print(f"[weights] max={max_w} 抽样{len(sample)}条: p50={pct(0.5)} p90={pct(0.9)} p99={pct(0.99)}",
          file=sys.stderr)
    print(f"写出 {bin_path} ({bin_path.stat().st_size / 1024 / 1024:.1f} MB)", file=sys.stderr)
    if glut_exc:
        # 变体只需二进制（组与池定义与标准版一致，无需重写 meta/pools）
        return

    # 3. neuron_meta_malecns.json
    meta = {
        "dataset": d["dataset"],
        "neuron_count": N,
        "edge_count": E,
        "region_types": {"sensory": 0, "central": 1, "drives": 2, "motor": 3},
        "group_count": len(GROUPS),
        "group_sizes": [counts.get(gid, 0) for gid in range(len(GROUPS))],
        "groups": [
            {"id": gid, "name": name, "region": region, "neuron_count": counts.get(gid, 0)}
            for gid, (name, region) in enumerate(GROUPS)
        ],
    }
    meta_path = OUT / "neuron_meta_malecns.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"写出 {meta_path}", file=sys.stderr)

    # 4. pools_malecns.json（组排序后空间：按 group_id 稳定排序，组内原始索引升序）
    order = sorted(range(N), key=lambda i: group[i])
    orig2sorted = [0] * N
    for s, o in enumerate(order):
        orig2sorted[o] = s
    to_sorted = lambda lst: sorted(orig2sorted[o] for o in lst)

    rng = random.Random(RANDOM_SEED)
    pools: dict[str, list[int]] = {}
    pmeta: dict[str, dict] = {}

    def register(name: str, orig_list: list[int], rule: str):
        pools[name] = to_sorted(orig_list)
        pmeta[name] = {"rule": rule, "pool_size": len(orig_list)}

    # 嗅觉 ORN 池：原生 somaSide 分左右，unknown 侧按原始索引奇偶交替分配
    olf_l = [i for i in range(N) if cls_s[i] == "olfactory" and side_s[i] == "L"]
    olf_r = [i for i in range(N) if cls_s[i] == "olfactory" and side_s[i] == "R"]
    olf_u = [i for i in range(N) if cls_s[i] == "olfactory" and side_s[i] not in ("L", "R")]
    olf_l += olf_u[0::2]
    olf_r += olf_u[1::2]
    register("olf_left", olf_l,
             "class==olfactory & somaSide==L; unknown-side 411 个按原始索引奇偶交替均分（取偶数位）")
    register("olf_right", olf_r,
             "class==olfactory & somaSide==R; unknown-side 奇数位")
    pmeta["olf_left"]["note"] = "R 侧重建更完整（R1344/L884/unknown411），池天然不对称，如实记录"
    pmeta["olf_right"]["note"] = pmeta["olf_left"]["note"]

    register("gus", [i for i in range(N) if cls_s[i] == "gustatory"],
             "class==gustatory（MaleCNS 无 sweet/bitter 细分，全量）")
    register("mech_bristle", [i for i in range(N) if sub_s[i] == "mechanosensory bristle"],
             "subclass==mechanosensory bristle")
    register("mech_jo", [i for i in range(N) if sub_s[i] in ("wind_gravity", "auditory")],
             "subclass in {wind_gravity, auditory}（Johnston 器/风感受）")
    vis = [i for i in range(N) if type_s[i] == "R1-R6"]
    register("vis_r1r6", sorted(rng.sample(vis, min(VIS_SAMPLE, len(vis)))),
             f"type==R1-R6 共 {len(vis)} 个，随机降采样 {min(VIS_SAMPLE, len(vis))}（种子 {RANDOM_SEED}）")

    # 下行神经元池：原生 somaSide；M（中线）10 个奇偶交替
    dn_sup = ("descending_neuron", "descending_neuron_tbc", "sensory_descending", "efferent_descending")
    dn_l = [i for i in range(N) if sup_s[i] in dn_sup and side_s[i] == "L"]
    dn_r = [i for i in range(N) if sup_s[i] in dn_sup and side_s[i] == "R"]
    dn_m = [i for i in range(N) if sup_s[i] in dn_sup and side_s[i] not in ("L", "R")]
    dn_l += dn_m[0::2]
    dn_r += dn_m[1::2]
    register("desc_left", dn_l, "superclass in descending* & somaSide==L（M 侧 10 个奇偶均分）")
    register("desc_right", dn_r, "superclass in descending* & somaSide==R")

    # 腿运动神经元池：vnc_motor 中 type 匹配腿部肌肉命名（缩写需词边界匹配：
    # 'Ti flexor MN' 等以 Ti/Tr/Fe/Ta 缩写命名胫/转/股/跗节肌肉），按 somaSide 分
    leg_re = re.compile(
        r"tibia|femur|trochanter|tarsus|ltm|\bTi\b|\bTr\b|\bFe\b|\bTa\b|coxa"
        r"|Sternotrochanter|Pleural", re.I)
    leg = [i for i in range(N) if sup_s[i] == "vnc_motor" and leg_re.search(type_s[i] or "")]
    register("leg_motor_left", [i for i in leg if side_s[i] == "L"],
             "superclass==vnc_motor & type~/tibia|femur|trochanter|tarsus|ltm|\\bTi\\b|\\bTr\\b|\\bFe\\b|\\bTa\\b|coxa|Sternotrochanter|Pleural/i & side==L")
    register("leg_motor_right", [i for i in leg if side_s[i] == "R"],
             "同上 & side==R")

    # 进食读出：脑运动神经元中喙肌相关 type
    feed_types = {"MN9", "MN10", "MN11D", "MN12D", "MN1"}
    register("feed_readout",
             [i for i in range(N) if sup_s[i] == "cb_motor" and type_s[i] in feed_types],
             f"superclass==cb_motor & type in {sorted(feed_types)}（喙肌运动神经元，含 MN9）")

    # 逃逸读出：巨型纤维 DNp01
    register("escape_readout", [i for i in range(N) if type_s[i] == "DNp01"],
             "type==DNp01（巨型纤维，左右各 1）")

    out = {
        "version": 1,
        "index_space": "group_sorted",
        "dataset": d["dataset"],
        "neuron_count": N,
        "source": "neuPrint male-cns:v1.0 via fly-brain-minecraft FLYB v1 (MIT packaging; data CC BY 4.0)",
        "pools": pools,
        "meta": pmeta,
    }
    pools_path = OUT / "pools_malecns.json"
    with open(pools_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"写出 {pools_path} ({pools_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)
    for name, m in pmeta.items():
        print(f"  {name}: {m['pool_size']}", file=sys.stderr)


if __name__ == "__main__":
    main()
