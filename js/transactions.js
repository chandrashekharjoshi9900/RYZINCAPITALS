// js/transactions.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let allTransactions = []; // Holds all user tx records in local memory
const filterTypeSelect = document.getElementById("filterType");

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        await loadAllTransactions(user.uid);
    } catch (e) {
        console.error("Ledger Initialization Error:", e);
    }
});

// 1. Fetch all user transactions in memory (index-free design, capped for scale)
async function loadAllTransactions(uid) {
    const tbody = document.getElementById("ledgerTableBody");
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading transactions history...</td></tr>`;
    }

    // Capped at 300 records to prevent extreme read overhead at production scale
    const q = query(
        collection(db, "transactions"),
        where("uid", "==", uid),
        limit(300)
    );

    try {
        const querySnapshot = await getDocs(q);
        allTransactions = [];

        querySnapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
                allTransactions.push(docSnap.data());
            }
        });

        // Sort descending (newest transactions first)
        sortTransactionsInMemory();

        // Initial table population
        populateLedgerTable(allTransactions);

    } catch (error) {
        console.error("Error fetching transactions list:", error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading ledger items: ${error.message}</td></tr>`;
        }
    }
}

// Helper: Sort transactions list by timestamp cleanly
function sortTransactionsInMemory() {
    allTransactions.sort((a, b) => {
        const timestampA = a.timestamp ? new Date(a.timestamp) : new Date(a.date + ' ' + (a.time || ''));
        const timestampB = b.timestamp ? new Date(b.timestamp) : new Date(b.date + ' ' + (b.time || ''));
        return timestampB - timestampA;
    });
}

// 2. Render list content dynamically with filtering options
function populateLedgerTable(transactionsList) {
    const tbody = document.getElementById("ledgerTableBody");
    if (!tbody) return;

    tbody.innerHTML = ""; // Clear loader/previous data

    if (transactionsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No matching records found.</td></tr>`;
        return;
    }

    transactionsList.forEach((tx) => {
        let statusBadge = '';
        if (tx.status === "Approved") {
            statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
        } else if (tx.status === "Pending") {
            statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
        } else {
            statusBadge = `<span class="badge-status badge-rejected">${tx.status || "Rejected"}</span>`;
        }

        const transactionIdStr = tx.transactionId || "---";
        const typeStr = tx.type || "N/A";
        const dateStr = tx.date || "---";
        const timeStr = tx.time || "";
        const amountNum = parseFloat(tx.amount || 0).toFixed(2);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="font-monospace text-muted small text-uppercase">${transactionIdStr}</td>
            <td><strong class="text-white">${typeStr}</strong></td>
            <td class="small text-muted">${dateStr}<br>${timeStr}</td>
            <td class="fw-bold text-info">$${amountNum}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Dropdown Change Event Listener for in-memory dynamic filtering
if (filterTypeSelect) {
    filterTypeSelect.addEventListener("change", () => {
        const selectedFilter = filterTypeSelect.value;
        
        if (selectedFilter === "ALL") {
            populateLedgerTable(allTransactions);
            return;
        }

        // Client-side mapping
        const filtered = allTransactions.filter((tx) => {
            if (!tx.type) return false;
            const typeNormalized = tx.type.toUpperCase();

            if (selectedFilter === "DEPOSIT") {
                return typeNormalized.includes("DEPOSIT");
            }
            if (selectedFilter === "WITHDRAW") {
                return typeNormalized.includes("WITHDRAW") || typeNormalized.includes("PAYOUT");
            }
            if (selectedFilter === "PACKAGE") {
                return typeNormalized.includes("PACKAGE") || typeNormalized.includes("PURCHASE");
            }
            if (selectedFilter === "COMMISSION") {
                return typeNormalized.includes("REFERRAL") || typeNormalized.includes("COMMISSION");
            }
            if (selectedFilter === "PROFIT") {
                return typeNormalized.includes("PROFIT") || typeNormalized.includes("ROI") || typeNormalized.includes("RETURNS");
            }
            return false;
        });

        populateLedgerTable(filtered);
    });
}