#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check_tex.py —— main.tex 静态自查（无 LaTeX 编译器环境的替代验证）。

v6 起新增 5–7 项：占位符残留、arXiv 摘要长度上限、参考文献引用完整性——
这三类问题都曾在"已定稿"版本里漏检过。"""
import re
from collections import Counter

src = open('game/docs/arxiv/main.tex', encoding='utf-8').read()
lines = src.split('\n')

print('1) begin/end 环境配对:')
begins = Counter(re.findall(r'\\begin\{([^}]+)\}', src))
ends = Counter(re.findall(r'\\end\{([^}]+)\}', src))
ok1 = begins == ends
for env in sorted(set(begins) | set(ends)):
    mark = 'OK ' if begins[env] == ends[env] else 'BAD'
    print(f'   {mark} {env}: begin={begins[env]} end={ends[env]}')

print('2) 数学模式 $ 配对:')
bad2 = 0
for i, l in enumerate(lines, 1):
    if l.lstrip().startswith('%'):
        continue
    code = re.sub(r'(?<!\\)%.*', '', l)   # 只在未转义 % 处截断注释（\% 是正文）
    n = len(re.findall(r'(?<!\\)\$', code))
    if n % 2:
        print(f'   BAD 行 {i} 奇数个 $: {l[:80]}')
        bad2 += 1
print('   OK 全部配对' if bad2 == 0 else f'   BAD {bad2} 行')

print('3) 特殊字符（裸 # / 表格外裸 & / 行内未转义 _ 抽查）:')
bad3 = 0
in_tab = False
for i, l in enumerate(lines, 1):
    if l.lstrip().startswith('%'):
        continue
    code = re.sub(r'(?<!\\)%.*', '', l)
    if '\\begin{tabular}' in code:
        in_tab = True
    if '\\end{tabular}' in code:
        in_tab = False
    # 宏定义行（\newcommand/\newcolumntype/\def）中的 #1 是合法参数引用
    if re.match(r'\s*\\(newcommand|renewcommand|providecommand|newcolumntype|def)\b', code):
        continue
    if re.search(r'(?<!\\)#', code):
        print(f'   BAD 行 {i} 裸 #: {l[:70]}'); bad3 += 1
    if not in_tab and re.search(r'(?<!\\)&', code):
        print(f'   BAD 行 {i} 表格外裸 &: {l[:70]}'); bad3 += 1
print('   OK 无裸 #/&' if bad3 == 0 else f'   BAD {bad3} 处')

print('4) 表格列数一致:')
bad4 = 0
for m in re.finditer(r'\\begin\{tabular\}\{((?:[^{}]|\{[^}]*\})*)\}(.*?)\\end\{tabular\}', src, re.S):
    spec, body = m.group(1), m.group(2)
    ncol = len(re.findall(r'[lcr]|L\{[^}]*\}', spec))
    for row in body.split('\\\\'):
        row = row.strip()
        if not row:
            continue
        amp = len(re.findall(r'(?<!\\)&', row))   # 只数未转义的列分隔符
        if amp and amp + 1 != ncol:
            print(f'   BAD 列数不符（期望 {ncol}）: {row[:70]}')
            bad4 += 1
print('   OK 全部一致' if bad4 == 0 else f'   BAD {bad4} 处')

print('5) 占位符/待办残留（placeholder / replace with / TODO / TBD / XXX）:')
bad5 = 0
for i, l in enumerate(lines, 1):
    if l.lstrip().startswith('%'):
        continue
    if re.search(r'placeholder|replace with|\bTODO\b|\bTBD\b|XXX|@@', l, re.I):
        print(f'   BAD 行 {i}: {l.strip()[:80]}'); bad5 += 1
print('   OK 无残留' if bad5 == 0 else f'   BAD {bad5} 处')

print('6) 英文摘要长度（arXiv 元数据表单上限 1920 字符）:')
m = re.search(r'\\begin\{abstract\}(.*?)\\end\{abstract\}', src, re.S)
a = m.group(1) if m else ''
a = re.sub(r'\\(textbf|emph|texttt)\{', '', a).replace('}', '').replace(r'\noindent', '')
for k, v in [(r'$\ge$', '>='), (r'$\to$', '->'), (r'$\sim$', '~'), (r'$\times$', 'x'),
             (r'\%', '%'), (r'\_', '_'), ('---', '--'), ('$', '')]:
    a = a.replace(k, v)
a = re.sub(r'\s+', ' ', a).strip()
ok6 = 0 < len(a) <= 1920
print(f'   {"OK " if ok6 else "BAD"} {len(a)} 字符')

print('7) 参考文献引用完整性（每条 bibitem 被引用、每个 cite 有条目）:')
items = re.findall(r'\\bibitem\{([^}]+)\}', src)
cited = set()
for g in re.findall(r'\\cite[pt]?\{([^}]+)\}', src):
    cited.update(k.strip() for k in g.split(','))
unc = [k for k in items if k not in cited]
dangling = sorted(cited - set(items))
ok7 = not unc and not dangling
print(f'   {"OK " if ok7 else "BAD"} 条目 {len(items)}，被引 {len(cited)}；未被引用 {unc}；无条目的 cite {dangling}')

print()
print('汇总:', 'PASS' if (ok1 and bad2 == 0 and bad3 == 0 and bad4 == 0 and bad5 == 0 and ok6 and ok7) else 'FAIL')
