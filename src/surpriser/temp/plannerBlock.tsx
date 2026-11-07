// TEMPORARY – the gift planner is closed until 2026-11-14 18:00 (UTC+1); after that this code does nothing.
// To remove it: delete this folder (src/surpriser/temp/) and the lines marked "TEMP planner-block" in ui/App.tsx.

import { useEffect, useRef, useState } from "preact/hooks";
import { CONTROLLER } from "../config";
import type { User } from "../model";
import type { Route } from "../ui/router";

/** 2026-11-14 18:00 UTC+1. */
const RELEASE_AT = Date.UTC(2026, 10, 14, 17, 0, 0);
const RELEASE_KEY = "surpriser.plannerReleasedAt";
/** Set by the developer's "lock" button (for trying the block out); also works after the release time. */
const LOCK_KEY = "surpriser.plannerLocked";

export const PLANNER_BLOCKED_MESSAGE = "A funkció fejlesztés alatt.";

export function isPlannerRoute(route: Route): boolean {
  return route.name === "planner" || route.name === "newPlan" || route.name === "editPlan";
}

function lockedByHand(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function releasedEarly(): boolean {
  try {
    const at = Number(localStorage.getItem(RELEASE_KEY));
    return Number.isFinite(at) && at > 0 && at <= Date.now();
  } catch {
    return false;
  }
}

/**
 * Whether the planner is closed here. [release] opens it now on this device (the terminal's command),
 * [lock] closes it again (the developer's button).
 */
export function usePlannerBlock(): { blocked: boolean; release: () => void; lock: () => void } {
  const [blocked, setBlocked] = useState(() => lockedByHand() || (Date.now() < RELEASE_AT && !releasedEarly()));

  useEffect(() => {
    if (!blocked || lockedByHand()) return;
    // Opens by itself at the release time if the page stays open (setTimeout can't wait longer than ~24 days).
    const wait = Math.min(RELEASE_AT - Date.now(), 2 ** 31 - 1);
    const timer = window.setTimeout(() => setBlocked(false), Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [blocked]);

  const release = () => {
    try {
      localStorage.removeItem(LOCK_KEY);
      localStorage.setItem(RELEASE_KEY, String(Date.now()));
    } catch {
      // Without storage it opens for this visit only.
    }
    setBlocked(false);
  };

  const lock = () => {
    try {
      localStorage.removeItem(RELEASE_KEY);
      localStorage.setItem(LOCK_KEY, "1");
    } catch {
      // Without storage it closes for this visit only.
    }
    setBlocked(true);
  };

  return { blocked, release, lock };
}

/** At the bottom of the planner, for the developer's account only: closes the planner again. */
export function PlannerLockButton({ me, onLock }: { me: User; onLock: () => void }) {
  if (me.email.toLowerCase() !== CONTROLLER.email.toLowerCase()) return null;
  return (
    <div class="flex justify-center mt-10">
      <button type="button" class="btn btn-ghost btn-sm text-base-content/60" onClick={onLock}>
        🔒 Tervező lezárása
      </button>
    </div>
  );
}

/** A tiny terminal in the bottom right corner; "Release planning" opens the planner. */
export function PlannerBlockTerminal({ onRelease }: { onRelease: () => void }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const run = (event: Event) => {
    event.preventDefault();
    const typed = command.trim();
    setCommand("");
    if (!typed) return;
    if (typed.toLowerCase().replace(/\s+/g, " ") === "release planning") {
      setLines((l) => [...l, `$ ${typed}`, "ok"]);
      window.setTimeout(onRelease, 600);
    } else {
      setLines((l) => [...l, `$ ${typed}`, `${typed.split(/\s+/)[0]}: command not found`].slice(-12));
    }
  };

  return (
    <>
      <style>{TERMINAL_CSS}</style>
      {open ? (
        <div
          class="sp-tmpterm"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          onClick={() => input.current?.focus()}
        >
          <div class="sp-tmpterm__bar">
            <span />
            <button type="button" class="sp-tmpterm__close" aria-label="×" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <div class="sp-tmpterm__out">
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <form onSubmit={run} class="sp-tmpterm__prompt">
              <span>$</span>
              <input
                ref={input}
                value={command}
                onInput={(e) => setCommand(e.currentTarget.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellcheck={false}
                aria-label="$"
              />
            </form>
          </div>
        </div>
      ) : (
        <button type="button" class="sp-tmpterm__open" aria-label=">_" onClick={() => setOpen(true)}>
          &gt;_
        </button>
      )}
    </>
  );
}

const TERMINAL_CSS = `
.sp-tmpterm__open {
  position: fixed; right: 12px; bottom: 12px; z-index: 40;
  width: 34px; height: 26px; border-radius: 6px;
  background: #1e1b2e; color: #9be89b; opacity: 0.55;
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.sp-tmpterm__open:hover, .sp-tmpterm__open:focus-visible { opacity: 1; }
.sp-tmpterm {
  position: fixed; right: 12px; bottom: 12px; z-index: 40;
  width: min(340px, calc(100vw - 24px));
  border-radius: 8px; overflow: hidden;
  background: #14121f; color: #c8f7c8;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.sp-tmpterm__bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 2px 6px 2px 10px; background: #26223a;
}
.sp-tmpterm__close { color: #b9b4d0; font-size: 16px; line-height: 1; padding: 2px 6px; }
.sp-tmpterm__out { padding: 8px 10px 10px; max-height: 40vh; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
.sp-tmpterm__prompt { display: flex; gap: 6px; }
.sp-tmpterm__prompt input {
  flex: 1; min-width: 0; background: transparent; border: 0; outline: none !important; box-shadow: none !important;
  color: inherit; font: inherit; caret-color: #9be89b;
}
`;
