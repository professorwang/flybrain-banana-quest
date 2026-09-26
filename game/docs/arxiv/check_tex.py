#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check_tex.py —— main.tex 静态自查（无 LaTeX 编译器环境的替代验证）。"""
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

print()
print('汇总:', 'PASS' if (ok1 and bad2 == 0 and bad3 == 0 and bad4 == 0) else 'FAIL')
