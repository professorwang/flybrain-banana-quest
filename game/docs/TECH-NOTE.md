# Packaging choices change connectome-simulation outcomes: transmitter sign tables, matched controls, and weight-scheme dependence in two fly connectomes

**Technical note v6.0, 2026-09-27. Yang Wang (Fortune AI; wangglenwang@gmail.com). Code, data and frozen scripts: https://github.com/professorwang/flybrain-banana-quest (code MIT; FlyWire FAFB v783 data CC BY-NC 4.0; MaleCNS v1.0 data CC BY 4.0); this version is archived as repository release `v0.6.0`. v6.0 adds matched controls, an equal-mass identity test, dose-response and a second weight scheme (§3.2–3.5); they withdraw the "sufficient and necessary" framing of v5.1 (revision history: end of §7). LaTeX source: `docs/arxiv/main.tex`.**

## 中文摘要

本文追问："在连接组上跑动力学"的仿真结论，有多少是由数据加工选择而非连接组本身决定的？我们用同一个 LIF 内核在两个社区封装的真实连接组（FlyWire FAFB v783：139,255 神经元；MaleCNS v1.0：176,422 神经元）上测量。两个包对谷氨酸的赋号相反（兴奋 vs 抑制），只翻转这一条规则就能双向切换一个全脑高活动态（FlyWire 视叶放电 405,788→0；MaleCNS 2→553,863）。v6 检验这一翻转到底隔离了什么：逐字节等价重建确认变体无误；质量匹配的随机对照（翻转其他递质类别、突触质量不超过谷氨酸规则）同样消除 FlyWire 的高活动态（405,788→1–128），说明该效应在那里不是谷氨酸特异的；在逐组突触质量完全相同时，MaleCNS 的点燃只出现在谷氨酸翻转（279,054 vs 108）。剂量-反应陡峭且有阈值（翻转 25% 的谷氨酸质量即去掉 FlyWire 98.7% 的视叶活动；MaleCNS 在 75%–90% 之间点燃）。把本项目的 postsynaptic L1 归一化换成每突触固定系数后，符号效应方向不变（Shiu 匹配量级下 22–29 倍），但从全有全无变为梯度，MaleCNS 上谷氨酸的特异性也随之消失甚至反转。参考实现的全局 max 归一化之所以完全不传播，是因为其每突触权重比 Shiu 匹配量级低约 100–170 倍。结论：谷氨酸规则之所以重要，首先因为它是两个包分歧最大的一块突触质量；关于特定递质类别的论断需要质量匹配对照和第二种权重方案。全部结果是模型内的，不能推导真实果蝇生物学；每个数字都可由冻结脚本复现。

## Abstract

How much of what "dynamics on a connectome" simulations show is set by data-packaging choices rather than by the connectome? We probe one leaky integrate-and-fire core on two community packages of real fly connectomes (FlyWire FAFB v783, 139,255 neurons; MaleCNS v1.0, 176,422 neurons). The packages sign glutamate oppositely, and flipping that one rule switches a whole-brain high-activity regime in both directions (FlyWire visual-lobe spikes 405,788 → 0; MaleCNS 2 → 553,863). We then test what the flip isolates. Byte-identical rebuilds confirm the variants. Mass-matched random flips of other transmitter classes also abolish the FlyWire regime (405,788 → 1–128), so there it is not glutamate-specific; at equal per-group synaptic mass, MaleCNS ignites only under glutamatergic flips (279,054 vs 108). Dose-response is steep: flipping 25% of the glutamate mass removes 98.7% of FlyWire visual activity, and MaleCNS ignites between 75% and 90%. Replacing our postsynaptic L1 normalization by a fixed per-synapse weight keeps the direction of the sign effect (22–29× at a Shiu-matched scale) but makes it graded, and the MaleCNS glutamate specificity disappears or reverses. The reference global-max normalization, which propagates nothing, uses per-synapse weights about 100–170× below that scale. The glutamate rule matters first because it is the largest block of synaptic mass on which packages disagree; claims about specific transmitter classes need mass-matched controls and a second weight scheme. All results are model-internal and license no inference about fly biology; every number regenerates from frozen scripts.

## 1. Background and question

Banana Quest (电子果蝇·香蕉大作战) is a zero-dependency browser game in which a leaky integrate-and-fire (LIF) network running on a real connectome helps drive a 2D foraging fly. The question this note is organized around is not "does the fly move" but: **when a community takes a published connectome, packages it, and runs off-the-shelf dynamics on it, which conclusions are set by the packaging choices rather than by the connectome itself?** Recent work shows that connectivity only partially constrains dynamics (Beiran & Litwin-Kumar 2025); here we ask the practical version of that question for the browser- and game-scale simulations that now circulate widely (awesome-fly). Our testbed is two independent packages of two different connectomes, probed through one simulation core (`src/sim-core.js`, browser worker and Node.js alike):

- **FlyWire FAFB v783** (Zheng et al. 2018; Dorkenwald et al. 2024; Schlegel et al. 2024; 139,255 neurons, 2,698,236 aggregated connections, brain only, female), packaged by snedea/flybrain (MIT) as a 12.4 MB binary with a 63-group annotation; transmitter labels come from synapse-level prediction (Eckstein et al. 2024);
- **MaleCNS v1.0** (Berg et al. 2026; 176,422 neurons, 6,287,749 connections at ≥5 synapses, full male CNS with ventral nerve cord), taken from fly-brain-minecraft's FLYB v1 bundle (MIT) and converted by our `tools/flyb_to_bin.py` into the same format with 26 groups and native-annotation pools.

Throughout, **"the reference implementation" means snedea/flybrain's browser simulator**, whose weight scheme we inherited; it is *not* the model of Shiu et al. (2024), which propagates activity well at its own parameters. The game context matters only as motivation: connectome spiking participates in steering and feeding gating, **and** the game contains explicit motor rules (standby random walk, approach deceleration and stopping, scripted escape maneuver, wall bounce, scripted hunger wiring, hand-designed sensor mappings and pool selections). Unlike embodied models (Wang-Chen et al. 2024), we simulate no gait.

### 1.1 Precursor findings (compressed)

**P1 — the weight scale decides whether anything propagates.** The reference implementation divides every weight by the global maximum and multiplies by 0.15. With a heavy-tailed synapse-count distribution (max 2,405 on FlyWire, 2,591 on MaleCNS; median 8), this gives 6.2e-5 / 5.8e-5 threshold units per synapse. For orientation, matching Shiu et al.'s parameters (0.275 mV per synapse, 5 ms synaptic and 20 ms membrane time constants, 7 mV from rest to threshold) to our discrete core under a 1 tick ≈ 1 ms reading gives 0.006 (peak-matched) to 0.010 (time-integral-matched) — about **100–170× larger**. Unsurprisingly, driving the left olfactory pool at 0.5 for 100 ticks under global-max produced zero central spikes on both datasets (100-tick observed maximum voltages 0.780 / 0.977), and even 10× gain (still 10–17× below the Shiu-matched scale) produced only 16 / 131 central spikes. The failure is a scale mismatch, not a property of either connectome. The game instead uses **postsynaptic L1 normalization** (each neuron's total absolute input scaled to `targetInput`, "ti"), our engineering choice, whose working point is dataset-dependent (ti = 3.0 FlyWire / 4.0 MaleCNS).

**P2 — coarse bilateral readouts can carry structural bias.** Our FlyWire descending readout (GNG_DESC split by soma-x median, 1,791/1,790) fires the right pool more under *either* unilateral antennal stimulus (1,704 vs 2,106 left-stim; 1,633 vs 2,133 right-stim): the right pool carries 24–31% more spikes, while the left pool's share moves by only 1.4 percentage points between stimulus sides (44.7% vs 43.4%). We steer on a heuristic high-pass readout (deviation from a τ = 5 s EMA baseline), with no claim that it removes the bias.

**P3 — small-seed sweeps overfit.** A 5-seed sweep crowned `turnGain = 1.8` (median first-eat 26.4 s, score 3.00); on 10 out-of-sample seeds it collapsed (8/10, median 57.7 s, score 1.30), worse than the default on the same seeds (10/10, 49.6 s, 2.70). What improved performance on the tested seeds was level design (banana spawn ring 150–250 px, median 27.3 s). First-eat statistics count successful episodes only; seeds 101–110 served both selection and evaluation; the champion's 3.00 requires the historical unbounded spawn distance (`"bananaMaxDist":[null]`; 2.20 under today's default).

## 2. What the two packagings change

**Both are ≥5-synapse filtered.** Unsigned aggregation of the FlyWire source table yields 2,700,513 neuron pairs, none below 5 synapses; 2,277 pairs whose signed weights cancel to exactly zero are dropped, giving the binary's 2,698,236 edges. The MaleCNS bundle is thresholded at ≥5 synapses and drops autapses.

**The transmitter sign tables differ.**

| transmitter | FlyWire package (snedea `NT_SIGN`) | MaleCNS package (fly-brain-minecraft) |
|---|---|---|
| acetylcholine | +1 excitatory | +1 excitatory |
| glutamate | **+1 excitatory** | **−1 inhibitory** |
| histamine | not a predicted class | −1 inhibitory (8,021 labeled neurons) |
| GABA | −1 inhibitory | −1 inhibitory |
| monoamines (DA/OA/5-HT) | +1 excitatory | +1 excitatory |

The FlyWire source table (3,869,878 rows, one per neuron pair and neuropil) carries exactly six labels — ACH, GABA, GLUT, DA, SER, OCT — with no histamine class and no empty labels, so nothing can be inferred about how real histaminergic neurons are signed in that package. Labels are assigned **per connection row**, not per neuron: 9.1% of all synapses carry a row label that differs from the presynaptic neuron's overall label (19,658 neurons have no overall label). The glutamate rule therefore acts on 654,183 rows carrying 5,646,373 synapses from 51,185 presynaptic neurons, although only 19,605 neurons are labeled glutamatergic overall. In MaleCNS, signs are set per presynaptic neuron: 29,763 glutamatergic neurons (−1, 14,552,047 output synapses), 22,248 GABAergic and 8,021 histaminergic. Shiu et al. likewise treat glutamate as inhibitory. Other differences remain: sex, VNC (absent/present), individual, and packaging pipeline.

**Same normalization structure, drifting working point.** Under L1 normalization and olfactory drive (I = 1.0, 200 ticks) both datasets show layered reachability, with dataset-specific onsets:

| ti | FlyWire (200 ticks) | MaleCNS (200 ticks) |
|---|---|---|
| 1.0 | MB_KC 2,544, GNG_DESC 0 | MB_KC 148, DN 0 |
| 2.0 | MB_KC 57,446, GNG_DESC 10 | MB_KC 37,237, DN 0 |
| 3.0 | GNG_DESC 3,810; stable over 500 ticks of maximal bilateral input | DN 11; VIS_OL 0 |
| 4.0 | whole-brain high activity (VIS_ME 405,788, zero visual input) | DN 75; VIS_OL 2 (no ignition) |

## 3. The glutamate sign intervention and its controls

All probes in this section use L1 normalization, the left olfactory pool at I = 1.0 for 200 ticks, and report total spikes, the descending group (FlyWire GNG_DESC, MaleCNS DN) and the visual group (FlyWire VIS_ME, 82,318 neurons; MaleCNS VIS_OL, 89,403 neurons). Runs are deterministic; randomness enters only through sampling seeds.

### 3.1 The bidirectional intervention (v5 result, re-verified)

We rebuilt each graph with only the glutamate rule flipped: MaleCNS glutamatergic neurons −1 → +1; FlyWire GLUT rows +1 → −1, re-aggregated from the source table (through changed cancellation 1,208 edges drop out and 1,725 appear; 489,481 shared edges change weight, 411,831 in sign only and 77,650 also in magnitude; 23,905 L1 denominators change). Two new checks back the rebuilds. **(E0a)** An independent in-memory rebuild reproduces the shipped FlyWire binary and both published variants *byte for byte*. **(E0b)** The simulator skips inactive neuron groups for speed and clears residual voltage after 20 silent ticks; disabling this gating leaves all eight rows below unchanged, spike for spike.

| graph | ti | total spikes | descending | visual |
|---|---|---|---|---|
| FlyWire standard (GLUT +) | 3 | 447,219 | 3,810 | 2,860 |
| FlyWire standard (GLUT +) | 4 | 1,265,998 | 25,730 | **405,788** |
| FlyWire GLUT − | 3 | 222,036 | 30 | 0 |
| FlyWire GLUT − | 4 | 291,831 | 113 | **0** |
| MaleCNS standard (GLUT −) | 3 | 235,638 | 11 | 0 |
| MaleCNS standard (GLUT −) | 4 | 331,336 | 75 | **2** |
| MaleCNS GLUT + | 3 | 492,145 | 1,025 | 41 |
| MaleCNS GLUT + | 4 | 1,797,262 | 19,004 | **553,863** |

v5.1 read this as "the glutamate sign assignment is sufficient and necessary". That reading does not distinguish glutamate from *any* comparable change in excitatory/inhibitory synaptic mass. §3.2–3.5 test it.

### 3.2 Matched random controls (E1)

For every glutamate unit (FlyWire: a presynaptic neuron with ≥1 GLUT row, flipped mass = its GLUT-row synapses; MaleCNS: a glutamatergic neuron, flipped mass = its output synapses) we draw, without replacement, a control unit of another transmitter class and flip it in the same direction. FlyWire controls are neurons labeled ACH/DA/SER/OCT whose excitatory rows become inhibitory; MaleCNS controls are GABAergic or histaminergic neurons that become excitatory. **C-match** pairs within the same functional group and log2 mass bin; **C-rand** matches the mass bin only (random location). Both are then **mass-capped**: units are removed at random until the control's flipped synaptic mass does not exceed the glutamate rule's (per group for C-match, in total for C-rand), so controls can only be weaker. Ten seeds each; median [min–max]; mass relative to the full glutamate rule.

| dataset | variant (ti = 4) | mass | total | descending | visual |
|---|---|---|---|---|---|
| FlyWire | standard | — | 1,265,998 | 25,730 | 405,788 |
| FlyWire | glutamate rule (+ → −) | 1.00 | 291,831 | 113 | 0 |
| FlyWire | C-match | 0.89 | 315,520 | 176 [97–237] | 128 [32–188] |
| FlyWire | C-rand | 1.00 | 163,388 | 17 [10–30] | 1 [0–28] |
| MaleCNS | standard | — | 331,336 | 75 | 2 |
| MaleCNS | glutamate rule (− → +) | 1.00 | 1,797,262 | 19,004 | 553,863 |
| MaleCNS | C-match | 0.91 | 504,361 | 276 [232–2,199] | 108 [84–194] |
| MaleCNS | C-rand | 1.00 | 1,750,533 | 31,676 [24,046–34,081] | 164,079 [120,671–176,649] |

On FlyWire, every control abolishes the visual regime (405,788 → ≤188), so the suppression needs *an* inhibitory block of this size, not glutamate in particular. On MaleCNS, location-random controls ignite the visual lobe (164,079) but group-matched controls do not (108), although the group-matched control carries 0.91 of the glutamate mass — close to the ignition threshold (§3.4), and the group-matched pool lacks partners for some glutamate units, leaving per-group deficits. §3.3 removes both issues.

### 3.3 Equal-mass identity test (E1b)

To separate transmitter identity from mass, we draw a random fraction φ of the glutamate units, pair a C-match control to that subset, then trim the glutamate subset group by group to the control's achieved mass. The two sets then have (near-)identical per-group masses and differ only in which neurons they contain. We compare at doses where the response is graded rather than saturated (ti = 4, ten seeds; G = glutamate subset, C = control).

| dataset | φ | mass, G / C | visual, G | visual, C | descending, G / C |
|---|---|---|---|---|---|
| FlyWire | 0.10 | 0.094 / 0.095 | 229,078 | 277,856 | 15,831 / 20,000 |
| FlyWire | 0.25 | 0.235 / 0.236 | 4,658 | 11,731 | 4,389 / 7,891 |
| MaleCNS | 0.90 | 0.845 / 0.847 | 7,557 [4,220–169,724] | 87 [66–107] | 5,050 / 230 |
| MaleCNS | 1.00 | 0.902 / 0.903 | 279,054 [263,176–298,195] | 108 [83–190] | 14,972 / 300 |

At equal mass, FlyWire glutamate rows suppress somewhat more than matched excitatory rows (at φ = 0.25, 4,658 vs 11,731 visual spikes; the control's range reaches 191,896), a moderate difference in potency on top of a generic effect. On MaleCNS the difference is categorical: glutamatergic flips ignite the visual lobe and matched GABA/histamine flips never do in 20 runs.

### 3.4 Dose-response (E2)

Flipping a random fraction f of the glutamate units (ti = 4, five seeds, median visual spikes):

| f | 0 | 0.10 | 0.25 | 0.50 | 0.75 | 0.90 | 1 |
|---|---|---|---|---|---|---|---|
| FlyWire VIS_ME (+ → −) | 405,788 | 171,928 | 5,472 | 114 | 5 | 0 | 0 |
| MaleCNS VIS_OL (− → +) | 2 | 5 | 12 | 25 | 1,027 | 301,846 | 553,863 |

FlyWire suppression is steep (25% of the glutamate mass removes 98.7% of visual activity); MaleCNS ignition is threshold-like, between 75% and 90%. The v5 "all-or-nothing" picture is the saturated end of these curves.

### 3.5 A second weight scheme (E3)

We replaced L1 normalization by a fixed per-synapse weight ("linear": signed synapse count × `synScale`, no per-neuron rescaling — the same class of scheme as Shiu et al.'s, though our core has no synaptic kinetics, delays or Poisson input and is not their model) and swept `synScale` from 0.0025 to 0.04 (visual spikes, 200 ticks):

| synScale | 0.0025 | 0.005 | 0.01 | 0.02 | 0.04 |
|---|---|---|---|---|---|
| FlyWire standard (GLUT +) | 16 | 13,395 | 105,855 | 365,059 | 1,006,037 |
| FlyWire GLUT − | 5 | 148 | 3,691 | 42,815 | 263,167 |
| MaleCNS standard (GLUT −) | 68 | 3,284 | 22,694 | 133,986 | 298,902 |
| MaleCNS GLUT + | 3,894 | 83,678 | 502,612 | 1,545,649 | 4,236,355 |

Descending neurons are reached on both datasets throughout the Shiu-matched range (at 0.01: FlyWire 42,446, MaleCNS 8,181 descending spikes), with no dataset-specific working point. The direction of the sign effect survives at every scale (≥3.8× from 0.005 upward; 29× on FlyWire and 22× on MaleCNS at 0.01), but it is graded: nothing drops to zero, and no sharp ignition appears. Repeating the controls at `synScale` = 0.01 (five seeds):

| dataset | test | mass (glut / control) | visual, glutamate | visual, control |
|---|---|---|---|---|
| FlyWire | C-match vs full rule (E3b) | 1.00 / 0.89 | 3,691 | 17,931 |
| FlyWire | equal mass, φ = 0.5 (E3c) | 0.460 / 0.461 | 40,583 | 69,340 |
| FlyWire | equal mass, φ = 1.0 (E3c) | 0.888 / 0.889 | 5,903 | 21,593 |
| MaleCNS | C-match vs full rule (E3b) | 1.00 / 0.91 | 502,612 | 1,106,515 |
| MaleCNS | equal mass, φ = 0.5 (E3c) | 0.494 / 0.494 | 123,061 | 121,360 |
| MaleCNS | equal mass, φ = 1.0 (E3c) | 0.902 / 0.905 | 356,179 | 1,017,489 |

Under linear weights, FlyWire glutamate rows again suppress more than equal-mass excitatory rows (1.7–3.7× fewer residual visual spikes), matching the moderate potency difference seen under L1. On MaleCNS the L1 identity effect disappears: at equal mass, the GABA/histamine control drives as much visual activity as glutamate at φ = 0.5 (121,360 vs 123,061) and 2.9× more at φ = 1.0 (1,017,489 vs 356,179). The categorical MaleCNS specificity of §3.3 is therefore a property of L1 normalization, not of the glutamatergic population as such.

### 3.6 What the intervention does and does not show

**Robust across both datasets and both weight schemes:** the packaging rule for glutamate changes simulated whole-brain activity in a consistent direction, and a browser package that signs glutamate excitatory (contrary to Shiu et al. and to the MaleCNS package) runs in a different dynamical regime because of it. **Not supported:** that glutamate is "sufficient and necessary" in any specific sense. On FlyWire, any inhibitory block of comparable mass suppresses the regime; the all-or-nothing phenotype is specific to L1 normalization; and whether glutamatergic neurons are special beyond their mass depends on dataset and weight scheme (categorical on MaleCNS under L1, absent or reversed on MaleCNS under linear weights, and moderate on FlyWire under both, where equal-mass glutamate flips leave 1.2–3.7× fewer residual visual spikes). The glutamate rule matters first because it is the largest block of synaptic mass on which the packages disagree (5.6 million FlyWire synapses; 14.6 million MaleCNS synapses). **Boundary:** these are results about sign conventions inside a point-neuron model; whether glutamate excites or inhibits at a given synapse in the animal is a physiological question that no network perturbation here can answer.

## 4. Related validation work, and what this note adds

The fly-brain-minecraft validation record (`docs/VALIDATION.md`) keeps a silent-brain check, a sugar→MN9 feeding bench reproducing the published pathway (Shiu et al. 2024), a gain sweep on Shiu's fixed per-synapse scheme (gain 0.65 chosen, runaway at 0.75), per-table commands and seeds, and an honestly labeled olfaction limitation (saturating projection neurons, no clear descending steering signal, a hand-built reflex layer), and marks absolute firing rates as untrustworthy. flybench offers pre-registered behavioral tasks on FlyWire v783 and MaleCNS with shuffled-wiring controls and a reference LIF implementation. Descending and ascending pathways have been compared across FlyWire, MANC and FANC (Stürner et al. 2025), and a brain-and-cord connectome (BANC) now exists (Bates et al. 2026).

**What this note adds.** (i) An **audit protocol for packaging rules**: equivalence-checked rebuilds from source, mass-capped matched random controls, an equal-mass identity test, dose-response, and a second weight scheme — each of which changed or narrowed a conclusion here. (ii) A concrete, checkable packaging discrepancy (the glutamate sign in a widely used browser package) and its quantified dynamical consequences. (iii) A scale diagnosis of the reference global-max failure. (iv) A frozen public pipeline in which every number regenerates from one command (§7). Where we converge with the upstream record — weak odor→descending steering, a gain cliff into runaway excitation, per-dataset calibration — the convergence suggests model- and packaging-level phenomena rather than demo-specific accidents.

## 5. Methodological recommendations

1. **Publish the sign table, the weight scheme and the effective weight per synapse**, and run a propagation test; a scheme that is two orders of magnitude below a physiological scale will look like a silent brain (§1.1-P1).
2. **Before attributing an effect to a transmitter class or a packaging rule, run mass-matched random controls** (location-matched and location-random, mass-capped), an equal-mass identity test and a dose-response (§3.2–3.4).
3. **Repeat key results under a second weight scheme**; all-or-nothing phenotypes can be normalization artifacts (§3.5).
4. **Calibrate readout pools against a slow baseline and disclose the bias** (§1.1-P2).
5. **Validate high-variance behavioral metrics out-of-sample**, and say which seeds selected and which evaluated (§1.1-P3).
6. **Disclose explicit motor/game rules**, and **treat absolute firing rates as untrustworthy** (fly-brain-minecraft).

## 6. Limitations and open questions

Point LIF neurons without conductances, synaptic kinetics, delays, neuromodulation, plasticity or gap junctions; transmitter signs from prediction pipelines; two individuals of different sex with different packaging pipelines; no VNC on FlyWire and no gait on either; explicit game rules (§1). The controls use one stimulus, 200 ticks and our own functional groups (63 FlyWire / 26 MaleCNS) with log2 mass bins; units without a partner in their stratum are left unflipped (FlyWire 9,769 and MaleCNS 11,230 of the full sets), which the mass cap and the equal-mass test address but do not remove; the MaleCNS control pool includes histaminergic photoreceptors. Seeds 101–110 of the game sweeps served both selection and evaluation (§1.1-P3). None of this claims biological fidelity, let alone "uploading".

Open questions: (1) repeat the sign-rule audit in Shiu et al.'s own model or flybench's reference implementation, with synaptic kinetics and Poisson input; (2) which glutamatergic sub-populations carry the MaleCNS identity effect under L1 normalization; (3) BANC replication; (4) re-pool the FlyWire descending readout by native side annotations or named descending types and re-measure the lateral contrast.

## 7. Reproducibility

All numbers were produced on this repository (Node v24, Python 3.13, Windows; CPU only; each script runs in minutes). Vendor data acquisition with pinned commits and SHA-256 checksums: `game/tools/fetch_vendor_data.md`. Per-run outputs are archived under `game/docs/results/` with the producing command in each file's header; timing fields fluctuate with load, spike counts are bit-stable. Commit lineage: v1 @ `d92807b`; v2 @ `73da541`; v3–v4 @ `63c54ca` / `709b188`; v4.1 @ `80a4768`; v5–v5.1 @ `5fc44b0` / `4811635`; v6.0 = release `v0.6.0`.

| number(s) | command |
|---|---|
| FlyWire propagation smoke test | `node game/test/sim.test.mjs` |
| P1 weight distribution, global-max failure, ti sweep, P2 bias table | `node game/tools/probe_flywire.mjs` |
| P1 gain ×1/×10 retest (16 / 131 central) | `node game/tools/probe_gain.mjs` |
| FlyWire pools; MaleCNS conversion | `python game/tools/prepare_pools.py`; `python game/tools/flyb_to_bin.py` |
| MaleCNS probes; ti table (§2) | `node game/tools/probe_malecns.mjs` |
| sign variants (§3.1) | `python game/tools/flyb_to_bin.py --glut-excitatory`; `python game/tools/build_flywire_variant.py` |
| bidirectional table (§3.1) | `node game/tools/probe_signflip.mjs` |
| source row and label counts (§2); intermediate tables for §3 | `python game/tools/export_sign_tables.py` |
| label/edge statistics (§2, §3.1); E0a, E0b, E1, E1b, E2 (§3.1–3.4) | `node game/tools/probe_controls.mjs` |
| E3, E3b, E3c; per-synapse scales (§1.1, §3.5) | `node game/tools/probe_linear.mjs` |
| MaleCNS feeding/escape/ascending probes | `node game/tools/probe_supplementary.mjs` |
| FlyWire closed loop (seed 7: first eat 34.8 s, 2 bananas / 120 s) | `node game/tools/headless_run.mjs 120 '{}' 7 flywire` |
| sweep round 1 (historical default restored) | `node game/tools/tune_sweep.mjs '{"turnGain":[2.6,4,6],"smellSigma":[130,250],"baseSpeed":[6,12],"bananaMaxDist":[null]}'` |
| sweep round 2 (historical default restored) | `node game/tools/tune_sweep.mjs '{"turnGain":[1.8,2.6],"emaTau":[5,20,40],"baseSpeed":[6,12],"bananaMaxDist":[null]}'` |
| champion (3.00; 2.20 under current default) | `node game/tools/tune_sweep.mjs '{"turnGain":[1.8],"emaTau":[5],"baseSpeed":[6],"bananaMaxDist":[null]}'` |
| P3 out-of-sample and level-design comparisons | `node game/tools/reproduce_sweeps.mjs` |

**Revision history.** v1–v5.1 (2026-09-18 to 09-27) were revised through several rounds of AI-assisted technical review with scripted re-verification; these were not peer review. Corrections included retracting an "unfiltered FlyWire" explanation, correcting the histamine sign-table description twice, correcting the FlyWire license to CC BY-NC 4.0, scoping the global-max failure to the reference gain, and replacing a "no hand-crafted behaviour layer" claim with the explicit-rules list. v6.0 adds §3.1–3.5 and withdraws the "sufficient and necessary" framing. Point-by-point record: `game/docs/REVIEW-RESPONSE.md`.

## Author contributions and AI-use disclosure

**Author**: Yang Wang (Fortune AI). The author directed the project, chose the research questions, reviewed the artifacts and takes responsibility for all content.

**AI use**: an AI coding assistant (Kimi Code) wrote most of the simulation and game code and drafted versions v1–v5.1 of this note under the author's direction. Claude (Anthropic) audited v5.1 and, under the author's direction, designed and implemented the v6.0 control experiments (`export_sign_tables.py`, `variants.mjs`, `probe_controls.mjs`, `probe_linear.mjs`) and revised the text. Codex and Claude performed the earlier technical reviews, including independent re-runs of the probe battery. No AI system is listed as an author; every number in this note comes from the frozen scripts listed above.

## References

- Bates, A. S., Phelps, J. S., Kim, M., et al. (2026). Distributed control circuits across a brain-and-cord connectome. *Nature* 656: 957–970. https://doi.org/10.1038/s41586-026-10735-w
- Beiran, M. & Litwin-Kumar, A. (2025). Prediction of neural activity in connectome-constrained recurrent networks. *Nature Neuroscience* 28: 2561–2574. https://doi.org/10.1038/s41593-025-02080-4
- Berg, S., Beckett, I. R., Costa, M., et al. (2026). Sexual dimorphism in the complete Drosophila male central nervous system connectome. *Cell* 189: 5504–5526.e15. https://doi.org/10.1016/j.cell.2026.08.015
- blendi-remade/fly-brain-minecraft (2026). Minecraft mod driven by the MaleCNS connectome; source of the FLYB v1 packaging of neuPrint male-cns:v1.0 used here and of the validation record `docs/VALIDATION.md`. https://github.com/blendi-remade/fly-brain-minecraft (MIT)
- brandoncho369/flybench (2026). Behavioural benchmark for whole-brain fruit fly connectome simulations. https://github.com/brandoncho369/flybench (MIT)
- cobanov/awesome-fly (2026). Community index of fly-brain demos, with fidelity disclaimers. https://github.com/cobanov/awesome-fly
- Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. (2024). Neuronal wiring diagram of an adult brain. *Nature* 634: 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. *Cell* 187: 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Schlegel, P., Yin, Y., Bates, A. S., et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. *Nature* 634: 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Shiu, P. K., Sterne, G. R., Spiller, N., et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. *Nature* 634: 210–219. https://doi.org/10.1038/s41586-024-07763-9 ; code: https://github.com/philshiu/Drosophila_brain_model
- snedea/flybrain (2026). Browser-based LIF simulation of the FlyWire connectome (data packaging, reference simulator; sign table in `scripts/build_connectome.py`). https://github.com/snedea/flybrain (MIT)
- Stürner, T., Brooks, P., Serratosa Capdevila, L., et al. (2025). Comparative connectomics of Drosophila descending and ascending neurons. *Nature* 643: 158–172. https://doi.org/10.1038/s41586-025-08925-z
- Wang-Chen, S., Stimpfling, V. A., Lam, T. K. C., et al. (2024). NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila. *Nature Methods* 21: 2353–2362. https://doi.org/10.1038/s41592-024-02497-y
- Zheng, Z., Lauritzen, J. S., Perlman, E., et al. (2018). A complete electron microscopy volume of the brain of adult Drosophila melanogaster. *Cell* 174: 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
