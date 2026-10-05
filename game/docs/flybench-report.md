# Banana Quest 模型接入 flybench 的首次测量报告

> 日期：2026-10-01。性质：**本项目方案在 flybench 上的首次测量，不是 flybench 官方认证**。
> 所有数字均来自本机实际运行（存档见 `game/docs/results/`，命令见各节）；引用 flybench
> 文档的历史数字时均标注"其文档记载"。结果好坏如实记录。

## 1. 摘要

我们把 Banana Quest 的 **postsynaptic L1 归一化 LIF**（本项目游戏 sim-core 的权重规则与
符号规则，移植为 flybench 模型接口的 `l1_lif`）在 flybench v0.2.1 的 36 任务套件上做了
首次测量（FlyWire v783 与 MaleCNS v1.0，各 3 种子）。结果：

- **总账：FlyWire graded 0.548 < 参考 0.716；MaleCNS graded 0.519 < 参考 0.639**（同机、
  同图、同种子对比）。核心层（pass 口径）FlyWire 0.656 vs 0.844，**MaleCNS 0.667 vs
  0.567——核心层在 MaleCNS 上反超参考**（loom 三项全过而参考的 sugar 侧在 MaleCNS 也弱）。
- **结构性输赢非常干净**：视觉侧全面变好——looming→GF（FlyWire 0.804→**0.998 ✔**、
  MaleCNS 0.805→**0.999 ✔**）、下行集群（0.716/0.710→**0.993/0.994 ✔**）、
  DA1 稀疏编码（FlyWire 0.111→0.587、**MaleCNS 0.636→0.950 ✔ 过线**）、
  嗅觉稀疏编码（MaleCNS 0.565→**0.984 ✔**）、PN 传递函数（0.162→0.459）；
  味觉侧全面变差——sugar→MN9（FlyWire 0.797→0.531、MaleCNS 0.809→0.333）、
  苦味抑制（0.622→0.330、0.820→**0.000**）、adaptation（0.999→0.882、0.771→**0.000**）、
  flash_is_not_loom（FlyWire 0.972→**0.058**——snedea 包 GLUT 兴奋性让全场闪光点燃了
  我们的巨型纤维；MaleCNS 用 glut 抑制符号，0.926→0.351，伤害小得多——同一现象两侧
  的符号依赖证据）。
- 机制解释（§6）：L1 归一化把每个神经元的**总输入预算**拉平，稠密强通路（视觉）的
  相对选择性变好，而稀疏-but-重要的味觉链在毫秒级膜时间常数下点不着——除非把
  targetInput 抬到全脑癫痫的水平。我们游戏内之所以"能用"，靠的是粗 tick（100ms）带来的
  约 2 秒级有效时间常数；那是 tick 语义的功劳，不是 L1 的普适性质。

## 2. 环境与数据血缘（复现路径）

- flybench v0.2.1（vendor/flybench，MIT，master 克隆），`pip install -e .`，Python 3.13，
  Windows，16 CPU。运行一律 `PYTHONIOENCODING=utf-8`（GBK 控制台会崩 rich 输出，已记录为坑）。
- **toy 自检**：`flybench run -c toy` 通过（94% τ=0，与文档预期一致）。
- **FlyWire 图**：vendor/snedea-flybrain 的 Codex v783 全套 CSV 直接 `flybench build`
  （139,255 神经元 / **2,700,513** 对 ≥5 突触连接）。
  **缺口与补救**：snedea 分发缺少 labels.csv.gz 与 cell_types.csv.gz（官方构建需要，
  缺了 MN9/GF/LPLC2 等 cell_type 选择器全灭）；且 neuPrint 的 flywire_fafb_public
  数据集实测匿名 POST 返回 401（MaleCNS 数据集匿名可用）。补救：Schlegel et al. 2024
  官方注释表（flyconnectome/flywire_annotations 的
  Supplemental_file1_neuron_annotations.tsv，31.7MB，CC 数据）合成
  cell_types.csv.gz（139,248 行）。选择器实测：CB0701(MN9)=2、DNp01=2、LPLC2+LC4=314、
  sugar/water=129、bitter=65——与 flybench README 记载的数字完全一致。
  labels 仍缺：仅影响 labels_regex 回退路径（主路径 sub_class/cell_type 均可用），
  如实记录。
- **图差异声明（重要）**：官方 flywire783 pin 为 3,732,460 边（3.7M，"Connections
  (Filtered)" 官方文件构建），我们的图为 2,700,513 边（snedea 再分发的同一 Codex 源，
  聚合阈值 ≥5）。两次运行均带 `--allow-unpinned`（结果被标 unpinned、按 flybench 规则
  排末位——这是排行榜资格问题，不影响测量本身）。**所有对比均在同一 2.7M 图上进行，
  参考基线也是在本机同图重跑的，不是抄官方历史数。**
- **MaleCNS 图**：`flybench fetch-neuprint` 匿名拉取（176,422 / 6,287,789 边，
  与官方 pin 完全一致，cell_type/labels 齐全）。

## 3. 参考基线复现（本机同图重跑）

命令：`flybench run -c flywire783 --config configs/shiu2024.yaml --seeds 3 --jobs 6 --allow-unpinned`
（存档 `game/docs/results/flybench_baseline_shiu2024.json`）。

- core_score **0.767** / hard_score **0.563** / score 0.604 / graded **0.716**（3 种子）。
- 与"其文档记载"的对照：官方全量基线（3.7M 图、同配置）核心层全过、困难层大面积失败
  （README）。本机 2.7M 图数字与其量级一致（如 sugar MN9 66 Hz、return_to_rest 失败、
  flyvis_loom 0 分复现 RFC 32"flash 点亮 GF、loom 不到达"），但 sugar 通路在本图
  gain=1.0 下即可达 66 Hz（文档的 0.45 窗口在本图不再最优——图不同，工作点不同，
  这本身就是本文反复出现的主题）。

## 4. l1_lif 模型定义与等价性声明

模型文件：`game/tools/flybench_models/l1_lif.py`（flybench.sim.LIFSimulator 子类，
仅覆写权重矩阵构建），提交配置 `l1_lif.yaml`（FlyWire）/ `l1_lif_malecns.yaml`（MaleCNS）。

**与 game/src/sim-core.js 完全一致的部分**：

- 权重拓扑：同一批 FlyWire Codex connections（snedea 再分发）。
- 符号规则：snedea NT_SIGN {ACH+, GLUT+, DA+, OA+, SER+, GABA−; 无 histamine 项→默认 +1}。
  flybench 构建缓存用 Shiu 符号（GLUT−），模型初始化时按 nt 表翻转（19,605 个
  谷氨酸能神经元的出边符号翻转）。
- postsynaptic L1 归一化公式：w_ij ← w_ij / Σ_i|w_ij| × target_input_mv（符号保留）。

**因接口差异的近似（如实声明）**：

- 神经元时间常数采用 flybench/Shiu 基准默认（tau_m 20ms、tau_syn 5ms、delay 1.8ms、
  refractory 2.2ms、dt 0.1ms），**而非** sim-core 的粗 tick 语义（100ms/tick、
  leak 0.95/ tick、不应期 3 tick≈300ms）。100ms 步长会破坏基准的毫秒级测量窗口，
  不可移植——这个差异是 §6 机制分析的关键。
- target_input_mv 换算：sim-core ti=3.0（≈3×归一化阈值）× 阈值差 7mV = 21mV 锚点，
  实际工作点经扫描确定（§5）。
- 刺激语义：flybench 惯例为对所选群体施加 Poisson 强制放电；与游戏层"持续电流注入池"
  在群体放电率期望上对应，不逐点等价。

## 5. targetInput 扫描（工作点是怎么定的）

单种子、1000ms、100 Hz 驱动的扫描（存档：本报告数字即原文）：

| 配置 | TI (mV) | MN9 (sugar) | GF (loom) | 活跃率 sugar | 活跃率 loom |
|---|---|---|---|---|---|
| 无翻转(Shiu) | 21 | 0.0 | — | 0.0010 | — |
| 无翻转 | 84 | 0.0 | 1.8 | 0.0023 | 0.0027 |
| 无翻转 | 150 | 0.0 | 49.1 | 0.0158 | 0.0047 |
| 无翻转 | 300 | 280.9 | 0.0 | 0.5112 | 0.5160 |
| snedea 翻转 | 84 | 0.0 | 1.8 | 0.0045 | 0.0027 |
| snedea 翻转 | 100 | 0.9 | 11.8 | 0.6105 | 0.0029 |
| snedea 翻转 | 112 | 3.6 | 22.7 | 0.6208 | 0.0032 |
| **snedea 翻转** | **125** | **6.4** | **32.7** | **0.6321** | **0.0035** |
| snedea 翻转 | 137 | 13.6 | 40.0 | 0.6396 | 0.0039 |
| snedea 翻转 | 150 | 64.5 | 115.5 | 0.6468 | 0.6364 |

观察：① 无翻转时味觉链到 TI=300 才点燃（且点燃即癫痫）；② snedea 翻转（GLUT 兴奋）
让视觉链在 TI=100 就点燃且 loom 侧保持 0.3% 稀疏，但 sugar 侧 TI=100 起就有 61–65%
的广播活跃；③ 提交 TI=125 是"两条核心反射名义上都过阈（MN9>5Hz、GF>5Hz）且静默
基线为 0"的最低点——糖侧广播由困难层任务如实惩罚（见 §6-§7）。**没有"既稀疏又
味觉可达"的工作点**——这是本测量最硬的结果。

## 6. 逐任务对比（FlyWire v783，3 种子，无对照）

l1_lif 命令：`flybench run -c flywire783 --config l1_lif.yaml --simulator l1_lif:L1LIFSimulator
--seeds 3 --jobs 14 --allow-unpinned`（存档 `game/docs/results/flybench_l1_ti125.json`）。
参考基线为 §3 同图重跑。

| task | reference (gain=1.0) | l1_lif (TI=125) | Δ graded |
|---|---|---|---|
| stability | ✔ 0.995 | ✔ 0.995 | +0.000 |
| sugar_to_proboscis | ✘ 0.797 | ✘ 0.531 | -0.266 |
| bitter_suppression | ✘ 0.622 | ✘ 0.330 | -0.292 |
| looming_to_giant_fiber | ✘ 0.804 | ✔ 0.998 | +0.194 |
| taste_specificity | ✔ 1.000 | ✘ 0.427 | -0.573 |
| dose_response | ✘ 0.830 | ✘ 0.715 | -0.115 |
| adaptation | ✔ 0.999 | ✔ 0.882 | -0.117 |
| olfactory_sparse_coding | ✘ 0.572 | ✘ 0.525 | -0.047 |
| crosstalk | ✔ 0.998 | ✘ 0.641 | -0.357 |
| looming_dn_ensemble | ✘ 0.716 | ✔ 0.993 | +0.277 |
| flash_is_not_loom | ✔ 0.972 | ✘ 0.058 | -0.914 |
| return_to_rest | ✘ 0.304 | ✘ 0.416 | +0.112 |
| physiological_rates | ✘ 0.744 | ✘ 0.722 | -0.022 |
| wiring_robustness | ✘ 0.754 | ✘ 0.738 | -0.016 |
| gf_azimuth_invariance | ✘ 0.598 | ✘ 0.641 | +0.043 |
| pn_transfer_function | ✘ 0.162 | ✘ 0.459 | +0.297 |
| da1_sparseness | ✘ 0.111 | ✘ 0.587 | +0.476 |
| lc_dn_matrix | ✘ 0.747 | ✘ 0.439 | -0.308 |
| optic_flow_rotation | ✘ 0.826 | ✘ 0.458 | -0.368 |
| antennal_grooming_vs_backward | ✘ 0.143 | ✘ 0.250 | +0.107 |
| mb_sparseness_apl | ✘ 0.439 | ✘ 0.546 | +0.107 |
| co2_pathway_specificity | ✘ 0.571 | ✘ 0.571 | +0.000 |
| egg_laying_ovidn | ✘ 0.759 | ✘ 0.591 | -0.168 |
| halt_walk_off | ✘ 0.795 | ✘ 0.230 | -0.565 |
| flyvis_loom_escape | ✘ 0.000 | ✘ 0.001 | +0.001 |

合计：core 0.656 vs 0.844（参考），hard 0.523 vs 0.602，graded 0.548 vs 0.716。

跳过（skipped，两边一致）：VNC/身体/闭环/flyvis 依赖的 11 个任务
（looming_to_jump_muscle、gf_to_muscle_latency、taste_modalities、courtship_song_chain、
leg_mn_size_principle、steering_dna02_vs_dna01、epg_ring_attractor、embodied_loom_escape、
ttmn_without_gf、gf_free_route_to_ttmn、closed_loop_escape）。

## 7. 诚实结论

1. **总账输了，但输在哪一清二楚。** graded 0.548 vs 0.716。失分集中在：味觉家族
   （sugar/bitter/dose/adaptation 部分、taste_specificity）、flash_is_not_loom
   （全场闪光把我们 GLUT 兴奋版网络的巨型纤维点燃了 0.058——而参考模型在同图同参数下
   0.972 通过；这与我们 TECH-NOTE 的符号规则差异直接相关：snedea 包的 GLUT 兴奋性
   让闪光同步驱动更容易点燃逃逸通路）、halt_walk_off、optic_flow_rotation。
2. **赢的地方正是方案声称的地方。** 视觉/嗅觉读出侧的选择性：looming→GF 与
   looming_dn_ensemble 双双由 ✘ 变 ✔（0.998/0.993）；da1_sparseness 0.111→0.587
   （稀疏编码从"全广播"变成"有结构"，虽然仍不及真实 0.90 目标）；pn_transfer_function
   0.162→0.459；mb_sparseness 小幅改善。L1 归一化抑制了参考模型在视觉侧的癫痫倾向。
3. **没有"稀疏且味觉可达"的工作点**（§5 扫描原文）——L1 拉平了总预算，稀疏味觉链
   在毫秒级 tau 下点不着；能点燃的 TI 值必然伴随糖侧大广播。我们游戏内 L1 之所以可用，
   是粗 tick（100ms ≈ 2s 有效时间常数）在给稀疏输入积分的时间。**"归一化方案的好坏
   离不开时间常数语义"——这是本次测量给技术报告 v7.0 的核心素材。**
4. 与 adaptation 行的关系（其文档记载）：flybench 的 +adaptation 行（0.75 vs 0.64）
   恰好解决我们输掉的 return_to_rest/rates 类任务；我们的方案与 adaptation 正交
   （权重拓扑 vs 单神经元状态），组合是未来自然实验。
5. 计算成本也是数据：TI=125 的糖侧癫痫使套件运行约 62 分钟（无对照，14 并发）；
   加 rewired 对照后两轮均超 2 小时被杀（如实在 §9 记录）。癫痫不只是分数问题，
   也是可计算性问题。

## 8. MaleCNS 测量（TI=84，minecraft 符号）

l1_lif 命令：`flybench run -c malecns --config l1_lif_malecns.yaml --simulator
l1_lif:L1LIFSimulator --seeds 3 --jobs 14 --allow-unpinned`
（存档 `game/docs/results/flybench_l1_malecns.json`）。
参考基线命令：`flybench run -c malecns --config configs/malecns_minecraft.yaml --seeds 3
--jobs 14 --allow-unpinned`（gain=0.65，存档
`game/docs/results/flybench_malecns_reference_g065.json`）。
MaleCNS 的 cell_type/labels 齐全（官方 pin 完全一致，--allow-unpinned 仅为保险）。

**总账**：l1_lif core **0.667** / hard 0.498 / graded **0.519**；参考 core 0.567 /
hard 0.537 / graded **0.639**。**核心层（pass 口径）l1_lif 反超参考**（loom 三项全过
+ taste_specificity 负对照通过，而参考在 MaleCNS 的 sugar 侧本就偏弱）；graded 口径
仍输（糖侧与 flash/时序类任务拉低）。

| task | reference (gain=0.65) | l1_lif (TI=84) | Δ graded |
|---|---|---|---|
| stability | ✔ 0.995 | ✔ 0.995 | +0.000 |
| sugar_to_proboscis | ✘ 0.809 | ✘ 0.333 | -0.476 |
| bitter_suppression | ✘ 0.820 | ✘ 0.000 | -0.820 |
| looming_to_giant_fiber | ✘ 0.805 | ✔ 0.999 | +0.194 |
| taste_specificity | ✘ 0.218 | ✔ 0.998 | +0.780 |
| dose_response | ✘ 0.731 | ✘ 0.200 | -0.531 |
| adaptation | ✘ 0.771 | ✘ 0.000 | -0.771 |
| olfactory_sparse_coding | ✘ 0.565 | ✔ 0.984 | +0.419 |
| crosstalk | ✘ 0.750 | ✘ 0.749 | -0.001 |
| looming_dn_ensemble | ✘ 0.710 | ✔ 0.994 | +0.284 |
| flash_is_not_loom | ✔ 0.926 | ✘ 0.351 | -0.575 |
| return_to_rest | ✘ 0.336 | ✘ 0.748 | +0.412 |
| physiological_rates | ✘ 0.674 | ✘ 0.600 | -0.074 |
| wiring_robustness | ✘ 0.762 | ✘ 0.799 | +0.037 |
| looming_to_jump_muscle | ✘ 0.834 | ✘ 0.666 | -0.168 |
| gf_azimuth_invariance | ✘ 0.644 | ✘ 0.644 | +0.000 |
| pn_transfer_function | ✘ 0.452 | ✘ 0.487 | +0.035 |
| da1_sparseness | ✘ 0.636 | ✔ 0.950 | +0.314 |
| gf_to_muscle_latency | ✘ 0.398 | ✘ 0.000 | -0.398 |
| taste_modalities | ✘ 0.631 | ✘ 0.250 | -0.381 |
| lc_dn_matrix | ✘ 0.860 | ✘ 0.913 | +0.053 |
| courtship_song_chain | ✘ 0.819 | ✘ 0.125 | -0.694 |
| leg_mn_size_principle | ✘ 0.326 | ✘ 0.452 | +0.126 |
| optic_flow_rotation | ✘ 0.584 | ✘ 0.238 | -0.346 |
| antennal_grooming_vs_backward | ✘ 0.342 | ✘ 0.250 | -0.092 |
| mb_sparseness_apl | ✘ 0.465 | ✘ 0.678 | +0.213 |
| co2_pathway_specificity | ✘ 0.571 | ✘ 0.855 | +0.284 |
| steering_dna02_vs_dna01 | ✘ 0.167 | ✘ 0.167 | +0.000 |
| epg_ring_attractor | ✘ 0.258 | ✘ 0.258 | +0.000 |
| flyvis_loom_escape | ✘ 0.000 | ✘ 0.000 | +0.000 |

跳过（skipped）：egg_laying_ovidn（雌蝇任务）、halt_walk_off（Foxglove 未标注）、
embodied_loom_escape / ttmn_without_gf / gf_free_route_to_ttmn / closed_loop_escape
（需 flygym/flyvis/torch，未安装——记录为环境缺口）。

MaleCNS 特有观察：

- **da1_sparseness 0.950 过线（目标 ≥0.90）**——l1_lif 在 MaleCNS 的八气味面板上给出
  了接近实测值的终身稀疏度，参考只有 0.636。嗅觉选择性是本方案在 MaleCNS 上最强的点。
- **flash_is_not_loom 0.926→0.351**：比 FlyWire 侧的 0.972→0.058 温和得多——同一
  任务对符号规则的敏感性在两侧呈现完美对照（MaleCNS 的 glut 为抑制性，闪光不易点燃
  GF；snedea 包的 GLUT 兴奋性则让闪光假阳性泛滥）。这是给技术报告 v7.0 的直接素材。
- looming_to_jump_muscle 0.666（脑→VNC 跳肌链部分传导但未过线）；
  gf_to_muscle_latency 0.000——该任务"为任何单一化学延迟模型而设计为失败"
  （RFC 预登记），两边同败，非本方案特有问题。
- courtship_song_chain 0.819→0.125：歌曲链在 L1 下传不动（与味觉链同构的稀疏通路问题）。

## 9. 遇到的坑（全部如实记录）

1. Windows GBK 控制台崩 rich 输出（UnicodeEncodeError）——全部命令需 PYTHONIOENCODING=utf-8。
2. snedea 分发缺 labels/cell_types → 任务选择器全灭；neuPrint FlyWire 匿名 401；
   用 Schlegel 注释表合成 cell_types.csv.gz 补救。
3. 官方 pin 3.73M 边 ≠ 本机 2.70M 边（snedea 再分发图更小），两次运行均 --allow-unpinned。
4. 第一次 l1_lif 全量跑用了错误的 TI（21，锚点值忘改）——产出 flybench_l1_ti21.json
   （保留为消融行：静默网络下 core 0.533 / graded 0.377，证明负对照任务的"沉默得分"
   特性）——随后以 TI=125 正式重跑。
5. rewired 对照在 TI≥84 下对被毁拓扑网络同样癫痫，两轮含对照运行均超 2 小时被
   超时杀掉；最终无对照跑通。特异性结论因此只能定性讨论（见 §7-2），这是本报告的
   已知缺口。

## 10. 对技术报告 v7.0 的素材清单

- l1_lif 在 flybench 的首次第三方测量：FlyWire graded 0.548 vs 参考 0.716、
  MaleCNS graded 0.519 vs 0.639，但 **MaleCNS 核心层 pass 口径 0.667 反超参考 0.567**
  （同图同种子）——"总分输、结构赢"的完整证据链。
- 视觉侧五连赢：looming→GF（两数据集双双由 ✘ 变 ✔）、下行集群 0.993/0.994、
  DA1 稀疏编码 MaleCNS 0.950 过线（≥0.90 目标）、嗅觉稀疏编码 0.984、PN 传递函数改善。
- targetInput 扫描全表："没有稀疏且味觉可达的工作点"的定量证据（糖侧点燃 TI 与全脑
  癫痫 TI 重合）。
- 机制叙事：L1 归一化的有效性依赖于时间常数语义（粗 tick ≈ 2s 有效 tau 救场），
  毫秒动力学下稀疏通路结构性弱势——与 TECH-NOTE 的"per-dataset working point"主线
  直接衔接；并提出"L1 + 慢 leak"的组合本质上是把有效时间常数当自由参数。
- 符号规则差异的新证据：flash_is_not_loom 在 FlyWire 0.972(Shiu 符号)→0.058(snedea
  GLUT 兴奋) vs MaleCNS 0.926(glut 抑制)→0.351——同一任务两侧的符号依赖对照，
  直接补进 TECH-NOTE 符号实验章节（v5 §3 之后）。
- flybench 作为持续回归入口：以后每次改 sim-core 可 `flybench run` 复测；
  `game/tools/flybench_models/l1_lif.py` 即接入点（含 MODEL_CARD 与等价性声明）。

