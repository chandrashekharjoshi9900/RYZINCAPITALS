// js/firebase/config.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/**
 * SECURITY NOTICE FOR PRODUCTION:
 * Firebase configuration keys are public by design. To prevent unauthorized use, 
 * billing abuse, or access to your database from external domains:
 * 
 * 1. Go to Google Cloud Console (https://console.cloud.google.com) -> APIs & Services -> Credentials.
 * 2. Locate the API Key matching: "AIzaSyAjS4UVPc8plWyKGzzuFwSnliT5Me75wVE".
 * 3. Set "Application restrictions" to "Website" and add your production domain(s) (e.g., https://yourdomain.com).
 * 4. Set "API restrictions" to only allow the following required APIs:
 *    - Identity Toolkit API (for Auth)
 *    - Cloud Firestore API
 *    - Firebase Realtime Database API
 *    - Google Cloud Storage API
 */
const firebaseConfig = {
  apiKey: "AIzaSyAjS4UVPc8plWyKGzzuFwSnliT5Me75wVE",
  authDomain: "testcrypto-bd7a4.firebaseapp.com",
  projectId: "testcrypto-bd7a4",
  storageBucket: "testcrypto-bd7a4.firebasestorage.app",
  messagingSenderId: "588861293611",
  appId: "1:588861293611:web:8a1c31fe634720b180966e",
  measurementId: "G-W6G5RTY49R"
};

// Initialize Firebase safely to prevent initialization conflicts
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);