// js/transactions.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// 1. Fetch all user transactions in memory (index-free design)
async function loadAllTransactions(uid) {
    const q = query(
        collection(db, "transactions"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(q);
        allTransactions = [];

        querySnapshot.forEach((docSnap) => {
            allTransactions.push(docSnap.data());
        });

        // Default: Sort descending (newest transactions first)
        sortTransactionsInMemory();

        // Initial table population
        populateLedgerTable(allTransactions);

    } catch (error) {
        document.getElementById("ledgerTableBody").innerHTML = `
            <tr><td colspan="5" class="text-center text-danger py-4">Error loading ledger items: ${error.message}</td></tr>`;
    }
}

// Helper: Sort transactions list by timestamp
function sortTransactionsInMemory() {
    allTransactions.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date + ' ' + (a.time || ''));
        const dateB = new Date(b.timestamp || b.date + ' ' + (b.time || ''));
        return dateB - dateA;
    });
}

// 2. Render list content dynamically with filtering options
function populateLedgerTable(transactionsList) {
    const tbody = document.getElementById("ledgerTableBody");
    tbody.innerHTML = ""; // Clear loader/previous data

    if (transactionsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No matching records found in database.</td></tr>`;
        return;
    }

    transactionsList.forEach((tx) => {
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
            <td class="font-monospace text-muted small text-uppercase">${tx.transactionId || "---"}</td>
            <td><strong class="text-white">${tx.type}</strong></td>
            <td class="small text-muted">${tx.date}<br>${tx.time || ""}</td>
            <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Dropdown Change Event Listener for in-memory dynamic filtering
filterTypeSelect.addEventListener("change", () => {
    const selectedFilter = filterTypeSelect.value;
    
    if (selectedFilter === "ALL") {
        populateLedgerTable(allTransactions);
        return;
    }

    // Client-side Javascript filters mapping
    const filtered = allTransactions.filter((tx) => {
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