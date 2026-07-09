// js/register.js
import { auth, db } from "./firebase/config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById('registerForm');
const btnSubmit = document.getElementById('btnSubmit');

// Handle incoming referral links on window load
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    const refInput = document.getElementById('referralCode');
    if (refParam && refInput) {
        refInput.value = refParam;
        refInput.setAttribute("readonly", "true"); 
    }
});

// Cryptographically secure ID generator (Avoids Math.random)
function generateSecureUserID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomArray = new Uint32Array(2);
    window.crypto.getRandomValues(randomArray);
    
    let prefix = '';
    let charValue = randomArray[0];
    for (let i = 0; i < 3; i++) {
        prefix += chars.charAt(charValue % chars.length);
        charValue = Math.floor(charValue / chars.length);
    }
    
    // Generates a 6-digit number between 100000 and 999999
    const digits = 100000 + (randomArray[1] % 900000);
    return `${prefix}${digits}`;
}

// Queries Firestore to find an unused, secure User ID
async function getUniqueUserID() {
    let uniqueId = "";
    let isUnique = false;
    let retries = 0;
    const maxRetries = 10; // Safety threshold

    while (!isUnique && retries < maxRetries) {
        uniqueId = generateSecureUserID();
        const checkQuery = query(collection(db, "users"), where("userId", "==", uniqueId));
        const checkSnapshot = await getDocs(checkQuery);
        
        if (checkSnapshot.empty) {
            isUnique = true;
        } else {
            retries++;
        }
    }

    if (!isUnique) {
        throw new Error("Unable to establish a secure unique identifier. Please try signing up again.");
    }
    return uniqueId;
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullNameInput = document.getElementById('fullName');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const mobileInput = document.getElementById('mobile');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const refCodeInput = document.getElementById('referralCode');

        if (!fullNameInput || !usernameInput || !emailInput || !mobileInput || !passwordInput || !confirmPasswordInput || !refCodeInput) {
            return;
        }

        const fullName = fullNameInput.value.trim();
        const rawUsername = usernameInput.value.trim().replace(/\s+/g, '').toLowerCase();
        const email = emailInput.value.trim();
        const mobile = mobileInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const refCode = refCodeInput.value.trim();

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Processing registration...";
        }

        try {
            // Parallelize username validation and referral code validation
            const usernameQuery = query(collection(db, "users"), where("username", "==", rawUsername));
            const referralQuery = refCode ? query(collection(db, "users"), where("referralCode", "==", refCode)) : null;

            const [usernameSnapshot, referralSnapshot] = await Promise.all([
                getDocs(usernameQuery),
                referralQuery ? getDocs(referralQuery) : Promise.resolve(null)
            ]);

            // Validate Username
            if (!usernameSnapshot.empty) {
                throw new Error("Username is already taken. Please choose another one.");
            }

            // Validate Referrer
            let referredBy = null;
            if (refCode) {
                if (!referralSnapshot || referralSnapshot.empty) {
                    throw new Error("Invalid Referral Code.");
                } else {
                    referredBy = referralSnapshot.docs[0].id;
                }
            }

            // Obtain a guaranteed unique User ID before final authorization
            const generatedId = await getUniqueUserID();

            // Create Authenticated Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const currentDate = new Date();
            const dateStr = currentDate.toLocaleDateString();
            const timeStr = currentDate.toLocaleTimeString();
            const timestampStr = currentDate.toISOString();

            // Document structures
            const userData = {
                uid: user.uid,
                fullName: fullName,
                email: email,
                mobile: mobile,
                userId: generatedId,
                username: rawUsername,
                referralCode: generatedId, // Code remains permanently identical to unique ID
                referredBy: referredBy,
                joinDate: timestampStr,
                status: "active",
                walletAddress: "",
                role: "user" // Aligns with security rules constraint to prevent registration abort
            };

            const walletData = {
                uid: user.uid,
                availableBalance: 0,
                totalDeposit: 0,
                totalWithdraw: 0,
                totalProfit: 0,
                referralEarnings: 0
            };

            const systemTransaction = {
                transactionId: doc(collection(db, "transactions")).id,
                uid: user.uid,
                date: dateStr,
                time: timeStr,
                timestamp: timestampStr,
                type: "Account Created", // Aligns with allowed transactions rule
                amount: 0,
                status: "Approved"
            };

            // Run database updates in parallel
            const databaseWrites = [
                setDoc(doc(db, "users", user.uid), userData),
                setDoc(doc(db, "wallets", user.uid), walletData),
                setDoc(doc(db, "transactions", systemTransaction.transactionId), systemTransaction)
            ];

            // If referenced by a promoter, log registration connection
            if (referredBy) {
                const refRelationRef = doc(collection(db, "referrals"));
                databaseWrites.push(setDoc(refRelationRef, {
                    referralId: refRelationRef.id,
                    referrerUid: referredBy,
                    refereeUid: user.uid,
                    refereeName: fullName,
                    joinDate: timestampStr,
                    commissionAmount: 0,
                    commissionStatus: "Pending" // Match security rules requirements for referrals
                }));
            }

            await Promise.all(databaseWrites);

            // Seed user profile directly into local storage to avoid read on next page load
            sessionStorage.setItem("user_profile", JSON.stringify(userData));

            // Trigger Custom Welcome Modal Instead of Alert
            const welcomeModalEl = document.getElementById("welcomeModal");
            if (welcomeModalEl) {
                const welcomeModal = new bootstrap.Modal(welcomeModalEl);
                welcomeModal.show();

                const btnModalRedirect = document.getElementById("btnModalRedirect");
                if (btnModalRedirect) {
                    btnModalRedirect.addEventListener("click", () => {
                        window.location.href = "dashboard.html";
                    });
                }
            } else {
                // Fallback inside error boundaries
                alert("Registration Successful!");
                window.location.href = "dashboard.html";
            }

        } catch (error) {
            console.error("Registration phase failure:", error);
            alert(error.message);
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Register Now";
            }
        }
    });
}
