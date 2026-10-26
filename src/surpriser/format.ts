const NBSP = " ";

/** Whole forints the Hungarian way: "12 990 Ft", with non-breaking spaces (as HufFormatter in the app). */
export function formatHuf(amount: number): string {
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${amount < 0 ? "-" : ""}${grouped}${NBSP}Ft`;
}

/** Only http(s) links are opened or shown as images (the rules enforce the same). */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null;
}

/** "bolt.hu" from "https://www.bolt.hu/termek/123". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** At least 8 characters, with a letter and a digit (PasswordPolicy in the app). */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password);
}
