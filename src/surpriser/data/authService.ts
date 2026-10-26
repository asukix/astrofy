// Firebase Auth for the web view. Mirrors FirebaseAuthDataSource in the Android app.

import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type ActionCodeSettings,
  type AuthProvider,
  type OAuthCredential,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { APP_PATH } from "../config";
import { firebase } from "../firebase";
import type { User } from "../model";
import { S } from "../strings";

export function toUser(user: FirebaseUser): User {
  const email = user.email ?? "";
  return {
    id: user.uid,
    email,
    // A Google or Apple account may have no name; the public profile needs one.
    displayName: user.displayName?.trim() || email.split("@")[0],
    isEmailVerified: user.emailVerified,
  };
}

export function observeUser(onChange: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, onChange);
}

/** E-mail links (verification, password reset) lead back to the web view. */
function actionCodeSettings(): ActionCodeSettings {
  return { url: `${location.origin}${APP_PATH}` };
}

export async function register(displayName: string, email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(firebase().auth, email, password);
  await updateProfile(user, { displayName });
  await sendEmailVerification(user, actionCodeSettings());
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebase().auth, email, password);
}

export type ProviderResult =
  | { kind: "signedIn" }
  | { kind: "cancelled" }
  /** This e-mail already has a password account: sign in with it once, then the new provider is linked. */
  | { kind: "needsLink"; email: string; credential: OAuthCredential };

async function signInWithProvider(
  provider: AuthProvider,
  credentialFromError: (e: FirebaseError) => OAuthCredential | null,
  afterSignIn?: (result: UserCredential) => Promise<void>,
): Promise<ProviderResult> {
  try {
    const result = await signInWithPopup(firebase().auth, provider);
    await afterSignIn?.(result);
    return { kind: "signedIn" };
  } catch (e) {
    if (e instanceof FirebaseError) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return { kind: "cancelled" };
      }
      if (e.code === "auth/account-exists-with-different-credential") {
        const credential = credentialFromError(e);
        const email = (e.customData?.email as string | undefined) ?? "";
        if (credential) return { kind: "needsLink", email, credential };
      }
    }
    throw e;
  }
}

export function signInWithGoogle(): Promise<ProviderResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithProvider(provider, (e) => GoogleAuthProvider.credentialFromError(e));
}

/**
 * Sign in with Apple. Apple tells the name only at the very first sign-in, and Firebase doesn't store it:
 * save it on the profile then. Without a name the app asks for one (see NameScreen).
 */
export function signInWithApple(): Promise<ProviderResult> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  provider.setCustomParameters({ locale: "hu_HU" });
  return signInWithProvider(
    provider,
    (e) => OAuthProvider.credentialFromError(e),
    async (result) => {
      if (result.user.displayName?.trim()) return;
      const profile = getAdditionalUserInfo(result)?.profile as { name?: { firstName?: string; lastName?: string } } | undefined;
      // The name may come in the token response on the first sign-in only (not part of the public API).
      const token = (result as unknown as { _tokenResponse?: { firstName?: string; lastName?: string } })._tokenResponse;
      const first = profile?.name?.firstName ?? token?.firstName;
      const last = profile?.name?.lastName ?? token?.lastName;
      const name = [last, first].filter(Boolean).join(" ").trim(); // Hungarian order: family name first
      if (name) await updateProfile(result.user, { displayName: name });
    },
  );
}

/** Signs in with the password once and links the provider (Google or Apple) to that account. */
export async function linkProvider(email: string, password: string, credential: OAuthCredential): Promise<void> {
  const { user } = await signInWithEmailAndPassword(firebase().auth, email, password);
  await linkWithCredential(user, credential);
}

/** Sets the display name (e.g. after Apple, which may not tell it). */
export async function setDisplayName(name: string): Promise<void> {
  const user = firebase().auth.currentUser;
  if (user) await updateProfile(user, { displayName: name });
}

/** Apple's "Hide My Email" address: invitations must be sent to this one, not the person's real address. */
export function isAppleRelayEmail(email: string): boolean {
  return /@privaterelay\.appleid\.com$/i.test(email);
}

/** Returns whether the e-mail is verified now. Refreshes the token too: the rules read email_verified from it. */
export async function reloadUser(): Promise<boolean> {
  const user = firebase().auth.currentUser;
  if (!user) return false;
  await reload(user);
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

export async function resendVerification(): Promise<void> {
  const user = firebase().auth.currentUser;
  if (user) await sendEmailVerification(user, actionCodeSettings());
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(firebase().auth, email, actionCodeSettings());
  } catch (e) {
    // Don't reveal whether an account exists.
    if (e instanceof FirebaseError && e.code === "auth/user-not-found") return;
    throw e;
  }
}

export function signOut(): Promise<void> {
  return firebaseSignOut(firebase().auth);
}

export function authErrorMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  switch (code) {
    case "auth/email-already-in-use":
      return S.errEmailInUse;
    case "auth/weak-password":
      return S.errWeakPassword;
    case "auth/invalid-email":
      return S.errInvalidEmail;
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/user-mismatch":
      return S.errInvalidCredentials;
    case "auth/too-many-requests":
      return S.errTooManyRequests;
    case "auth/network-request-failed":
      return S.errNetwork;
    case "auth/popup-blocked":
      return S.errPopupBlocked;
    case "auth/operation-not-allowed":
    case "auth/invalid-oauth-client-id":
    case "auth/invalid-oauth-provider":
    case "auth/unauthorized-domain":
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return S.errNotConfigured;
    default:
      console.warn("Surpriser auth error", e);
      return S.errUnknown;
  }
}
