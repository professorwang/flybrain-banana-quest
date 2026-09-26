# Dynamics on an aggregated connectome in the browser: normalization, structural bias, and honest tuning lessons from Banana Quest

**Technical note, 2026-09-26. Code: `fruitfly/game/` @ commit `d92807b` (MIT). Data: FlyWire FAFB v783 (CC BY-NC-SA 4.0).**

## 中文摘要

本文记录浏览器游戏《电子果蝇·香蕉大作战》（Banana Quest）在真实连接组上跑动力学时实测到的三个坑，供连接组仿真社区参考。香蕉大作战用 FlyWire FAFB v783 全脑连接组（139,255 神经元 / 2,698,236 条聚合连接，封装自 snedea/flybrain）上的 LIF 脉冲网络驱动一只 2D 果蝇觅食，行为没有手工行为层。发现一：参考实现沿用的全局 max 权重归一化在本数据上传播失败——重尾突触计数分布（最大 2405、中位数 8）把典型权重压到阈值的约 1/2000，50 tick 后触角神经叶下游最大膜电压仅 0.688（阈值 1.0），中枢放电为零；改为 Shiu et al. 2024 式的按突触后神经元总输入归一化后，targetInput=3.0 全链路可通、4.0 全脑点燃。发现二：下行神经元池按胞体 x 切半后存在结构性偏置——任一侧触角刺激右池都更活跃（约 2100 对 1700 放电，有效差仅约 1.3%），必须用慢速 EMA 基线的偏差而非原始放电率做转向读出。发现三（方法论）：5 种子扫参的"冠军配置"在 10 个样本外种子上现形为运气，真正有效的改进来自关卡设计（香蕉刷新距离环带 150–250px，首吃中位 27.3s）而非读出参数注水。所有数字均可由文中命令复现。

## Abstract

Banana Quest is a zero-dependency browser game in which a leaky integrate-and-fire (LIF) network running on the real FlyWire FAFB v783 connectome (139,255 neurons, 2,698,236 aggregated connections) drives a 2D foraging fly, with no hand-crafted behavior layer. While building it we hit, measured, and worked around three problems that we believe are generic to the current wave of "run dynamics on a connectome" demos: (1) global-max weight normalization silently fails to propagate activity on aggregated connectomes with heavy-tailed synapse-count distributions; (2) coarse bilateral readout pools split by soma position carry a structural bias larger than the stimulus-driven signal; and (3) small-seed parameter sweeps of high-variance behavioral metrics systematically overfit. We report exact numbers, the fixes we adopted, and open questions for the connectome-simulation community.

## 1. Background

Banana Quest (电子果蝇·香蕉大作战) is an open-source, zero-build browser game. A virtual fly forages for bananas in a 2D arena. Olfactory input is injected as current into left/right pools of olfactory receptor neurons; spikes propagate through the connectome to descending neurons (GNG_DESC), whose pooled left/right firing-rate difference steers the fly, and whose total rate, scaled by a hunger variable, sets its speed. Feeding is gated by gustatory stimulation driving a SEZ_FEED + proboscis motor-neuron readout. There is deliberately no hand-tuned behavior layer: every turn, stop, and bite is conditioned on activity that actually traversed the 139k-neuron network.

The connectome ships as a compact binary (12.4 MB gzipped) packaged by the community project snedea/flybrain (MIT): FAFB v783 edges aggregated per neuron pair with signed weights (synapse counts signed by predicted transmitter class, GABA negative), plus a coarse 63-group functional annotation. Their reference simulator runs the full network in a Web Worker at ~10 ticks/s using a neuropil-gated dormant-group optimization; our simulation core (`src/sim-core.js`) is adapted from it and runs unchanged in both the browser worker and Node.js for testing.

Why this note: the 2026 "flyslop" wave produced dozens of demos that drop a connectome into a spiking or rate model and tune weights until something moves. Almost none document what broke along the way. These pitfalls cost us real time, are easy to miss, and — as far as we can tell — are not written down anywhere. We write in the spirit of the awesome-fly disclaimer: "a moving fly… does not by itself demonstrate biological fidelity or learned behavior."

## 2. Finding 1 — Global-max normalization does not propagate on aggregated connectomes

### 2.1 Measurement

The reference implementation normalizes edge weights globally: `w ← w / max|w| × 0.15`. On this aggregated dataset the raw synapse-count weights are extremely heavy-tailed. A full scan of all 2,698,236 edges gives max|w| = 2405.0, while a ~20k-edge sample gives median 8.0, p90 = 23.0, p99 = 83.0. Global-max normalization therefore maps the *median* edge to ≈ 0.15 × 8/2405 ≈ 5×10⁻⁴ — roughly 1/2000 of the firing threshold (1.0). Propagation requires near-synchronous input budgets that biology-scale fan-in cannot deliver.

Empirically, driving the 926-neuron left food-odor ORN pool at sustained intensity 0.5 (firing every ~5 ticks) for 50 ticks produced 9,262 spikes, **all in sensory groups; central-brain spikes: 0**. The strongest single postsynaptic target of the pool receives a total signed weight of only 0.2825 spread over 372 presynaptic ORNs (largest single synapse 0.0036). The maximum membrane voltage reached in the downstream OLF_PN group climbed 0.299 → 0.478 → 0.585 → 0.647 → **0.688** over ticks 10–50 and asymptotes below threshold. Signal dies in the antennal lobe.

### 2.2 Per-neuron normalization sweep

We replaced global scaling with Shiu et al. (2024)-style normalization — each postsynaptic neuron's total incoming |w| is scaled to a constant `targetInput` — and swept it (100-tick probes driving the same ORN pool):

| targetInput | result (100 ticks unless noted) |
|---|---|
| 1.0 | OLF_PN 287, OLF_LN 152, MB_KC 9, LH_APP 6, GNG_DESC 0 spikes |
| 2.0 | MB_KC 15,840, LH_APP 1,668, GENERIC_CENTRAL 4,602; GNG_DESC 0 (only 10 in 200 ticks at I=1.0) |
| 3.0 | GNG_DESC 3,810 in 200 ticks at I=1.0; no runaway over 500 ticks of maximal bilateral input (1,852–2,508 spikes/tick) |
| 4.0 | whole-brain ignition: GENERIC_CENTRAL 154,116 and VIS_ME 109,917 spikes per 100 ticks — the visual medulla fires massively with zero visual input |

We ship `targetInput = 3.0` as default and keep `normalization: 'global-max'` as a switchable reference behavior. With it, the Node smoke test (0.5 intensity, 50 ticks) yields 47,106 total spikes of which 35,159 are in central regions, at ~1.5 ms/tick.

### 2.3 Discussion

Aggregation is the culprit multiplier: collapsing all synaptic contacts between a neuron pair into one scalar produces a few huge weights (a 2405-contact edge) that set the global scale for everyone else, and a threshold model then divides the world into "edges that matter" and "edges that don't" with nothing in between. Per-neuron input normalization is not a cosmetic choice on such data — it is the difference between a network that transmits and one that doesn't, and the viable window is narrow (3.0 works, 4.0 is epilepsy). Any demo that "just runs dynamics" on an aggregated connectome should publish its normalization and a propagation test; a silent network is the default outcome, not a bug in your stimulus.

## 3. Finding 2 — Structural bias in coarse descending readouts

### 3.1 Measurement

Our steering readout splits GNG_DESC (3,581 neurons) into left/right pools by soma x-coordinate median (1,791 / 1,790 neurons). Stimulating either antennal pool alone (I=1.0, 200 ticks, targetInput 3.0) gives:

| stimulus | desc_left | desc_right | L/(L+R) |
|---|---|---|---|
| left antenna pool | 1,704 | 2,106 | 0.447 |
| right antenna pool | 1,633 | 2,133 | 0.434 |

The right pool fires more under **either** unilateral stimulus (bias ≈ +24% over the left pool), while the stimulus-dependent contrast between the two rows is only ~1.3%. First descending spikes appear 9 ticks (~0.9 s at 10 Hz) after stimulus onset. Feeding the raw rates into a steering law `turn = k·(R−L)/(R+L+ε)` would make the fly veer right forever regardless of where the banana is.

### 3.2 Baseline-deviation fix

We steer on the deviation from each pool's own slow baseline: `turn = k·(R̂−L̂)/(R̂+L̂+ε)` with `R̂ = max(0, R − EMA_τ(R))`, τ = 5 s. The EMA high-passes away the static bias and slow drift; the residual tracks the *current* gradient. Notably, a longer baseline (τ = 20–40 s) performs worse in behavioral sweeps (eat rates fall to 40–80% in 7 of 8 swept configurations, and at τ = 40 s path tortuosity rises to ~17–23): persistent wrong-sign deviations get "locked in" by the long memory, whereas the 5 s high-pass keeps the loop responsive.

### 3.3 Discussion

The bias is plausibly real structure, not a bug in our pools: the fly's olfactory pathway is largely bilateral, our x-median split is anatomically naive, and the dataset itself is a single individual whose two hemispheres may differ in proofreading completeness and annotation coverage. Schlegel et al. (2024) showed that more than half of all connection edges fail to replicate between FlyWire and hemibrain, so fine-grained lateral balance in a single specimen should not be trusted beyond a few percent anyway; Stürner et al. (2025) provide the comparative anatomy of descending/ascending neurons needed to do this properly. Practical rule for demo builders: **calibrate readout pools by baseline subtraction, and report the bias** — if your bilateral pools respond equally to both sides, your "steering" is cosmetic.

## 4. Finding 3 — Seed overfitting: a tuning-methodology lesson

### 4.1 The sweep winner that wasn't

Because steering is weak and noise-dominated, time-to-first-banana is a high-variance metric (in our runs, 12–166 s across seeds for identical parameters). We swept game-layer readout constants (`turnGain × smellSigma × baseSpeed`, then `turnGain × emaTau × baseSpeed`; 12 configs × 5 LCG-seeded runs × 180 simulated seconds each, brain reset between episodes, full tables in `game/README.md`). Two robust qualitative findings: raising `turnGain` monotonically *hurts* (it amplifies Poisson noise; path tortuosity climbs to ~18), and enlarging `emaTau` hurts (Section 3.2). The apparent champion, `turnGain = 1.8`, scored 100% eat rate, 26.4 s median, 3.00 mean score across the 5 sweep seeds.

On 10 fresh out-of-sample seeds it collapsed: 8/10 ate, median 57.7 s, mean 73.7 s, mean score 1.30 — **worse than the status-quo default on the same 10 seeds** (10/10, 49.6 s median, 2.70 score). The 5-seed "win" was seed luck.

### 4.2 What actually helped: level design

One control experiment is worth reporting as a negative result: capping banana spawn distance at 350 px changed *nothing at all* (identical metrics), because the fly spawns at the arena center of a 560×560 px arena where the farthest reachable point is only ≈362 px away — the constraint was geometrically vacuous. Capping spawns to a 150–250 px ring, however, moved the median time-to-first-banana from 49.6 s to **27.3 s** (10/10 eaten, tortuosity 8.47 — still clearly wandering search rather than a ≈1 straight-line beeline). A "fast search" variant (higher speed gain / max speed) that rewrote the rate→speed readout mapping improved score in one combination but degraded out-of-sample medians and was rejected.

### 4.3 Honest-tuning principle

The final shipped defaults change *only* the level-design constant (`bananaMaxDist = 250`). Every constant in the sensory→brain→readout mapping is unchanged, so the demo's core claim — "the brain's readout decides" — carries no hidden tuning water. The methodological lesson generalizes beyond games: **behavioral metrics with high stochastic variance must be validated out-of-sample; a small-seed sweep does not estimate the parameter effect, it estimates the seed set.** We kept both tables in the repo README precisely so the failure is auditable.

## 5. Limitations and open questions

Limitations. Point LIF neurons without conductances, delays, neuromodulation, or plasticity; no gap junctions; transmitter signs from Eckstein et al. (2024) predictions (87% per-synapse / 94% per-neuron / 91% per-type accuracy); a single female individual (FAFB); no ventral nerve cord — locomotion here is a kinematic rendering of descending firing rates, whereas real walking is VNC-driven; game-layer kinematics (turn-and-slow, wall bounce, spawn ring) are acknowledged level design. None of this claims biological fidelity, let alone "uploading".

Open questions we would love the community to pick up (they dovetail with ongoing flybench-style validation efforts):

1. Does global-max normalization failure replicate on BANC and MaleCNS? Both have different synapse-count distributions, different proofreading completeness, and MaleCNS is CC BY 4.0, so the experiment is a one-line dataset swap with tooling such as connectome_interpreter.
2. Is the rightward GNG_DESC response bias a dataset-general property (proofreading asymmetry, annotation gaps) or a real lateralized circuit motif? Cross-checking against hemibrain/MaleCNS descending populations would settle it.
3. What is the minimal readout (which named DN types, e.g. the turn/halt DNs characterized in the literature) that restores steering contrast without baseline subtraction?

## 6. Reproducibility

All numbers in this note were produced on this repository at commit `d92807b` (Node v24, Python 3.13, Windows; runs are CPU-only and complete in minutes):

| number(s) | command |
|---|---|
| 139,255 neurons / 2,698,236 edges; propagation 47,106 spikes / 35,159 central; ms/tick | `node game/test/sim.test.mjs` |
| weight distribution (max 2405, median 8, p90 23, p99 83); pool sizes | `python game/tools/prepare_pools.py` |
| normalization failure baseline (V=0.688, 0 central spikes) | `node game/test/sim.test.mjs` with `normalization: 'global-max'` in `src/sim-core.js` (`LIFSim.fromBuffer` opts) |
| targetInput sweep, bias table, latency | inline probes against `src/sim-core.js` (same code path as the smoke test; see note history) |
| closed-loop validation (first eat 29.6 s, tortuosity 5.34, score 2/120 s) | `node game/tools/headless_run.mjs 120` |
| sweep round 1 (turnGain × smellSigma × baseSpeed) | `node game/tools/tune_sweep.mjs` |
| sweep round 2 (turnGain × emaTau × baseSpeed) | `node game/tools/tune_sweep.mjs '{"turnGain":[1.8,2.6],"emaTau":[5,20,40],"baseSpeed":[6,12]}'` |
| out-of-sample & level-design comparisons | `runEpisode()` API in `game/tools/harness.mjs` (seeds 101–110) |

Seeded runs use an injectable LCG replacing `Math.random`; episodes call `sim.reset()` between runs so one process reuses a single parsed brain. Headless runs are not real-time throttled: 180 simulated seconds complete in a few wall-clock seconds.

## References

- Bates, A. S., Phelps, J. S., et al. (2026). Distributed control circuits across a brain-and-cord connectome. *Nature*. https://doi.org/10.1038/s41586-026-10735-w
- brandoncho369/flybench (2026). Behavioural benchmark for whole-brain fruit fly connectome simulations: pre-registered, cited behavioural tasks on FlyWire v783 and MaleCNS with shuffled-wiring controls and a reference LIF implementation. https://github.com/brandoncho369/flybench (MIT)
- Beiran, M. & Litwin-Kumar, A. (2025). *Nature Neuroscience* 28: 2561–2574（连接组只部分约束动力学）. Code: https://github.com/emebeiran/connconstr ; data: https://zenodo.org/records/16618353
- Berg, S., Beckett, I., et al. (2026). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system (MaleCNS). *Cell*. doi:10.1016/j.cell.2026.08.015 ; preprint: https://www.biorxiv.org/content/10.1101/2025.10.09.680999v1
- cobanov/awesome-fly (2026). Community index of fly-brain demos, with fidelity disclaimers. https://github.com/cobanov/awesome-fly
- Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. (2024). Neuronal wiring diagram of an adult brain. *Nature* 634: 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. *Cell* 187: 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Schlegel, P., Yin, Y., Bates, A. S., et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. *Nature* 634: 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Shiu, P. K., Sterne, G. R., Spiller, N., et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. *Nature* 634: 210–219. https://doi.org/10.1038/s41586-024-07763-9
- snedea/flybrain (2026). Browser-based LIF simulation of the FlyWire connectome (data packaging & reference simulator). https://github.com/snedea/flybrain
- Stürner, T., et al. (2025). *Nature* 643: 158–172（下行/上行神经元的比较连接组学：FlyWire + MANC + FANC）. https://doi.org/10.1038/s41586-025-08925-z
- Wang-Chen, S., Stimpfling, A., Lam, K., et al. (2024). NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila. *Nature Methods* 21: 2353–2362. https://doi.org/10.1038/s41592-024-02497-y
- Zheng, Z., Lauritzen, J. S., Perlman, E., et al. (2018). A complete electron microscopy volume of the brain of adult Drosophila melanogaster. *Cell* 174: 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019

*Community context: this note was written against the backdrop of the 2026 "flyslop" demo wave (indexed at awesome-fly and Fly Brain Hub, https://fly-brain-hub.vercel.app/) and community validation efforts such as flybench.*
