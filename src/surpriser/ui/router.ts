import { useEffect, useState } from "preact/hooks";

// Hash routes keep the whole app on one static page (no server rewrites needed on Cloudflare).
export type Route =
  | { name: "board" }
  | { name: "wish"; wishId: string }
  | { name: "bookings" }
  | { name: "newWish" }
  | { name: "editWish"; wishId: string }
  | { name: "invite" }
  | { name: "planner" }
  | { name: "newPlan"; ownerId: string | null }
  | { name: "editPlan"; planId: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, id] = path.split("/");
  if (head === "kivansag" && id) return { name: "wish", wishId: decodeURIComponent(id) };
  if (head === "foglalasaim") return { name: "bookings" };
  if (head === "uj-kivansag") return { name: "newWish" };
  if (head === "sajat" && id) return { name: "editWish", wishId: decodeURIComponent(id) };
  if (head === "meghivas") return { name: "invite" };
  if (head === "tervezo") return { name: "planner" };
  if (head === "uj-terv") return { name: "newPlan", ownerId: id ? decodeURIComponent(id) : null };
  if (head === "terv" && id) return { name: "editPlan", planId: decodeURIComponent(id) };
  return { name: "board" };
}

export const href = {
  board: () => "#/",
  wish: (wishId: string) => `#/kivansag/${encodeURIComponent(wishId)}`,
  bookings: () => "#/foglalasaim",
  newWish: () => "#/uj-kivansag",
  editWish: (wishId: string) => `#/sajat/${encodeURIComponent(wishId)}`,
  invite: () => "#/meghivas",
  planner: () => "#/tervezo",
  newPlan: (ownerId?: string) => (ownerId ? `#/uj-terv/${encodeURIComponent(ownerId)}` : "#/uj-terv"),
  editPlan: (planId: string) => `#/terv/${encodeURIComponent(planId)}`,
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
