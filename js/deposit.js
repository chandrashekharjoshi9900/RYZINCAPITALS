// js/deposit.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const WALLET_ADDRESSES = {
    USDT_TRC20: "TX3TfT87e8yD14Nj9yD14Nj9yD14Nj9yD14",
    BTC: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    ETH_ERC20: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
};

const paymentMethodSelect = document.getElementById("paymentMethod");
const companyAddressSpan = document.getElementById("companyAddress");
const btnCopyAddress = document.getElementById("btnCopyAddress");
const depositForm = document.getElementById("depositForm");
const btnSubmitDeposit = document.getElementById("btnSubmitDeposit");

paymentMethodSelect.addEventListener("change", () => {
    const selected = paymentMethodSelect.value;
    companyAddressSpan.innerText = WALLET_ADDRESSES[selected] || "Address N/A";
});

btnCopyAddress.addEventListener("click", () => {
    navigator.clipboard.writeText(companyAddressSpan.innerText);
    alert("Company address copied to clipboard!");
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    await loadDepositHistory(user.uid);
});

depositForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const amount = parseFloat(document.getElementById("depositAmount").value);
    const method = paymentMethodSelect.value;
    const txid = document.getElementById("transactionId").value.trim();

    if (amount <= 0) {
        alert("Please enter a valid positive amount.");
        return;
    }

    btnSubmitDeposit.disabled = true;
    btnSubmitDeposit.innerText = "Submitting request...";

    try {
        const depositRef = doc(collection(db, "deposits"));
        const newDeposit = {
            depositId: depositRef.id,
            uid: user.uid,
            amount: amount,
            paymentMethod: method,
            transactionId: txid,
            status: "Pending", 
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString()
        };

        await setDoc(depositRef, newDeposit);

        const transRef = doc(collection(db, "transactions"));
        await setDoc(transRef, {
            transactionId: transRef.id,
            uid: user.uid,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: "Deposit Request",
            amount: amount,
            status: "Pending"
        });

        alert("Deposit request submitted successfully! Pending verification by admin.");
        depositForm.reset();
        paymentMethodSelect.dispatchEvent(new Event('change')); 
        await loadDepositHistory(user.uid);

    } catch (error) {
        alert("Submission Failed: " + error.message);
    } finally {
        btnSubmitDeposit.disabled = false;
        btnSubmitDeposit.innerText = "Submit Deposit Request";
    }
});

async function loadDepositHistory(uid) {
    const tbody = document.getElementById("depositTableBody");
    tbody.innerHTML = ""; 

    const depositsQuery = query(
        collection(db, "deposits"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(depositsQuery);
        const deposits = [];
        querySnapshot.forEach((doc) => {
            deposits.push(doc.data());
        });

        deposits.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        if (deposits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No deposits recorded yet.</td></tr>`;
            return;
        }

        deposits.forEach((dep) => {
            let statusBadge = '';
            if (dep.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (dep.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${dep.status || "Rejected"}</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted">${dep.date}</td>
                <td><strong class="text-white">${dep.paymentMethod.replace('_', ' ')}</strong></td>
                <td><span class="small text-muted font-monospace text-break">${dep.transactionId}</span></td>
                <td class="fw-bold text-info">$${parseFloat(dep.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading history: ${error.message}</td></tr>`;
    }
}