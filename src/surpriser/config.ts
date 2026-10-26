// Surpriser web app configuration.
//
// The Firebase web config is not a secret: access is enforced by firestore.rules.
// From Firebase Console → Project settings → Your apps → SurpriserWeb (surpriser-d3491).

export const firebaseConfig = {
  apiKey: "AIzaSyBHgX890RPyKzFckaVFAW8SE3FgaeqYNP8",
  authDomain: "surpriser-d3491.firebaseapp.com",
  projectId: "surpriser-d3491",
  storageBucket: "surpriser-d3491.firebasestorage.app",
  messagingSenderId: "93814049688",
  appId: "1:93814049688:web:cf11e8bd368892e8e8f9ed",
};

/** Local development against the Firebase emulators: `PUBLIC_SURPRISER_EMULATOR=1 pnpm dev`. */
export const useEmulator = import.meta.env.PUBLIC_SURPRISER_EMULATOR === "1";

/** True while the web config above still has placeholders. */
export const isConfigured = useEmulator || !Object.values(firebaseConfig).includes("TODO");

/** Where the app lives; e-mail links (verification, password reset) come back here. */
export const APP_PATH = "/apps/surpriser";

/**
 * Sign in with Apple needs a paid Apple Developer Program membership (Services ID + key, see README).
 * Until that's set up, the button stays hidden.
 */
export const APPLE_SIGN_IN_ENABLED = false;

/** Public address of the web view; invitation links point here (also on localhost). */
export const PUBLIC_ORIGIN = "https://sengdev.com";

/** Data controller shown on the privacy notice and the account deletion page. */
export const CONTROLLER = {
  name: "Seng (sengdev.com)",
  email: "asukix@gmail.com",
};

/** Date of the current privacy notice. */
export const PRIVACY_UPDATED = "2026. október 26.";
