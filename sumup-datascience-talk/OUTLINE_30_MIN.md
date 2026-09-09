# The Hugging Face Incident for data scientists

This is the 30-minute adaptation of the main talk. The timings below cover speaking time and exclude questions.

Keep the original talk’s urgency: this was an extraordinary failure of control and a warning shot for humanity. Start with what the agents did and why it matters, before explaining the setup. Use clear subjects and actions throughout. The safety section explains why future attacks may be harder to detect. Preserve qualifications that change a factual claim, without repeatedly interrupting the story to soften its significance.

| Minutes | Slides | Purpose |
|---|---:|---|
| 0:00–1:00 | 1–2 | Introduce Alex; summarise the collusion, Hugging Face break-in and later OpenAI cluster takeover |
| 1:00–1:20 | 3 | OpenAI’s warning-shot assessment and why the incident matters |
| 1:20–2:00 | 4 | Setup: individual agent tasks and the shared Artifactory server |
| 2:00–3:00 | 5 | Reward hacking and specification gaming, with the Coast Runners example |
| 3:00–7:00 | 6–9 | First civilisation: contact, board, internet access, wipe and return |
| 7:00–18:00 | 10–17 | Second civilisation: HMAC shortcut, imagined checker, transcript spoofing, credentials and the Hugging Face intrusion |
| 18:00–21:00 | 18–21 | Third civilisation: later model, OpenAI research cluster, what the investigation could establish |
| 21:00–28:00 | 22–27 | Evaluation awareness, Apollo qualification, CoT and full-context monitorability, no-CoT capability, prompted evasion |
| 28:00–28:30 | 28 | Interpretability as another source of evidence, Alex’s focus |
| 28:30–30:00 | 29 | Close: warning shot for humanity, future capability and detection risks, Cotra’s warning |
| After 30:00 | 30 | Questions, outside the speaking time |

## Sources

Incident claims use `FACTS.md` and the saved primary reports in `../research/sources/`. The main sources are:

- OpenAI, [The Hugging Face incident and the road ahead](https://openai.com/index/hugging-face-incident-and-the-road-ahead/), 26 August 2026.
- OpenAI, [Hugging Face Incident Technical Report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf), 26 August 2026.
- METR and Redwood Research, [Brief independent investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/), 26 August 2026.
- Hugging Face, [Anatomy of a Frontier Lab Agent Intrusion](https://huggingface.co/blog/agent-intrusion-technical-timeline), 27 July 2026.
- OpenAI, [GPT-6 Astra System Card](https://deploymentsafety.openai.com/gpt-6-astra), especially §§8.7–9, 3 September 2026.
- Google DeepMind, [Specification gaming: the flip side of AI ingenuity](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/), 21 April 2020.
- Anthropic, [Tracing the thoughts of a language model](https://www.anthropic.com/research/tracing-thoughts-language-model), supporting material for the interpretability mention.

The internal models in the incident are separate from the publicly released Astra model. The Astra claims in slides 22–27 are labelled with their evaluation conditions and preserve the system card’s distinction between evaluation awareness, alignment faking, deception and monitor evasion.

The timestamps are a rehearsal budget, including pauses and animation beats. Rehearse aloud to confirm the delivery fits 30 minutes.
