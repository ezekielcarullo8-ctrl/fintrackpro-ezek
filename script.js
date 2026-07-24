class FinTrackApp {
    constructor() {
        this.transactions = [];
        this.currentTab = 'balances';
        this.selectedType = 'income';
        this.selectedCategory = 'salary';
        this.editingId = null;
        this.filterTypeVal = 'all';
        this.searchQuery = '';
        this.period = 'all';
        this.savingsGoal = 10000;
        this.monthlyBudget = 2000;

        this.categories = {
            income: [
                { id: 'salary', icon: '💼', name: 'Salary' },
                { id: 'freelance', icon: '💻', name: 'Freelance' },
                { id: 'investment', icon: '📈', name: 'Invest' },
                { id: 'gift', icon: '🎁', name: 'Gift' },
                { id: 'refund', icon: '↩️', name: 'Refund' },
                { id: 'other-in', icon: '💵', name: 'Other' },
                { id: 'savings', icon: '🏦', name: 'Savings' },
                { id: 'bonus', icon: '🎯', name: 'Bonus' }
            ],
            expense: [
                { id: 'food', icon: '🍔', name: 'Food' },
                { id: 'transport', icon: '🚗', name: 'Transport' },
                { id: 'shopping', icon: '🛍️', name: 'Shopping' },
                { id: 'bills', icon: '💡', name: 'Bills' },
                { id: 'entertainment', icon: '🎬', name: 'Fun' },
                { id: 'health', icon: '💊', name: 'Health' },
                { id: 'education', icon: '📚', name: 'Edu' },
                { id: 'other-ex', icon: '💸', name: 'Other' }
            ]
        };

        this.loadData();
        this.init();
    }

    init() {
        this.renderCategories();
        this.updateUI();
        this.setupEventListeners();

        // Check theme
        if (localStorage.getItem('theme') === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }

        // Setup import button listener
        document.getElementById('importFile').addEventListener('change', () => {
            this.handleImport(document.getElementById('importFile'));
        });
    }

    setupEventListeners() {
        // Swipe detection for tab switching
        let touchStartX = 0;
        let touchEndX = 0;
        const tabs = ['balances', 'add', 'logs', 'summary'];

        document.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            const currentIdx = tabs.indexOf(this.currentTab);

            if (Math.abs(diff) > 80) {
                if (diff > 0 && currentIdx < tabs.length - 1) {
                    this.switchTab(tabs[currentIdx + 1]);
                } else if (diff < 0 && currentIdx > 0) {
                    this.switchTab(tabs[currentIdx - 1]);
                }
            }
        }, { passive: true });
    }

    loadData() {
        const saved = localStorage.getItem('fintrack_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.transactions = data.transactions || [];
            this.savingsGoal = data.savingsGoal || 10000;
            this.monthlyBudget = data.monthlyBudget || 2000;
        }
    }

    saveData() {
        const data = {
            transactions: this.transactions,
            savingsGoal: this.savingsGoal,
            monthlyBudget: this.monthlyBudget,
            exportDate: new Date().toISOString()
        };
        localStorage.setItem('fintrack_data', JSON.stringify(data));
    }

    switchTab(tab) {
        this.currentTab = tab;
        // Update nav
        document.querySelectorAll('.nav-item').forEach((el, idx) => {
            const tabs = ['balances', 'add', 'logs', 'summary'];
            el.classList.toggle('active', tabs[idx] === tab);
        });
        // Update content
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(`tab-${tab}`).classList.add('active');

        this.updateUI();
    }

    selectType(type) {
        this.selectedType = type;
        this.selectedCategory = type === 'income' ? 'salary' : 'food';

        document.getElementById('type-income').classList.toggle('selected', type === 'income');
        document.getElementById('type-expense').classList.toggle('selected', type === 'expense');
        document.getElementById('type-expense').classList.toggle('expense-type', type === 'expense');

        // Toggle savings checkbox visibility
        document.getElementById('savingsGroup').style.display = type === 'income' ? 'block' : 'none';

        // Description required for expense
        const descLabel = document.querySelector('#descGroup .form-label');
        if (type === 'expense') {
            descLabel.innerHTML = 'Description <span style="color: var(--accent-expense);">*</span>';
        } else {
            descLabel.innerHTML = 'Description <span style="color: var(--text-muted); font-weight: 400;">(Optional)</span>';
        }

        this.renderCategories();
    }

    renderCategories() {
        const grid = document.getElementById('categoryGrid');
        const cats = this.categories[this.selectedType];

        grid.innerHTML = cats.map(cat => `
            <div class="category-item ${cat.id === this.selectedCategory ? 'selected' : ''}" 
                 onclick="app.selectCategory('${cat.id}')">
                <span class="cat-icon">${cat.icon}</span>
                <span>${cat.name}</span>
            </div>
        `).join('');
    }

    selectCategory(id) {
        this.selectedCategory = id;
        this.renderCategories();
    }

    submitTransaction() {
        const amount = parseFloat(document.getElementById('amountInput').value);
        const desc = document.getElementById('descInput').value.trim();
        const isSavings = document.getElementById('savingsCheck').checked;

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        if (this.selectedType === 'expense' && !desc) {
            this.showToast('Description is required for expenses', 'error');
            return;
        }

        const transaction = {
            id: Date.now().toString(),
            type: this.selectedType,
            amount: amount,
            description: desc || (this.selectedType === 'income' ? 'Income' : 'Expense'),
            category: this.selectedCategory,
            date: new Date().toISOString(),
            isSavings: this.selectedType === 'income' && isSavings
        };

        this.transactions.unshift(transaction);
        this.saveData();

        // Reset form
        document.getElementById('amountInput').value = '';
        document.getElementById('descInput').value = '';
        document.getElementById('savingsCheck').checked = false;

        this.showToast('Transaction added successfully!');
        this.switchTab('balances');
    }

    getFilteredTransactions() {
        let txs = [...this.transactions];

        if (this.period !== 'all') {
            const now = new Date();
            txs = txs.filter(t => {
                const tDate = new Date(t.date);
                if (this.period === 'week') {
                    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    return tDate >= weekAgo;
                } else if (this.period === 'month') {
                    return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
                } else if (this.period === 'year') {
                    return tDate.getFullYear() === now.getFullYear();
                }
            });
        }

        return txs;
    }

    updateUI() {
        const txs = this.getFilteredTransactions();

        // Calculate totals
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const savings = txs.filter(t => t.isSavings).reduce((s, t) => s + t.amount, 0);
        const balance = income - expense;

        // Update balances tab
        document.getElementById('totalBalance').textContent = this.formatMoney(balance);
        document.getElementById('totalSavings').textContent = this.formatMoney(savings);
        document.getElementById('monthIncome').textContent = `+${this.formatMoney(income)}`;
        document.getElementById('monthExpense').textContent = `-${this.formatMoney(expense)}`;

        // Budget bar
        const budgetPct = Math.min((expense / this.monthlyBudget) * 100, 100);
        document.getElementById('budgetBar').style.width = `${budgetPct}%`;
        document.getElementById('budgetText').textContent = `${this.formatMoney(expense)} / ${this.formatMoney(this.monthlyBudget)}`;

        if (budgetPct > 90) {
            document.getElementById('budgetBar').style.background = 'linear-gradient(90deg, var(--accent-expense), #dc2626)';
        } else {
            document.getElementById('budgetBar').style.background = 'linear-gradient(90deg, var(--accent-income), var(--accent-gold))';
        }

        // Savings goal
        const goalPct = Math.min((savings / this.savingsGoal) * 100, 100);
        document.getElementById('goalBar').style.width = `${goalPct}%`;
        document.getElementById('goalPercent').textContent = `${goalPct.toFixed(1)}%`;
        document.getElementById('goalCurrent').textContent = this.formatMoney(savings);
        document.getElementById('goalTarget').textContent = this.formatMoney(this.savingsGoal);

        // Update logs
        this.renderLogs();

        // Update summary
        this.renderSummary(txs, income, expense);
    }

    renderLogs() {
        const container = document.getElementById('logsList');
        let txs = [...this.transactions];

        // Apply type filter
        if (this.filterTypeVal !== 'all') {
            txs = txs.filter(t => t.type === this.filterTypeVal);
        }

        // Apply search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            txs = txs.filter(t => 
                t.description.toLowerCase().includes(q) ||
                this.getCategoryName(t.category).toLowerCase().includes(q)
            );
        }

        if (txs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div>No transactions found</div>
                </div>
            `;
            return;
        }

        container.innerHTML = txs.map(t => {
            const date = new Date(t.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const cat = this.categories[t.type].find(c => c.id === t.category) || { icon: '💵', name: 'Other' };

            return `
                <div class="log-item ${t.type}" onclick="app.openEditModal('${t.id}')">
                    <div class="log-icon">${cat.icon}</div>
                    <div class="log-details">
                        <div class="log-title">${t.description}</div>
                        <div class="log-meta">
                            <span>${cat.name}</span>
                            <span>•</span>
                            <span>${dateStr}, ${timeStr}</span>
                        </div>
                    </div>
                    <div class="log-amount ${t.type}">
                        ${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSummary(txs, income, expense) {
        const net = income - expense;
        document.getElementById('netFlow').textContent = `${net >= 0 ? '+' : ''}${this.formatMoney(net)}`;

        let insight = '';
        if (net > 0) {
            insight = `You're saving ${((net/income)*100).toFixed(0)}% of your income. Great job! 🎉`;
        } else if (net < 0) {
            insight = 'Expenses exceed income. Consider reviewing your budget. ⚠️';
        } else {
            insight = 'Breaking even. Look for savings opportunities.';
        }
        document.getElementById('flowInsight').textContent = insight;

        // Draw chart
        this.drawChart(txs);

        // Category breakdown
        const expensesByCat = {};
        txs.filter(t => t.type === 'expense').forEach(t => {
            expensesByCat[t.category] = (expensesByCat[t.category] || 0) + t.amount;
        });

        const totalExp = Object.values(expensesByCat).reduce((a, b) => a + b, 0);
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'];

        const breakdownHtml = Object.entries(expensesByCat)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, amount], idx) => {
                const cat = this.categories.expense.find(c => c.id === catId) || { name: 'Other', icon: '💸' };
                const pct = (amount / totalExp * 100).toFixed(1);
                return `
                    <div class="category-bar">
                        <div class="category-info">
                            <span>${cat.icon} ${cat.name}</span>
                            <span>${this.formatMoney(amount)} (${pct}%)</span>
                        </div>
                        <div class="category-track">
                            <div class="category-fill" style="width: ${pct}%; background: ${colors[idx % colors.length]};"></div>
                        </div>
                    </div>
                `;
            }).join('');

        document.getElementById('categoryBreakdown').innerHTML = breakdownHtml || '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No expense data</div>';
    }

    drawChart(txs) {
        const canvas = document.getElementById('trendChart');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 20, right: 20, bottom: 30, left: 50 };

        // Group by date
        const byDate = {};
        txs.forEach(t => {
            const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!byDate[d]) byDate[d] = { income: 0, expense: 0 };
            byDate[d][t.type] += t.amount;
        });

        const dates = Object.keys(byDate).slice(-7); // Last 7 days with data
        if (dates.length < 2) {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted');
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Add more transactions to see trends', width/2, height/2);
            return;
        }

        const incomes = dates.map(d => byDate[d].income);
        const expenses = dates.map(d => byDate[d].expense);
        const maxVal = Math.max(...incomes, ...expenses, 1);

        ctx.clearRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-glass');
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (height - padding.top - padding.bottom) * (i / 4);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y labels
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted');
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            const val = maxVal * (1 - i/4);
            ctx.fillText('$' + (val < 10 ? val.toFixed(2) : Math.round(val)), padding.left - 8, y + 4);
        }

        // Draw lines
        const drawLine = (data, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const xStep = (width - padding.left - padding.right) / (dates.length - 1);
            data.forEach((val, i) => {
                const x = padding.left + i * xStep;
                const y = padding.top + (height - padding.top - padding.bottom) * (1 - val / maxVal);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Fill area
            ctx.lineTo(padding.left + (data.length - 1) * xStep, height - padding.bottom);
            ctx.lineTo(padding.left, height - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = color + '20';
            ctx.fill();

            // Points
            ctx.fillStyle = color;
            data.forEach((val, i) => {
                const x = padding.left + i * xStep;
                const y = padding.top + (height - padding.top - padding.bottom) * (1 - val / maxVal);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        drawLine(incomes, '#10b981');
        drawLine(expenses, '#ef4444');

        // X labels
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted');
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        const xStep = (width - padding.left - padding.right) / (dates.length - 1);
        dates.forEach((d, i) => {
            const x = padding.left + i * xStep;
            ctx.fillText(d, x, height - 8);
        });
    }

    openEditModal(id) {
        const t = this.transactions.find(x => x.id === id);
        if (!t) return;

        this.editingId = id;
        document.getElementById('editAmount').value = t.amount;
        document.getElementById('editDesc').value = t.description;

        const date = new Date(t.date);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        document.getElementById('editDate').value = date.toISOString().slice(0, 16);

        this.editType = t.type;
        document.getElementById('edit-type-income').classList.toggle('selected', t.type === 'income');
        document.getElementById('edit-type-expense').classList.toggle('selected', t.type === 'expense');
        document.getElementById('edit-type-expense').classList.toggle('expense-type', t.type === 'expense');

        document.getElementById('editModal').classList.add('active');
    }

    closeModal(e) {
        if (!e || e.target === document.getElementById('editModal')) {
            document.getElementById('editModal').classList.remove('active');
            this.editingId = null;
        }
    }

    editSelectType(type) {
        this.editType = type;
        document.getElementById('edit-type-income').classList.toggle('selected', type === 'income');
        document.getElementById('edit-type-expense').classList.toggle('selected', type === 'expense');
        document.getElementById('edit-type-expense').classList.toggle('expense-type', type === 'expense');
    }

    saveEdit() {
        const t = this.transactions.find(x => x.id === this.editingId);
        if (!t) return;

        const amount = parseFloat(document.getElementById('editAmount').value);
        const desc = document.getElementById('editDesc').value.trim();
        const dateVal = document.getElementById('editDate').value;

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        t.type = this.editType;
        t.amount = amount;
        t.description = desc || 'Transaction';
        t.date = new Date(dateVal).toISOString();

        this.saveData();
        this.closeModal();
        this.showToast('Transaction updated!');
        this.updateUI();
    }

    deleteTransaction() {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        this.transactions = this.transactions.filter(t => t.id !== this.editingId);
        this.saveData();
        this.closeModal();
        this.showToast('Transaction deleted');
        this.updateUI();
    }

    filterLogs() {
        this.searchQuery = document.getElementById('searchInput').value;
        this.renderLogs();
    }

    filterType(type) {
        this.filterTypeVal = type;
        document.querySelectorAll('.filter-tab').forEach(el => {
            el.classList.toggle('active', 
                (type === 'all' && el.textContent === 'All') ||
                (type === 'income' && el.textContent === 'Income') ||
                (type === 'expense' && el.textContent === 'Expenses')
            );
        });
        this.renderLogs();
    }

    setPeriod(period) {
        this.period = period;
        document.querySelectorAll('.quick-action-btn').forEach(el => {
            el.classList.toggle('active', 
                (period === 'all' && el.textContent === 'All Time') ||
                (period === 'week' && el.textContent === 'This Week') ||
                (period === 'month' && el.textContent === 'This Month') ||
                (period === 'year' && el.textContent === 'This Year')
            );
        });
        this.updateUI();
    }

    // Improved export method
    exportData() {
        const data = {
            transactions: this.transactions,
            savingsGoal: this.savingsGoal,
            monthlyBudget: this.monthlyBudget,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = `fintrack_backup_${new Date().toISOString().split('T')[0]}.json`;

        // Create a temporary link element
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Backup exported!');
    }

    // Improved import method
    handleImport(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.transactions) {
                    if (confirm(`Import ${data.transactions.length} transactions? This will merge with existing data.`)) {
                        this.transactions = [...data.transactions, ...this.transactions];
                        if (data.savingsGoal) this.savingsGoal = data.savingsGoal;
                        if (data.monthlyBudget) this.monthlyBudget = data.monthlyBudget;
                        this.saveData();
                        this.updateUI();
                        this.showToast('Backup imported successfully!');
                    }
                }
            } catch (err) {
                this.showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    toggleTheme() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
            document.getElementById('themeBtn').textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            document.getElementById('themeBtn').textContent = '☀️';
        }
        this.updateUI(); // Redraw chart with new colors
    }

    getCategoryName(id) {
        const all = [...this.categories.income, ...this.categories.expense];
        const cat = all.find(c => c.id === id);
        return cat ? cat.name : 'Other';
    }

    formatMoney(amount) {
        return '₱' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const container = document.getElementById('toastContainer');

        toast.textContent = message;
        toast.className = `toast ${type}`;
        container.classList.add('show');

        setTimeout(() => {
            container.classList.remove('show');
        }, 2500);
    }
}

// Initialize app
const app = new FinTrackApp();

// Handle resize for chart
window.addEventListener('resize', () => {
    if (app.currentTab === 'summary') {
        app.updateUI();
    }
});