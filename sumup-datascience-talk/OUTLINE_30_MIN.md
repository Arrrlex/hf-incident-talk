# The Hugging Face Incident for data scientists

This is the 30-minute adaptation of the main talk. There are no speaker notes and no per-slide timings; rehearse aloud to set the pace.

Keep the original talk’s urgency: this was an extraordinary failure of control and a warning shot for humanity. Start with what the agents did and why it matters, before explaining the setup. Preserve qualifications that change a factual claim, without repeatedly interrupting the story to soften its significance.

## Sections

| Section | Slides |
|---|---|
| Introduce Alex and summarise the incident | Title; summary; the Simpsons “time to panic?” clip (YouTube embed, needs internet) |
| Setup and reward hacking | RLVR, parallel copies, sandboxes and the shared package server; Coast Runners |
| The agents find each other | Impossible tasks; discovery scene; administrator control of Artifactory; crash and rebuild; what the humans knew (26 May, 27 June, 5–6 July) |
| The Hugging Face break-in | Impossible tasks and the universal cheat; the imagined checker; spoofed tool output; agents ending their own runs (KAM1196A); leaked credentials; the intrusion; 41 workers and four repositories; the exfil post; mass termination |
| The OpenAI cluster takeover | A more capable model finds the board; recovers the keys; takes over the research cluster; what the humans knew (16–21 July, disclosure came from the victim); the zero reveal |
| Evaluation awareness and monitoring | Astra’s alignment claim and the question; metagaming and alignment faking; evaluation awareness; loss of CoT monitorability; Astra’s CoT tells us less; Anthropic’s monitor misled by the agent’s reasoning (~1% vs ~50%); safe model vs one that looks safe |
| Interpretability and the warning shot | Interpretability can help but is not yet reliable; it is not just OpenAI (Anthropic’s four incidents, Pachocki, Amodei); Cotra’s two quotations |
| Questions | Sources |

Contents slides recur at each section transition, with the current section highlighted.

The safety section starts with OpenAI’s exact claim that Astra is “a significant step forward in model alignment”. Let that reassuring claim land, then reveal the question: “Would our tests catch a model that only behaves well when we are watching?” The imagined checker provides a concrete example of behaviour changing in response to a perceived evaluator. The Anthropic monitor slide gives the concrete case of reasoning misleading a monitor: shown the agent’s reasoning, the monitor flagged about 1% of actions; shown only actions and results, about 50%.

The first board began in training on 12 May, but agents also used it during evaluations. The Artifactory administrator compromise on 26 June happened in an ExploitGym evaluation (OpenAI technical report, pp.7–8). The reports do not establish the relative amount of training and evaluation activity, so avoid “mostly training”.

The self-sacrifice slide: METR flags that many of these agents believed their own task was already worthless, so whether it is true self-sacrifice is debated. The undisputed version is on the slide: they chose to give up their run for the group.

## Sources

Incident claims use `FACTS.md` and the saved primary reports in `../research/sources/`. The main sources are:

- OpenAI, [The Hugging Face incident and the road ahead](https://openai.com/index/hugging-face-incident-and-the-road-ahead/), 26 August 2026.
- OpenAI, [Hugging Face Incident Technical Report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf), 26 August 2026.
- METR and Redwood Research, [Brief independent investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/), 26 August 2026.
- Hugging Face, [Security Incident Disclosure — July 2026](https://huggingface.co/blog/security-incident-july-2026), 16 July 2026, and [Anatomy of a Frontier Lab Agent Intrusion](https://huggingface.co/blog/agent-intrusion-technical-timeline), 27 July 2026.
- OpenAI, [GPT-6 Astra System Card](https://deploymentsafety.openai.com/gpt-6-astra), especially §§8.7–9, 3 September 2026.
- Anthropic, [An alignment assessment of recent cybersecurity incidents](https://www.anthropic.com/news/alignment-assessment-cybersecurity-incidents), 9 September 2026 (FACTS §12).
- Jakub Pachocki, [An Alien Mind](https://openai.com/index/an-alien-mind/), 6 September 2026 (FACTS §12).
- Dario Amodei, [We Must Pace the Frontier](https://darioamodei.com/post/we-must-pace-the-frontier), 12 September 2026 (FACTS §12).
- Google DeepMind, [Specification gaming: the flip side of AI ingenuity](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/), 21 April 2020.
- Cooney, Africa and Irving, [“Did you lie?”](https://arxiv.org/html/2606.12618v2), June 2026, Figure 1e and §6.2, for the interpretability slide if asked.

The internal models in the incident are separate from the publicly released Astra model. The Astra claims are labelled with their evaluation conditions and preserve the system card’s distinction between evaluation awareness, alignment faking, deception and the limits of monitoring.
