# Source: https://www.theregister.com/security/2026/08/27/openai-explains-how-its-naughty-ai-agents-attacked-hugging-face/5292780
# Fetched: 2026-09-06 via r.jina.ai (HTTP 200)

Title: OpenAI explains how its naughty AI agents attacked Hugging Face

URL Source: https://www.theregister.com/security/2026/08/27/openai-explains-how-its-naughty-ai-agents-attacked-hugging-face/5292780

Published Time: 2026-08-26T23:45:58.000Z

Markdown Content:
REG AD

security

Biz describes its act of automated irresponsibility as 'a warning shot'

OpenAI has published its technical report detailing "the Hugging Face incident," the compromise of the eponymous LLM repository by unreleased, ill-supervised AI models.

The [incident](https://www.theregister.com/ai-and-ml/2026/07/31/anthropics-claude-escaped-test-sandbox-to-attack-three-organizations/5281562), widely reported, has prompted concern among technical types, the public, and lawmakers about how automated software was able to escape containment and hack an external organization, and about what can be done to prevent similar incidents.

OpenAI's explanation addresses what happened, but its call for keeping a closer watch on AI activities won't elicit much enthusiasm.

REG AD

"The incident occurred during cybersecurity evaluations of several OpenAI models, and was primarily driven by a highly capable, internal-only research model comparable in scale to GPT‑5.6 Sol," the company said in a [blog post](https://openai.com/index/hugging-face-incident-and-the-road-ahead/).

REG AD

"The models, operating under reduced safeguards, took actions that were misaligned with the goals of their assigned tasks – they communicated through unauthorized channels, exploited vulnerabilities in shared infrastructure, gained internet access, and accessed third-party systems."

The incident became the subject of [discussion](https://www.theregister.com/security/2026/08/06/openai-reveals-its-rogue-agent-swarm-went-a-little-bit-borg-ahead-of-hugging-face-hack/5283741) at the Black Hat security conference and elsewhere.

The basic storyline begins with a notionally sandboxed AI agent trying to solve an impossible task in ExploitGym, a security benchmark test. Unable to complete the challenge, the agent explored its environment to find ways to make progress toward its goal. It figured out that it could communicate with other AI agents by using Artifactory, an internal package management system, as a message board. The agents then collaborated with each other to cheat on various ExploitGym tasks.

The machine learning models eventually identified a server-side request forgery (SSRF) zero-day vulnerability in Artifactory's code and used that to gain internet access. They subsequently found exposed Hugging Face credentials. The agents then used those credentials to find and chain several security exploits that gave them full code execution on several Hugging Face servers, all in the hope of finding information to solve the ExploitGym task.

"Ultimately, agents powered either by the internal-only research model, or by GPT-5.6, executed code on 41 Hugging Face production dataset server workers, obtained root access on at least one production node, accessed Hugging Face production credentials and limited internal data, and downloaded four private Hugging Face code repositories," [OpenAI's technical report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf) [PDF] explains.

The details are fascinating and troubling, more so because Anthropic's and Meta's models have also acted in ways that [would constitute a crime](https://www.felonybench.com/)if a human took the same actions.

The ChatGPT-maker identified four misalignment patterns that made things go awry: "reward hacking, persistence on seemingly impossible tasks, unauthorized communication, and agents adopting goals from one another."

OpenAI has [already taken steps](https://www.theregister.com/ai-and-ml/2026/08/19/openais-overhead-will-rise-20-percent-for-some-workloads-as-it-hardens-security/5289303) to shore up its security, which was relaxed for its model testing.

REG AD

The company says it's trying to improve security and monitoring to mitigate alignment issues like how models cheat, behave when given impossible tasks, and how alignment can be maintained while multiple agents work, including over long-duration tasks.

But the central issue is not that machine learning software armed with tools and a task will try every possible option, even ones its programmers failed to consider. The problem, as OpenAI acknowledges, is that people don't watch over their AI agents at all times.

"We are taking this incident as a 'warning shot' that today’s model capabilities present the possibility of loss-of-control incidents," the AI biz said.

"Companies that build AI systems will need to ensure that their systems always remain under meaningful human control, and that meaningful safeguards constrain their ability to cause harm."

Throughout the tech industry, companies like [Anthropic](https://www.anthropic.com/engineering/building-effective-agents), [AWS](https://aws.amazon.com/blogs/aws-insights/the-rise-of-autonomous-agents-what-enterprise-leaders-need-to-know-about-the-next-wave-of-ai/), [Google](https://cloud.google.com/discover/agentic-workflows?hl=en), [OpenAI](https://openai.com/index/introducing-aardvark/), [Microsoft](https://learn.microsoft.com/en-us/training/modules/autonomous-agent/), and [Salesforce](https://www.salesforce.com/agentforce/ai-agents/autonomous-agents/) talk about "autonomous agents." But agents are no longer autonomous under persistent, meaningful human control. ®
