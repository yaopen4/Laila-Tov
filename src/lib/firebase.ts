
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

// Check for essential Firebase config keys before attempting to initialize
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  let missingVars = [];
  if (!firebaseConfig.apiKey) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.projectId) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  
  throw new Error(
    `Firebase configuration is missing or incomplete. ` +
    `Please ensure that ${missingVars.join(' and ')} ` +
    `are set correctly in your .env.local file. ` +
    `Refer to the README.md for setup instructions. You may need to restart your development server after updating .env.local.`
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw new Error(
      "Failed to initialize Firebase. This could be due to incorrect Firebase config values in .env.local. " +
      "Please verify your API key and other project settings. Original error: " + (error as Error).message
    );
  }
} else {
  app = getApps()[0];
}

try {
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Error getting Firebase Auth or Firestore instance:", error);
  // This path is less likely if initializeApp succeeded but good for robustness
  throw new Error(
    "Failed to get Firebase Auth or Firestore instance. Ensure Firebase was initialized correctly. Original error: " + (error as Error).message
  );
}

export { app, auth, db };
