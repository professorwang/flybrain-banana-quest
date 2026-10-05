<!--
DRAFT — not posted. Post at https://github.com/snedea/flybrain/issues/new
Before posting: (1) push master so the links below resolve; (2) re-read once; (3) the author posts it
under their own account. Tone: informational, not "you are wrong". Expect a slow reply
(repo last pushed 2026-08-13; 2 open issues).
-->

**Title:** Document the neurotransmitter sign convention (GLUT = +1) and row-level sign assignment in `build_connectome.py`

Hi, thanks for packaging the FlyWire data and the simulator. We built a derived browser project on top of your data pipeline and, while auditing it, found two properties of `scripts/build_connectome.py` that change simulation outcomes. I don't think either is a bug; both are defensible choices. They are undocumented and differ from Shiu et al. 2024, so a short note in the README or code comments could save later users some confusion.

**1. Glutamate is signed excitatory (`NT_SIGN["GLUT"] = 1.0`).**
Shiu et al. 2024 assume glutamate is inhibitory by default (while noting it can act either way in *Drosophila*), and they report what happens if it is made excitatory instead (Methods, "Assessment of model robustness to parameters and assumptions"; Supplementary Table 11f). The MaleCNS FLYB package also signs it −1.

In our own discrete-tick LIF core (same leak 0.95 / threshold 1 / refractory 3 as your worker, L1-normalized weights; **not** your worker, I have not run this inside your app), rebuilding the FlyWire graph with only the GLUT rule flipped to −1 changes the visual-lobe response to an olfactory drive from 405,788 spikes to 0 over 200 ticks (`game/docs/results/probe_signflip.txt`).

Two caveats we checked, so this is not over-read:
- The effect is **not specific to glutamate**. Flipping an equal amount of synaptic mass from other transmitter classes also suppresses it (median 128 spikes with group- and mass-matched controls), so what matters is the size of the inhibitory block, not the label (`game/docs/results/probe_controls.txt`, sections E1 and E1b).
- It depends on the weight scheme: with a fixed weight per synapse instead of L1 normalization the effect is graded rather than all-or-nothing.

**2. Signs are applied per connection row, not per neuron.**
`edge_sums[(pre, post)] += syn_count * sign` uses the row's own `nt_type`, and rows are per neuropil. So one presynaptic neuron can drive targets with both signs. From the source table: 39,703 of 129,351 presynaptic neurons (30.7%) have output synapses of both signs, and 926,545 synapses (2.7%) carry the sign opposite to their neuron's majority (counted by synapse number; Shiu et al. assign one sign per neuron by a presynaptic-site vote, so this approximates rather than reproduces their rule). Statistics: `game/docs/results/export_sign_tables.txt`, reproducible with `python game/tools/export_sign_tables.py`.

**Minor:** the key is `"OA"` but the source label is `"OCT"` (17,067 rows), so those rows go through the "unknown → +1" fallback. The sign is the same, so no numeric effect, but the `unknown_nt` warning count is inflated.

**Possible changes (any subset):**
- a comment above `NT_SIGN` naming the convention and pointing to Shiu et al.;
- an option to build with `GLUT = -1`;
- an option for per-neuron majority sign assignment.

I'm happy to send a PR for any of these if you'd like.

Everything above is a statement about sign conventions inside a point-neuron model; it makes no claim about how glutamate acts in the fly. Code and data for all numbers: https://github.com/professorwang/flybrain-banana-quest (code MIT; FlyWire data CC BY-NC 4.0). Technical note: https://doi.org/10.5281/zenodo.22998484 (a revision, v6.1, is in preparation).

*Disclosure: the analysis and this text were prepared with AI assistance (Claude); I reviewed them and take responsibility for the content.*
