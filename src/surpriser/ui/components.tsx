import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { formatHuf, safeUrl } from "../format";
import type { Person, ViewedWish, Wish } from "../model";
import { S } from "../strings";
import { href } from "./router";

// region Icons (inline, so the page needs no icon font)

type IconProps = { class?: string };
const svg = (path: ComponentChildren) => (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class={props.class}
  >
    {path}
  </svg>
);

export const IconBack = svg(<path d="M15 18l-6-6 6-6" />);
export const IconExternal = svg(
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </>,
);
export const IconGift = svg(
  <>
    <rect x="3.5" y="9" width="17" height="11.5" rx="2" />
    <path d="M2.5 9h19M12 9v11.5" />
    <path d="M12 9c-1.5-3.5-5.5-4.5-6-2s3 2 6 2zM12 9c1.5-3.5 5.5-4.5 6-2s-3 2-6 2z" />
  </>,
);
export const IconTag = svg(
  <>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </>,
);

// endregion

/** The app icon, as on the Play Store listing. */
export function AppMark({ size = 36 }: { size?: number }) {
  return <img src="/apps/surpriser/icon-192.png" width={size} height={size} alt="" class="rounded-[28%] shrink-0" />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div class="flex flex-col items-center gap-3 py-16 text-base-content/60" role="status">
      <span class="loading loading-dots loading-md text-primary" />
      {label && <span class="text-sm">{label}</span>}
    </div>
  );
}

/** A soft colour per person, so the lists are easy to tell apart at a glance. */
function hueOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ person }: { person: Person }) {
  const initials = person.displayName
    .split(/[\s,]+/)
    .filter((part) => part && part !== "és")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hue = hueOf(person.id);
  return (
    <span
      class="sp-avatar"
      style={{ "--h": hue } as Record<string, string | number>}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

export function personSubtitle(person: Person): string {
  if (person.isGroup) return S.groupSubtitle;
  if (person.isChild && person.parentNames.length > 0) return S.childOf(person.parentNames.join(" és "));
  return person.email;
}

export function Thumbnail({ url, size = 56 }: { url: string | null; size?: number }) {
  const src = safeUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const style = { width: `${size}px`, height: `${size}px` };
  if (!src || failed) {
    return (
      <span class="sp-thumb sp-thumb--empty" style={style} aria-hidden="true">
        <IconGift />
      </span>
    );
  }
  return (
    <img
      class="sp-thumb"
      style={style}
      src={src}
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function StatusPill({ wish, hideMine = false }: { wish: ViewedWish; hideMine?: boolean }) {
  if (wish.isReceived) return <span class="sp-pill sp-pill--done">{S.statusReceived}</span>;
  if (wish.status === "BOOKED_BY_ME" && hideMine) return null;
  if (wish.status === "BOOKED_BY_ME") return <span class="sp-pill sp-pill--mine">{S.statusBookedByMe}</span>;
  if (wish.status === "BOOKED") return <span class="sp-pill">{S.statusBooked}</span>;
  return null;
}

/** One wish in a list; the whole row opens its details. [inBookings]: on My bookings every row is mine, so only "Átadva" is worth a pill. */
export function WishRow({ wish, meta, inBookings = false }: { wish: ViewedWish; meta?: string; inBookings?: boolean }) {
  const taken = wish.status === "BOOKED" || wish.isReceived;
  return (
    <a
      href={href.wish(wish.id)}
      class={`sp-wish ${wish.status === "BOOKED_BY_ME" ? "sp-wish--mine" : ""} ${taken ? "sp-wish--taken" : ""}`}
    >
      <Thumbnail url={wish.imageUrl} />
      <span class="min-w-0 flex-1">
        <span class="sp-wish__name">{wish.name}</span>
        <span class="sp-wish__meta">
          <span class="sp-price">{formatHuf(wish.priceHuf)}</span>
          {meta && <span class="truncate">{meta}</span>}
        </span>
      </span>
      <StatusPill wish={wish} hideMine={inBookings} />
    </a>
  );
}

export function TopBar({
  title,
  onBack,
  actions,
}: {
  title: string;
  onBack?: () => void;
  actions?: ComponentChildren;
}) {
  return (
    <header class="sp-topbar">
      <div class="sp-container flex items-center gap-2 h-16">
        {onBack ? (
          <button type="button" class="btn btn-ghost btn-circle btn-sm -ml-2" onClick={onBack} aria-label={S.back}>
            <IconBack />
          </button>
        ) : (
          <a href={href.board()} aria-label={S.appName} class="-ml-1">
            <AppMark size={32} />
          </a>
        )}
        <h1 class="sp-topbar__title">{title}</h1>
        <div class="ml-auto flex items-center gap-1">{actions}</div>
      </div>
    </header>
  );
}

/** A wish on my own list, as its owner sees it: never who booked it, only that someone did. */
export function OwnWishRow({
  wish,
  privacy,
  trailing,
}: {
  wish: Wish;
  /** "Privát: …" when only some people see it. */
  privacy: string | null;
  trailing?: ComponentChildren;
}) {
  const pill = wish.receivedAt
    ? <span class="sp-pill sp-pill--done">{S.statusReceivedOwner}</span>
    : wish.booked
      ? <span class="sp-pill sp-pill--owner">{S.statusBookedOwner}</span>
      : wish.requestedFields.length > 0
        ? <span class="sp-pill sp-pill--ask">{S.statusInfoRequested}</span>
        : null;
  return (
    <div class="sp-wish">
      <a href={href.editWish(wish.id)} class="sp-wish__link">
        <Thumbnail url={wish.imageUrl} />
        <span class="min-w-0 flex-1">
          <span class="sp-wish__name">{wish.name}</span>
          <span class="sp-wish__meta">
            <span class="sp-price">{formatHuf(wish.priceHuf)}</span>
            {privacy && <span class="truncate">{privacy}</span>}
          </span>
        </span>
        {pill}
      </a>
      {trailing}
    </div>
  );
}

/** Short-lived confirmation or error at the bottom of the screen, optionally with one action (e.g. undo). */
export interface ToastMessage {
  id: number;
  text: string;
  error?: boolean;
  action?: { label: string; run: () => void };
}

export function Toast({ message, onDismiss }: { message: ToastMessage | null; onDismiss: () => void }) {
  return (
    <div class="sp-toast-region" aria-live="polite">
      {message && (
        <div key={message.id} class={`sp-toast ${message.error ? "sp-toast--error" : ""}`} role={message.error ? "alert" : "status"}>
          <span>{message.text}</span>
          {message.action && (
            <button
              type="button"
              class="sp-toast__action"
              onClick={() => {
                message.action?.run();
                onDismiss();
              }}
            >
              {message.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
