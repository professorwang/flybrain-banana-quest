# 升级计划：借 2026 诺贝尔（光遗传学）的项目演进路线

> 日期：2026-10-06 · 触发事件：2026-10-05 诺贝尔生理学或医学奖授予光遗传学

## 一、诺奖成果研究（深度摘要）

**官方口径**（[nobelprize.org 新闻稿](https://www.nobelprize.org/prizes/medicine/2026/press-release/)）：
- **Karl Deisseroth**（HHMI/Stanford）、**Peter Hegemann**（柏林洪堡大学）、**Georg Nagel**（维尔茨堡大学），共享 1200 万瑞典克朗；
- 表彰语："for their discoveries concerning **light-gated ion channels and optogenetics**"；
- 科学史：Hegemann 与 Nagel 在单细胞衣藻（Chlamydomonas）中发现 channelrhodopsin——蓝光一开、离子通道即开、细胞产生电脉冲，且"放到任何细胞里，那个细胞就对光敏感"；Deisseroth 于 2005 年把该基因转入大鼠神经元实现光控放电，2007 年做到活体小鼠脑内可控；
- 意义（诺委会主席 Per Svenningsson）："Optogenetics provides opportunities for **mapping the brain in a way that we could once only dream of**"——它把脑研究从"相关"带进"因果"。

**与我们项目的连接（为什么这是直系利好）**：

1. **光遗传是连接组计算模型的验证标尺**。Shiu et al. 2024（Nature，全脑模型的源头）原文："we validate by **optogenetic activation** and behavioural studies"——164 项预测 91% 与实验一致，验证手段就是光遗传激活/抑制 + 钙成像（[PMC 全文](https://pmc.ncbi.nlm.nih.gov/articles/PMC11446845/)）。
2. **激活/抑制是模型的一等操作**。philshiu/Drosophila_brain_model 官方代码注释："Silencing … to model **optogenetic silencing**"（连接置零模拟抑制）——我们 sim-core 的 stimulate（Poisson 注入）与 silence（连接置零）在语义上就是**虚拟光遗传**。
3. **果蝇"控制手柄"来自光遗传筛选**。Eon 演示用的下行神经元手柄——DNa01/DNa02（转向，Yang et al. 2024 *Cell*）、oDN1（前进速度，Sapkal et al. 2024 *Nature*）——功能鉴定大量依赖光遗传激活实验（见知识库 01/03 文档）。
4. **flybench 的方法学同源**。其 36 个"刺激→反应"预注册任务，正是光遗传式因果扰动在计算侧的镜像；我们的 l1_lif 已接入（`game/tools/flybench_models/`）。
5. **flybench 结果刚出齐**：FlyWire 总分输（0.533 vs 0.767）但视觉选择性五连赢、MaleCNS 核心层反超（0.667 vs 0.567）、flash_is_not_loom 任务在两个数据集呈现完美的符号规则对照（0.972→0.058 vs 0.926→0.351）——全部存档于 `game/docs/flybench-report.md`。

## 二、升级计划（按时效与杠杆排序）

### T1 · 游戏"光遗传模式"（核心功能，2–3 天）

**玩法**：新增模式开关，玩家获得一支"虚拟激光笔"——在右侧功能组面板点选任意组（或点果蝇脑区），选择"激活"（Poisson 注入电流）或"抑制"（该组连接置零），果蝇行为实时变化。

**预设实验卡（一键复现经典，i18n 双语）**：
| 卡 | 操作 | 预期表型 | 对应真实实验 |
|---|---|---|---|
| 嗅觉丧失 | 抑制 OLF_ORN_FOOD | 香蕉到嘴边也找不到 | 嗅觉受体沉默实验 |
| 凭空伸喙 | 激活 SEZ_FEED | 无香蕉也伸喙 | Shiu et al. 2024 味觉激活验证 |
| 原地转圈 | 单侧激活 GNG_DESC | 持续转向 | 下行神经元单侧激活（Yang et al. 2024） |
| 无威胁逃逸 | 激活 OLF_ORN_DANGER | 原地逃离 | 危险气味通路激活 |

**技术要点**：stimulate 路径已有；silence 需在 sim-core 加组掩码（把目标组出边增益置零，可逆）；3D/2D 视角下被照组高亮显示；诚实面板加区分声明："虚拟光遗传=对模型神经元的激活/抑制；真实光遗传=对活体神经元的基因改造+光照——本 demo 模拟的是前者预测后者的能力"。

### T2 · 第三期传播（本周内，蹭诺奖热度）

《刚拿诺奖的光遗传学，我们给你做成了开关》：录 T1 的四张实验卡连播（瞎掉→伸喙→转圈→逃跑），结尾卡"诺奖方法 × 真实连接组，在你浏览器里"。文案基调：不蹭虚名——明说"诺奖是对活体神经元的，我们是对模型神经元的；连接组模型的价值正是预测光遗传实验"。

### T3 · 知识库增补（1 天）

新增 `knowledge/08-光遗传学与2026诺贝尔奖.md`：三人贡献与发现史、channelrhodopsin 原理、光遗传与连接组研究的交汇（Shiu 验证、下行神经元筛选、flybench 任务设计）、术语表增补（optogenetics / channelrhodopsin / activation & silencing / perturbation battery）。

### T4 · 论文 v7.0（下周）

三块新料：① flybench 完整结果（"总分输、结构赢" + MaleCNS 核心反超 + flash 符号对照）；② 诺奖视角重 framed："光遗传时代的连接组仿真——模型作为可计算的光遗传预测机"；③（可选）虚拟光遗传扰动电池：对 26/63 组逐一激活+抑制输出行为表型矩阵（Shiu 图 2 的做法，两个数据集各跑一遍，计算量可控）。

### T5 · 外联（随手）

`docs/outreach/` 已有草稿：给 Shiu 的邮件、flybench issue、snedea issue、社交 thread——诺奖是发送这些的天然由头。

## 三、执行顺序建议

T2（功能）→ T1 替代文案（等 T2 落地后录）→ T3（知识库）→ T4（论文）→ T5（外联）。
注：上文 T1/T2 编号按"功能先行"执行，即先做光遗传模式（标号 T1 的功能、标号 T2 的传播）。
