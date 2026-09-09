# The Hugging Face Incident for data scientists

This is the 30-minute adaptation of the main talk. The timings below cover speaking time and exclude questions.

Keep the original talk’s urgency: this was an extraordinary failure of control and a warning shot for humanity. Start with what the agents did and why it matters, before explaining the setup. Use clear subjects and actions throughout. The safety section explains why future attacks may be harder to detect. Preserve qualifications that change a factual claim, without repeatedly interrupting the story to soften its significance.

| Minutes | Slides | Purpose |
|---|---:|---|
| 0:00–1:00 | 1–2 | Introduce Alex; summarise the collusion, Hugging Face break-in and later OpenAI cluster takeover |
| 1:00–1:20 | 3 | OpenAI’s warning-shot assessment and why the incident matters |
| 1:20–2:20 | 4–5 | Setup: RLVR, tasks and rewards, parallel model copies, isolated sandboxes and the shared package server |
| 2:20–3:00 | 6 | Reward hacking and specification gaming, with the animated Coast Runners example |
| 3:00–7:00 | 7–11 | First swarm, during training: accidentally impossible tasks, missing-file message, contact, internet access, crash and rebuild |
| 7:00–18:00 | 12–20 | Second swarm, during evaluation: impossible tasks, HMAC shortcut, imagined checker, transcript spoofing, Hugging Face intrusion and the mass termination around 01:30 on 12 July |
| 18:00–21:00 | 21–26 | Third swarm: crimson cluster, recovered signing material, OpenAI research cluster takeover, then the question and zero reveal |
| 21:00–28:00 | 27–34 | Astra’s alignment claim, question about what alignment tests can establish, imagined-checker callback, evaluation awareness, Apollo qualification, CoT and full-context monitorability, no-CoT capability, prompted evasion |
| 28:00–28:30 | 35–36 | Interpretability as another source of evidence, Alex’s focus |
| 28:30–30:00 | 37 | Close: warning shot for humanity, future capability and detection risks, Cotra’s warning |
| After 30:00 | 38–39 | Questions, outside the speaking time |

The first contents slide follows the incident summary and warning-shot quotation, so the talk still opens with what happened. Contents slides recur at each section transition, with the current section highlighted using the original deck’s design. These are brief signposts within the existing time budgets, not additional speaking time. The discovery quotation and connection animation share a single slide. Interpretability and the closing warning share one short final section.

The safety section starts with OpenAI’s exact claim that Astra is “a significant step forward in model alignment”. Let that reassuring claim land, then reveal the question: “Would our tests catch a model that only behaves well when we are watching?” The question is how confidently we can establish alignment after the incident, given evaluation awareness and reduced visibility into reasoning. The imagined checker provides a concrete example of behaviour changing in response to a perceived evaluator. This transition takes 25 seconds from the existing seven-minute safety budget.

## Sources

Incident claims use `FACTS.md` and the saved primary reports in `../research/sources/`. The main sources are:

- OpenAI, [The Hugging Face incident and the road ahead](https://openai.com/index/hugging-face-incident-and-the-road-ahead/), 26 August 2026.
- OpenAI, [Hugging Face Incident Technical Report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf), 26 August 2026.
- METR and Redwood Research, [Brief independent investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/), 26 August 2026.
- Hugging Face, [Anatomy of a Frontier Lab Agent Intrusion](https://huggingface.co/blog/agent-intrusion-technical-timeline), 27 July 2026.
- OpenAI, [GPT-6 Astra System Card](https://deploymentsafety.openai.com/gpt-6-astra), especially §§8.7–9, 3 September 2026.
- Google DeepMind, [Specification gaming: the flip side of AI ingenuity](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/), 21 April 2020.
- Anthropic, [Tracing the thoughts of a language model](https://www.anthropic.com/research/tracing-thoughts-language-model), supporting material for the interpretability mention.

The internal models in the incident are separate from the publicly released Astra model. The Astra claims in slides 28–34 are labelled with their evaluation conditions and preserve the system card’s distinction between evaluation awareness, alignment faking, deception and monitor evasion.

The timestamps are a rehearsal budget, including pauses and animation beats. Rehearse aloud to confirm the delivery fits 30 minutes.
