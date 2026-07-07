// js/login.js
import { auth, db } from "./firebase/config.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (btnLogin) {
            btnLogin.disabled = true;
            btnLogin.innerText = "Signing in...";
        }

        try {
            // Prevent state leaks by flushing cache from previous sessions
            sessionStorage.removeItem("user_profile");
            sessionStorage.removeItem("wallet_stats");

            // 1. Auth LogIn
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Fetch User account status directly from Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.status === "inactive" || userData.status === "suspended") {
                    // Force log out and prevent navigation if unauthorized
                    await signOut(auth);
                    throw new Error("Your account has been suspended or deactivated. Contact support.");
                }
                
                // Cache user profile information to reduce subsequent database load
                sessionStorage.setItem("user_profile", JSON.stringify(userData));
                
                // Success redirect
                window.location.href = "dashboard.html";
            } else {
                await signOut(auth);
                throw new Error("User profile not found. Access denied.");
            }

        } catch (error) {
            console.error("Login verification failure:", error);
            
            let message = error.message;
            if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
                message = "Invalid email or password. Please try again.";
            } else if (error.code === "auth/invalid-email") {
                message = "The entered email address structure is invalid.";
            } else if (error.code === "auth/too-many-requests") {
                message = "Access has been temporarily disabled due to multiple failed attempts. Please try again later.";
            }
            
            alert(message);
            
            if (btnLogin) {
                btnLogin.disabled = false;
                btnLogin.innerText = "Log In";
            }
        }
    });
}