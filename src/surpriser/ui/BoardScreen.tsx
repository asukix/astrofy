import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { previewOf, type Board, type PersonWishes } from "../model";
import { S } from "../strings";
import { Avatar, HomeScreenHint, personSubtitle, Spinner, WishRow } from "./components";
import { href } from "./router";

export function BoardScreen({
  board,
  myList,
  pendingSent,
  onRespond,
}: {
  board: Board;
  /** My own list, rendered above everyone else's. */
  myList: ComponentChildren;
  /** How many of my invitations wait for an answer. */
  pendingSent: number;
  onRespond: (invitationId: string, accept: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (board.loading && board.people.length === 0 && board.managed.length === 0) return <Spinner />;

  const card = (list: PersonWishes) => (
    <PersonCard
      key={list.person.id}
      list={list}
      expanded={expanded.has(list.person.id)}
      onToggle={() => toggle(list.person.id)}
      onRespond={onRespond}
    />
  );

  return (
    <div class="flex flex-col gap-8">
      <HomeScreenHint />
      {myList}

      {board.managed.length > 0 && (
        <section aria-labelledby="sp-children">
          <h2 id="sp-children" class="sp-section-title">
            {S.children}
          </h2>
          <p class="sp-section-hint">{S.managedHint}</p>
          <div class="flex flex-col gap-4">{board.managed.map(card)}</div>
        </section>
      )}

      <section aria-labelledby="sp-people">
        <div class="sp-section-head">
          <h2 id="sp-people" class="sp-section-title">
            {S.people}
          </h2>
          <a href={href.invite()} class="btn btn-outline btn-sm">
            {S.invite}
            {pendingSent > 0 && <span class="badge badge-ghost badge-sm">{pendingSent}</span>}
          </a>
        </div>
        {board.people.length === 0 ? (
          <p class="sp-empty">{S.peopleEmpty}</p>
        ) : (
          <div class="flex flex-col gap-4">{board.people.map(card)}</div>
        )}
      </section>

      <p class="text-sm text-base-content/60 text-center px-6">{S.appOnlyNote}</p>
    </div>
  );
}

function PersonCard({
  list,
  expanded,
  onToggle,
  onRespond,
}: {
  list: PersonWishes;
  expanded: boolean;
  onToggle: () => void;
  onRespond: (invitationId: string, accept: boolean) => Promise<void>;
}) {
  const { person, wishes } = list;
  const preview = previewOf(list);
  const shown = expanded ? wishes : preview;
  const [answering, setAnswering] = useState(false);
  const invitationId = person.relation === "INVITED_ME" ? person.pendingInvitationId : null;

  const answer = async (accept: boolean) => {
    if (!invitationId) return;
    setAnswering(true);
    try {
      await onRespond(invitationId, accept);
    } finally {
      setAnswering(false);
    }
  };

  return (
    <article class={`sp-card ${invitationId ? "sp-card--invite" : ""}`}>
      <header class="sp-card__head">
        <Avatar person={person} />
        <div class="min-w-0">
          <h3 class="sp-card__name">{person.displayName}</h3>
          {personSubtitle(person) && <p class="sp-card__sub">{personSubtitle(person)}</p>}
        </div>
      </header>

      {invitationId && (
        <div class="sp-invite">
          <p>{S.invitedYou}</p>
          <div class="flex gap-2 mt-3">
            <button type="button" class="btn btn-primary btn-sm" disabled={answering} onClick={() => answer(true)}>
              {S.accept}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" disabled={answering} onClick={() => answer(false)}>
              {S.decline}
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p class="sp-card__empty">{wishes.length === 0 ? S.personNoWishes : S.personAllBooked}</p>
      ) : (
        <ul class="sp-wishlist">
          {shown.map((wish) => (
            <li key={wish.id}>
              <WishRow wish={wish} />
            </li>
          ))}
        </ul>
      )}

      {wishes.length > preview.length && (
        <div class="flex justify-end px-2 pb-2">
          <button type="button" class="btn btn-ghost btn-sm text-primary" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? S.showLess : S.showAll(wishes.length)}
          </button>
        </div>
      )}
    </article>
  );
}
