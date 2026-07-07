// js/deposit.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, setDoc, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Stores payment methods dynamically loaded from Firestore
let DYNAMIC_WALLET_ADDRESSES = {};

const paymentMethodSelect = document.getElementById("paymentMethod");
const companyAddressSpan = document.getElementById("companyAddress");
const btnCopyAddress = document.getElementById("btnCopyAddress");
const depositForm = document.getElementById("depositForm");
const btnSubmitDeposit = document.getElementById("btnSubmitDeposit");

// Safely register UI Event Listeners
if (paymentMethodSelect && companyAddressSpan) {
    paymentMethodSelect.addEventListener("change", () => {
        const selected = paymentMethodSelect.value;
        companyAddressSpan.innerText = DYNAMIC_WALLET_ADDRESSES[selected] || "Address N/A";
    });
}

if (btnCopyAddress && companyAddressSpan) {
    btnCopyAddress.addEventListener("click", () => {
        const address = companyAddressSpan.innerText;
        if (address && address !== "Address N/A" && address !== "Retrieving address...") {
            navigator.clipboard.writeText(address)
                .then(() => alert("Company address copied to clipboard!"))
                .catch(() => alert("Failed to copy address. Please copy it manually."));
        }
    });
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    // Fetch dynamic payment methods and deposit logs concurrently
    await Promise.all([
        loadPaymentMethodsDynamic(),
        loadDepositHistory(user.uid)
    ]);
});

// Load Dynamic Payment Methods from Firestore Collection
async function loadPaymentMethodsDynamic() {
    if (!paymentMethodSelect) return;

    try {
        const snap = await getDocs(collection(db, "payment_methods"));
        paymentMethodSelect.innerHTML = "";
        DYNAMIC_WALLET_ADDRESSES = {};

        if (snap.empty) {
            paymentMethodSelect.innerHTML = `<option value="">No payment methods configured</option>`;
            if (companyAddressSpan) companyAddressSpan.innerText = "Address N/A";
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.innerText = data.name || docSnap.id;
            paymentMethodSelect.appendChild(option);

            // Save the address mapping
            DYNAMIC_WALLET_ADDRESSES[docSnap.id] = data.address || "Address N/A";
        });

        // Trigger manual change to assign first item values instantly
        paymentMethodSelect.dispatchEvent(new Event('change'));

    } catch (err) {
        console.error("Failed to load payment methods:", err);
        paymentMethodSelect.innerHTML = `<option value="">Error loading options</option>`;
    }
}

// Deposit Form Submission Event Handler
if (depositForm) {
    depositForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const amountInput = document.getElementById("depositAmount");
        const txidInput = document.getElementById("transactionId");

        if (!amountInput || !txidInput || !paymentMethodSelect) return;

        const amount = parseFloat(amountInput.value);
        const method = paymentMethodSelect.value;
        const txid = txidInput.value.trim();

        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid positive amount.");
            return;
        }

        if (!method) {
            alert("Please select a valid payment method.");
            return;
        }

        if (!txid) {
            alert("Please enter a valid transaction ID.");
            return;
        }

        if (btnSubmitDeposit) {
            btnSubmitDeposit.disabled = true;
            btnSubmitDeposit.innerText = "Submitting request...";
        }

        try {
            // Generate references locally
            const depositRef = doc(collection(db, "deposits"));
            const transRef = doc(collection(db, "transactions"));

            const currentDate = new Date();
            const dateStr = currentDate.toLocaleDateString();
            const timeStr = currentDate.toLocaleTimeString();
            const timestampStr = currentDate.toISOString();

            const newDeposit = {
                depositId: depositRef.id,
                uid: user.uid,
                amount: amount,
                paymentMethod: method,
                transactionId: txid,
                status: "Pending", 
                date: dateStr,
                time: timeStr,
                timestamp: timestampStr
            };

            const newTransaction = {
                transactionId: transRef.id,
                uid: user.uid,
                date: dateStr,
                time: timeStr,
                timestamp: timestampStr,
                type: "Deposit Request", 
                amount: amount,
                status: "Pending"
            };

            // Write both logs concurrently
            await Promise.all([
                setDoc(depositRef, newDeposit),
                setDoc(transRef, newTransaction)
            ]);

            alert("Deposit request submitted successfully! Pending verification by admin.");
            
            depositForm.reset();
            paymentMethodSelect.dispatchEvent(new Event('change')); 
            await loadDepositHistory(user.uid);

        } catch (error) {
            console.error("Deposit submission error:", error);
            alert("Submission Failed: " + error.message);
        } finally {
            if (btnSubmitDeposit) {
                btnSubmitDeposit.disabled = false;
                btnSubmitDeposit.innerText = "Submit Deposit Request";
            }
        }
    });
}

// Fetch and render historical deposit records
async function loadDepositHistory(uid) {
    const tbody = document.getElementById("depositTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading deposits history...</td></tr>`; 

    const depositsQuery = query(
        collection(db, "deposits"),
        where("uid", "==", uid),
        limit(50)
    );

    try {
        const querySnapshot = await getDocs(depositsQuery);
        const deposits = [];
        
        querySnapshot.forEach((doc) => {
            deposits.push(doc.data());
        });

        // Safe client-side sorting by creation timestamp
        deposits.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        if (deposits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No deposits recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        deposits.forEach((dep) => {
            let statusBadge = '';
            if (dep.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (dep.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${dep.status || "Rejected"}</span>`;
            }

            const methodDisplay = dep.paymentMethod ? dep.paymentMethod.replace('_', ' ') : "N/A";
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted">${dep.date || "---"}</td>
                <td><strong class="text-white">${methodDisplay}</strong></td>
                <td><span class="small text-muted font-monospace text-break">${dep.transactionId || "---"}</span></td>
                <td class="fw-bold text-info">$${parseFloat(dep.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error fetching deposit history:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading history: ${error.message}</td></tr>`;
    }
}