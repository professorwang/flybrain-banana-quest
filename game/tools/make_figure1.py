#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_figure1.py —— 论文图 1：符号干预的对照与剂量-反应（只读归档结果，不重跑仿真）。

输入（均为已归档的冻结脚本输出）：
  game/docs/results/controls_runs.csv   probe_controls.mjs 的逐次结果（E0b/E1/E1b/E2）
  game/docs/results/probe_linear.txt    probe_linear.mjs 的表（E3 扫描 + E3c 等质量检验）
输出：game/docs/img/fig1_controls.{pdf,png}

版面：2 行 × 2 列。列 = 数据集（FlyWire：+→− 抑制；MaleCNS：−→+ 点燃），行 = 权重方案
（上：postsynaptic L1 归一化 ti=4；下：每突触固定系数 synScale=0.01）。每格横轴 = 被翻转的
突触质量占"全部谷氨酸规则"的比例，纵轴 = 视叶组放电（200 tick，symlog，四格共用）。
配色：蓝 = 谷氨酸单位，橙 = 质量匹配的非谷氨酸对照，灰 = 包的默认赋号（未翻转）；
调色板用 dataviz 验证脚本检查过（蓝/橙/青 all-pairs 通过 CVD 与正常视觉阈值），
并配合不同标记形状与直接标注，不依赖颜色单独区分。

用法：python game/tools/make_figure1.py
"""
from __future__ import annotations

import csv
import re
import statistics as st
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "game" / "docs" / "results"
OUT = ROOT / "game" / "docs" / "img"

BLUE, ORANGE, GRAY = "#2a78d6", "#eb6834", "#52514e"
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e1e0dc"
DATASETS = ["flywire", "malecns"]
TITLES = {"flywire": "FlyWire (glutamate rows  + → −)", "malecns": "MaleCNS (glutamate neurons  − → +)"}
VIS = {"flywire": "VIS_ME", "malecns": "VIS_OL"}


def num(s: str) -> int:
    return int(s.replace(",", ""))


def load_l1():
    """返回 {dataset: dict}，键：std、full、e2[(mass, vis)...]、e1b_g/e1b_c[(mass, vis)...]、cmatch[(mass, vis)...]"""
    rows = list(csv.DictReader(open(RES / "controls_runs.csv", encoding="utf-8")))
    out = {d: defaultdict(list) for d in DATASETS}
    for r in rows:
        d = r["dataset"]
        if d not in out:
            continue
        exp, var = r["experiment"], r["variant"]
        if exp == "E0b" and r["ti"] == "4" and r["gating"] == "on":
            out[d]["std" if "标准" in var else "full"] = int(r["vis"])
        elif exp == "E2":
            out[d]["e2"].append((float(r["mass_ratio"]), int(r["vis"])))
        elif exp == "E1b" and var == "glut-equal-profile":
            out[d]["e1b_g"].append((float(r["mass_ratio"]), int(r["vis"]), float(r["frac"])))
        elif exp == "E1b" and var == "control-equal-profile":
            out[d]["e1b_c"].append((float(r["mass_ratio"]), int(r["vis"]), float(r["frac"])))
        elif exp == "E1" and var == "C-match" and r["ti"] == "4":
            out[d]["cmatch"].append((float(r["mass_ratio"]), int(r["vis"])))
    return out


def load_linear():
    """解析 probe_linear.txt：返回 {dataset: {std, full, c3: [(phi, gmass, cmass, (gmed,glo,ghi), (cmed,clo,chi))]}}"""
    txt = (RES / "probe_linear.txt").read_text(encoding="utf-8")
    out = {d: {"c3": []} for d in DATASETS}
    triple = re.compile(r"([\d,]+)\s*\[([\d,]+)–([\d,]+)\]")
    for line in txt.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 7 and cells[0] == "0.01":  # E3 扫描中 synScale=0.01 的行
            d = "flywire" if cells[1].startswith("FlyWire") else "malecns"
            out[d]["std" if "标准" in cells[1] else "full"] = num(cells[6])
        elif len(cells) == 8 and cells[0] in ("FlyWire", "MaleCNS") and re.fullmatch(r"[\d.]+", cells[1]):
            d = cells[0].lower()
            g, c = triple.match(cells[4]), triple.match(cells[5])
            out[d]["c3"].append((float(cells[1]), float(cells[2]), float(cells[3]),
                                 tuple(num(x) for x in g.groups()), tuple(num(x) for x in c.groups())))
    for d in DATASETS:
        assert "std" in out[d] and "full" in out[d] and out[d]["c3"], f"{d}: 解析 probe_linear.txt 失败"
    return out


def agg(points):
    """[(x, y, ...)] 按 x 近邻分组（相邻 x 差 <0.03 视为同一剂量），返回 [(x_med, y_med, y_lo, y_hi)]。"""
    pts = sorted(points)
    groups, cur = [], [pts[0]]
    for p in pts[1:]:
        if p[0] - cur[-1][0] < 0.03:
            cur.append(p)
        else:
            groups.append(cur)
            cur = [p]
    groups.append(cur)
    return [(st.median(q[0] for q in g), st.median(q[1] for q in g), min(q[1] for q in g), max(q[1] for q in g)) for g in groups]


def style(ax):
    ax.set_yscale("symlog", linthresh=10, linscale=0.5)
    ax.set_ylim(0, 4e6)
    ax.set_xlim(-0.04, 1.06)
    ax.set_yticks([0, 10, 1e2, 1e3, 1e4, 1e5, 1e6])
    ax.set_yticklabels(["0", "10", "10²", "10³", "10⁴", "10⁵", "10⁶"])
    ax.set_xticks([0, 0.25, 0.5, 0.75, 1.0])
    ax.grid(axis="y", color=GRID, lw=0.6)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(MUTED)
        ax.spines[s].set_linewidth(0.8)
    ax.tick_params(colors=MUTED, labelsize=7.5, length=3)


def errbar(ax, x, med, lo, hi, color, marker, z=3, size=6.5):
    ax.vlines(x, lo, hi, color=color, lw=1.2, zorder=z - 1)
    ax.plot([x], [med], marker=marker, color=color, ms=size, mfc=color, mec="#fcfcfb", mew=1.2, ls="none", zorder=z)


def main() -> None:
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 8, "axes.edgecolor": MUTED,
                         "text.color": INK, "pdf.fonttype": 42})
    l1, lin = load_l1(), load_linear()
    fig, axes = plt.subplots(2, 2, figsize=(7.3, 5.6), sharey=True, gridspec_kw={"height_ratios": [1.0, 0.72]})

    for ci, d in enumerate(DATASETS):
        # ------------- 上排：L1 -------------
        ax = axes[0][ci]
        style(ax)
        D = l1[d]
        e2 = agg(D["e2"])
        xs = [0.0] + [p[0] for p in e2] + [1.0]
        ys = [D["std"]] + [p[1] for p in e2] + [D["full"]]
        ax.plot(xs, ys, color=BLUE, lw=1.1, alpha=0.45, zorder=2)
        ax.scatter([p[0] for p in D["e2"]], [p[1] for p in D["e2"]], s=7, color=BLUE, alpha=0.30, lw=0, zorder=2)
        # 等质量配对（E1b）：同一剂量下谷氨酸子集 vs 对照
        for tag, color, marker in (("e1b_g", BLUE, "o"), ("e1b_c", ORANGE, "s")):
            by_phi = defaultdict(list)
            for m, v, phi in D[tag]:
                by_phi[phi].append((m, v))
            for phi, pts in by_phi.items():
                x = st.median(p[0] for p in pts)
                vs = [p[1] for p in pts]
                errbar(ax, x, st.median(vs), min(vs), max(vs), color, marker)
        # E1：全规则质量下的 C-match 对照
        if D["cmatch"]:
            vs = [v for _, v in D["cmatch"]]
            errbar(ax, st.median(m for m, _ in D["cmatch"]), st.median(vs), min(vs), max(vs), ORANGE, "s")
        ax.plot([1.0], [D["full"]], marker="o", color=BLUE, ms=6.5, mec="#fcfcfb", mew=1.2, ls="none", zorder=4)
        ax.plot([0.0], [D["std"]], marker="D", color=GRAY, ms=5.5, mec="#fcfcfb", mew=1.2, ls="none", zorder=4)
        ax.set_title(f"{'AB'[ci]}   {TITLES[d]}", loc="left", fontsize=8.6, fontweight="bold", color=INK, pad=15)
        ax.text(0.0, 1.015, f"L1 normalization (ti = 4); visual group = {VIS[d]}", transform=ax.transAxes,
                fontsize=7.5, color=MUTED, va="bottom")

        # ------------- 下排：每突触固定系数 -------------
        ax = axes[1][ci]
        style(ax)
        L = lin[d]
        gx, gy, cx, cy = [0.0], [L["std"]], [0.0], [L["std"]]
        for phi, gm, cm, (g, glo, ghi), (c, clo, chi) in sorted(L["c3"], key=lambda t: t[1]):
            errbar(ax, gm, g, glo, ghi, BLUE, "o")
            errbar(ax, cm, c, clo, chi, ORANGE, "s")
            gx.append(gm); gy.append(g); cx.append(cm); cy.append(c)
        gx.append(1.0); gy.append(L["full"])
        ax.plot(gx, gy, color=BLUE, lw=1.1, alpha=0.45, zorder=2)
        ax.plot(cx, cy, color=ORANGE, lw=1.1, alpha=0.45, ls=(0, (4, 2)), zorder=2)
        ax.plot([1.0], [L["full"]], marker="o", color=BLUE, ms=6.5, mec="#fcfcfb", mew=1.2, ls="none", zorder=4)
        ax.plot([0.0], [L["std"]], marker="D", color=GRAY, ms=5.5, mec="#fcfcfb", mew=1.2, ls="none", zorder=4)
        ax.set_title(f"{'CD'[ci]}   {TITLES[d].split(' (')[0]} — per-synapse weights", loc="left", fontsize=8.6,
                     fontweight="bold", color=INK, pad=15)
        ax.text(0.0, 1.015, f"fixed weight per synapse (0.01); visual group = {VIS[d]}", transform=ax.transAxes,
                fontsize=7.5, color=MUTED, va="bottom")
        ax.set_xlabel("fraction of glutamate-rule synaptic mass flipped", fontsize=8, color=MUTED)

        axes[0][ci].set_ylabel("visual-group spikes, 200 ticks" if ci == 0 else "", fontsize=8, color=MUTED)
        axes[1][ci].set_ylabel("visual-group spikes, 200 ticks" if ci == 0 else "", fontsize=8, color=MUTED)

    # 直接标注（避免颜色单独承载身份）
    ax = axes[0][1]
    ax.annotate("glutamate\nsubsets", xy=(0.89, 2.9e5), xytext=(0.3, 3e5), fontsize=7.5, color=BLUE,
                arrowprops=dict(arrowstyle="-", color=BLUE, lw=0.7))
    ax.annotate("matched\ncontrols", xy=(0.85, 80), xytext=(0.5, 6), fontsize=7.5, color=ORANGE,
                arrowprops=dict(arrowstyle="-", color=ORANGE, lw=0.7))

    handles = [
        Line2D([0], [0], color=BLUE, lw=1.1, alpha=0.5, marker="o", ms=3, label="glutamate units, random fraction (E2)"),
        Line2D([0], [0], color=BLUE, lw=0, marker="o", ms=6.5, label="glutamate units, equal-mass pair (E1b, E3c)"),
        Line2D([0], [0], color=ORANGE, lw=0, marker="s", ms=6.5, label="matched non-glutamate control"),
        Line2D([0], [0], color=GRAY, lw=0, marker="D", ms=5.5, label="package default (no flip)"),
    ]
    fig.legend(handles=handles, loc="lower center", ncol=2, frameon=False, fontsize=7.5, bbox_to_anchor=(0.5, -0.005))
    fig.tight_layout(rect=(0, 0.075, 1, 1), h_pad=1.6, w_pad=1.2)
    OUT.mkdir(parents=True, exist_ok=True)
    for ext in ("pdf", "png"):
        fig.savefig(OUT / f"fig1_controls.{ext}", dpi=300, facecolor="#fcfcfb")
    print(f"写出 {OUT / 'fig1_controls.pdf'} 与 .png")


if __name__ == "__main__":
    main()
