// Domain model of the Surpriser web view. Mirrors the Android app (domain/model, data/remote).

export interface User {
  id: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
}

export type WishField = "DESCRIPTION" | "IMAGE_URL" | "PRODUCT_URL";

export interface Wish {
  id: string;
  ownerId: string;
  name: string;
  priceHuf: number;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  booked: boolean;
  requestedFields: WishField[];
  sortOrder: number;
  createdAt: number;
  receivedAt: number | null;
  /**
   * Who sees it besides the list's editors: ["public"], or the uids of the chosen viewers (empty: only the
   * editors). Null on wishes from before private wishes existed; the owner's client marks those public.
   */
  audience: string[] | null;
}

export const AUDIENCE_PUBLIC = "public";

/**
 * A gift idea on a list that isn't a wish yet. Only the list's editors see it (the owner, the parents and
 * the registered child); once one of them approves it, it becomes a wish everyone can see.
 */
export interface Plan {
  id: string;
  ownerId: string;
  name: string;
  /** May still be missing; a wish needs one, so it's asked for at approval. */
  priceHuf: number | null;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  createdAt: number;
}

export type PlanListKind = "MINE" | "CHILD" | "SHARED";

/** A list I can edit, and so plan for. */
export interface PlanList {
  ownerId: string;
  name: string;
  kind: PlanListKind;
}

export function isPrivate(wish: Wish): boolean {
  return wish.audience !== null && !wish.audience.includes(AUDIENCE_PUBLIC);
}

/** What the owner types into the editor. */
export interface WishDraft {
  name: string;
  priceHuf: number | null;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  /** Null: everyone who sees the list. Otherwise only these uids (empty: only me). */
  visibleTo: string[] | null;
}

/** What the viewer sees about a wish. The booker is never on the wish: only "did *I* book it". */
export type BookingStatus = "AVAILABLE" | "BOOKED" | "BOOKED_BY_ME";

export interface ViewedWish extends Wish {
  status: BookingStatus;
  isReceived: boolean;
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface Invitation {
  id: string;
  inviterUid: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  inviteeUid: string | null;
  inviteeName: string | null;
  status: InvitationStatus;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string | null;
  isChild: boolean;
  parentNames: string[];
}

export interface ChildProfile {
  id: string;
  name: string;
  email: string | null;
  uid: string | null;
  managers: string[];
  managerNames: Record<string, string>;
  familyBy: Record<string, FamilyMember[]>;
}

export interface ChildGroup {
  id: string;
  memberIds: string[];
  memberNames: Record<string, string>;
  managers: string[];
}

export interface Booking {
  wishId: string;
  ownerId: string;
  bookedAt: number;
}

export type Relation = "CONNECTED" | "INVITED_ME";

/** A list the viewer can give from: an account, a child profile or a shared list of children. */
export interface Person {
  id: string;
  displayName: string;
  email: string;
  relation: Relation;
  /** Set when [relation] is INVITED_ME, so the viewer can answer. */
  pendingInvitationId: string | null;
  isChild: boolean;
  parentNames: string[];
  isGroup: boolean;
  /** My own child (or a shared list of my children): I may buy from it, but edit it in the app. */
  isManaged: boolean;
}

export interface PersonWishes {
  person: Person;
  /** In list order; received wishes are only here if I bought them. */
  wishes: ViewedWish[];
}

export const PREVIEW_SIZE = 3;

export function previewOf(list: PersonWishes): ViewedWish[] {
  return list.wishes.filter((w) => w.status === "AVAILABLE" && !w.isReceived).slice(0, PREVIEW_SIZE);
}

export interface Board {
  me: User;
  /** Children I manage and their shared lists. */
  managed: PersonWishes[];
  /** Pending invitations first, then everyone else by name. */
  people: PersonWishes[];
  loading: boolean;
}

/** "Bence", "Bence és Bori", "Bence, Bori és Kata". */
export function joinAsNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " és " + names[names.length - 1];
}
