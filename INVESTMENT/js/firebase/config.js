// js/firebase/config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjS4UVPc8plWyKGzzuFwSnliT5Me75wVE",
  authDomain: "testcrypto-bd7a4.firebaseapp.com",
  projectId: "testcrypto-bd7a4",
  storageBucket: "testcrypto-bd7a4.firebasestorage.app",
  messagingSenderId: "588861293611",
  appId: "1:588861293611:web:8a1c31fe634720b180966e",
  measurementId: "G-W6G5RTY49R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);