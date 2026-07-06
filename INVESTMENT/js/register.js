// js/register.js
import { auth, db } from "./firebase/config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById('registerForm');
const btnSubmit = document.getElementById('btnSubmit');
// Add at the top of js/register.js
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    const refInput = document.getElementById('referralCode');
    if (refParam && refInput) {
        refInput.value = refParam;
        refInput.setAttribute("readonly", "true"); // Optional: Make it readonly so they don't break the association
    }
});

// Helper function to generate Unique User ID and Referral Code
function generateUserID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let prefix = '';
    for (let i = 0; i < 3; i++) {
        prefix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const numbers = Math.floor(100000 + Math.random() * 900000); // 6 Digit Number
    return `${prefix}${numbers}`;
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const usernameInput = document.getElementById('username').value.trim().replace(/\s+/g, '').toLowerCase();
    const email = document.getElementById('email').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const refCodeInput = document.getElementById('referralCode').value.trim();

    // Validation
    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Processing registration...";

    try {
        // 1. Check if Username already exists in Firestore
        const qUsername = query(collection(db, "users"), where("username", "==", usernameInput));
        const usernameQuerySnapshot = await getDocs(qUsername);
        if (!usernameQuerySnapshot.empty) {
            throw new Error("Username is already taken. Please choose another one.");
        }

        // 2. Validate Referral Code if provided
        let referredBy = null;
        if (refCodeInput) {
            const qReferral = query(collection(db, "users"), where("referralCode", "==", refCodeInput));
            const referralSnapshot = await getDocs(qReferral);
            
            if (referralSnapshot.empty) {
                throw new Error("Invalid Referral Code.");
            } else {
                // Fetch ID of the parent user
                referredBy = referralSnapshot.docs[0].id;
            }
        }

        // 3. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Generate ID
        const generatedId = generateUserID();

        // 4. Save User Profile in Firestore
        const userData = {
            uid: user.uid,
            fullName: fullName,
            email: email,
            mobile: mobile,
            userId: generatedId,
            username: usernameInput,
            referralCode: generatedId,
            referredBy: referredBy,
            joinDate: new Date().toISOString(),
            status: "active",
            walletAddress: "" // Will be updated by user in profile later
        };

        await setDoc(doc(db, "users", user.uid), userData);

        // 5. Initialize Wallet in Firestore for this user
        const walletData = {
            uid: user.uid,
            availableBalance: 0,
            totalDeposit: 0,
            totalWithdraw: 0,
            totalProfit: 0,
            referralEarnings: 0
        };

        await setDoc(doc(db, "wallets", user.uid), walletData);

        // 6. Record Registration Transaction Activity
        const transRef = doc(collection(db, "transactions"));
        await setDoc(transRef, {
            transactionId: transRef.id,
            uid: user.uid,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            type: "Account Created",
            amount: 0,
            status: "Approved"
        });

        // 7. Save Referral relationship if available
        if (referredBy) {
            const refDocRef = doc(collection(db, "referrals"));
            await setDoc(refDocRef, {
                referralId: refDocRef.id,
                referrerUid: referredBy, // Jiske code se join kiya
                refereeUid: user.uid,    // Jo join hua
                refereeName: fullName,
                joinDate: new Date().toISOString(),
                commissionStatus: "Pending" // Commission package buy hone ke baad update hoga
            });
        }

        alert("Registration Successful!");
        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Register Now";
    }
});