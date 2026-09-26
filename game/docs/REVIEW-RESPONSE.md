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
