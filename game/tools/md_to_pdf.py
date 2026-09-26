#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""md_to_pdf.py —— 把 game/docs/TECH-NOTE.md 渲染为学术风格 PDF（stdlib + reportlab）。

用法：python game/tools/md_to_pdf.py game/docs/TECH-NOTE.md game/docs/TECH-NOTE.pdf

支持的 Markdown 子集（按该文件实际用到的语法）：
  #/##/### 标题、段落、管道表格（含对齐行）、``` 代码围栏、**粗体**、*斜体*、
  ~~删除线~~、行内 `code`、- 无序列表、1. 有序列表（保留编号原文）、
  [text](url) 链接（蓝色 text + 小号灰色 URL）、裸 http(s) URL（自动着蓝色、可断行）。
特殊字符处理：R̂/L̂ 的组合扬抑符渲染为上标 ^；上标 Unicode 字符（⁻⁴ 等）转 <super>。

字体：微软雅黑（msyh.ttc / msyhbd.ttc，拉丁与中文统一覆盖，TTFont 默认子集嵌入，
自包含）；代码 Consolas。若雅黑缺失则回退 simsun/simhei。
"""
from __future__ import annotations

import html
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle, XPreformatted)

FONTS_DIR = r"C:\Windows\Fonts"


# ---------------- 字体注册（.ttc 用 subfontIndex；逐级回退） ----------------

def register_fonts() -> tuple[str, str, str]:
    """返回 (正文族名, 粗体注册名, 等宽族名)。"""
    candidates = [
        ("MSYH", "msyh.ttc", "MSYHBD", "msyhbd.ttc"),
        ("SimSun", "simsun.ttc", "SimHei", "simhei.ttf"),
    ]
    body = bold = None
    for bname, bfile, bdname, bdfile in candidates:
        try:
            pdfmetrics.registerFont(TTFont(bname, os.path.join(FONTS_DIR, bfile), subfontIndex=0))
            pdfmetrics.registerFont(TTFont(bdname, os.path.join(FONTS_DIR, bdfile), subfontIndex=0))
            body, bold = bname, bdname
            break
        except Exception:
            continue
    if body is None:
        raise RuntimeError("未找到可用中文字体（msyh/simsun/simhei 均注册失败）")
    mono = "Consolas"
    try:
        pdfmetrics.registerFont(TTFont(mono, os.path.join(FONTS_DIR, "consola.ttf")))
        pdfmetrics.registerFont(TTFont("ConsolasBD", os.path.join(FONTS_DIR, "consolab.ttf")))
    except Exception:
        mono = "Courier"
        bold_mono = "Courier-Bold"
    else:
        bold_mono = "ConsolasBD"
    # <b>/<i> 标签映射：雅黑无斜体变体，斜体面回落到正体（不伪造倾斜）
    registerFontFamily(body, normal=body, bold=bold, italic=body, boldItalic=bold)
    registerFontFamily(mono, normal=mono, bold=bold_mono, italic=mono, boldItalic=bold_mono)
    print(f"字体：正文 {body}，粗体 {bold}，等宽 {mono}", file=sys.stderr)
    return body, bold, mono


# ---------------- 行内 Markdown → reportlab Paragraph XML ----------------

SUP_MAP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
TOKEN_RE = re.compile(
    r"(\*\*.+?\*\*|~~.+?~~|\*[^*\n]+?\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?://[^\s<>()]+)")


def _plain(seg: str) -> str:
    """转义普通文本，并处理组合扬抑符与上标 Unicode。"""
    s = html.escape(seg)
    s = s.replace("R̂", "R<super>^</super>").replace("L̂", "L<super>^</super>")
    s = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+",
               lambda m: "<super>" + m.group(0).translate(SUP_MAP) + "</super>", s)
    return s


def _breakable_url(url: str) -> str:
    """URL 转义输出。不在正文中插零宽空格——微软雅黑无 U+200B 字形会渲染成豆腐块；
    本文件全部 URL 短于栏宽，超长行由 ParagraphStyle.splitLongWords 兜底。"""
    return html.escape(url)


def inline(text: str, mono: str) -> str:
    out = []
    pos = 0
    for m in TOKEN_RE.finditer(text):
        out.append(_plain(text[pos:m.start()]))
        tok = m.group(0)
        if tok.startswith("**"):
            out.append("<b>%s</b>" % inline(tok[2:-2], mono))
        elif tok.startswith("~~"):
            out.append("<strike>%s</strike>" % _plain(tok[2:-2]))
        elif tok.startswith("*"):
            out.append("<i>%s</i>" % inline(tok[1:-1], mono))
        elif tok.startswith("`"):
            out.append('<font face="%s" backColor="#f0f0f0">%s</font>'
                       % (mono, html.escape(tok[1:-1])))
        elif tok.startswith("["):
            mm = re.match(r"\[([^\]]+)\]\(([^)\s]+)\)", tok)
            label, url = mm.group(1), mm.group(2)
            out.append('<font color="#1a5fb4">%s</font> <font size="7" color="#777777">(%s)</font>'
                       % (inline(label, mono), _breakable_url(url)))
        else:  # 裸 URL：蓝色、小半号、可断行
            out.append('<font color="#1a5fb4">%s</font>' % _breakable_url(tok))
        pos = m.end()
    out.append(_plain(text[pos:]))
    return "".join(out)


# ---------------- Markdown 块级解析 ----------------

class Block:
    def __init__(self, kind, **kw):
        self.kind = kind
        self.__dict__.update(kw)


def parse_blocks(lines: list[str]) -> list[Block]:
    blocks: list[Block] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        # 代码围栏
        if stripped.startswith("```"):
            i += 1
            code = []
            while i < n and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1  # 跳过收尾围栏
            blocks.append(Block("code", text="\n".join(code)))
            continue
        # 标题
        m = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if m:
            blocks.append(Block("heading", level=len(m.group(1)), text=m.group(2)))
            i += 1
            continue
        # 管道表格
        if stripped.startswith("|") and i + 1 < n and re.match(r"^\|[\s:\-|]+\|$", lines[i + 1].strip()):
            tbl = [stripped]
            i += 1
            while i < n and lines[i].strip().startswith("|"):
                tbl.append(lines[i].strip())
                i += 1
            blocks.append(Block("table", lines=tbl))
            continue
        # 列表项（无序 - 与有序 1.，均单行处理；文件内无嵌套）
        m = re.match(r"^(-|\d+\.)\s+(.*)$", stripped)
        if m:
            blocks.append(Block("item", marker=m.group(1), text=m.group(2)))
            i += 1
            continue
        # 普通段落：累积到空行
        para = [stripped]
        i += 1
        while i < n and lines[i].strip() and not re.match(r"^(#{1,3}\s|```|\||-|\d+\.)\s?", lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        blocks.append(Block("para", text=" ".join(para)))
    return blocks


def split_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


# ---------------- PDF 构建 ----------------

def build(md_path: str, pdf_path: str) -> dict:
    body, bold, mono = register_fonts()
    text = open(md_path, encoding="utf-8").read()
    lines = text.split("\n")
    blocks = parse_blocks(lines)

    # 标题区素材：第一个 H1 与第一个加粗版本行（从正文流中剔除避免重复）
    title = subtitle = None
    for idx, b in enumerate(blocks):
        if title is None and b.kind == "heading" and b.level == 1:
            title = b.text
            blocks[idx] = None
            continue
        if title and subtitle is None and b.kind == "para" and b.text.startswith("**Technical note"):
            subtitle = b.text
            blocks[idx] = None
            break
    blocks = [b for b in blocks if b is not None]

    ss = {
        "title": ParagraphStyle("title", fontName=bold, fontSize=15.5, leading=20,
                                spaceAfter=4, textColor=colors.HexColor("#1a1a2e")),
        "subtitle": ParagraphStyle("subtitle", fontName=body, fontSize=8.5, leading=12.5,
                                   textColor=colors.HexColor("#444455"), spaceAfter=2),
        "h2": ParagraphStyle("h2", fontName=bold, fontSize=12, leading=15,
                             spaceBefore=5.5, spaceAfter=2.8, keepWithNext=True,
                             textColor=colors.HexColor("#1a1a2e")),
        "h3": ParagraphStyle("h3", fontName=bold, fontSize=10, leading=13.5,
                             spaceBefore=7, spaceAfter=3.5, keepWithNext=True,
                             textColor=colors.HexColor("#2a2a3e")),
        "body": ParagraphStyle("body", fontName=body, fontSize=8.4, leading=12.1,
                               spaceAfter=3.2, alignment=TA_LEFT, splitLongWords=True),
        "item": ParagraphStyle("item", fontName=body, fontSize=8.4, leading=12.1,
                               spaceAfter=2.5, leftIndent=14, bulletIndent=2,
                               splitLongWords=True),
        "ref": ParagraphStyle("ref", fontName=body, fontSize=8.0, leading=10.5,
                              spaceAfter=1.5, leftIndent=16, firstLineIndent=-16,
                              splitLongWords=True),
        "cell": ParagraphStyle("cell", fontName=body, fontSize=8, leading=10.5,
                               splitLongWords=True),
        "cellb": ParagraphStyle("cellb", fontName=bold, fontSize=8, leading=10.5,
                                splitLongWords=True),
    }

    story = []
    # ---- 首页标题区 ----
    story.append(Paragraph(inline(title or "TECH-NOTE", mono), ss["title"]))
    if subtitle:
        story.append(Paragraph(inline(subtitle, mono), ss["subtitle"]))
    story.append(Paragraph(
        'Repository: <font color="#1a5fb4">https://github.com/professorwang/flybrain-banana-quest</font>'
        ' · Demo: <font color="#1a5fb4">https://professorwang.github.io/flybrain-banana-quest/</font>'
        '（?dataset=malecns 切换 MaleCNS）', ss["subtitle"]))
    rule = Table([[""]], colWidths=[17 * cm], rowHeights=[1])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
                              ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor("#1a1a2e"))]))
    story.append(rule)
    story.append(Spacer(1, 8))

    stats = {"headings": 0, "tables": 0, "code": 0, "links": 0, "paras": 0, "items": 0}
    in_refs = False

    for b in blocks:
        if b.kind == "heading":
            stats["headings"] += 1
            if b.level == 1:  # 后续 H1（本文件只有一个 H1，兜底）
                story.append(Paragraph(inline(b.text, mono), ss["title"]))
            elif b.level == 2:
                in_refs = b.text.strip() == "References"
                story.append(Paragraph(inline(b.text, mono), ss["h2"]))
            else:
                story.append(Paragraph(inline(b.text, mono), ss["h3"]))
        elif b.kind == "para":
            stats["paras"] += 1
            stats["links"] += len(re.findall(r"\[[^\]]+\]\([^)\s]+\)|https?://", b.text))
            story.append(Paragraph(inline(b.text, mono), ss["body"]))
        elif b.kind == "item":
            stats["items"] += 1
            stats["links"] += len(re.findall(r"\[[^\]]+\]\([^)\s]+\)|https?://", b.text))
            marker = "•" if b.marker == "-" else b.marker
            style = ss["ref"] if in_refs else ss["item"]
            story.append(Paragraph(inline(b.text, mono), style, bulletText=marker))
        elif b.kind == "code":
            stats["code"] += 1
            xp = XPreformatted(html.escape(b.text), ParagraphStyle(
                "code", fontName=mono, fontSize=7.6, leading=10))
            box = Table([[xp]], colWidths=[17 * cm])
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f5f5")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(box)
            story.append(Spacer(1, 3))
        elif b.kind == "table":
            stats["tables"] += 1
            header = split_row(b.lines[0])
            rows = [split_row(l) for l in b.lines[2:]]
            ncol = len(header)
            # 列宽按各列最长原始文本自适应（防止命令/URL 长列挤压）
            raw_rows = [header] + rows
            weights = []
            for c in range(ncol):
                longest = max((len(re.sub(r"[*_`~\[\]()#]", "", r[c])) for r in raw_rows if c < len(r)), default=8)
                weights.append(max(8, min(60, longest)))
            total = sum(weights)
            col_ws = [17 * cm * w / total for w in weights]
            data = [[Paragraph(inline(h, mono), ss["cellb"]) for h in header]]
            for r in rows:
                r = r + [""] * (ncol - len(r))
                data.append([Paragraph(inline(c, mono), ss["cell"]) for c in r])
            t = Table(data, colWidths=col_ws, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8edf3")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 1.8), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8),
            ]))
            story.append(t)
            story.append(Spacer(1, 3))

    # ---- 页脚 ----
    def footer(canv, doc):
        canv.saveState()
        canv.setFont(body, 7.5)
        canv.setFillColor(colors.HexColor("#777788"))
        canv.drawString(2.5 * cm, 1.35 * cm, "Banana Quest technical note v4.1 (2026-09-27)")
        canv.drawRightString(A4[0] - 2.5 * cm, 1.35 * cm, f"Page {doc.page}")
        canv.restoreState()

    doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                            leftMargin=2.5 * cm, rightMargin=2.5 * cm,
                            topMargin=2.5 * cm, bottomMargin=2.2 * cm,
                            title="Banana Quest technical note v4.1",
                            author="fruitfly/game")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return stats


def main() -> None:
    md = sys.argv[1] if len(sys.argv) > 1 else "game/docs/TECH-NOTE.md"
    pdf = sys.argv[2] if len(sys.argv) > 2 else md.rsplit(".", 1)[0] + ".pdf"
    stats = build(md, pdf)

    # ---- 读回验证：页数、大小、表格数对照 ----
    raw = open(pdf, "rb").read()
    pages = len(re.findall(rb"/Type\s*/Page(?!s)", raw))
    md_tables = sum(1 for l in open(md, encoding="utf-8")
                    if l.strip().startswith("|") and "---" in l)
    print(f"输出 {pdf}: {len(raw)/1024:.0f} KB, {pages} 页", file=sys.stderr)
    print(f"解析统计: 标题 {stats['headings']}, 段落 {stats['paras']}, 列表项 {stats['items']}, "
          f"表格 {stats['tables']}（md 源 {md_tables}）, 代码块 {stats['code']}, "
          f"链接命中 {stats['links']}", file=sys.stderr)
    assert pages >= 6, f"页数 {pages} < 6"
    assert stats["tables"] == md_tables, f"表格解析丢失：{stats['tables']} != {md_tables}"
    assert len(raw) > 10000, "PDF 文件过小，疑似生成失败"
    print("验证通过 ✔", file=sys.stderr)


if __name__ == "__main__":
    main()
