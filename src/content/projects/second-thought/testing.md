---
title: "Testing"
description: Test pyramid in the project.
project: "second-thought"
order: 4
draft: false
---

In the project I followed the test pyramid. Most of the tests are unit tests. Integration tests use fake passes and a fake LLM to test the whole review flow, and a few end-to-end tests run the CLI as a real process.
There is also a live smoke test that checks the whole chain against the real Gemini API. It is skipped by default and runs only with `SECOND_THOUGHT_LIVE=1`.