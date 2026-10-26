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

/** Data controller shown on the privacy notice and the account deletion page. */
export const CONTROLLER = {
  name: "Seng (sengdev.com)",
  email: "asukix@gmail.com",
};

/** Date of the current privacy notice. */
export const PRIVACY_UPDATED = "2026. október 26.";
