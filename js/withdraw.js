// js/withdraw.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, query, where, limit, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let userAvailableBalance = 0;
const withdrawForm = document.getElementById("withdrawForm");
const btnSubmitWithdraw = document.getElementById("btnSubmitWithdraw");
const amountInput = document.getElementById("withdrawAmount");
const lblReceiveAmount = document.getElementById("lblReceiveAmount");

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    try {
        // Execute fetches concurrently (Includes loading saved wallet address)
        await Promise.all([
            loadWalletBalance(user.uid),
            loadSavedWalletAddress(user.uid),
            loadWithdrawalHistory(user.uid)
        ]);
    } catch (e) {
        console.error("Failed to initialize withdrawal page dependencies:", e);
    }
});

// Real-time calculation for 5.5% transaction charge
if (amountInput && lblReceiveAmount) {
    amountInput.addEventListener("input", () => {
        const amount = parseFloat(amountInput.value);
        if (!isNaN(amount) && amount > 0) {
            const finalAmount = amount * 0.945; // 5.5% charge deducted (Remaining 94.5%)
            lblReceiveAmount.innerText = `$${finalAmount.toFixed(2)}`;
        } else {
            lblReceiveAmount.innerText = "$0.00";
        }
    });
}

// 1. Fetch Current Available Wallet Balance
async function loadWalletBalance(uid) {
    try {
        const walletDocRef = doc(db, "wallets", uid);
        const docSnap = await getDoc(walletDocRef);
        
        if (docSnap.exists()) {
            userAvailableBalance = parseFloat(docSnap.data().availableBalance || 0);
            const balanceLabel = document.getElementById("lblAvailableBalance");
            if (balanceLabel) {
                balanceLabel.innerText = userAvailableBalance.toFixed(2);
            }
        }
    } catch (error) {
        console.error("Error retrieving wallet balances:", error);
    }
}

// 2. Load Saved Wallet Address from User Profile
async function loadSavedWalletAddress(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const userData = docSnap.data();
            // If user has previously saved address, populate it in input field
            if (userData.walletAddress) {
                const payoutInput = document.getElementById("payoutAddress");
                if (payoutInput) {
                    payoutInput.value = userData.walletAddress;
                }
            }
        }
    } catch (error) {
        console.error("Error loading saved wallet address:", error);
    }
}

// 3. Submit Withdrawal Request Form Handler
if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) return;

        const payoutInput = document.getElementById("payoutAddress");

        if (!amountInput || !payoutInput) return;

        const amount = parseFloat(amountInput.value);
        const payoutAddress = payoutInput.value.trim();

        // Check Balance Rules
        if (isNaN(amount) || amount < 10) {
            alert("The minimum withdrawal amount is $10.00.");
            return;
        }

        if (amount > userAvailableBalance) {
            alert(`Insufficient funds! Your available balance is $${userAvailableBalance.toFixed(2)} but you requested $${amount.toFixed(2)}.`);
            return;
        }

        if (!payoutAddress) {
            alert("Please enter a valid payout wallet address.");
            return;
        }

        const receiveAmountCalculated = amount * 0.945; // 5.5% deduction
        const confirmWithdraw = confirm(`Are you sure you want to withdraw $${amount.toFixed(2)}? \n\nYou will receive: $${receiveAmountCalculated.toFixed(2)} (after 5.5% charge) \n\nRecipient Address: ${payoutAddress}`);
        if (!confirmWithdraw) return;

        if (btnSubmitWithdraw) {
            btnSubmitWithdraw.disabled = true;
            btnSubmitWithdraw.innerText = "Submitting request...";
        }

        try {
            // Generate IDs
            const withdrawRef = doc(collection(db, "withdrawals"));
            const transRef = doc(collection(db, "transactions"));
            const userDocRef = doc(db, "users", user.uid);

            const currentDate = new Date();
            const dateStr = currentDate.toLocaleDateString();
            const timeStr = currentDate.toLocaleTimeString();
            const timestampStr = currentDate.toISOString();

            const newWithdrawal = {
                withdrawId: withdrawRef.id,
                uid: user.uid,
                amount: amount,
                walletAddress: payoutAddress,
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
                type: "Withdrawal Request",
                amount: amount,
                status: "Pending"
            };

            // Write database logs & update user's saved wallet address in parallel
            // Security rules allow owners to update 'walletAddress' in their own document
            await Promise.all([
                setDoc(withdrawRef, newWithdrawal),
                setDoc(transRef, newTransaction),
                updateDoc(userDocRef, {
                    walletAddress: payoutAddress
                })
            ]);

            alert("Withdrawal request submitted successfully! Pending verification by admin.");
            
            // Clear only the amount field, but keep the wallet address filled for subsequent usage
            if (amountInput) {
                amountInput.value = "";
            }
            if (lblReceiveAmount) {
                lblReceiveAmount.innerText = "$0.00"; 
            }
            
            // Parallel update of balance and history views
            await Promise.all([
                loadWalletBalance(user.uid),
                loadWithdrawalHistory(user.uid)
            ]);

        } catch (error) {
            console.error("Withdrawal request failed:", error);
            alert("Request Failed: " + error.message);
        } finally {
            if (btnSubmitWithdraw) {
                btnSubmitWithdraw.disabled = false;
                btnSubmitWithdraw.innerText = "Submit Payout Request";
            }
        }
    });
}

// 4. Load User Withdrawal Requests History (Capped / JS sorted)
async function loadWithdrawalHistory(uid) {
    const tbody = document.getElementById("withdrawTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Loading payout history...</td></tr>`; 

    // Imposed limit(50) to optimize billing costs and application memory
    const withdrawQuery = query(
        collection(db, "withdrawals"),
        where("uid", "==", uid),
        limit(50)
    );

    try {
        const querySnapshot = await getDocs(withdrawQuery);
        const withdrawals = [];

        querySnapshot.forEach((doc) => {
            if (doc.exists()) {
                withdrawals.push(doc.data());
            }
        });

        // Safe in-memory sorting descending by creation timestamp
        withdrawals.sort((a, b) => {
            const timestampA = a.timestamp ? new Date(a.timestamp) : new Date(a.date + ' ' + (a.time || ''));
            const timestampB = b.timestamp ? new Date(b.timestamp) : new Date(b.date + ' ' + (b.time || ''));
            return timestampB - timestampA;
        });

        if (withdrawals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No withdrawals recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        withdrawals.forEach((wd) => {
            let statusBadge = '';
            if (wd.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (wd.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${wd.status || "Rejected"}</span>`;
            }

            const dateStr = wd.date || "---";
            const timeStr = wd.time || "";
            const addressStr = wd.walletAddress || "N/A";
            const amountNum = parseFloat(wd.amount || 0).toFixed(2);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted">${dateStr}<br>${timeStr}</td>
                <td><span class="text-white text-break font-monospace small">${addressStr}</span></td>
                <td class="fw-bold text-info">$${amountNum}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Payout history rendering error:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading payout history: ${error.message}</td></tr>`;
    }
}
