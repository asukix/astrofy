import type { User as FirebaseUser } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { isConfigured } from "../config";
import { isAppleRelayEmail, observeUser, signOut, toUser } from "../data/authService";
import {
  audienceCandidates,
  boardOf,
  bookingsOf,
  findOwnWish,
  findWish,
  myListOf,
  observeSnapshot,
  type Snapshot,
} from "../data/board";
import {
  book,
  claimChildProfile,
  createWish,
  deleteWish,
  invite,
  requestInfo,
  respondToInvitation,
  saveProfile,
  setReceived,
  StoreError,
  unbook,
  updateOrder,
  updateWish,
} from "../data/storeService";
import type { User, Wish, WishField } from "../model";
import { S } from "../strings";
import { AuthScreen, NameScreen } from "./AuthScreen";
import { BoardScreen } from "./BoardScreen";
import { BookingsScreen } from "./BookingsScreen";
import { Spinner, Toast, TopBar, type ToastMessage } from "./components";
import { InviteScreen } from "./InviteScreen";
import { MyListSection } from "./MyListSection";
import { goBack, href, useRoute } from "./router";
import { WishDetailsScreen } from "./WishDetailsScreen";
import { WishEditorScreen } from "./WishEditorScreen";

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

  useEffect(() => observeUser(setFirebaseUser), []);

  if (firebaseUser === undefined) return <Spinner />;
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
    await guarded(
      () => setReceived(wish.id, received),
      received ? S.receivedMessage : S.restoredMessage,
      { label: S.undo, run: () => void guarded(() => setReceived(wish.id, !received), null) },
    );
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
      </div>
    </details>
  );

  let title = S.boardTitle;
  let back: (() => void) | undefined;
  let content = <Spinner />;

  if (route.name === "board" && snapshot && board && myList) {
    content = (
      <BoardScreen
        board={board}
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
    const existing = route.name === "editWish" && snapshot ? findOwnWish(snapshot, route.wishId) : null;
    title = route.name === "newWish" ? S.editorTitleNew : S.editorTitleEdit;
    if (snapshot?.ready && myList && (route.name === "newWish" || existing)) {
      content = (
        <WishEditorScreen
          key={existing?.id ?? "new"}
          existing={existing}
          candidates={audienceCandidates(snapshot)}
          canMakePrivate={snapshot.canMakePrivate}
          onSave={async (draft, answered) => {
            const ok = existing
              ? await guarded(() => updateWish(existing.id, draft, answered), S.saved)
              : await guarded(() => {
                  const last = Math.max(-1, ...myList.open.map((w) => w.sortOrder));
                  return createWish(myList.ownerId, draft, last + 1);
                }, S.added);
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
        />
      );
    } else if (snapshot?.ready) {
      content = <p class="sp-empty">{S.detailsNotFound}</p>;
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

  const bookingCount = snapshot?.bookings.length ?? 0;

  return (
    <>
      <TopBar
        title={title}
        onBack={back}
        actions={
          <>
            {route.name === "board" && (
              <a href={href.bookings()} class="btn btn-ghost btn-sm gap-2">
                {S.myBookings}
                {bookingCount > 0 && <span class="badge badge-secondary badge-sm">{bookingCount}</span>}
              </a>
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
