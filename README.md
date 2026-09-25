# 电子果蝇知识库（Digital Fruit Fly Knowledge Base）

> 来源：基于 2026-09-17 调研整理

这是一个关于"电子果蝇"——即**果蝇大脑数字化与全脑仿真上传（whole brain emulation, WBE）**——的中文知识库，配套 Kimi Code 技能库。

2026 年 3 月，美国初创公司 Eon Systems 宣称完成了"世界首个产生多种行为的全脑仿真具身化"：把一只果蝇的全脑连接组（connectome）放进计算机，驱动一个虚拟身体行走、觅食、进食、梳理。该演示经马斯克等人转发后刷屏，也引发了"这算不算真正的'上传'"的持久争论。本知识库整理事件始末、科学背景、核心论文、数据平台与开源工具，供快速查证与动手复现。

## 目录结构

```
fruitfly/
├── README.md                    ← 本文件（项目总览）
├── knowledge/                   ← 知识库正文
│   ├── 00-导读.md               ← 一页读懂"电子果蝇"
│   ├── 01-事件始末.md           ← 2026-03 至 2026-09 完整时间线、公司背景、各方反应与争议
│   ├── 02-科学背景.md           ← connectomics 与 whole brain emulation 领域背景
│   ├── 03-核心论文与数据集.md   ← FlyWire、hemibrain、MANC、MaleCNS、Shiu 模型等清单
│   ├── 04-数据平台.md           ← FlyWire Codex、neuPrint、Virtual Fly Brain、FlyBase 等平台手册
│   ├── 05-开源工具与仿真栈.md   ← CAVEclient、natverse、FlyGym、flyvis、Eon fly-brain 等
│   ├── 06-动手教程.md           ← 新手 step-by-step（查连接组、跑仿真）
│   └── 07-术语表.md             ← 中英对照术语表
└── .agents/skills/              ← Kimi Code 技能库
    ├── efly-kb/SKILL.md                 ← 回答电子果蝇相关问题
    ├── fly-connectome-query/SKILL.md    ← 帮用户查询果蝇连接组数据
    └── fly-simulation-lab/SKILL.md      ← 帮用户搭建/运行果蝇脑或身体仿真
```

## 三分钟速览

**电子果蝇是什么？**
Eon Systems 将四项公开成果拼成闭环：① Shiu et al. (2024, *Nature*) 基于 FlyWire 全脑连接组的 LIF（leaky integrate-and-fire）脉冲神经网络"大脑"（约 139,000 个神经元含视叶、约 5000 万突触）；② Lappalainen et al. (2024, *Nature*) 的连接组约束视觉模型；③ NeuroMechFly v2（EPFL）的解剖学精确虚拟身体（87 个关节）；④ MuJoCo 物理引擎。虚拟世界的感觉输入驱动脑模型，脑模型通过少数几个下行神经元（descending neurons）向身体发出高层运动指令，每 15 毫秒同步一次。

**为什么火？**
2026-03-07/08，Eon 联合创始人 Alex Wissner-Gross 与 CEO Michael Andregg 发布 43 秒演示视频并宣称"We've uploaded a fruit fly"（我们上传了一只果蝇），Andregg 称之为"上传动物的 MVP"。马斯克（"wow"一说见中文自媒体，未证实）、Bryan Johnson、Peter Diamandis 等在 X 上转发助推，中文媒体 3 月 9 日起集中报道，"数字永生""上传意识"话题引爆舆论。

**争议焦点是什么？**
批评者（The Verge 采访的多位神经科学家、LessWrong 长文、WBE 领域元老 Randal Koene）指出：行走与梳理的精细运动协调其实由身体里预训练的控制器完成，连接组只发出"前进/转弯"级别的高层指令；视觉系统被 Eon 自认是"装饰性的"；腹神经索（VNC，约 1.5 万神经元，真实果蝇的运动中枢）根本不在仿真中；演示无论文、无代码（具身闭环部分）、无独立验证。Eon 自己更克制的口径是：这不是第一次果蝇"上传"（第一次是 Shiu et al. 2023 年预印本的无身体模型），而是**第一次具身闭环**；"上传是程度问题而非二元问题"。

## 使用约定

- 事件时间统一为 **2026 年 3 月**（部分中文媒体误写"2025 年 3 月"，系转载笔误，见 `knowledge/01-事件始末.md` 勘误节）。
- 神经元数量统一用论文口径：**FlyWire 全脑连接组 139,255 个神经元（约 13.9 万，含视叶）、约 5000 万化学突触**；部分中文媒体误写为 12.5 万，见 `knowledge/03-核心论文与数据集.md` 口径说明。
- Eon 的能力声明一律标注"Eon 宣称/自述"；标注"未证实"的信息请勿当作事实引用。
- 每个文档末尾附"参考来源"列出所引 URL。

## 维护

- 整理日期：2026-09-17
- 后续值得跟进：Eon 的 fidelity framework（保真度框架）草案、MaleCNS/BANC 全 CNS 数据驱动的下一代仿真、Carboncopies 的 Brain Emulation Challenge 验证基准。

## 项目：香蕉大作战（game/）

本仓库内含一个可玩的浏览器 demo《电子果蝇·香蕉大作战》：由真实 FlyWire FAFB v783
连接组（139,255 神经元 / 2,698,236 突触）上的 LIF 脉冲网络驱动一只果蝇在 2D 沙盒中
靠嗅觉找香蕉——Eon 的具身闭环没有开源，这是一个浏览器里能跑的开源替代。零依赖、
零构建（原生 ES modules + Web Worker + Canvas 2D），行为无手工行为层，转向/进食/逃离
全部由 13.9 万神经元的脉冲传播门控。

```bash
cd game && python -m http.server 8000   # 打开 http://localhost:8000
node game/test/sim.test.mjs             # Node 烟雾测试
node game/tools/headless_run.mjs 120    # 无头闭环验证（应能吃到香蕉）
```

玩法、架构、科学诚实声明（哪些是真实连接组、哪些是简化与人工选取）见
[game/README.md](game/README.md)；数据与代码许可见
[game/THIRD_PARTY_NOTICES.md](game/THIRD_PARTY_NOTICES.md)。
