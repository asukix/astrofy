import { useState } from "preact/hooks";
import type { MyList } from "../data/board";
import { isPrivate, type Person, type Wish } from "../model";
import { S } from "../strings";
import { OwnWishRow } from "./components";
import { href } from "./router";

/** "Privát: csak te látod" / "Privát: Anna, Béla"; null for a wish everyone sees. */
export function privacyLabel(wish: Wish, people: Person[]): string | null {
  if (!isPrivate(wish)) return null;
  const names = (wish.audience ?? [])
    .map((id) => people.find((p) => p.id === id)?.displayName)
    .filter((n): n is string => !!n);
  return names.length === 0 ? S.privateOnlyMe : S.privateFor(names.join(", "));
}

/** New sort orders after moving one wish a step (WishOrdering.move in the app): positions 0, 1, 2… */
export function moveWish(wishes: Wish[], wishId: string, step: -1 | 1): Map<string, number> {
  const index = wishes.findIndex((w) => w.id === wishId);
  const target = index + step;
  const result = new Map<string, number>();
  if (index < 0 || target < 0 || target >= wishes.length) return result;
  const reordered = wishes.slice();
  reordered.splice(target, 0, ...reordered.splice(index, 1));
  reordered.forEach((w, position) => {
    if (w.sortOrder !== position) result.set(w.id, position);
  });
  return result;
}

export function MyListSection({
  list,
  people,
  planCount,
  onMove,
  onRestore,
  onClearReceived,
}: {
  list: MyList;
  people: Person[];
  /** Plans on the lists I edit, shown on the planner link. */
  planCount: number;
  onMove: (orders: Map<string, number>) => Promise<void>;
  onRestore: (wish: Wish) => Promise<void>;
  onClearReceived: () => Promise<void>;
}) {
  const [reordering, setReordering] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="sp-mine">
      <div class="sp-section-head">
        <h2 id="sp-mine" class="sp-section-title">
          {S.myList}
        </h2>
        <a href={href.newWish()} class="btn btn-primary btn-sm">
          + {S.addWish}
        </a>
      </div>

      <article class="sp-card">
        {list.open.length === 0 ? (
          <p class="sp-card__empty pt-4">{S.myListEmpty}</p>
        ) : (
          <>
            {reordering && <p class="sp-card__hint">{S.reorderHint}</p>}
            <ul class="sp-wishlist">
              {list.open.map((wish, i) => (
                <li key={wish.id}>
                  <OwnWishRow
                    wish={wish}
                    privacy={privacyLabel(wish, people)}
                    trailing={
                      reordering && (
                        <span class="flex shrink-0">
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm btn-square"
                            aria-label={S.moveUp(wish.name)}
                            disabled={busy || i === 0}
                            onClick={() => run(() => onMove(moveWish(list.open, wish.id, -1)))}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm btn-square"
                            aria-label={S.moveDown(wish.name)}
                            disabled={busy || i === list.open.length - 1}
                            onClick={() => run(() => onMove(moveWish(list.open, wish.id, 1)))}
                          >
                            ↓
                          </button>
                        </span>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
            {list.open.length > 1 && (
              <div class="flex justify-end px-2 pb-2">
                <button type="button" class="btn btn-ghost btn-sm text-primary" onClick={() => setReordering(!reordering)}>
                  {reordering ? S.reorderDone : S.reorder}
                </button>
              </div>
            )}
          </>
        )}

        {list.received.length > 0 && (
          <details class="sp-received">
            <summary>{S.receivedSection(list.received.length)}</summary>
            <ul class="sp-wishlist">
              {list.received.map((wish) => (
                <li key={wish.id}>
                  <OwnWishRow
                    wish={wish}
                    privacy={null}
                    trailing={
                      <button type="button" class="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => onRestore(wish))}>
                        {S.restore}
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
            <div class="px-4 pb-4 text-sm text-base-content/70">
              <p>{S.receivedAutoClear}</p>
              {confirmClear ? (
                <div class="sp-confirm mt-3">
                  <p class="font-semibold">{S.receivedClearTitle}</p>
                  <p class="mt-1">{S.receivedClearMessage}</p>
                  <div class="flex gap-2 mt-3">
                    <button
                      type="button"
                      class="btn btn-error btn-sm"
                      disabled={busy}
                      onClick={() => run(async () => {
                        await onClearReceived();
                        setConfirmClear(false);
                      })}
                    >
                      {S.receivedClear}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                      {S.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" class="btn btn-ghost btn-sm text-primary mt-2 -ml-3" onClick={() => setConfirmClear(true)}>
                  {S.receivedClear}
                </button>
              )}
            </div>
          </details>
        )}
      </article>
      <a href={href.planner()} class="btn btn-ghost btn-sm text-primary mt-2">
        {S.plannerLink(planCount)}
      </a>
    </section>
  );
}
