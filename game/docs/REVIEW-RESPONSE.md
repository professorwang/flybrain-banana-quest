# 评审答复信（TECH-NOTE v2 → v3）

> 致评审：感谢逐条实质意见。我们逐条独立核实，**基本全部采纳**。本信按"意见 → 我们的核实
> 过程与数据 → v3 修改位置"组织。核实过程产生的新数据均可在仓库中一票复现
> （命令见各条与 `game/docs/results/`）。—— Banana Quest 项目组，2026-09-26

## R1 预处理描述（≥5 过滤与符号规则）

**意见**：v2 §5.1 称 FlyWire"保留任意强度连接、MaleCNS 独有 ≥5 过滤"有误；且两打包的
递质符号规则不同（FlyWire 包 GLUT 兴奋性、MaleCNS 包 GLUT 抑制性）未声明。

**核实**：三点全部属实。
1. 我们对 FlyWire 源 CSV 按神经元对重新聚合（复现者提供的数据）：
   无符号合计 **min=5.0、<5 的对数 0**（2,700,513 对；与二进制 2,698,236 边的差额
   2,277 对为赋号后跨 neuropil 完全抵消被丢弃）。**两个数据集都是 ≥5 突触过滤**。
2. 符号规则：vendor/snedea-flybrain/scripts/build_connectome.py:104-111 的
   `NT_SIGN = {ACH+1, GLUT+1, DA+1, OA+1, SER+1, GABA−1}`——FlyWire 包确实把
   **谷氨酸当兴奋性**；MaleCNS 转换沿用的 fly-brain-minecraft 规则 glut=−1（GluCl
   生物学，与 Shiu et al. 2024 一致）。v2 的 "equivalent sign rule" 系我们的错误。
3. v2 §5.3 用"≥5 过滤"解释 MaleCNS ti=4 不点燃——归因随事实修正而失效。

**额外实验（超出意见本身）**：我们直接检验了符号假说。用 `flyb_to_bin.py
--glut-excitatory` 生成仅翻转 MaleCNS 谷氨酸符号（29,763 个神经元 −1→+1，
其余全同）的变体数据，跑 ti=4 探针：

| 变体 | 总放电（200 tick） | DN | VIS_OL |
|---|---|---|---|
| 标准版（glut 抑制） ti=3.0 | 235,638 | 11 | 0 |
| 标准版 ti=4.0 | 331,336 | 75 | 2 |
| **glut 兴奋变体 ti=3.0** | 492,145 | 1,025 | 41 |
| **glut 兴奋变体 ti=4.0** | **1,797,262** | **19,004** | **553,863** |

单变量符号翻转即复现 FlyWire 式视叶点燃（存档 `docs/results/signflip_ti34.txt`）。
结论：点燃差异由符号规则、而非边过滤解释——这是直接实验证据。

**v3 修改位置**：§5.1 全节重写（两数据集均 ≥5 过滤 + 符号表对照 + 重大混杂声明）；
§5.3 撤回过滤归因，写入符号翻转实验；§2.2 工作点讨论同步。

## R2 Shiu 误引

**意见**："Shiu et al. (2024)-style normalization" 是误引——其官方代码
（philshiu/Drosophila_brain_model, model.py）为每突触固定系数
`w_syn = 0.275 · mV`，无按突触后总输入归一化。

**核实**：属实。我们核对了该仓库 model.py 的权重公式，确为全局固定系数。
**v3 修改位置**：全文改称为 **postsynaptic L1 normalization (introduced in this
project)**（摘要、§2.2 附更正说明、§5.3），并写明与 Shiu 全局系数方案的差异；
`game/src/sim-core.js` 两处注释、`game/README.md`、`game/index.html` 诚实面板同款
表述一并改正。Shiu et al. 2024 仍在参考文献中保留（仅作领域背景，不再挂在归一化
方案名下）。

## R3 "无手工行为层"言过其实

**意见**：game.js 存在显式规则（低放电随机游走、近香蕉减速停止、逃逸随机转向、
墙壁反弹），"no hand-crafted behavior layer / every turn conditioned on network"
不成立。

**核实**：属实，是我们表述失守。**v3 修改位置**：§1 新增小节 **"1.1 Explicit
game-layer motor rules (disclosed in v3)"**，逐条列出待机随机游走（UI 标注非脑
驱动）、减速-转身与进食圈内停止、逃逸触发为脑响应但逃逸机动为脚本、墙壁反弹、
饥饿时钟与人工驱动接线、感觉映射与池选取为手工设计；全文相关表述改为"连接组
放电参与运动读出与进食门控，游戏同时包含显式运动规则"，并明确脑真正门控的是
进食、转向/速度调制、惊吓响应判定。

## R4 Finding 2 归因过度

**意见**：换数据集时个体/性别/VNC/符号规则/池定义/工作点全变了，"分组伪影"
只能算假说；应提出决定性检验。

**核实**：属实。**v3 修改位置**：§3.3 改为"Interpretation — hypothesis, not
conclusion"；§5.4 标题改为 "not replicated under the tested MaleCNS conditions"，
明确"在所测 MaleCNS 条件下未复现同样偏置"，归因保留为假说；§6 next experiments
第一条：在**同一 FlyWire 数据**上以替代规则重分组/替换侧标签再测偏置——偏置若
消失则伪影解读成立。v1 的 FlyWire 测量与 v2 的 MaleCNS 对照均如实保留，叙事线
（测量→假说→修正）不动。

## R5 分池与统计披露

**意见**：MaleCNS 嗅觉池含 411 个 unknown 侧 ORN 按奇偶分配（左 1,090 / 右 1,549，
等电流下右侧总输入多约 42%）；10 个中线 DN 被人为分池；单轨迹放电数非独立样本；
侧向差应为 9.49 个百分点（v2"~8%"算错）。

**核实**：全部属实（0.580−0.485=0.0949，是我们的算术错误）。
**v3 修改位置**：§5.4 侧向差更正为 **9.49 个百分点**；新增 "Statistical
disclosures (v3)" 四条：池不对称（411 unknown 侧按索引奇偶、1,090/1,549、≈42%
总输入差）、10 个中线 DN 人为分池、每条件为单次确定性轨迹且放电数非独立样本、
ti=4 不自动等于统计充分；并声明两数据集游戏内转向仍需基线校正。

## R6 Finding 1 收窄（增益依赖）

**意见**：把 global-max 增益从 0.15 调到 1.5 后，评审者实测 FlyWire/MaleCNS 分别
出现 16/131 次中枢放电——"必然不传播"不成立。

**核实**：**我们一票复现了评审数字，分毫不差**。协议：sim-core global-max 路径、
0.5 强度 × 100 tick 刺激左嗅觉池、values 增益 ×10。结果（存档
`docs/results/probe_flywire.txt` 探针 5 与 `docs/results/gain_x10_malecns.txt`）：

| 数据集 | 增益 ×1（0.15） | 增益 ×10（1.5） |
|---|---|---|
| FlyWire | 中枢 0（总 18,525 全感觉区） | **中枢 16**（总 19,201） |
| MaleCNS | 中枢 0（总 21,867 全感觉区） | **中枢 131**（总 26,010，另有运动 13） |

**v3 修改位置**：Finding 1 标题/摘要/讨论全部收窄为"**在参考增益（0.15）下**传播
失败"；新增 §2.3 "Gain dependence (review replication, added in v3)"，并注明更高
增益不代表稳定可用，但"global-max 必然不传播"的概括不再成立。

## R7 复现性

**意见**：① v1 的 inline 探针应固化成脚本；② 复现表命令补种子与固定配置；
③ 关键逐次运行输出应存档；④ 种子 101–110 既选参数又评估，不再是独立测试集。

**核实**：全部属实且合理。**v3 修改位置**：
① 新建 `game/tools/probe_flywire.mjs`（与 `probe_malecns.mjs` 对齐：权重分布、
  参考增益失败、targetInput 扫描、偏置表、增益 ×10 复测）；
② §7 复现表全部命令补齐：headless 附显式种子（`180 '{}' 7 malecns`）、扫参命令
  注明对应历史 `bananaMaxDist` 取值（两轮扫参为 ∞，关卡比较为 ∞/350/250）；
③ 新建 `game/docs/results/` 存档：`probe_flywire.txt`、`probe_malecns.txt`、
  `gain_x10_malecns.txt`、`signflip_ti34.txt`（均含命令头注释，当前逐字节可复现）；
④ §4.3 与 §7 明确披露：101–110 同时用于选择与评估 `bananaMaxDist`，不再独立。

## 小项 a–e

- **a) "Poisson noise"**：属实——游戏为恒定电流注入，无 Poisson 实现。§4.1 改为
  "fluctuation-dominated（涨落来自网络动力学与游戏层随机性，非 Poisson 实现）"。
- **b) "turnGain 单调变差"**：属实有反例（turnGain 4 × σ250 × baseSpeed 12 得分
  2.20，与默认 2.80 差距小）。§4.1 改为"趋势温和且依配置而异，多数行更差，
  表格有反例"，与 README 表格严格一致。
- **c) Schlegel 推断**：属实——跨连接组边重现率不能推出侧向平衡精度。已删除该
  推断，§3.3 不再引用此论据（Schlegel 条目保留于参考文献）。
- **d) "350px 几何无效"**：改为"350 上限仍排除了远角（最远约 362px），但该配置
  与默认差异不显著（种子集内指标完全一致）"（§4.2）。
- **e) PDF 标题区链接**：md_to_pdf.py 的 Repository/Demo 已改为真实链接
  （https://github.com/professorwang/flybrain-banana-quest 与
  https://professorwang.github.io/flybrain-banana-quest/），页脚同步 v3。

## 伸展项：符号翻转探针（已完成）

见 R1 节——已做，结果写入 v3 §5.3（单变量翻转即复现点燃表型），变体构建命令与
探针脚本均已入库可复现。下一步（v4 候选）：在 FlyWire 数据上做反向翻转
（GLUT 兴奋→抑制），观察 ti=4 点燃是否消失，双向闭环符号假说。

## 附：v3 全部改动文件

- `game/docs/TECH-NOTE.md`（v3 全文重写）
- `game/docs/REVIEW-RESPONSE.md`（本信）
- `game/docs/TECH-NOTE.pdf`（重新生成，含上述全部修正）
- `game/tools/probe_flywire.mjs`（新建）；`game/tools/flyb_to_bin.py`（新增
  `--glut-excitatory` 变体构建）；`game/tools/md_to_pdf.py`（链接与 v3 页脚）
- `game/src/sim-core.js`（归一化注释更正）、`game/README.md`、`game/index.html`
  （同款表述更正）
- `game/docs/results/`（4 份运行存档）

---

# 第二轮（v3 → v4）：复审答复

> 复审结论：符号翻转实验经独立重建复现通过（331,336/75/2 与 1,797,262/19,004/553,863），
> R1–R7 未全部关闭。以下逐条答复。致谢：复审指出的 histamine 事实错误、"全部命令补齐"
> 的言过其实、算式不严谨三处，我们核实后全部认错并改正。

## S1 histamine 符号表（认错更正）

**意见**：FlyWire 包 NT_SIGN 无 histamine 项，v3"两包均将 histamine 设为抑制"错误。

**核实**：属实。vendor/snedea-flybrain/scripts/build_connectome.py:104-111 的 NT_SIGN 仅
{ACH, GLUT, DA, OA, SER, GABA}，histamine 走 unknown 默认 +1（兴奋）；仅 MaleCNS 包明确
histamine −1。**修改位置**：§5.1 符号对照改为四行表（ACH 均兴奋；GLUT FlyWire 兴奋/
MaleCNS 抑制；histamine FlyWire 无配置默认兴奋/MaleCNS 抑制；GABA 均抑制），并注明
光受体（组胺能）直接受影响。

## S2 "introduced in this project" 措辞

**意见**：归一化方案命名仍暗示原创。

**处理**：全文改 **"postsynaptic L1 normalization (adopted in this project)"**，
中文"本项目提出"→"本项目采用"（摘要、§2.2、sim-core.js 注释、README、index.html）。

## S3 残留绝对表述与跨数据集推断

**意见**：仍有 "every steering decision" 类表述；§5.4 由 MaleCNS 上行神经元嗅觉零响应
推出 FlyWire GNG_DESC 响应"非上行成分"是跨数据集推断。

**处理**：§1 改为 "participates in steering and in feeding gating"；§5.4 删除该推断，
MaleCNS AN 零响应仅作为 MaleCNS 观察保留，并显式声明"FlyWire 上行成分贡献**尚未验证**"。

## S4 侧向差算式

**意见**："0.580 − 0.485 = 0.0949" 算术不成立，应写精确分数。

**处理**：§5.4 改 **`91/157 − 111/229 ≈ 0.09490`（9.49 个百分点）**。

## S5 EMA 读出措辞

**意见**："去除偏置""跟踪当前梯度""必要"等措辞无消融支持。

**处理**：§3.2 全节改为 **"heuristic high-pass readout（本项目采用的启发式高通读出）"**，
明确不声称去除偏置、不提供"真实"侧向信号，τ 扫描为唯一消融；§3.3/§5.4/§6 同步。

## S6 Finding 3 表述

**意见**："systematically overfit" 过强；首吃时间统计口径未披露；turnGain 反例需写全参数。

**处理**：摘要改为具体观察（冠军配置在 10 个样本外种子上未保持优势）；§4.1 披露
**首吃统计只计成功 episode**；反例写全：固定 σ250、baseSpeed 12，gain 2.6→4 时
平均分 1.80→2.20（上升）。另按复审实测补充配置可复现性说明：冠军 3.00 系历史
bananaMaxDist=∞ 下测得，当前默认 250 下为 2.20，显式恢复历史值得 3.00（我们已复核，
与复审数字一致）。

## S7 符号翻转结论收窄 + 反向实验

**意见**：v3 结论"符号规则解释跨数据集差异"超出证据（必要性未在 FlyWire 上确立）；
"seizure-prone" 等术语未定义。

**处理**：① 术语改为可测量表述（"high visual-lobe activity"）；② 完成反向实验——
新脚本 `game/tools/build_flywire_variant.py` 从 FlyWire 源 CSV 重建（**等价性自检：
标准符号重建与 shipped connectome.bin.gz 2,698,236 边逐边一致、0 不匹配**），
生成 glut 抑制变体（+517 边，符号翻转改变抵消关系所致）。探针结果
（`node game/tools/probe_signflip.mjs`，存档 `docs/results/signflip_flywire.txt`）：

| 变体 | ti | 总放电 | GNG_DESC | VIS_ME |
|---|---|---|---|---|
| FlyWire 标准（glut 兴奋） | 3 | 447,219 | 3,810 | 2,860 |
| FlyWire 标准 | 4 | 1,265,998 | 25,730 | 405,788 |
| FlyWire glut 抑制 | 3 | 222,036 | 30 | **0** |
| FlyWire glut 抑制 | 4 | 291,831 | 113 | **0** |

结论按复审措辞收窄后双向闭环：**在固定 MaleCNS 图上仅翻转 GLUT 符号足以引起大量
视叶活动（充分性）；在固定 FlyWire 图上反向翻转则消除该活动（405,788→0，必要性）
——在所测两图与本刺激条件下，谷氨酸符号赋值对该高活动表型既充分又必要**；同时
明确这不证明符号表解释全部跨数据集差异（驱动不对称、解剖、过滤仍不同）（§5.3）。

## S8 R7 复现入口（"全部命令补齐"言过其实，认错并落实）

**意见**：inline 探针应固化；存档头部缺完整命令；29.6s 无种子；历史扫参缺显式配置；
缺 vendor 固定步骤；v3 信中"逐字节可复现"过度承诺。

**处理**：① 新建 `game/tools/probe_gain.mjs`、`game/tools/probe_signflip.mjs`（双向
一次跑完），inline 残迹两份存档头部标注"已取代 + 当前入口"；② FlyWire 闭环改用显式
种子重跑：**seed 7 首吃 34.8s**（替换原无种子 29.6s 记录）；③ harness 支持
`"bananaMaxDist":[null]`（=历史无上限），历史扫参命令全部带显式覆盖；冠军行验证
250→2.20 / null→3.00（与复审一致）；④ 新建 `game/tools/fetch_vendor_data.md`
（两上游仓库固定 commit + 全部数据文件 SHA-256，含 flyb.gz 与上游 PROVENANCE 一致的
e33df182…）；⑤ 时效字段（ms/tick）声明随机波动、不承诺逐字节，放电计数可复现；
PDF 页数收回 9 页内。

## 附：v4 全部改动文件

- `game/docs/TECH-NOTE.md`（v4）；`game/docs/REVIEW-RESPONSE.md`（本信追加第二轮）
- `game/tools/probe_gain.mjs`、`game/tools/probe_signflip.mjs`、
  `game/tools/build_flywire_variant.py`、`game/tools/fetch_vendor_data.md`（新建）
- `game/tools/harness.mjs`（bananaMaxDist null 约定）、`game/tools/md_to_pdf.py`
  （v4 页脚/标题）
- `game/data/connectome-flywire-glutinh.bin.gz`（变体，可由脚本重建）
- `game/docs/results/`（probe_gain.txt、probe_signflip.txt、signflip_flywire.txt 新增；
  gain_x10_malecns.txt、signflip_ti34.txt 头部标注已取代）
- `game/src/sim-core.js`、`game/README.md`、`game/index.html`（"采用"措辞同步）

---

# 第三轮（v4 → v4.1）："小修后通过"定向修订答复

> 复审结论：小修后通过，不需要追加实验。复审已独立重建反向变体并复跑八组符号实验
> （25,730/405,788 vs 113/0、75/2 vs 19,004/553,863）、增益 16/131+13、seed 7 的 34.8s、
> 冠军 3.00、7 个 SHA-256，全部吻合。剩三项有限修改 + 编辑清理，逐条如下。

## T1 histamine 再更正（认错：v4 的修正本身有误）

**意见**：v4 §5.1"histamine 无配置默认 +1、光受体直接受影响（8,021）"仍有事实错误。

**核实**：我们对 vendor/snedea-flybrain/data/connections.csv.gz 逐行扫描 `nt_type`，
3,869,878 行的标签集合**恰为六类**（唯一值清单，作为证据）：

```
ACH 2,258,155 | GABA 865,318 | GLUT 654,183 | DA 37,705 | SER 37,450 | OCT 17,067
（无 histamine、无空标签）
```

即 FlyWire 的六类递质预测**本就不包含 histamine**，所有神经元（包括光受体）都被标为
这六类之一，不存在"histamine 落入默认 +1"的数据行；8,021 是 MaleCNS 的 histamine
标记节点总数，不是光受体数。v4 的两处表述（"默认 +1""光受体直接受影响"）均错误，
认错。**修改位置**：§5.1 符号表 histamine 行改为 "not a predicted class in this
dataset / −1 inhibitory (8,021 labeled nodes)"，正文改为"不能从缺少该预测类别，直接
推断真实组胺能神经元在 FlyWire 包中的赋号"，删除光受体两句，并保留更正沿革
（v3 错 → v4 错 → v4.1 正确）以示透明。

## T2 反向实验精确化

**意见**："fixed FlyWire graph" 不准确（干预改变了边集）；517 边/77,650 共同边权重/
23,905 个 L1 分母应声明；"充分且必要"需限定条件范围。

**处理**：§5.3 反向实验改为"固定源连接表，重新聚合并计算 L1 归一化"；新增 Scope
note 脚注（517 条边差、77,650 条共同边权重、23,905 个 L1 分母为同一规则干预的后果，
非额外混杂——数字采用复审所给）；"充分且必要"严格限定为 **ti=4、I=1、200 tick 及
所比较的 GLUT 正/负两种配置**，ti=3 各行照实报告但明确不纳入结论范围。摘要与中文
摘要同步收窄。

## T3 最后两个复现入口

**意见**：补充探针与样本外比较仍未固化。

**处理**：① 新建 `game/tools/probe_supplementary.mjs`（进食/逃逸/上行三链，ti=4.0），
运行输出与历史一致（feed 3/tick 22；DNp01 0、AN 710；AN 0、DN 75），存档
`docs/results/probe_supplementary.txt`；② 新建 `game/tools/reproduce_sweeps.mjs`
（4 配置 × 10 样本外种子 × 180s，显式 bananaMaxDist），输出**与历史表逐项一致**
（49.6/27.3/38.6/42.6 中位；2.70/2.50/1.80/3.10 得分；曲折度同），存档
`docs/results/reproduce_sweeps.txt`；§7 复现表替换两行，开头承诺收窄为"除注明历史
记录外"——350px 对照行无法由脚本精确重建，已在 §7 明确标注"历史记录，配置见
game/README.md 调参记录"。

## T4 编辑清理

- a) "asymptote" 类表述全部改为"100 ticks 内观察到的最大电压"（有限时长测量），
  摘要/§2.1/§5.2 同步；
- b) §4.2 快速搜索两组对照写全：快速组中位 38.6 < 49.6s 但成功率降至 9/10、得分
  1.80；环带+快速中位 42.6 > 27.3s、得分 3.10（归因于漫游覆盖加速而非读出改进，
  未采用）；
- c) `fetch_vendor_data.md` 改用 `git -C … checkout …` 形式，校验示例修正为
  `sys.argv[1]`（原示例遗留未定义变量 `p`）；
- d) md_to_pdf 标题区 Repository 行去掉硬编码旧 hash（仅留仓库 URL；commit 沿革
  由 md 版本行呈现，本版提交号已回填为 `80a4768`）。

## 附：v4.1 全部改动文件

- `game/docs/TECH-NOTE.md`（v4.1）；`game/docs/REVIEW-RESPONSE.md`（本信追加第三轮）
- `game/tools/probe_supplementary.mjs`、`game/tools/reproduce_sweeps.mjs`（新建）
- `game/tools/fetch_vendor_data.md`（git -C 与校验示例修正）、`game/tools/md_to_pdf.py`
  （v4.1 页脚/标题、去硬编码 hash、版式压缩）
- `game/docs/results/`（probe_supplementary.txt、reproduce_sweeps.txt 新增）
- `game/docs/arxiv/`（LaTeX 投稿源：main.tex + README.md）

---

# 第四轮（v4.1 → v5）：核心论证通过后的交付修订与结构重构

> 复审结论：核心论证通过。剩 4 个交付问题 + 1 个结构建议。复审原话（结构建议）：
> "把反复更正的过程移到答复信或附录，让正文围绕一个问题展开：数据加工选择如何
> 改变连接组仿真的结论。"以下逐条答复。

## U1 LaTeX 字体（投稿兼容性）

**意见**：main.tex 按名称加载 Noto Sans CJK SC，arXiv 要求按文件名加载且其清单无此字体。

**处理**：改用 TeX Live 自带 Fandol 系列并按文件名加载：
`\setCJKmainfont{FandolSong-Regular.otf}[BoldFont={FandolHei-Regular.otf}, ItalicFont={FandolKai-Regular.otf}]`
+ `\setCJKsansfont{FandolHei-Regular.otf}`；§7 复现表加 `\footnotesize` +
`sloppypar` 防长命令串溢出；arxiv/README 写明 arXiv 用 XeLaTeX + Fandol、Overleaf
备选方案与自检命令的正确路径（`python game/docs/arxiv/check_tex.py`，仓库根目录）。
**编译验收已完成**（2026-09-27，主代理本机 MiKTeX xelatex 两遍）：8 页、无错误、
字体全嵌入，溢出修正后仅余 0.45pt 一处（不可见）。

## U2 R7 冠军样本外入口

**意见**：reproduce_sweeps.mjs 缺冠军配置的样本外复跑。

**处理**：补第 5 个配置（turnGain=1.8、种子 101–110、bananaMaxDist=null），实跑结果
**8/10、中位 57.7s、均值 73.7s、得分 1.30**——与正文 §4.1 数字逐项一致，存档
`docs/results/reproduce_sweeps.txt` 已更新。

## U3 许可统一（认错：此前 CC BY-NC-SA 为推定错误）

**意见**：FlyWire 官方 guidelines 现行文本为 CC BY-NC 4.0（无 SA）。

**核实**：属实。全局更正为 **CC BY-NC 4.0**：`.zenodo.json`（顶层 license 保留 MIT，
description 第一句明确 "MIT applies to code only; FlyWire data CC BY-NC 4.0,
MaleCNS data CC BY 4.0"，notes 同步）、`CITATION.cff`、`game/THIRD_PARTY_NOTICES.md`
（保留一处沿革说明）、`game/README.md`、`game/index.html`、
`game/tools/fetch_vendor_data.md`、`game/docs/TECH-NOTE.md`、
`game/docs/arxiv/main.tex`、`docs/media/zhihu-article.md`。知识库文档
（knowledge/04、06 与技能文件）历史表述"以官网为准"，本次未动，列后续维护项。

## U4 残留归因

**处理**：`game/THIRD_PARTY_NOTICES.md` 的 Shiu 条目改为与 v4.1 正文一致
（官方代码 w_syn=0.275·mV 全局系数；postsynaptic L1 为本项目采用，两者不同，早期
误引已更正）；arxiv/README 自检命令路径修正（见 U1）。

## U5 结构重构（复审核心建议，v5 重头）

**执行**：TECH-NOTE.md 与 main.tex 同步重构为单一主线——
**两个社区数据包的加工差异（赋号规则）→ 双向符号干预（充分+必要）→ 面向
"在连接组上跑动力学"社区的方法论建议**：
- 三个原始发现压缩为 §1.1 先驱发现 P1/P2/P3（各保留核心数字与教训，流水账删除）；
- v2→v4.1 更正沿革全部移出正文，集中到附录 A "Correction history"（简述）与本
  答复信（详录）；
- 新增 §4 先例对照：fly-brain-minecraft 的 docs/VALIDATION.md（静默脑检查、
  sugar→MN9 进食链、增益扫描 0.65/0.75 失控、嗅觉 PN 饱和与"无明确转向信号"
  的如实限制）与 flybench（预注册任务、重连对照），逐条说明本文新增——双向
  符号干预的因果设计、跨数据包审计方法（重建等价性自检）、全命令冻结的公开管线；
  并指出与上游记录的收敛点（嗅觉→DN 转向弱、增益悬崖、逐数据集校准）本身即证据；
- "充分且必要"结论后新增边界声明：这是**模型内赋号干预的因果结果**，不能据此
  推导真实果蝇的谷氨酸机制；生物机制论文需要生理/行为证据；
- 中英文摘要同步聚焦主线。

**对学术/商业评估边界的回应要点**：接受技术报告定位（不宣称生物保真度、不宣称
"上传"）；接受"充分且必要"仅为模型内因果声明（见上边界声明）；许可按官方文本
更正后，代码 MIT / FlyWire CC BY-NC 4.0（非商业）/ MaleCNS CC BY 4.0 三分权属
在 .zenodo.json、CITATION.cff、THIRD_PARTY_NOTICES 与各 README 一致。

## 附：v5 全部改动文件

- `game/docs/TECH-NOTE.md`（v5 结构重构）；`game/docs/arxiv/main.tex`（同步重构
  + Fandol）；`game/docs/arxiv/README.md`（编译说明与自检路径）
- `game/docs/REVIEW-RESPONSE.md`（本信追加第四轮）
- `game/tools/reproduce_sweeps.mjs`（+冠军样本外配置）、
  `game/docs/results/reproduce_sweeps.txt`（重跑存档）
- 许可：`/.zenodo.json`、`/CITATION.cff`、`game/THIRD_PARTY_NOTICES.md`、
  `game/README.md`、`game/index.html`、`game/tools/fetch_vendor_data.md`、
  `docs/media/zhihu-article.md`
- `game/docs/TECH-NOTE.pdf`（v5 重出）

---

# 终审（v5 → v5.1）：五处小修

> 终审结论：核心研究通过，投稿前有限小修，不需要新增实验。以下逐条答复（2026-09-27）。

## F1 §2.3 文表矛盾

**意见**：正文称 ti=2 两数据集均未到达下行神经元，但表中 FlyWire 在 ti=2 已有 10 次
GNG_DESC 放电。**处理**：改写为分数据集描述起点（ti=2 FlyWire 首现 10 次、MaleCNS 为 0；
ti=3 FlyWire 可用、MaleCNS 刚到；ti=4 MaleCNS 可用）。md 与 LaTeX 同步。

## F2 上游比较不准确

**意见**：上游 VALIDATION.md §9 已有定量增益表，本文"上游仅定性"的比较不成立。
**处理**：删除 "gain dependence" 比较项（md 与 LaTeX 同步），双向干预贡献不受影响。

## F3 复现命令占位符

**意见**：`<grid JSON with …>` 与 `<champion grid JSON>` 不可执行。**处理**：恢复完整命令
（sweep 两轮与冠军配置的完整 JSON，含 `"bananaMaxDist":[null]`）；LaTeX 侧为防溢出手动断行。
R7 至此应可关闭。

## F4 提交号漏填

**意见**：main.tex 标题行与 PDF 首页仍是占位符。**处理**：已回填 `99ed490`（v5 支撑材料提交号），
重新编译 main.pdf；README 与答复信中"MiKTeX 安装中/待回填"的旧状态行已更新为验收结论。

## F5 两处总结超出实验范围

**意见**："静默是默认结果，不是刺激错误"需限定。**处理**：两处改为"本文两个数据包、指定刺激、
参考增益下未出现中枢传播，先把静默当检查项而非刺激错误"；"robustly helped"改为
"在所测种子上改善表现"（md 与 LaTeX 同步）。
