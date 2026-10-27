// Firestore access for the web view. Every query and write has the exact shape firestore.rules expects;
// see FirestoreDataSource in the Android app for the same operations.

import { FirebaseError } from "firebase/app";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Query,
  type Timestamp,
} from "firebase/firestore";
import { firebase } from "../firebase";
import { AUDIENCE_PUBLIC } from "../model";
import type {
  Plan,
  Booking,
  ChildGroup,
  ChildProfile,
  FamilyMember,
  Invitation,
  InvitationStatus,
  User,
  Wish,
  WishDraft,
  WishField,
} from "../model";
import { S } from "../strings";

/** A failure with a message ready for the UI. */
export class StoreError extends Error {}

const db = () => firebase().db;

// region Mapping

function millis(value: unknown): number | null {
  const ts = value as Timestamp | null | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function stringMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) if (typeof v === "string") result[k] = v;
  }
  return result;
}

function toWish(snap: DocumentSnapshot<DocumentData>): Wish | null {
  const d = snap.data({ serverTimestamps: "estimate" });
  if (!d || typeof d.ownerId !== "string" || typeof d.name !== "string" || typeof d.priceHuf !== "number") return null;
  const createdAt = millis(d.createdAt) ?? 0;
  return {
    id: snap.id,
    ownerId: d.ownerId,
    name: d.name,
    priceHuf: d.priceHuf,
    description: d.description ?? null,
    imageUrl: d.imageUrl ?? null,
    productUrl: d.productUrl ?? null,
    booked: d.booked === true,
    requestedFields: strings(d.requestedFields) as WishField[],
    // Wishes created before ordering existed fall back to their creation time.
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : createdAt,
    createdAt,
    receivedAt: millis(d.receivedAt),
    audience: Array.isArray(d.audience) ? strings(d.audience) : null,
  };
}

function toPlan(snap: DocumentSnapshot<DocumentData>): Plan | null {
  const d = snap.data({ serverTimestamps: "estimate" });
  if (!d || typeof d.ownerId !== "string" || typeof d.name !== "string") return null;
  return {
    id: snap.id,
    ownerId: d.ownerId,
    name: d.name,
    priceHuf: typeof d.priceHuf === "number" ? d.priceHuf : null,
    description: d.description ?? null,
    imageUrl: d.imageUrl ?? null,
    productUrl: d.productUrl ?? null,
    createdAt: millis(d.createdAt) ?? 0,
  };
}

function toInvitation(snap: DocumentSnapshot<DocumentData>): Invitation | null {
  const d = snap.data();
  if (!d || typeof d.inviterUid !== "string" || typeof d.inviterEmail !== "string" || typeof d.status !== "string") {
    return null;
  }
  return {
    id: snap.id,
    inviterUid: d.inviterUid,
    inviterName: d.inviterName ?? "",
    inviterEmail: d.inviterEmail,
    inviteeEmail: d.inviteeEmail ?? "",
    inviteeUid: d.inviteeUid ?? null,
    inviteeName: d.inviteeName ?? null,
    status: d.status as InvitationStatus,
  };
}

function toFamilyMember(value: unknown): FamilyMember | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  if (typeof m.id !== "string") return null;
  return {
    id: m.id,
    name: typeof m.name === "string" ? m.name : "",
    email: typeof m.email === "string" ? m.email : null,
    isChild: m.isChild === true,
    parentNames: strings(m.parentNames),
  };
}

function toChild(snap: DocumentSnapshot<DocumentData>): ChildProfile | null {
  const d = snap.data();
  if (!d || typeof d.name !== "string") return null;
  const familyBy: Record<string, FamilyMember[]> = {};
  if (d.familyBy && typeof d.familyBy === "object") {
    for (const [managerId, members] of Object.entries(d.familyBy)) {
      if (Array.isArray(members)) {
        familyBy[managerId] = members.map(toFamilyMember).filter((m): m is FamilyMember => m !== null);
      }
    }
  }
  return {
    id: snap.id,
    name: d.name,
    email: d.email ?? null,
    uid: d.uid ?? null,
    managers: strings(d.managers),
    managerNames: stringMap(d.managerNames),
    familyBy,
  };
}

function toGroup(snap: DocumentSnapshot<DocumentData>): ChildGroup | null {
  const d = snap.data();
  const memberIds = strings(d?.memberIds);
  if (!d || memberIds.length < 2) return null;
  return { id: snap.id, memberIds, memberNames: stringMap(d.memberNames), managers: strings(d.managers) };
}

function toBooking(snap: DocumentSnapshot<DocumentData>): Booking | null {
  const d = snap.data({ serverTimestamps: "estimate" });
  if (!d || typeof d.ownerId !== "string") return null;
  return { wishId: d.wishId ?? snap.id, ownerId: d.ownerId, bookedAt: millis(d.bookedAt) ?? 0 };
}

// endregion

// region Observing

type Unsubscribe = () => void;

/**
 * Live query. A denied query (e.g. access revoked) reports an empty list rather than failing the screen,
 * like `emptyOnError` in the app's SyncEngine.
 */
/** Receives the items; [failed] is true when the query failed and the empty list stands in for it. */
export type Listener<T> = (items: T[], failed?: boolean) => void;

function listen<T>(
  q: Query<DocumentData>,
  map: (snap: DocumentSnapshot<DocumentData>) => T | null,
  onData: Listener<T>,
  label: string,
): Unsubscribe {
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(map).filter((x): x is T => x !== null)),
    (error) => {
      console.warn(`Surpriser: ${label} failed`, error);
      onData([], true);
    },
  );
}

const col = (name: string) => collection(db(), name);

export const observe = {
  receivedInvitations: (email: string, cb: Listener<Invitation>) =>
    listen(query(col("invitations"), where("inviteeEmail", "==", email)), toInvitation, cb, "received invitations"),
  sentInvitations: (uid: string, cb: Listener<Invitation>) =>
    listen(query(col("invitations"), where("inviterUid", "==", uid)), toInvitation, cb, "sent invitations"),
  managedChildren: (uid: string, cb: Listener<ChildProfile>) =>
    listen(query(col("children"), where("managers", "array-contains", uid)), toChild, cb, "managed children"),
  ownChildProfile: (uid: string, cb: Listener<ChildProfile>) =>
    listen(query(col("children"), where("uid", "==", uid)), toChild, cb, "own child profile"),
  visibleChildren: (email: string, cb: Listener<ChildProfile>) =>
    listen(query(col("children"), where("viewerEmails", "array-contains", email)), toChild, cb, "visible children"),
  managedGroups: (uid: string, cb: Listener<ChildGroup>) =>
    listen(query(col("childGroups"), where("managers", "array-contains", uid)), toGroup, cb, "managed shared lists"),
  visibleGroups: (email: string, cb: Listener<ChildGroup>) =>
    listen(query(col("childGroups"), where("viewerEmails", "array-contains", email)), toGroup, cb, "visible shared lists"),
  /**
   * One owner's wishes (one query per owner, not `in`: the rules check each owner on its own).
   * [giverId] null: I see the whole list (my own, or my child's). Otherwise the rules only allow queries
   * that can't return a private wish meant for someone else: the public ones, and the ones meant for me.
   */
  wishesOf: (ownerId: string, giverId: string | null, cb: Listener<Wish>) => {
    const ofOwner = (...extra: ReturnType<typeof where>[]) => query(col("wishes"), where("ownerId", "==", ownerId), ...extra);
    if (giverId === null) return listen(ofOwner(), toWish, cb, `wishes of ${ownerId}`);
    let pub: Wish[] | null = null;
    let mine: Wish[] | null = null;
    const emit = () => {
      if (pub === null || mine === null) return;
      const byId = new Map<string, Wish>();
      for (const w of [...pub, ...mine]) byId.set(w.id, w);
      cb([...byId.values()]);
    };
    const stopPublic = listen(ofOwner(where("audience", "array-contains", AUDIENCE_PUBLIC)), toWish, (items) => {
      pub = items;
      emit();
    }, `public wishes of ${ownerId}`);
    const stopMine = listen(ofOwner(where("audience", "array-contains", giverId)), toWish, (items) => {
      mine = items;
      emit();
    }, `wishes of ${ownerId} meant for me`);
    return () => {
      stopPublic();
      stopMine();
    };
  },
  /** Plans of a list I can edit (the rules only let the list's editors read them). */
  plansOf: (ownerId: string, cb: Listener<Plan>) =>
    listen(query(col("plans"), where("ownerId", "==", ownerId)), toPlan, cb, `plans of ${ownerId}`),
  bookings: (uid: string, cb: Listener<Booking>) =>
    listen(query(col("bookings"), where("bookerId", "==", uid)), toBooking, cb, "bookings"),
};

// endregion

// region Profile

/** The public profile the rules use for e-mail lookups. Must run on every sign-in. */
export async function saveProfile(me: User): Promise<void> {
  await setDoc(
    doc(db(), "users", me.id),
    { displayName: me.displayName, email: me.email, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** A child whose parent added them with this e-mail takes over their profile on first sign-in. */
export async function claimChildProfile(me: User): Promise<boolean> {
  try {
    const pending = await getDocs(
      query(col("children"), where("email", "==", me.email), where("uid", "==", null)),
    );
    const child = pending.docs[0];
    if (!child) return false;
    const batch = writeBatch(db());
    batch.update(child.ref, { uid: me.id });
    batch.set(
      doc(db(), "users", me.id),
      { childProfileId: child.id, displayName: me.displayName, email: me.email, updatedAt: serverTimestamp() },
      { merge: true },
    );
    await batch.commit();
    return true;
  } catch (e) {
    console.warn("Surpriser: claiming a child profile failed", e);
    return false;
  }
}

// endregion

// region Giving

function code(e: unknown): string {
  return e instanceof FirebaseError ? e.code : "";
}

function isOffline(e: unknown): boolean {
  const c = code(e);
  return c === "unavailable" || c === "deadline-exceeded" || (typeof navigator !== "undefined" && !navigator.onLine);
}

/** Books a wish: the flag on the wish and the booking (the only record of who) change together. */
export async function book(wishId: string, me: User): Promise<void> {
  const wishRef = doc(db(), "wishes", wishId);
  try {
    await runTransaction(db(), async (tx) => {
      const wish = await tx.get(wishRef);
      if (!wish.exists()) throw new StoreError(S.errWishNotFound);
      if (wish.get("booked") === true) throw new StoreError(S.errAlreadyBooked);
      if (wish.get("receivedAt") != null) throw new StoreError(S.errAlreadyReceived);
      tx.update(wishRef, { booked: true });
      tx.set(doc(db(), "bookings", wishId), {
        wishId,
        bookerId: me.id,
        ownerId: wish.get("ownerId"),
        bookedAt: serverTimestamp(),
      });
    });
  } catch (e) {
    if (e instanceof StoreError) throw e;
    console.warn("Surpriser: booking failed", e);
    if (isOffline(e)) throw new StoreError(S.errNetworkBooking);
    // Denied: e.g. access was revoked meanwhile, or it's the viewer's own list.
    throw new StoreError(code(e) === "permission-denied" ? S.errWishNotFound : S.errUnknown);
  }
}

export async function unbook(wishId: string, me: User): Promise<void> {
  const bookingRef = doc(db(), "bookings", wishId);
  try {
    await runTransaction(db(), async (tx) => {
      const booking = await tx.get(bookingRef);
      if (!booking.exists() || booking.get("bookerId") !== me.id) throw new StoreError(S.errNotBookedByMe);
      tx.update(doc(db(), "wishes", wishId), { booked: false });
      tx.delete(bookingRef);
    });
  } catch (e) {
    if (e instanceof StoreError) throw e;
    console.warn("Surpriser: unbooking failed", e);
    if (isOffline(e)) throw new StoreError(S.errNetwork);
    // Reading someone else's booking is denied, which also means "not yours".
    throw new StoreError(code(e) === "permission-denied" ? S.errNotBookedByMe : S.errUnknown);
  }
}

/** Asks the owner, anonymously, to fill in one empty field. Nothing records who asked. */
export async function requestInfo(wish: Wish, field: WishField): Promise<void> {
  const filled =
    (field === "DESCRIPTION" && wish.description) ||
    (field === "IMAGE_URL" && wish.imageUrl) ||
    (field === "PRODUCT_URL" && wish.productUrl);
  if (filled) throw new StoreError(S.errFieldAlreadyFilled);
  try {
    await updateDoc(doc(db(), "wishes", wish.id), { requestedFields: arrayUnion(field) });
  } catch (e) {
    console.warn("Surpriser: requesting info failed", e);
    throw new StoreError(isOffline(e) ? S.errNetwork : S.errUnknown);
  }
}

// endregion

// region Invitations

export async function respondToInvitation(invitationId: string, me: User, accept: boolean): Promise<void> {
  const ref = doc(db(), "invitations", invitationId);
  try {
    const invitation = await getDoc(ref);
    if (!invitation.exists() || invitation.get("inviteeEmail") !== me.email || invitation.get("status") !== "PENDING") {
      throw new StoreError(S.errInvitationNotFound);
    }
    await updateDoc(ref, {
      status: accept ? "ACCEPTED" : "DECLINED",
      inviteeUid: me.id,
      inviteeName: me.displayName,
      respondedAt: serverTimestamp(),
    });
    if (accept) {
      // If I had invited them too, my invitation is redundant now.
      const mine = doc(db(), "invitations", `${me.id}_${invitation.get("inviterEmail")}`);
      const mineSnapshot = await getDoc(mine);
      if (mineSnapshot.exists() && mineSnapshot.get("status") === "PENDING") await deleteDoc(mine);
    }
  } catch (e) {
    if (e instanceof StoreError) throw e;
    console.warn("Surpriser: answering the invitation failed", e);
    if (isOffline(e)) throw new StoreError(S.errNetwork);
    throw new StoreError(code(e) === "permission-denied" ? S.errInvitationNotFound : S.errUnknown);
  }
}

// endregion

// region My own list (the owner's writes; see WishEditPolicy and FirestoreDataSource in the app)

function audienceOf(draft: WishDraft): string[] {
  return draft.visibleTo ? [...draft.visibleTo].sort() : [AUDIENCE_PUBLIC];
}

async function write(label: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (e) {
    console.warn(`Surpriser: ${label} failed`, e);
    throw new StoreError(isOffline(e) ? S.errNetwork : S.errUnknown);
  }
}

function newWishData(ownerId: string, draft: WishDraft, sortOrder: number) {
  return {
    ownerId,
    name: draft.name,
    priceHuf: draft.priceHuf,
    description: draft.description,
    imageUrl: draft.imageUrl,
    productUrl: draft.productUrl,
    booked: false,
    requestedFields: [],
    sortOrder,
    receivedAt: null,
    audience: audienceOf(draft),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function createWish(ownerId: string, draft: WishDraft, sortOrder: number): Promise<void> {
  return write("creating a wish", () => setDoc(doc(col("wishes")), newWishData(ownerId, draft, sortOrder)));
}

/** [answered]: requested fields the owner just filled in; their requests are cleared. */
export function updateWish(wishId: string, draft: WishDraft, answered: WishField[]): Promise<void> {
  const data: Record<string, unknown> = {
    name: draft.name,
    priceHuf: draft.priceHuf,
    description: draft.description,
    imageUrl: draft.imageUrl,
    productUrl: draft.productUrl,
    audience: audienceOf(draft),
    updatedAt: serverTimestamp(),
  };
  if (answered.length > 0) data.requestedFields = arrayRemove(...answered);
  return write("updating a wish", () => updateDoc(doc(db(), "wishes", wishId), data));
}

export function deleteWish(wishId: string): Promise<void> {
  return write("deleting a wish", () => deleteDoc(doc(db(), "wishes", wishId)));
}

export function updateOrder(orders: Map<string, number>): Promise<void> {
  if (orders.size === 0) return Promise.resolve();
  const batch = writeBatch(db());
  for (const [wishId, sortOrder] of orders) {
    batch.update(doc(db(), "wishes", wishId), { sortOrder, updatedAt: serverTimestamp() });
  }
  return write("reordering", () => batch.commit());
}

export function setReceived(wishId: string, received: boolean): Promise<void> {
  return write("marking as received", () =>
    updateDoc(doc(db(), "wishes", wishId), {
      receivedAt: received ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Wishes from before private wishes existed: givers' queries only find them once marked public. */
export function markWishesPublic(wishIds: string[]): Promise<void> {
  if (wishIds.length === 0) return Promise.resolve();
  const batch = writeBatch(db());
  for (const id of wishIds) {
    batch.update(doc(db(), "wishes", id), { audience: [AUDIENCE_PUBLIC], updatedAt: serverTimestamp() });
  }
  return write("marking old wishes public", () => batch.commit());
}

// endregion

// region Inviting

export async function invite(me: User, inviteeEmail: string): Promise<"sent" | "accepted"> {
  try {
    // Did they already invite me? Then inviting back means accepting.
    const reverse = await getDocs(
      query(col("invitations"), where("inviteeEmail", "==", me.email), where("inviterEmail", "==", inviteeEmail)),
    );
    if (reverse.docs.some((d) => d.get("status") === "ACCEPTED")) throw new StoreError(S.errAlreadyConnected);
    const pending = reverse.docs.find((d) => d.get("status") === "PENDING");
    if (pending) {
      await updateDoc(pending.ref, {
        status: "ACCEPTED",
        inviteeUid: me.id,
        inviteeName: me.displayName,
        respondedAt: serverTimestamp(),
      });
      return "accepted";
    }

    const ref = doc(db(), "invitations", `${me.id}_${inviteeEmail}`);
    const existing = await getDoc(ref);
    const status = existing.exists() ? existing.get("status") : null;
    if (status === "ACCEPTED") throw new StoreError(S.errAlreadyConnected);
    if (status === "PENDING") throw new StoreError(S.errAlreadyInvited);
    if (status === "DECLINED") {
      await updateDoc(ref, { status: "PENDING", inviterName: me.displayName, respondedAt: null });
    } else {
      await setDoc(ref, {
        inviterUid: me.id,
        inviterName: me.displayName,
        inviterEmail: me.email,
        inviteeEmail,
        inviteeUid: null,
        inviteeName: null,
        status: "PENDING",
        createdAt: serverTimestamp(),
        respondedAt: null,
      });
    }
    return "sent";
  } catch (e) {
    if (e instanceof StoreError) throw e;
    console.warn("Surpriser: inviting failed", e);
    throw new StoreError(isOffline(e) ? S.errNetwork : S.errUnknown);
  }
}

// endregion

// region Gift planner (plans/{id}; PlanUseCases and FirestoreDataSource in the app)

function planData(ownerId: string, draft: WishDraft) {
  return {
    ownerId,
    name: draft.name,
    priceHuf: draft.priceHuf,
    description: draft.description,
    imageUrl: draft.imageUrl,
    productUrl: draft.productUrl,
    updatedAt: serverTimestamp(),
  };
}

function newPlanData(ownerId: string, draft: WishDraft, createdBy: string) {
  return { ...planData(ownerId, draft), createdBy, createdAt: serverTimestamp() };
}

export function createPlan(ownerId: string, draft: WishDraft, me: User): Promise<void> {
  return write("creating a plan", () => setDoc(doc(col("plans")), newPlanData(ownerId, draft, me.id)));
}

/** Editing, or moving it to another list I can edit. */
export function updatePlan(planId: string, ownerId: string, draft: WishDraft): Promise<void> {
  return write("updating a plan", () => updateDoc(doc(db(), "plans", planId), planData(ownerId, draft)));
}

export function deletePlan(planId: string): Promise<void> {
  return write("deleting a plan", () => deleteDoc(doc(db(), "plans", planId)));
}

/** The plan becomes a wish on [ownerId]'s list: created and deleted in one batch. */
export function approvePlan(planId: string, ownerId: string, draft: WishDraft, sortOrder: number): Promise<void> {
  const batch = writeBatch(db());
  batch.set(doc(col("wishes")), newWishData(ownerId, { ...draft, visibleTo: null }, sortOrder));
  batch.delete(doc(db(), "plans", planId));
  return write("approving a plan", () => batch.commit());
}

/** Back to the planner: only while nobody booked or received it (the rules check it too). */
export function moveWishToPlans(wish: Wish, me: User): Promise<void> {
  const batch = writeBatch(db());
  batch.set(
    doc(col("plans")),
    newPlanData(
      wish.ownerId,
      {
        name: wish.name,
        priceHuf: wish.priceHuf,
        description: wish.description,
        imageUrl: wish.imageUrl,
        productUrl: wish.productUrl,
        visibleTo: null,
      },
      me.id,
    ),
  );
  batch.delete(doc(db(), "wishes", wish.id));
  return write("moving a wish to the planner", () => batch.commit());
}

// endregion
