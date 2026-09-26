# 第三方声明（Third-Party Notices）

## 0. MaleCNS 连接组数据（CC BY 4.0）与 fly-brain-minecraft（MIT License）

`?dataset=malecns` 使用的 `game/data/connectome-malecns.bin.gz` 等三件套，
由 `game/tools/flyb_to_bin.py` 从 [blendi-remade/fly-brain-minecraft](https://github.com/blendi-remade/fly-brain-minecraft)
（MIT License）分发的 `malecns-v1.0.flyb.gz` 转换而来（FLYB v1 格式规范见其
PROVENANCE.md 第 4 节）。

底层数据为 neuPrint **male-cns:v1.0**，以 **Creative Commons Attribution 4.0
International (CC BY 4.0)** 发布（https://creativecommons.org/licenses/by/4.0/）。
按上游 PROVENANCE.md 第 7 节的署名文字：

> Derived from the male CNS connectome, neuPrint dataset male-cns:v1.0, by the
> FlyEM Project Team (HHMI Janelia Research Campus), the Drosophila Connectomics
> Group (University of Cambridge / MRC LMB) and Google Research; licensed CC BY 4.0.
> Modified: connections thresholded at >= 5 synapses, autapses removed, neurons
> re-indexed, neurotransmitter signs assigned, photoreceptors assigned to medulla
> columns.

建议引用：

- Berg S, Beckett IR, Costa M, Schlegel P, Januszewski M, et al. Sexual dimorphism
  in the complete Drosophila male central nervous system connectome. *Cell*
  189(18): 5504–5526.e15 (2026). https://doi.org/10.1016/j.cell.2026.08.015
- 项目页：https://male-cns.janelia.org/ ；neuPrint：https://neuprint.janelia.org/

本项目对数据的进一步修改：按 FLYB 规范解码后以 sim-core 格式重写二进制、
按自定义规则划分 26 个功能组与游戏接口池（`game/tools/flyb_to_bin.py` 有完整记录）。

## 1. snedea/flybrain（MIT License）

本项目的数据二进制封装格式、LIF 仿真算法与 Web Worker 架构参考并改编自社区项目
[snedea/flybrain](https://github.com/snedea/flybrain)。`game/data/connectome.bin.gz`
与 `game/data/neuron_meta.json` 由该项目的数据管线产出；`game/src/sim-core.js` 的
CSR 构建、neuropil-gated 组休眠与组重排算法改编自其 `js/sim-worker.js`。

MIT License

Copyright (c) [2017] [Seth Miller]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 2. FlyWire 连接组数据（CC BY-NC-SA 4.0）

连接组拓扑源自 FlyWire 全脑连接组（FAFB v783 版本），139,255 个神经元。FlyWire
数据以 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0)** 协议发布——**仅限非商业用途**，引用请注明出处，衍生作品须以
相同协议共享。许可证全文：https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

建议引用：

- Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. (2024). Neuronal wiring
  diagram of an adult brain. *Nature*, 634, 124–138.
  https://doi.org/10.1038/s41586-024-07558-y
- Schlegel, P., Yin, Y., Bates, A. S., et al. (2024). Whole-brain annotation and
  multi-connectome cell typing of Drosophila. *Nature*, 634, 139–152.
  https://doi.org/10.1038/s41586-024-07686-5
- FlyWire Consortium. https://flywire.ai/ 与 https://codex.flywire.ai/

动力学模型的科学参照：

- Shiu, P. K., Sterne, G. R., Engert, F., et al. (2024). A Drosophila
  computational brain model reveals sensorimotor processing. *Nature*.
  （按突触后神经元总输入归一化权重的 LIF 全脑模型）

## 3. 免责

本 demo 为科学传播与工程演示用途，不代表对果蝇意识的任何主张。
"一只会动的果蝇本身并不证明生物保真度"（参照 awesome-fly 免责声明精神）。
