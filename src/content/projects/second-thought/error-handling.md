---
title: "Error handling"
# description: a hub kártyáján jelenik meg
project: "second-thought"
order: 2 # a sorrend még nincs eldöntve
draft: true
---

<!--
VÁZ — tartalom még nincs.

Anyag (kontextus-dokumentum):
  7. pont — a bug, a felismerés, hiba mint érték, felelősségi lánc, policy, retry, felhasználói szöveg
  11. pont — idetartozó döntések: LlmResult, retry az adapterben, retryDelay alsó korlát

Nyitott:
  • Mi a határ e között az aloldal és a későbbi hibakezelés-cikk között?
    (Az aloldal mit rögzít, a cikk mit tanít?)

Előtte/utána: nyers 429-JSON vs. „Gemini quota exhausted. Wait a minute and run again.”
-->

During dogfood I faced up savaral issues