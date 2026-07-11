---
title: "hehe testem"
pubDate: "JuL 24 2026"
tags: ["AI", "Agent", "Harness"]
---

You choose a custom agent with a read tool, but it modifies the code. This means you referenced the custom agent's description instead of invoking it.
Frontmatter constraints are enforced by the harness, not by the model that reads them. So when you set your constraints in the frontmatter and just reference it, the "read only" constraint will be ignored by the model. A constraint only constrains where something enforces it. Everywhere else it's only a suggestion.
