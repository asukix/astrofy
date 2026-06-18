---
title: "Progressive Disclosure"
pubDate: "Jun 18 2026"
tags: ["AI", "Agent", "Progressive Disclosure"]
badge: "Agents"
---

A monolithic context.md quietly dilutes an agent's accuracy: every run loads everything, relevant or not.
A simple structural change helps — progressive disclosure. Instead of one large context file, split it: keep a small table of contents that links to short, focused detail files.
This decouples total knowledge from per-run context. The knowledge base can grow, but any single run loads only the index plus the one relevant file — so the context stays small and focused, and accuracy improves.
The trade-off: complexity goes up. The index becomes a retrieval gate — the agent may load the wrong file, or none — and the split files need maintenance. An acceptable cost, but a real one.
