#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 game/data/pools.json —— 脑-游戏接口的神经元池定义（索引为"组排序后"空间）。

数据来源（只读）：
  vendor/snedea-flybrain/data/connectome.bin.gz   二进制连接组（原始索引 = neurons.csv.gz 行序）
  vendor/snedea-flybrain/data/neurons.csv.gz      root_id 列表，行序即原始索引
  vendor/snedea-flybrain/data/coordinates.csv.gz  root_id -> 胞体坐标（FAFB 体素坐标）

排序规则复现 js/sim-core.js 的 buildGroupStructures()：
  按 group_id 稳定排序（组内保持原始索引升序），得到 original->sorted 映射。

仅用 Python 标准库。用法：
  python game/tools/prepare_pools.py
"""
from __future__ import annotations

import csv
import gzip
import json
import random
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # F:/claude/fruitfly
VENDOR_DATA = ROOT / "vendor" / "snedea-flybrain" / "data"
GAME_DATA = ROOT / "game" / "data"

VIS_R1R6_SAMPLE = 2000        # vis_r1r6 池降采样目标数量
RANDOM_SEED = 42              # 固定种子保证可复现
COORD_MIN_COVERAGE = 0.9      # 坐标覆盖率低于此值则整池退化为奇偶切分


def read_connectome_meta(path: Path):
    """读二进制头与逐神经元元数据，顺带统计权重量级供调参参考。"""
    with gzip.open(path, "rb") as f:
        blob = f.read()
    neuron_count, edge_count = struct.unpack_from("<II", blob, 0)
    meta_off = 8 + edge_count * 12
    # 元数据为 3 字节记录（uint8 region + uint16 group LE），需按 stride=3 抽取
    region = list(blob[meta_off:meta_off + neuron_count * 3:3])
    lo = blob[meta_off + 1:meta_off + neuron_count * 3:3]
    hi = blob[meta_off + 2:meta_off + neuron_count * 3:3]
    group = [lo[i] | (hi[i] << 8) for i in range(neuron_count)]
    # 权重通道扫描（'<8xf' = 每条 12 字节记录跳过 pre/post 读 weight），仅用于 stderr 调参信息
    max_abs = 0.0
    sample = []
    step = max(1, edge_count // 20000)
    for e, (w,) in enumerate(struct.iter_unpack("<8xf", blob[8:8 + edge_count * 12])):
        aw = abs(w)
        if aw > max_abs:
            max_abs = aw
        if e % step == 0:
            sample.append(aw)
    sample.sort()
    pct = lambda p: sample[min(len(sample) - 1, int(len(sample) * p))]
    print(f"[weights] 全量扫描: max|w|={max_abs:.1f} | 采样 {len(sample)} 条: "
          f"p50={pct(0.5):.2f} p90={pct(0.9):.2f} p99={pct(0.99):.2f}", file=sys.stderr)
    return neuron_count, edge_count, region, group


def read_root_ids(path: Path) -> list[str]:
    ids = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ids.append(row["root_id"])
    return ids


def read_coordinates(path: Path) -> dict[str, tuple[float, float, float]]:
    coords = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pos = row["position"].strip().strip("[]").split()
            if len(pos) != 3:
                continue
            coords[row["root_id"]] = (float(pos[0]), float(pos[1]), float(pos[2]))
    return coords


def main() -> None:
    neuron_count, edge_count, region, group = read_connectome_meta(VENDOR_DATA / "connectome.bin.gz")
    print(f"神经元 {neuron_count}，边 {edge_count}", file=sys.stderr)

    root_ids = read_root_ids(VENDOR_DATA / "neurons.csv.gz")
    assert len(root_ids) == neuron_count, "neurons.csv.gz 行数与二进制头不一致"
    coords = read_coordinates(VENDOR_DATA / "coordinates.csv.gz")
    print(f"坐标覆盖 {len(coords)}/{neuron_count}", file=sys.stderr)

    # 组排序：稳定排序（组内保持原始索引升序），与 sim-core buildGroupStructures 等价
    order = sorted(range(neuron_count), key=lambda i: group[i])
    orig2sorted = [0] * neuron_count
    for s, o in enumerate(order):
        orig2sorted[o] = s

    def group_orig_indices(gid: int) -> list[int]:
        return [i for i in range(neuron_count) if group[i] == gid]

    def to_sorted(orig_list: list[int]) -> list[int]:
        return sorted(orig2sorted[o] for o in orig_list)

    def split_by_x(orig_list: list[int]):
        """按胞体 x 坐标中位数切两半；覆盖率不足或全无坐标则按排序索引奇偶切分。"""
        with_coord = [(o, coords[root_ids[o]][0]) for o in orig_list if root_ids[o] in coords]
        coverage = len(with_coord) / max(1, len(orig_list))
        if coverage < COORD_MIN_COVERAGE or not with_coord:
            srt = to_sorted(orig_list)
            left = srt[0::2]
            right = srt[1::2]
            return left, right, True, coverage
        xs = sorted(x for _, x in with_coord)
        median = xs[len(xs) // 2]
        # 约定：x >= 中位数的一侧记为"左"（FAFB x 轴左右归属为近似，见 README 诚实声明）
        left = [o for o, x in with_coord if x >= median]
        right = [o for o, x in with_coord if x < median]
        # 无坐标的神经元按奇偶补进两池，避免浪费
        rest = [o for o in orig_list if root_ids[o] not in coords]
        left += rest[0::2]
        right += rest[1::2]
        return to_sorted(left), to_sorted(right), False, coverage

    rng = random.Random(RANDOM_SEED)
    pools: dict = {}
    meta: dict = {}

    def register(name: str, gid: int, sorted_idx: list[int], note: str = ""):
        total = sum(1 for g in group if g == gid)
        pools[name] = sorted_idx
        meta[name] = {
            "group_id": gid,
            "group_name": GROUP_NAMES[gid],
            "original_count": total,
            "pool_size": len(sorted_idx),
        }
        if note:
            meta[name]["note"] = note

    GROUP_NAMES = {
        0: "VIS_R1R6", 6: "OLF_ORN_FOOD", 7: "OLF_ORN_DANGER", 10: "MECH_BRISTLE",
        29: "SEZ_FEED", 32: "GUS_GRN_SWEET", 35: "GNG_DESC", 56: "MN_PROBOSCIS",
    }

    # 嗅觉食物池：组 6 按 x 中位数分左/右触角
    g6 = group_orig_indices(6)
    left, right, fb, cov = split_by_x(g6)
    register("olf_food_left", 6, left)
    register("olf_food_right", 6, right)
    meta["olf_food_left"]["fallback"] = fb
    meta["olf_food_right"]["fallback"] = fb
    meta["olf_food_left"]["coord_coverage"] = round(cov, 4)
    meta["olf_food_right"]["coord_coverage"] = round(cov, 4)
    meta["olf_food_left"]["note"] = "x >= median side labelled LEFT antenna pool (FAFB x-axis, approximate)"
    meta["olf_food_right"]["note"] = "x < median side labelled RIGHT antenna pool"

    register("olf_danger", 7, to_sorted(group_orig_indices(7)))
    register("gus_sweet", 32, to_sorted(group_orig_indices(32)))
    register("mech_bristle", 10, to_sorted(group_orig_indices(10)))

    # 视觉池降采样
    g0 = to_sorted(group_orig_indices(0))
    vis = sorted(rng.sample(g0, min(VIS_R1R6_SAMPLE, len(g0))))
    register("vis_r1r6", 0, vis, note=f"random downsample from {len(g0)} (seed {RANDOM_SEED})")

    # 下行神经元读出池：组 35 按 x 中位数分左/右
    g35 = group_orig_indices(35)
    dl, dr, fb35, cov35 = split_by_x(g35)
    register("desc_left", 35, dl)
    register("desc_right", 35, dr)
    meta["desc_left"]["fallback"] = fb35
    meta["desc_right"]["fallback"] = fb35
    meta["desc_left"]["coord_coverage"] = round(cov35, 4)
    meta["desc_right"]["coord_coverage"] = round(cov35, 4)

    # 进食读出池：SEZ_FEED(29) + MN_PROBOSCIS(56)
    feed = to_sorted(group_orig_indices(29) + group_orig_indices(56))
    pools["feed_readout"] = feed
    meta["feed_readout"] = {
        "group_id": [29, 56],
        "group_name": "SEZ_FEED+MN_PROBOSCIS",
        "original_count": sum(1 for g in group if g in (29, 56)),
        "pool_size": len(feed),
    }

    out = {
        "version": 1,
        "index_space": "group_sorted",
        "neuron_count": neuron_count,
        "source": "FlyWire FAFB v783 (binary packaging by snedea/flybrain, MIT)",
        "pools": pools,
        "meta": meta,
    }
    GAME_DATA.mkdir(parents=True, exist_ok=True)
    out_path = GAME_DATA / "pools.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"写出 {out_path} ({out_path.stat().st_size/1024:.0f} KB)", file=sys.stderr)
    for name, m in meta.items():
        print(f"  {name}: {m['pool_size']}/{m['original_count']}"
              + (f" fallback={m['fallback']}" if "fallback" in m else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
