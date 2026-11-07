import type { User as FirebaseUser } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { isConfigured } from "../config";
import { isAppleRelayEmail, observeUser, signOut, toUser } from "../data/authService";
import {
  audienceCandidates,
  boardOf,
  bookingsOf,
  editableList,
  findEditableWish,
  findPlan,
  findWish,
  listOf,
  myListOf,
  nextSortOrder,
  observeSnapshot,
  planCount,
  plannerOf,
  type Snapshot,
} from "../data/board";
import { canAddCoParent, checkShared, childDeletion, coParentCandidates, isRegistered, validateChild } from "../data/children";
import {
  addCoParent,
  approvePlan,
  book,
  claimChildProfile,
  createChild,
  createPlan,
  createWish,
  deleteChild,
  deletePlan,
  deleteWish,
  ensureGroup,
  updateChild,
  moveWishToPlans,
  invite,
  requestInfo,
  respondToInvitation,
  saveProfile,
  setReceived,
  StoreError,
  unbook,
  updateOrder,
  updatePlan,
  updateWish,
} from "../data/storeService";
import { groupIdOf, type EditableList, type User, type Wish, type WishField, type WishTarget } from "../model";
import { S } from "../strings";
import { AuthScreen, NameScreen } from "./AuthScreen";
import { BoardScreen } from "./BoardScreen";
import { AccountDeletedScreen, AccountDeletionScreen } from "./AccountDeletionScreen";
import { BookingsScreen } from "./BookingsScreen";
import { ChildEditorScreen, CoParentScreen } from "./ChildEditorScreen";
import { IconBulb, IconGift, IconPersonAdd, Spinner, Toast, TopBar, TopBarIcon, type ToastMessage } from "./components";
import { InviteScreen } from "./InviteScreen";
import { ManagedListCard } from "./ManagedListCard";
import { MyListSection } from "./MyListSection";
import { PlanEditorScreen } from "./PlanEditorScreen";
import { PlannerScreen } from "./PlannerScreen";
import { goBack, href, useRoute } from "./router";
import { WishDetailsScreen } from "./WishDetailsScreen";
import { WishEditorScreen, type OwnerPicker } from "./WishEditorScreen";

export default function App() {
  if (!isConfigured) {
    return (
      <main class="sp-container py-20">
        <p class="sp-empty">{S.errNotConfigured}</p>
      </main>
    );
  }
  return <SignedInGate />;
}

function SignedInGate() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  // Verifying the e-mail doesn't fire an auth event; this re-reads the user after a reload.
  const [, setVerifiedTick] = useState(0);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const route = useRoute();

  useEffect(() => observeUser(setFirebaseUser), []);

  if (firebaseUser === undefined) return <Spinner />;
  if (firebaseUser === null && accountDeleted) {
    return (
      <AccountDeletedScreen
        onDone={() => {
          setAccountDeleted(false);
          location.hash = href.board();
        }}
      />
    );
  }
  if (firebaseUser === null || !firebaseUser.emailVerified) {
    return (
      <AuthScreen
        unverifiedEmail={firebaseUser?.email ?? null}
        onVerified={() => setVerifiedTick((n) => n + 1)}
      />
    );
  }
  if (!firebaseUser.displayName?.trim()) {
    return <NameScreen email={firebaseUser.email ?? ""} onDone={() => setVerifiedTick((n) => n + 1)} />;
  }
  // Instead of the board: its listeners and the publishing stop while the data is deleted.
  if (route.name === "deleteAccount") {
    return <AccountDeletionScreen me={toUser(firebaseUser)} onDeleted={() => setAccountDeleted(true)} />;
  }
  return <GiverApp key={firebaseUser.uid} me={toUser(firebaseUser)} />;
}

interface ToastOptions {
  error?: boolean;
  action?: ToastMessage["action"];
}

function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<number>();
  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setMessage(null);
  }, []);
  const show = useCallback((text: string, options: ToastOptions = {}) => {
    window.clearTimeout(timer.current);
    setMessage({ id: Date.now(), text, ...options });
    // Long messages and ones with an action stay longer.
    const ms = Math.max(options.error || options.action ? 6000 : 3500, text.length * 60);
    timer.current = window.setTimeout(() => setMessage(null), ms);
  }, []);
  return { message, show, dismiss };
}

function GiverApp({ me }: { me: User }) {
  const route = useRoute();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      // The rules find people by the e-mail on the public profile, so it has to exist before anything else.
      try {
        await saveProfile(me);
      } catch (e) {
        console.warn("Surpriser: saving the profile failed", e);
      }
      await claimChildProfile(me);
      if (!cancelled) stop = observeSnapshot(me, setSnapshot);
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [me.id]);

  const board = useMemo(() => (snapshot ? boardOf(snapshot) : null), [snapshot]);
  const myList = useMemo(() => (snapshot ? myListOf(snapshot) : null), [snapshot]);

  /** Runs a write; shows [success] (or the error) and tells whether it worked. */
  const guarded = async (work: () => Promise<unknown>, success: string | null, action?: ToastMessage["action"]) => {
    try {
      await work();
      if (success) toast.show(success, { action });
      return true;
    } catch (e) {
      toast.show(e instanceof StoreError ? e.message : S.errUnknown, { error: true });
      return false;
    }
  };

  const respond = async (invitationId: string, accept: boolean) => {
    const inviter = snapshot?.people.find((p) => p.pendingInvitationId === invitationId);
    const message = !accept
      ? S.invitationDeclined
      : inviter
        ? S.invitationAcceptedKids(inviter.displayName)
        : S.invitationAccepted;
    await guarded(() => respondToInvitation(invitationId, me, accept), message);
  };

  const toggleReceived = async (wish: Wish) => {
    const received = wish.receivedAt === null;
    const mine = wish.ownerId === snapshot?.myListOwnerId;
    await guarded(
      () => setReceived(wish.id, received),
      received ? S.receivedMessage : mine ? S.restoredMessage : S.restoredToList,
      { label: S.undo, run: () => void guarded(() => setReceived(wish.id, !received), null) },
    );
  };

  /** The list a wish goes to: a shared one is created on first use (ensureGroup). */
  const resolveTarget = async (target: WishTarget): Promise<string> => {
    if (target.kind === "single") return target.ownerId;
    if (!snapshot) throw new StoreError(S.errUnknown);
    const checked = checkShared(snapshot, target.childIds);
    if (!checked.ok) throw new StoreError(checked.error);
    const id = groupIdOf(target.childIds);
    if (snapshot.editableLists.some((l) => l.ownerId === id && !l.isOwn)) return id;
    return ensureGroup(me, checked.value);
  };

  /** "Kié?" for parents: offered when the list is mine, one of my children's, or shared by my children only. */
  const ownerPickerFor = (list: EditableList, existing: Wish | null): OwnerPicker | null => {
    if (!snapshot || snapshot.managedChildren.length === 0) return null;
    const base = {
      myOwnerId: snapshot.myListOwnerId,
      children: snapshot.managedChildren,
      meSelected: false,
      childIds: [] as string[],
      sharedOnly: false,
      locked: existing !== null && (existing.booked || existing.receivedAt !== null),
    };
    const mine = new Set(snapshot.managedChildren.map((c) => c.id));
    if (list.ownerId === snapshot.myListOwnerId) return { ...base, meSelected: true };
    if (list.kind === "CHILD" && mine.has(list.ownerId)) return { ...base, childIds: [list.ownerId] };
    if (list.kind === "SHARED" && !list.isOwn && list.group && list.group.memberIds.every((id) => mine.has(id))) {
      return { ...base, childIds: list.group.memberIds.slice(), sharedOnly: existing !== null };
    }
    return null;
  };

  const managedCard = (list: EditableList) => {
    if (!snapshot) return null;
    const wishes = listOf(snapshot, list.ownerId);
    return (
      <ManagedListCard
        key={list.ownerId}
        list={list}
        wishes={wishes}
        people={snapshot.people}
        bookedByMe={snapshot.bookedByMe}
        onMove={async (orders) => {
          await guarded(() => updateOrder(orders), null);
        }}
        onRestore={toggleReceived}
        onClearReceived={async () => {
          await guarded(() => Promise.all(wishes.received.map((w) => deleteWish(w.id))), S.receivedCleared);
        }}
        onDelete={
          list.child
            ? async () => {
                const plan = childDeletion(snapshot, list.ownerId);
                if (!plan.ok) {
                  toast.show(plan.error, { error: true });
                  return false;
                }
                const { wishIds, groupIds, planIds } = plan.value;
                return guarded(() => deleteChild(list.ownerId, wishIds, groupIds, planIds), S.childDeleted);
              }
            : undefined
        }
      />
    );
  };

  /** Saves a child's data; returns the message to show in the form, or null when it's done. */
  const saveChild = async (childId: string | null, name: string, email: string): Promise<string | null> => {
    const checked = validateChild(me, name, email);
    if (!checked.ok) return checked.error;
    const existing = childId ? snapshot?.managedChildren.find((c) => c.id === childId) ?? null : null;
    if (childId && !existing) return S.errChildNotFound;
    if (existing && isRegistered(existing) && checked.value.email !== existing.email) return S.errChildRegistered;
    try {
      if (existing) await updateChild(existing.id, checked.value.name, checked.value.email);
      else await createChild(me, checked.value.name, checked.value.email);
    } catch (e) {
      return e instanceof StoreError ? e.message : S.errUnknown;
    }
    toast.show(existing ? S.childSaved : S.childAdded);
    goBack();
    return null;
  };

  const accountMenu = (
    <details class="dropdown dropdown-end">
      <summary class="btn btn-ghost btn-circle btn-sm" aria-label="Fiók">
        <span class="sp-me" aria-hidden="true">
          {me.displayName.slice(0, 1).toUpperCase()}
        </span>
      </summary>
      <div class="dropdown-content z-30 mt-2 w-64 rounded-box bg-base-100 p-4 shadow-lg border border-base-300">
        <p class="font-semibold truncate">{me.displayName}</p>
        <p class="text-sm text-base-content/60 truncate mb-3">{me.email}</p>
        {isAppleRelayEmail(me.email) && <p class="text-xs text-base-content/70 mb-3">{S.relayEmailNote(me.email)}</p>}
        <button type="button" class="btn btn-sm btn-outline w-full" onClick={() => signOut()}>
          {S.logout}
        </button>
        <a href={href.deleteAccount()} class="btn btn-sm btn-ghost text-error w-full mt-2">
          {S.deleteAccount}
        </a>
      </div>
    </details>
  );

  let title = S.boardTitle;
  let back: (() => void) | undefined;
  let content = <Spinner />;

  if (route.name === "board" && snapshot && board && myList) {
    const childLists = snapshot.editableLists.filter((l) => l.kind === "CHILD");
    const groupLists = snapshot.editableLists.filter((l) => l.kind === "SHARED");
    const managed =
      childLists.length + groupLists.length === 0 ? null : (
        <>
          {childLists.length > 0 && (
            <section aria-labelledby="sp-children">
              <div class="sp-section-head">
                <h2 id="sp-children" class="sp-section-title">
                  {S.children}
                </h2>
                <a href={href.newChild()} class="btn btn-outline btn-sm">
                  {S.addChildShort}
                </a>
              </div>
              <p class="sp-section-hint">{S.managedHint}</p>
              <div class="flex flex-col gap-4">{childLists.map(managedCard)}</div>
            </section>
          )}
          {groupLists.length > 0 && (
            <section aria-labelledby="sp-shared">
              <h2 id="sp-shared" class="sp-section-title">
                {S.shared}
              </h2>
              <div class="flex flex-col gap-4">{groupLists.map(managedCard)}</div>
            </section>
          )}
        </>
      );
    content = (
      <BoardScreen
        board={board}
        managed={managed}
        canAddChild={childLists.length === 0 && snapshot.myListOwnerId === me.id}
        pendingSent={snapshot.sentPending.length}
        onRespond={respond}
        myList={
          <MyListSection
            list={myList}
            people={snapshot.people}
            onMove={async (orders) => {
              await guarded(() => updateOrder(orders), null);
            }}
            onRestore={toggleReceived}
            onClearReceived={async () => {
              await guarded(() => Promise.all(myList.received.map((w) => deleteWish(w.id))), S.receivedCleared);
            }}
          />
        }
      />
    );
  } else if (route.name === "bookings") {
    title = S.myBookings;
    back = goBack;
    if (snapshot) content = <BookingsScreen items={bookingsOf(snapshot)} loading={!snapshot.ready} />;
  } else if (route.name === "invite") {
    title = S.invite;
    back = goBack;
    if (snapshot) {
      content = (
        <InviteScreen
          myEmail={me.email}
          myName={me.displayName}
          sent={snapshot.sentPending}
          onInfo={(text) => toast.show(text)}
          onInvite={async (email) => {
            let outcome = "sent" as "sent" | "accepted";
            const ok = await guarded(async () => {
              outcome = await invite(me, email);
            }, null);
            if (ok && outcome === "accepted") toast.show(S.inviteAcceptedBack);
            return ok ? outcome : null;
          }}
        />
      );
    }
  } else if (route.name === "newWish" || route.name === "editWish") {
    back = goBack;
    const found = route.name === "editWish" && snapshot ? findEditableWish(snapshot, route.wishId) : null;
    const existing = found?.wish ?? null;
    const list =
      snapshot && route.name === "newWish"
        ? editableList(snapshot, route.ownerId ?? snapshot.myListOwnerId)
        : found?.list ?? null;
    const picker = list ? ownerPickerFor(list, existing) : null;
    // With the "Kié?" picker the list can still change, so the title doesn't name it.
    title =
      route.name === "editWish"
        ? S.editorTitleEdit
        : list && list.kind !== "MINE" && !picker
          ? S.editorTitleNewFor(list.name)
          : S.editorTitleNew;
    if (snapshot?.ready && list && (route.name === "newWish" || existing)) {
      content = (
        <WishEditorScreen
          key={existing?.id ?? `new-${list.ownerId}`}
          existing={existing}
          candidates={audienceCandidates(snapshot)}
          canMakePrivate={list.kind === "MINE" ? snapshot.canMakePrivate : list.canMakePrivate}
          childList={!list.isOwn}
          ownerPicker={picker}
          onSave={async (draft, answered, target) => {
            if (!existing) {
              const ok = await guarded(async () => {
                const ownerId = target ? await resolveTarget(target) : list.ownerId;
                await createWish(ownerId, draft, nextSortOrder(snapshot, ownerId));
              }, S.added);
              if (ok) goBack();
              return ok;
            }
            const ok = await guarded(async () => {
              const newOwnerId = !target ? existing.ownerId : target.kind === "single" ? target.ownerId : groupIdOf(target.childIds);
              let move: { ownerId: string; sortOrder: number } | undefined;
              if (newOwnerId !== existing.ownerId) {
                if (existing.booked || existing.receivedAt !== null) throw new StoreError(S.editorOwnerLocked);
                const ownerId = await resolveTarget(target!);
                move = { ownerId, sortOrder: nextSortOrder(snapshot, ownerId) };
              }
              await updateWish(existing.id, draft, answered, move);
            }, S.saved);
            if (ok) goBack();
            return ok;
          }}
          onToggleReceived={async () => {
            if (existing) await toggleReceived(existing);
          }}
          onDelete={async () => {
            if (!existing) return false;
            const ok = await guarded(() => deleteWish(existing.id), S.deleted);
            if (ok) goBack();
            return ok;
          }}
          onMoveToPlans={async () => {
            if (!existing) return;
            if (await guarded(() => moveWishToPlans(existing, me), S.movedToPlans)) location.hash = href.planner();
          }}
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.detailsNotFound}</p>;
    }
  } else if (route.name === "newChild" || route.name === "editChild") {
    back = goBack;
    title = route.name === "newChild" ? S.childDialogAddTitle : S.childDialogEditTitle;
    const child = route.name === "editChild" && snapshot ? snapshot.managedChildren.find((c) => c.id === route.childId) ?? null : null;
    if (snapshot?.ready && (route.name === "newChild" || child)) {
      content = (
        <ChildEditorScreen
          key={child?.id ?? "new"}
          existing={child}
          onSave={(name, email) => saveChild(child?.id ?? null, name, email)}
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.errChildNotFound}</p>;
    }
  } else if (route.name === "coParent") {
    back = goBack;
    title = S.coParentTitle;
    const child = snapshot?.managedChildren.find((c) => c.id === route.childId) ?? null;
    if (snapshot?.ready && child) {
      content = (
        <CoParentScreen
          child={child}
          candidates={coParentCandidates(snapshot, child)}
          onAdd={async (person) => {
            if (!canAddCoParent(child)) {
              toast.show(S.errChildTooManyParents, { error: true });
              return;
            }
            if (await guarded(() => addCoParent(child.id, person), S.coParentAdded)) goBack();
          }}
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.errChildNotFound}</p>;
    }
  } else if (route.name === "planner") {
    title = S.plannerTitle;
    back = goBack;
    if (snapshot?.ready) {
      content = (
        <PlannerScreen
          sections={plannerOf(snapshot)}
          onApprove={async (plan) => {
            // Without a price it stays a plan: the editor asks for one.
            if (plan.priceHuf === null) {
              location.hash = href.editPlan(plan.id);
              return;
            }
            const draft = { ...plan, visibleTo: null };
            await guarded(() => approvePlan(plan.id, plan.ownerId, draft, nextSortOrder(snapshot, plan.ownerId)), S.plannerApproved);
          }}
        />
      );
    }
  } else if (route.name === "newPlan" || route.name === "editPlan") {
    back = goBack;
    title = route.name === "newPlan" ? S.planEditorTitleNew : S.planEditorTitleEdit;
    const existing = route.name === "editPlan" && snapshot ? findPlan(snapshot, route.planId) : null;
    const prefill = route.name === "newPlan" ? route.prefill : null;
    if (snapshot?.ready && (route.name === "newPlan" || existing)) {
      content = (
        <PlanEditorScreen
          // A new link (another product) starts a fresh form.
          key={existing?.id ?? `new:${location.hash}`}
          existing={existing}
          lists={snapshot.planLists}
          initialOwnerId={route.name === "newPlan" ? route.ownerId : null}
          prefill={prefill}
          onSave={async (ownerId, draft) => {
            const ok = existing
              ? await guarded(() => updatePlan(existing.id, ownerId, draft), S.planSaved)
              : await guarded(() => createPlan(ownerId, draft, me), S.planSaved);
            // From a product page: on to the planner, where the new idea shows (and a reload won't refill the form).
            if (ok && prefill) location.hash = href.planner();
            else if (ok) goBack();
          }}
          onApprove={async (ownerId, draft) => {
            const ok = existing
              ? await guarded(() => approvePlan(existing.id, ownerId, draft, nextSortOrder(snapshot, ownerId)), S.plannerApproved)
              // A new idea approved right away is simply a new wish.
              : await guarded(() => createWish(ownerId, draft, nextSortOrder(snapshot, ownerId)), S.plannerApproved);
            if (ok) goBack();
          }}
          onDelete={async () => {
            if (existing && (await guarded(() => deletePlan(existing.id), S.planDeleted))) goBack();
          }}
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.planNotFound}</p>;
    }
  } else if (route.name === "wish") {
    back = goBack;
    const found = snapshot ? findWish(snapshot, route.wishId) : null;
    const hidden = found && found.wish.isReceived && found.wish.status !== "BOOKED_BY_ME";
    title = found?.owner ? S.detailsTitle(found.owner.displayName) : S.appName;
    if (found && !hidden) {
      content = (
        <WishDetailsScreen
          wish={found.wish}
          canRequestInfo={!found.owner?.isManaged}
          editHref={found.owner?.isManaged ? href.editWish(found.wish.id) : undefined}
          onBook={async () => {
            await guarded(() => book(found.wish.id, me), S.bookedMessage);
          }}
          onUnbook={async () => {
            await guarded(() => unbook(found.wish.id, me), S.unbookedMessage);
          }}
          onRequest={async (field: WishField) => {
            await guarded(() => requestInfo(found.wish, field), S.requestSent);
          }}
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.detailsNotFound}</p>;
    }
  }


  return (
    <>
      <TopBar
        title={title}
        onBack={back}
        actions={
          <>
            {route.name === "board" && snapshot && (
              <>
                <TopBarIcon href={href.planner()} label={S.plannerTitle} count={planCount(snapshot)}>
                  <IconBulb />
                </TopBarIcon>
                <TopBarIcon href={href.bookings()} label={S.myBookings}>
                  <IconGift />
                </TopBarIcon>
                <TopBarIcon href={href.invite()} label={S.invite}>
                  <IconPersonAdd />
                </TopBarIcon>
              </>
            )}
            {accountMenu}
          </>
        }
      />
      <main class="sp-container pt-5 pb-24">{content}</main>
      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </>
  );
}
