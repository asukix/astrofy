---
title: "Value vs Reference"
description: "Structs copy on assignment. Classes share a reference. The choice shapes your entire data flow."
pubDate: "Jun 17 2025"
badge: "Swift"
tags: ["swift", "memory"]
---

# Value vs Reference Types

In Swift, the distinction is fundamental to how your data moves through the system.

**Value types** (structs, enums, tuples) are copied on assignment. Each owner holds an independent instance — mutations in one place never surprise another caller.

**Reference types** (classes, actors) share identity. Two variables can point to the same object, which enables coordination but demands discipline.

Choose value types by default. Reach for classes when you need shared mutable state, identity comparison, or Objective-C interop.
