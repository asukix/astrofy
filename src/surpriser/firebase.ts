import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, useEmulator } from "./config";

let app: FirebaseApp | null = null;
let auth: Auth;
let db: Firestore;

/** Lazily initialised: the SDK needs browser APIs, so this only runs inside the client island. */
export function firebase(): { auth: Auth; db: Firestore } {
  if (!app) {
    app = initializeApp(useEmulator ? { ...firebaseConfig, apiKey: "demo-key", projectId: "demo-surpriser" } : firebaseConfig);
    auth = getAuth(app);
    auth.languageCode = "hu";
    db = getFirestore(app);
    if (useEmulator) {
      const host = location.hostname;
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
    }
  }
  return { auth, db };
}
