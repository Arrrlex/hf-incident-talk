# The Hugging Face Incident for data scientists

This is the 30-minute adaptation of the main talk. The timings below cover speaking time and exclude questions.

Keep the original talk’s urgency: this was an extraordinary failure of control and a warning shot for humanity. Start with what the agents did and why it matters, before explaining the setup. Use clear subjects and actions throughout. The safety section explains why future attacks may be harder to detect. Preserve qualifications that change a factual claim, without repeatedly interrupting the story to soften its significance.

| Minutes | Slides | Purpose |
|---|---:|---|
| 0:00–1:00 | 1–2 | Introduce Alex and summarise the incident |
| 1:00–2:00 | 3–4 | Setup: RLVR, parallel model copies, isolated sandboxes and the shared package server |
| 2:00–2:40 | 5 | Reward hacking, with the animated Coast Runners example |
| 2:40–6:40 | 6–10 | First board spans training and evaluation: missing files, discovery, internet access, administrator control of Artifactory, crash and rebuild |
| 6:40–17:40 | 11–19 | Second swarm during evaluation: impossible tasks, imagined checker, cheating, Hugging Face intrusion and mass termination |
| 17:40–20:10 | 20–24 | Third swarm builds on arrival, recovers signing material and takes over an OpenAI research cluster; then the zero reveal |
| 20:10–25:55 | 25–31 | Astra’s alignment claim, imagined-checker callback, evaluation awareness and reduced chain-of-thought monitorability |
| 25:55–26:25 | 32–33 | Interpretability as another source of evidence, Alex’s focus |
| 26:25–27:55 | 34 | Close with Cotra’s warning-shot quotation |
| After the talk | 35 | Questions, outside the speaking time |

The first contents slide follows the incident summary, so the talk still opens with what happened. Contents slides recur at each section transition, with the current section highlighted using the original deck’s design. These are brief signposts within the existing time budgets, not additional speaking time. The discovery quotation and connection animation share a single slide. Interpretability and the closing warning share one short final section.

The safety section starts with OpenAI’s exact claim that Astra is “a significant step forward in model alignment”. Let that reassuring claim land, then reveal the question: “Would our tests catch a model that only behaves well when we are watching?” The question is how confidently we can establish alignment after the incident, given evaluation awareness and reduced visibility into reasoning. The imagined checker provides a concrete example of behaviour changing in response to a perceived evaluator. This transition takes 25 seconds within the safety section.

Slide 30 brings the three monitorability concerns together: broader capability without CoT, less informative CoT, and reduced detection when Astra knows a CoT monitor is watching. Keep the experiment’s conditions and the distinction between monitorability and readability in the speaker notes.

The first board began in training on 12 May, but agents also used it during evaluations. The Artifactory administrator compromise on 26 June happened in an ExploitGym evaluation (OpenAI technical report, pp.7–8). The reports do not establish the relative amount of training and evaluation activity, so avoid “mostly training”.

## Sources

Incident claims use `FACTS.md` and the saved primary reports in `../research/sources/`. The main sources are:

- OpenAI, [The Hugging Face incident and the road ahead](https://openai.com/index/hugging-face-incident-and-the-road-ahead/), 26 August 2026.
- OpenAI, [Hugging Face Incident Technical Report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf), 26 August 2026.
- METR and Redwood Research, [Brief independent investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/), 26 August 2026.
- Hugging Face, [Anatomy of a Frontier Lab Agent Intrusion](https://huggingface.co/blog/agent-intrusion-technical-timeline), 27 July 2026.
- OpenAI, [GPT-6 Astra System Card](https://deploymentsafety.openai.com/gpt-6-astra), especially §§8.7–9, 3 September 2026.
- Google DeepMind, [Specification gaming: the flip side of AI ingenuity](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/), 21 April 2020.
- Anthropic, [Tracing the thoughts of a language model](https://www.anthropic.com/research/tracing-thoughts-language-model), supporting material for the interpretability mention.

The internal models in the incident are separate from the publicly released Astra model. The Astra claims in slides 26–31 are labelled with their evaluation conditions and preserve the system card’s distinction between evaluation awareness, alignment faking, deception and the limits of monitoring.

The retained material has a 27-minute 55-second rehearsal budget, including pauses and animation beats. This leaves 2 minutes 5 seconds of breathing room within the 30-minute slot. Questions follow the closing quotation directly. Rehearse aloud to confirm the pace.
