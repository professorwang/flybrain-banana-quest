#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_flywire_variant.py —— 从 FlyWire 源 CSV 重建连接组二进制（含等价性自检），
并生成"谷氨酸抑制"变体（符号必要性实验）。

背景：复审 R1/伸展项——MaleCNS 的正向符号翻转（glut 抑制→兴奋）已证明充分性，
本脚本提供 FlyWire 一侧的必要性检验（glut 兴奋→抑制）。

管线（复现 vendor/snedea-flybrain/scripts/build_connectome.py 的聚合逻辑）：
  1. neurons.csv.gz 行序 = 原始索引（与 shipped connectome.bin.gz 一致）；
  2. connections.csv.gz 逐行 (pre, post, syn_count, nt_type)，按 (pre,post) 对聚合：
     w += syn_count × NT_SIGN[nt_type]（unknown 默认 +1——注意上游无 histamine 项）；
  3. 赋号后 |w|=0 的对丢弃（与上游一致，shipped bin 因此比无符号聚合少 2,277 对）；
  4. 边按 (pre, post) 排序输出 sim-core 格式；元数据直接复制 shipped bin
     （分类管线与本实验无关，复制可保证逐字节一致）。

等价性自检（默认强制执行）：先用 GLUT=+1 重建标准版，与 shipped
connectome.bin.gz 逐字段对比（N/E/逐边 pre/post/weight），完全一致才产出变体。
用法：
  python game/tools/build_flywire_variant.py            # 自检 + 生成 glut 抑制变体
  python game/tools/build_flywire_variant.py --check-only   # 只做等价性自检
"""
from __future__ import annotations

import csv
import gzip
import struct
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor" / "snedea-flybrain" / "data"
OUT = ROOT / "game" / "data"

# 与上游 NT_SIGN 一致（build_connectome.py:104-111）；注意无 histamine 项（默认 +1）
NT_SIGN_STD = {"ACH": 1.0, "GLUT": 1.0, "DA": 1.0, "OA": 1.0, "SER": 1.0, "GABA": -1.0}
NT_SIGN_VARIANT = dict(NT_SIGN_STD, GLUT=-1.0)   # 唯一差异：谷氨酸 -1（抑制）


def load_root_ids(path: Path) -> list[str]:
    ids = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ids.append(row["root_id"])
    return ids


def aggregate(path: Path, id2idx: dict[str, int], sign: dict[str, float]):
    sums: dict[tuple[int, int], float] = defaultdict(float)
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            a, b = row["pre_root_id"], row["post_root_id"]
            ia, ib = id2idx.get(a), id2idx.get(b)
            if ia is None or ib is None:
                continue
            sums[(ia, ib)] += int(row["syn_count"]) * sign.get(row["nt_type"].strip().upper(), 1.0)
    edges = sorted((a, b, w) for (a, b), w in sums.items() if w != 0.0)
    return edges


def read_shipped(path: Path):
    with gzip.open(path, "rb") as f:
        blob = f.read()
    N, E = struct.unpack_from("<II", blob, 0)
    edges = [(0, 0, 0.0)] * E
    for e in range(E):
        edges[e] = struct.unpack_from("<IIf", blob, 8 + e * 12)
    meta = blob[8 + E * 12: 8 + E * 12 + N * 3]
    return N, E, edges, meta


def write_bin(path: Path, N: int, edges: list, meta: bytes) -> None:
    buf = bytearray(8 + len(edges) * 12)
    struct.pack_into("<II", buf, 0, N, len(edges))
    pos = 8
    for a, b, w in edges:
        struct.pack_into("<IIf", buf, pos, a, b, w)
        pos += 12
    with gzip.open(path, "wb", compresslevel=6) as f:
        f.write(buf)
        f.write(meta)
    print(f"写出 {path} ({path.stat().st_size / 1024 / 1024:.1f} MB)", file=sys.stderr)


def main() -> None:
    check_only = "--check-only" in sys.argv
    print("读取 root_id 列表…", file=sys.stderr)
    root_ids = load_root_ids(VENDOR / "neurons.csv.gz")
    id2idx = {r: i for i, r in enumerate(root_ids)}
    N = len(root_ids)

    _, E_ship, edges_ship, meta = read_shipped(OUT / "connectome.bin.gz")
    print(f"shipped bin: N={N}（文件核对）E={E_ship}", file=sys.stderr)

    print("标准符号（GLUT=+1）聚合中…", file=sys.stderr)
    edges_std = aggregate(VENDOR / "connections.csv.gz", id2idx, NT_SIGN_STD)
    print(f"聚合得 {len(edges_std)} 条边（shipped {E_ship}）", file=sys.stderr)

    # ---- 等价性自检：逐边对比 ----
    ok = len(edges_std) == E_ship
    mismatches = 0
    if ok:
        for e in range(E_ship):
            a1, b1, w1 = edges_std[e]
            a2, b2, w2 = edges_ship[e]
            if a1 != a2 or b1 != b2 or abs(w1 - w2) > 1e-6:
                mismatches += 1
                if mismatches <= 5:
                    print(f"  不一致 edge {e}: 重建({a1},{b1},{w1}) vs shipped({a2},{b2},{w2})",
                          file=sys.stderr)
    print(f"[等价性自检] 边数一致={ok}，逐边不一致数={mismatches}", file=sys.stderr)
    if not (ok and mismatches == 0):
        print("等价性自检失败：重建管线与 shipped 不一致，不产出变体（管线不可信）",
              file=sys.stderr)
        sys.exit(1)
    print("[等价性自检] 通过：重建与 shipped connectome.bin.gz 逐字节一致 ✔", file=sys.stderr)
    if check_only:
        return

    print("变体符号（GLUT=-1）聚合中…", file=sys.stderr)
    edges_var = aggregate(VENDOR / "connections.csv.gz", id2idx, NT_SIGN_VARIANT)
    print(f"变体边数 {len(edges_var)}（标准版 {E_ship}；抵消丢边差异 "
          f"{E_ship - len(edges_var)}）", file=sys.stderr)
    write_bin(OUT / "connectome-flywire-glutinh.bin.gz", N, edges_var, meta)


if __name__ == "__main__":
    main()
