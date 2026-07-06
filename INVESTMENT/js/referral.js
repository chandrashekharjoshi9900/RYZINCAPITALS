// js/referral.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        await loadReferralDetails(user.uid);
        await loadReferralCommissions(user.uid);
        await loadReferralsNetworkList(user.uid);
    } catch (e) {
        console.error("Referrals Module Error:", e);
    }
});

// 1. Fetch user referral attributes and generate invitation links
async function loadReferralDetails(uid) {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const userData = docSnap.data();
        const refCode = userData.referralCode || "---";

        // Dynamic Invitation Link formulation
        const domainUrl = window.location.origin;
        const refLink = `${domainUrl}/register.html?ref=${refCode}`;

        // Populate DOM elements
        document.getElementById("lblRefCode").innerText = refCode;
        document.getElementById("lblRefLink").innerText = refLink;

        // Event listener for Copy buttons
        document.getElementById("btnCopyCode").onclick = () => {
            navigator.clipboard.writeText(refCode);
            alert("Referral Code copied: " + refCode);
        };

        document.getElementById("btnCopyLink").onclick = () => {
            navigator.clipboard.writeText(refLink);
            alert("Invitation link copied to clipboard!");
        };
    }
}

// 2. Load total Referral earnings from wallet document
async function loadReferralCommissions(uid) {
    const walletRef = doc(db, "wallets", uid);
    const docSnap = await getDoc(walletRef);
    if (docSnap.exists()) {
        const wallet = docSnap.data();
        document.getElementById("statRefEarnings").innerText = parseFloat(wallet.referralEarnings || 0).toFixed(2);
    }
}

// 3. Load Referred Users Network list (Index-free, secure)
async function loadReferralsNetworkList(uid) {
    const tbody = document.getElementById("referralsTableBody");
    tbody.innerHTML = ""; // Clear loader statement

    // Query users where referredBy equals current uid
    const networkQuery = query(
        collection(db, "users"),
        where("referredBy", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(networkQuery);

        let total = 0;
        let active = 0;
        let inactive = 0;

        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No direct referrals recorded yet.</td></tr>`;
            document.getElementById("statTotalRefs").innerText = "0";
            document.getElementById("statActiveRefs").innerText = "0";
            document.getElementById("statInactiveRefs").innerText = "0";
            return;
        }

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
                <td><strong class="text-white">${refUser.username || "---"}</strong><br><span class="text-muted small">${refUser.fullName || ""}</span></td>
                <td class="small text-muted">${joinedDate}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        // Set global metrics counting
        document.getElementById("statTotalRefs").innerText = total;
        document.getElementById("statActiveRefs").innerText = active;
        document.getElementById("statInactiveRefs").innerText = inactive;

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading referrals list: ${error.message}</td></tr>`;
        console.error(error);
    }
}