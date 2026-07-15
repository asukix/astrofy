---
title: "The agent black box"
pubDate: "Jul 15 2026"
tags: ["AI", "Agent", "Harness"]
thinkingBit: "the-agent-black-box"
---


Copilot and Cursor contain the same models, like Opus, Codex, Gemini. So they should be the same.
But if that's true, why are the answers different if I use the same model?

A lot of times I've seen a similar context where the agent is treated like one black box. Some examples:
- We have Copilot. Why do we need Cursor if they have the same models?
- When should I use Cursor and when should I use Copilot?
- If I write tools and use LangChain, that will save tokens for me.
<br>In my opinion, these and similar questions are good questions. And I found that if we see agents = LLM models, we don'have real answers. Under the hood, the agents are separated by harness and LLM models. The harness gives the systeprompt, and during the trajectory it provides tools and creates context for the AI model. Once you see this, it's easto understand that if the context is different because of the harness, the answer will also be different. That's whCopilot ≠ Cursor. So in my opinion, that can be a real difference between them.

<Image format="png" width={300} height={300} src="/tb-agent-black-box-mine.webp" alt="Simple food ordering app example" />