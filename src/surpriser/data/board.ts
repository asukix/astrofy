// Live state of the signed-in user: whom they can see, those lists' wishes, their own list and bookings.
// The composition follows the Android app (buildPeopleSnapshot, ObserveWishBoardUseCase).

import {
  joinAsNames,
  type Board,
  type Booking,
  type ChildGroup,
  type ChildProfile,
  type Invitation,
  type Person,
  type PersonWishes,
  type Plan,
  type PlanList,
  type User,
  type ViewedWish,
  type Wish,
} from "../model";
import { applyPublications, planPublications } from "./familyPublisher";
import { deleteWish, markWishesPublic, observe } from "./storeService";

/** Received wishes leave the list after a week (as in the app). */
const RECEIVED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SentInvitation {
  id: string;
  inviteeEmail: string;
}

export interface Snapshot {
  me: User;
  /** False until every source delivered its first result. */
  ready: boolean;
  /** Everyone whose list I may give from (accounts, children, shared lists), my own children included. */
  people: Person[];
  wishesByOwner: Map<string, Wish[]>;
  bookings: Booking[];
  bookedByMe: Set<string>;
  /** Owner id of my own list: my account, or my child profile if I registered as a child. */
  myListOwnerId: string;
  /** Only an account's own list can have private wishes (a registered child's can't). */
  canMakePrivate: boolean;
  /** Invitations I sent that are still waiting for an answer. */
  sentPending: SentInvitation[];
  /** Lists I can plan for: mine first, then my children's, then the shared ones. */
  planLists: PlanList[];
  plansByOwner: Map<string, Plan[]>;
}

/** Port of editableLists in PlanUseCases: my list, my children's, and the shared ones (of my children, or that I'm in). */
function planListsOf(me: User, s: Partial<Sources>, myListOwnerId: string): PlanList[] {
  const own = s.own?.[0] ?? null;
  const byName = (a: PlanList, b: PlanList) => a.name.localeCompare(b.name, "hu", { sensitivity: "base" });
  const kids = (s.managedChildren ?? [])
    .filter((c) => c.id !== own?.id)
    .map((c): PlanList => ({ ownerId: c.id, name: c.name, kind: "CHILD" }))
    .sort(byName);
  const groups = new Map<string, PlanList>();
  for (const g of s.managedGroups ?? []) groups.set(g.id, { ownerId: g.id, name: groupName(g), kind: "SHARED" });
  for (const g of s.visibleGroups ?? []) {
    if (own && g.memberIds.includes(own.id)) groups.set(g.id, { ownerId: g.id, name: groupName(g), kind: "SHARED" });
  }
  return [{ ownerId: myListOwnerId, name: me.displayName, kind: "MINE" }, ...kids, ...[...groups.values()].sort(byName)];
}

interface Sources {
  received: Invitation[];
  sent: Invitation[];
  managedChildren: ChildProfile[];
  own: ChildProfile[];
  visibleChildren: ChildProfile[];
  managedGroups: ChildGroup[];
  visibleGroups: ChildGroup[];
  bookings: Booking[];
}

const SOURCE_KEYS: (keyof Sources)[] = [
  "received",
  "sent",
  "managedChildren",
  "own",
  "visibleChildren",
  "managedGroups",
  "visibleGroups",
  "bookings",
];

function parentNamesOf(child: ChildProfile): string[] {
  return child.managers.map((id) => child.managerNames[id]).filter((n): n is string => !!n);
}

function groupName(group: ChildGroup): string {
  return joinAsNames(group.memberIds.map((id) => group.memberNames[id] ?? "").filter((n) => n.trim() !== ""));
}

/** Port of buildPeopleSnapshot: the lists the signed-in user can see, deduplicated. */
export function buildPeople(me: User, s: Sources): Person[] {
  const ownProfile = s.own[0] ?? null;
  const managedChildIds = new Set(s.managedChildren.map((c) => c.id));
  const managedGroupIds = new Set(s.managedGroups.map((g) => g.id));
  // As a registered child, shared lists I'm in are mine; others are someone else's (e.g. my siblings').
  const memberGroupIds = new Set(
    s.visibleGroups
      .filter((g) => !managedGroupIds.has(g.id) && ownProfile !== null && g.memberIds.includes(ownProfile.id))
      .map((g) => g.id),
  );

  const base = { pendingInvitationId: null, isChild: false, parentNames: [], isGroup: false, isManaged: false };
  const fromReceived: Person[] = s.received.flatMap((inv): Person[] => {
    if (inv.status !== "PENDING" && inv.status !== "ACCEPTED") return [];
    const invitedMe = inv.status === "PENDING";
    return [
      {
        ...base,
        id: inv.inviterUid,
        displayName: inv.inviterName.trim() || inv.inviterEmail,
        email: inv.inviterEmail,
        relation: invitedMe ? "INVITED_ME" : "CONNECTED",
        pendingInvitationId: invitedMe ? inv.id : null,
      },
    ];
  });
  const fromSent: Person[] = s.sent.flatMap((inv): Person[] =>
    inv.status === "ACCEPTED" && inv.inviteeUid
      ? [
          {
            ...base,
            id: inv.inviteeUid,
            displayName: inv.inviteeName?.trim() || inv.inviteeEmail,
            email: inv.inviteeEmail,
            relation: "CONNECTED",
          },
        ]
      : [],
  );
  const fromChildren: Person[] = s.visibleChildren.map((child) => ({
    ...base,
    id: child.id,
    displayName: child.name,
    email: child.email ?? "",
    relation: "CONNECTED",
    isChild: true,
    parentNames: parentNamesOf(child),
  }));
  const fromFamily: Person[] = Object.values(ownProfile?.familyBy ?? {})
    .flat()
    .map((member) => ({
      ...base,
      id: member.id,
      displayName: member.name.trim() || member.email || "",
      email: member.email ?? "",
      relation: "CONNECTED",
      isChild: member.isChild,
      parentNames: member.parentNames,
    }));
  const fromGroups: Person[] = s.visibleGroups.map((group) => ({
    ...base,
    id: group.id,
    displayName: groupName(group),
    email: "",
    relation: "CONNECTED",
    isChild: true,
    isGroup: true,
  }));
  // My children: I may buy from their lists (the rules allow parents to give to their children).
  const fromManagedChildren: Person[] = s.managedChildren
    .filter((child) => child.id !== ownProfile?.id)
    .map((child) => ({
      ...base,
      id: child.id,
      displayName: child.name,
      email: child.email ?? "",
      relation: "CONNECTED",
      isChild: true,
      parentNames: parentNamesOf(child),
      isManaged: true,
    }));
  const fromManagedGroups: Person[] = s.managedGroups.map((group) => ({
    ...base,
    id: group.id,
    displayName: groupName(group),
    email: "",
    relation: "CONNECTED",
    isChild: true,
    isGroup: true,
    isManaged: true,
  }));

  const excluded = new Set<string>([me.id, ...memberGroupIds]);
  if (ownProfile) excluded.add(ownProfile.id);

  const others = [...fromReceived, ...fromSent, ...fromChildren, ...fromFamily, ...fromGroups].filter(
    (p) => !excluded.has(p.id) && !managedChildIds.has(p.id) && !managedGroupIds.has(p.id),
  );
  const byId = new Map<string, Person>();
  for (const person of others) {
    const existing = byId.get(person.id);
    // Both may have invited each other; a connection wins over a pending invitation.
    if (!existing || (existing.relation !== "CONNECTED" && person.relation === "CONNECTED")) byId.set(person.id, person);
  }
  return [...fromManagedChildren, ...fromManagedGroups, ...byId.values()];
}

/**
 * Subscribes to everything the giver view needs and calls [onChange] with a fresh snapshot on every change.
 * Wish listeners follow the set of visible owners (plus owners of my bookings).
 */
export function observeSnapshot(me: User, onChange: (snapshot: Snapshot) => void): () => void {
  const sources: Partial<Sources> = {};
  const wishesByOwner = new Map<string, Wish[]>();
  /** ownerId → the giver id its listener was started with (null: full list) and how to stop it. */
  const wishListeners = new Map<string, { giverId: string | null; stop: () => void }>();
  const tidied = new Set<string>();
  const plansByOwner = new Map<string, Plan[]>();
  const planListeners = new Map<string, () => void>();
  let people: Person[] = [];
  let closed = false;

  const myListOwnerId = () => sources.own?.[0]?.id ?? me.id;

  const emit = () => {
    if (closed) return;
    const ready =
      SOURCE_KEYS.every((k) => sources[k] !== undefined) && [...wishListeners.keys()].every((id) => wishesByOwner.has(id));
    const bookings = sources.bookings ?? [];
    onChange({
      me,
      ready,
      people,
      wishesByOwner: new Map(wishesByOwner),
      bookings,
      bookedByMe: new Set(bookings.map((b) => b.wishId)),
      myListOwnerId: myListOwnerId(),
      canMakePrivate: myListOwnerId() === me.id,
      sentPending: (sources.sent ?? [])
        .filter((inv) => inv.status === "PENDING")
        .map((inv) => ({ id: inv.id, inviteeEmail: inv.inviteeEmail })),
      planLists: planListsOf(me, sources, myListOwnerId()),
      plansByOwner: new Map(plansByOwner),
    });
  };

  /**
   * Housekeeping on a list I fully see (my account's, my children's and their shared lists), as the app's
   * SyncEngine does it: wishes from before private wishes existed become public (givers' queries only find
   * them then), and received ones expire after a week.
   */
  const tidyList = (wishes: Wish[]) => {
    const now = Date.now();
    const expired = wishes.filter((w) => !tidied.has(w.id) && w.receivedAt !== null && now - w.receivedAt >= RECEIVED_RETENTION_MS);
    const legacy = wishes.filter((w) => !tidied.has(w.id) && w.audience === null && !expired.includes(w));
    expired.forEach((w) => tidied.add(w.id));
    legacy.forEach((w) => tidied.add(w.id));
    markWishesPublic(legacy.map((w) => w.id)).catch(() => {});
    expired.forEach((w) => deleteWish(w.id).catch(() => {}));
  };

  const syncOwners = () => {
    // Full access (every wish, private ones included): my own account list and my children's lists.
    const owners = new Map<string, string | null>();
    owners.set(myListOwnerId(), myListOwnerId() === me.id ? null : me.id);
    for (const p of people) owners.set(p.id, p.isManaged ? null : me.id);
    for (const b of sources.bookings ?? []) if (!owners.has(b.ownerId)) owners.set(b.ownerId, me.id);

    for (const [ownerId, listener] of wishListeners) {
      if (!owners.has(ownerId) || owners.get(ownerId) !== listener.giverId) {
        listener.stop();
        wishListeners.delete(ownerId);
        wishesByOwner.delete(ownerId);
      }
    }
    for (const [ownerId, giverId] of owners) {
      if (wishListeners.has(ownerId)) continue;
      const stop = observe.wishesOf(ownerId, giverId, (wishes) => {
        wishesByOwner.set(ownerId, wishes);
        if (giverId === null) tidyList(wishes);
        emit();
      });
      wishListeners.set(ownerId, { giverId, stop });
    }
  };

  const syncPlans = () => {
    const owners = new Set(planListsOf(me, sources, myListOwnerId()).map((l) => l.ownerId));
    for (const [ownerId, stop] of planListeners) {
      if (!owners.has(ownerId)) {
        stop();
        planListeners.delete(ownerId);
        plansByOwner.delete(ownerId);
      }
    }
    for (const ownerId of owners) {
      if (planListeners.has(ownerId)) continue;
      planListeners.set(
        ownerId,
        observe.plansOf(ownerId, (plans) => {
          plansByOwner.set(ownerId, plans);
          emit();
        }),
      );
    }
  };

  // Who may see my children: published like the app does, so a parent using only the web keeps it current too.
  // Guard rails: it reacts only to changes of what *I* would publish (never to someone else's write), runs at
  // most once a minute, and stops for the session if Firestore's quota runs out.
  const PUBLISH_COOLDOWN_MS = 60_000;
  let lastPlan = "";
  let lastRunAt = 0;
  let publishStopped = false;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const schedulePublish = () => {
    // Publishing from incomplete data would take people off my children's lists.
    if (publishStopped || failedSources.size > 0) return;
    const own = sources.own?.[0]?.id;
    const plan = planPublications({
      me,
      people,
      pendingInviteeEmails: (sources.sent ?? []).filter((i) => i.status === "PENDING").map((i) => i.inviteeEmail),
      managedChildren: (sources.managedChildren ?? []).filter((c) => c.id !== own),
      managedGroups: sources.managedGroups ?? [],
    });
    const key = JSON.stringify(plan);
    if (key === lastPlan || plan.families.length === 0) return;
    clearTimeout(publishTimer);
    const wait = Math.max(2_000, lastRunAt + PUBLISH_COOLDOWN_MS - Date.now());
    publishTimer = setTimeout(() => {
      if (closed || publishStopped) return;
      lastPlan = key;
      lastRunAt = Date.now();
      applyPublications(me, plan)
        .then((ok) => {
          if (!ok) publishStopped = true;
        })
        .catch((e) => console.warn("Surpriser: publishing families failed", e));
    }, wait);
  };

  /** Sources whose query failed: then I don't know my full circle, so nothing is published from it. */
  const failedSources = new Set<keyof Sources>();

  const update = <K extends keyof Sources>(key: K) => (items: Sources[K], failed?: boolean) => {
    sources[key] = items;
    if (failed) failedSources.add(key);
    else failedSources.delete(key);
    if (SOURCE_KEYS.every((k) => sources[k] !== undefined)) {
      people = buildPeople(me, sources as Sources);
      syncOwners();
      syncPlans();
      schedulePublish();
    }
    emit();
  };

  const stops = [
    observe.receivedInvitations(me.email, update("received")),
    observe.sentInvitations(me.id, update("sent")),
    observe.managedChildren(me.id, update("managedChildren")),
    observe.ownChildProfile(me.id, update("own")),
    observe.visibleChildren(me.email, update("visibleChildren")),
    observe.managedGroups(me.id, update("managedGroups")),
    observe.visibleGroups(me.email, update("visibleGroups")),
    observe.bookings(me.id, update("bookings")),
  ];

  return () => {
    closed = true;
    clearTimeout(publishTimer);
    stops.forEach((stop) => stop());
    wishListeners.forEach((l) => l.stop());
    planListeners.forEach((stop) => stop());
  };
}

// region Selectors

function byListOrder(a: Wish, b: Wish): number {
  return a.sortOrder - b.sortOrder || a.createdAt - b.createdAt;
}

export function viewWish(wish: Wish, bookedByMe: Set<string>): ViewedWish {
  const mine = bookedByMe.has(wish.id);
  return {
    ...wish,
    status: mine ? "BOOKED_BY_ME" : wish.booked ? "BOOKED" : "AVAILABLE",
    isReceived: wish.receivedAt !== null,
  };
}

/** A list as the giver sees it: what the owner already received is hidden, unless I was the one who bought it. */
export function wishesFor(snapshot: Snapshot, ownerId: string): ViewedWish[] {
  return (snapshot.wishesByOwner.get(ownerId) ?? [])
    .slice()
    .sort(byListOrder)
    .map((w) => viewWish(w, snapshot.bookedByMe))
    .filter((w) => !w.isReceived || w.status === "BOOKED_BY_ME");
}

function byName(a: PersonWishes, b: PersonWishes): number {
  return a.person.displayName.localeCompare(b.person.displayName, "hu", { sensitivity: "base" });
}

export function boardOf(snapshot: Snapshot): Board {
  const lists = snapshot.people.map((person) => ({ person, wishes: wishesFor(snapshot, person.id) }));
  const managed = lists.filter((l) => l.person.isManaged).sort(byName);
  const people = lists
    .filter((l) => !l.person.isManaged)
    .sort((a, b) => {
      const pendingFirst = Number(b.person.relation === "INVITED_ME") - Number(a.person.relation === "INVITED_ME");
      return pendingFirst || byName(a, b);
    });
  return { me: snapshot.me, managed, people, loading: !snapshot.ready };
}

export interface MyList {
  ownerId: string;
  /** Still wished for, in my order. */
  open: Wish[];
  received: Wish[];
}

export function myListOf(snapshot: Snapshot): MyList {
  const all = (snapshot.wishesByOwner.get(snapshot.myListOwnerId) ?? []).slice().sort(byListOrder);
  return {
    ownerId: snapshot.myListOwnerId,
    open: all.filter((w) => w.receivedAt === null),
    received: all.filter((w) => w.receivedAt !== null),
  };
}

/** Who I can show a private wish to: my accepted connections (accounts, not children). */
export function audienceCandidates(snapshot: Snapshot): Person[] {
  return snapshot.people
    .filter((p) => p.relation === "CONNECTED" && !p.isChild && p.id !== snapshot.me.id)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "hu", { sensitivity: "base" }));
}

export function findOwnWish(snapshot: Snapshot, wishId: string): Wish | null {
  return (snapshot.wishesByOwner.get(snapshot.myListOwnerId) ?? []).find((w) => w.id === wishId) ?? null;
}

export function findWish(snapshot: Snapshot, wishId: string): { wish: ViewedWish; owner: Person | null } | null {
  for (const [ownerId, wishes] of snapshot.wishesByOwner) {
    if (ownerId === snapshot.myListOwnerId) continue;
    const wish = wishes.find((w) => w.id === wishId);
    if (wish) {
      return { wish: viewWish(wish, snapshot.bookedByMe), owner: snapshot.people.find((p) => p.id === ownerId) ?? null };
    }
  }
  return null;
}

export interface BookedItem {
  booking: Booking;
  wish: ViewedWish | null;
  ownerName: string | null;
}

/** My bookings, newest first. A wish I can no longer see shows up without details. */
export function bookingsOf(snapshot: Snapshot): BookedItem[] {
  return snapshot.bookings
    .slice()
    .sort((a, b) => b.bookedAt - a.bookedAt)
    .map((booking) => {
      const wish = (snapshot.wishesByOwner.get(booking.ownerId) ?? []).find((w) => w.id === booking.wishId);
      const owner = snapshot.people.find((p) => p.id === booking.ownerId);
      return {
        booking,
        wish: wish ? viewWish(wish, snapshot.bookedByMe) : null,
        ownerName: owner?.displayName ?? null,
      };
    });
}

// endregion

export interface PlanSection {
  list: PlanList;
  /** Newest last, as they were added. */
  plans: Plan[];
}

export function plannerOf(snapshot: Snapshot): PlanSection[] {
  return snapshot.planLists.map((list) => ({
    list,
    plans: (snapshot.plansByOwner.get(list.ownerId) ?? []).slice().sort((a, b) => a.createdAt - b.createdAt),
  }));
}

export function planCount(snapshot: Snapshot): number {
  let n = 0;
  for (const list of snapshot.planLists) n += snapshot.plansByOwner.get(list.ownerId)?.length ?? 0;
  return n;
}

export function findPlan(snapshot: Snapshot, planId: string): Plan | null {
  for (const plans of snapshot.plansByOwner.values()) {
    const plan = plans.find((p) => p.id === planId);
    if (plan) return plan;
  }
  return null;
}

/** Sort order for a wish added to [ownerId]'s list: after everything there (WishOrdering.nextOrder). */
export function nextSortOrder(snapshot: Snapshot, ownerId: string): number {
  const wishes = snapshot.wishesByOwner.get(ownerId);
  if (!wishes) return Date.now(); // list not loaded (e.g. a shared list I'm a member of): put it last
  return Math.max(-1, ...wishes.map((w) => w.sortOrder)) + 1;
}
