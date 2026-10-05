<!--
DRAFT — not posted. Attach game/docs/img/fig1_controls.png to post 1. Post only after the repo is pushed
and v6.1 (or at least the Zenodo link) is live. Limits: Bluesky 300, X 280 — each post below is <= 280.
Tone: credit Shiu et al. up front; no "we discovered"; invite correction.
-->

## English thread (Bluesky / X)

**1/**
Browser fly-brain demos copy FlyWire data, but not always its sign convention. One package signs glutamate excitatory; Shiu et al. 2024 and the MaleCNS package use inhibitory. Flipping only that rule switches a whole-brain activity regime in both directions. Is it glutamate? 🧵 [Fig 1]

**2/**
Mass-matched controls say: on FlyWire, flipping other transmitter classes by the same synaptic mass suppresses it too, so not glutamate-specific. On MaleCNS, glutamate is special under one weight normalization and not under another. Dose-response is steep, with a threshold.

**3/**
Credit: Shiu et al. already tested glutamate-as-excitatory in their model (Supp. Table 11f). We add mass-matched controls, dose-response, weight-scheme dependence. Also: ~31% of neurons in the FlyWire package carry both signs (labels are per connection row).

**4/**
All model-internal: no claim about real fly glutamate. Every number regenerates from frozen scripts (MIT): github.com/professorwang/flybrain-banana-quest · note: doi.org/10.5281/zenodo.22998484. Prepared with AI assistance (Claude); I take responsibility. Corrections welcome.

## 中文短文（即刻 / 知乎想法）

浏览器里的果蝇脑仿真项目常常复制了 FlyWire 的连接数据，却没复制它的“兴奋/抑制符号约定”：某个包把谷氨酸当兴奋性，Shiu 等人（2024）和 MaleCNS 的包当抑制性。只翻转这一条规则，整个脑的活动状态就双向切换。

那是“谷氨酸”的特殊性吗？我们用质量匹配的随机对照检验：在 FlyWire 上，翻转同等突触质量的其他递质，效果一样——不是谷氨酸特有；在 MaleCNS 上，换一种权重归一化方式，“特有性”就消失了。

要老实说明：Shiu 等人在自己的模型里已经做过“谷氨酸改兴奋”的检验；我们补的是质量匹配对照、剂量-反应和权重方案依赖。所有结论都只限于模型内部，不涉及真实果蝇。代码与全部数字可复现：github.com/professorwang/flybrain-banana-quest。本文借助 AI 完成，作者审阅并负责。欢迎挑错。
