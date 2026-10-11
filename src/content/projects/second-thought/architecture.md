---
title: "Architecture"
description: Current and planned architecture of the project.
project: "second-thought"
order: 1 # a sorrend még nincs eldöntve
draft: false
---

## Current architecture

Second Thought's current architecture is built on ports and adapters, around a pure core.

### Frontends

There are two frontends with the same functionality: the **CLI** and the **VS Code extension**.
Each one creates the LLM client and the passes, calls `review()`, and shows the result to the user:
the CLI as text in the terminal, the extension as underlines and quick fixes.

### Core

`review()` is the Context of the Strategy pattern and holds the core business logic. Its input is an article.
It runs the passes, then applies the system-wide rules: it drops every suggestion that touches a protected range
(this is the guard), stops early on systemic LLM errors (fail-fast), and builds the diff.

### Passes

Each pass has its own system prompt. It gets the prose from the Segmenter, sends it to the LLM through the
`LlmClient` interface, and turns the reply into findings. The language pass also narrows each fix to the words
that actually changed.

### Port and adapter

`LlmClient` is the port: the core only knows this interface, not the provider. The Gemini adapter implements it:
it talks to Gemini over HTTPS, retries on 429 and network errors, and translates the provider's errors into our own
error kinds, so the raw response never crosses the port.

<a href="/projects/second-thought/CurrentArchitecture.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/CurrentArchitecture.webp" width="1057" height="959" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Current architecture. The article enters through the VS Code extension or the CLI, which call Review. Review uses the Segmenter and two passes, Language and Editorial, which implement the Passes interface. The passes depend on the LLMClient interface, implemented by the Gemini LlmClient, which calls LLM Provider 1 over HTTPS. The CLI and the extension each create the Gemini client. A second provider is planned." /></a>

## Planned architecture
When I made the current architecture diagram for the project page, I noticed some weaknesses:
- Parsing happens multiple times (in the review and in the passes). This is not efficient.
- The frontends know about the exact LLM client. This makes the architecture inflexible.

So I started to plan the next architecture.

### Review module plan
In the next version I plan to make a separate module for the review, the passes and their elements. I would like to make one bigger module. It would be a bit monolithic, but in this phase of the project I think it is acceptable.
The module would make the architecture more flexible, and it would hide the exact LLM from the frontends.
I haven't decided yet whether I will use an API or keep the review as a strategy.

#### Technical Fact Check Pass
I also plan a new pass to check the technical facts. It would be an element with explanations, source links and proof of truth.
This will be a new functionality to help me check whether my articles are correct enough.

<a href="/projects/second-thought/PlannedArchitecture-ReviewModule.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/PlannedArchitecture-ReviewModule.webp" width="682" height="822" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Planned review module. Review collects results from three passes, Language, TechnicalFactCheck and Editorial, which implement the Passes interface and use the LLMClient interface. Two clients, Gemini and a second one, implement LLMClient, each calling its own LLM provider over HTTPS." /></a>

### Application architecture

With the new module, I think it will be easier to attach new UIs.
I also plan a preprocessor that would, for example, create the segments and run a traditional language check.

#### Swift application

I plan a Swift application for the project. It would run the same TypeScript core as a sidecar binary, so I don't have to rewrite the review logic in Swift.

#### Output provider

A planned output provider would make the diffs and maybe the format for the frontends.

<a href="/projects/second-thought/PlannedArchitecture.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/PlannedArchitecture.webp" width="1132" height="612" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Planned architecture. The article goes through the Segmenter into the Review module, which uses two LLM providers. Results go to the VS Code extension and the CLI, then through an Output provider to the user." /></a>
