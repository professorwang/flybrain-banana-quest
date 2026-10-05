# v6.1 发布清单与发布说明草稿（未执行）

状态（2026-10-03）：`v6.1-draft` 已快进合并进本地 master；master 领先 origin 4 个提交，**未推送**。
以下每一步都是对外可见的动作，由作者执行。

## 1. 推送前

- [ ] 浏览一遍 `git log origin/master..master`（4 个提交：许可修复+图 1、行级统计、v6.1 草稿、摘要+复核工具）。
- [ ] `game/docs/flybench-report.md` 的未提交改动与 `game/docs/results/flybench_*` 属于另一条线，**不在这 4 个提交里**，推送不会带上它们；它们的数字未经我审核。
- [ ] 推送后确认 GitHub 的许可识别：仓库页右侧应显示 MIT（此前是 NOASSERTION）。若仍不是，说明我对原因的怀疑（LICENSE 末尾附加说明）不对，需另查。

## 2. 发布前（需要作者本人）

- [ ] 在**干净克隆**上按 `game/tools/fetch_vendor_data.md` 准备数据，运行 `node game/tools/verify_results.mjs`，全绿。
- [ ] 补上作者才知道的事实：ORCID、竞争利益与资助声明（见 `biorxiv-submission-sheet.md`）。

## 3. 发布时要改的元数据（我没有预先改，因为它们依赖发布动作）

| 文件 | 要改什么 |
|---|---|
| `game/docs/arxiv/main.tex`、`game/docs/TECH-NOTE.md` | 标题行与页眉里的 "v6.1 (draft), 2026-10-03" 去掉 "draft"，改为实际发布日期；补上新版本的 Zenodo DOI |
| `CITATION.cff` | `version`、`date-released`，`doi` 指向新版本（或 concept DOI） |
| `.zenodo.json` | 描述里的版本号（目前写 v6.0） |
| `README.md` / `game/README.md` | 若有 DOI 徽章，更新 |

**DOI 循环**：论文里要写自己的 DOI，而 DOI 在 Zenodo 创建新版本后才有。v6.0.1 当时是多发一个 release 来回填。Zenodo 的新版本草稿页通常有"预留 DOI"按钮，可以先预留、写进论文、再上传最终文件，省去多发一版；我没有在你的账号上核实这个按钮的存在，请以实际页面为准。

## 4. 发布说明草稿

**Tag / 标题建议**：`v0.7.0 — Technical Note v6.1`（版本号由作者定；此前最新是 v0.6.2）

**English**

Technical note v6.1 — packaging choices change connectome-simulation outcomes.

- Adds Figure 1 (glutamate-rule flips vs mass-matched controls, two weight schemes).
- Credits prior work: Shiu et al. 2024 had already tested their model with glutamate excitatory (Methods; Supplementary Table 11f). Abstract and §3.1 now say so.
- Documents row-level vs neuron-level sign assignment in the FlyWire browser package (30.7% of presynaptic neurons carry both signs by synapse count).
- Adds `game/tools/verify_results.mjs`: re-runs the sign-intervention experiments and diffs against the archived outputs (`--quick` ≈ 1 min, full ≈ 5 min).
- Fixes GitHub license detection: `LICENSE` is now plain MIT (code only); data licenses are in `DATA-LICENSES.md`.
- No v6.0 number changes.

Code MIT; FlyWire data CC BY-NC 4.0 (non-commercial); MaleCNS data CC BY 4.0.

**中文**

技术报告 v6.1：数据加工选择如何改变连接组仿真结论。

- 新增图 1（谷氨酸翻转 vs 质量匹配对照，两种权重方案）。
- 补引前人工作：Shiu 等人（2024）已在其模型中检验过“谷氨酸改兴奋”（Methods；补充表 11f），摘要与 §3.1 已注明。
- 记录 FlyWire 浏览器包按连接行赋号：按突触数，30.7% 的突触前神经元同时有兴奋类与抑制类输出。
- 新增 `game/tools/verify_results.mjs`：重跑符号干预实验并与归档逐字比对（`--quick` 约 1 分钟，完整约 5 分钟）。
- 修复 GitHub 许可识别：`LICENSE` 改为标准 MIT（仅代码），数据许可见 `DATA-LICENSES.md`。
- v6.0 的数字均未改变。

代码 MIT；FlyWire 数据 CC BY-NC 4.0（仅限非商业）；MaleCNS 数据 CC BY 4.0。
