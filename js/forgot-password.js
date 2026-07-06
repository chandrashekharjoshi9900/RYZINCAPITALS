// js/forgot-password.js
import { auth } from "./firebase/config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const forgotForm = document.getElementById('forgotForm');
const btnReset = document.getElementById('btnReset');

forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();

    btnReset.disabled = true;
    btnReset.innerText = "Sending Link...";

    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent successfully! Please check your inbox.");
        window.location.href = "login.html";
    } catch (error) {
        alert(error.message);
        btnReset.disabled = false;
        btnReset.innerText = "Send Reset Link";
    }
});