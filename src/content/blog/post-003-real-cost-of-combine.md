---
title: "Stateless? Decoupled? Think Again. The Real cost of Combine in Complex system"
description: How breaks the combine the illusion of isolation?
pubDate: "Apr 22 2025"
---

# Ownership, freshness, and isolation: tradeoffs in Swift data passing

After exploring Swift's recommendation to ["use `struct` by default"](link), I started thinking about how this impacts data ownership, freshness, and system design — especially in reactive contexts like Combine.

In my previous post, I showed that structs can behave like references in terms of performance thanks to Copy-on-Write (COW) — as long as they remain unmutated. They're also safer in terms of side effects. So in a clean architecture, structs are often the best choice.

But let's go deeper. What are the actual tradeoffs between different passing strategies?

- `struct`
- `inout`
- reference

## Passing a `struct`

**Who is the owner?** The module that created the struct.

**Advantages:**

- Stateless
- No side effects
- Reference-like performance (COW)
- Clear SRP-based design
- Easy to debug (only one entry point)
- Easy to unit test
- Thread-safe
- Scalable
- Easy to maintain

**Disadvantages:**

- No freshness — if the data changes, consumers are not notified
- The creator must guarantee consistency — unsafe if misunderstood

## Passing a reference

**Who is the owner?** Everyone who can access the object.

**Advantages:**

- Data stays fresh
- Good performance
- Easy to modify

**Disadvantages:**

- No clear responsibility
- Architecture gets muddy
- Side effects — e.g. race conditions, inconsistent states
- Not thread-safe
- Harder to debug
- Limited scalability

## Hybrid `inout` solution

**Who is the owner?** Any module that gets control over it.

**Advantages:**

- Data stays fresh
- Controlled side effects
- Better separation than shared references
- Easier to debug than reference, though harder than struct
- More scalable than reference

**Disadvantages:**

- COW is broken → worse performance
- Still has side effects
- Adds complexity

## The core tradeoff

You're always navigating between three competing concerns:

| Strategy  | Performance | Isolation | Freshness   |
| --------- | ----------- | --------- | ----------- |
| Struct    | ✅          | ✅        | ❌          |
| Reference | ✅          | ❌        | ✅          |
| `inout`   | ❌          | ✅        | ✅ (partly) |

## Combine enters the picture

So what if you want both freshness *and* performance — but without fully giving up isolation?

Let's see what happens when you use Combine with a struct.

**Who is the owner?** Still the creator module.

**Advantages:**

- Maintains performance (COW)
- Can preserve stateless design
- Easy to debug
- Thread-safe
- Unit testable
- Freshness is solved
- Scalable and maintainable

**Disadvantages:**

- Side effects (even if controlled)
- No true isolation — any module with access can `send()`
- Ownership boundaries become blurred

Combine solves freshness. But it sacrifices ownership and isolation — unless you explicitly design around it.

Now, anyone with access to the subject can mutate the state. The illusion of statelessness breaks. Side effects sneak into seemingly pure modules.

The data flow becomes decoupled from state — so there are two layers of responsibility:

1. **Static snapshot** (initial struct)
2. **Reactive updates** (stream)

## Updated tradeoff matrix

With Combine in the picture, the comparison looks like this:

| Strategy  | Performance | Isolation | Freshness   |
| --------- | ----------- | --------- | ----------- |
| Struct    | ✅          | ✅        | ❌          |
| Reference | ✅          | ❌        | ✅          |
| `inout`   | ❌          | ✅        | ✅ (partly) |
| Combine   | ✅          | ❌        | ✅          |
