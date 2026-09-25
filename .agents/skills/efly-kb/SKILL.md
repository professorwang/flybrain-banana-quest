---
name: efly-kb
description: 回答关于"电子果蝇"（Eon Systems 2026 年 3 月果蝇全脑仿真具身化事件）、果蝇连接组学与全脑仿真上传（WBE）的相关问题，基于本地中文知识库给出附来源、区分事实与公司宣称的回答。
whenToUse: 用户询问电子果蝇/赛博果蝇事件、Eon Systems、果蝇脑数字化/上传、连接组（connectome）科学背景、相关论文数据集、争议评价等问题时使用；涉及实际查数据或跑仿真时改用 fly-connectome-query 或 fly-simulation-lab。
---

# efly-kb：电子果蝇知识库问答

## 工作方式

1. **先读知识库再回答**。按下方对照表定位文档，用 Read 工具读取相关文件后再作答；不要凭记忆回答数字与日期。
2. 知识库根目录：`${KIMI_SKILL_DIR}/../../knowledge/`，项目总览在 `${KIMI_SKILL_DIR}/../../README.md`。

## 问题类型 → 文档对照表

| 问题类型 | 先读文档 |
|---|---|
| 一页概览、向新手解释 | `${KIMI_SKILL_DIR}/../../knowledge/00-导读.md` |
| 事件经过、时间线、Eon 公司与人物、媒体/学界反应、争议（"算不算上传"） | `${KIMI_SKILL_DIR}/../../knowledge/01-事件始末.md` |
| 科学背景：connectomics、WBE、从电镜到连接组的流程、线虫→果蝇→小鼠路线图、术语概念 | `${KIMI_SKILL_DIR}/../../knowledge/02-科学背景.md` |
| 论文与数据集（FlyWire、hemibrain、MANC、MaleCNS、BANC、Shiu/Lappalainen 模型、NeuroMechFly 等）：规模数字、DOI、对应关系 | `${KIMI_SKILL_DIR}/../../knowledge/03-核心论文与数据集.md` |
| 平台使用问题（FlyWire Codex、neuPrint、VFB、FlyBase、BrainCircuits 的网址/注册/许可） | `${KIMI_SKILL_DIR}/../../knowledge/04-数据平台.md` |
| 工具/代码仓库（安装、星数、维护状态、GPU 需求） | `${KIMI_SKILL_DIR}/../../knowledge/05-开源工具与仿真栈.md` |
| 手把手操作 | `${KIMI_SKILL_DIR}/../../knowledge/06-动手教程.md` |
| 中英术语对照 | `${KIMI_SKILL_DIR}/../../knowledge/07-术语表.md` |

跨类型问题可依次读多个文档；拿不准时先读 `${KIMI_SKILL_DIR}/../../knowledge/00-导读.md` 定位。

## 回答纪律（必须遵守）

1. **日期**：事件统一为 **2026 年 3 月**。若用户说"2025 年 3 月"，指出这是中文媒体转载笔误，并引用 `${KIMI_SKILL_DIR}/../../knowledge/01-事件始末.md` 第 0 节的勘误证据。
2. **数字口径**：神经元数用论文口径——FlyWire 全脑 **139,255（约 13.9 万，含视叶）、约 5000 万化学突触**；用户若写"12.5 万"，说明该数字源自 Shiu 论文摘要口径且被 VFB 勘误（见 `${KIMI_SKILL_DIR}/../../knowledge/03-核心论文与数据集.md` 第 0 节）。
3. **事实 vs 宣称**：Eon 的能力声明一律写成"Eon 宣称/自述"——尤其：具身"91%–95% 行为匹配"无同行评议、定义未公开（不要与 Shiu 论文"164 项预测 91% 一致"或 Eckstein 递质预测"细胞类型级 91%"混用）；具身闭环集成代码未开源；"2028 蜜蜂/2032 小鼠/2045-2050 人类路线图"与"3 亿美元 D 轮"均为**未证实**信息。
4. **保留"未证实"标注**：知识库中标注未证实/存疑的内容，转述时必须保留标注。
5. **附来源**：每条关键事实给出知识库中记录的来源 URL 与日期（各文档末尾有"参考来源"）。
6. **不编造**：知识库没有的信息直接说"知识库未收录/待补充"，绝不虚构 URL、DOI、数字或引语；需要更新信息时建议用户联网核实并告知知识库整理日期为 2026-09-17。
7. 正文用中文，技术名词保留英文（connectome、LIF、neuPrint 等）。

## 常见快答（细节仍以知识库文档为准）

- "电子果蝇是什么"→ 四组件闭环：Shiu et al. 2024 全脑 LIF 模型（基于 FlyWire 连接组）+ Lappalainen et al. 2024 视觉模型 + NeuroMechFly v2 身体（87 关节）+ MuJoCo 物理环境，脑-体每 15 ms 同步（`${KIMI_SKILL_DIR}/../../knowledge/00-导读.md`）。
- "是不是真的上传"→ 核心争议：批评者称"木偶效应"（行为来自身体预训练控制器）、无 VNC、无内部动力学验证；Eon 自称"第一次具身闭环"、"上传是程度问题"（`${KIMI_SKILL_DIR}/../../knowledge/01-事件始末.md` 第 5 节）。
- "能自己复现吗"→ 脑模型可（philshiu/Drosophila_brain_model 或 eonsystemspbc/fly-brain），完整具身闭环不可（代码未开源）；引导至 fly-simulation-lab 技能与 `${KIMI_SKILL_DIR}/../../knowledge/06-动手教程.md`。
