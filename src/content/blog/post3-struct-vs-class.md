---
title: "Struct vs Class in Swift: Understanding the Real Tradeoffs Behind the Recommendation"
description: "How to really choose between stuct and class? Understand them and you always know"
pubDate: "Apr 20 2025"
heroImage: "/post_img.webp"
badge: "Demo Badge"
---

# Swift recommends `struct` by default — but why?

Let's explore the hidden logic behind value semantics, Copy-on-Write (COW), and real-world performance tradeoffs.

## Value semantics with reference efficiency — under the hood

Swift has an interesting recommendation: **use `struct` by default.** But when should we actually prefer value types over reference types?

Apple's official docs explain it this way:

> "Because structures are value types — unlike classes — local changes to a structure aren't visible to the rest of your app unless you intentionally communicate those changes as part of the flow of your app."
>
> — [Choosing Between Structures and Classes](https://developer.apple.com/documentation/swift/choosing-between-structures-and-classes)

This is why Swift encourages stateless design. If you use a `struct`, its value is defined when passed into a function. To modify it, you must explicitly indicate your intent using `inout`.

So why is this better? Let's break it down:

- Reference types are generally faster → better raw performance.
- Value types can't have side effects → easier to reason about and debug.

But here's where Swift shows its genius: it uses **Copy-on-Write (COW)** optimization behind the scenes. That means if you pass around a whole struct, you're actually just passing a shared reference — until you modify it.

You get a stateless value type, but with reference-like speed.

## The real choice

Sounds perfect, right? Well… there's a twist.

If you modify the struct, it will be copied — and now you lose that hidden performance boost. So here comes the real tradeoff:

- Do you want **maximum performance** (UX)?
- Or do you prefer **safety and readability** (easier maintenance, fewer bugs)?

If you understand this, you can tweak your implementation. You can design a component with Single Responsibility (SRP) and stateless logic, then pass the needed data into it via a separate struct (context). This helps:

- preserve performance (COW stays in place),
- maintain clarity (statelessness),
- improve scalability (modular components).

But don't overuse this approach — it won't always help. **Optimization without clarity becomes a hidden cost.**
