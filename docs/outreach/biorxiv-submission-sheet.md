<!--
DRAFT — a fill-in sheet for a bioRxiv submission (or arXiv, same content). Nothing is submitted.
Items marked [CONFIRM] are facts only the author knows; I did not invent them.
What I verified (2026-10-03): bioRxiv accepts computational / methods work in its Neuroscience
category, lets authors choose CC BY, CC BY-NC, CC BY-ND, CC BY-NC-ND or CC0, and states no
restriction on independent or company-affiliated authors. Its "about" page did NOT state an AI-use
policy; check the submission form / "Information for authors" for one before submitting.
arXiv: first-time submitters to a category need an endorsement; an institutional email speeds it up
(info.arxiv.org/help/endorsement.html). bioRxiv has no endorsement step that I could find.
-->

# Submission sheet — Technical note v6.1

| Field | Value |
|---|---|
| Title | Packaging choices change connectome-simulation outcomes: transmitter sign tables, matched controls, and weight-scheme dependence in two fly connectomes |
| Article type | New Results (bioRxiv) |
| Subject area | Neuroscience (bioRxiv) · arXiv: q-bio.NC, cross-list cs.NE |
| Author | Yang Wang — Fortune AI — wangglenwang@gmail.com — ORCID [CONFIRM] |
| Files | `game/docs/arxiv/main.pdf` (single PDF, figures embedded). arXiv alternative: upload `main.tex` + `fig1_controls.pdf`, select **xelatex** |
| License | Suggest **CC BY 4.0**, matching the Zenodo record. Choose deliberately: CC BY allows commercial reuse, and you plan commercial education/audit services |
| Abstract | Paste the plain-text version below (1,637 characters; arXiv metadata limit is 1,920) |

## Declarations (suggested wording; edit to match the facts)

- **Competing interests:** Y.W. is the founder of Fortune AI, which may offer education or audit services related to connectome simulation. No such service is offered or sold in connection with this work. [CONFIRM both sentences]
- **Funding:** None. [CONFIRM]
- **Data and code availability:** Code (MIT), frozen scripts, archived outputs and pinned vendor-data checksums: https://github.com/professorwang/flybrain-banana-quest. Upstream connectome data are third-party (FlyWire CC BY-NC 4.0; MaleCNS CC BY 4.0) and are not redistributed beyond the derived files described in `DATA-LICENSES.md`.
- **Use of AI tools:** An AI coding assistant (Kimi Code) wrote most of the simulation and game code and drafted v1–v5.1; Claude (Anthropic) designed and implemented the v6 control experiments, produced Figure 1, and revised the text; Codex and Claude performed earlier technical reviews. No AI system is an author. The author reviewed the work and takes responsibility. (This is the same text as the paper's disclosure section.)
- **Ethics:** Not applicable (no animal or human data generated; analysis of public connectome datasets).
- **Prior versions:** v6.0.1 is archived at https://doi.org/10.5281/zenodo.22998484. State this in the cover note so the preprint is not read as a duplicate.

## Plain-text abstract

How much of what "dynamics on a connectome" simulations show is set by data-packaging choices rather than by the connectome? We probe one leaky integrate-and-fire core on two community packages of real fly connectomes (FlyWire FAFB v783, 139,255 neurons; MaleCNS v1.0, 176,422 neurons). The packages sign glutamate oppositely, and flipping that one rule switches a whole-brain high-activity regime in both directions (FlyWire visual-lobe spikes 405,788 -> 0; MaleCNS 2 -> 553,863). Shiu et al. had already shown sign sensitivity for their own model; we test what the flip isolates here. Byte-identical rebuilds confirm the variants. Mass-matched random flips of other transmitter classes also abolish the FlyWire regime (405,788 -> 1-128), so there it is not glutamate-specific; at equal per-group synaptic mass, MaleCNS ignites only under glutamatergic flips (279,054 vs 108). Dose-response is steep: flipping 25% of the glutamate mass removes 98.7% of FlyWire visual activity, and MaleCNS ignites between 75% and 90%. Replacing our postsynaptic L1 normalization by a fixed per-synapse weight keeps the direction of the sign effect (22-29x at a Shiu-matched scale) but makes it graded, and the MaleCNS glutamate specificity disappears or reverses. The reference global-max normalization, which propagates nothing, uses per-synapse weights about 100-170x below that scale. The glutamate rule matters first because it is the largest block of synaptic mass on which packages disagree; claims about specific transmitter classes need mass-matched controls and a second weight scheme. All results are model-internal and license no inference about fly biology; every number regenerates from frozen scripts.

> The abstract above already includes the v6.1 credit clause. If you edit it, re-count characters (limit 1,920).

## Pre-submission checklist

- [ ] `node game/tools/verify_results.mjs` passes on a clean clone (the author, not me)
- [ ] v6.1 released and archived (new Zenodo version), `main.tex` header updated from "draft"
- [ ] `python game/docs/arxiv/check_tex.py` → PASS; `main.pdf` has no overfull boxes
- [ ] Cover note mentions the Zenodo v6.0.1 and the Shiu et al. prior analysis
- [ ] Competing-interest and funding statements confirmed by the author
