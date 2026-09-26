#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check_us.py —— 扫描 main.tex 中 \texttt 与数学模式之外的裸下划线。"""
import re

src = open('game/docs/arxiv/main.tex', encoding='utf-8').read()
# 先抠掉 \texttt{...}（允许一层花括号嵌套）
stripped = re.sub(r'\\texttt\{(?:[^{}]|\{[^{}]*\})*\}', '', src)
bad = []
for i, l in enumerate(stripped.split('\n'), 1):
    if l.lstrip().startswith('%'):
        continue
    code = re.sub(r'(?<!\\)%.*', '', l)
    code = re.sub(r'\$[^$]*\$', '', code)          # 抠行内数学
    code = re.sub(r'\\url\{[^}]*\}', '', code)      # 抠 \url{...}（内部允许 _）
    if re.search(r'(?<!\\)_', code):
        bad.append((i, l.strip()[:90]))
print('texttt/数学/url 之外裸 _ 命中行数:', len(bad))
for i, l in bad[:20]:
    print(f'  {i}: {l}')
