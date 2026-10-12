---
title: "Error handling"
description: There is a layered error handling in the project.
project: "second-thought"
order: 2
draft: false
---

During dogfooding I ran into several issues:

- 429 errors once I exceeded Gemini's free-tier limit
- dropped network connections that skipped the retry
- an unclosed HTML tag (`<br>`) that broke parsing and crashed the run
- and the most misleading one: a 429 that showed up as a parse error

They were a good opportunity to improve the error handling. I fixed them one by one first,
then redesigned the error handling across the layers.

## Error fixes

First I fixed the issues one by one as the dogfooding surfaced them. On a 429 or a network error,
the Gemini adapter now retries with exponential backoff. An unparsable file (for example an unclosed `<br>`)
no longer crashes the run: a parse guard turns it into a single error finding.

## Layered error handling

The most instructive bug was a 429 that showed up as a parse error: a catch-all swallowed the real cause.
Until then the project only caught errors and tried to recover. At this point I stopped and designed
the error handling: errors became values, and each layer got one job.

### Error layers

- **Mapping (adapter):** the adapter retries first. If that doesn't help, it translates the provider's
  error into one of our own error kinds. The raw response never crosses the port.

```ts
  if (status === 429) {
    return { kind: "rate-limited", message: "Gemini: quota exhausted (429).", retryAfterMs };
  }
```

- **Contract (port):** the port defines that a call returns a value, not an exception.

```ts
  export type LlmResult =
    | { ok: true; text: string }
    | { ok: false; error: LlmError };
```

- **Forwarding (pass):** a pass doesn't decide and doesn't hide the error, it just reports it.

```ts
  if (!result.ok) return { findings: [], llmError: result.error };
```

- **Decision (core):** `review()` sees the whole run, so the policy lives here. On a systemic error it stops
  the remaining passes (fail-fast); a `bad-request` is local, so the next pass still runs.

```ts
  const SYSTEMIC = new Set(["rate-limited", "unavailable", "auth"]);
  // ...
  if (outcome.llmError) {
    findings.push(llmErrorFinding(outcome.llmError));
    if (SYSTEMIC.has(outcome.llmError.kind)) break;
  }
```

- **Presentation (frontends):** the error category becomes a message the user can act on.

```ts
  case LlmErrorCategory["rate-limited"]:
    return "Gemini quota exhausted. Wait a minute and run again.";
```