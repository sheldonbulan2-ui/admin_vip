// Ninja VIP Admin Dashboard & Landing Page Script
let currentAdminToken = sessionStorage.getItem('ninja_admin_token') || '';
let loadedAccounts = [];

// DOM Elements
const landingSection = document.getElementById('landingSection');
const adminLoginModal = document.getElementById('adminLoginModal');
const dashboardSection = document.getElementById('dashboardSection');

const openAdminLoginBtn = document.getElementById('openAdminLoginBtn');
const openAdminLoginBtnFooter = document.getElementById('openAdminLoginBtnFooter');
const closeAdminLoginBtn = document.getElementById('closeAdminLoginBtn');
const returnToLandingBtn = document.getElementById('returnToLandingBtn');

const loginForm = document.getElementById('loginForm');
const adminKeyInput = document.getElementById('adminKeyInput');
const loginAlert = document.getElementById('loginAlert');
const loginAlertMsg = document.getElementById('loginAlertMsg');
const loginCard = document.getElementById('loginCard');
const logoutBtn = document.getElementById('logoutBtn');

const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statExpired = document.getElementById('statExpired');
const statBound = document.getElementById('statBound');

const keysTableBody = document.getElementById('keysTableBody');
const emptyTableState = document.getElementById('emptyTableState');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');

const keyModal = document.getElementById('keyModal');
const newKeyModalBtn = document.getElementById('newKeyModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const createKeyForm = document.getElementById('createKeyForm');

const testKeyForm = document.getElementById('testKeyForm');
const testUsernameInput = document.getElementById('testUsernameInput');
const testPasswordInput = document.getElementById('testPasswordInput');
const testResultBox = document.getElementById('testResultBox');
const apiEndpointUrl = document.getElementById('apiEndpointUrl');
const copyEndpointBtn = document.getElementById('copyEndpointBtn');
const backupBtn = document.getElementById('backupBtn');
const btnGenPassword = document.getElementById('btnGenPassword');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (apiEndpointUrl) {
    apiEndpointUrl.textContent = `${window.location.origin}/api/validate`;
  }

  if (currentAdminToken) {
    checkTokenAndLoad();
  } else {
    showLanding();
  }

  initDurationPills();
  initEventListeners();
});

function initEventListeners() {
  if (openAdminLoginBtn) {
    openAdminLoginBtn.addEventListener('click', () => {
      adminLoginModal.classList.remove('hidden');
      adminKeyInput.focus();
    });
  }
  if (openAdminLoginBtnFooter) {
    openAdminLoginBtnFooter.addEventListener('click', () => {
      adminLoginModal.classList.remove('hidden');
      adminKeyInput.focus();
    });
  }
  if (closeAdminLoginBtn) {
    closeAdminLoginBtn.addEventListener('click', () => {
      adminLoginModal.classList.add('hidden');
    });
  }
  if (returnToLandingBtn) {
    returnToLandingBtn.addEventListener('click', () => {
      showLanding();
    });
  }

  const toggleBtn = document.getElementById('toggleKeyVisibility');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const type = adminKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
      adminKeyInput.setAttribute('type', type);
      toggleBtn.innerHTML = type === 'password' ? '<i class="fa-regular fa-eye text-xs"></i>' : '<i class="fa-regular fa-eye-slash text-xs"></i>';
    });
  }

  // Random Password Generator
  if (btnGenPassword) {
    btnGenPassword.addEventListener('click', () => {
      const pass = 'vip' + Math.random().toString(36).substring(2, 8);
      document.getElementById('accountPasswordInput').value = pass;
      showToast(`Generated: ${pass}`, 'info');
    });
  }

  // Login Form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = adminKeyInput.value.trim();
    if (!key) return;

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: key })
      });
      const data = await res.json();

      if (data.success && data.token) {
        currentAdminToken = data.token;
        sessionStorage.setItem('ninja_admin_token', currentAdminToken);
        adminLoginModal.classList.add('hidden');
        loginAlert.classList.add('hidden');
        showDashboard();
        loadDashboardData();
        showToast('Authenticated as Master Admin', 'success');
      } else {
        showLoginError(data.message || 'Invalid Master Admin Key');
      }
    } catch (err) {
      showLoginError('Connection error to auth endpoint');
    }
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('ninja_admin_token');
      currentAdminToken = '';
      showLanding();
      showToast('Logged out of Admin Portal', 'info');
    });
  }

  // Create Account Modal Toggle
  if (newKeyModalBtn) {
    newKeyModalBtn.addEventListener('click', () => {
      keyModal.classList.remove('hidden');
      document.getElementById('accountUsernameInput').focus();
    });
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      keyModal.classList.add('hidden');
    });
  }

  // Create VIP Account Form Submit
  createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('accountUsernameInput').value.trim();
    const password = document.getElementById('accountPasswordInput').value.trim();
    const durationHours = parseFloat(document.getElementById('selectedHours').value) || 24;
    const durationDays = parseFloat(document.getElementById('selectedDays').value) || 1;
    const notes = document.getElementById('accountNotesInput').value.trim();

    if (!username || !password) {
      showToast('Username at Password ay kailangan!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentAdminToken}`
        },
        body: JSON.stringify({
          username,
          password,
          durationHours,
          durationDays,
          notes
        })
      });
      const data = await res.json();

      if (data.success) {
        keyModal.classList.add('hidden');
        createKeyForm.reset();
        document.getElementById('selectedHours').value = 24;
        document.getElementById('selectedDays').value = 1;
        showToast(`VIP Account [${username}] Created!`, 'success');
        loadDashboardData();
      } else {
        showToast(data.message || 'Failed to create account', 'error');
      }
    } catch (err) {
      showToast('Error communicating with API', 'error');
    }
  });

  // Test / Authenticate Account Form
  testKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = testUsernameInput.value.trim();
    const password = testPasswordInput.value.trim();
    if (!username || !password) return;

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, hwid: 'TEST_CONSOLE_HWID_EMULATOR' })
      });
      const result = await res.json();

      testResultBox.classList.remove('hidden');
      if (result.valid) {
        testResultBox.className = 'mt-4 p-4 rounded-xl text-xs font-mono space-y-1.5 border border-green-500/30 bg-green-500/10 text-green-300';
        testResultBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-sm text-cyberGreen">
            <i class="fa-solid fa-circle-check"></i> AUTHENTICATION PASS (VIP)
          </div>
          <div><b>Username:</b> ${result.username}</div>
          <div><b>Duration:</b> ${result.durationDays} Days (${result.durationHours} Hours)</div>
          <div><b>Remaining:</b> ${formatSeconds(result.remainingSeconds)}</div>
          <div><b>HWID Lock:</b> ${result.hwidBound}</div>
          <div class="text-[11px] text-green-400 mt-2">${result.message}</div>
        `;
      } else {
        testResultBox.className = 'mt-4 p-4 rounded-xl text-xs font-mono space-y-1.5 border border-red-500/30 bg-red-500/10 text-red-300';
        testResultBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-sm text-cyberCrimson">
            <i class="fa-solid fa-circle-xmark"></i> AUTHENTICATION FAILED (INVALID)
          </div>
          <div>${result.message}</div>
          <div class="text-[11px] text-slate-400 mt-1">Status: ACCESS DENIED (Strict Reject)</div>
        `;
      }
    } catch (err) {
      showToast('Error testing account', 'error');
    }
  });

  // Copy Endpoint
  copyEndpointBtn.addEventListener('click', () => {
    const url = `${window.location.origin}/api/validate`;
    navigator.clipboard.writeText(url);
    showToast('Endpoint URL copied to clipboard!', 'info');
  });

  // Backup DB Export
  backupBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadedAccounts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ninja_vip_accounts_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Accounts Database Backup exported!', 'success');
  });

  // Filter & Search
  searchInput.addEventListener('input', renderAccountsTable);
  statusFilter.addEventListener('change', renderAccountsTable);
}

function initDurationPills() {
  const pills = document.querySelectorAll('.duration-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => {
        p.classList.remove('active', 'border-cyan-400', 'bg-cyan-500/20', 'text-cyberCyan');
        p.classList.add('border-white/10');
      });
      pill.classList.add('active', 'border-cyan-400', 'bg-cyan-500/20', 'text-cyberCyan');
      pill.classList.remove('border-white/10');

      document.getElementById('selectedHours').value = pill.getAttribute('data-hours');
      document.getElementById('selectedDays').value = pill.getAttribute('data-days');
    });
  });
}

async function checkTokenAndLoad() {
  try {
    const res = await fetch('/api/keys', {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` }
    });
    if (res.ok) {
      showDashboard();
      loadDashboardData();
    } else {
      showLanding();
    }
  } catch (err) {
    showLanding();
  }
}

async function loadDashboardData() {
  try {
    const res = await fetch('/api/keys', {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` }
    });
    const data = await res.json();

    if (data.success) {
      loadedAccounts = data.accounts || [];
      statTotal.textContent = data.stats.total;
      statActive.textContent = data.stats.active;
      statExpired.textContent = data.stats.expired;
      statBound.textContent = data.stats.boundDevices;
      renderAccountsTable();
    }
  } catch (err) {
    showToast('Failed to load accounts data', 'error');
  }
}

function renderAccountsTable() {
  const query = searchInput.value.toLowerCase().trim();
  const filter = statusFilter.value;

  const filtered = loadedAccounts.filter(a => {
    const matchesQuery = (a.username && a.username.toLowerCase().includes(query)) ||
                         (a.notes && a.notes.toLowerCase().includes(query)) ||
                         (a.hwid && a.hwid.toLowerCase().includes(query));
    const matchesFilter = filter === 'all' || a.status === filter;
    return matchesQuery && matchesFilter;
  });

  keysTableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyTableState.classList.remove('hidden');
    return;
  }
  emptyTableState.classList.add('hidden');

  filtered.forEach(a => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/[0.02] transition-colors border-b border-white/5';

    let statusBadge = '';
    if (a.status === 'active') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-cyberGreen border border-green-500/20">PASS (ACTIVE)</span>';
    } else if (a.status === 'expired') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-cyberCrimson border border-red-500/20">FAILED (EXPIRED)</span>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">REVOKED</span>';
    }

    let timeDisplay = '';
    if (!a.activatedAt) {
      timeDisplay = '<span class="text-slate-500">Unused (Starts on login)</span>';
    } else if (a.status === 'expired') {
      timeDisplay = '<span class="text-cyberCrimson font-bold">Expired</span>';
    } else if (a.remainingSeconds !== null) {
      timeDisplay = `<span class="text-cyberCyan font-bold">${formatSeconds(a.remainingSeconds)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
        <span>${a.username}</span>
        <button onclick="copyToClipboard('${a.username}')" class="text-slate-500 hover:text-cyan-400 p-1" title="Copy Username">
          <i class="fa-regular fa-copy text-xs"></i>
        </button>
      </td>
      <td class="py-3 px-4 text-slate-300 font-mono flex items-center gap-2">
        <span>${a.password}</span>
        <button onclick="copyToClipboard('${a.password}')" class="text-slate-500 hover:text-cyan-400 p-1" title="Copy Password">
          <i class="fa-regular fa-copy text-xs"></i>
        </button>
      </td>
      <td class="py-3 px-4 text-slate-300 font-mono">${a.durationDays >= 1 ? `${a.durationDays} Days` : `${a.durationHours} Hours`}</td>
      <td class="py-3 px-4 font-mono">${timeDisplay}</td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4 text-slate-400 font-mono truncate max-w-[120px]" title="${a.hwid || 'No device bound'}">
        ${a.hwid ? `<span class="text-cyberGold text-[11px]"><i class="fa-solid fa-lock text-[9px] mr-1"></i>${a.hwid.slice(0, 10)}...</span>` : '<span class="text-slate-600">Unbound</span>'}
      </td>
      <td class="py-3 px-4 text-slate-400 text-xs truncate max-w-[120px]">${a.notes || '-'}</td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          ${a.hwid ? `<button onclick="resetHwid('${a.id}')" class="px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 rounded text-[11px]" title="Reset HWID Lock">Reset HWID</button>` : ''}
          <button onclick="extendTime('${a.id}', 1)" class="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded text-[11px]" title="+1 Day">+1D</button>
          <button onclick="toggleRevoke('${a.id}', '${a.status}')" class="px-2 py-1 ${a.status === 'revoked' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'} rounded text-[11px]" title="Toggle Revoke">
            ${a.status === 'revoked' ? 'Unban' : 'Revoke'}
          </button>
          <button onclick="deleteAccount('${a.id}')" class="p-1 text-slate-500 hover:text-red-400" title="Delete Account">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </td>
    `;
    keysTableBody.appendChild(tr);
  });
}

// Action Handlers
async function resetHwid(id) {
  try {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id, action: 'reset_hwid' })
    });
    const d = await res.json();
    if (d.success) {
      showToast('HWID Device Lock Reset!', 'success');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to reset HWID', 'error');
  }
}

async function extendTime(id, days) {
  try {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id, action: 'extend', addDays: days })
    });
    const d = await res.json();
    if (d.success) {
      showToast(`Added +${days} Days!`, 'success');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to extend time', 'error');
  }
}

async function toggleRevoke(id, currentStatus) {
  const action = currentStatus === 'revoked' ? 'activate' : 'revoke';
  try {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id, action })
    });
    const d = await res.json();
    if (d.success) {
      showToast('Account status updated!', 'info');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function deleteAccount(id) {
  if (!confirm('Are you sure you want to delete this account permanently?')) return;
  try {
    const res = await fetch(`/api/keys?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentAdminToken}`
      }
    });
    const d = await res.json();
    if (d.success) {
      showToast('Account deleted permanently', 'info');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to delete account', 'error');
  }
}

function showLanding() {
  landingSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
}

function showDashboard() {
  landingSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
}

function showLoginError(msg) {
  loginAlert.classList.remove('hidden');
  loginAlertMsg.textContent = msg;
  loginCard.classList.add('animate-shake');
  setTimeout(() => loginCard.classList.remove('animate-shake'), 500);
}

function formatSeconds(sec) {
  if (sec === null || sec === undefined) return '-';
  if (sec <= 0) return '0s (Expired)';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m ${s}s remaining`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied: ${text}`, 'info');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');

  const bg = type === 'success' ? 'border-green-500/40 bg-green-950/80 text-green-300' :
             type === 'error' ? 'border-red-500/40 bg-red-950/80 text-red-300' :
             'border-cyan-500/40 bg-cyan-950/80 text-cyan-300';

  const icon = type === 'success' ? 'fa-circle-check text-green-400' :
               type === 'error' ? 'fa-triangle-exclamation text-red-400' :
               'fa-circle-info text-cyan-400';

  toast.className = `p-3.5 rounded-2xl border ${bg} backdrop-blur-md shadow-2xl flex items-center gap-3 text-xs font-mono max-w-sm pointer-events-auto transition-all transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base"></i>
    <span class="truncate">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
