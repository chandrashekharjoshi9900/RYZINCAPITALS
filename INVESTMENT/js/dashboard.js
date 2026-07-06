// js/dashboard.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let incomeChartInstance = null;

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        await loadUserProfile(user.uid);
        await loadWalletStats(user.uid);
        await loadReferralsNetwork(user.uid);
        await loadRecentLedger(user.uid);
        await initPerformanceChart(user.uid);
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
});

// 1. User Profile Loader
async function loadUserProfile(uid) {
    const userDocRef = doc(db, "users", uid);
    const userSnapshot = await getDoc(userDocRef);

    if (userSnapshot.exists()) {
        const data = userSnapshot.data();
        document.getElementById("lblFullName").innerText = data.fullName || "User";
        document.getElementById("lblUserId").innerText = data.userId || "---";
        document.getElementById("lblUsername").innerText = data.username || "---";
        document.getElementById("lblReferralCode").innerText = data.referralCode || "---";
    }
}

// 2. Wallet Balance & Profit Intervals Loader
async function loadWalletStats(uid) {
    const walletDocRef = doc(db, "wallets", uid);
    const walletSnapshot = await getDoc(walletDocRef);

    if (walletSnapshot.exists()) {
        const wallet = walletSnapshot.data();
        document.getElementById("statWalletBalance").innerText = parseFloat(wallet.availableBalance || 0).toFixed(2);
        document.getElementById("statTotalInvestment").innerText = parseFloat(wallet.totalInvestment || 0).toFixed(2);
        document.getElementById("statTradingIncome").innerText = parseFloat(wallet.totalProfit || 0).toFixed(2);
        document.getElementById("statReferralIncome").innerText = parseFloat(wallet.referralEarnings || 0).toFixed(2);

        document.getElementById("statDailyProfit").innerText = parseFloat(wallet.dailyProfit || 0).toFixed(2);
        document.getElementById("statWeeklyProfit").innerText = parseFloat(wallet.weeklyProfit || 0).toFixed(2);
        document.getElementById("statMonthlyProfit").innerText = parseFloat(wallet.monthlyProfit || 0).toFixed(2);
    }
}

// 3. Referrals Network Count
async function loadReferralsNetwork(uid) {
    const referralsQuery = query(collection(db, "users"), where("referredBy", "==", uid));
    const querySnapshot = await getDocs(referralsQuery);
    
    let totalDirect = 0;
    let activeRefs = 0;
    let inactiveRefs = 0;

    querySnapshot.forEach((doc) => {
        totalDirect++;
        const refUser = doc.data();
        if (refUser.status === "active") {
            activeRefs++;
        } else {
            inactiveRefs++;
        }
    });

    document.getElementById("statDirectRefs").innerText = totalDirect;
    document.getElementById("statActiveRefs").innerText = activeRefs;
    document.getElementById("statInactiveRefs").innerText = inactiveRefs;
}

// 4. Recent Ledger Transactions (UPDATED - INDEX FREE CLIENT SORT)
async function loadRecentLedger(uid) {
    const tbody = document.getElementById("recentTransactions");
    tbody.innerHTML = ""; 

    // Index-free query (no orderBy)
    const txQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid)
    );

    try {
        const querySnapshot = await getDocs(txQuery);

        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No transactions found</td></tr>`;
            return;
        }

        const txList = [];
        querySnapshot.forEach((doc) => {
            txList.push(doc.data());
        });

        // Client sorting in Javascript memory
        txList.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeB - timeA;
        });

        // Limit results to 5
        const recentTxList = txList.slice(0, 5);

        recentTxList.forEach((tx) => {
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
                <td class="small text-muted">${tx.date}</td>
                <td class="fw-medium">${tx.type}</td>
                <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Failed to load transactions</td></tr>`;
        console.error(e);
    }
}

// 5. Initialize Performance Chart
async function initPerformanceChart(uid) {
    const ctx = document.getElementById('incomeChart').getContext('2d');
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const walletDocRef = doc(db, "wallets", uid);
    const walletSnapshot = await getDoc(walletDocRef);
    let totalProfits = 0;
    let refEarnings = 0;

    if (walletSnapshot.exists()) {
        const wallet = walletSnapshot.data();
        totalProfits = parseFloat(wallet.totalProfit || 0);
        refEarnings = parseFloat(wallet.referralEarnings || 0);
    }

    const gradientTrading = ctx.createLinearGradient(0, 0, 0, 200);
    gradientTrading.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
    gradientTrading.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

    const gradientReferrals = ctx.createLinearGradient(0, 0, 0, 200);
    gradientReferrals.addColorStop(0, 'rgba(121, 40, 202, 0.4)');
    gradientReferrals.addColorStop(1, 'rgba(121, 40, 202, 0.0)');

    if (incomeChartInstance) {
        incomeChartInstance.destroy();
    }

    incomeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Trading Profits ($)',
                    data: [totalProfits * 0.15, totalProfits * 0.35, totalProfits * 0.5, totalProfits * 0.7, totalProfits * 0.85, totalProfits],
                    borderColor: '#00d2ff',
                    backgroundColor: gradientTrading,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'Referral Earnings ($)',
                    data: [refEarnings * 0.1, refEarnings * 0.25, refEarnings * 0.4, refEarnings * 0.6, refEarnings * 0.8, refEarnings],
                    borderColor: '#7928ca',
                    backgroundColor: gradientReferrals,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#8a99ad', font: { family: 'Poppins' } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8a99ad' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8a99ad' }
                }
            }
        }
    });
}

// 6. Action Logout Process
const logoutBtn = document.getElementById("btnLogoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to logout?")) {
            await signOut(auth);
            window.location.href = "login.html";
        }
    });
}