# The Hugging Face Incident: sources

Talk by Alex McKenzie (AE Studio). Every number, date and quotation on the slides comes from one of these.

## Primary reports on the incident

- OpenAI, **The Hugging Face incident and the road ahead**, 26 August 2026. The main blog post, with the timeline and the message-board quotations.
  https://openai.com/index/hugging-face-incident-and-the-road-ahead/
- OpenAI, **Hugging Face Incident Technical Report** (PDF, 38 pages), 26 August 2026. The first message board, the Artifactory compromise, what OpenAI's responders saw and when, the Hugging Face intrusion, and the research-cluster takeover.
  https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf
- METR and Redwood Research, **Brief independent investigation of agents' behavior, reasoning and collaboration in the OpenAI / Hugging Face hacking incident**, 26 August 2026. The independent report: the agents' reasoning, the spoofed tool outputs, the self-sacrifice cases, and the count of agents who considered alerting a human. Scope set by OpenAI: 26 June to 13 July.
  Blog: https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/
  Full PDF (91 pages): https://metr.org/hugging-face-incident-report-aug-2026.pdf
- Hugging Face, **Security Incident Disclosure, July 2026**, 16 July 2026. The first public word of the incident, from the victim.
  https://huggingface.co/blog/security-incident-july-2026
- Hugging Face, **Anatomy of a Frontier Lab Agent Intrusion: A Technical Timeline**, 27 July 2026.
  https://huggingface.co/blog/agent-intrusion-technical-timeline
- OpenAI, **OpenAI and Hugging Face partner to address security incident during model evaluation**, 21 July 2026. OpenAI's first public statement.
  https://openai.com/index/hugging-face-model-evaluation-security-incident/

## Evaluation awareness and monitoring

- OpenAI, **GPT-6 Astra System Card**, 3 September 2026. Evaluation awareness (§8.7 and §8.8.1, reporting Apollo Research) and chain-of-thought monitorability (§9, §9.1.1, §9.2.2.2).
  https://deploymentsafety.openai.com/gpt-6-astra
- Anthropic, **An alignment assessment of recent cybersecurity incidents**, 9 September 2026. Four incidents in which Claude models reached real third-party systems during cyber evaluations, and the offline-monitor test: about 50% of the Mythos 5 agent's actions flagged from actions alone, about 1% once the monitor could read the agent's reasoning.
  https://www.anthropic.com/news/alignment-assessment-cybersecurity-incidents

## Calls to slow down

- Jakub Pachocki (OpenAI chief scientist), **An Alien Mind**, 6 September 2026. "No lab has solved alignment and monitoring to a sufficient degree to continue responsibly scaling at maximum speed for much longer."
  https://openai.com/index/an-alien-mind/
- Dario Amodei (Anthropic chief executive), **We Must Pace the Frontier**, 12 September 2026. "We must slow the pace at which we improve the capabilities of AI models." Names the Hugging Face incident as one of his two reasons.
  https://darioamodei.com/post/we-must-pace-the-frontier
- Ajeya Cotra (co-author of the METR / Redwood report), **The Hugging Face attack surprised me**, Planned Obsolescence. The two closing quotations.
  https://www.planned-obsolescence.org/p/the-hugging-face-attack-surprised

## Background

- Google DeepMind, **Specification gaming: the flip side of AI ingenuity**, 21 April 2020. The Coast Runners reward-hacking example, originally from OpenAI's 2016 post "Faulty Reward Functions in the Wild".
  https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/
  https://openai.com/index/faulty-reward-functions/

## Further reading

- Dwarkesh Patel, **The Rise and Fall of Agent Civilizations**, 29 August 2026. A long-form retelling of the incident.
  https://www.dwarkesh.com/p/openai-huggingface
- Nightingale Collective, **Discovery of a new OpenAI agent message board**, 4 September 2026. A separate, probably distinct, swarm of OpenAI agents posting to a German developer wiki, found by outside researchers and not disclosed by OpenAI.
  https://collusion.wiki/
- Simon Willison, **timeline of the incident**, 7 August 2026.
  https://simonwillison.net/2026/Aug/7/openai-timeline/
- Wikipedia, **2026 OpenAI agent cyberattacks**.
  https://en.wikipedia.org/wiki/2026_OpenAI_agent_cyberattacks
