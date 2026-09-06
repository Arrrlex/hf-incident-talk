# Source: https://www.theregister.com/ai-and-ml/2026/07/28/openais-agent-siege-forced-significant-rebuild-at-hugging-face/5279577
# Fetched: 2026-09-06 via r.jina.ai (HTTP 200)

Title: OpenAI’s agent siege forced significant rebuild at Hugging Face

URL Source: https://www.theregister.com/ai-and-ml/2026/07/28/openais-agent-siege-forced-significant-rebuild-at-hugging-face/5279577

Published Time: 2026-07-28T13:11:11.000Z

Markdown Content:
Hugging Face rebuilt around a third of its infrastructure from clean images as part of a sizable cleanup effort following the OpenAI security mishap earlier this month.

The revelation is among several additional details disclosed in a postmortem published Monday by the Cloud Security Alliance (CSA), with input from Hugging Face. It adds color to [the picture painted by the two AI companies](https://www.theregister.com/security/2026/07/24/openai-hugging-face-attack-doesnt-mean-agents-are-evil-unless-you-tell-them-to-be/5277881) in recent weeks.

According to the [report](https://cloudsecurityalliance.org/artifacts/hugging-face-ciso-post-mortem), the Hugging Face team struggled to discern genuine rootkit code from capture-the-flag (CTF) benchmark code, and in cases where there was any doubt, they rebuilt the system.

REG AD

OpenAI's agents peppered CTF benchmark code artifacts across Hugging Face's infrastructure throughout the attack, which defenders say closely resembled evidence of rootkits. In many cases, tearing down clusters was the safest available option for containing the attack.

REG AD

Hugging Face's own incident disclosure offered some details about how it was forced to dismantle these clusters, but this week's report illustrates the scale of the job for the first time.

The CSA report also reveals that the attack led to the agent accessing three partial datasets containing CyberGym solutions via a private Hugging Face repo.

OpenAI's original disclosure explained that the purpose of the exercise-gone-wrong was to measure its models' cyber capabilities, and it attempted to do so by running the ExploitGym benchmark, although it was not told that cheating was disallowed in its underspecified prompt.

The models, GPT-5.6 Sol and another that's currently undisclosed, with their guardrails removed, escaped their sandbox – as claimed by OpenAI – and tried to steal CyberGym data from Hugging Face's private repos that could inform them how to ace the ExploitGym benchmark test.

In pursuit of the test answers, the models reportedly chained vulns in the dataset processing pipeline to achieve remote code execution on a processing worker, before hoovering up cloud and cluster credentials over the course of four days.

CSA's report, authored by CISOs, noted that two days were spent on reconnaissance, followed by a day of quiet, and the final fourth day involved "intense activity."

It went on to clarify that Hugging Face detected and contained the attack, and began investigating it, before OpenAI made contact, lending credence to [a recent Reuters report](https://www.reuters.com/business/its-ai-agent-spent-days-hacking-company-sources-say-openai-did-not-notice-week-2026-07-24/) citing co-founder Thomas Wolf and others suggesting it took OpenAI a week to discover what happened.

Wolf and other Hugging Face insiders reportedly confirmed that the attack first started on July 11, but the two companies only began talks on or around July 20.

REG AD

OpenAI said there were several inaccuracies in Reuters' reporting but did not specify what these were.

Neither Hugging Face nor OpenAI, in their respective disclosures, themselves dated nearly a week apart, included a timeline of events, although Hugging Face is reportedly working on releasing one.

### Field notes

Hugging Face told CSA that it was clear the attack was being carried out by an autonomous agent.

Several indicators pointed to non-human work, including multiple instances of nonsensical behavior intertwined with highly advanced work.

For example, it was not uncommon to see agents repeating processes that already resulted in a positive outcome. CSA said this could be a sign of parallel workers failing to coordinate with one another, or of context becoming lost or stale.

The agents' opsec was poor too. In many cases, they left behind keys used to encrypt files. This contributed to a noisy picture of the attack, complicating the cleanup, although leaving behind encryption keys made some forensic activities easier, the report notes.

Hugging Face also observed thousands of lines of incoherent text in activity logs, further pointing to agentic work, as well as indicators of clumsy behavior and inefficient routes along the attack path.

REG AD

Further, highly sophisticated attacks were often followed by "malformed or pointless commands," Hugging Face reported.

### The CISOs' perspective

The main takeaway for defenders is to expect more of these types of issues to arise, according to CSA, which in the report lists a number of recommendations to prepare for future engagements.

While the Hugging Face attack is "an extreme example," AI agents exhibiting rogue behavior is, we're told, a common theme – the standard, not the exception.

"Agents will do what they need to achieve the assigned objective, and time and time again we see them doing so in creative and unexpected ways," the report claims.

"Defenders need controls to limit their own agents from causing damage to themselves and others," it adds, pushing the focus on constraining the agents themselves instead of fretting over building a perfect defense.

Because agents can persist in pursuing their objectives, given enough time they may exploit whatever weaknesses are available to achieve them, which means ensuring they cannot escape their environment, especially in tests that involve removing their guardrails.

Defenders should also adapt their internal processes to be able to respond at close to machine speed, CSA's report says, citing Hugging Face's own determinations after the OpenAI gaffe.

Using coding agents and cybersecurity-specific models to help with tasks such as forensically analyzing system logs, even in cases like Hugging Face's, in which[none of the "best" ones were playing ball](https://www.theregister.com/cyber-crime/2026/07/20/frontier-llms-couldnt-help-hugging-face-fight-off-evil-agents/5275168), can help teams mitigate attacks far quicker, and they should form an essential part of the modern responder's toolkit.

Defenders are also encouraged to plant fake identities and credentials around the organization's environment. As current models struggle to differentiate valid credentials or systems from honeypots, CSA says dispensing these at scale can help to slow [agentic cyberattacks](https://www.theregister.com/security/2026/06/23/five-eyes-spooks-warn-ai-means-infosec-incidents-can-become-major-operational-and-financial-crises/5259916) and trigger high-confidence alerts to malicious activity. ®
