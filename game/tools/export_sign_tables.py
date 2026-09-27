#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""export_sign_tables.py —— 为对照实验（probe_controls.mjs）导出"按递质拆分"的中间表。

背景：v5.1 的符号干预翻转的是整条递质规则。要回答"起作用的是谷氨酸身份，还是任何
同等规模、同等位置的符号改变"，需要能按神经元、按递质任意组合地重新赋号。本脚本
把两份数据导出为可在 Node 里快速重新赋号的中间表（产物已 .gitignore，随时可重建）。

输出（game/data/derived/）：
  1. flywire-pair-nt.bin.gz —— FlyWire 源表 connections.csv.gz 按 (pre, post) 聚合、
     但**不合并递质**：每对保留 6 类递质各自的突触数。
       头部：4 字节 magic "FWNT"，u32 N，u32 P（对数）
       记录：P × (u32 pre, u32 post, 6 × u16 count)，递质顺序 ACH, GABA, GLUT, DA, SER, OCT；
             按 (pre, post) 升序（与 shipped connectome.bin.gz 的边序一致）
     注意 FlyWire 的递质标签按"连接行"（每个脑区一行）给出，同一神经元的不同行可以
     标签不同（约 9.1% 的突触与其突触前神经元的整体标签不一致），所以 v5.1 的 GLUT
     翻转作用于"所有 GLUT 行"，而不是"所有 GLUT 神经元"。
  2. malecns-nt.json —— MaleCNS 每个神经元（原始索引序）的递质标签与符号
     （FLYB 中符号按突触前神经元给出，一个神经元的所有出边同号）。

用法：python game/tools/export_sign_tables.py
"""
from __future__ import annotations

import csv
import gzip
from collections import Counter
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor" / "snedea-flybrain" / "data"
OUT = ROOT / "game" / "data" / "derived"
sys.path.insert(0, str(Path(__file__).resolve().parent))

RESULTS = ROOT / "game" / "docs" / "results" / "export_sign_tables.txt"
REPORT: list[str] = []   # 归档到 docs/results/ 的统计（TECH-NOTE §2 引用）

NT_ORDER = ["ACH", "GABA", "GLUT", "DA", "SER", "OCT"]
NT_COL = {k: i for i, k in enumerate(NT_ORDER)}


def export_flywire() -> None:
    ids = []
    with gzip.open(VENDOR / "neurons.csv.gz", "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ids.append(row["root_id"])
    id2idx = {r: i for i, r in enumerate(ids)}
    N = len(ids)
    pairs: dict[tuple[int, int], list[int]] = {}
    unknown = 0
    rows = 0
    label_rows: Counter = Counter()
    label_syn: Counter = Counter()
    with gzip.open(VENDOR / "connections.csv.gz", "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows += 1
            lab = row["nt_type"].strip().upper() or "(empty)"
            label_rows[lab] += 1
            label_syn[lab] += int(row["syn_count"])
            ia, ib = id2idx.get(row["pre_root_id"]), id2idx.get(row["post_root_id"])
            if ia is None or ib is None:
                continue
            col = NT_COL.get(row["nt_type"].strip().upper())
            if col is None:
                unknown += 1
                continue
            rec = pairs.get((ia, ib))
            if rec is None:
                rec = pairs[(ia, ib)] = [0] * 6
            rec[col] += int(row["syn_count"])
    if unknown:
        sys.exit(f"发现 {unknown} 行未知递质标签，与 v5.1 的六类标签扫描结论不符，停止")
    REPORT.append(f"- FlyWire connections.csv.gz 总行数 {rows:,}（每行 = 神经元对 × 脑区）")
    REPORT.append("- 行级递质标签（行数 / 突触数）：" + "；".join(
        f"{k} {label_rows[k]:,} / {label_syn[k]:,}" for k, _ in label_rows.most_common()))
    keys = sorted(pairs)
    P = len(keys)
    buf = bytearray(12 + P * 20)
    buf[0:4] = b"FWNT"
    struct.pack_into("<II", buf, 4, N, P)
    pos = 12
    mx = 0
    for k in keys:
        c = pairs[k]
        m = max(c)
        if m > mx:
            mx = m
        struct.pack_into("<II6H", buf, pos, k[0], k[1], *c)
        pos += 20
    if mx > 65535:
        sys.exit(f"单对单递质突触数 {mx} 超出 u16")
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "flywire-pair-nt.bin.gz"
    # mtime=0：gzip 头不写时间戳，同一输入重跑产出逐字节相同的文件
    with open(path, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6, mtime=0) as f:
        f.write(buf)
    print(f"写出 {path}：N={N} 对数={P}（无符号聚合，含符号抵消对）单格最大={mx}", file=sys.stderr)
    REPORT.append(f"- 神经元 {N:,}；无符号聚合神经元对 {P:,}（含符号抵消对）；单对单递质最大突触数 {mx:,}")


def export_malecns() -> None:
    import flyb_to_bin as F
    d = F.parse_flyb(F.FLYB)
    out = {
        "dataset": d["dataset"],
        "nts": d["tables"]["nts"],
        "nt": list(d["nt_idx"]),
        "sign": list(d["sign"]),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "malecns-nt.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"写出 {path}：N={len(out['nt'])}", file=sys.stderr)
    REPORT.append(f"- MaleCNS 神经元 {len(out['nt']):,}（逐神经元递质与符号表已导出）")


if __name__ == "__main__":
    export_flywire()
    export_malecns()
    header = "# export_sign_tables.py 统计\n\n命令：python game/tools/export_sign_tables.py\n\n"
    RESULTS.write_text(header + "\n".join(REPORT) + "\n", encoding="utf-8")
    print(f"统计写入 {RESULTS}", file=sys.stderr)
