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

// Cache-first loading strategy to improve performance and reduce reads
async function loadUserProfileData(uid) {
    const cachedProfile = sessionStorage.getItem("user_profile");
    let userData = null;

    // Instantly load data from cache to make the UI responsive
    if (cachedProfile) {
        try {
            userData = JSON.parse(cachedProfile);
            renderProfileData(userData);
        } catch (e) {
            console.error("Error parsing cached profile:", e);
        }
    }

    try {
        // Fetch fresh copy from Firestore to guarantee accuracy
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const freshData = docSnap.data();
            
            // If cache differs or does not exist, update storage and UI
            if (JSON.stringify(freshData) !== JSON.stringify(userData)) {
                sessionStorage.setItem("user_profile", JSON.stringify(freshData));
                renderProfileData(freshData);
            }
        }
    } catch (error) {
        console.error("Failed to sync profile from server:", error);
    }
}

// Separate UI updates from database calls
function renderProfileData(userData) {
    if (!userData) return;

    const lblFullName = document.getElementById("lblFullName");
    const lblEmail = document.getElementById("lblEmail");
    const lblUserId = document.getElementById("lblUserId");
    const lblUsername = document.getElementById("lblUsername");
    const lblReferralCode = document.getElementById("lblReferralCode");

    const inputFullName = document.getElementById("inputFullName");
    const inputMobile = document.getElementById("inputMobile");
    const inputWalletAddress = document.getElementById("inputWalletAddress");

    if (lblFullName) lblFullName.innerText = userData.fullName || "User";
    if (lblEmail) lblEmail.innerText = userData.email || "---";
    if (lblUserId) lblUserId.innerText = userData.userId || "---";
    if (lblUsername) lblUsername.innerText = userData.username || "---";
    if (lblReferralCode) lblReferralCode.innerText = userData.referralCode || "---";

    if (inputFullName) inputFullName.value = userData.fullName || "";
    if (inputMobile) inputMobile.value = userData.mobile || "";
    if (inputWalletAddress) inputWalletAddress.value = userData.walletAddress || "";
}

// Save profile updates (Write-restricted variables are safe because they are not targeted)
if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const inputFullName = document.getElementById("inputFullName");
        const inputMobile = document.getElementById("inputMobile");
        const inputWalletAddress = document.getElementById("inputWalletAddress");

        if (!inputFullName || !inputMobile || !inputWalletAddress) return;

        const fullName = inputFullName.value.trim();
        const mobile = inputMobile.value.trim();
        const walletAddress = inputWalletAddress.value.trim();

        if (btnUpdateProfile) {
            btnUpdateProfile.disabled = true;
            btnUpdateProfile.innerText = "Saving...";
        }

        try {
            const userRef = doc(db, "users", user.uid);
            
            // Only update allowed fields (keeps other static fields secure)
            const updatedPayload = {
                fullName: fullName,
                mobile: mobile,
                walletAddress: walletAddress
            };

            await updateDoc(userRef, updatedPayload);

            // Update sessionStorage cache immediately
            const cachedProfile = sessionStorage.getItem("user_profile");
            if (cachedProfile) {
                const parsed = JSON.parse(cachedProfile);
                const merged = { ...parsed, ...updatedPayload };
                sessionStorage.setItem("user_profile", JSON.stringify(merged));
            }

            alert("Profile details updated successfully!");
            await loadUserProfileData(user.uid);

        } catch (err) {
            console.error("Profile update error:", err);
            alert("Update Failed: " + err.message);
        } finally {
            if (btnUpdateProfile) {
                btnUpdateProfile.disabled = false;
                btnUpdateProfile.innerText = "Save Profile Details";
            }
        }
    });
}

// Password reset form submission
if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const newPasswordInput = document.getElementById("newPassword");
        const confirmNewPasswordInput = document.getElementById("confirmNewPassword");

        if (!newPasswordInput || !confirmNewPasswordInput) return;

        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        if (newPassword.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert("Passwords do not match!");
            return;
        }

        if (btnUpdatePassword) {
            btnUpdatePassword.disabled = true;
            btnUpdatePassword.innerText = "Updating security code...";
        }

        try {
            await updatePassword(user, newPassword);
            alert("Password updated successfully! Please keep it secure.");
            passwordForm.reset();

        } catch (err) {
            console.error("Password update error:", err);
            if (err.code === "auth/requires-recent-login") {
                alert("Security policy alert: Changing password requires recent login. Please log out and log in again to perform this action.");
            } else {
                alert("Security Update Failed: " + err.message);
            }
        } finally {
            if (btnUpdatePassword) {
                btnUpdatePassword.disabled = false;
                btnUpdatePassword.innerText = "Update Password";
            }
        }
    });
}