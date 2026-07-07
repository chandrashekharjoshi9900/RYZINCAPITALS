// js/dashboard.js
import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let incomeChartInstance = null;
let cachedUserProfile = null;
let cachedWalletData = null;

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // Run network requests in parallel for optimal performance
        const [profile, wallet] = await Promise.all([
            fetchUserProfile(user.uid),
            fetchWalletStats(user.uid),
            loadReferralsNetwork(user.uid),
            loadRecentLedger(user.uid)
        ]);

        // Process profile rendering
        if (profile) {
            renderUserProfile(profile);
        }

        // Process wallet rendering & chart initialization
        if (wallet) {
            renderWalletStats(wallet);
            initPerformanceChart(wallet);
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
});

// 1. Fetch User Profile (with localized caching)
async function fetchUserProfile(uid) {
    if (cachedUserProfile) return cachedUserProfile;
    try {
        const userDocRef = doc(db, "users", uid);
        const userSnapshot = await getDoc(userDocRef);
        if (userSnapshot.exists()) {
            cachedUserProfile = userSnapshot.data();
            return cachedUserProfile;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
    }
    return null;
}

function renderUserProfile(data) {
    document.getElementById("lblFullName").innerText = data.fullName || "User";
    document.getElementById("lblUserId").innerText = data.userId || "---";
    document.getElementById("lblUsername").innerText = data.username || "---";
    document.getElementById("lblReferralCode").innerText = data.referralCode || "---";
}

// 2. Fetch Wallet Stats (with localized caching to prevent duplicate document requests)
async function fetchWalletStats(uid) {
    if (cachedWalletData) return cachedWalletData;
    try {
        const walletDocRef = doc(db, "wallets", uid);
        const walletSnapshot = await getDoc(walletDocRef);
        if (walletSnapshot.exists()) {
            cachedWalletData = walletSnapshot.data();
            return cachedWalletData;
        }
    } catch (error) {
        console.error("Error fetching wallet stats:", error);
    }
    return null;
}

function renderWalletStats(wallet) {
    document.getElementById("statWalletBalance").innerText = parseFloat(wallet.availableBalance || 0).toFixed(2);
    document.getElementById("statTotalInvestment").innerText = parseFloat(wallet.totalInvestment || 0).toFixed(2);
    document.getElementById("statTradingIncome").innerText = parseFloat(wallet.totalProfit || 0).toFixed(2);
    document.getElementById("statReferralIncome").innerText = parseFloat(wallet.referralEarnings || 0).toFixed(2);

    document.getElementById("statDailyProfit").innerText = parseFloat(wallet.dailyProfit || 0).toFixed(2);
    document.getElementById("statWeeklyProfit").innerText = parseFloat(wallet.weeklyProfit || 0).toFixed(2);
    document.getElementById("statMonthlyProfit").innerText = parseFloat(wallet.monthlyProfit || 0).toFixed(2);
}

// 3. Referrals Network Count (Secure Query)
async function loadReferralsNetwork(uid) {
    try {
        // Aligns with updated security rules allowing referrers to query their own referee documents
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
    } catch (error) {
        console.error("Error loading referral network:", error);
    }
}

// 4. Recent Ledger Transactions (Capped Query to Minimize Read Billing)
async function loadRecentLedger(uid) {
    const tbody = document.getElementById("recentTransactions");
    if (!tbody) return;
    
    tbody.innerHTML = ""; 

    // Imposed limit(50) to prevent download of entire transaction archives at scale
    const txQuery = query(
        collection(db, "transactions"),
        where("uid", "==", uid),
        limit(50)
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

        // Safe in-memory sorting of the capped subset
        txList.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeB - timeA;
        });

        // Get top 5 items
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
                <td class="small text-muted">${tx.date || "---"}</td>
                <td class="fw-medium">${tx.type || "---"}</td>
                <td class="fw-bold text-info">$${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Failed to load transactions</td></tr>`;
        console.error("Error loading recent ledger:", e);
    }
}

// 5. Initialize Performance Chart (Using cached data to avoid redundant Firestore read)
async function initPerformanceChart(wallet) {
    const canvas = document.getElementById('incomeChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const totalProfits = parseFloat(wallet.totalProfit || 0);
    const refEarnings = parseFloat(wallet.referralEarnings || 0);

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
            try {
                // Clear state caching upon signout
                cachedUserProfile = null;
                cachedWalletData = null;
                await signOut(auth);
                window.location.href = "login.html";
            } catch (error) {
                console.error("Logout failed:", error);
            }
        }
    });
}