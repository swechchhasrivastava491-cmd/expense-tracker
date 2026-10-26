let transactions = [];
let monthlyBudget = 0;

let incomeExpenseChart = null;
let categoryChart = null;

const API = "/api";

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function refreshDashboard() {
    displayTransactions();
    updateSummary();
    updateCharts();
    updateBudgetDisplay();
}

async function loadData() {
    try {
        const [savedTransactions, budgetData] = await Promise.all([
            apiRequest(`${API}/transactions`),
            apiRequest(`${API}/budget`)
        ]);

        transactions = savedTransactions;
        monthlyBudget = Number(budgetData.monthlyBudget) || 0;

        refreshDashboard();
    } catch (error) {
        alert("Data load nahi hua: " + error.message);
    }
}

// ADD TRANSACTION
async function addTransaction() {
    const description =
        document.getElementById("description").value.trim();
    const amount =
        Number(document.getElementById("amount").value);
    const type = document.getElementById("type").value;
    const category = document.getElementById("category").value;
    const date = document.getElementById("date").value;

    if (!description || !Number.isFinite(amount) ||
        amount <= 0 || !date) {
        alert("Please enter all details and a valid amount!");
        return;
    }

    try {
        await apiRequest(`${API}/transactions`, {
            method: "POST",
            body: JSON.stringify({
                description, amount, type, category, date
            })
        });

        document.getElementById("description").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("date").value = "";

        await loadData();
    } catch (error) {
        alert("Transaction add nahi hui: " + error.message);
    }
}

// DISPLAY TRANSACTIONS
function displayTransactions() {
    const list = document.getElementById("transactionList");
    if (!list) return;

    list.innerHTML = "";

    const search =
        document.getElementById("searchInput").value.trim().toLowerCase();
    const categoryFilter =
        document.getElementById("categoryFilter").value;
    const typeFilter =
        document.getElementById("typeFilter").value;

    const filtered = transactions.filter(transaction => {
        const description = String(transaction.description || "");
        const category = String(transaction.category || "");
        const type = String(transaction.type || "");

        return (
            (description.toLowerCase().includes(search) ||
             category.toLowerCase().includes(search)) &&
            (categoryFilter === "All" || category === categoryFilter) &&
            (typeFilter === "All" || type === typeFilter)
        );
    });

    if (!filtered.length) {
        const li = document.createElement("li");
        li.className = "empty-transactions";
        li.textContent = "No matching transactions found.";
        list.appendChild(li);
        return;
    }

    filtered.forEach(transaction => {
        const li = document.createElement("li");
        li.className = "transaction-card";

        const info = document.createElement("div");
        info.className = "transaction-info";

        const title = document.createElement("strong");
        title.className = "transaction-title";
        title.textContent = transaction.description;

        const meta = document.createElement("div");
        meta.className = "transaction-meta";
        meta.textContent =
            `${transaction.category} · ${transaction.date}`;

        info.append(title, meta);

        const right = document.createElement("div");
        right.className = "transaction-right";

        const isIncome = transaction.type === "income";
        const amount = document.createElement("strong");
        amount.className = isIncome
            ? "transaction-amount income-amount"
            : "transaction-amount expense-amount";
        amount.textContent =
            `${isIncome ? "+" : "−"} ₹${Number(transaction.amount).toLocaleString("en-IN")}`;

        const badge = document.createElement("span");
        badge.className = isIncome
            ? "transaction-badge income-badge"
            : "transaction-badge expense-badge";
        badge.textContent = isIncome ? "Income" : "Expense";

        right.append(amount, badge);
        li.append(info, right);

        const actions = document.createElement("div");
        actions.className = "transaction-actions";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "edit-button";
        edit.textContent = "Edit";
        edit.onclick = () => editTransaction(transaction.id);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-button";
        remove.textContent = "Delete";
        remove.onclick = () => deleteTransaction(transaction.id);

        actions.append(edit, remove);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

// EDIT TRANSACTION
async function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const description = prompt("Enter description:", transaction.description);
    if (description === null) return;

    const amountText = prompt("Enter amount:", transaction.amount);
    if (amountText === null) return;

    const amount = Number(amountText);
    if (!description.trim() || !Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a valid description and amount.");
        return;
    }

    const category = prompt(
        "Enter category (Food, Travel, Shopping, Bills, Education, Other):",
        transaction.category
    );
    if (category === null) return;

    const date = prompt("Enter date (YYYY-MM-DD):", transaction.date);
    if (date === null) return;

    const allowedCategories =
        ["Food", "Travel", "Shopping", "Bills", "Education", "Other"];

    if (!allowedCategories.includes(category.trim()) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Please enter a valid category and date.");
        return;
    }

    try {
        await apiRequest(`${API}/transactions/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                description: description.trim(),
                amount,
                type: transaction.type,
                category: category.trim(),
                date
            })
        });

        await loadData();
        alert("Transaction updated successfully!");
    } catch (error) {
        alert("Update failed: " + error.message);
    }
}

// DELETE TRANSACTION
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        await apiRequest(`${API}/transactions/${id}`, {
            method: "DELETE"
        });
        await loadData();
    } catch (error) {
        alert("Delete failed: " + error.message);
    }
}

// SUMMARY CARDS
function updateSummary() {
    const income = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    document.getElementById("income").textContent =
        "₹" + income.toLocaleString("en-IN");
    document.getElementById("expense").textContent =
        "₹" + expense.toLocaleString("en-IN");
    document.getElementById("balance").textContent =
        "₹" + (income - expense).toLocaleString("en-IN");
}

// CHARTS
function updateCharts() {
    const incomeCanvas = document.getElementById("incomeExpenseChart");
    const categoryCanvas = document.getElementById("categoryChart");

    if (!incomeCanvas || !categoryCanvas ||
        typeof Chart === "undefined") return;

    const income = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    if (incomeExpenseChart) incomeExpenseChart.destroy();

    incomeExpenseChart = new Chart(incomeCanvas, {
        type: "bar",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                label: "Amount (₹)",
                data: [income, expense],
                backgroundColor: ["#2eaf72", "#e45b66"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    const totals = {};
    transactions
        .filter(t => t.type === "expense")
        .forEach(t => {
            const category = t.category || "Other";
            totals[category] =
                (totals[category] || 0) + Number(t.amount);
        });

    if (categoryChart) categoryChart.destroy();

    const labels = Object.keys(totals);

    categoryChart = new Chart(categoryCanvas, {
        type: "doughnut",
        data: {
            labels: labels.length ? labels : ["No Expenses"],
            datasets: [{
                data: labels.length ? Object.values(totals) : [1],
                backgroundColor: [
                    "#5b6ee1", "#2eaf72", "#f4b942",
                    "#e45b66", "#9b59b6", "#36a2b8", "#ff8c69"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } }
        }
    });
}

// SAVE MONTHLY BUDGET
async function saveBudget() {
    const input = document.getElementById("monthlyBudget");
    const amount = Number(input.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a valid budget greater than zero.");
        return;
    }

    try {
        const result = await apiRequest(`${API}/budget`, {
            method: "PUT",
            body: JSON.stringify({ monthlyBudget: amount })
        });

        monthlyBudget = Number(result.monthlyBudget);
        input.value = "";
        updateBudgetDisplay();
        alert("Monthly budget saved!");
    } catch (error) {
        alert("Budget save nahi hua: " + error.message);
    }
}

// BUDGET DISPLAY
function updateBudgetDisplay() {
    const currentMonth = new Date().toLocaleDateString("en-CA");

    const monthKey = currentMonth.slice(0, 7);

    const monthlyExpenses = transactions
        .filter(t =>
            t.type === "expense" &&
            t.date &&
            t.date.slice(0, 7) === monthKey
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const remaining = monthlyBudget - monthlyExpenses;

    document.getElementById("budgetAmount").textContent =
        monthlyBudget.toLocaleString("en-IN");
    document.getElementById("budgetSpent").textContent =
        monthlyExpenses.toLocaleString("en-IN");
    document.getElementById("budgetRemaining").textContent =
        remaining.toLocaleString("en-IN");

    const message = document.getElementById("budgetMessage");

    if (monthlyBudget === 0) {
        message.textContent = "Please set your monthly budget.";
    } else if (remaining < 0) {
        message.textContent =
            "Budget exceeded by ₹" +
            Math.abs(remaining).toLocaleString("en-IN") + "!";
    } else if (remaining === 0) {
        message.textContent = "You have used your full budget.";
    } else {
        message.textContent = "You are within your budget.";
    }

    const percentageElement =
        document.getElementById("budgetPercentage");
    const progressBar =
        document.getElementById("budgetProgressBar");

    if (percentageElement && progressBar) {
        const percentage = monthlyBudget > 0
            ? (monthlyExpenses / monthlyBudget) * 100
            : 0;

        percentageElement.textContent = Math.round(percentage) + "%";
        progressBar.style.width =
            Math.min(100, Math.max(0, percentage)) + "%";

        progressBar.classList.remove("near-limit", "over-limit");

        if (monthlyBudget > 0 && percentage >= 100) {
            progressBar.classList.add("over-limit");
        } else if (monthlyBudget > 0 && percentage >= 80) {
            progressBar.classList.add("near-limit");
        }
    }
}

// SEARCH AND FILTERS
document.getElementById("searchInput")
    .addEventListener("input", displayTransactions);
document.getElementById("categoryFilter")
    .addEventListener("change", displayTransactions);
document.getElementById("typeFilter")
    .addEventListener("change", displayTransactions);

// LOAD DATABASE DATA WHEN PAGE OPENS
loadData();

function exportToCSV() {
    if (!transactions || transactions.length === 0) {
        alert("No transactions to export!");
        return;
    }

    const headers = [
        "Description",
        "Amount",
        "Type",
        "Category",
        "Date"
    ];

    const rows = transactions.map(t => [
        t.description,
        t.amount,
        t.type,
        t.category,
        t.date
    ]);

    const csvContent = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value ?? "").replace(/"/g, '""')}"`
            ).join(",")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "expense-tracker.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}