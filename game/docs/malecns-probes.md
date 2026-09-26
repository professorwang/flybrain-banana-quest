# MaleCNS 跨数据集探针记录（TECH-NOTE 三发现的 MaleCNS 复测）

> **v3 更正提示（2026-09-26）**：本文测量数字仍然有效且可复现，但两处解读已被
> TECH-NOTE v3 取代：①"MaleCNS 独有 ≥5 突触过滤"有误——经复核两个数据集均为 ≥5
> 过滤（v3 §5.1）；②"≥5 过滤使 MaleCNS 抗癫痫"的归因已撤回——v3 符号翻转实验证明
> 差异源于两打包的递质符号规则（GLUT 兴奋 vs 抑制，v3 §5.3）。解读以
> [TECH-NOTE.md](TECH-NOTE.md) v3 为准；评审点对点答复见
> [REVIEW-RESPONSE.md](REVIEW-RESPONSE.md)。

> 日期：2026-09-26。数据集：neuPrint **male-cns:v1.0**（176,422 神经元 / 6,287,749 条
> ≥5 突触连接 / 90,296,905 突触；CC BY 4.0），经 vendor/fly-brain-minecraft 的
> FLYB v1 封装（MIT），由 `game/tools/flyb_to_bin.py` 转为 sim-core 格式三件套。
> 对照组：FlyWire FAFB v783（139,255 / 2,698,236），见 [TECH-NOTE.md](TECH-NOTE.md)。
> 仿真内核：同一份 `game/src/sim-core.js`（格式无关）。

**复现命令总表**

```bash
python game/tools/flyb_to_bin.py                 # 任务A：转换三件套（stderr 打印权重分布）
node game/tools/probe_malecns.mjs                # 探针 1-4（本文全部主表）
node game/tools/headless_run.mjs 120 null null malecns   # MaleCNS 无头闭环
node game/test/sim.test.mjs                      # FlyWire 回归（不受影响）
```

## 探针 1：权重分布（重尾检验）

原始突触计数 |w|（本数据集边已按 ≥5 突触阈值过滤）：

| 数据集 | max | median | p90 | p99 | 命令 |
|---|---|---|---|---|---|
| FlyWire v783 | 2405 | 8 | 23 | 83 | `python game/tools/prepare_pools.py` |
| **MaleCNS v1.0** | **2591** | **9** | **28** | **93** | `node game/tools/probe_malecns.mjs`（探针1）|

结论：**重尾分布跨数据集重现**（max/中位数 ≈ 300:1 与 ≈ 288:1）。全局 max 归一化的
结构性缺陷在 MaleCNS 上同样注定。

## 探针 2：Finding 1 —— global-max 归一化传播测试

`normalization: 'global-max'`，0.5 强度持续刺激 olf_left（1,090 个 ORN）× 100 tick：

| 数据集 | 总放电 | 中枢放电 | 下游最大膜电压（阈值 1.0） | 判定 |
|---|---|---|---|---|
| FlyWire（926 ORN × 50 tick） | 9,262 | **0** | OLF_PN 组 0.688（渐近不过阈） | 传播失败 |
| **MaleCNS（× 100 tick）** | **21,867（全部感觉区）** | **0** | **OLF_PN 组 0.977**，CB_INTRINSIC 0.089，DN 0.002 | **传播失败复现** |

结论：全局 max 归一化在 MaleCNS 上**同样传播失败**——信号全部困在感觉组，
下游组膜电压向阈值以下渐近（0.977 比 FlyWire 的 0.688 更接近阈值但仍不过）。
Finding 1 是聚合连接组 + 阈值模型的**数据集普遍性质**，不是 FlyWire 特有。

## 探针 3：targetInput 扫描（per-neuron 归一化工作点）

I=1.0 × 200 tick 刺激 olf_left：

| targetInput | 总放电 | 到达组 Top6 | DN(组22) | VIS_OL(癫痫指标) |
|---|---|---|---|---|
| 1.0 | 81,855 | OLF_ORN 74k, GENERIC_CENTRAL 3.1k, OLF_PN 3.0k, OLF_LN 1.2k, CB_INTRINSIC 192, MB_KC 148 | 0 | 0 |
| 2.0 | 146,233 | OLF_ORN 74k, MB_KC 37k, CB_INTRINSIC 13k, OLF_PN 9.2k, GENERIC_CENTRAL 7.5k | 0 | 0 |
| 3.0 | 235,638 | MB_KC 84k, OLF_ORN 73k, CB_INTRINSIC 37k, OLF_PN 16k, GENERIC_CENTRAL 11k | **11** | 0 |
| 4.0 | 331,336 | MB_KC 133k, OLF_ORN 70k, CB_INTRINSIC 69k, OLF_PN 22k, GENERIC_CENTRAL 15k | **75** | 2 |

与 FlyWire 对比：信号分层结构一致（1.0 止步蘑菇体入口、2.0 蘑菇体放大、
3.0 首达下行神经元），但 **MaleCNS 的 DN 驱动弱 2 个数量级**（ti=3 时 11 次 vs
FlyWire GNG_DESC 3,810 次/200 tick）。两个数据集差异：

- FlyWire 的"GNG_DESC"组混入上行神经元（ascending，感觉直驱），MaleCNS 的
  descending_neuron superclass 是纯脑→VNC 命令神经元，离嗅觉入口多突触；
- MaleCNS 边经 ≥5 突触过滤，图更稀疏——**稀疏化还带来一个反直觉的好处**：
  ti=4.0 时 MaleCNS 视觉系统几乎不点燃（VIS_OL 仅 2 次放电），而 FlyWire 在
  ti=4.0 时 VIS_ME 癫痫式点燃（109,917 次/100 tick）。

**MaleCNS 工作点选 4.0**（DN 可用且不癫痫），游戏数据集配置即取此值。

## 探针 4：Finding 2 —— 单侧嗅觉刺激的下行池偏置

MaleCNS 池用**原生 somaSide** 切分（比 FlyWire 的坐标中位数近似干净）：

| targetInput | tick | 刺激侧 | desc_left | desc_right | L/(L+R) |
|---|---|---|---|---|---|
| 3.0 | 200 | olf_left | 5 | 6 | 0.455 |
| 3.0 | 200 | olf_right | 12 | 15 | 0.444 |
| 4.0 | 200 | olf_left | 43 | 32 | 0.573 |
| 4.0 | 200 | olf_right | 54 | 57 | 0.486 |
| 4.0 | 400 | olf_left | 91 | 66 | **0.580** |
| 4.0 | 400 | olf_right | 111 | 118 | **0.485** |

首个 DN 放电延迟：ti=3 约 18–28 tick，ti=4 约 8–14 tick（FlyWire 为 9 tick）。

结论：**Finding 2 的"错误方向结构性偏置"在 MaleCNS 上不复现**——ti=4 充足统计下
左右对比同号且方向正确（左刺激 L/(L+R)=0.580 > 0.5，右刺激 0.485 < 0.5，
有效差约 8%）。FlyWire 的偏置很可能来自其 GNG_DESC 组定义（混入上行神经元）
与坐标切半近似的叠加，而非跨数据集普遍性质。但注意 ti=3 时 DN 放电太少
（5–34 次），偏置统计功效不足，游戏内转向信号依然微弱（困难模式）。

## 补充探针：进食/逃逸/上行链（为任务C可玩性定参）

命令：内联脚本（`node --input-type=module -e`，驱动 `LIFSim` + `pools_malecns.json`，ti=4.0）。

| 链路 | 刺激 | 结果 | 判定 |
|---|---|---|---|
| 进食 | gus 池 I=1.2 × 30 tick | feed_readout（MN9 类，16 个）放电 **3** 次，首个 tick 22 | 达游戏阈值（3/2s）下限，gusIntensity 上调至 1.6 后闭环实测可进食 |
| 逃逸 | mech_bristle 2.0 脉冲 + 0.8 × 20 tick | **DNp01 放电 0**；AN(上行) 累计 710 | 巨型纤维不由刚毛机械感觉驱动（与其视觉 loom 驱动生物学一致）；游戏逃离判定保留 desc 飙升路径 |
| 嗅觉→上行 | olf_left I=1.0 × 200 tick | AN 累计 **0**；DN 75 | 上行神经元不带嗅觉（符合 VNC→脑本体/机械感觉分工）；FlyWire GNG_DESC 的高响应并非来自上行成分 |

## MaleCNS 无头闭环（任务C验收）

```
node game/tools/headless_run.mjs 180 '{"olfGain":2.0,"gusIntensity":1.6,"standbyRate":3}' null malecns
```

结果：**t=171.5s 吃到香蕉，得分 1**（10Hz × 180s，首段曲折度 7.59）。近距离
（<100px）时 desc L/R 升至 34/42 sp/s——嗅觉→DN 驱动弱但非零；进食门控
（gus→MN9 类）真实触发。游戏内已把该配置固化为 malecns 数据集默认
（`src/main.js` DATASETS.malecns.cfg，游戏层参数，非脑读出注水）。

## 给 TECH-NOTE v2 的要点

1. Finding 1（归一化传播失败）**跨数据集复现**：重尾分布 + 全局 max = 感觉区
   自锁，MaleCNS 渐近电压 0.977 vs FlyWire 0.688。
2. per-neuron 归一化的分层可达性结构一致，但**工作点是数据集相关的**
   （FlyWire 3.0 / MaleCNS 4.0），且 ≥5 突触过滤使 MaleCNS 抗癫痫性更强。
3. Finding 2（错误方向偏置）**不复现**：用原生 somaSide + 纯 DN superclass 时
   侧向对比方向正确（差 ~8%）——FlyWire 版偏置更可能源于组定义与坐标近似。
4. 新观察：上行神经元不带嗅觉（AN=0/200 tick），巨型纤维不由刚毛驱动——
   "感觉→命令"通路在真实拓扑上的稀疏性本身就是结果。
