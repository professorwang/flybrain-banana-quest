<!--
DRAFT — not sent. Send only AFTER: v6.1 is released/archived (the email links to it), and
`node game/tools/verify_results.mjs` passes on a clean clone.
Recipient: the corresponding author(s) listed on the Nature article page
(https://doi.org/10.1038/s41586-024-07763-9, "Correspondence"). I did not guess an address.
One email, no follow-up chasing. Expect no reply; that is normal.
-->

**To:** [corresponding author — take the address from the article page]
**Subject:** Reproducible audit of the glutamate-sign sensitivity in connectome LIF models (builds on your Supp. Table 11f)

Dear Dr. [Name],

I am an independent researcher (Fortune AI) and have posted a small, fully reproducible technical note that builds directly on your 2024 *Nature* model and on the robustness analysis in its Methods (glutamate excitatory vs inhibitory, Supplementary Table 11f). I am writing to make sure I have described your work correctly and to ask one question.

We used a much simpler discrete-tick LIF core (not your Brian2 model) on two community-packaged connectomes, FlyWire v783 and MaleCNS v1.0, which sign glutamate oppositely. Flipping that one rule switches a whole-brain high-activity regime in both directions. We then asked whether this is specific to glutamatergic neurons or to the amount of synaptic mass that changes sign. With mass-matched random controls from other transmitter classes: on FlyWire the same suppression appears, so the effect is not glutamate-specific there; on MaleCNS glutamate looks special under one weight normalization and not under a fixed per-synapse weight. Everything is model-internal and we make no claim about how glutamate acts in the fly.

**My question:** in your model, if only a fraction of glutamatergic neurons were made excitatory, would you expect a graded or threshold-like response, and would you expect equal-mass flips of other classes to behave like ours? I would be grateful for any correction, in particular if I have misdescribed your sign rule (I state it as a per-neuron assignment by majority vote over presynaptic sites, and note that the browser package I examined signs each connection row, so about 31% of its presynaptic neurons carry both signs by synapse count).

Figure 1 and all numbers: https://github.com/professorwang/flybrain-banana-quest (technical note: https://doi.org/10.5281/zenodo.22998484). Every number regenerates with `node game/tools/verify_results.mjs`.

No reply is expected; thank you for the model and the open code that made this possible.

Best regards,
Yang Wang
Fortune AI · wangglenwang@gmail.com

*The analysis and this email were prepared with AI assistance (Claude); I reviewed them and take responsibility for the content.*
