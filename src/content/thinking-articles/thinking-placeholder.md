---
title: "Reference semantics in 1 sentence"
description: "..."
pubDate: "Jul 15 2026"
tags: ["iOS in 1 Sentence"]
thinking: true
---

<Thought>

<Q>

Two variables point at the same class instance. You change a property through one of them.

What happens to the other — and *why* that, specifically?

</Q>

<Mine>

The property isn't copied between them. Both names address the same heap object, so there's only one piece of state.

</Mine>

</Thought>

Most of the confusion here isn't about references. It's about what a name actually is.

<Extra>
  Pick any reference you wrote today. From the call site alone — could you tell whether mutating it changes someone else's state?
</Extra>
