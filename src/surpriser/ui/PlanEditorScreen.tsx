import { useState } from "preact/hooks";
import { formatHuf, safeUrl } from "../format";
import type { Plan, PlanList, WishDraft } from "../model";
import { S } from "../strings";
import { blankToNull, EditorField, MAX_PRICE_HUF, parsePrice, URL_PATTERN } from "./WishEditorScreen";

type Errors = Partial<Record<"name" | "price" | "imageUrl" | "productUrl", string>>;

/**
 * Adding or editing a plan (PlanEditorScreen in the app). The price may wait; approving turns the plan
 * into a wish on the chosen list, and that needs a price.
 */
export function PlanEditorScreen({
  existing,
  lists,
  initialOwnerId,
  onSave,
  onApprove,
  onDelete,
}: {
  existing: Plan | null;
  /** The lists I can plan for; the first one is mine. */
  lists: PlanList[];
  initialOwnerId: string | null;
  onSave: (ownerId: string, draft: WishDraft) => Promise<void>;
  onApprove: (ownerId: string, draft: WishDraft) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const startOwner =
    existing?.ownerId ?? (initialOwnerId && lists.some((l) => l.ownerId === initialOwnerId) ? initialOwnerId : lists[0]?.ownerId);
  const [ownerId, setOwnerId] = useState(startOwner ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [price, setPrice] = useState(existing?.priceHuf != null ? String(existing.priceHuf) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [productUrl, setProductUrl] = useState(existing?.productUrl ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const clearError = (key: keyof Errors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  /** Validates the form; [needPrice] when approving. Returns the draft, or null with the errors shown. */
  const draftOf = (needPrice: boolean): WishDraft | null => {
    const priceHuf = price.trim() === "" ? null : parsePrice(price);
    const next: Errors = {};
    if (!name.trim()) next.name = S.errWishNameRequired;
    if (price.trim() !== "" && (priceHuf === null || priceHuf <= 0 || priceHuf > MAX_PRICE_HUF)) next.price = S.errInvalidPrice;
    else if (needPrice && priceHuf === null) next.price = S.errPlanPriceRequired;
    if (blankToNull(imageUrl) && !URL_PATTERN.test(imageUrl.trim())) next.imageUrl = S.errInvalidUrl;
    if (blankToNull(productUrl) && !URL_PATTERN.test(productUrl.trim())) next.productUrl = S.errInvalidUrl;
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      name: name.trim(),
      priceHuf,
      description: blankToNull(description),
      imageUrl: blankToNull(imageUrl),
      productUrl: blankToNull(productUrl),
      visibleTo: null,
    };
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const save = (event: Event) => {
    event.preventDefault();
    const draft = draftOf(false);
    if (draft) run(() => onSave(ownerId, draft));
  };

  const approve = () => {
    const draft = draftOf(true);
    if (draft) run(() => onApprove(ownerId, draft));
  };

  const parsed = parsePrice(price);
  const preview = safeUrl(imageUrl);

  return (
    <form onSubmit={save} class="flex flex-col gap-4" noValidate>
      {lists.length > 1 && (
        <EditorField label={S.planEditorOwner}>
          <select class="select select-bordered w-full" value={ownerId} onChange={(e) => setOwnerId(e.currentTarget.value)}>
            {lists.map((list) => (
              <option key={list.ownerId} value={list.ownerId}>
                {list.kind === "MINE" ? `${S.plannerKindMine} (${list.name})` : list.name}
              </option>
            ))}
          </select>
        </EditorField>
      )}

      <EditorField label={S.fieldName} error={errors.name}>
        <input class="input input-bordered w-full" value={name} maxLength={200}
          onInput={(e) => { setName(e.currentTarget.value); clearError("name"); }} />
      </EditorField>

      <EditorField label={S.planEditorPrice} error={errors.price} hint={parsed ? formatHuf(parsed) : undefined}>
        <label class="input input-bordered flex items-center gap-2 w-full">
          <input class="grow min-w-0" inputMode="numeric" value={price} placeholder={S.pricePlaceholder}
            onInput={(e) => { setPrice(e.currentTarget.value); clearError("price"); }} />
          <span class="text-base-content/60">Ft</span>
        </label>
      </EditorField>

      <EditorField label={S.fieldDescription}>
        <textarea class="textarea textarea-bordered w-full text-base" rows={3} maxLength={2000} value={description}
          onInput={(e) => setDescription(e.currentTarget.value)} />
      </EditorField>

      <EditorField label={S.fieldImageUrl} error={errors.imageUrl}>
        <div class="flex items-center gap-3">
          <input class="input input-bordered w-full" type="url" inputMode="url" placeholder="https://" value={imageUrl}
            onInput={(e) => { setImageUrl(e.currentTarget.value); clearError("imageUrl"); }} />
          {preview && <img src={preview} alt="" referrerpolicy="no-referrer" class="sp-thumb" style={{ width: "48px", height: "48px" }} />}
        </div>
      </EditorField>

      <EditorField label={S.fieldProductUrl} error={errors.productUrl}>
        <input class="input input-bordered w-full" type="url" inputMode="url" placeholder="https://" value={productUrl}
          onInput={(e) => { setProductUrl(e.currentTarget.value); clearError("productUrl"); }} />
      </EditorField>

      <p class="text-sm text-base-content/70">{S.planEditorVisibility}</p>

      <button type="button" class="btn btn-primary" disabled={busy} onClick={approve}>
        {busy && <span class="loading loading-spinner loading-sm" />}
        {S.planEditorApprove}
      </button>
      {parsed === null && <p class="text-sm text-base-content/60 -mt-2">{S.planEditorApproveInfo}</p>}
      <button type="submit" class="btn btn-outline" disabled={busy}>
        {S.planEditorSave}
      </button>

      {existing && !confirmDelete && (
        <div class="flex justify-end pt-2 border-t border-base-300">
          <button type="button" class="btn btn-ghost text-error" disabled={busy} onClick={() => setConfirmDelete(true)}>
            {S.delete}
          </button>
        </div>
      )}
      {existing && confirmDelete && (
        <div class="sp-confirm">
          <p class="font-semibold">{S.planEditorDeleteTitle}</p>
          <p class="mt-1 text-sm">{S.planEditorDeleteMessage(existing.name)}</p>
          <div class="flex gap-2 mt-3">
            <button type="button" class="btn btn-error btn-sm" disabled={busy} onClick={() => run(onDelete)}>
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
