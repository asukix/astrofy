import { useState } from "preact/hooks";
import type { MyList } from "../data/board";
import { canAddCoParent, isRegistered } from "../data/children";
import type { EditableList, Person, Wish } from "../model";
import { S } from "../strings";
import { Avatar } from "./components";
import { EditableWishList, privacyLabel, type RowOptions } from "./MyListSection";
import { href } from "./router";

interface Handlers {
  onMove: (orders: Map<string, number>) => Promise<void>;
  onRestore: (wish: Wish) => Promise<void>;
  onClearReceived: () => Promise<void>;
}

/**
 * A child's list or a shared list, as one of its editors sees it (ChildCard / GroupCard in the app).
 * As a parent, a wish opens its details: I may buy it too, and edit it from there. As a member of a
 * shared list (a registered child), it opens the editor, like my own list.
 */
export function ManagedListCard({
  list,
  wishes,
  people,
  bookedByMe,
  onDelete,
  ...handlers
}: Handlers & {
  list: EditableList;
  wishes: MyList;
  people: Person[];
  bookedByMe: Set<string>;
  /** Deletes the child; false when it didn't happen. */
  onDelete?: () => Promise<boolean>;
}) {
  const child = list.child;
  const asParent = !list.isOwn;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const row = (wish: Wish): RowOptions => ({
    privacy: privacyLabel(wish, people, asParent ? S.privateOnlyParents : S.privateOnlyMe),
    // Received gifts are gone from the givers' view: those open the editor (to restore them).
    to: asParent && wish.receivedAt === null ? href.wish(wish.id) : undefined,
    bookedByMe: bookedByMe.has(wish.id),
    receivedLabel: asParent ? S.markReceivedChild : S.statusReceivedOwner,
  });

  const subtitle = child
    ? child.email === null
      ? S.childNoEmail
      : isRegistered(child)
        ? S.childRegistered(child.email)
        : S.childEmailPending(child.email)
    : S.groupSubtitle;
  const parents = child ? child.managers.map((id) => child.managerNames[id]).filter((n): n is string => !!n) : [];

  return (
    <article class="sp-card">
      <header class="sp-card__head">
        <Avatar person={{ id: list.ownerId, displayName: list.name } as Person} />
        <div class="min-w-0 flex-1">
          <h3 class="sp-card__name">{list.name}</h3>
          <p class="sp-card__sub sp-card__sub--wrap">{subtitle}</p>
          {parents.length > 1 && <p class="sp-card__sub sp-card__sub--wrap">{S.childParents(parents.join(" és "))}</p>}
        </div>
        {child && onDelete && (
          <ChildMenu
            childId={child.id}
            canAddCoParent={canAddCoParent(child)}
            canDelete={!isRegistered(child)}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
      </header>

      {child && onDelete && confirmDelete && (
        <div class="sp-confirm mx-4 mb-3" role="alertdialog" aria-label={S.deleteChildTitle}>
          <p class="font-semibold">{S.deleteChildTitle}</p>
          <p class="mt-1 text-sm">{S.deleteChildMessage(child.name)}</p>
          <div class="flex gap-2 mt-3">
            <button
              type="button"
              class="btn btn-error btn-sm"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  if (!(await onDelete())) setConfirmDelete(false);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting && <span class="loading loading-spinner loading-xs" />}
              {S.childDelete}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              {S.cancel}
            </button>
          </div>
        </div>
      )}

      <div class="px-3 pb-1">
        <a href={href.newWish(list.ownerId)} class="btn btn-ghost btn-sm text-primary">
          {S.childAddWish}
        </a>
      </div>

      <EditableWishList
        list={wishes}
        emptyText={child ? S.childListEmpty : S.groupListEmpty}
        row={row}
        {...handlers}
      />
    </article>
  );
}

function ChildMenu({
  childId,
  canAddCoParent,
  canDelete,
  onDelete,
}: {
  childId: string;
  canAddCoParent: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const close = (e: Event) => (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
  return (
    <details class="dropdown dropdown-end shrink-0">
      <summary class="btn btn-ghost btn-sm btn-square" aria-label={S.childMenu}>
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </summary>
      <ul class="dropdown-content menu z-30 mt-1 w-56 rounded-box bg-base-100 p-2 shadow-lg border border-base-300">
        <li>
          <a href={href.editChild(childId)} onClick={close}>
            {S.childEdit}
          </a>
        </li>
        {canAddCoParent && (
          <li>
            <a href={href.coParent(childId)} onClick={close}>
              {S.childCoParent}
            </a>
          </li>
        )}
        {canDelete && (
          <li>
            <button
              type="button"
              class="text-error"
              onClick={(e) => {
                close(e);
                onDelete();
              }}
            >
              {S.childDelete}
            </button>
          </li>
        )}
      </ul>
    </details>
  );
}
