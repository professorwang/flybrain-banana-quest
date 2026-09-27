# arXiv 投稿源（Banana Quest technical note v6.0）

本目录为 TECH-NOTE v6.0 的 LaTeX 投稿源，内容（数字、措辞、表格、参考文献 14 条）
与 `../TECH-NOTE.md` 一致。v6.0 主线：两个数据包的谷氨酸赋号规则相反 → 双向符号
干预 → 用质量匹配对照、等质量身份检验、剂量-反应与第二种权重方案检验这一干预
到底隔离了什么（撤回 v5.1 的"充分且必要"表述）→ 方法论建议。

## 文件

- `main.tex` —— article 类（11pt, a4paper），正文英文、含中文摘要（xeCJK）。
- `check_tex.py` —— 静态自查：环境配对、`$` 配对、裸 `#`/`&`、表格列数、
  **占位符残留、英文摘要 ≤1920 字符（arXiv 表单上限）、每条参考文献都被 `\cite`**。
- `check_us.py` —— 补充扫描：`\texttt`/数学/`\url` 之外的裸 `_`（应为 0）。

自检命令（仓库根目录运行；Windows 终端加 `PYTHONIOENCODING=utf-8` 可避免中文乱码）：

```bash
python game/docs/arxiv/check_tex.py   # 应输出 PASS
python game/docs/arxiv/check_us.py    # 应输出 0 命中
```

## 编译方法

**必须 XeLaTeX**（中文摘要依赖 xeCJK）。

- **arXiv 投稿**：arXiv 自 2025-11 起支持 XeLaTeX；上传 `main.tex` 后在处理器
  选项中**选择 xelatex**（默认是 pdflatex，会失败）。字体用 TeX Live 自带的
  **Fandol** 系列并按**文件名**加载（arXiv 要求，按字体名加载不可用）。
- **Overleaf**：Menu → Compiler → **XeLaTeX**。
- 本地 TeX Live / MiKTeX：`xelatex main.tex && xelatex main.tex`（两遍）。

### pdfLaTeX 备选

注释掉 `\usepackage{xeCJK}` 与两条 `\setCJK*font`，删除
`%<PDFFRIENDLY-START/END>` 之间的中文摘要整段，并把 §1 的中文游戏名删去或音译。

## 投稿前清单（v6.0）

- [x] 本地编译通过（2026-09-27，MiKTeX xelatex 两遍，9 页，0 个 Overfull）。
- [x] `check_tex.py` PASS（英文摘要 1,637 字符；14 条参考文献全部被引用；无占位符）。
- [x] 版本标识：正文写"archived as repository release `v0.6.0`"，不再在文中写本版
      提交号（避免"写入提交号 → 产生新提交"的循环）。**发布 v0.6.0 release 后才成立。**
- [ ] 作者本人在干净克隆上按 `game/tools/fetch_vendor_data.md` 重跑
      `probe_controls.mjs` 与 `probe_linear.mjs`，核对 `docs/results/` 中的数字。
- [ ] arXiv 背书（endorsement）：首次向 q-bio.NC 投稿通常需要背书人。
- [ ] arXiv 元数据表单：标题、作者、摘要（粘贴英文摘要纯文本版）、类别
      （建议主类 q-bio.NC，交叉 cs.NE）、许可（建议 CC BY 4.0 或 arXiv 默认许可）。
- [ ] 若 md 版再修订，同步本文件并重跑 `check_tex.py`。
