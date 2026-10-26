import { useState } from "preact/hooks";
import type { SentInvitation } from "../data/board";
import { invitationLink, shareInvitation } from "../data/invitationLink";
import { EMAIL_PATTERN, normalizeEmail } from "../format";
import { S } from "../strings";

export function InviteScreen({
  myEmail,
  myName,
  sent,
  onInvite,
  onInfo,
}: {
  myEmail: string;
  myName: string;
  sent: SentInvitation[];
  /** "sent": a new invitation; "accepted": they had invited me, so it counted as accepting; null: failed. */
  onInvite: (email: string) => Promise<"sent" | "accepted" | null>;
  /** Short confirmation at the bottom of the screen. */
  onInfo: (text: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The address just invited: its link is offered right away. */
  const [justInvited, setJustInvited] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(address)) return setError(S.errInvalidEmail);
    if (address === myEmail) return setError(S.errSelfInvite);
    setError(null);
    setBusy(true);
    try {
      const result = await onInvite(address);
      if (result) setEmail("");
      setJustInvited(result === "sent" ? address : null);
    } finally {
      setBusy(false);
    }
  };

  const share = async (inviteeEmail: string) => {
    const result = await shareInvitation(
      invitationLink(myName, inviteeEmail),
      S.shareInviteTitle,
      S.shareInviteText(myName),
    );
    if (result === "copied") onInfo(S.linkCopied);
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

      {justInvited && (
        <div class="sp-booking sp-booking--mine" role="status">
          <p class="font-semibold">{S.inviteSentShare}</p>
          <p class="text-sm mt-1 break-words opacity-80">{justInvited}</p>
          <button type="button" class="btn btn-secondary w-full mt-3" onClick={() => share(justInvited)}>
            {S.shareInvite}
          </button>
          <p class="text-xs mt-3 opacity-70 break-words">
            {S.inviteLinkLabel} {invitationLink(myName, justInvited)}
          </p>
        </div>
      )}

      {sent.length > 0 && (
        <section>
          <h2 class="sp-section-title text-xl">{S.sentInvitations}</h2>
          <ul class="sp-card sp-wishlist">
            {sent.map((inv) => (
              <li key={inv.id} class="flex items-center gap-3 px-4 py-2">
                <span class="flex-1 min-w-0 text-base-content/80 break-words">{S.sentInvitationItem(inv.inviteeEmail)}</span>
                <button type="button" class="btn btn-ghost btn-sm text-primary shrink-0" onClick={() => share(inv.inviteeEmail)}>
                  {S.shareInvite}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
