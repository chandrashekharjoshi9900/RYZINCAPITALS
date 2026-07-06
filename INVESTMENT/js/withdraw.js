// js/withdraw.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let userAvailableBalance = 0;
const withdrawForm = document.getElementById("withdrawForm");
const btnSubmitWithdraw = document.getElementById("btnSubmitWithdraw");

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    await loadWalletBalance(user.uid);
    await loadWithdrawalHistory(user.uid);
});

// 1. Fetch Current Available Wallet Balance
async function loadWalletBalance(uid) {
    const walletDocRef = doc(db, "wallets", uid);
    const docSnap = await getDoc(walletDocRef);
    if (docSnap.exists()) {
        userAvailableBalance = parseFloat(docSnap.data().availableBalance || 0);
        document.getElementById("lblAvailableBalance").innerText = userAvailableBalance.toFixed(2);
    }
}

// 2. Submit Withdrawal Request Form Handler
withdrawForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) return;

    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const payoutAddress = document.getElementById("payoutAddress").value.trim();

    // Check Balance Rules
    if (amount < 10) {
        alert("The minimum withdrawal amount is $10.00.");
        return;
    }

    if (amount > userAvailableBalance) {
        alert(`Insufficient funds! Your available balance is $${userAvailableBalance.toFixed(2)} but you requested $${amount.toFixed(2)}.`);
        return;
    }

    const confirmWithdraw = confirm(`Are you sure you want to withdraw $${amount.toFixed(2)} to address: \n\n${payoutAddress}?`);
    if (!confirmWithdraw) return;

    btnSubmitWithdraw.disabled = true;
    btnSubmitWithdraw.innerText = "Submitting request...";

    try {
        // Create withdrawal transaction
        const withdrawRef = doc(collection(db, "withdrawals"));
        const newWithdrawal = {
            withdrawId: withdrawRef.id,
            uid: user.uid,
            amount: amount,
            walletAddress: payoutAddress,
            status: "Pending", // Admin Panel handles confirmation & actual balance deduction
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString()
        };

        await setDoc(withdrawRef, newWithdrawal);

        // Record a copy inside the centralized Ledger System
        const transRef = doc(collection(db, "transactions"));
        await setDoc(transRef, {
            transactionId: transRef.id,
            uid: user.uid,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: "Withdrawal Request",
            amount: amount,
            status: "Pending"
        });

        alert("Withdrawal request submitted successfully! Pending verification by admin.");
        
        withdrawForm.reset();
        await loadWalletBalance(user.uid);
        await loadWithdrawalHistory(user.uid);

    } catch (error) {
        alert("Request Failed: " + error.message);
    } finally {
        btnSubmitWithdraw.disabled = false;
        btnSubmitWithdraw.innerText = "Submit Payout Request";
    }
});

// 3. Load User Withdrawal Requests History (Index-Free JS Sorting)
async function loadWithdrawalHistory(uid) {
    const tbody = document.getElementById("withdrawTableBody");
    tbody.innerHTML = ""; // Clear loader values

    const withdrawQuery = query(
        collection(db, "withdrawals"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(withdrawQuery);

        const withdrawals = [];
        querySnapshot.forEach((doc) => {
            withdrawals.push(doc.data());
        });

        // Sort descending in Javascript
        withdrawals.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        if (withdrawals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No withdrawals recorded yet.</td></tr>`;
            return;
        }

        withdrawals.forEach((wd) => {
            let statusBadge = '';
            if (wd.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (wd.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${wd.status || "Rejected"}</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted">${wd.date}<br>${wd.time || ""}</td>
                <td><span class="text-white text-break font-monospace small">${wd.walletAddress}</span></td>
                <td class="fw-bold text-info">$${parseFloat(wd.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading payout history: ${error.message}</td></tr>`;
        console.error(error);
    }
}