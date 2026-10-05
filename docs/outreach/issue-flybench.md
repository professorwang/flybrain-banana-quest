<!--
DRAFT — not posted. Post at https://github.com/brandoncho369/flybench/issues/new (issues are enabled;
discussions are not). Their CONTRIBUTING asks tasks to go through an RFC; this is a control/feature
proposal, so an issue is the right first step. Maintainer: Brandon Cho. Repo is active (pushed 2026-09-24).
Before posting: push master; decide whether to mention the author's own l1_lif port (see note at bottom).
-->

**Title:** Proposal: a transmitter-class sign control with mass-matched randomization (complements `signflip`)

Hi, thanks for flybench — the negative-controls design (`docs/CONTROLS.md`) is what made us want to ask this.

**Gap.** `signflip` permutes signs among neurons and keeps the inhibitory fraction, which is the right control for "does this task depend on inhibition". It can't answer a different question that comes up when two connectome packages differ in one sign convention (e.g. glutamate −1 in your reference model and in the MaleCNS FLYB bundle, +1 in the snedea FlyWire package): *is a result driven by that transmitter class specifically, or by the amount of excitatory/inhibitory synaptic mass that changed sign?*

**What we did, in our own discrete-tick LIF core (not the flybench reference LIF; not yet run through flybench).** We flip the sign of one transmitter class and compare with controls that flip other classes, matched on (a) functional group and (b) total synaptic mass, with the mass capped so a control can never flip more than the target (details and all numbers: `game/docs/results/probe_controls.txt`, sections E1, E1b, E2). Findings that mattered:
- On FlyWire, flipping the glutamate rule removes a whole-brain high-activity regime (visual-lobe spikes 405,788 → 0), but mass-matched controls from other classes remove it too (median 128). Without the control one would have concluded the effect was glutamate-specific.
- On MaleCNS the same comparison does show glutamate-specificity under our L1 weight normalization, and it **disappears** under a fixed per-synapse weight. So the conclusion depended on a second modelling choice.
- Dose-response (flipping a random fraction of the class) separates threshold-like from graded behaviour.

**Proposal.** An optional control, e.g. `--controls ntflip:glutamate`, that (1) flips the named class and (2) runs mass-matched, group-matched random controls from the other classes (several seeds) and reports `specificity` the same way `rewired` does. If that fits your scope I can send a PR including a short section in `docs/CONTROLS.md`. If you'd rather keep controls to the current three, a note in CONTROLS.md about what `signflip` does *not* test would also be useful.

**Questions.**
1. Is a transmitter-class control within scope, or would you want it as an RFC?
2. Would you want it implemented against `reference_lif` so results are comparable with leaderboard rows?

Caveat: our numbers come from a different, simpler simulator, so I'd treat them as motivation rather than evidence about the reference LIF. Code: https://github.com/professorwang/flybrain-banana-quest (MIT; FlyWire data CC BY-NC, MaleCNS data CC BY). Technical note: https://doi.org/10.5281/zenodo.22998484 (revision v6.1 in preparation).

*Disclosure: the analysis and this text were prepared with AI assistance (Claude); I reviewed them and take responsibility for the content.*

<!--
NOTE FOR THE AUTHOR (delete before posting): game/docs/flybench-report.md reports an l1_lif port scoring
below the reference baseline, plus a sign-related observation on task 11. That report has NOT been audited
against its raw outputs, so this draft deliberately does not cite it. If you want to mention it, audit the
numbers first.
-->
