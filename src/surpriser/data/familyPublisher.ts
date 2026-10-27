// Publishing who may see my children (and their shared lists). A child profile can only be written by its
// parents, so each parent's client keeps `viewerEmails` / `familyBy` up to date from that parent's
// connections. This is a port of the app's SyncEngine.publishFamilies / publishGroups (planFamilyPublications,
// planGroupPublications, FirestoreDataSource.publishFamily / publishGroup) and writes exactly the same values,
// so the app and the web never undo each other's work.

import { doc, runTransaction } from "firebase/firestore";
import { firebase } from "../firebase";
import type { ChildGroup, ChildProfile, FamilyMember, Person, User } from "../model";
import { normalizeEmail } from "../format";

export interface PublishInput {
  me: User;
  /** Everyone I see; only accepted connections that are accounts count. */
  people: Person[];
  /** E-mails I invited that haven't answered yet: they may see my children too. */
  pendingInviteeEmails: string[];
  /** Children I'm a parent of. */
  managedChildren: ChildProfile[];
  /** Shared lists of my children. */
  managedGroups: ChildGroup[];
}

/** Deep equality that ignores the order of map keys (Firestore may return them in another order). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  return value ?? null;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** viewerEmailsOf in the app: my connections, the people I invited, and [extra]; normalized, distinct, sorted. */
function viewerEmailsOf(input: PublishInput, extra: string[] = []): string[] {
  const connected = input.people.filter((p) => !p.isChild && !p.isManaged && p.relation === "CONNECTED").map((p) => p.email);
  return [...new Set([...connected, ...input.pendingInviteeEmails, ...extra].map(normalizeEmail).filter((e) => e !== ""))].sort();
}

/** Compares like Kotlin's String.compareTo (UTF-16 code units), which the app sorts with. */
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function familyMember(m: FamilyMember) {
  // Same field order as the app's RemoteFamilyMember.toMap().
  return { id: m.id, name: m.name, email: m.email, isChild: m.isChild, parentNames: m.parentNames };
}

function familyOf(input: PublishInput, child: ChildProfile): ReturnType<typeof familyMember>[] {
  const adults: FamilyMember[] = [
    { id: input.me.id, name: input.me.displayName, email: input.me.email, isChild: false, parentNames: [] },
    ...input.people
      .filter((p) => !p.isChild && !p.isManaged && p.relation === "CONNECTED")
      .map((p) => ({ id: p.id, name: p.displayName, email: p.email, isChild: false, parentNames: [] })),
  ];
  const siblings: FamilyMember[] = input.managedChildren
    .filter((c) => c.id !== child.id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      isChild: true,
      parentNames: c.managers.map((id) => c.managerNames[id] ?? "").filter((n) => n.trim() !== ""),
    }));
  return [...adults, ...siblings].sort(byId).map(familyMember);
}

async function publishFamily(me: User, childId: string, viewerEmails: string[], family: ReturnType<typeof familyMember>[]) {
  const ref = doc(firebase().db, "children", childId);
  await runTransaction(firebase().db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return;
    const managers: string[] = Array.isArray(data.managers) ? data.managers : [];
    if (!managers.includes(me.id)) return;
    const viewerEmailsBy: Record<string, string[]> = data.viewerEmailsBy ?? {};
    const familyBy: Record<string, unknown[]> = data.familyBy ?? {};
    const managerNames: Record<string, string> = data.managerNames ?? {};
    const unchanged =
      sameJson(viewerEmailsBy[me.id] ?? null, viewerEmails) &&
      sameJson(familyBy[me.id] ?? null, family) &&
      managerNames[me.id] === me.displayName;
    if (unchanged) return;

    // Drop contributions of parents who are no longer parents.
    const keep = <T,>(map: Record<string, T>) => Object.fromEntries(Object.entries(map).filter(([k]) => managers.includes(k)));
    const nextViewersBy = { ...keep(viewerEmailsBy), [me.id]: viewerEmails };
    const nextFamilyBy = { ...keep(familyBy), [me.id]: family };
    const familyIds = Object.values(nextFamilyBy).flatMap((members) =>
      (members as { id?: unknown }[]).map((m) => m?.id).filter((id): id is string => typeof id === "string"),
    );
    tx.update(ref, {
      viewerEmailsBy: nextViewersBy,
      viewerEmails: [...new Set(Object.values(nextViewersBy).flat())],
      familyBy: nextFamilyBy,
      familyOwnerIds: [...new Set([...managers, ...familyIds])],
      [`managerNames.${me.id}`]: me.displayName,
    });
  });
}

async function publishGroup(
  me: User,
  groupId: string,
  viewerEmails: string[],
  managers: string[],
  memberNames: Record<string, string>,
) {
  const ref = doc(firebase().db, "childGroups", groupId);
  await runTransaction(firebase().db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return;
    const current: string[] = Array.isArray(data.managers) ? data.managers : [];
    // Never add myself back after leaving (e.g. while deleting my account).
    if (!current.includes(me.id)) return;
    const viewerEmailsBy: Record<string, string[]> = data.viewerEmailsBy ?? {};
    const currentNames: Record<string, string> = data.memberNames ?? {};
    const unchanged =
      sameJson(viewerEmailsBy[me.id] ?? null, viewerEmails) &&
      managers.every((m) => current.includes(m)) &&
      Object.entries(memberNames).every(([id, name]) => currentNames[id] === name);
    if (unchanged) return;

    const allManagers = [...new Set([...current, ...managers])].sort();
    const kept = Object.fromEntries(Object.entries(viewerEmailsBy).filter(([k]) => allManagers.includes(k)));
    const nextViewersBy = { ...kept, [me.id]: viewerEmails };
    const update: Record<string, unknown> = {
      viewerEmailsBy: nextViewersBy,
      viewerEmails: [...new Set(Object.values(nextViewersBy).flat())].sort(),
      managers: allManagers,
    };
    for (const [id, name] of Object.entries(memberNames)) update[`memberNames.${id}`] = name;
    tx.update(ref, update);
  });
}

/** Writes what changed; a failure is logged and retried at the next change, like in the app. */
export async function publishFamilies(input: PublishInput): Promise<void> {
  if (input.managedChildren.length === 0) return;
  const viewerEmails = viewerEmailsOf(input);
  for (const child of input.managedChildren) {
    try {
      await publishFamily(input.me, child.id, viewerEmails, familyOf(input, child));
    } catch (e) {
      console.warn(`Surpriser: publishing the family of ${child.id} failed`, e);
    }
  }

  const mine = new Map(input.managedChildren.map((c) => [c.id, c]));
  const registeredEmails = input.managedChildren.filter((c) => c.uid !== null && c.email).map((c) => c.email as string);
  const groupViewers = viewerEmailsOf(input, registeredEmails);
  for (const group of input.managedGroups) {
    const members = group.memberIds.map((id) => mine.get(id)).filter((c): c is ChildProfile => !!c);
    const managers = [...new Set([input.me.id, ...members.flatMap((c) => c.managers)])].sort();
    const memberNames = Object.fromEntries(members.map((c) => [c.id, c.name]));
    try {
      await publishGroup(input.me, group.id, groupViewers, managers, memberNames);
    } catch (e) {
      console.warn(`Surpriser: publishing the shared list ${group.id} failed`, e);
    }
  }
}
