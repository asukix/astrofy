import { useState } from "preact/hooks";
import { formatHuf, hostOf, safeUrl } from "../format";
import type { ViewedWish, WishField } from "../model";
import { S } from "../strings";
import { IconExternal, IconGift, StatusPill } from "./components";

const REQUESTS: { field: WishField; action: string; label: string; isEmpty: (w: ViewedWish) => boolean }[] = [
  { field: "DESCRIPTION", action: S.requestDescription, label: S.fieldDescription, isEmpty: (w) => !w.description },
  { field: "IMAGE_URL", action: S.requestImage, label: S.fieldImage, isEmpty: (w) => !w.imageUrl },
  { field: "PRODUCT_URL", action: S.requestLink, label: S.fieldLink, isEmpty: (w) => !w.productUrl },
];

export function WishDetailsScreen({
  wish,
  canRequestInfo,
  onBook,
  onUnbook,
  onRequest,
}: {
  wish: ViewedWish;
  /** Not on my own children's lists: there I'm an editor, and editors fill fields in rather than ask. */
  canRequestInfo: boolean;
  onBook: () => Promise<void>;
  onUnbook: () => Promise<void>;
  onRequest: (field: WishField) => Promise<void>;
}) {
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

  const image = safeUrl(wish.imageUrl);
  const link = safeUrl(wish.productUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const mine = wish.status === "BOOKED_BY_ME";

  const statusText = wish.isReceived
    ? S.statusReceivedByMeLong
    : mine
      ? S.statusBookedByMeLong
      : wish.status === "BOOKED"
        ? S.statusBookedLong
        : S.statusAvailable;

  const missing = REQUESTS.filter((r) => r.isEmpty(wish));
  const canRequest = canRequestInfo && !wish.isReceived && missing.length > 0;

  return (
    <article class="flex flex-col gap-5">
      <div class={`sp-hero-image ${image && !imageFailed ? "" : "sp-hero-image--empty"}`}>
        {image && !imageFailed ? (
          <img src={image} alt={wish.name} referrerpolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <IconGift class="w-12 h-12" />
        )}
      </div>

      <header>
        <h2 class="sp-detail-title">{wish.name}</h2>
        <div class="flex items-center gap-3 mt-2">
          <span class="sp-detail-price">{formatHuf(wish.priceHuf)}</span>
          <StatusPill wish={wish} />
        </div>
      </header>

      {wish.description && <p class="sp-description">{wish.description}</p>}

      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer nofollow" class="btn btn-outline justify-between">
          <span class="flex flex-col items-start leading-tight text-left">
            <span>{S.openLink}</span>
            <span class="text-xs font-normal text-base-content/60">{hostOf(link)}</span>
          </span>
          <IconExternal />
        </a>
      )}

      <section class={`sp-booking ${mine ? "sp-booking--mine" : ""}`} aria-live="polite">
        <p>{statusText}</p>
        {!wish.isReceived && wish.status === "AVAILABLE" && (
          <button type="button" class="btn btn-secondary w-full mt-4" disabled={busy} onClick={() => run(onBook)}>
            {busy && <span class="loading loading-spinner loading-sm" />}
            {S.book}
          </button>
        )}
        {!wish.isReceived && mine && (
          <button type="button" class="btn btn-ghost w-full mt-3" disabled={busy} onClick={() => run(onUnbook)}>
            {S.unbook}
          </button>
        )}
        {!wish.isReceived && wish.status !== "BOOKED" && <p class="text-xs mt-3 opacity-70">{S.anonymityNote}</p>}
      </section>

      {canRequest && (
        <section>
          <h3 class="font-bold">{S.missingInfo}</h3>
          <p class="text-sm text-base-content/70 mb-3">{S.missingInfoHint}</p>
          <div class="flex flex-wrap gap-2">
            {missing.map((r) =>
              wish.requestedFields.includes(r.field) ? (
                <span key={r.field} class="sp-chip sp-chip--done">
                  {S.requestAlreadySent(r.label)}
                </span>
              ) : (
                <button
                  key={r.field}
                  type="button"
                  class="sp-chip"
                  disabled={busy}
                  onClick={() => run(() => onRequest(r.field))}
                >
                  {r.action}
                </button>
              ),
            )}
          </div>
        </section>
      )}
    </article>
  );
}
