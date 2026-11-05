// Checks for managing children, ported from the app's ChildUseCases and SaveWishUseCase. The rules enforce
// the same; these give a clear message before anything is written.

import { EMAIL_PATTERN, normalizeEmail } from "../format";
import { GROUP_MAX_MEMBERS, GROUP_MIN_MEMBERS, MAX_PARENTS, type ChildProfile, type Person, type User } from "../model";
import { S } from "../strings";
import type { Snapshot } from "./board";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Trimmed name and normalized e-mail (or null), or why they can't be used (validateChild). */
export function validateChild(me: User, name: string, email: string): Checked<{ name: string; email: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: S.errChildNameRequired };
  if (trimmed.length > 100) return { ok: false, error: S.errChildNameTooLong };
  const normalized = normalizeEmail(email) || null;
  if (normalized) {
    if (!EMAIL_PATTERN.test(normalized)) return { ok: false, error: S.errInvalidEmail };
    if (normalized === normalizeEmail(me.email)) return { ok: false, error: S.errChildOwnEmail };
  }
  return { ok: true, value: { name: trimmed, email: normalized } };
}

export function isRegistered(child: ChildProfile): boolean {
  return child.uid !== null;
}

/** My accepted connections (accounts) who aren't a parent of the child yet. */
export function coParentCandidates(snapshot: Snapshot, child: ChildProfile): Person[] {
  return snapshot.people
    .filter((p) => !p.isChild && !p.isManaged && p.relation === "CONNECTED" && !child.managers.includes(p.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "hu", { sensitivity: "base" }));
}

export function canAddCoParent(child: ChildProfile): boolean {
  return child.managers.length < MAX_PARENTS;
}

/**
 * What deleting a child takes (DeleteChildUseCase): their wishes, plans and the shared lists they're in.
 * Not allowed once the child registered, nor while someone is going to buy one of those wishes.
 */
export function childDeletion(
  snapshot: Snapshot,
  childId: string,
): Checked<{ wishIds: string[]; groupIds: string[]; planIds: string[] }> {
  const child = snapshot.managedChildren.find((c) => c.id === childId);
  if (!child) return { ok: false, error: S.errChildNotFound };
  if (isRegistered(child)) return { ok: false, error: S.errChildRegistered };
  const groupIds = snapshot.editableLists
    .filter((l) => l.kind === "SHARED" && !l.isOwn && l.group?.memberIds.includes(childId))
    .map((l) => l.ownerId);
  const owners = [childId, ...groupIds];
  const wishes = owners.flatMap((id) => snapshot.wishesByOwner.get(id) ?? []);
  // As in the app, received ones count too: the booker still sees them among their bookings for a week.
  if (wishes.some((w) => w.booked)) return { ok: false, error: S.errChildHasBooked };
  const planIds = owners.flatMap((id) => snapshot.plansByOwner.get(id) ?? []).map((p) => p.id);
  return { ok: true, value: { wishIds: wishes.map((w) => w.id), groupIds, planIds } };
}

/** Checks a set of children for a shared wish (SaveWishUseCase). */
export function checkShared(snapshot: Snapshot, childIds: string[]): Checked<ChildProfile[]> {
  if (childIds.length < GROUP_MIN_MEMBERS) return { ok: false, error: S.errSharedTooFew };
  if (childIds.length > GROUP_MAX_MEMBERS) return { ok: false, error: S.errSharedTooMany };
  const members = childIds.map((id) => snapshot.managedChildren.find((c) => c.id === id));
  if (members.some((m) => !m)) return { ok: false, error: S.errChildNotManager };
  return { ok: true, value: members as ChildProfile[] };
}
