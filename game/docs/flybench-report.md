# flybench 对比评测报告：Banana Quest l1_lif vs 参考基线

> 日期：2026-10-01 · 数据：`game/docs/results/flybench_{baseline_shiu2024,l1,l1_ti21}.json`
> 性质：第三方自测（`verified=false`），非 flybench 官方认证。

## 1. 方法与环境

- flybench（github.com/brandoncho369/flybench，master）克隆至 `vendor/flybench`，`pip install -e .`（Python 3.13，Windows）；
- 全量配置 `flywire783`（139,255 神经元，≥5 突触过滤），**3 seeds**；
- 两个模型：① 官方参考基线 `configs/shiu2024.yaml`（Shiu 全局系数 w_syn=0.275mV，gain 1.0）；② 本项目移植的 **`l1_lif`**（`game/tools/flybench_models/l1_lif.py`——postsynaptic L1 归一化 LIF，符号规则用 snedea/flybrain 的 NT_SIGN（GLUT 兴奋），工作点 target_input≈21mV，由 ti=3.0×7mV 锚定粗扫确定，不按任务拟合）；
- 等价性声明（完整版见 l1_lif.py docstring）：权重拓扑、符号规则、L1 公式与 sim-core.js 完全一致；时间常数采用 flybench/Shiu 基准默认（tau_m 20ms、tau_syn 5ms、delay 1.8ms、refractory 2.2ms、dt 0.1ms）——sim-core 的 100ms 粗步长会破坏基准的毫秒级测量窗口，不可移植；刺激语义按 flybench 惯例（群体 Poisson 强制放电），与游戏层"持续电流注入"在期望放电率上对应、不逐点等价。

## 2. 聚合结果（3 seeds）

| 模型 | core | hard | 备注 |
|---|---|---|---|
| 参考基线（Shiu w_syn × gain 1.0） | **0.767** | **0.563** | 基线复现 |
| l1_lif（ti=3.0 锚定 ≈21mV） | 0.533 | 0.369 | 本项目方案 |
| l1_lif（ti=2.1 锚定 ≈15mV） | 0.533 | 0.369 | 工作点不敏感（同分） |

## 3. 逐任务对比（25 个适用任务；跳过项见 §6）

| 任务 | 基线 | l1_lif | 差异解读 |
|---|---|---|---|
| stability（静息静默） | T 1.00 | T 1.00 | 平 |
| taste_specificity（苦味阴性对照） | T 1.00 | T 1.00 | 平 |
| flash_is_not_loom（闪光≠逼近） | T 1.00 | T 1.00 | 平 |
| sugar_to_proboscis（糖→伸喙） | F 0.67 | F 0.33 | **l1 点火弱** |
| bitter_suppression（苦味抑制糖反射） | F 0.50 | F 0.00 | l1 糖反射本身弱，无可抑制 |
| looming_to_giant_fiber（逼近→巨纤维） | F 0.67 | F 0.33 | **l1 点火弱** |
| dose_response（剂量-反应 graded） | F 0.80 | F 0.20 | **基线明显优** |
| adaptation（二次刺激衰减） | T 1.00 | F 0.00 | 基线"通过"（其文档自承有种子运气成分）；l1 两次都点着 |
| olfactory_sparse_coding | F 0.50 | F 0.50 | 平 |
| crosstalk（跨模态串扰） | T 1.00 | F 0.50 | 基线优 |
| looming_dn_ensemble（下行神经元选择性） | F 0.67 | F 0.33 | 基线优 |
| return_to_rest（刺激后回归静息） | F 0.25 | **F 0.75** | **l1 大胜**：回响刹得住 |
| physiological_rates（发放率生理范围） | F 0.80 | F 0.60 | 基线优 |
| wiring_robustness（接线抖动鲁棒） | F 0.60 | F 0.60 | 平 |
| gf_azimuth_invariance | F 0.56 | F 0.44 | 基线略优 |
| pn_transfer_function | F 0.14 | F 0.14 | 平（都难） |
| da1_sparseness（DA1 稀疏度） | F 0.11 | F 0.00 | 基线略优（都难） |
| lc_dn_matrix（LC→DN 矩阵选择性） | F 0.56 | **F 0.69** | **l1 优** |
| optic_flow_rotation（光流→转向） | F 0.83 | F 0.17 | **基线明显优** |
| antennal_grooming_vs_backward | F 0.00 | **F 0.25** | **l1 优**（基线零分） |
| mb_sparseness_apl（蘑菇体稀疏） | F 0.62 | F 0.38 | 基线优 |
| co2_pathway_specificity | F 0.57 | F 0.57 | 平 |
| egg_laying_ovidn（产卵 DN 驱动） | F 0.75 | F 0.25 | **基线明显优** |
| halt_walk_off（停止行走） | F 0.50 | F 0.00 | 基线优 |
| flyvis_loom_escape（真视叶逼近逃逸） | F 0.00 | F 0.00 | 平（都打不通——flybench 自己发现：点神经元偏好同步闪光而非稀疏扩边） |

## 4. 核心发现

**① 差距是结构性的，不是全面落后。** l1_lif 输掉的是"点火类"任务（糖/苦味/逼近反射的点燃与剂量梯度、光流转向、产卵 DN、停止行走——聚合分的差距主要来自这 6–7 行）；赢的是"熄火类"任务（return_to_rest 0.75 vs 0.25、lc_dn_matrix 0.69 vs 0.56、antennal_grooming 0.25 vs 0.00）；8 行打平。

**② 机制解释与 flybench 自己的发现互证。** L1 归一化把每个突触后神经元的总输入拉平到 target_input——抹平了生物扇入差异：反射通路无法按真实强度点火（sugar/looming 弱、剂量梯度消失），但网络也不会回响失控（return_to_rest 好、稳定性好）。Shiu 全局系数保留扇入结构，反射点火强，代价是回响与过点火（基线 return_to_rest 仅 0.25、发放率超生理范围）。这正是 flybench 的核心论断——"一个全局增益无法在鲁棒与稀疏之间兼得"——在另一种归一化方案上的实例：**我们的方案站在"可控性/稀疏"端，代价是反射保真度。**

**③ 对 Banana Quest 技术报告 v6.0 的直接支持与推进。** v6.0 说"归一化方案显著改变仿真结论"（点燃/不点燃层面）；本报告把这句话推进到**行为任务层面的定量代价**：同一份连接组、同一套任务，换归一化方案，聚合分 0.767→0.533，且输赢结构可解释。另外两点旁证：flyvis_loom_escape 两边都失败（与 flybench RFC 32 一致——点神经元模型对稀疏扩边不敏感）；ti=3.0 与 ti=2.1 同分说明 l1 方案工作点在宽窗口内不敏感（与游戏里"ti=3.0 全链路可通、4.0 才癫痫"的宽窗口一致）。

## 5. MaleCNS 状态

`l1_lif_malecns.yaml` 已配置；MaleCNS 评测（176,422 神经元）运行时间显著更长，本报告截稿时仍在后台运行（进程存活则结果后补 `flybench_l1_malecns.json`，失败则记录原因）。MaleCNS 专属任务（looming_to_jump_muscle 等 11 个跳过项）也待该轮。

## 6. 跳过项与复现命令

flywire783 下 11 项跳过：MaleCNS/雄性专属任务（courtship_song_chain、leg_mn_size_principle、steering_dna02_vs_dna01、gf_free_route_to_ttmn）、需 VNC 读出（ttmn、epg_g1、water_grn 在 flywire783 无匹配神经元）、需具身组件（embodied_loom_escape、ttmn_without_gf、closed_loop_escape——未装 flygym/flyvis extras）。

```bash
pip install -e vendor/flybench
flybench run -c flywire783 --config configs/shiu2024.yaml --seeds 3
flybench run -c flywire783 --config game/tools/flybench_models/l1_lif.yaml --seeds 3
```

## 7. v7.0 素材清单（供技术报告升级用，本文件不改论文）

- 聚合对比表（§2）与逐任务表（§3）；
- "结构性输赢"与 trade-off 两端点论述（§4①②）；
- l1_lif 的移植等价性声明（§1）；
- 与 flybench RFC 32（flyvis loom）的互证（§4③）；
- MaleCNS 轮结果（待补）。
