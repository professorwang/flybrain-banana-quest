# arXiv 投稿源（Banana Quest technical note v5）

本目录为 TECH-NOTE v5 的 LaTeX 投稿源，内容（数字、措辞、表格、参考文献 14 条）
与 `../TECH-NOTE.md`（v5）一致。v5 结构主线：数据包加工差异（赋号规则）→ 双向
符号干预（充分+必要）→ 对"在连接组上跑动力学"社区的方法论建议。

## 文件

- `main.tex` —— article 类（11pt, a4paper），正文英文、含中文摘要（xeCJK）。
- `check_tex.py` —— 静态自查：begin/end 环境配对、数学模式 `$` 配对、裸 `#`/`&`
  扫描、表格列数一致性。
- `check_us.py` —— 补充扫描：`\texttt`/数学/`\url` 之外的裸 `_`（应为 0）。

自检命令（仓库根目录运行）：

```bash
python game/docs/arxiv/check_tex.py   # 应输出 PASS
python game/docs/arxiv/check_us.py    # 应输出 0 命中
```

## 编译方法

**必须 XeLaTeX**（中文摘要依赖 xeCJK）。

- **arXiv 投稿**：字体用 TeX Live 自带的 **Fandol** 系列并按**文件名**加载
  （`FandolSong-Regular.otf` / 粗体 `FandolHei-Regular.otf` / 斜体
  `FandolKai-Regular.otf`）——arXiv 要求按文件名加载字体，且其字体清单不含
  本机字体（此前按名称加载 `Noto Sans CJK SC` 的写法不兼容，v5 已更正）。
- **Overleaf**：Menu → Compiler → **XeLaTeX**；Fandol 随 TeX Live 内置，无需
  额外安装。若个别环境缺 FandolKai，可去掉 ItalicFont 选项（斜体回退正体）。
- 本地 TeX Live / MiKTeX：`xelatex main.tex && xelatex main.tex`（hyperref
  交叉引用需两遍）。MiKTeX 首次编译会自动按需安装 xeCJK/Fandol。

### pdfLaTeX 备选

注释掉 `\usepackage{xeCJK}` 与两条 `\setCJK*font`，并删除
`%<PDFFRIENDLY-START/END>` 之间的"中文摘要"整段（其余中文仅出现在两条参考文献
题注与正文一处游戏名，需一并删除或音译）。

## 已知注意点

- 本目录产出时**本机 MiKTeX 正在后台安装**（主代理稍后做编译验收）；交付前已用
  静态自查替代验证（全部通过）。首次编译如遇告警，常见候选：长 `\url{}` 断行
  （必要时加载 `xurl`）、§7 复现表长命令串（已用 `\footnotesize` + `sloppypar`
  + 固定 `p{}` 列宽处理）。
- `__COMMIT__` 占位符（标题行与 §7 各一处引用，正文实际出现两次：标题行与
  Reproducibility 的 commit lineage）在仓库侧由主代理提交时回填。
- 参考文献用 `thebibliography` 手工环境（14 条，与 md 版一致），未用 BibTeX——
  arXiv 直传 main.tex 即可，无需 .bbl。
- 表格为 booktabs 风格；正文数字与 md 版 v5 逐项一致（若 md 再修订，请同步本
  文件并重跑 `check_tex.py`）。
