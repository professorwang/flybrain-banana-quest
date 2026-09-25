---
name: fly-connectome-query
description: 帮用户查询果蝇连接组数据（FlyWire/Codex、neuPrint hemibrain/MANC/MaleCNS、Virtual Fly Brain 等），包括选平台、注册取 token、给出最小 Python/R 查询示例与排坑。
whenToUse: 用户想实际查询果蝇神经元、细胞类型、突触连接、上下游伙伴、脑区 ROI，或想用 CAVEclient/neuprint-python/natverse 等客户端访问连接组数据时使用；问概念背景用 efly-kb，跑动力学/具身仿真用 fly-simulation-lab。
---

# fly-connectome-query：果蝇连接组数据查询手册

先读平台手册 `${KIMI_SKILL_DIR}/../../knowledge/04-数据平台.md` 与动手教程 `${KIMI_SKILL_DIR}/../../knowledge/06-动手教程.md`（任务 1、2），再指导用户。

## 第一步：选平台（决策树）

| 用户需求 | 平台与数据集 | 访问方式 |
|---|---|---|
| 全脑最新、雌性成蝇（Eon 演示同款数据） | **FlyWire / Codex**，FAFB v783（139,255 神经元） | 网页 codex.flywire.ai；编程用 CAVEclient |
| 脑区级精确、成熟 ROI 体系 | **neuPrint hemibrain**（`hemibrain:v1.2.1`，~25,000 神经元） | 网页 + neuprint-python |
| 腹神经索 / 运动回路 | neuPrint **MANC**（雄性 VNC，`manc:v1.2.1`）；雌性用 **FANC**（CAVE 托管） | neuPrint / CAVEclient |
| 雄性全 CNS（脑+VNC 一体；**可商用** CC BY 4.0） | neuPrint **male-cns:v1.0**（166,691 神经元；务必用 v1.0 不用 v0.9） | neuPrint |
| 雌性全 CNS | Codex **BANC v888**（158,262 neurons） | Codex / CAVEclient |
| 跨数据集 ID 映射、把 EM 神经元映射到 GAL4 driver line | **Virtual Fly Brain**（vfb-connect / 网页） | 网页 + API |
| 基因/突变体/表达（非连接组） | **FlyBase** | 网页 + REST API |
| 零代码网页对比浏览 | **BrainCircuits.io** | 纯网页 |

## 第二步：注册与访问

- **FlyWire/Codex**：免费；Google 账户登录（无 Google 账户邮件 flywire@princeton.edu 申请）；编程走 CAVE，认证为全局 token，首次用 `client.auth.setup_token()`。
- **neuPrint**：免费、CC-BY；Google 账户登录后在账户页取 **auth token**。
- **VFB**：免费、无需登录即可浏览。
- 许可提醒：FlyWire 数据 CC BY-NC-SA 4.0（商用受限，条款以官网为准）；MaleCNS CC BY 4.0。

## 第三步：最小查询示例（仅用素材已核实代码）

**CAVEclient（FlyWire）**：

```bash
pip install caveclient
```

```python
from caveclient import CAVEclient
client = CAVEclient('flywire_fafb_production')   # 首次使用需 client.auth.setup_token()
client.materialize.get_versions()                # 列出可用快照版本（如 783）
```

> 注意：素材中 datastack 名出现 `flywire_fafb_production` 与 `flywire_fafb_public` 两种写法，一个不通就试另一个，以 CAVE 官方文档为准。

**neuprint-python（hemibrain / MaleCNS）**：

```bash
pip install neuprint-python
```

```python
from neuprint import Client, fetch_neurons, NeuronCriteria
client = Client('https://neuprint.janelia.org', dataset='hemibrain:v1.2.1', token='你的token')
neurons, roi = fetch_neurons(NeuronCriteria(type='DA1.*'))
```

**零代码替代**：Codex 网页 Search 支持结构化查询（如 `class == olfactory`）；neuPrint Explorer 内置 FindNeurons / Shortest Paths / FindSimilarNeurons。

**R 用户**：natverse 生态——`install.packages('natmanager'); natmanager::install('core')`，再按需装 fafbseg / neuprintr / hemibrainr / malecns（详见 `${KIMI_SKILL_DIR}/../../knowledge/05-开源工具与仿真栈.md` A 节）。

## 常见坑（主动提醒用户）

1. **FlyWire 数据不在 neuPrint**（走 CAVE/Codex），两套生态 ID 映射用 VFB 或 hemibrainr。
2. 神经元数是"数据集×版本"的属性：引用全脑规模用 FlyWire v783 的 **139,255**；版本间数字会变（预印本 127,978 → Nature 版 139,255）。
3. 数据集**不可跨个体相加**：MaleCNS（雄）与 FlyWire（雌）是不同个体；雄性视叶（MAOL）是 MaleCNS 同一个体的子集，重复计数是常见错误。
4. 大数据下载体积可观（FAFB 突触表约 4 GB），留好磁盘与流量。
5. Codex 的 "connections" 是经阈值过滤的神经元对连接，与论文"约 5000 万突触（synaptic contacts）"口径不同，引用时区分。
6. "Codon" 是误记，正确名称是 **Codex**（codex.flywire.ai）。

## 回答纪律

- 命令与代码只能给素材中出现过的；没把握的写法标注"未核实，以官方文档为准"。
- 关键信息附来源 URL（见 `${KIMI_SKILL_DIR}/../../knowledge/04-数据平台.md` 参考来源节）。
- 知识库整理于 2026-09-17，平台界面/版本可能已更新，必要时建议用户核对官方文档。
