import { FirebaseError } from "firebase/app";
import { useState } from "preact/hooks";
import { authErrorMessage, deleteCurrentUser, reauthenticate, usesPassword } from "../data/authService";
import { deleteAccountData, StoreError } from "../data/storeService";
import type { User } from "../model";
import { S } from "../strings";
import { TopBar } from "./components";
import { EditorField } from "./WishEditorScreen";
import { goBack } from "./router";

/**
 * Deleting the account (DeleteAccountDialog + DeleteAccountUseCase in the app): a fresh sign-in first (the
 * password, or the Google account picker), then the data, then the account. Rendered instead of the board,
 * so no live listener or publishing runs while the data goes.
 */
export function AccountDeletionScreen({ me, onDeleted }: { me: User; onDeleted: () => void }) {
  const withPassword = usesPassword();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirm = async (event: Event) => {
    event.preventDefault();
    if (deleting) return;
    if (withPassword && !password) {
      setError(S.errWrongPassword);
      return;
    }
    setError(null);
    setDeleting(true);
    // Confirm first: otherwise the data would be gone while the account deletion is refused.
    try {
      if (!(await reauthenticate(withPassword ? password : null))) {
        setDeleting(false);
        return;
      }
    } catch (e) {
      setError(reauthErrorMessage(e, withPassword));
      setDeleting(false);
      return;
    }
    try {
      await deleteAccountData(me);
    } catch (e) {
      setError(e instanceof StoreError ? e.message : S.errUnknown);
      setDeleting(false);
      return;
    }
    try {
      await deleteCurrentUser();
      onDeleted();
    } catch (e) {
      console.warn("Surpriser: deleting the account failed", e);
      setError(S.errAccountNotDeleted);
      setDeleting(false);
    }
  };

  return (
    <>
      <TopBar title={S.deleteAccount} onBack={deleting ? undefined : goBack} />
      <main class="sp-container pt-5 pb-24">
        <form onSubmit={confirm} class="flex flex-col gap-4" noValidate>
          <h2 class="sp-section-title">{S.deleteAccountTitle}</h2>
          <p class="text-base-content/80">{S.deleteAccountMessage}</p>
          <p class="text-sm text-base-content/60">{me.email}</p>
          {withPassword ? (
            <EditorField label={S.deleteAccountPassword}>
              <input
                class="input input-bordered w-full"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={deleting}
                onInput={(e) => {
                  setPassword(e.currentTarget.value);
                  setError(null);
                }}
              />
            </EditorField>
          ) : (
            <p class="text-sm">{S.deleteAccountGoogleHint}</p>
          )}
          {error && (
            <p class="sp-alert sp-alert--error" role="alert">
              {error}
            </p>
          )}
          {deleting && (
            <p class="text-sm text-base-content/70" role="status">
              {S.deleteAccountProgress}
            </p>
          )}
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn btn-error" disabled={deleting}>
              {deleting && <span class="loading loading-spinner loading-sm" />}
              {S.deleteAccountConfirm}
            </button>
            {!deleting && (
              <button type="button" class="btn btn-ghost" onClick={goBack}>
                {S.cancel}
              </button>
            )}
          </div>
        </form>
      </main>
    </>
  );
}

function reauthErrorMessage(e: unknown, withPassword: boolean): string {
  const code = e instanceof FirebaseError ? e.code : "";
  if (code === "auth/user-mismatch") return withPassword ? S.errWrongPassword : S.errReauthMismatch;
  if (withPassword && (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/invalid-login-credentials")) {
    return S.errWrongPassword;
  }
  return authErrorMessage(e);
}

/** After the deletion: the account is gone, the user is signed out. */
export function AccountDeletedScreen({ onDone }: { onDone: () => void }) {
  return (
    <main class="sp-container pt-16 pb-24 flex flex-col items-center text-center gap-4">
      <h1 class="sp-section-title">{S.accountDeletedTitle}</h1>
      <p class="text-base-content/80 max-w-md">{S.accountDeletedMessage}</p>
      <button type="button" class="btn btn-primary" onClick={onDone}>
        {S.accountDeletedOk}
      </button>
    </main>
  );
}
