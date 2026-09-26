# Dynamics on aggregated connectomes in the browser: normalization, structural bias, and honest tuning lessons across two connectomes

**Technical note v3, 2026-09-26. Code: `fruitfly/game/` @ commit `73da541` + v3 documentation revisions (MIT). Data: FlyWire FAFB v783 (CC BY-NC-SA 4.0) and MaleCNS v1.0 (CC BY 4.0). v3 incorporates external methodological review: scope-narrowed claims for Finding 1, correction of the ≥5-synapse preprocessing account and of a Shiu et al. misattribution, explicit disclosure of game-layer motor rules, softened Finding 2 attribution, and a new sign-flip experiment. Point-by-point responses are in `docs/REVIEW-RESPONSE.md`.**

## 中文摘要

本文记录浏览器游戏《电子果蝇·香蕉大作战》（Banana Quest）在真实连接组上跑动力学时实测到的方法学问题及其跨数据集复测结果，供连接组仿真社区参考。游戏用 LIF 脉冲网络在两个真实连接组（FlyWire FAFB v783：139,255 神经元 / 2,698,236 条聚合连接；MaleCNS v1.0：176,422 神经元 / 6,287,749 条 ≥5 突触连接）上驱动一只 2D 果蝇觅食——连接组放电参与运动读出与进食门控，同时游戏包含显式运动规则（§1.1 如实列出）。发现一：参考实现沿用的全局 max 权重归一化（增益 0.15）在**参考增益下**传播失败——重尾突触计数分布把典型权重压到阈值的约 1/2000，下游膜电压渐近不过阈（FlyWire 0.780、MaleCNS 0.977），中枢放电为零；增益放大 10 倍后两数据集分别有 16 / 131 次中枢放电（评审复测，我们一票复现），因此结论收窄为"参考增益下失败"而非"必然失败"。可行替代是本项目提出的 **postsynaptic L1 归一化**（每个突触后神经元总入权重归一化为常数；与 Shiu et al. 2024 的每突触固定系数方案不同，v2 的误引在此更正），工作点为数据集相关（FlyWire 3.0 / MaleCNS 4.0）。发现二：FlyWire 下行池按胞体 x 切半后存在结构性偏置（任一侧刺激右池都更活跃，有效差仅约 1.3%），须用慢速 EMA 基线的偏差做转向读出；该偏置在所测 MaleCNS 条件下未复现（侧向对比方向正确，差 9.49 个百分点），"分组伪影"解释目前仅为待验证假说，决定性检验是在同一 FlyWire 数据上重分组。发现三（方法论）：小种子扫参会系统性过拟合，行为指标必须样本外复核——且我们用于选关卡的种子集不再独立。v3 新增符号翻转实验：仅把 MaleCNS 的谷氨酸符号从抑制翻为兴奋（其余不变），ti=4 时视叶即出现 FlyWire 式点燃（VIS_OL 553,863 次放电）——两数据集打包的递质符号规则不同（GLUT 兴奋 vs 抑制）是跨数据集动力学比较的重大混杂，必须显式声明。所有数字均可由文中命令复现。

## Abstract

Banana Quest is a zero-dependency browser game in which a leaky integrate-and-fire (LIF) network running on a real connectome helps drive a 2D foraging fly. Connectome activity participates in the motor readout and feeding gating; the game additionally contains explicit motor rules, which v3 lists openly (§1.1). We report three methodological findings and their cross-dataset replication on FlyWire FAFB v783 and MaleCNS v1.0. (1) Global-max weight normalization **at the reference gain (0.15)** fails to propagate activity on aggregated connectomes with heavy-tailed synapse-count distributions — subthreshold asymptotes (0.780 / 0.977), zero central spikes on both datasets. At 10× gain, central spikes appear (16 / 131), so we scope the claim to the reference gain rather than "global-max never propagates". A working alternative is postsynaptic L1 normalization (introduced in this project; distinct from Shiu et al.'s fixed per-synapse coefficient scheme), with a dataset-dependent working point (3.0 / 4.0). (2) A coarse bilateral descending readout on FlyWire carried a structural bias larger than the stimulus-driven signal (~1.3%); it did not replicate under the tested MaleCNS conditions (correctly signed contrast, 9.49 percentage points), so the "pool-definition artifact" explanation remains a hypothesis — the decisive test is re-pooling on the same dataset. (3) Small-seed sweeps of high-variance behavioral metrics systematically overfit. v3 adds a sign-flip experiment: flipping only the glutamate sign in MaleCNS from inhibitory to excitatory reproduces FlyWire-style visual-lobe ignition at ti=4 (553,863 VIS_OL spikes) — the two packages' different neurotransmitter sign rules (GLUT excitatory vs inhibitory) are a major confound for cross-dataset dynamics and must be declared. All numbers are reproducible with the commands given.

## 1. Background

Banana Quest (电子果蝇·香蕉大作战) is an open-source, zero-build browser game. A virtual fly forages for bananas in a 2D arena. Olfactory input is injected as current into left/right pools of olfactory receptor neurons; spikes propagate through the connectome to descending neurons, whose pooled left/right firing-rate difference steers the fly, and whose total rate, scaled by a hunger variable, sets its speed. Feeding is gated by gustatory stimulation driving a proboscis motor-neuron readout. **Connectome spiking participates in every steering and feeding decision — but it is not the only thing moving the fly: the game also contains explicit motor rules, disclosed in §1.1.**

The FlyWire connectome ships as a compact binary (12.4 MB gzipped) packaged by the community project snedea/flybrain (MIT): FAFB v783 edges aggregated per neuron pair with signed weights, plus a coarse 63-group functional annotation. Their reference simulator runs the full network in a Web Worker at ~10 ticks/s using a neuropil-gated dormant-group optimization; our simulation core (`src/sim-core.js`) is adapted from it and runs unchanged in both the browser worker and Node.js for testing. The second dataset is MaleCNS v1.0 (neuPrint `male-cns:v1.0`; 176,422 neurons, 6,287,749 connections at ≥5 synapses; the full male central nervous system including the VNC; CC BY 4.0), selected at runtime with `?dataset=malecns`. We take the FLYB v1 binary bundled by the fly-brain-minecraft project (MIT) and convert it with our own `tools/flyb_to_bin.py` into the same sim-core format — 26 functional groups with the same region encoding, and pools filtered on MaleCNS's native annotations (somaSide, superclass, type). Every probe below runs through the identical `sim-core.js` on both datasets.

### 1.1 Explicit game-layer motor rules (disclosed in v3)

Earlier versions of this note said "no hand-crafted behavior layer" — that was overstated. The brain participates in behavior, but the following explicit rules also move or stop the fly, and reviewers rightly asked for them to be listed:

- **Standby random walk**: when the descending pools' total firing rate falls below a threshold, the fly performs a slow random walk driven by game-layer noise, explicitly labeled "待机噪声（非脑驱动）" in the UI.
- **Approach deceleration and stopping**: speed is additionally scaled down when turning sharply and when close to the banana (a turn-and-slow kinematic rule), and the fly stops inside the eating radius while the feeding gate is evaluated.
- **Scripted escape maneuver**: after a startle, the escape *trigger* is the brain's response (descending-rate surge or DNp01 firing), but the escape *maneuver* itself — a random sharp turn plus a fixed-duration speed boost — is scripted.
- **Wall bounce**: heading reflects off arena walls with added noise.
- **Hunger wiring**: hunger is a scripted clock that multiplies olfactory gain and injects current into a hunger-drive group (an acknowledged artificial wiring).
- **Sensor mapping and pool selection**: the odor→current mapping, the left/right pool splits, and all readout pools are hand-designed (acknowledged throughout; MaleCNS stimulus pools are additionally asymmetric, §5.5).

What the brain does do: it gates eating (the fly cannot eat unless the proboscis readout fires), it modulates steering and speed through the descending pools, and it decides whether a startle produces escape. What it does not do: fine motor coordination of walking, which is VNC-driven in real flies and kinematic rendering here.

## 2. Finding 1 — Global-max normalization at the reference gain does not propagate on aggregated connectomes

### 2.1 Measurement

The reference implementation normalizes edge weights globally: `w ← w / max|w| × 0.15`. On both aggregated datasets the raw synapse-count weights are extremely heavy-tailed:

| dataset | max | median | p90 | p99 |
|---|---|---|---|---|
| FlyWire v783 | 2405 | 8 | 23 | 77–83 (sample-dependent) |
| MaleCNS v1.0 | 2591 | 9 | 28 | 93 |

Global-max normalization therefore maps the *median* edge to ≈ 0.15 × 8/2405 ≈ 5×10⁻⁴ — roughly 1/2000 of the firing threshold (1.0). Empirically, driving the left olfactory pool at sustained intensity 0.5 for 100 ticks produced, on **FlyWire**, 18,525 spikes **all in sensory groups; central-brain spikes: 0**, with the downstream OLF_PN group's maximum membrane voltage asymptoting to **0.780** (it was 0.688 at tick 50 of the same run protocol). On **MaleCNS** the same protocol produced 21,867 spikes, again all sensory, central and motor 0, OLF_PN asymptote **0.977**. Signal dies in the antennal lobe at the reference gain on both datasets.

### 2.2 Postsynaptic L1 normalization (introduced in this project)

We replaced global scaling with **postsynaptic L1 normalization**: each postsynaptic neuron's total incoming |w| is scaled to a constant `targetInput`. *Attribution note (corrected in v3): v2 called this "Shiu et al. (2024)-style" — that was a misattribution. Shiu et al.'s published code (`philshiu/Drosophila_brain_model`, `model.py`) uses a fixed per-synapse coefficient (`w_syn = 0.275 · mV`), not postsynaptic total-input normalization. The scheme used here was introduced by this project; the two differ fundamentally (per-neuron budget vs global coefficient).* Sweeping `targetInput` (200-tick probes driving the same ORN pool):

| targetInput | FlyWire (200 ticks) | MaleCNS (200 ticks) |
|---|---|---|
| 1.0 | MB_KC 2,544, GNG_DESC 0 | MB_KC 148, DN 0 |
| 2.0 | MB_KC 57,446, GNG_DESC 10 | MB_KC 37,237, DN 0 |
| 3.0 | GNG_DESC 3,810; stable over 500 ticks of maximal bilateral input | DN 11; no visual ignition |
| 4.0 | whole-brain ignition (VIS_ME 405,788 spikes/200 ticks with zero visual input) | DN 75; VIS_OL 2 (no ignition) |

The working point is dataset-dependent: we ship 3.0 for FlyWire and 4.0 for MaleCNS (§5.3).

### 2.3 Gain dependence (review replication, added in v3)

An external reviewer noted that the failure claim depends on the gain constant. Repeating the §2.1 protocol with the global-max coefficient scaled ×10 (0.15 → 1.5): **central spikes appear on both datasets — 16 on FlyWire, 131 on MaleCNS (plus 13 motor)**. Our probe reproduces the reviewer's numbers exactly (`node game/tools/probe_flywire.mjs`, probe 5; MaleCNS inline probe in `docs/results/`). This does not prove the higher gain is stable or useful — it does show that "global-max never propagates" would be an overgeneralization, so we have narrowed Finding 1 to the reference gain throughout (title, abstract, discussion).

### 2.4 Discussion

Aggregation is the culprit multiplier at the reference gain: collapsing all synaptic contacts between a neuron pair into one scalar produces a few huge weights (a 2405-contact edge) that set the global scale for everyone else, and a threshold model then divides the world into "edges that matter" and "edges that don't" with nothing in between. Any demo that "just runs dynamics" on an aggregated connectome should publish its normalization, its gain, and a propagation test; a silent network at reference gain is the default outcome, not a bug in your stimulus.

## 3. Finding 2 — Structural bias in coarse descending readouts (FlyWire measurement)

### 3.1 Measurement

Our FlyWire steering readout splits GNG_DESC (3,581 neurons) into left/right pools by soma x-coordinate median (1,791 / 1,790 neurons). Stimulating either antennal pool alone (I=1.0, 200 ticks, targetInput 3.0) gives:

| stimulus | desc_left | desc_right | L/(L+R) |
|---|---|---|---|
| left antenna pool | 1,704 | 2,106 | 0.447 |
| right antenna pool | 1,633 | 2,133 | 0.434 |

The right pool fires more under **either** unilateral stimulus (bias ≈ +24% over the left pool), while the stimulus-dependent contrast between the two rows is only ~1.3%. First descending spikes appear 9 ticks (~0.9 s at 10 Hz) after stimulus onset. Feeding the raw rates into a steering law `turn = k·(R−L)/(R+L+ε)` would make the fly veer right forever regardless of where the banana is.

### 3.2 Baseline-deviation fix

We steer on the deviation from each pool's own slow baseline: `turn = k·(R̂−L̂)/(R̂+L̂+ε)` with `R̂ = max(0, R − EMA_τ(R))`, τ = 5 s. The EMA high-passes away the static bias and slow drift; the residual tracks the *current* gradient. Notably, a longer baseline (τ = 20–40 s) performs worse in behavioral sweeps (eat rates fall to 40–80% in 7 of 8 swept configurations, and at τ = 40 s path tortuosity rises to ~17–23): persistent wrong-sign deviations get "locked in" by the long memory, whereas the 5 s high-pass keeps the loop responsive.

### 3.3 Interpretation — hypothesis, not conclusion

Where does the bias come from? Candidate contributors: the fly's largely bilateral olfactory pathway, our anatomically naive x-median split, the "GNG_DESC" group definition mixing descending and ascending neurons, and single-specimen hemispheric asymmetries in proofreading or annotation. v2 leaned toward "real structure"; v2's cross-dataset result (§5.4) instead suggests a pool-definition artifact. In v3 we explicitly downgrade all such attribution to **hypothesis**: the measurement itself stands, the explanation is undecided, and the decisive experiment is re-pooling/relabeling on the same FlyWire data (§6). Practical rule for demo builders, unchanged: **calibrate readout pools by baseline subtraction, and report the bias** — if your bilateral pools respond equally to both sides, your "steering" is cosmetic.

## 4. Finding 3 — Seed overfitting: a tuning-methodology lesson

### 4.1 The sweep winner that wasn't

Because steering is weak and fluctuation-dominated, time-to-first-banana is a high-variance metric (in our runs, 12–166 s across seeds for identical parameters; the game injects constant current, so the fluctuations arise from network dynamics and game-layer randomness, not from any Poisson implementation — v2's "Poisson noise" wording was imprecise). We swept game-layer readout constants (`turnGain × smellSigma × baseSpeed`, then `turnGain × emaTau × baseSpeed`; 12 configs × 5 LCG-seeded runs × 180 simulated seconds each, brain reset between episodes, full tables in `game/README.md`). The qualitative trends are modest and configuration-dependent: in our tables, higher `turnGain` is associated with worse outcomes in most rows (with individual counterexamples — e.g. turnGain 4 × smellSigma 250 × baseSpeed 12 scores 2.20 vs the default's 2.80 with a similar median), and enlarging `emaTau` degrades performance (§3.2). The apparent champion, `turnGain = 1.8`, scored 100% eat rate, 26.4 s median, 3.00 mean score across the 5 sweep seeds.

On 10 fresh seeds it collapsed: 8/10 ate, median 57.7 s, mean 73.7 s, mean score 1.30 — **worse than the status-quo default on the same 10 seeds** (10/10, 49.6 s median, 2.70 score). The 5-seed "win" was seed luck.

### 4.2 What actually helped: level design

Capping banana spawn distance at 350 px excluded the far corners of the arena (max distance from the center-spawned fly is ≈362 px), yet produced metrics identical to the default in our seed set — no measurable effect. Capping spawns to a 150–250 px ring, however, moved the median time-to-first-banana from 49.6 s to **27.3 s** (10/10 eaten, tortuosity 8.47 — still clearly wandering search rather than a ≈1 straight-line beeline). A "fast search" variant (higher speed gain / max speed) that rewrote the rate→speed readout mapping improved score in one combination but degraded out-of-sample medians and was rejected.

### 4.3 Honest-tuning principle

The final shipped defaults change *only* the level-design constant (`bananaMaxDist = 250`). Every constant in the sensory→brain→readout mapping is unchanged, so the demo's core claim — "the brain's readout participates in the decision" — carries no hidden tuning water. Two methodological lessons generalize beyond games. First: **behavioral metrics with high stochastic variance must be validated out-of-sample; a small-seed sweep does not estimate the parameter effect, it estimates the seed set.** Second, disclosed in v3: **the seeds (101–110) used to select the level-design constant were also used to evaluate it — they are no longer an independent test set.** We kept both tables in the repo README precisely so the selection is auditable.

## 5. Cross-dataset replication on MaleCNS

Everything in §2–§4 was first measured on FlyWire. We then re-ran the same probe battery on MaleCNS v1.0 through the identical simulation core. Full tables and commands are in `docs/malecns-probes.md` and `docs/results/`; the highlights and their consequences follow. §5.1–§5.4 were substantially rewritten in v3 after external review.

### 5.1 Preprocessing caveats (corrected in v3)

**Both datasets are ≥5-synapse filtered.** v2 claimed the FlyWire package "keeps aggregated connections of any strength" — that was wrong. Unsigned aggregation of the FlyWire source CSVs yields a minimum connection weight of 5.0 with zero neuron pairs below 5 (2,700,513 unsigned pairs; the 2,277-pair difference to the binary's 2,698,236 edges is pairs whose signed weights cancel to exactly zero and are dropped). The MaleCNS bundle is likewise thresholded at ≥5 synapses (6,287,749 connections) and additionally drops autapses.

**The neurotransmitter sign rules differ between packages — a major confound.** The FlyWire packaging (snedea/flybrain `NT_SIGN`) assigns glutamate weight **+1 (excitatory)**; the MaleCNS packaging (fly-brain-minecraft, following GluCl biology) assigns glutamate **−1 (inhibitory)**. GABA and histamine are inhibitory in both; acetylcholine and monoamines excitatory in both. Glutamatergic neurons are abundant in both datasets (MaleCNS: 29,763 neurons, ~17%). Cross-dataset dynamical differences below must be read against this sign-rule difference, which v2's "equivalent sign rule" wording obscured. Other differences remain: sex (female/male), VNC (absent/present), individuals, and packaging pipelines.

### 5.2 Finding 1 — replicated at reference gain, and gain-bounded

Covered in §2.1 and §2.3: global-max normalization fails at the reference gain on both datasets (0.780 / 0.977 asymptotes, zero central spikes), and propagates at 10× gain (16 / 131 central spikes). The cross-dataset statement that survives review is therefore narrow but robust: **at the reference gain of the reference implementation, global-max normalization does not propagate on either aggregated connectome.**

### 5.3 targetInput — structure replicates, the working point drifts; sign rules, not filtering, drive the ignition difference

The per-neuron sweep (§2.2 table) reproduces the same layered reachability on MaleCNS — 1.0 dies at the mushroom-body entrance, 2.0 ignites the mushroom body but not descending neurons, 3.0 first reaches them (DN 11), 4.0 makes them usable (DN 75). Two quantitative differences from FlyWire:

First, the olfactory→descending-neuron drive is **about two orders of magnitude weaker** (11 vs 3,810 GNG_DESC spikes per 200 ticks at ti=3.0). Candidate contributors: MaleCNS's `descending_neuron` superclass is a pure brain→VNC command population several synapses from the olfactory entry, whereas FlyWire's "GNG_DESC" group mixes in directly sensory-driven neurons; and the sign-rule difference changes net excitation everywhere.

Second — and here v2's attribution must be retracted — **MaleCNS shows no FlyWire-style visual ignition at ti=4.0** (VIS_OL: 2 spikes, versus VIS_ME 405,788 spikes/200 ticks on FlyWire). v2 attributed this to MaleCNS's ≥5-synapse filtering; that attribution was void (§5.1: both datasets are filtered). The replacement hypothesis was the sign-rule difference — and v3 tested it directly:

**Sign-flip experiment.** We regenerated the MaleCNS binary with only the glutamate sign flipped from −1 to +1 (`python game/tools/flyb_to_bin.py --glut-excitatory`, 29,763 neurons flipped; all other parameters identical), and ran the ti=4.0 probe:

| variant | total spikes (200 ticks) | DN | VIS_OL |
|---|---|---|---|
| MaleCNS standard (GLUT inhibitory), ti=3.0 | 235,638 | 11 | 0 |
| MaleCNS standard, ti=4.0 | 331,336 | 75 | 2 |
| MaleCNS GLUT-excitatory, ti=3.0 | 492,145 | 1,025 | 41 |
| **MaleCNS GLUT-excitatory, ti=4.0** | **1,797,262** | **19,004** | **553,863** |

A single-variable sign flip transforms MaleCNS from seizure-resistant to seizure-prone and reproduces the FlyWire ti=4 visual-lobe ignition phenotype (plus strong VIS_VPN activity, 114,510). This is direct experimental support that **the packages' neurotransmitter sign rules — not edge filtering — account for the ignition difference**. It also means excitability is partly a packaging choice: Shiu et al. assign glutamate to the inhibitory category (GluCl), the FlyWire browser package to the excitatory one, and the resulting networks sit in different dynamical regimes.

The practical advice to the community sharpens accordingly: **run a per-dataset propagation test, publish the working point and the sign table — there is no universal constant, and there is no universal sign convention either.**

### 5.4 Finding 2 — not replicated under the tested MaleCNS conditions

With MaleCNS's *native* `somaSide` pool split and adequate drive (ti=4.0), the lateral contrast is **correctly signed**:

| drive | stimulus | desc_left | desc_right | L/(L+R) |
|---|---|---|---|---|
| ti=3.0, 200 ticks | left antenna pool | 5 | 6 | 0.455 |
| ti=3.0, 200 ticks | right antenna pool | 12 | 15 | 0.444 |
| ti=4.0, 400 ticks | left antenna pool | 91 | 66 | **0.580** |
| ti=4.0, 400 ticks | right antenna pool | 111 | 118 | **0.485** |

The left–right difference between the two ti=4 rows is **9.49 percentage points** (0.580 − 0.485 = 0.0949; v2's "~8%" was an arithmetic slip). At ti=3.0 the DN counts are too small (5–15 spikes per pool in 200 ticks; 10–34 in 400 ticks) for any bias statistic.

What can and cannot be concluded. Under the tested MaleCNS conditions, the wrong-direction bias does not appear. But the two measurements differ in dataset, individual, sex, VNC presence, **sign rules**, pool definitions, and working point all at once — so "pool-definition artifact" (v2's preferred reading) remains **a hypothesis, not a conclusion**. The decisive experiment changes only the pooling on a fixed dataset: re-split FlyWire's descending population by alternative rules (e.g. hemispheric relabeling, ascending-excluded re-pooling) and re-measure (§6, next experiments). We also note what the bias was *not*: a supplementary probe shows MaleCNS ascending neurons (AN group) fired 0 times in 200 ticks under olfactory stimulation (versus 710 under bristle stimulation) — ascending neurons do not carry olfactory drive, so FlyWire GNG_DESC's olfactory responsiveness did not come from its ascending component.

**Statistical disclosures (v3).** (i) The MaleCNS olfactory stimulus pools are asymmetric: 411 unknown-side ORNs were assigned to the left/right pools by index parity, giving 1,090 (left) vs 1,549 (right) neurons — at equal per-neuron current, the right pool receives ≈42% more total input. (ii) 10 midline descending neurons were assigned to the pools by parity. (iii) Each probe condition is a single deterministic trajectory; spike counts within a run are not independent samples, and ti=4.0 does not by itself make the comparison statistically adequate. (iv) Baseline subtraction remains necessary in the game on both datasets.

### 5.5 Biological sanity checks (small, but free)

- **DNp01 (giant fiber) does not respond to bristle stimulation**: 0 spikes in 20 ticks of strong mechanosensory-bristle drive — consistent with its known biology as a visually (looming-) triggered escape neuron. The game's escape path therefore keys on the descending-rate surge (bristle drives ascending/central activity strongly, 710 AN spikes in the same probe), not on DNp01.
- **The feeding chain works on MaleCNS**: gustatory pool at I=1.2 drives the MN9-class proboscis motor readout (16 cb_motor neurons) to 3 spikes in 30 ticks (first at tick 22) — at the game's feeding-gate threshold, and the headless closed loop on MaleCNS eats bananas for real (score 1–3 per 180 s across seeds, first eats 49–172 s; steering is legitimately "hard mode": DN rates of ~2–8 spikes/s at distance, rising to 34–42/s at close range).

## 6. Limitations and open questions

Limitations. Point LIF neurons without conductances, delays, neuromodulation, or plasticity; no gap junctions; transmitter signs from prediction pipelines with package-specific sign rules that materially change dynamics (§5.1, §5.3); two individuals (one female FAFB, one male MaleCNS) with different packaging pipelines; FlyWire has no ventral nerve cord, and even on MaleCNS we do not simulate real gait; **the game contains explicit motor rules (§1.1)**; per-dataset stimulus gains are acknowledged level design; probe conditions are single deterministic trajectories, and the level-design seed set doubles as its evaluation set (§4.3). None of this claims biological fidelity, let alone "uploading".

Next experiments (ordered):

1. **Decisive test for the Finding 2 attribution**: on the *same* FlyWire data, re-pool the descending population under alternative rules (hemispheric relabeling, ascending-excluded, native-side annotations from FlyWire's own classification) and re-measure the unilateral-stimulus contrast. If the wrong-direction bias vanishes under alternative pooling, the artifact reading is confirmed on that dataset.
2. **BANC replication** of the global-max reference-gain failure (one-command dataset swap), plus a record of each packaging's sign table as a mandatory companion to any dynamical comparison.
3. **Named-DN readouts**: which specific descending types (e.g. the turn/halt DNs characterized in the literature) restore steering contrast without any baseline subtraction, on either dataset?
4. **Gain stability**: characterize whether the 10× global-max gain (§2.3) yields usable, non-seizing dynamics or merely pushes the failure threshold higher.

## 7. Reproducibility

All numbers in this note were produced on this repository (Node v24, Python 3.13, Windows; CPU-only; minutes). v1 numbers were produced at commit `d92807b`, v2 at `73da541`; key per-run outputs are archived under `game/docs/results/`. Probe batteries are now frozen as scripts: `game/tools/probe_flywire.mjs` and `game/tools/probe_malecns.mjs` (aligned protocols, both archived in `docs/results/`).

| number(s) | command |
|---|---|
| FlyWire propagation (47,106 spikes / 35,159 central); N/E counts; ms/tick | `node game/test/sim.test.mjs` |
| FlyWire weight distribution; reference-gain failure; targetInput sweep; bias table; gain ×10 retest (16 central) | `node game/tools/probe_flywire.mjs` (archive: `docs/results/probe_flywire.txt`) |
| FlyWire pools generation (weight scan incl. p99) | `python game/tools/prepare_pools.py` |
| MaleCNS three-file conversion (176,422 / 6,287,749; weight stats) | `python game/tools/flyb_to_bin.py` |
| MaleCNS probes 1–4 (distribution; reference-gain failure; targetInput; bias) | `node game/tools/probe_malecns.mjs` (archive: `docs/results/probe_malecns.txt`) |
| gain ×10 retest, MaleCNS (131 central + 13 motor) | inline probe, transcribed in `docs/results/gain_x10_malecns.txt` |
| sign-flip variant build + ti=3/4 comparison | `python game/tools/flyb_to_bin.py --glut-excitatory` ; probe transcript `docs/results/signflip_ti34.txt` |
| MaleCNS feeding/escape/ascending supplementary probes | inline scripts at ti=4.0 (transcribed in `docs/malecns-probes.md`) |
| FlyWire closed loop (first eat 29.6 s, score 2/120 s) | `node game/tools/headless_run.mjs 120` |
| MaleCNS closed loop (score 1, first eat 104.3 s) | `node game/tools/headless_run.mjs 180 '{}' 7 malecns` |
| sweep round 1 (turnGain × smellSigma × baseSpeed; historical config: bananaMaxDist=∞) | `node game/tools/tune_sweep.mjs` |
| sweep round 2 (turnGain × emaTau × baseSpeed; bananaMaxDist=∞) | `node game/tools/tune_sweep.mjs '{"turnGain":[1.8,2.6],"emaTau":[5,20,40],"baseSpeed":[6,12]}'` |
| out-of-sample & level-design comparisons (bananaMaxDist ∈ {∞, 350, 250}) | `runEpisode()` API in `game/tools/harness.mjs`, seeds 101–110 |

Seeded runs use an injectable LCG replacing `Math.random`; episodes call `sim.reset()` between runs so one process reuses a single parsed brain. Headless runs are not real-time throttled. Honest reuse note: seeds 101–110 served both for selecting `bananaMaxDist` and for evaluating it (§4.3).

## References

- Bates, A. S., Phelps, J. S., et al. (2026). Distributed control circuits across a brain-and-cord connectome. *Nature*. https://doi.org/10.1038/s41586-026-10735-w
- brandoncho369/flybench (2026). Behavioural benchmark for whole-brain fruit fly connectome simulations: pre-registered, cited behavioural tasks on FlyWire v783 and MaleCNS with shuffled-wiring controls and a reference LIF implementation. https://github.com/brandoncho369/flybench (MIT)
- blendi-remade/fly-brain-minecraft (2026). Minecraft mod driven by the MaleCNS connectome; source of the FLYB v1 binary packaging of neuPrint male-cns:v1.0 used here (format spec and full transformation log in its `PROVENANCE.md`). https://github.com/blendi-remade/fly-brain-minecraft (MIT)
- Beiran, M. & Litwin-Kumar, A. (2025). *Nature Neuroscience* 28: 2561–2574（连接组只部分约束动力学）. Code: https://github.com/emebeiran/connconstr ; data: https://zenodo.org/records/16618353
- Berg, S., Beckett, I., et al. (2026). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system (MaleCNS). *Cell*. doi:10.1016/j.cell.2026.08.015 ; preprint: https://www.biorxiv.org/content/10.1101/2025.10.09.680999v1
- cobanov/awesome-fly (2026). Community index of fly-brain demos, with fidelity disclaimers. https://github.com/cobanov/awesome-fly
- Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. (2024). Neuronal wiring diagram of an adult brain. *Nature* 634: 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. *Cell* 187: 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Schlegel, P., Yin, Y., Bates, A. S., et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. *Nature* 634: 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Shiu, P. K., Sterne, G. R., Spiller, N., et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. *Nature* 634: 210–219. https://doi.org/10.1038/s41586-024-07763-9 ; code: https://github.com/philshiu/Drosophila_brain_model
- snedea/flybrain (2026). Browser-based LIF simulation of the FlyWire connectome (data packaging & reference simulator; neurotransmitter sign table in `scripts/build_connectome.py`). https://github.com/snedea/flybrain
- Stürner, T., et al. (2025). *Nature* 643: 158–172（下行/上行神经元的比较连接组学：FlyWire + MANC + FANC）. https://doi.org/10.1038/s41586-025-08925-z
- Wang-Chen, S., Stimpfling, A., Lam, K., et al. (2024). NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila. *Nature Methods* 21: 2353–2362. https://doi.org/10.1038/s41592-024-02497-y
- Zheng, Z., Lauritzen, J. S., Perlman, E., et al. (2018). A complete electron microscopy volume of the brain of adult Drosophila melanogaster. *Cell* 174: 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019

*Community context: this note was written against the backdrop of the 2026 "flyslop" demo wave (indexed at awesome-fly and Fly Brain Hub, https://fly-brain-hub.vercel.app/) and community validation efforts such as flybench. v3 was revised in response to an external methodological review; the point-by-point response letter is `docs/REVIEW-RESPONSE.md`.*
