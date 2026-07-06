// js/packages.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let userWalletBalance = 0;

// Auth State Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        await fetchWalletBalance(user.uid);
        await fetchPackages();
        await fetchPurchaseHistory(user.uid);
    } catch (error) {
        console.error("Initialization Error:", error);
    }
});

// 1. Fetch User Current Wallet Balance
async function fetchWalletBalance(uid) {
    const walletDocRef = doc(db, "wallets", uid);
    const docSnap = await getDoc(walletDocRef);
    if (docSnap.exists()) {
        userWalletBalance = parseFloat(docSnap.data().availableBalance || 0);
        document.getElementById("lblWalletBalance").innerText = userWalletBalance.toFixed(2);
    }
}

// 2. Fetch Active Packages from Firestore
async function fetchPackages() {
    const container = document.getElementById("packagesContainer");
    container.innerHTML = ""; // Clear loader

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

            // Render Package Card
            const col = document.createElement("col");
            col.className = "col-md-6 col-lg-4";
            col.innerHTML = `
                <div class="p-4 rounded-4 h-100 text-center" style="background: var(--bg-secondary); border: 1px solid var(--border-color); relative">
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

        // Attach action listeners to Buy Buttons
        document.querySelectorAll(".btn-buy").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const packageId = btn.getAttribute("data-id");
                const price = parseFloat(btn.getAttribute("data-price"));
                const name = btn.getAttribute("data-name");
                handlePurchaseRequest(packageId, price, name);
            });
        });

    } catch (err) {
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
        // Create standard Transaction structure for security checks
        const transRef = doc(collection(db, "transactions"));
        const newTransaction = {
            transactionId: transRef.id,
            uid: user.uid,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: "Package Purchased",
            amount: price,
            status: "Pending", // Admin Panel approves it to initiate ROI
            packageName: packageName,
            packageId: packageId
        };

        await setDoc(transRef, newTransaction);

        alert("Purchase request submitted successfully! It is pending admin approval.");
        
        // Refresh History and Wallet values on page
        await fetchWalletBalance(user.uid);
        await fetchPurchaseHistory(user.uid);

    } catch (error) {
        alert("Transaction Failed: " + error.message);
    }
}

// 4. Fetch User Purchase Requests from Transactions Collection
// js/packages.js - Updated fetchPurchaseHistory function to avoid Index error

async function fetchPurchaseHistory(uid) {
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = ""; // Clear loader

    // Simplified index-free query
    const historyQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(historyQuery);

        // Fetch docs and filter/sort in memory to avoid Firebase Composite Index requirement
        const txDocs = [];
        querySnapshot.forEach((docSnap) => {
            const tx = docSnap.data();
            // Sirf package purchases items save karenge
            if (tx.type === "Package Purchased") {
                txDocs.push(tx);
            }
        });

        // Latest transactions ko sabse pehle dikhane ke liye sort karenge (descending)
        txDocs.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0);
            const timeB = new Date(b.timestamp || 0);
            return timeB - timeA;
        });

        if (txDocs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No purchase requests submitted yet.</td></tr>`;
            return;
        }

        txDocs.forEach((tx) => {
            let statusBadge = '';
            if (tx.status === "Approved") {
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
                    <strong class="text-white d-block">${tx.packageName || 'ROI Investment'}</strong>
                    <span class="text-muted small">Package ID: ${tx.packageId ? tx.packageId.substring(0, 6) : 'N/A'}</span>
                </td>
                <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td class="small text-muted">${tx.date}<br>${tx.time || ""}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading purchase history: ${err.message}</td></tr>`;
        console.error(err);
    }
}