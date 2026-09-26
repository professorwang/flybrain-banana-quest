# Packaging choices change connectome-simulation outcomes: sign tables, a bidirectional intervention, and honest lessons from two connectomes

**Technical note v5, 2026-09-27. Code: `fruitfly/game/` — commit lineage in §7, this revision @ `99ed490` (MIT). Data: FlyWire FAFB v783 (CC BY-NC 4.0) and MaleCNS v1.0 (CC BY 4.0). v5 restructures the note around one mainline question — how do data-packaging choices change the conclusions of "run dynamics on a connectome" simulations? Earlier finding-level detail is compressed; the full correction chronology moved to Appendix A and the review-response letter (`docs/REVIEW-RESPONSE.md`).**

## 中文摘要

本文回答一个方法论问题：**数据加工选择如何改变连接组仿真的结论**。我们用同一个 LIF 内核、同一组探针，在两个社区封装的真实连接组（FlyWire FAFB v783：139,255 神经元；MaleCNS v1.0：176,422 神经元）上测量。起点是三个加工事实：两个包都做了 ≥5 突触过滤；FlyWire 包把谷氨酸赋为兴奋性而 MaleCNS 包赋为抑制性（histamine 仅 MaleCNS 包显式标记 8,021 个节点为抑制，FlyWire 的六类递质预测不含该类别）；参考实现的全局 max 归一化在参考增益下两包都不传播（100 tick 观察到的最大电压 0.780/0.977 不过阈、中枢零放电）。核心实验是**双向符号干预**：MaleCNS 的谷氨酸翻为兴奋（其余不变）→ ti=4 视叶高活动（VIS_OL 553,863 次放电）；FlyWire 的谷氨酸翻为抑制 → ti=4 视叶高活动消失（VIS_ME 405,788 → 0）。在 ti=4、I=1、200 tick 及所比较的 GLUT 正/负两种配置下，谷氨酸符号赋值对该高活动表型既充分又必要——这是**模型内赋号干预的因果结果，不能据此推导真实果蝇的谷氨酸机制**。方法论建议（面向"在连接组上跑动力学"的社区）：逐数据集做传播测试并同时公布工作点与符号表；读出池对慢基线校准并披露偏置（我们的 FlyWire 下行池偏置 ~24%，有效差仅 1.3%）；高方差行为指标必须样本外复核（5 种子冠军在 10 个样本外种子上中位 26.4s→57.7s 现形）；如实列出游戏层显式规则。先例对照（fly-brain-minecraft 的 VALIDATION.md 增益扫描与嗅觉读出失败记录、flybench 的预注册任务与重连对照）之外，本文的新增是：双向符号干预的因果设计、跨数据包审计方法、全部命令可复现的公开管线。

## Abstract

**Question: how do data-packaging choices change the conclusions of "run dynamics on a connectome" simulations?** We answer it with one simulation core and one frozen probe battery on two community-packaged real connectomes (FlyWire FAFB v783, 139,255 neurons; MaleCNS v1.0, 176,422 neurons). Three packaging facts set the stage: both packages filter connections at ≥5 synapses; the FlyWire package signs glutamate excitatory while the MaleCNS package signs it inhibitory (histamine is explicitly inhibitory for 8,021 labeled nodes only in MaleCNS — FlyWire's six-class transmitter prediction has no histamine class at all); and the reference global-max normalization fails to propagate at the reference gain on both packages (100-tick observed maxima 0.780 / 0.977, zero central spikes). The core result is a **bidirectional sign intervention**: flipping only the glutamate sign in MaleCNS from inhibitory to excitatory produces high visual-lobe activity at ti=4 (553,863 VIS_OL spikes), and the reverse flip in FlyWire abolishes it (VIS_ME 405,788 → 0) — at ti=4, I=1, 200 ticks, and across the two GLUT sign configurations compared, the glutamate sign assignment is both sufficient and necessary for the high-activity phenotype. **This is a causal result about sign perturbations inside the model; it licenses no inference about real fly glutamatergic biology, which would require physiological or behavioral evidence.** Methodological recommendations for the "dynamics on connectomes" community: run a per-dataset propagation test and publish the working point *and* the sign table; calibrate readout pools against a slow baseline and disclose the bias (our FlyWire descending pools carried a ~24% structural bias against a ~1.3% stimulus contrast); validate high-variance behavioral metrics out-of-sample (our 5-seed champion's median degraded 26.4 s → 57.7 s on 10 fresh seeds); and disclose explicit game-layer motor rules. Relative to prior validation work (fly-brain-minecraft's VALIDATION.md gain sweeps and olfaction-readout failure records, flybench's pre-registered tasks with shuffled-wiring controls), this note adds a bidirectional causal intervention design, a cross-package audit method, and a fully reproducible public pipeline. All numbers are reproducible with the commands given, except where marked as historical records.

## 1. Background and mainline question

Banana Quest (电子果蝇·香蕉大作战) is a zero-dependency browser game in which a leaky integrate-and-fire (LIF) network running on a real connectome helps drive a 2D foraging fly. The question this note is organized around is not "does the fly move" but: **when a community takes a published connectome, packages it, and runs off-the-shelf dynamics on it, which conclusions are determined by the packaging choices rather than by the connectome itself?** Our testbed is two independent packages of two different connectomes, probed through the identical simulation core (`src/sim-core.js`, browser worker and Node.js alike):

- **FlyWire FAFB v783** (139,255 neurons, 2,698,236 aggregated connections, brain-only, female), packaged by snedea/flybrain (MIT) as a 12.4 MB binary with a 63-group annotation;
- **MaleCNS v1.0** (176,422 neurons, 6,287,749 connections at ≥5 synapses, full male CNS with VNC), taken from fly-brain-minecraft's FLYB v1 bundle (MIT) and converted by our `tools/flyb_to_bin.py` into the same format with 26 groups and native-annotation pools.

The game context matters only as motivation: connectome spiking participates in steering and feeding gating, **and** the game contains explicit motor rules (standby random walk, approach deceleration and stopping, scripted escape maneuver, wall bounce, scripted hunger wiring, hand-designed sensor mappings and pool selections) — disclosed here once, because reviewers rightly objected to an earlier "no hand-crafted behavior layer" claim.

### 1.1 Precursor findings (compressed; details in Appendix and archives)

Three problems motivated the mainline study; each retains its core numbers and its lesson here.

**P1 — normalization decides whether anything propagates at all.** The reference implementation's global-max weight normalization (gain 0.15) leaves the heavy-tailed weight distribution (max 2405 / median 8) with a median effective weight ~1/2000 of threshold. On both datasets, driving the left olfactory pool at 0.5 for 100 ticks produced activity confined to sensory groups with zero central spikes (FlyWire: 18,525 spikes all sensory, 100-tick observed max voltage 0.780; MaleCNS: 21,867, max 0.977). At 10× gain a small number of central spikes appears (16 / 131) with unknown stability — so the claim is scoped to the reference gain. The working alternative we adopted is **postsynaptic L1 normalization** (per-neuron total input scaled to `targetInput`; our engineering choice, distinct from Shiu et al.'s fixed per-synapse coefficient `w_syn = 0.275 · mV`), whose layered reachability replicates on both datasets but whose **working point is dataset-dependent (3.0 FlyWire / 4.0 MaleCNS)**. Lesson: publish normalization, gain, and a propagation test; silence at reference gain is the default, not a stimulus bug.

**P2 — coarse bilateral readouts can carry structural bias.** Our FlyWire descending readout (GNG_DESC split by soma-x median, 1,791/1,790) fires the right pool more under *either* unilateral antennal stimulus (1,704 vs 2,106 left-stim; 1,633 vs 2,133 right-stim) — a ~24% bias against a ~1.3% stimulus contrast. We steer on a **heuristic high-pass readout** (deviation from a τ = 5 s EMA baseline), offered with no claim that it removes bias or recovers a "true" lateral signal. Lesson: calibrate readout pools against a slow baseline and report the bias.

**P3 — small-seed sweeps overfit.** A 5-seed sweep crowned `turnGain = 1.8` (median first-eat 26.4 s, score 3.00); on 10 out-of-sample seeds it collapsed (8/10, median 57.7 s, score 1.30), worse than the status-quo default on the same seeds (10/10, 49.6 s, 2.70). What robustly helped was level design (banana spawn ring 150–250 px, median 27.3 s), not readout retuning. Caveats we disclose: first-eat statistics count successful episodes only; the 101–110 seed set served both selection and evaluation; and the champion's 3.00 required the historical unbounded spawn distance (2.20 under today's default, 3.00 restored with `"bananaMaxDist":[null]` — both verified against the reviewer's independent measurements). Lesson: validate high-variance behavioral metrics out-of-sample, and say which seeds did what.

## 2. What the two packagings actually change

### 2.1 Both are ≥5-synapse filtered

Unsigned aggregation of the FlyWire source CSVs yields a minimum connection weight of 5.0 with zero neuron pairs below 5 (2,700,513 unsigned pairs; the 2,277-pair difference to the binary's 2,698,236 edges is pairs whose signed weights cancel to exactly zero and are dropped). The MaleCNS bundle is likewise thresholded at ≥5 synapses (6,287,749 connections) and additionally drops autapses. An earlier version of this note wrongly described the FlyWire package as unfiltered and used that to explain dynamical differences; that account was retracted (Appendix A).

### 2.2 The neurotransmitter sign tables differ — a major confound

| transmitter | FlyWire package (snedea `NT_SIGN`) | MaleCNS package (fly-brain-minecraft) |
|---|---|---|
| acetylcholine | +1 excitatory | +1 excitatory |
| glutamate | **+1 excitatory** | **−1 inhibitory** |
| histamine | **not a predicted class in this dataset** | **−1 inhibitory (8,021 labeled nodes)** |
| GABA | −1 inhibitory | −1 inhibitory |
| monoamines (DA/OA/5-HT) | +1 excitatory | +1 excitatory |

Facts verified by scanning every `nt_type` label in the FlyWire source `connections.csv.gz` (3,869,878 rows): the label set is exactly six classes — ACH 2,258,155; GABA 865,318; GLUT 654,183; DA 37,705; SER 37,450; OCT 17,067 — **with no histamine and no empty labels**. FlyWire's six-class transmitter prediction simply does not include histamine, and neurons (including photoreceptors) are labeled with one of these six classes; **the absence of a predicted class cannot be used to infer how real histaminergic neurons are signed in the FlyWire package**. The MaleCNS package explicitly assigns −1 to 8,021 histamine-labeled nodes (a count of histamine-labeled nodes, not of photoreceptors). Glutamatergic neurons are abundant in both datasets (MaleCNS: 29,763, ~17%). Other differences that remain: sex (female/male), VNC (absent/present), individuals, and packaging pipelines.

### 2.3 Same normalization structure, drifting working point

With postsynaptic L1 normalization, both datasets show the same layered reachability under olfactory drive (200-tick probes, I=1.0): ti=1.0 dies at the mushroom-body entrance, ti=2.0 ignites the mushroom body but not descending neurons, ti=3.0 first reaches them, ti=4.0 makes them usable:

| targetInput | FlyWire (200 ticks) | MaleCNS (200 ticks) |
|---|---|---|
| 1.0 | MB_KC 2,544, GNG_DESC 0 | MB_KC 148, DN 0 |
| 2.0 | MB_KC 57,446, GNG_DESC 10 | MB_KC 37,237, DN 0 |
| 3.0 | GNG_DESC 3,810; stable over 500 ticks of maximal bilateral input | DN 11; VIS_OL 0 |
| 4.0 | whole-brain high activity (VIS_ME 405,788 spikes/200 ticks, zero visual input) | DN 75; VIS_OL 2 (no ignition) |

Two quantitative differences: the olfactory→descending drive is ~2 orders of magnitude weaker on MaleCNS (11 vs 3,810 per 200 ticks at ti=3.0 — pure command-DN superclass vs FlyWire's mixed GNG_DESC group, plus sign-rule effects); and **MaleCNS shows no FlyWire-style high visual-lobe activity at ti=4.0** (VIS_OL 2 vs VIS_ME 405,788). §3 shows what accounts for the second difference.

## 3. The bidirectional sign intervention (causal core)

**Forward experiment (sufficiency, MaleCNS).** We regenerated the MaleCNS binary with only the glutamate sign flipped from −1 to +1 (`python game/tools/flyb_to_bin.py --glut-excitatory`, 29,763 neurons flipped; all other parameters identical), and ran the ti=3/4 probes:

| variant | total spikes (200 ticks) | DN | VIS_OL |
|---|---|---|---|
| MaleCNS standard (GLUT inhibitory), ti=3.0 | 235,638 | 11 | 0 |
| MaleCNS standard, ti=4.0 | 331,336 | 75 | 2 |
| MaleCNS GLUT-excitatory, ti=3.0 | 492,145 | 1,025 | 41 |
| **MaleCNS GLUT-excitatory, ti=4.0** | **1,797,262** | **19,004** | **553,863** |

**Reverse experiment (necessity, FlyWire).** We rebuilt the FlyWire binary from the source connection table with only the glutamate sign flipped from +1 to −1 — the source rows re-aggregated and postsynaptic-L1-normalized identically, differing only in the sign rule (`python game/tools/build_flywire_variant.py`; equivalence self-check: a standard-sign rebuild reproduces the shipped `connectome.bin.gz` edge-for-edge, 2,698,236 edges, zero mismatches), and ran the same probes:

| variant | total spikes (200 ticks) | GNG_DESC | VIS_ME |
|---|---|---|---|
| FlyWire standard (GLUT excitatory), ti=3.0 | 447,219 | 3,810 | 2,860 |
| FlyWire standard, ti=4.0 | 1,265,998 | 25,730 | 405,788 |
| FlyWire GLUT-inhibitory, ti=3.0 | 222,036 | 30 | **0** |
| FlyWire GLUT-inhibitory, ti=4.0 | 291,831 | 113 | **0** |

*Scope note.* The intervention is a single rule change, not a single-edge change: it alters the edge set by 517 edges (2,698,753 vs 2,698,236, from changed cancellation), the weights of 77,650 shared edges, and 23,905 postsynaptic L1 denominators. These are consequences of the same rule intervention, not an additional confound — "the graph" here means the fixed source connection table re-aggregated under each sign rule, not one frozen weighted graph.

**Conclusion, stated as narrowly as the data allow: at ti=4, I=1, 200 ticks, and across the two GLUT sign configurations compared, flipping only the glutamate sign is sufficient to cause high visual-lobe activity on the MaleCNS-derived graph, and flipping it back abolishes that activity on the FlyWire-derived graph (405,788 → 0) — the glutamate sign assignment is both sufficient and necessary for the high-activity regime under exactly these conditions.** The ti=3 rows are reported for completeness and are *not* part of this conclusion.

**Boundary statement.** This is a causal result about **sign perturbations inside the model** — it tells us which packaging choice drives the simulated high-activity regime. It licenses **no inference about real fly glutamatergic biology**: whether glutamate acts excitatorily or inhibitory at any given synapse in the animal is a physiological question, and a mechanistic claim would require physiological or behavioral evidence, not network perturbations. (For orientation, not evidence: Shiu et al. assign glutamate to the inhibitory category via GluCl, the FlyWire browser package to the excitatory one.)

## 4. Related validation work, and what this note adds

**fly-brain-minecraft `docs/VALIDATION.md`.** The upstream MaleCNS demo already keeps an exemplary validation record: a silent-brain check, a sugar→MN9 feeding bench reproducing the paper pathway, a gain sweep (their scheme is Shiu's fixed `w_syn = 0.275 mV × gain`; gain 0.65 chosen as the smallest value driving MN9 robustly while Kenyon cells stay silent, with runaway excitation documented at 0.75 — KCs firing at 39 Hz and grooming DNs shut down), per-table commands and seeds, and an honestly labeled olfaction limitation: their antennal-lobe PNs saturate (~134 Hz mean from a 40 Hz input), descending neurons show a diffuse ~9 Hz with **no clear steering signal**, so odor-directed walking is handled by a hand-built reflex layer. Absolute firing rates are explicitly marked untrustworthy.

**flybench.** A community behavioral benchmark for whole-brain fruit-fly connectome simulations: pre-registered, cited behavioral tasks on FlyWire v783 and MaleCNS, shuffled-wiring controls, and a reference LIF implementation — i.e. cross-graph, control-included evaluation rather than single-demo anecdotes.

**What this note adds.** (i) A **bidirectional causal intervention** on the sign table: the upstream record documents one package's behavior on one graph; we isolate a single packaging rule and show sufficiency *and* necessity across two graphs (§3). (ii) A **cross-package audit method**: rebuild from source under a changed rule with an equivalence self-check (2,698,236 edges, zero mismatches) before trusting the variant. (iii) A **fully frozen public pipeline**: every number in this note regenerates from one command per row (§7), including probes the upstream record leaves qualitative (reference-gain failure, lateral readout bias, gain dependence). Where we converge with the upstream record — weak or absent odor→DN steering, a gain cliff into runaway excitation, and the need for per-dataset calibration — the convergence is itself evidence that these are packaging- and model-level phenomena, not demo-specific accidents.

## 5. Methodological recommendations (for the "dynamics on connectomes" community)

1. **Run a per-dataset propagation test and publish the working point *and* the sign table.** There is no universal gain constant (3.0 vs 4.0 here), no universal sign convention (§2.2), and reference-gain global-max silently fails on both packages we tested (§1.1-P1). A silent network at reference settings is the default outcome, not a bug in your stimulus.
2. **Calibrate readout pools against a slow baseline and disclose the bias** — if bilateral pools respond equally to both sides, "steering" is cosmetic (§1.1-P2); report the bias magnitude and the readout heuristic used.
3. **Validate high-variance behavioral metrics out-of-sample**, disclose which seeds selected and which evaluated, and disclose first-eat-style "successful episodes only" statistics (§1.1-P3).
4. **Disclose explicit motor/game rules.** A closed loop can look brain-driven while scripted rules do the walking (§1); name them.
5. **Treat absolute firing rates as untrustworthy** (echoing the upstream record): report differences between stimulated and unstimulated conditions and orderings between pathways, not absolute values.

## 6. Limitations and open questions

Point LIF neurons without conductances, delays, neuromodulation, or plasticity; no gap junctions; transmitter signs from prediction pipelines with package-specific sign rules that materially change dynamics (§2.2, §3); two individuals (one female FAFB, one male MaleCNS) with different packaging pipelines; FlyWire has no ventral nerve cord, and even on MaleCNS we do not simulate real gait; the game contains explicit motor rules (§1); per-dataset stimulus gains are acknowledged level design; probe conditions are single deterministic trajectories, and the level-design seed set doubles as its evaluation set (§1.1-P3). None of this claims biological fidelity, let alone "uploading".

Open questions, ordered:

1. **Decisive test for the readout-bias attribution**: on the *same* FlyWire data, re-pool the descending population under alternative rules (hemispheric relabeling, ascending-excluded, native-side annotations) and re-measure the unilateral-stimulus contrast.
2. **BANC replication** of the reference-gain failure and of the sign-intervention protocol, with each packaging's sign table published alongside.
3. **Named-DN readouts**: which specific descending types restore steering contrast without any baseline heuristic, on either dataset?
4. **Gain stability**: does the 10× global-max regime yield usable dynamics or merely move the failure threshold?

## 7. Reproducibility

All numbers in this note were produced on this repository (Node v24, Python 3.13, Windows; CPU-only; minutes), **except where a row is explicitly marked as a historical record**. Commit lineage: v1 measurements @ `d92807b`; v2 probes @ `73da541`; v3–v4 scripts & experiments @ `63c54ca` / `709b188`; v4.1 @ `80a4768`; this revision: see the header (placeholder to be filled on commit). Vendor data acquisition with pinned commits and SHA-256 checksums: `game/tools/fetch_vendor_data.md`. Probe batteries are frozen as scripts (`probe_flywire.mjs`, `probe_malecns.mjs`, `probe_gain.mjs`, `probe_signflip.mjs`, `probe_supplementary.mjs`, `reproduce_sweeps.mjs`); key per-run outputs are archived under `game/docs/results/` with the producing command in each file's header. Timing fields (ms/tick) fluctuate with machine load and are not bit-stable; all spike counts are.

| number(s) | command |
|---|---|
| FlyWire propagation (47,106 / 35,159 central); N/E counts | `node game/test/sim.test.mjs` |
| FlyWire weight distribution; reference-gain failure; targetInput sweep; bias table | `node game/tools/probe_flywire.mjs` (archive: `docs/results/probe_flywire.txt`) |
| gain ×1/×10 retest, both datasets (16 / 131+13 central) | `node game/tools/probe_gain.mjs` (archive: `docs/results/probe_gain.txt`) |
| FlyWire pools generation | `python game/tools/prepare_pools.py` |
| MaleCNS three-file conversion | `python game/tools/flyb_to_bin.py` |
| MaleCNS probes 1–4 | `node game/tools/probe_malecns.mjs` (archive: `docs/results/probe_malecns.txt`) |
| MaleCNS GLUT-excitatory variant build | `python game/tools/flyb_to_bin.py --glut-excitatory` |
| FlyWire GLUT-inhibitory rebuild + equivalence self-check | `python game/tools/build_flywire_variant.py` |
| sign-flip bidirectional probe | `node game/tools/probe_signflip.mjs` (archives: `docs/results/probe_signflip.txt`, `docs/results/signflip_flywire.txt`) |
| MaleCNS feeding/escape/ascending probes | `node game/tools/probe_supplementary.mjs` (archive: `docs/results/probe_supplementary.txt`) |
| FlyWire closed loop (seed 7: first eat 34.8 s, score 2/120 s) | `node game/tools/headless_run.mjs 120 '{}' 7 flywire` |
| MaleCNS closed loop (score 1, first eat 104.3 s) | `node game/tools/headless_run.mjs 180 '{}' 7 malecns` |
| sweep rounds 1–2 (historical default restored) | `node game/tools/tune_sweep.mjs '<grid JSON with "bananaMaxDist":[null]>'` |
| champion config, historical default restored (3.00; 2.20 under current default) | `node game/tools/tune_sweep.mjs '{"turnGain":[1.8],"emaTau":[5],"baseSpeed":[6],"bananaMaxDist":[null]}'` |
| out-of-sample & level-design comparisons + champion out-of-sample (8/10, 57.7 s, 1.30) | `node game/tools/reproduce_sweeps.mjs` (archive: `docs/results/reproduce_sweeps.txt`) |

Notes on exactness. `"bananaMaxDist":[null]` in the sweep commands explicitly restores the historical unbounded spawn distance (`null`→∞ in `harness.mjs`). Seeded runs use an injectable LCG replacing `Math.random`; episodes call `sim.reset()` between runs. Headless runs are not real-time throttled. Honest reuse note: seeds 101–110 served both for selecting `bananaMaxDist` and for evaluating it; first-eat statistics count successful episodes only. One row is a **historical record not rebuilt by script**: the 350 px no-effect comparison (configuration documented in the `game/README.md` tuning log); every other number in the tables above is reproduced by the listed commands today.

## Appendix A. Correction history (chronology, condensed)

The review-driven corrections, in order, each with its disposition. Full point-by-point detail: `docs/REVIEW-RESPONSE.md`.

- **v2 → v3 (first review).** Finding 1 scoped to reference gain (gain ×10 retest: 16/131 central); Shiu misattribution corrected (postsynaptic L1 is this project's scheme, not Shiu's `w_syn`); "no hand-crafted behavior layer" claim replaced by the explicit-rules list; Finding 2 attribution downgraded to hypothesis; statistical disclosures added (pool asymmetry 1,090/1,549; single deterministic trajectories; lateral difference corrected to 9.49 percentage points); reproducibility entries frozen into scripts and `docs/results/`; seed-reuse disclosure.
- **v3 → v4 (second review).** Histamine sign-table correction (v3's "both inhibitory" was wrong; v4's interim "default +1, photoreceptors affected" was also wrong — see v4.1); FlyWire reverse sign-flip experiment added (necessity), with equivalence self-check; frozen `probe_gain.mjs` / `probe_signflip.mjs`; explicit-seed closed-loop records (34.8 s); historical sweep commands given explicit `"bananaMaxDist":[null]`; vendor acquisition doc with SHA-256.
- **v4 → v4.1 (third review, "minor revisions").** Histamine account corrected to the six-class-labels evidence (no histamine class in FlyWire's prediction; no inference about real histaminergic signing); reverse-experiment precision (source-table re-aggregation wording; scope note 517/77,650/23,905; "sufficient and necessary" restricted to ti=4, I=1, 200 ticks, GLUT ±); two final frozen reproduction entries (`probe_supplementary.mjs`, `reproduce_sweeps.mjs`); "asymptote" wording replaced by 100-tick observed maxima; §4.2 fast-search comparison written out in full.
- **v4.1 → v5 (fourth review, this restructure).** FlyWire license corrected to CC BY-NC 4.0 per the official guidelines (earlier CC BY-NC-SA 4.0 was an assumption); note restructured around the packaging-choices mainline with correction chronology moved here; precedent-comparison section added; boundary statement for the causal claim added; Fandol fonts for the LaTeX source.

## References

- Bates, A. S., Phelps, J. S., et al. (2026). Distributed control circuits across a brain-and-cord connectome. *Nature*. https://doi.org/10.1038/s41586-026-10735-w
- blendi-remade/fly-brain-minecraft (2026). Minecraft mod driven by the MaleCNS connectome; source of the FLYB v1 binary packaging of neuPrint male-cns:v1.0 used here, and of the validation record (`docs/VALIDATION.md`) discussed in §4. https://github.com/blendi-remade/fly-brain-minecraft (MIT)
- brandoncho369/flybench (2026). Behavioural benchmark for whole-brain fruit fly connectome simulations: pre-registered, cited behavioural tasks on FlyWire v783 and MaleCNS with shuffled-wiring controls and a reference LIF implementation. https://github.com/brandoncho369/flybench (MIT)
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

*Community context: written against the backdrop of the 2026 "flyslop" demo wave (indexed at awesome-fly and Fly Brain Hub, https://fly-brain-hub.vercel.app/) and community validation efforts such as flybench. v3–v5 were revised in response to four rounds of external methodological review; the point-by-point response letter is `docs/REVIEW-RESPONSE.md`.*
