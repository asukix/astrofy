// Invitation links: the app sends no e-mail, so the inviter shares this link (Messenger, WhatsApp, SMS…).
// The landing page (/apps/surpriser/meghivo) only displays what's in the link; the invitation itself lives
// in Firestore (invitations/{inviterUid}_{inviteeEmail}), so a forged link grants nothing.

import { APP_PATH, PUBLIC_ORIGIN } from "../config";

export const INVITE_PATH = `${APP_PATH}/meghivo`;

/** https://sengdev.com/apps/surpriser/meghivo?tol=Kovács%20Anna&cim=bela%40example.com */
export function invitationLink(inviterName: string, inviteeEmail: string): string {
  const params = new URLSearchParams({ tol: inviterName, cim: inviteeEmail });
  return `${PUBLIC_ORIGIN}${INVITE_PATH}?${params}`;
}

/** Shares the link through the phone's share sheet, or copies it. Returns what happened. */
export async function shareInvitation(link: string, title: string, text: string): Promise<"shared" | "copied" | "none"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: link });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "none";
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return "copied";
  } catch {
    return "none";
  }
}
