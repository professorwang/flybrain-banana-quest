# 第三方声明（Third-Party Notices）

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
