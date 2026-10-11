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

Lehetséges ív:
  1. A bug: a 429 parse-errorként jelent meg (egy catch-all elnyelte), a nyers JSON kiszivárgott.
  2. A felismerés: a TS típusa nem mondja meg, mit dobhat egy függvény → a hiba láthatatlan.
  3. A döntés: a hiba érték (LlmResult, zárt LlmErrorKind lista); a váratlan marad kivétel.
  4. A felelősségi lánc: adapter fordít → port szerződés → passz jelent → review() dönt → presentation fogalmaz.
  5. A policy: fail-fast rendszerszintű hibánál, folytatás a bad-requestnél; retry az adapterben.
  6. Az ár: több rétegen átnyúló változtatás, több boilerplate.

Második példa ugyanarra a mintára (2026-10):
  Az editorial pass ellenőrzés nélkül vette át az LLM JSON-ját → üzenet nélküli finding →
  VS Code: „TypeError: message must be set”. Javítás a határon: a válasz nem megbízható adat
  (üres üzenet → kategória, ha az sincs → kihagyás). Tanulság: a hiba ott javítandó, ahol
  a nem ellenőrzött adat belép, nem ott, ahol felrobban.

Kódrészletek (rövidek):
  • LlmErrorKind / LlmResult típus (ports/llm.ts)
  • a SYSTEMIC halmaz és a fail-fast (review.ts)
  • a backoff mint adat a tesztben: [2000, 4000, 8000, 16000]

Előtte/utána: nyers 429-JSON vs. „Gemini quota exhausted. Wait a minute and run again.”

Planned (csak utalás): retry az adapterben, fallback a modulban, fail-fast a review-ban →
  ki dönt melyik hibáról? (nyitott kérdés, lásd planned architektúra)

Nyitott:
  • Mi a határ ez az aloldal és a későbbi hibakezelés-cikk között?
    (Az aloldal mit rögzít, a cikk mit tanít?)
    Egy lehetséges válasz: az aloldal a „mi történt és mit döntöttem” (ennél a projektnél),
    a cikk az átvihető gondolat („ki dönt a hibáról?”), a projekt csak példa benne.
-->

During dogfood I faced up savaral issues