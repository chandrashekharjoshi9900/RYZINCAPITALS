// js/wallet.js
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
        // Retrieve asset allocations and operations ledger concurrently
        await Promise.all([
            loadWalletAssets(user.uid),
            loadRecentWalletLedger(user.uid)
        ]);
    } catch (e) {
        console.error("Error loading Wallet Overview:", e);
    }
});

// 1. Fetch Wallet Document Assets breakdown
async function loadWalletAssets(uid) {
    try {
        const walletRef = doc(db, "wallets", uid);
        const docSnap = await getDoc(walletRef);

        if (docSnap.exists()) {
            const wallet = docSnap.data();
            const balance = parseFloat(wallet.availableBalance || 0);
            const deposit = parseFloat(wallet.totalDeposit || 0);
            const withdraw = parseFloat(wallet.totalWithdraw || 0);
            const profit = parseFloat(wallet.totalProfit || 0);
            const refEarnings = parseFloat(wallet.referralEarnings || 0);

            // Populate main wallet components
            const lblNetWorth = document.getElementById("lblNetWorth");
            const statTotalDeposit = document.getElementById("statTotalDeposit");
            const statTotalWithdraw = document.getElementById("statTotalWithdraw");
            const statTotalProfit = document.getElementById("statTotalProfit");
            const statReferralEarnings = document.getElementById("statReferralEarnings");

            if (lblNetWorth) lblNetWorth.innerText = balance.toFixed(2);
            if (statTotalDeposit) statTotalDeposit.innerText = deposit.toFixed(2);
            if (statTotalWithdraw) statTotalWithdraw.innerText = withdraw.toFixed(2);
            if (statTotalProfit) statTotalProfit.innerText = profit.toFixed(2);
            if (statReferralEarnings) statReferralEarnings.innerText = refEarnings.toFixed(2);
        }
    } catch (error) {
        console.error("Failed to retrieve wallet metrics:", error);
    }
}

// 2. Fetch User Financial Action Items for Ledger (Capped / JS sorted)
async function loadRecentWalletLedger(uid) {
    const tbody = document.getElementById("walletLedgerBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading statement transactions...</td></tr>`;

    // Added limit(50) to optimize billing costs and application memory
    const txQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid),
        limit(50)
    );

    try {
        const querySnapshot = await getDocs(txQuery);
        const txList = [];

        querySnapshot.forEach((doc) => {
            if (doc.exists()) {
                txList.push(doc.data());
            }
        });

        // Safe in-memory sorting descending by time value
        txList.sort((a, b) => {
            const timestampA = a.timestamp ? new Date(a.timestamp) : new Date(a.date + ' ' + (a.time || ''));
            const timestampB = b.timestamp ? new Date(b.timestamp) : new Date(b.date + ' ' + (b.time || ''));
            return timestampB - timestampA;
        });

        // Restrict array display count to the top 10 rows
        const recentTx = txList.slice(0, 10);

        if (recentTx.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No financial operations found in ledger.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        recentTx.forEach((tx) => {
            let statusBadge = '';
            if (tx.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (tx.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${tx.status || "Rejected"}</span>`;
            }

            const truncatedTxId = tx.transactionId ? `${tx.transactionId.substring(0, 10)}...` : "---";
            const typeStr = tx.type || "N/A";
            const amountNum = parseFloat(tx.amount || 0).toFixed(2);
            const dateStr = tx.date || "---";
            const timeStr = tx.time || "";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted text-uppercase">${truncatedTxId}</td>
                <td>
                    <strong class="text-white d-block">${typeStr}</strong>
                </td>
                <td class="fw-bold text-info">$${amountNum}</td>
                <td class="small text-muted">${dateStr} - ${timeStr}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Statement ledger retrieval failure:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading wallet statement ledger: ${error.message}</td></tr>`;
    }
}