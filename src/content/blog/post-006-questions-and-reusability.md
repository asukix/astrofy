---
title: "Questions and reusability"
description: When you design a system questions are important. But the way of questioning also important
pubDate: "Dec 23 2025"
heroImage: "/post_img.webp"
---


Reusability is a very good concept. If a function or module can be reused, the code becomes clearer, smaller, more modular, you don't repeat yourself, and the solution feels nice.

Let's start building questions. Our base question is: **Is reusability good?**

And we always ask: *How should I modify this question to help my thinking?*

## "Is reusability good?"

Asking questions — and asking them in a better way — is important for clarifying our thinking.

We can ask: **Is reusability good?** This is a very basic question, and you'll probably just answer yes or no. It doesn't help you think.

Modify it a bit: **Is reusability *always* good?** Now the question is a little more nuanced, and you can sense that maybe it isn't.

To make the question more scalable, change it with *when*: **When is reusability good?** This actually gets you thinking, and helps you find answers like *"the code will be modular"*, *"I won't repeat myself"*, or *"I can use the code in more places."* You start finding the advantages.

Now we have answers, and we have arguments in favor of reusability. That helps us understand it better.

## Flipping the question

Okay, we understand reusability and we know how to use it. But we should also know **when we need to use it and when we don't.** So how should we modify the question to help thinking?

Adding a negation always helps thinking about disadvantages: **When is reusability *not* good?**

Let's take an example:

- When a screen is reusable and is used in 2 different places, reusability raises the number of test cases. You have to validate a single change across 2 different flows in 2 different places. The real question here is: *what is the time we actually save?* We gain some development time, but we lose testing time. Maintenance also takes more time and adds extra risk and complexity. So you may save some time and produce cleaner code — but you may lose more. In this case a copy can be the better choice.

## Trading off

Now we have two questions that together clarify that reusability has both advantages *and* disadvantages. So we can make a tradeoff based on the answers and decide whether to make the code reusable or not.

Some important aspects to consider:

- Maintenance
- Scalability
- Testability and testing (not just unit tests — application testing as well)
- Reusability itself

## Recap

- Better questions lead to better answers and better code.
- Reusability is a good and frequently used tool. In most cases it's the right call — but like everything else, it has advantages and disadvantages. You just have to consider whether it's worth it in your situation.

This post isn't really about reusability. **It's about how to ask better architectural questions.**
