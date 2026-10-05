# 对外材料（草稿，均未发送）

> 这些是起草好的外发内容，**没有任何一项已经发出**。发什么、何时发、用谁的账号，由作者决定。
> 发出前请逐条核对其中的数字（都来自 `game/docs/results/`，可用 `verify_results.mjs` 复核）。

## 建议顺序与前置条件

| 步骤 | 材料 | 前置条件 |
|---|---|---|
| 0 | 推送 master 上的 `9674d8d`（许可修复 + 图 1） | — |
| 1 | 在干净克隆上运行 `node game/tools/verify_results.mjs`，全绿 | 步骤 0 |
| 2 | 发布 v6.1：合并 `v6.1-draft`，把 main.tex 标题行从 "draft" 改为正式，新建 release 并在 Zenodo 上传新版本 | 步骤 1 |
| 3 | [issue-snedea-flybrain.md](issue-snedea-flybrain.md)、[issue-flybench.md](issue-flybench.md) | 步骤 0（链接可打开） |
| 4 | [email-shiu-et-al.md](email-shiu-et-al.md)：一封，不追发 | 步骤 2（邮件里引用了 v6.1 的内容） |
| 5 | [biorxiv-submission-sheet.md](biorxiv-submission-sheet.md)：先 bioRxiv，arXiv 需找背书人 | 步骤 2 |
| 6 | [social-thread.md](social-thread.md) | 步骤 2、3 |

## 为什么 v6.1 必须在邮件和投稿之前

v6.0.1 漏引了 Shiu et al. 2024 自己做过的"谷氨酸改兴奋"敏感性检验。给他们发邮件或把论文
挂到预印本平台之前，必须先用 v6.1 补上，否则对方一眼就能看出。

## 需要作者确认的事实（我没有编造）

- ORCID、竞争利益与资助声明（见投稿材料表）；是否在声明里写 Fortune AI 的商业关系。
- Shiu et al. 通讯作者的邮箱（取自 Nature 文章页，我没有猜）。
- arXiv 上是否已有这篇（2026-10-03 我按标题与作者各搜一次，均无结果）。
- 会议截止日期：COSYNE 2026 的摘要截止是 2025-10-16；2027 年的公告我没搜到，
  按往年推测大概率在本月中旬，请到 cosyne.org 确认，不要以此为准。
