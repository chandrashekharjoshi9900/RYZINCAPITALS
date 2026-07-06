// js/profile.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");
const btnUpdateProfile = document.getElementById("btnUpdateProfile");
const btnUpdatePassword = document.getElementById("btnUpdatePassword");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    try {
        await loadUserProfileData(user.uid);
    } catch (e) {
        console.error("Profile Load Error:", e);
    }
});

async function loadUserProfileData(uid) {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
        const userData = docSnap.data();

        document.getElementById("lblFullName").innerText = userData.fullName || "User";
        document.getElementById("lblEmail").innerText = userData.email || "---";
        document.getElementById("lblUserId").innerText = userData.userId || "---";
        document.getElementById("lblUsername").innerText = userData.username || "---";
        document.getElementById("lblReferralCode").innerText = userData.referralCode || "---";

        document.getElementById("inputFullName").value = userData.fullName || "";
        document.getElementById("inputMobile").value = userData.mobile || "";
        document.getElementById("inputWalletAddress").value = userData.walletAddress || "";
    }
}

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const fullName = document.getElementById("inputFullName").value.trim();
    const mobile = document.getElementById("inputMobile").value.trim();
    const walletAddress = document.getElementById("inputWalletAddress").value.trim();

    btnUpdateProfile.disabled = true;
    btnUpdateProfile.innerText = "Saving...";

    try {
        await updateDoc(doc(db, "users", user.uid), {
            fullName: fullName,
            mobile: mobile,
            walletAddress: walletAddress
        });

        alert("Profile details updated successfully!");
        await loadUserProfileData(user.uid);

    } catch (err) {
        alert("Update Failed: " + err.message);
    } finally {
        btnUpdateProfile.disabled = false;
        btnUpdateProfile.innerText = "Save Profile Details";
    }
});

passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;

    if (newPassword.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    if (newPassword !== confirmNewPassword) {
        alert("Passwords do not match!");
        return;
    }

    btnUpdatePassword.disabled = true;
    btnUpdatePassword.innerText = "Updating security code...";

    try {
        await updatePassword(user, newPassword);
        alert("Password updated successfully! Please keep it secure.");
        passwordForm.reset();

    } catch (err) {
        if (err.code === "auth/requires-recent-login") {
            alert("Security policy alert: Changing password requires recent login. Please log out and log in again to perform this action.");
        } else {
            alert("Security Update Failed: " + err.message);
        }
    } finally {
        btnUpdatePassword.disabled = false;
        btnUpdatePassword.innerText = "Update Password";
    }
});