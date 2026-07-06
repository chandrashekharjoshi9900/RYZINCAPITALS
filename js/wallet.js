// js/wallet.js
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
        await loadWalletAssets(user.uid);
        await loadRecentWalletLedger(user.uid);
    } catch (e) {
        console.error("Error loading Wallet Overview:", e);
    }
});

// 1. Fetch Wallet Document Assets breakdown
async function loadWalletAssets(uid) {
    const walletRef = doc(db, "wallets", uid);
    const docSnap = await getDoc(walletRef);

    if (docSnap.exists()) {
        const wallet = docSnap.data();
        const balance = parseFloat(wallet.availableBalance || 0);
        const deposit = parseFloat(wallet.totalDeposit || 0);
        const withdraw = parseFloat(wallet.totalWithdraw || 0);
        const profit = parseFloat(wallet.totalProfit || 0);
        const refEarnings = parseFloat(wallet.referralEarnings || 0);

        // Populate big net value card
        document.getElementById("lblNetWorth").innerText = balance.toFixed(2);

        // Populate bottom grid portfolio metrics
        document.getElementById("statTotalDeposit").innerText = deposit.toFixed(2);
        document.getElementById("statTotalWithdraw").innerText = withdraw.toFixed(2);
        document.getElementById("statTotalProfit").innerText = profit.toFixed(2);
        document.getElementById("statReferralEarnings").innerText = refEarnings.toFixed(2);
    }
}

// 2. Fetch User Financial Action Items for Ledger (Index-free/JS sorted)
async function loadRecentWalletLedger(uid) {
    const tbody = document.getElementById("walletLedgerBody");
    tbody.innerHTML = ""; // Clear loader 

    const txQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(txQuery);

        const txList = [];
        querySnapshot.forEach((doc) => {
            txList.push(doc.data());
        });

        // Client-side sort descending in Javascript (Index-free)
        txList.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        // Limit to 10 items for readability
        const recentTx = txList.slice(0, 10);

        if (recentTx.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No financial operations found in ledger.</td></tr>`;
            return;
        }

        recentTx.forEach((tx) => {
            let statusBadge = '';
            if (tx.status === "Approved" || tx.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (tx.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${tx.status || "Rejected"}</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted text-uppercase">${tx.transactionId.substring(0, 10)}...</td>
                <td>
                    <strong class="text-white d-block">${tx.type}</strong>
                </td>
                <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td class="small text-muted">${tx.date} - ${tx.time || ""}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading wallet statement ledger: ${error.message}</td></tr>`;
        console.error(error);
    }
}