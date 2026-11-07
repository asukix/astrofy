// A new plan filled in from a link: the Chrome extension and the bookmarklet open
// `#/uj-terv[/<list>]?nev=…&ar=…&leiras=…&kep=…&link=…` with what they read from a product page.
// Everything is cleaned here to what the editor and the Firestore rules accept; anything that
// doesn't fit is left empty rather than guessed. Nothing is ever saved without the user.

export interface PlanPrefill {
  name: string;
  priceHuf: number | null;
  description: string;
  imageUrl: string;
  productUrl: string;
}

export const PREFILL_LIMITS = { name: 200, description: 2000, url: 2000, maxPriceHuf: 100_000_000 } as const;

/** Same check as the editor's (URL_PATTERN in WishEditorScreen); the rules require http(s). */
const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/**
 * Cuts [text] to at most [max] UTF-16 units (what the inputs count) without splitting a character,
 * so it also fits the rules' size limit.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = "";
  for (const char of text) {
    if (out.length + char.length > max) break;
    out += char;
  }
  return out.trimEnd();
}

/**
 * Whole forints from what shops print: "12990", "12 990 Ft", "12.990,-", "12 990,00 HUF", "12990.5".
 * Null when it isn't clearly a price in range.
 */
export function parsePrefillPrice(raw: string): number | null {
  let text = raw
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(/(ft|huf)\.?$/i, "")
    .replace(/[,.]-+$/, "")
    .replace(/-+$/, "");
  if (text === "") return null;
  let value: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    // Thousands separators only: "12.990", "1,299,000".
    value = Number(text.replace(/[.,]/g, ""));
  } else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text)) {
    // "12.990,00"
    value = Number(text.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(text)) {
    // "12,990.00"
    value = Number(text.replace(/,/g, ""));
  } else if (/^\d+([.,]\d{1,2})?$/.test(text)) {
    value = Number(text.replace(",", "."));
  } else {
    return null;
  }
  const rounded = Math.round(value);
  return Number.isFinite(rounded) && rounded >= 1 && rounded <= PREFILL_LIMITS.maxPriceHuf ? rounded : null;
}

/** An absolute http(s) link that fits the limit, or "". */
export function cleanUrl(raw: string): string {
  const text = raw.trim();
  if (text === "" || text.length > PREFILL_LIMITS.url || !URL_PATTERN.test(text)) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

const multiLine = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** The prefill from the query part of the hash (after "?"), or null when it carries nothing usable. */
export function parsePrefill(query: string): PlanPrefill | null {
  if (!query) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return null;
  }
  const get = (key: string) => params.get(key) ?? "";
  const prefill: PlanPrefill = {
    name: clip(oneLine(get("nev")), PREFILL_LIMITS.name),
    priceHuf: parsePrefillPrice(get("ar")),
    description: clip(multiLine(get("leiras")), PREFILL_LIMITS.description),
    imageUrl: cleanUrl(get("kep")),
    productUrl: cleanUrl(get("link")),
  };
  const empty =
    !prefill.name && prefill.priceHuf === null && !prefill.description && !prefill.imageUrl && !prefill.productUrl;
  return empty ? null : prefill;
}
