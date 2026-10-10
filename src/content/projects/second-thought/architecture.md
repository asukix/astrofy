---
title: "Architecture"
description: Current and planned architecture of the project.
project: "second-thought"
order: 1 # a sorrend még nincs eldöntve
draft: false
---

<!--
VÁZ — tartalom még nincs.

Anyag (kontextus-dokumentum):
  4. pont — a pipeline: parse → segment → review → guard → diff
  5. pont — rétegek, port, adapterek, reuse-boundary (Swift sidecar)
  6. pont — minták ott, ahol problémát oldanak meg, nem katalógusként

Nyitott:
  • Pipeline vs. architektúra: egy oldal két szekcióval, vagy két külön aloldal?
  • Szűkített editek (8. pont): itt teljes leírás, vagy a dogfood oldalon, és innen csak link?
  • Kulcsdöntések (11. pont) közül ide tartozók: védett tartomány a Contextben,
    segment vs. protectedRanges (nem DRY), közös messages.ts, két külön passz.

Kép: a hexagonális ábra-terv.
-->

## Current architecture

<a href="/projects/second-thought/CurrentArchitecture.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/CurrentArchitecture.webp" width="1057" height="959" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Current architecture. The article enters through the VS Code extension or the CLI, which call Review. Review uses the Segmenter and two passes, Language and Editorial, which implement the Passes interface. The passes depend on the LLMClient interface, implemented by the Gemini LlmClient, which calls LLM Provider 1 over HTTPS. The CLI and the extension each create the Gemini client. A second provider is planned." /></a>

## Planned architecture
### Review module plane
In the next version I plan to make a separate module for review, passes and elements. I would like to make one biger mododul. It would be a bit monolitic, but in this phase of the project I think it is acceptable.
<a href="/projects/second-thought/PlannedArchitecture-ReviewModule.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/PlannedArchitecture-ReviewModule.webp" width="682" height="822" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Planned review module. Review collects results from three passes, Language, TechnicalFactCheck and Editorial, which implement the Passes interface and use the LLMClient interface. Two clients, Gemini and a second one, implement LLMClient, each calling its own LLM provider over HTTPS." /></a>

### Application architecture
With the new module I think will be easiear to attach new UI.
I also plan a preprocessor that can make the segments and usual language lector.
<a href="/projects/second-thought/PlannedArchitecture.webp" target="_blank" rel="noopener" class="block cursor-zoom-in my-8" title="Open full-size image"><img src="/projects/second-thought/PlannedArchitecture.webp" width="1132" height="612" loading="lazy" class="w-full h-auto rounded-lg m-0" alt="Planned architecture. The article goes through the Segmenter into the Review module, which uses two LLM providers. Results go to the VS Code extension and the CLI, then through an Output provider to the user." /></a>
