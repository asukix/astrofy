import type { OAuthCredential } from "firebase/auth";
import { useEffect, useState } from "preact/hooks";
import {
  authErrorMessage,
  linkProvider,
  login,
  register,
  reloadUser,
  resendVerification,
  sendPasswordReset,
  setDisplayName,
  isAppleRelayEmail,
  signInWithApple,
  signInWithGoogle,
  signOut,
  type ProviderResult,
} from "../data/authService";
import { APPLE_SIGN_IN_ENABLED } from "../config";
import { EMAIL_PATTERN, isStrongPassword, normalizeEmail } from "../format";
import { S } from "../strings";
import { AppMark } from "./components";

type Mode = "login" | "register" | "verify" | "forgot" | "link";

const SUBTITLE: Record<Mode, string> = {
  login: S.authSubtitleLogin,
  register: S.authSubtitleRegister,
  verify: S.authSubtitleVerify,
  forgot: S.authSubtitleForgot,
  link: S.authSubtitleLink,
};

/**
 * Sign-in, registration, e-mail verification, password reset and linking a Google account
 * to an existing password account. [unverifiedEmail] is set for a signed-in account that isn't verified yet.
 */
/** Coming from an invitation link: /apps/surpriser?cim=<invited e-mail>&mod=regisztracio */
function invitationParams(): { email: string | null; register: boolean } {
  try {
    const params = new URLSearchParams(location.search);
    return { email: params.get("cim"), register: params.get("mod") === "regisztracio" };
  } catch {
    return { email: null, register: false };
  }
}

export function AuthScreen({ unverifiedEmail, onVerified }: { unverifiedEmail: string | null; onVerified: () => void }) {
  const [invited] = useState(invitationParams);
  const [mode, setMode] = useState<Mode>(unverifiedEmail ? "verify" : invited.register ? "register" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(unverifiedEmail ?? invited.email ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** A Google or Apple sign-in waiting to be linked to the password account with the same e-mail. */
  const [pendingLink, setPendingLink] = useState<{ credential: OAuthCredential; provider: string } | null>(null);

  useEffect(() => {
    if (unverifiedEmail) {
      setEmail(unverifiedEmail);
      setMode("verify");
    }
  }, [unverifiedEmail]);

  // Coming back from the verification e-mail in another tab: check again.
  useEffect(() => {
    if (mode !== "verify") return;
    const onFocus = () => {
      reloadUser()
        .then((ok) => ok && onVerified())
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [mode]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    setInfo(null);
    setPendingLink(null);
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const validEmail = () => {
    if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
      setError(S.errInvalidEmail);
      return false;
    }
    return true;
  };

  const submit = (event: Event) => {
    event.preventDefault();
    const address = normalizeEmail(email);
    switch (mode) {
      case "login":
        if (!validEmail()) return;
        return run(() => login(address, password));
      case "register":
        if (!displayName.trim()) return setError(S.errNameRequired);
        if (!validEmail()) return;
        if (!isStrongPassword(password)) return setError(S.errWeakPassword);
        if (password !== passwordConfirm) return setError(S.errPasswordsDontMatch);
        return run(async () => {
          await register(displayName.trim(), address, password);
          setPassword("");
          setPasswordConfirm("");
          setInfo(S.infoLinkSent);
        });
      case "verify":
        return run(async () => {
          if (await reloadUser()) onVerified();
          else setError(S.errNotVerifiedYet);
        });
      case "forgot":
        if (!validEmail()) return;
        return run(async () => {
          await sendPasswordReset(address);
          setInfo(S.infoResetLinkSent);
        });
      case "link":
        if (!pendingLink) return;
        return run(async () => {
          await linkProvider(address, password, pendingLink.credential);
          setPendingLink(null);
        });
    }
  };

  const withProvider = (signIn: () => Promise<ProviderResult>, provider: string) =>
    run(async () => {
      const result = await signIn();
      if (result.kind === "needsLink") {
        switchMode("link");
        setEmail(result.email || email);
        setPendingLink({ credential: result.credential, provider });
      }
    });

  const showGoogle = mode === "login" || mode === "register";

  return (
    <div class="sp-auth">
      <section class="sp-auth__hero">
        <span class="sp-spark sp-spark--a" aria-hidden="true" />
        <span class="sp-spark sp-spark--b" aria-hidden="true" />
        <span class="sp-spark sp-spark--c" aria-hidden="true" />
        <AppMark size={72} />
        <h1 class="sp-auth__title">{S.appName}</h1>
        <p class="sp-auth__lead">{mode === "login" ? S.webIntro : SUBTITLE[mode]}</p>
      </section>

      <section class="sp-auth__panel">
        {mode === "login" && !invited.email && <p class="text-base-content/70 mb-5">{SUBTITLE.login}</p>}
        {invited.email && (mode === "login" || mode === "register") && (
          <p class="sp-alert mb-4">
            {S.invitedByLead} <strong class="break-words">{invited.email}</strong>
          </p>
        )}

        <form onSubmit={submit} class="flex flex-col gap-3" noValidate>
          {mode === "register" && (
            <Field label={S.displayName} value={displayName} onInput={setDisplayName} autocomplete="name" />
          )}
          {mode === "verify" ? (
            <p class="sp-note">{S.verifyHint(email)}</p>
          ) : (
            <Field
              label={S.email}
              type="email"
              value={email}
              onInput={setEmail}
              autocomplete="email"
              readOnly={mode === "link"}
            />
          )}
          {mode === "link" && pendingLink && <p class="sp-note">{S.linkHintProvider(pendingLink.provider)}</p>}
          {(mode === "login" || mode === "register" || mode === "link") && (
            <Field
              label={S.password}
              type="password"
              value={password}
              onInput={setPassword}
              autocomplete={mode === "register" ? "new-password" : "current-password"}
              hint={mode === "register" ? S.passwordHint : undefined}
            />
          )}
          {mode === "register" && (
            <Field
              label={S.passwordConfirm}
              type="password"
              value={passwordConfirm}
              onInput={setPasswordConfirm}
              autocomplete="new-password"
            />
          )}

          {error && (
            <p class="sp-alert sp-alert--error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p class="sp-alert" role="status">
              {info}
            </p>
          )}

          <button type="submit" class="btn btn-primary mt-1" disabled={busy}>
            {busy && <span class="loading loading-spinner loading-sm" />}
            {
              {
                login: S.login,
                register: S.register,
                verify: S.verify,
                forgot: S.sendResetLink,
                link: S.link,
              }[mode]
            }
          </button>
        </form>

        {showGoogle && (
          <>
            <div class="divider text-sm text-base-content/50 my-4">{S.or}</div>
            <div class="flex flex-col gap-2">
              <button type="button" class="btn btn-outline w-full" onClick={() => withProvider(signInWithGoogle, "Google")} disabled={busy}>
                {S.google}
              </button>
              {APPLE_SIGN_IN_ENABLED && (
                <button type="button" class="btn sp-btn-apple w-full" onClick={() => withProvider(signInWithApple, "Apple")} disabled={busy}>
                  {S.apple}
                </button>
              )}
            </div>
          </>
        )}

        <nav class="flex flex-col items-center gap-1 mt-6 text-sm">
          {mode === "login" && (
            <>
              <button type="button" class="link link-hover" onClick={() => switchMode("forgot")}>
                {S.forgotPassword}
              </button>
              <button type="button" class="link link-primary font-semibold" onClick={() => switchMode("register")}>
                {S.goRegister}
              </button>
            </>
          )}
          {mode === "register" && (
            <button type="button" class="link link-primary font-semibold" onClick={() => switchMode("login")}>
              {S.goLogin}
            </button>
          )}
          {mode === "verify" && (
            <>
              <button
                type="button"
                class="link link-hover"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await resendVerification();
                    setInfo(S.infoLinkSent);
                  })
                }
              >
                {S.resendLink}
              </button>
              <button
                type="button"
                class="link link-hover"
                onClick={() => {
                  signOut();
                  switchMode("login");
                }}
              >
                {S.backToLogin}
              </button>
            </>
          )}
          {(mode === "forgot" || mode === "link") && (
            <button type="button" class="link link-hover" onClick={() => switchMode("login")}>
              {S.backToLogin}
            </button>
          )}
        </nav>
      </section>

      <p class="sp-auth__footer">
        <a href="/apps/surpriser/adatvedelem" class="link link-hover">
          Adatvédelmi tájékoztató
        </a>
      </p>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  autocomplete?: string;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label class="form-control w-full">
      <span class="label-text font-semibold mb-1.5">{props.label}</span>
      <input
        class="input input-bordered w-full"
        type={props.type ?? "text"}
        value={props.value}
        autocomplete={props.autocomplete}
        readOnly={props.readOnly}
        onInput={(e) => props.onInput((e.currentTarget as HTMLInputElement).value)}
      />
      {props.hint && <span class="text-xs text-base-content/60 mt-1.5">{props.hint}</span>}
    </label>
  );
}

/** A signed-in account without a name (Apple may not share it): the public profile needs one. */
export function NameScreen({ email, onDone }: { email: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (!name.trim()) return setError(S.errNameRequired);
    setBusy(true);
    try {
      await setDisplayName(name.trim().slice(0, 100));
      onDone();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="sp-auth">
      <section class="sp-auth__hero">
        <span class="sp-spark sp-spark--a" aria-hidden="true" />
        <AppMark size={56} />
        <h1 class="sp-auth__title">{S.nameTitle}</h1>
        <p class="sp-auth__lead">{S.nameHint}</p>
      </section>
      <section class="sp-auth__panel">
        <form onSubmit={submit} class="flex flex-col gap-3" noValidate>
          <Field label={S.displayName} value={name} onInput={(v) => { setName(v); setError(null); }} autocomplete="name" />
          {isAppleRelayEmail(email) && <p class="sp-note text-sm">{S.relayEmailNote(email)}</p>}
          {error && <p class="sp-alert sp-alert--error" role="alert">{error}</p>}
          <button type="submit" class="btn btn-primary mt-1" disabled={busy}>
            {busy && <span class="loading loading-spinner loading-sm" />}
            {S.nameSave}
          </button>
        </form>
        <nav class="flex justify-center mt-6 text-sm">
          <button type="button" class="link link-hover" onClick={() => signOut()}>
            {S.logout}
          </button>
        </nav>
      </section>
    </div>
  );
}
