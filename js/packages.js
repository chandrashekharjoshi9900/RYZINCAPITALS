// js/packages.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let userWalletBalance = 0;

// Auth State Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // Fetch all dependencies concurrently to speed up initialization
        await Promise.all([
            fetchWalletBalance(user.uid),
            fetchPackages(),
            fetchPurchaseHistory(user.uid)
        ]);
    } catch (error) {
        console.error("Initialization Error on packages page:", error);
    }
});

// 1. Fetch User Current Wallet Balance
async function fetchWalletBalance(uid) {
    try {
        const walletDocRef = doc(db, "wallets", uid);
        const docSnap = await getDoc(walletDocRef);
        
        if (docSnap.exists()) {
            userWalletBalance = parseFloat(docSnap.data().availableBalance || 0);
            const balanceLabel = document.getElementById("lblWalletBalance");
            if (balanceLabel) {
                balanceLabel.innerText = userWalletBalance.toFixed(2);
            }
        }
    } catch (error) {
        console.error("Error fetching wallet balance:", error);
    }
}

// 2. Fetch Active Packages from Firestore
async function fetchPackages() {
    const container = document.getElementById("packagesContainer");
    if (!container) return;

    container.innerHTML = ""; // Clear active state loader

    try {
        const querySnapshot = await getDocs(collection(db, "packages"));

        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-5 col-12">
                    <i class="fa-solid fa-folder-open text-muted fs-1 mb-3"></i>
                    <p class="text-muted">No investment packages currently available.</p>
                </div>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const pack = docSnap.data();
            const packId = docSnap.id;

            // Render Package Card with original design
            const col = document.createElement("div");
            col.className = "col-md-6 col-lg-4";
            col.innerHTML = `
                <div class="p-4 rounded-4 h-100 text-center" style="background: var(--bg-secondary); border: 1px solid var(--border-color); position: relative">
                    <h4 class="text-white fw-bold mb-2">${pack.packageName}</h4>
                    <p class="text-muted small mb-3">${pack.description || 'Premium ROI Plan'}</p>
                    <hr style="border-color: var(--border-color)">
                    <div class="my-4">
                        <span class="text-muted small">Investment Price</span>
                        <h2 class="text-white fw-bold my-1" style="font-size: 36px; background: linear-gradient(135deg, var(--accent-blue), #ffffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$${parseFloat(pack.price || 0).toFixed(2)}</h2>
                        <span class="badge bg-dark border border-secondary text-info px-3 py-1 mt-2">${pack.duration} Days ROI</span>
                    </div>
                    <button class="btn btn-premium mt-3 btn-buy" data-id="${packId}" data-price="${pack.price}" data-name="${pack.packageName}">
                        <i class="fa-solid fa-cart-shopping me-1"></i> Buy Package
                    </button>
                </div>
            `;
            container.appendChild(col);
        });

        // Safe attachment of actions to Buy Buttons
        document.querySelectorAll(".btn-buy").forEach((btn) => {
            btn.addEventListener("click", () => {
                const packageId = btn.getAttribute("data-id");
                const price = parseFloat(btn.getAttribute("data-price"));
                const name = btn.getAttribute("data-name");
                handlePurchaseRequest(packageId, price, name);
            });
        });

    } catch (err) {
        console.error("Error retrieving packages:", err);
        container.innerHTML = `<div class="text-center text-danger py-4 col-12">Failed to load packages: ${err.message}</div>`;
    }
}

// 3. Purchase Request Submission Flow
async function handlePurchaseRequest(packageId, price, packageName) {
    const user = auth.currentUser;
    if (!user) return;

    if (userWalletBalance < price) {
        alert(`Insufficient funds! Package price is $${price.toFixed(2)} but your current available balance is $${userWalletBalance.toFixed(2)}. Please deposit more funds.`);
        return;
    }

    const confirmBuy = confirm(`Are you sure you want to request the purchase of "${packageName}" for $${price.toFixed(2)}?`);
    if (!confirmBuy) return;

    try {
        const transRef = doc(collection(db, "transactions"));
        
        const currentDate = new Date();
        const dateStr = currentDate.toLocaleDateString();
        const timeStr = currentDate.toLocaleTimeString();
        const timestampStr = currentDate.toISOString();

        const newTransaction = {
            transactionId: transRef.id,
            uid: user.uid,
            date: dateStr,
            time: timeStr,
            timestamp: timestampStr,
            type: "Package Purchased", // Verified match in transaction rules configuration
            amount: price,
            status: "Pending", // Pending is verified in security rules updates
            packageName: packageName,
            packageId: packageId
        };

        await setDoc(transRef, newTransaction);

        alert("Purchase request submitted successfully! It is pending admin approval.");
        
        // Parallel data refresh
        await Promise.all([
            fetchWalletBalance(user.uid),
            fetchPurchaseHistory(user.uid)
        ]);

    } catch (error) {
        console.error("Error during purchase execution:", error);
        alert("Transaction Failed: " + error.message);
    }
}

// 4. Fetch User Purchase Requests from Transactions Collection
async function fetchPurchaseHistory(uid) {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading history...</td></tr>`;

    // High performance server-side filtering on 'type' and 'limit' to prevent billing leaks
    const historyQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid),
        where("type", "==", "Package Purchased"),
        limit(50)
    );

    try {
        const querySnapshot = await getDocs(historyQuery);
        const txDocs = [];

        querySnapshot.forEach((docSnap) => {
            txDocs.push(docSnap.data());
        });

        // In-memory descending order sorting of filtered subset
        txDocs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        if (txDocs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No purchase requests submitted yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        txDocs.forEach((tx) => {
            let statusBadge = '';
            if (tx.status === "Approved") {
                statusBadge = `<span class="badge-status badge-approved">Approved</span>`;
            } else if (tx.status === "Pending") {
                statusBadge = `<span class="badge-status badge-pending">Pending</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-rejected">${tx.status || "Rejected"}</span>`;
            }

            const truncatedTxId = tx.transactionId ? `${tx.transactionId.substring(0, 10)}...` : "---";
            const truncatedPackId = tx.packageId ? tx.packageId.substring(0, 6) : 'N/A';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="small text-muted text-uppercase">${truncatedTxId}</td>
                <td>
                    <strong class="text-white d-block">${tx.packageName || 'ROI Investment'}</strong>
                    <span class="text-muted small">Package ID: ${truncatedPackId}</span>
                </td>
                <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td class="small text-muted">${tx.date || "---"}<br>${tx.time || ""}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error retrieving purchase transactions:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading purchase history: ${err.message}</td></tr>`;
    }
}