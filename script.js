class FinTrackApp {
  constructor() {
    this.transactions = [];
    this.currentTab = 'balances';
    this.selectedType = 'income';
    this.selectedCategory = 'salary';
    this.editingId = null;
    this.editType = 'income';
    this.editCategory = 'salary';
    this.filterTypeVal = 'all';
    this.searchQuery = '';
    this.period = 'all';
    this.savingsGoal = 10000;
    this.monthlyBudget = 2000;
    this.toastTimer = null;
    this.chart = null;
    this.privacyMode = localStorage.getItem('fintrack_privacy') === '1';
    this.lastDeleted = null;
    this._confirmResolve = null;
    this.profiles = [];
    this.currentProfile = 'me';

    this.categories = {
      income: [
        { id: 'salary', icon: '💼', name: 'Salary' },
        { id: 'allowance', icon: '🪙', name: 'Allowance' },
        { id: 'other-in', icon: '💵', name: 'Others' }
      ],
      expense: [
        { id: 'food', icon: '🍔', name: 'Food' },
        { id: 'transport', icon: '🚗', name: 'Transport' },
        { id: 'shopping', icon: '🛍️', name: 'Shopping' },
        { id: 'entertainment', icon: '🎬', name: 'Fun' },
        { id: 'health', icon: '💊', name: 'Health' },
        { id: 'education', icon: '📚', name: 'Edu' },
        { id: 'other-ex', icon: '💸', name: 'Others' }
      ]
    };

    this.loadProfiles();
    this.loadData();
    this.init();
  }

  init() {
    this.applyThemeFromStorage();
    this.updateThemeButton();
    this.updateProfileButton();
    this.applyPrivacy();
    this.renderCategories();
    this.fillGoalInputs();
    this.setupEventListeners();
    this.registerChartZoom();
    this.updateUI();
  }

  registerChartZoom() {
    const zoomPlugin = window.ChartZoom || window['chartjs-plugin-zoom'];
    if (window.Chart && zoomPlugin && !this._zoomRegistered) {
      Chart.register(zoomPlugin);
      this._zoomRegistered = true;
    }
  }

  setupEventListeners() {
    let touchStartX = 0;
    const tabs = ['balances', 'add', 'logs', 'summary'];

    document.addEventListener('touchstart', e => {
      if (e.changedTouches && e.changedTouches[0]) touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      const idx = tabs.indexOf(this.currentTab);
      if (Math.abs(diff) > 80) {
        if (diff > 0 && idx < tabs.length - 1) this.switchTab(tabs[idx + 1]);
        if (diff < 0 && idx > 0) this.switchTab(tabs[idx - 1]);
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (this.currentTab === 'summary') this.updateUI();
    });
  }

  /* ---------------- Profiles ---------------- */

  loadProfiles() {
    let profiles = null;
    try {
      const saved = localStorage.getItem('fintrack_profiles');
      if (saved) profiles = JSON.parse(saved);
    } catch {
      profiles = null;
    }
    if (!Array.isArray(profiles) || !profiles.length) {
      profiles = [
        { id: 'me', name: 'Me', emoji: '🧑' },
        { id: 'sister', name: 'Sister', emoji: '👧' }
      ];
      localStorage.setItem('fintrack_profiles', JSON.stringify(profiles));
    }
    this.profiles = profiles;
    this.currentProfile = localStorage.getItem('fintrack_active_profile') || profiles[0].id;
    if (!this.profiles.find(p => p.id === this.currentProfile)) {
      this.currentProfile = this.profiles[0].id;
    }
  }

  getProfileById(id) {
    return this.profiles.find(p => p.id === id);
  }

  updateProfileButton() {
    const p = this.getProfileById(this.currentProfile) || this.profiles[0];
    const emojiEl = document.getElementById('profileEmoji');
    const nameEl = document.getElementById('profileName');
    if (emojiEl) emojiEl.textContent = p.emoji;
    if (nameEl) nameEl.textContent = p.name;
  }

  openProfileModal() {
    this.renderProfileList();
    document.getElementById('profileModal')?.classList.add('active');
  }

  closeProfileModal(e) {
    if (!e || e.target === document.getElementById('profileModal')) {
      document.getElementById('profileModal')?.classList.remove('active');
    }
  }

  renderProfileList() {
    const container = document.getElementById('profileList');
    if (!container) return;
    container.innerHTML = this.profiles.map(p => `
      <div class="profile-row ${p.id === this.currentProfile ? 'active' : ''}" onclick="app.switchProfile('${p.id}')">
        <div class="profile-row-info">
          <span class="profile-row-emoji">${p.emoji}</span>
          <span class="profile-row-name">${this.escapeHtml(p.name)}</span>
          ${p.id === this.currentProfile ? '<span class="profile-badge">Active</span>' : ''}
        </div>
        ${p.id !== this.currentProfile && this.profiles.length > 1 ? `<button class="profile-delete-btn" onclick="app.deleteProfile('${p.id}', event)">✕</button>` : ''}
      </div>
    `).join('');
  }

  switchProfile(id) {
    if (id === this.currentProfile) {
      this.closeProfileModal();
      return;
    }
    this.currentProfile = id;
    localStorage.setItem('fintrack_active_profile', id);
    this.loadData();
    this.fillGoalInputs();
    this.updateProfileButton();
    this.closeProfileModal();
    this.switchTab('balances');
    this.showToast(`Switched to ${this.getProfileById(id).name}`);
    this.vibrate();
  }

  addProfile() {
    const input = document.getElementById('newProfileName');
    const name = (input?.value || '').trim();
    if (!name) return this.showToast('Enter a profile name', 'error');
    if (this.profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return this.showToast('Profile already exists', 'error');
    }
    const emojis = ['🧑', '👧', '🧔', '👩', '🧑‍🎓', '👦', '🧑‍💼', '👨'];
    const id = 'p_' + Date.now().toString(36);
    const profile = { id, name, emoji: emojis[this.profiles.length % emojis.length] };
    this.profiles.push(profile);
    localStorage.setItem('fintrack_profiles', JSON.stringify(this.profiles));
    input.value = '';
    this.renderProfileList();
    this.showToast(`Profile "${name}" added`);
  }

  async deleteProfile(id, event) {
    if (event) event.stopPropagation();
    if (id === this.currentProfile) return;
    const profile = this.getProfileById(id);
    if (!profile) return;
    const ok = await this.showConfirm(
      'Delete profile?',
      `This will permanently delete all data for "${profile.name}". This cannot be undone.`,
      'Delete'
    );
    if (!ok) return;
    this.profiles = this.profiles.filter(p => p.id !== id);
    localStorage.setItem('fintrack_profiles', JSON.stringify(this.profiles));
    localStorage.removeItem(`fintrack_data_${id}`);
    this.renderProfileList();
    this.showToast('Profile deleted');
  }

  /* ---------------- Data ---------------- */

  dataKey() {
    return `fintrack_data_${this.currentProfile}`;
  }

  loadData() {
    let saved = localStorage.getItem(this.dataKey());
    if (!saved && this.currentProfile === 'me') {
      const legacy = localStorage.getItem('fintrack_data');
      if (legacy) {
        saved = legacy;
        localStorage.setItem(this.dataKey(), legacy);
      }
    }
    this.transactions = [];
    this.savingsGoal = 10000;
    this.monthlyBudget = 2000;
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.transactions = Array.isArray(data.transactions) ? data.transactions : [];
        this.savingsGoal = Number(data.savingsGoal) || 10000;
        this.monthlyBudget = Number(data.monthlyBudget) || 2000;
      } catch {
        this.transactions = [];
      }
    }
  }

  saveData() {
    localStorage.setItem(this.dataKey(), JSON.stringify({
      transactions: this.transactions,
      savingsGoal: this.savingsGoal,
      monthlyBudget: this.monthlyBudget,
      exportDate: new Date().toISOString(),
      version: '2.2'
    }));
  }

  applyThemeFromStorage() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  }

  updateThemeButton() {
    document.getElementById('themeBtn').textContent =
      document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
  }

  fillGoalInputs() {
    document.getElementById('budgetInput').value = this.monthlyBudget || '';
    document.getElementById('goalInput').value = this.savingsGoal || '';
  }

  saveGoals() {
    const budget = Number(document.getElementById('budgetInput').value);
    const goal = Number(document.getElementById('goalInput').value);
    if (Number.isFinite(budget) && budget >= 0) this.monthlyBudget = budget;
    if (Number.isFinite(goal) && goal >= 0) this.savingsGoal = goal;
    this.saveData();
    this.updateUI();
    this.showToast('Goals saved!');
  }

  /* ---------------- Navigation ---------------- */

  switchTab(tab) {
    this.currentTab = tab;
    const tabs = ['balances', 'add', 'logs', 'summary'];
    document.querySelectorAll('.nav-item').forEach((el, idx) => el.classList.toggle('active', tabs[idx] === tab));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    this.updateUI();
  }

  /* ---------------- Add transaction ---------------- */

  selectType(type) {
    this.selectedType = type;
    this.selectedCategory = this.categories[type][0]?.id || '';
    document.getElementById('type-income')?.classList.toggle('selected', type === 'income');
    document.getElementById('type-expense')?.classList.toggle('selected', type === 'expense');
    document.getElementById('savingsGroup').style.display = type === 'income' ? 'block' : 'none';
    this.renderCategories();
  }

  renderCategories() {
    const grid = document.getElementById('categoryGrid');
    const cats = this.categories[this.selectedType] || [];
    grid.innerHTML = cats.map(cat => `
      <div class="category-item ${cat.id === this.selectedCategory ? 'selected' : ''}" onclick="app.selectCategory('${cat.id}')">
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

    if (!amount || amount <= 0) return this.showToast('Please enter a valid amount', 'error');

    this.transactions.unshift({
      id: Date.now().toString(),
      type: this.selectedType,
      amount,
      description: desc || '',
      category: this.selectedCategory,
      date: new Date().toISOString(),
      isSavings: this.selectedType === 'income' && isSavings
    });

    this.saveData();
    document.getElementById('amountInput').value = '';
    document.getElementById('descInput').value = '';
    document.getElementById('savingsCheck').checked = false;
    this.showToast('Transaction added successfully!');
    this.vibrate();
    this.switchTab('balances');
  }

  /* ---------------- Filtering / stats ---------------- */

  getFilteredTransactions() {
    let txs = [...this.transactions];
    if (this.period === 'all') return txs;
    const now = new Date();
    return txs.filter(t => {
      const d = new Date(t.date);
      if (isNaN(d)) return false;
      if (this.period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (this.period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (this.period === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }

  getCurrentMonthExpense() {
    const now = new Date();
    return this.transactions
      .filter(t => t.type === 'expense')
      .filter(t => {
        const d = new Date(t.date);
        return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  updateUI() {
    // All-time totals (true running balance & savings, independent of the period filter)
    const allIncome = this.transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const allExpense = this.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const allSavings = this.transactions.filter(t => t.isSavings).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const balance = allIncome - allExpense;

    document.getElementById('totalBalance').textContent = this.formatMoney(balance);
    document.getElementById('totalSavings').textContent = this.formatMoney(allSavings);

    // Period-scoped stats (respects the This Week/Month/Year quick filter)
    const periodTxs = this.getFilteredTransactions();
    const periodIncome = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const periodExpense = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

    document.getElementById('periodIncome').textContent = `+${this.formatMoney(periodIncome)}`;
    document.getElementById('periodExpense').textContent = `-${this.formatMoney(periodExpense)}`;

    const periodLabels = { all: 'All Time', week: 'This Week', month: 'This Month', year: 'This Year' };
    document.getElementById('periodLabelIncome').textContent = periodLabels[this.period] || 'All Time';
    document.getElementById('periodLabelExpense').textContent = periodLabels[this.period] || 'All Time';

    // Monthly budget always tracks the current calendar month, regardless of the quick filter
    const monthExpense = this.getCurrentMonthExpense();
    const budgetPct = this.monthlyBudget > 0 ? Math.min((monthExpense / this.monthlyBudget) * 100, 100) : 0;
    document.getElementById('budgetBar').style.width = `${budgetPct}%`;
    document.getElementById('budgetText').textContent = `${this.formatMoney(monthExpense)} / ${this.formatMoney(this.monthlyBudget)}`;

    // Savings goal is always cumulative (all time)
    const goalPct = this.savingsGoal > 0 ? Math.min((allSavings / this.savingsGoal) * 100, 100) : 0;
    document.getElementById('goalBar').style.width = `${goalPct}%`;
    document.getElementById('goalPercent').textContent = `${goalPct.toFixed(1)}%`;
    document.getElementById('goalCurrent').textContent = this.formatMoney(allSavings);
    document.getElementById('goalTarget').textContent = this.formatMoney(this.savingsGoal);

    this.renderLogs();
    this.renderSummary(periodTxs, periodIncome, periodExpense);
  }

  renderLogs() {
    const container = document.getElementById('logsList');
    let txs = [...this.transactions];

    if (this.filterTypeVal !== 'all') txs = txs.filter(t => t.type === this.filterTypeVal);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      txs = txs.filter(t => (t.description || '').toLowerCase().includes(q) || this.getCategoryName(t.category).toLowerCase().includes(q));
    }

    if (txs.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>No transactions found</div></div>`;
      return;
    }

    container.innerHTML = txs.map(t => {
      const d = new Date(t.date);
      const dateStr = isNaN(d) ? 'Unknown date' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const cat = this.getCategoryById(t.type, t.category);

      return `
        <div class="log-item ${t.type}" onclick="app.openEditModal('${t.id}')">
          <div class="log-icon">${cat.icon}</div>
          <div class="log-details">
            <div class="log-title">${this.escapeHtml(t.description || 'Transaction')}</div>
            <div class="log-meta">
              <span>${cat.name}</span>
              <span>•</span>
              <span>${dateStr}${timeStr ? `, ${timeStr}` : ''}</span>
              ${t.isSavings ? '<span>•</span><span>Savings</span>' : ''}
            </div>
          </div>
          <div class="log-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}</div>
        </div>
      `;
    }).join('');
  }

  renderSummary(txs, income, expense) {
    const net = income - expense;
    document.getElementById('netFlow').textContent = `${net >= 0 ? '+' : ''}${this.formatMoney(net)}`;
    document.getElementById('flowInsight').textContent =
      net > 0 && income > 0 ? `You're saving ${((net / income) * 100).toFixed(0)}% of your income. Great job! 🎉`
      : net < 0 ? 'Expenses exceed income. Consider reviewing your budget. ⚠️'
      : 'Breaking even. Look for savings opportunities.';
    this.renderCategoryBreakdown(txs);
    this.renderChart(txs);
  }

  renderCategoryBreakdown(txs) {
    const expensesByCat = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category || 'other-ex';
      expensesByCat[key] = (expensesByCat[key] || 0) + (Number(t.amount) || 0);
    });

    const totalExp = Object.values(expensesByCat).reduce((a, b) => a + b, 0);
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6'];

    document.getElementById('categoryBreakdown').innerHTML =
      Object.entries(expensesByCat).sort((a, b) => b[1] - a[1]).map(([catId, amount], idx) => {
        const cat = this.categories.expense.find(c => c.id === catId) || { name: 'Others', icon: '💸' };
        const pct = totalExp > 0 ? (amount / totalExp * 100).toFixed(1) : '0.0';
        return `
          <div class="category-bar">
            <div class="category-info">
              <span>${cat.icon} ${cat.name}</span>
              <span>${this.formatMoney(amount)} (${pct}%)</span>
            </div>
            <div class="category-track">
              <div class="category-fill" style="width:${pct}%; background:${colors[idx % colors.length]};"></div>
            </div>
          </div>
        `;
      }).join('') || '<div style="text-align:center; color: var(--text-muted); padding:20px;">No expense data</div>';
  }

  /* ---------------- Chart ---------------- */

  renderChart(txs) {
    if (!window.Chart) return;
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    this.registerChartZoom();

    const grouped = {};
    txs.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income: 0, expense: 0 };
      grouped[key][t.type] += Number(t.amount) || 0;
    });

    const keys = Object.keys(grouped).sort();
    const labels = keys.map(k => grouped[k].label);
    const incomes = keys.map(k => grouped[k].income);
    const expenses = keys.map(k => grouped[k].expense);
    const total = labels.length;

    const maxVal = Math.max(...incomes, ...expenses, 1);
    const step = this.getNiceStep(maxVal);
    const maxTick = Math.ceil(maxVal / step) * step;

    if (this.chart) this.chart.destroy();

    const zoomPlugin = window.ChartZoom || window['chartjs-plugin-zoom'];
    const zoomAvailable = !!zoomPlugin;

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomes,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Expense',
            data: expenses,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          zoom: zoomAvailable ? {
            limits: {
              x: { min: 0, max: Math.max(total - 1, 0), minRange: Math.min(2, Math.max(total - 1, 1)) }
            },
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x'
            }
          } : undefined
        },
        scales: {
          x: {
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') },
            grid: { color: getComputedStyle(document.body).getPropertyValue('--border-glass') }
          },
          y: {
            beginAtZero: true,
            suggestedMax: maxTick,
            ticks: {
              stepSize: step,
              color: getComputedStyle(document.body).getPropertyValue('--text-muted'),
              callback: value => `₱${Math.abs(value)}`
            },
            grid: { color: getComputedStyle(document.body).getPropertyValue('--border-glass') }
          }
        }
      }
    });

    // If there's more history than fits comfortably, open on the most recent
    // window and let the person pan/swipe left to see older data.
    const VISIBLE_POINTS = 8;
    if (zoomAvailable && total > VISIBLE_POINTS) {
      try {
        this.chart.zoomScale('x', { min: total - VISIBLE_POINTS, max: total - 1 }, 'none');
      } catch {
        /* zoomScale not available on this scale type — ignore */
      }
    }
  }

  resetChartView() {
    if (this.chart) this.chart.resetZoom();
  }

  zoomChart(factor) {
    if (this.chart && typeof this.chart.zoom === 'function') this.chart.zoom(factor);
  }

  getNiceStep(maxVal) {
    const rough = Math.max(maxVal / 4, 1);
    const power = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / power;
    if (n <= 1) return 1 * power;
    if (n <= 2) return 2 * power;
    if (n <= 5) return 5 * power;
    return 10 * power;
  }

  /* ---------------- Edit / delete transaction ---------------- */

  openEditModal(id) {
    const t = this.transactions.find(x => x.id === id);
    if (!t) return;

    this.editingId = id;
    this.editType = t.type;
    this.editCategory = t.category;

    document.getElementById('editAmount').value = Number(t.amount) || 0;
    document.getElementById('editDesc').value = t.description || '';
    document.getElementById('editSavingsCheck').checked = !!t.isSavings;
    document.getElementById('editSavingsGroup').style.display = t.type === 'income' ? 'block' : 'none';

    const date = new Date(t.date);
    if (!isNaN(date)) {
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      document.getElementById('editDate').value = local.toISOString().slice(0, 16);
    } else {
      document.getElementById('editDate').value = '';
    }

    document.getElementById('edit-type-income')?.classList.toggle('selected', t.type === 'income');
    document.getElementById('edit-type-expense')?.classList.toggle('selected', t.type === 'expense');
    this.renderEditCategories();
    document.getElementById('editModal')?.classList.add('active');
  }

  closeModal(e) {
    if (!e || e.target === document.getElementById('editModal')) {
      document.getElementById('editModal')?.classList.remove('active');
      this.editingId = null;
    }
  }

  editSelectType(type) {
    this.editType = type;
    this.editCategory = this.categories[type][0]?.id || '';
    document.getElementById('edit-type-income')?.classList.toggle('selected', type === 'income');
    document.getElementById('edit-type-expense')?.classList.toggle('selected', type === 'expense');
    document.getElementById('editSavingsGroup').style.display = type === 'income' ? 'block' : 'none';
    if (type === 'expense') document.getElementById('editSavingsCheck').checked = false;
    this.renderEditCategories();
  }

  renderEditCategories() {
    const grid = document.getElementById('editCategoryGrid');
    if (!grid) return;
    const cats = this.categories[this.editType] || [];
    grid.innerHTML = cats.map(cat => `
      <div class="category-item ${cat.id === this.editCategory ? 'selected' : ''}" onclick="app.editSelectCategory('${cat.id}')">
        <span class="cat-icon">${cat.icon}</span>
        <span>${cat.name}</span>
      </div>
    `).join('');
  }

  editSelectCategory(id) {
    this.editCategory = id;
    this.renderEditCategories();
  }

  saveEdit() {
    const t = this.transactions.find(x => x.id === this.editingId);
    if (!t) return;

    const amount = parseFloat(document.getElementById('editAmount').value);
    const desc = document.getElementById('editDesc').value.trim();
    const dateVal = document.getElementById('editDate').value;

    if (!amount || amount <= 0) return this.showToast('Please enter a valid amount', 'error');
    if (!dateVal || isNaN(new Date(dateVal))) return this.showToast('Please enter a valid date', 'error');

    t.type = this.editType;
    t.amount = amount;
    t.description = desc || '';
    t.date = new Date(dateVal).toISOString();
    t.category = this.editCategory;
    t.isSavings = t.type === 'income' && document.getElementById('editSavingsCheck').checked;

    this.saveData();
    this.closeModal();
    this.showToast('Transaction updated!');
    this.updateUI();
  }

  async deleteTransaction() {
    const ok = await this.showConfirm('Delete transaction?', 'You can undo this right after if it was a mistake.', 'Delete');
    if (!ok) return;

    const idx = this.transactions.findIndex(t => t.id === this.editingId);
    if (idx === -1) return;

    this.lastDeleted = { tx: this.transactions[idx], index: idx };
    this.transactions.splice(idx, 1);
    this.saveData();
    this.closeModal();
    this.vibrate();
    this.showToast('Transaction deleted', 'success', {
      label: 'Undo',
      onClick: () => this.undoDelete()
    });
    this.updateUI();
  }

  undoDelete() {
    if (!this.lastDeleted) return;
    this.transactions.splice(this.lastDeleted.index, 0, this.lastDeleted.tx);
    this.lastDeleted = null;
    this.saveData();
    this.updateUI();
    this.showToast('Transaction restored');
  }

  /* ---------------- Logs filters ---------------- */

  filterLogs() {
    this.searchQuery = document.getElementById('searchInput').value.trim();
    this.renderLogs();
  }

  filterType(type) {
    this.filterTypeVal = type;
    document.querySelectorAll('.filter-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === type);
    });
    this.renderLogs();
  }

  setPeriod(period) {
    this.period = period;
    document.querySelectorAll('.quick-action-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.period === period);
    });
    this.updateUI();
  }

  /* ---------------- Backup: export / import ---------------- */

  async exportData() {
    const payload = {
      transactions: this.transactions,
      savingsGoal: this.savingsGoal,
      monthlyBudget: this.monthlyBudget,
      exportDate: new Date().toISOString(),
      version: '2.2',
      profile: this.currentProfile
    };
    const profileName = (this.getProfileById(this.currentProfile) || { name: 'backup' }).name
      .toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `fintrack_${profileName}_${new Date().toISOString().split('T')[0]}.json`;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // On mobile, hand the file to the OS share sheet so it can be saved to
    // Files, Drive, WPS, or any other app the person has installed.
    try {
      if (navigator.canShare && window.File) {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'FinTrack Backup', text: 'FinTrack Pro backup' });
          this.showToast('Backup shared!');
          return;
        }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // person cancelled the share sheet
      // fall through to download fallback below
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Backup downloaded!');
  }

  importData() {
    document.getElementById('importFile')?.click();
  }

  handleImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.transactions)) return this.showToast('Invalid backup file', 'error');

        const ok = await this.showConfirm(
          'Import backup?',
          `Import ${data.transactions.length} transaction(s) into "${this.getProfileById(this.currentProfile).name}"? This merges with your existing data.`,
          'Import'
        );
        if (!ok) return;

        const existingIds = new Set(this.transactions.map(t => t.id));
        const incoming = data.transactions.filter(t => t && t.id && !existingIds.has(t.id));
        this.transactions = [...incoming, ...this.transactions];

        if (data.savingsGoal !== undefined) this.savingsGoal = Number(data.savingsGoal) || this.savingsGoal;
        if (data.monthlyBudget !== undefined) this.monthlyBudget = Number(data.monthlyBudget) || this.monthlyBudget;

        this.saveData();
        this.fillGoalInputs();
        this.updateUI();
        this.showToast('Backup imported successfully!');
      } catch {
        this.showToast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  /* ---------------- Theme / privacy ---------------- */

  toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
    this.updateThemeButton();
    this.updateUI();
  }

  togglePrivacy() {
    this.privacyMode = !this.privacyMode;
    localStorage.setItem('fintrack_privacy', this.privacyMode ? '1' : '0');
    this.applyPrivacy();
  }

  applyPrivacy() {
    document.body.classList.toggle('privacy-mode', this.privacyMode);
    const btn = document.getElementById('privacyBtn');
    if (btn) btn.textContent = this.privacyMode ? '🙈' : '👁️';
  }

  /* ---------------- Confirm modal (replaces window.confirm) ---------------- */

  showConfirm(title, message, confirmText = 'Confirm') {
    return new Promise(resolve => {
      this._confirmResolve = resolve;
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      document.getElementById('confirmBtn').textContent = confirmText;
      document.getElementById('confirmModal')?.classList.add('active');
    });
  }

  confirmYes() {
    const resolve = this._confirmResolve;
    this._confirmResolve = null;
    document.getElementById('confirmModal')?.classList.remove('active');
    if (resolve) resolve(true);
  }

  confirmNo() {
    const resolve = this._confirmResolve;
    this._confirmResolve = null;
    document.getElementById('confirmModal')?.classList.remove('active');
    if (resolve) resolve(false);
  }

  closeConfirm(e) {
    if (!e || e.target === document.getElementById('confirmModal')) this.confirmNo();
  }

  /* ---------------- Helpers ---------------- */

  getCategoryName(id) {
    const all = [...this.categories.income, ...this.categories.expense];
    return (all.find(c => c.id === id) || { name: 'Others' }).name;
  }

  getCategoryById(type, id) {
    return (this.categories[type] || []).find(c => c.id === id) || { icon: '💵', name: 'Others' };
  }

  formatMoney(amount) {
    return '₱' + (Math.abs(Number(amount) || 0)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  vibrate(ms = 12) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch { /* ignore */ }
    }
  }

  showToast(message, type = 'success', action = null) {
    const toast = document.getElementById('toast');
    const container = document.getElementById('toastContainer');
    if (!toast || !container) return;

    if (this.toastTimer) clearTimeout(this.toastTimer);
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${this.escapeHtml(message)}</span>` +
      (action ? `<button class="toast-action" id="toastActionBtn">${this.escapeHtml(action.label)}</button>` : '');

    if (action) {
      const btn = document.getElementById('toastActionBtn');
      if (btn) btn.onclick = () => {
        action.onClick();
        container.classList.remove('show');
        clearTimeout(this.toastTimer);
      };
    }

    container.classList.add('show');

    this.toastTimer = setTimeout(() => {
      container.classList.remove('show');
    }, action ? 4000 : 2500);
  }
}

const app = new FinTrackApp();
