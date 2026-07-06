// js/login.js
import { auth, db } from "./firebase/config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    btnLogin.disabled = true;
    btnLogin.innerText = "Signing in...";

    try {
        // 1. Auth LogIn
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Fetch User account status directly from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.status === "inactive" || userData.status === "suspended") {
                // If user is suspended/inactive
                await auth.signOut();
                throw new Error("Your account has been suspended or deactivated. Contact support.");
            }
            
            // Success redirect
            window.location.href = "dashboard.html";
        } else {
            throw new Error("User record not found in system.");
        }

    } catch (error) {
        alert(error.message);
        btnLogin.disabled = false;
        btnLogin.innerText = "Log In";
    }
});