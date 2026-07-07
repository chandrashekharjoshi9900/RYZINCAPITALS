// js/referral.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // Execute operations concurrently to improve page response time
        await Promise.all([
            loadReferralDetails(user.uid),
            loadReferralCommissions(user.uid),
            loadReferralsNetworkList(user.uid)
        ]);
    } catch (e) {
        console.error("Referrals Module Error during load:", e);
    }
});

// 1. Fetch user referral attributes (with localized caching) and generate invitation links
async function loadReferralDetails(uid) {
    let userData = null;
    const cachedProfile = sessionStorage.getItem("user_profile");

    // Attempt to parse cached data from session storage to avoid a redundant Firestore read
    if (cachedProfile) {
        try {
            userData = JSON.parse(cachedProfile);
        } catch (e) {
            console.error("Error parsing cached profile in referral module:", e);
        }
    }

    // Fallback to database lookup if cache is not available
    if (!userData) {
        try {
            const userDocRef = doc(db, "users", uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                userData = docSnap.data();
                sessionStorage.setItem("user_profile", JSON.stringify(userData));
            }
        } catch (error) {
            console.error("Error retrieving user profile for referral module:", error);
        }
    }

    if (userData) {
        const refCode = userData.referralCode || "---";

        // Dynamic Invitation Link formulation
        const domainUrl = window.location.origin;
        const refLink = `${domainUrl}/register.html?ref=${refCode}`;

        // Populate DOM elements
        const lblRefCode = document.getElementById("lblRefCode");
        const lblRefLink = document.getElementById("lblRefLink");
        const btnCopyCode = document.getElementById("btnCopyCode");
        const btnCopyLink = document.getElementById("btnCopyLink");

        if (lblRefCode) lblRefCode.innerText = refCode;
        if (lblRefLink) lblRefLink.innerText = refLink;

        // Event listener for Copy buttons with fallbacks
        if (btnCopyCode) {
            btnCopyCode.onclick = () => {
                navigator.clipboard.writeText(refCode)
                    .then(() => alert("Referral Code copied: " + refCode))
                    .catch(() => alert("Failed to copy code automatically. Code: " + refCode));
            };
        }

        if (btnCopyLink) {
            btnCopyLink.onclick = () => {
                navigator.clipboard.writeText(refLink)
                    .then(() => alert("Invitation link copied to clipboard!"))
                    .catch(() => alert("Failed to copy link automatically. Please copy it manually: " + refLink));
            };
        }
    }
}

// 2. Load total Referral earnings from wallet document
async function loadReferralCommissions(uid) {
    const statRefEarnings = document.getElementById("statRefEarnings");
    if (!statRefEarnings) return;

    try {
        const walletRef = doc(db, "wallets", uid);
        const docSnap = await getDoc(walletRef);
        if (docSnap.exists()) {
            const wallet = docSnap.data();
            statRefEarnings.innerText = parseFloat(wallet.referralEarnings || 0).toFixed(2);
        }
    } catch (error) {
        console.error("Error retrieving wallet commissions:", error);
    }
}

// 3. Load Referred Users Network list (Index-free, secure)
async function loadReferralsNetworkList(uid) {
    const tbody = document.getElementById("referralsTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Loading referral list...</td></tr>`; 

    // Query users where referredBy equals current uid (guarded with limit to optimize scale billing)
    const networkQuery = query(
        collection(db, "users"),
        where("referredBy", "==", uid),
        limit(200)
    );

    try {
        const querySnapshot = await getDocs(networkQuery);

        let total = 0;
        let active = 0;
        let inactive = 0;

        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No direct referrals recorded yet.</td></tr>`;
            updateMetricDisplay("statTotalRefs", "0");
            updateMetricDisplay("statActiveRefs", "0");
            updateMetricDisplay("statInactiveRefs", "0");
            return;
        }

        tbody.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            total++;
            const refUser = docSnap.data();
            
            let statusBadge = "";
            if (refUser.status === "active") {
                active++;
                statusBadge = `<span class="badge-status badge-approved">Active</span>`;
            } else {
                inactive++;
                statusBadge = `<span class="badge-status badge-rejected">Inactive</span>`;
            }

            // Convert Joined Date
            const joinedDate = refUser.joinDate ? new Date(refUser.joinDate).toLocaleDateString() : "N/A";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="font-monospace text-muted small text-uppercase">${refUser.userId || "---"}</td>
                <td>
                    <strong class="text-white">${refUser.username || "---"}</strong>
                    <br>
                    <span class="text-muted small">${refUser.fullName || ""}</span>
                </td>
                <td class="small text-muted">${joinedDate}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        // Set global metrics counting safely
        updateMetricDisplay("statTotalRefs", total.toString());
        updateMetricDisplay("statActiveRefs", active.toString());
        updateMetricDisplay("statInactiveRefs", inactive.toString());

    } catch (error) {
        console.error("Error fetching network statistics:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading referrals list: ${error.message}</td></tr>`;
    }
}

// Utility function to update metric text safely
function updateMetricDisplay(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerText = value;
    }
}