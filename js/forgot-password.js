// js/forgot-password.js
import { auth } from "./firebase/config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const forgotForm = document.getElementById('forgotForm');
const btnReset = document.getElementById('btnReset');

if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        if (!emailInput) return;

        const email = emailInput.value.trim();
        if (!email) {
            alert("Please enter your email address.");
            return;
        }

        if (btnReset) {
            btnReset.disabled = true;
            btnReset.innerText = "Sending Link...";
        }

        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset email sent successfully! Please check your inbox.");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Password reset failure:", error);

            // Clean, descriptive message parsing for common issues
            let friendlyMessage = "Failed to send reset link. Please try again.";
            if (error.code === "auth/user-not-found") {
                friendlyMessage = "No user found with this email address.";
            } else if (error.code === "auth/invalid-email") {
                friendlyMessage = "The email address entered is invalid.";
            } else if (error.message) {
                friendlyMessage = error.message;
            }

            alert(friendlyMessage);

            if (btnReset) {
                btnReset.disabled = false;
                btnReset.innerText = "Send Reset Link";
            }
        }
    });
}