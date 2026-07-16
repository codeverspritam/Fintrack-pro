/* =========================================================================
   FinTrack Pro — Enterprise Edition — script.js
   Login gate -> sidebar dashboard/settings shell -> modal-based
   transaction entry -> table view -> cash flow chart. Same Local Storage
   persistence model as the card edition, restructured to match the
   enterprise layout (login, sidebar, modal, data table, settings page).
   ========================================================================= */

/* ---------------- Demo credentials ----------------
   This is a client-side demo gate only (no backend/auth server) —
   the credentials live in the page itself, matching the reference app. */
const DEMO_USER = "therock";
const DEMO_PASS = "1212";

/* ---------------- Storage ---------------- */
const STORE = {
  TX: "fintrack-ent-transactions",
  PROFILE: "fintrack-ent-profile",
  THEME: "fintrack-ent-theme",
  AUTH: "fintrack-ent-auth",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------------- Currency ---------------- */
const CURRENCIES = {
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" },
  INR: { symbol: "₹", locale: "en-IN" },
  JPY: { symbol: "¥", locale: "ja-JP" },
};
function formatCurrency(amount, code) {
  const cfg = CURRENCIES[code] || CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${cfg.symbol}${amount.toFixed(2)}`;
  }
}

/* ---------------- Categories (single shared list) ---------------- */
const CATEGORIES = {
  food: { label: "Food & Dining", icon: "🍔" },
  shopping: { label: "Shopping", icon: "🛍️" },
  bills: { label: "Recharge & Bills", icon: "🔌" },
  auto: { label: "Petrol & Auto", icon: "⛽" },
  utilities: { label: "Utilities", icon: "💡" },
  salary: { label: "Salary", icon: "💼" },
  entertainment: { label: "Entertainment", icon: "🎬" },
  other: { label: "Other", icon: "📦" },
};

/* ---------------- State ---------------- */
let transactions = loadJSON(STORE.TX, []);
let profile = loadJSON(STORE.PROFILE, { name: "The Rock", currency: "USD" });
let activeFilter = "all";
let selectedType = "expense";

/* ---------------- DOM refs ---------------- */
const el = (id) => document.getElementById(id);

const loginView = el("login-view");
const appShell = el("app-shell");
const loginForm = el("login-form");
const loginUser = el("login-user");
const loginPass = el("login-pass");
const loginError = el("login-error");
const logoutBtn = el("logout-btn");

const navButtons = document.querySelectorAll(".nav-item");
const dashboardView = el("dashboard-view");
const settingsView = el("settings-view");
const pageTitle = el("page-title");
const pageSub = el("page-sub");

const balanceValue = el("balance-value");
const incomeValue = el("income-value");
const expenseValue = el("expense-value");
const countValue = el("count-value");

const filterSelect = el("filter-select");
const txTableBody = el("tx-table-body");

const darkToggle = el("dark-toggle");
const resetDataBtn = el("reset-data");

const settingsName = el("settings-name");
const settingsCurrency = el("settings-currency");
const saveProfileBtn = el("save-profile");

const openAddTxBtn = el("open-add-tx");
const modalOverlay = el("modal-overlay");
const txModal = el("tx-modal");
const closeModalBtn = el("close-modal");
const txForm = el("tx-form");
const txDesc = el("tx-desc");
const txAmount = el("tx-amount");
const txDate = el("tx-date");
const txCategory = el("tx-category");
const typeButtons = document.querySelectorAll(".type-switch button");

const toast = el("toast");

/* ---------------- Toast ---------------- */
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------------- AUTH ---------------- */
function initAuth() {
  const isAuthed = localStorage.getItem(STORE.AUTH) === "true";
  if (isAuthed) showApp();
  else showLogin();

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = loginUser.value.trim();
    const pass = loginPass.value;
    if (user === DEMO_USER && pass === DEMO_PASS) {
      localStorage.setItem(STORE.AUTH, "true");
      loginError.textContent = "";
      loginForm.reset();
      showApp();
    } else {
      loginError.textContent = "Invalid ID or password. Please try again.";
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(STORE.AUTH);
    showLogin();
  });
}
function showLogin() {
  loginView.hidden = false;
  appShell.hidden = true;
}
function showApp() {
  loginView.hidden = true;
  appShell.hidden = false;
  renderAll();
}

/* ---------------- Theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem(STORE.THEME) || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  darkToggle.classList.toggle("on", saved === "dark");
  darkToggle.addEventListener("click", () => {
    const now =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", now);
    localStorage.setItem(STORE.THEME, now);
    darkToggle.classList.toggle("on", now === "dark");
  });
}

/* ---------------- Navigation (Dashboard / Settings) ---------------- */
function initNav() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}
function setView(view) {
  navButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view),
  );
  dashboardView.hidden = view !== "dashboard";
  settingsView.hidden = view !== "settings";
  if (view === "dashboard") {
    pageTitle.textContent = "Financial Overview";
    pageSub.textContent = "Real-time tracking application";
    openAddTxBtn.hidden = false;
    renderChart();
  } else {
    pageTitle.textContent = "Settings";
    pageSub.textContent = "Manage your account profile and app formatting.";
    openAddTxBtn.hidden = true;
  }
}

/* ---------------- Profile / Settings ---------------- */
function renderProfileFields() {
  settingsName.value = profile.name || "";
  settingsCurrency.value = profile.currency || "USD";
}
function saveProfile(e) {
  e.preventDefault();
  profile.name = settingsName.value.trim() || "You";
  profile.currency = settingsCurrency.value;
  saveJSON(STORE.PROFILE, profile);
  renderAll();
  showToast("Profile saved");
}

/* ---------------- Reset ---------------- */
function resetAllData() {
  const ok = confirm(
    "This will permanently delete all transactions and reset your profile on this device. Continue?",
  );
  if (!ok) return;
  localStorage.removeItem(STORE.TX);
  localStorage.removeItem(STORE.PROFILE);
  transactions = [];
  profile = { name: "You", currency: "USD" };
  renderProfileFields();
  renderAll();
  showToast("All data has been reset");
}

/* ---------------- Modal ---------------- */
function openModal() {
  txDate.value = new Date().toISOString().slice(0, 10);
  modalOverlay.classList.add("open");
  txModal.classList.add("open");
  txDesc.focus();
}
function closeModal() {
  modalOverlay.classList.remove("open");
  txModal.classList.remove("open");
  txForm.reset();
  setType("expense");
}

/* ---------------- Type switch ---------------- */
function setType(type) {
  selectedType = type;
  typeButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.type === type),
  );
}

/* ---------------- Transactions: add / delete ---------------- */
function persistTx() {
  saveJSON(STORE.TX, transactions);
}

function addTransaction(e) {
  e.preventDefault();
  const desc = txDesc.value.trim();
  const amount = parseFloat(txAmount.value);
  const category = txCategory.value;
  if (!desc || !amount || amount <= 0) {
    showToast("Enter a description and a valid amount");
    return;
  }
  if (!category) {
    showToast("Please select a category");
    return;
  }
  transactions.unshift({
    id: uid(),
    desc,
    amount,
    type: selectedType,
    category,
    date: txDate.value || new Date().toISOString().slice(0, 10),
  });
  persistTx();
  renderAll();
  closeModal();
  showToast(selectedType === "income" ? "Income added" : "Expense added");
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  persistTx();
  renderAll();
}

/* ---------------- Filter ---------------- */
function initFilter() {
  filterSelect.addEventListener("change", () => {
    activeFilter = filterSelect.value;
    renderTable();
  });
}

/* ---------------- Rendering ---------------- */
function computeTotals() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  return {
    income,
    expense,
    balance: income - expense,
    count: transactions.length,
  };
}

function renderStats() {
  const { income, expense, balance, count } = computeTotals();
  const code = profile.currency;
  balanceValue.textContent = formatCurrency(balance, code);
  incomeValue.textContent = formatCurrency(income, code);
  expenseValue.textContent = formatCurrency(expense, code);
  countValue.textContent = String(count);
}

function renderTable() {
  const filtered =
    activeFilter === "all"
      ? transactions
      : transactions.filter((t) => t.type === activeFilter);

  txTableBody.innerHTML = "";
  if (filtered.length === 0) {
    txTableBody.innerHTML = `<tr class="empty-row"><td colspan="5">No transactions ${activeFilter === "all" ? "yet" : `of this type`} — add one to get started.</td></tr>`;
    return;
  }

  filtered.forEach((t) => {
    const cat = CATEGORIES[t.category] || CATEGORIES.other;
    const sign = t.type === "income" ? "+" : "−";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${escapeHTML(t.desc)}</td>
      <td><span class="cat-pill">${cat.icon} ${cat.label}</span></td>
      <td class="amount-cell ${t.type}">${sign}${formatCurrency(t.amount, profile.currency)}</td>
      <td>
        <button class="tx-delete" data-id="${t.id}" aria-label="Delete transaction" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7"/></svg>
        </button>
      </td>
    `;
    txTableBody.appendChild(tr);
  });
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Cash flow chart (dependency-free SVG) ---------------- */
function renderChart() {
  const wrap = el("chart-wrap");
  if (!wrap) return;
  if (transactions.length === 0) {
    wrap.innerHTML = `<p class="chart-empty">Add a few transactions to see your cash flow here.</p>`;
    return;
  }
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  let running = 0;
  const points = sorted.map((t) => {
    running += t.type === "income" ? t.amount : -t.amount;
    return { date: t.date, value: running };
  });

  const width = 640,
    height = 180,
    padX = 12,
    padY = 16;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const stepX =
    points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (height - padY * 2) * (1 - (p.value - min) / range);
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const zeroY = padY + (height - padY * 2) * (1 - (0 - min) / range);
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${zeroY} L${coords[0].x.toFixed(1)},${zeroY} Z`;
  const last = coords[coords.length - 1];
  const trendUp = points[points.length - 1].value >= (points[0]?.value ?? 0);

  wrap.innerHTML = `
    <svg id="cashflow-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Cash flow over time">
      <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${width - padX}" y2="${zeroY.toFixed(1)}"
        stroke="currentColor" stroke-opacity="0.15" stroke-width="1" stroke-dasharray="4 4" />
      <path d="${areaPath}" fill="${trendUp ? "rgba(31,174,111,0.14)" : "rgba(224,86,63,0.14)"}" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${trendUp ? "var(--green)" : "var(--red)"}" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" fill="${trendUp ? "var(--green)" : "var(--red)"}"/>
    </svg>
  `;
}

/* ---------------- Master render ---------------- */
function renderAll() {
  renderStats();
  renderTable();
  renderChart();
  renderProfileFields();
}

/* ---------------- Init ---------------- */
function populateCategorySelects() {
  const opts =
    `<option value="">Select a category</option>` +
    Object.entries(CATEGORIES)
      .map(([key, c]) => `<option value="${key}">${c.icon} ${c.label}</option>`)
      .join("");
  txCategory.innerHTML = opts;
}

function init() {
  initTheme();
  initAuth();
  initNav();
  initFilter();
  populateCategorySelects();
  setType("expense");
  setView("dashboard");

  txForm.addEventListener("submit", addTransaction);
  typeButtons.forEach((b) =>
    b.addEventListener("click", () => setType(b.dataset.type)),
  );

  txTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".tx-delete");
    if (btn) deleteTransaction(btn.dataset.id);
  });

  openAddTxBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  saveProfileBtn.addEventListener("click", saveProfile);
  resetDataBtn.addEventListener("click", resetAllData);

  window.addEventListener("resize", renderChart);
}

document.addEventListener("DOMContentLoaded", init);
