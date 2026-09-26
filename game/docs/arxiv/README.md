# arXiv 投稿源（Banana Quest technical note v4.1）

本目录为 TECH-NOTE v4.1 的 LaTeX 投稿源，内容（数字、措辞、表格、参考文献 14 条）
与 `../TECH-NOTE.md`（v4.1）一致。

## 文件

- `main.tex` —— article 类（11pt, a4paper），正文英文、含中文摘要（xeCJK）。
- `check_tex.py` —— 静态自查：begin/end 环境配对、数学模式 `$` 配对、裸 `#`/`&`
  扫描、表格列数一致性。运行：`python check_tex.py`（仓库根目录）→ 应输出 `PASS`。
- `check_us.py` —— 补充扫描：`\texttt`/数学/`\url` 之外的裸 `_` → 应为 0。

## 编译方法

**必须 XeLaTeX**（中文摘要依赖 xeCJK）：

- **Overleaf**：Menu → Compiler → **XeLaTeX**。字体 `Noto Sans CJK SC` 平台内置，
  无需额外安装。
- 本地 TeX Live：`xelatex main.tex && xelatex main.tex`（hyperref 交叉引用需两遍）。

### pdfLaTeX 备选

若只有 pdfLaTeX：注释掉 `\usepackage{xeCJK}` 与 `\setCJKmainfont{Noto Sans CJK SC}`
两行，并删除 `%<PDFFRIENDLY-START>` 与 `%<PDFFRIENDLY-END>` 之间的"中文摘要"整段
（其余中文仅出现在两条参考文献的题注与正文一处游戏名，需一并删除或音译）。

## 已知注意点

- 本目录无本地 LaTeX 编译器，**未实际编译**；已用静态自查替代验证（见上两个
  脚本，全部通过）。首次在 Overleaf 编译如遇告警，常见候选：长 `\url{}` 断行
  （hyperref 已配置 urlcolor，必要处可加载 `xurl`）、§7 复现表中的长命令串
  （`p{}` 列宽已固定，可断行）。
- `__COMMIT__` 占位符（标题行一处）在仓库侧由主代理提交时回填，投稿前替换为
  实际 commit 短哈希。
- 参考文献用 `thebibliography` 手工环境（14 条，与 md 版一致），未用 BibTeX——
  arXiv 直传 main.tex 即可，无需 .bbl。
- 表格为 booktabs 风格；正文数字与 md 版 v4.1 逐项一致（若 md 再修订，请同步
  本文件并重跑 `check_tex.py`）。
