import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { formatHuf, safeUrl } from "../format";
import { isPrivate, type Person, type Wish, type WishDraft, type WishField } from "../model";
import { S } from "../strings";
import { OpenLinkButton } from "./components";

export const MAX_PRICE_HUF = 100_000_000;
export const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

const FIELD_LABEL: Record<WishField, string> = {
  DESCRIPTION: S.fieldDescription,
  IMAGE_URL: S.fieldImageUrl,
  PRODUCT_URL: S.fieldProductUrl,
};

type Errors = Partial<Record<"name" | "price" | "imageUrl" | "productUrl", string>>;

export function parsePrice(text: string): number | null {
  const digits = text.replace(/[\s .]/g, "").replace(/Ft$/i, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export const blankToNull = (text: string) => (text.trim() === "" ? null : text.trim());

/**
 * Adding or editing a wish on my own list (WishEditorScreen in the app). Once someone booked it, only empty
 * optional fields can be filled in, and who sees it can't change: the booker buys what they agreed to buy.
 */
export function WishEditorScreen({
  existing,
  candidates,
  canMakePrivate,
  onSave,
  onToggleReceived,
  onDelete,
  onMoveToPlans,
}: {
  existing: Wish | null;
  /** Accepted connections who can be chosen to see a private wish. */
  candidates: Person[];
  canMakePrivate: boolean;
  onSave: (draft: WishDraft, answered: WishField[]) => Promise<boolean>;
  onToggleReceived: () => Promise<void>;
  onDelete: () => Promise<boolean>;
  /** Back to the gift planner; only offered while nobody booked or received it. */
  onMoveToPlans: () => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [price, setPrice] = useState(existing ? String(existing.priceHuf) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [productUrl, setProductUrl] = useState(existing?.productUrl ?? "");
  const [priv, setPriv] = useState(existing ? isPrivate(existing) : false);
  const [chosen, setChosen] = useState<string[]>(existing && isPrivate(existing) ? existing.audience ?? [] : []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const clearError = (key: keyof Errors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const booked = existing?.booked === true;
  const received = existing?.receivedAt != null;
  // Once booked, a filled field is frozen; an empty one may still be filled in.
  const locked = {
    name: booked,
    price: booked,
    DESCRIPTION: booked && !!existing?.description,
    IMAGE_URL: booked && !!existing?.imageUrl,
    PRODUCT_URL: booked && !!existing?.productUrl,
  };
  const requested = new Set(existing?.requestedFields ?? []);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: Event) => {
    event.preventDefault();
    const priceHuf = parsePrice(price);
    const next: Errors = {};
    if (!name.trim()) next.name = S.errWishNameRequired;
    if (priceHuf === null || priceHuf <= 0 || priceHuf > MAX_PRICE_HUF) next.price = S.errInvalidPrice;
    if (blankToNull(imageUrl) && !URL_PATTERN.test(imageUrl.trim())) next.imageUrl = S.errInvalidUrl;
    if (blankToNull(productUrl) && !URL_PATTERN.test(productUrl.trim())) next.productUrl = S.errInvalidUrl;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const draft: WishDraft = {
      name: name.trim(),
      priceHuf,
      description: blankToNull(description),
      imageUrl: blankToNull(imageUrl),
      productUrl: blankToNull(productUrl),
      // A booked wish keeps its audience as it is.
      visibleTo: booked ? (existing && isPrivate(existing) ? existing.audience : null) : priv ? chosen : null,
    };
    const answered = [...requested].filter((field) => {
      const value = field === "DESCRIPTION" ? draft.description : field === "IMAGE_URL" ? draft.imageUrl : draft.productUrl;
      return value !== null;
    });
    run(async () => {
      await onSave(draft, answered);
    });
  };

  const preview = safeUrl(imageUrl);

  return (
    <form onSubmit={submit} class="flex flex-col gap-4" noValidate>
      {existing && (
        <div class={`sp-booking ${booked ? "sp-booking--mine" : ""}`}>
          <p>{received ? S.receivedInfo : booked ? S.ownStatusBooked : S.ownStatusAvailable}</p>
          {booked && !received && <p class="text-sm mt-2 opacity-80">{S.bookedInfo}</p>}
          {requested.size > 0 && (
            <p class="text-sm mt-2 opacity-80">
              {S.requestedInfo([...requested].map((f) => FIELD_LABEL[f].toLowerCase()).join(", "))}
            </p>
          )}
        </div>
      )}

      <EditorField label={S.fieldName} error={errors.name}>
        <input class="input input-bordered w-full" value={name} disabled={locked.name} maxLength={200}
          onInput={(e) => { setName(e.currentTarget.value); clearError("name"); }} />
      </EditorField>

      <EditorField label={S.fieldPrice} error={errors.price} hint={!locked.price && parsePrice(price) ? formatHuf(parsePrice(price)!) : undefined}>
        <label class="input input-bordered flex items-center gap-2 w-full">
          <input class="grow min-w-0" inputMode="numeric" value={price} disabled={locked.price} placeholder={S.pricePlaceholder}
            onInput={(e) => { setPrice(e.currentTarget.value); clearError("price"); }} />
          <span class="text-base-content/60">Ft</span>
        </label>
      </EditorField>

      <EditorField label={S.fieldDescription} requested={requested.has("DESCRIPTION")}>
        <textarea class="textarea textarea-bordered w-full text-base" rows={3} maxLength={2000} value={description}
          disabled={locked.DESCRIPTION} onInput={(e) => setDescription(e.currentTarget.value)} />
      </EditorField>

      <EditorField label={S.fieldImageUrl} error={errors.imageUrl} requested={requested.has("IMAGE_URL")}>
        <div class="flex items-center gap-3">
          <input class="input input-bordered w-full" type="url" inputMode="url" placeholder="https://" value={imageUrl}
            disabled={locked.IMAGE_URL} onInput={(e) => { setImageUrl(e.currentTarget.value); clearError("imageUrl"); }} />
          {preview && <img src={preview} alt="" referrerpolicy="no-referrer" class="sp-thumb" style={{ width: "48px", height: "48px" }} />}
        </div>
      </EditorField>

      <EditorField label={S.fieldProductUrl} error={errors.productUrl} requested={requested.has("PRODUCT_URL")}>
        <div class="flex items-center gap-2">
          <input class="input input-bordered w-full" type="url" inputMode="url" placeholder="https://" value={productUrl}
            disabled={locked.PRODUCT_URL} onInput={(e) => { setProductUrl(e.currentTarget.value); clearError("productUrl"); }} />
          <OpenLinkButton url={productUrl} />
        </div>
      </EditorField>

      {canMakePrivate && (
        <fieldset class="sp-private">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" class="toggle toggle-primary" checked={priv} disabled={booked}
              onChange={(e) => setPriv(e.currentTarget.checked)} />
            <span class="font-semibold">{S.editorPrivate}</span>
          </label>
          <p class="text-sm text-base-content/70 mt-2">{booked ? S.privateLocked : S.privateInfo}</p>
          {priv && !booked && (
            candidates.length === 0 ? (
              <p class="text-sm mt-3">{S.privateNoConnections}</p>
            ) : (
              <div class="mt-3">
                <p class="text-sm font-semibold mb-2">{S.privateWho}</p>
                <ul class="flex flex-col gap-1">
                  {candidates.map((person) => (
                    <li key={person.id}>
                      <label class="flex items-center gap-3 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          checked={chosen.includes(person.id)}
                          onChange={(e) =>
                            setChosen(e.currentTarget.checked ? [...chosen, person.id] : chosen.filter((id) => id !== person.id))
                          }
                        />
                        <span>{person.displayName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </fieldset>
      )}

      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy && <span class="loading loading-spinner loading-sm" />}
        {S.save}
      </button>

      {existing && (
        <div class="flex flex-wrap gap-2 justify-between pt-2 border-t border-base-300">
          <button type="button" class="btn btn-ghost" disabled={busy} onClick={() => run(onToggleReceived)}>
            {received ? S.restore : S.markReceived}
          </button>
          {!booked && !received && (
            <button type="button" class="btn btn-ghost" disabled={busy} onClick={() => run(onMoveToPlans)}>
              {S.moveToPlans}
            </button>
          )}
          {(!booked || received) && !confirmDelete && (
            <button type="button" class="btn btn-ghost text-error" disabled={busy} onClick={() => setConfirmDelete(true)}>
              {S.delete}
            </button>
          )}
        </div>
      )}
      {existing && confirmDelete && (
        <div class="sp-confirm">
          <p class="font-semibold">{S.deleteTitle}</p>
          <p class="mt-1 text-sm">{S.deleteMessage(existing.name)}</p>
          <div class="flex gap-2 mt-3">
            <button type="button" class="btn btn-error btn-sm" disabled={busy} onClick={() => run(async () => {
              if (!(await onDelete())) setConfirmDelete(false);
            })}>
              {S.delete}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              {S.cancel}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function EditorField(props: {
  label: string;
  error?: string;
  hint?: string;
  requested?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class="form-control w-full">
      <span class="label-text font-semibold mb-1.5">{props.label}</span>
      {props.children}
      {props.requested && <span class="text-xs mt-1.5 sp-requested">{S.fieldRequested}</span>}
      {props.error ? (
        <span class="text-xs mt-1.5 text-error" role="alert">{props.error}</span>
      ) : (
        props.hint && <span class="text-xs mt-1.5 text-base-content/60">{props.hint}</span>
      )}
    </div>
  );
}
