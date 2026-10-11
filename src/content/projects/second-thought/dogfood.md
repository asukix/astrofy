---
title: "Dogfood"
description: I tested Second Thought on my blog.
project: "second-thought"
order: 3 # a sorrend még nincs eldöntve
draft: false
---

## Why I used dogfooding

After I finished my first version of Second Thought, I wanted to try it. I had draft articles, but only two. So I decided to check my existing blog posts and deep bits to get useful information and reveal issues in my project. Another motivation was to make my articles better.

## Article fixes

During dogfooding I got a lot of feedback from the tool, and I made several fixes to my articles. It was a good help to improve their quality. My plan is to continue checking my articles.

## How did dogfooding help me?

When I tried it on my articles, fortunately I found several issues that helped me improve the quality.

### Narrowing the result

I had a language error with one word: "give", with the suggested fix "would give". The LLM gave back a whole sentence instead of the exact word. This is noise for the user, so I built in multiple checks to narrow the result from the LLM:
- The language pass tries to locate the exact part of the change with a helper.
- The LLM got a rule to provide the changes precisely, with location information.
- A fallback logic works between the previous mechanisms. If the first fails, I use the second solution.

### Guard and protected ranges

The language pass made a correction inside inline code and suggested replacing `let` with ``let``.
I added protected ranges to keep several parts of the article unchanged by language suggestions, like code blocks, inline code, frontmatter or HTML elements.
I also added a guard to keep the protected ranges untouched.

### Planned placeholders

The editorial pass made suggestions because it can't see some parts of the article because of the protected ranges. With placeholders I can tell it that there is a code block or some HTML there, to get better suggestions. The code block part is already partly fixed.

### Planned new persona

The editorial pass makes suggestions for technical articles, where I have or should have code or concrete examples. It is usually good, but not always. Sometimes I write reflective essays. In this case I need a different persona for editorial suggestions.
