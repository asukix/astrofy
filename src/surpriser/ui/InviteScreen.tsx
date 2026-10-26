import { useState } from "preact/hooks";
import type { SentInvitation } from "../data/board";
import { EMAIL_PATTERN, normalizeEmail } from "../format";
import { S } from "../strings";

export function InviteScreen({
  myEmail,
  sent,
  onInvite,
}: {
  myEmail: string;
  sent: SentInvitation[];
  /** Resolves true when the invitation went out (or was answered), so the field can be cleared. */
  onInvite: (email: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(address)) return setError(S.errInvalidEmail);
    if (address === myEmail) return setError(S.errSelfInvite);
    setError(null);
    setBusy(true);
    try {
      if (await onInvite(address)) setEmail("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="flex flex-col gap-6">
      <form onSubmit={submit} class="sp-card p-5 flex flex-col gap-3" noValidate>
        <p>{S.inviteExplanation}</p>
        <label class="form-control w-full">
          <span class="label-text font-semibold mb-1.5">{S.email}</span>
          <input class="input input-bordered w-full" type="email" autocomplete="off" value={email}
            onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        {error && <p class="sp-alert sp-alert--error" role="alert">{error}</p>}
        <button type="submit" class="btn btn-primary" disabled={busy}>
          {busy && <span class="loading loading-spinner loading-sm" />}
          {S.invite}
        </button>
        <p class="text-sm text-base-content/60">{S.inviteNoEmailNote}</p>
      </form>

      {sent.length > 0 && (
        <section>
          <h2 class="sp-section-title text-xl">{S.sentInvitations}</h2>
          <ul class="sp-card sp-wishlist">
            {sent.map((inv) => (
              <li key={inv.id} class="px-4 py-3 text-base-content/80 break-all">
                {S.sentInvitationItem(inv.inviteeEmail)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
