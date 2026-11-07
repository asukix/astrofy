import { useEffect, useState } from "preact/hooks";
import { parsePrefill, type PlanPrefill } from "../prefill";

// Hash routes keep the whole app on one static page (no server rewrites needed on Cloudflare).
export type Route =
  | { name: "board" }
  | { name: "wish"; wishId: string }
  | { name: "bookings" }
  | { name: "newWish"; ownerId: string | null }
  | { name: "editWish"; wishId: string }
  | { name: "invite" }
  | { name: "planner" }
  /** [prefill]: from a product page (Chrome extension / bookmarklet), see prefill.ts. */
  | { name: "newPlan"; ownerId: string | null; prefill: PlanPrefill | null }
  | { name: "editPlan"; planId: string }
  | { name: "newChild" }
  | { name: "editChild"; childId: string }
  | { name: "coParent"; childId: string }
  | { name: "deleteAccount" };

export function parseRoute(hash: string): Route {
  // A query may follow the path (`#/uj-terv?nev=…`); its values may contain "/" too.
  const full = hash.replace(/^#\/?/, "");
  const queryStart = full.indexOf("?");
  const path = queryStart >= 0 ? full.slice(0, queryStart) : full;
  const query = queryStart >= 0 ? full.slice(queryStart + 1) : "";
  const [head, id] = path.split("/");
  if (head === "kivansag" && id) return { name: "wish", wishId: decodeURIComponent(id) };
  if (head === "foglalasaim") return { name: "bookings" };
  if (head === "uj-kivansag") return { name: "newWish", ownerId: id ? decodeURIComponent(id) : null };
  if (head === "sajat" && id) return { name: "editWish", wishId: decodeURIComponent(id) };
  if (head === "meghivas") return { name: "invite" };
  if (head === "tervezo") return { name: "planner" };
  if (head === "uj-terv") return { name: "newPlan", ownerId: id ? decodeURIComponent(id) : null, prefill: parsePrefill(query) };
  if (head === "terv" && id) return { name: "editPlan", planId: decodeURIComponent(id) };
  if (head === "uj-gyerek") return { name: "newChild" };
  if (head === "gyerek" && id) return { name: "editChild", childId: decodeURIComponent(id) };
  if (head === "fiok-torlese") return { name: "deleteAccount" };
  if (head === "tarsszulo" && id) return { name: "coParent", childId: decodeURIComponent(id) };
  return { name: "board" };
}

export const href = {
  board: () => "#/",
  wish: (wishId: string) => `#/kivansag/${encodeURIComponent(wishId)}`,
  bookings: () => "#/foglalasaim",
  /** [ownerId]: a child's or a shared list; my own list by default. */
  newWish: (ownerId?: string) => (ownerId ? `#/uj-kivansag/${encodeURIComponent(ownerId)}` : "#/uj-kivansag"),
  editWish: (wishId: string) => `#/sajat/${encodeURIComponent(wishId)}`,
  invite: () => "#/meghivas",
  planner: () => "#/tervezo",
  newPlan: (ownerId?: string) => (ownerId ? `#/uj-terv/${encodeURIComponent(ownerId)}` : "#/uj-terv"),
  editPlan: (planId: string) => `#/terv/${encodeURIComponent(planId)}`,
  newChild: () => "#/uj-gyerek",
  editChild: (childId: string) => `#/gyerek/${encodeURIComponent(childId)}`,
  coParent: (childId: string) => `#/tarsszulo/${encodeURIComponent(childId)}`,
  deleteAccount: () => "#/fiok-torlese",
};

/** How many in-app steps can be undone with the browser's back. */
let depth = 0;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parseRoute(location.hash);
      depth = next.name === "board" ? 0 : depth + 1;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Back to the previous in-app screen, or to the board when the page was opened by a direct link. */
export function goBack() {
  if (depth > 1) {
    depth -= 2; // history.back() fires hashchange, which adds one again
    history.back();
  } else {
    location.hash = href.board();
  }
}
