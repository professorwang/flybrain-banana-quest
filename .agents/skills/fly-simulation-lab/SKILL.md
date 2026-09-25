---
name: fly-simulation-lab
description: 帮用户搭建与运行果蝇脑或身体仿真——全脑 LIF 动力学模型（Shiu/Eon fly-brain）、具身身体仿真（FlyGym/NeuroMechFly、flybody）、视觉模型（flyvis），含环境准备、安装命令、运行入口、算力需求与验证方法。
whenToUse: 用户想在本机/Colab/服务器上运行果蝇全脑模型、多后端脉冲网络基准、MuJoCo 果蝇身体仿真或连接组约束视觉模型时使用；查连接组数据用 fly-connectome-query，问事件与概念用 efly-kb。
---

# fly-simulation-lab：果蝇仿真搭建与运行

先读工具栈 `${KIMI_SKILL_DIR}/../../knowledge/05-开源工具与仿真栈.md` 与动手教程 `${KIMI_SKILL_DIR}/../../knowledge/06-动手教程.md`（任务 3），再指导用户。

## 三条路径总览

| 路径 | 工具 | 算什么 | 算力 |
|---|---|---|---|
| ① 连接组查询（仿真的数据准备） | CAVEclient / neuprint-python | 静态连接数据 | 无 GPU；走 fly-connectome-query 技能 |
| ② 全脑动力学（"脑"） | philshiu/Drosophila_brain_model 或 eonsystemspbc/fly-brain | 127k–139k 神经元 LIF 脉冲网络 | 基础版 **CPU 即可**；GPU 后端需 Linux + NVIDIA + CUDA 12.x |
| ③ 具身行为（"身体"） | FlyGym/NeuroMechFly v2 或 flybody + MuJoCo | 87 关节生物力学身体、行走/梳理/视觉嗅觉 | 基础仿真 **CPU 即可**；MJWarp GPU 加速需 NVIDIA；flybody 的 RL 训练需 GPU |

> **关键事实（必须告知用户）**：Eon 2026 年 3 月演示的完整具身闭环（脑→下行神经元→身体控制器的集成代码）**未开源**。本地复现只能用公开组件分别拼：开源脑模型（路径②）+ 开源身体（路径③）；Eon 宣称的具身行为指标无同行评议。社区复现（未逐步核实）：erojasoficial-byte/fly-brain、a3xrfgb/synthetic-life-form 分步指南。

## 路径②：全脑动力学模型

### 2a. Shiu 官方模型（最易上手，推荐入门）

- 仓库：https://github.com/philshiu/Drosophila_brain_model （307★，MIT；论文定格代码，非持续维护）
- 环境准备：conda（Mac/Windows/Linux 均可），**不需要 GPU**
- 安装与运行：

```bash
conda env create -f environment.yml    # 官方称约 10 分钟
```

- 零安装替代：README 顶部 "Open in Colab" 徽章。
- 运行入口：仓库内 `example.ipynb`——演示 Poisson 激活一组神经元（模拟光遗传）与连接置零（silencing）；输出全体神经元 spike times 与发放率。
- 默认数据 FlyWire v630；README 给出改 config 换 v783 的片段。
- 验证方法：复现 Shiu et al. 2024（Nature 634:210–219）的预测——如激活味觉投射神经元后观察 MN9（喙伸展）通路活动；论文口径为 164 项预测约 91% 与实验一致。

### 2b. Eon fly-brain（多后端 + GPU 基准）

- 仓库：https://github.com/eonsystemspbc/fly-brain （803★，GPL-2.0；数据 FlyWire v783 随仓库分发，138,639 神经元精简打包）
- 环境准备：conda；CPU 后端跨平台，GPU 后端需 **Linux（或 WSL2）+ NVIDIA GPU + CUDA 12.x**（官方测试 RTX 4070；仓库提供 `scripts/setup_WSL_CUDA.sh`）
- 安装与最小运行：

```bash
conda env create -f environment.yml && conda activate brain-fly
python main.py --brian2-cpu --t_run 1 --n_run 1 --no_log_file   # 1 秒仿真、单试次、仅 CPU
```

- 6 个后端：Brian2（CPU，ground truth）、Brian2CUDA、PyTorch、NEST GPU、GeNN、Brian2GeNN；自带跨后端 spike 一致性比较（Jaccard overlap、发放率相关）与 5 轮基准套件——**验证方法即跑跨后端一致性**。

## 路径③：具身身体仿真

### 3a. FlyGym / NeuroMechFly v2（Eon 演示同款身体）

- 仓库：https://github.com/NeLy-EPFL/flygym （350★，Apache-2.0；87 关节 micro-CT 身体，MuJoCo 物理）
- 环境准备：Python + pip；Linux/macOS/Windows 均可；基础仿真不需要 GPU；无显示器服务器设 `MUJOCO_GL=egl`
- 安装与运行入口：

```bash
pip install "flygym"
uv run python scripts/launch_interactive_viewer.py   # 交互式 viewer（需先克隆仓库）
```

- 教程入口：https://neuromechfly.org/
- **版本坑**：FlyGym 2.x（2026-03/04）API 完全重写、不向后兼容（CPU ~10×、GPU 经 MJWarp ~300× 提速）；旧教程对应已归档的 flygym-gymnasium。照抄教程前核对版本。
- 验证方法：跑通内置行走/梳理示例并与真实果蝇行为学描述对照（NeuroMechFly v2 论文：Wang-Chen et al., Nature Methods 2024, DOI 10.1038/s41592-024-02497-y）。

### 3b. flybody（DeepMind/Janelia 对照路线，RL 控制器）

- 仓库：https://github.com/TuragaLab/flybody （897★，Apache-2.0）
- 安装：`pip install git+https://github.com/TuragaLab/flybody.git`（conda 环境 Python 3.10 + cudatoolkit 11.8；无显示器设 `MUJOCO_GL=egl`）；核心仿真不需要 GPU，RL 训练需要
- 最小示例（README 原文）：

```python
import numpy as np, mediapy
from flybody.fly_envs import walk_imitation
env = walk_imitation()
for _ in range(100):
    timestep = env.step(np.random.normal(size=59))  # 59 维行走动作空间
mediapy.show_image(env.physics.render(camera_id=1))
```

## 附加：视觉模型 flyvis

- 仓库：https://github.com/TuragaLab/flyvis （173★，MIT；Lappalainen et al. 2024 官方 PyTorch 实现）
- 安装：`pip install flyvis`；7 个 Colab 教程 notebook + 预训练模型
- 算力：训练强烈建议 GPU；推理可在 Colab 免费 GPU 跑（纯 CPU 可行性未证实）

## 算力需求速查

| 任务 | 最低配置 | 备注 |
|---|---|---|
| Shiu 模型 / Eon fly-brain CPU 后端 | 普通 CPU + conda | 约 10 分钟装环境 |
| Eon fly-brain GPU 后端 | Linux/WSL2 + NVIDIA + CUDA 12.x | 官方测试 RTX 4070 |
| FlyGym 基础仿真 | CPU | MJWarp 加速才需 NVIDIA |
| flybody 核心仿真 | CPU | RL 训练需 GPU（cudatoolkit 11.8） |
| flyvis 推理 | Colab 免费 GPU | 训练建议更强 GPU |

## 回答纪律

- 命令与代码只用素材中出现过的；未核实的步骤明确标注"未核实，以官方文档/仓库 README 为准"。
- 不要把 Eon 演示视频的行为指标当作本地可复现目标——那是"Eon 宣称/自述"，具身闭环代码未公开。
- 建议用户验证仿真时区分**任务完成度**与**内部动力学对应性**（环吸引子、CPG 节律）——后者是 WBE 领域认可的验证标准（见 `${KIMI_SKILL_DIR}/../../knowledge/02-科学背景.md`）。
- 知识库整理于 2026-09-17；安装命令以各仓库当前 README 为最终依据。
