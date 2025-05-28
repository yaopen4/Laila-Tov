
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- BEGIN Explicit Pre-checks ---
if (!firebaseConfig.apiKey || typeof firebaseConfig.apiKey !== 'string' || firebaseConfig.apiKey.trim() === '') {
  throw new Error(
    `Firebase Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing, not a string, or empty in your .env.local file. ` +
    `Current value: '${firebaseConfig.apiKey}'. ` +
    `Please check your .env.local and ensure it's correctly set and that you've restarted your development server. ` +
    `Refer to README.md for setup instructions.`
  );
}

if (!firebaseConfig.projectId || typeof firebaseConfig.projectId !== 'string' || firebaseConfig.projectId.trim() === '') {
  throw new Error(
    `Firebase Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing, not a string, or empty in your .env.local file. ` +
    `Current value: '${firebaseConfig.projectId}'. ` +
    `Please check your .env.local and ensure it's correctly set and that you've restarted your development server. ` +
    `Refer to README.md for setup instructions.`
  );
}
// --- END Explicit Pre-checks ---

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    let errorMessage = "Failed to initialize Firebase. ";
    // This specific check might be redundant now with the pre-checks, but kept for robustness
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      errorMessage += "Essential configuration (API Key or Project ID) might be missing or invalid. ";
    } else {
      errorMessage += "This could be due to incorrect Firebase config values in .env.local, or a network issue. ";
    }
    errorMessage += "Please verify your Firebase project settings and .env.local file. Original error: " + (error as Error).message;
    throw new Error(errorMessage);
  }
} else {
  app = getApps()[0];
}

try {
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Error getting Firebase Auth or Firestore instance:", error);
  throw new Error(
    "Failed to get Firebase Auth or Firestore instance. Ensure Firebase was initialized correctly. Original error: " + (error as Error).message
  );
}

export { app, auth, db };
