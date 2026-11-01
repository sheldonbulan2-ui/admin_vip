// Ninja VIP Admin Dashboard & Landing Page Script
let currentAdminToken = sessionStorage.getItem('ninja_admin_token') || '';
let loadedKeys = [];

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
const testKeyInput = document.getElementById('testKeyInput');
const testResultBox = document.getElementById('testResultBox');
const apiEndpointUrl = document.getElementById('apiEndpointUrl');
const copyEndpointBtn = document.getElementById('copyEndpointBtn');
const backupBtn = document.getElementById('backupBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (apiEndpointUrl) {
    apiEndpointUrl.textContent = `${window.location.origin}/api/validate`;
  }

  // If already authenticated in current session, go straight to dashboard
  if (currentAdminToken) {
    checkTokenAndLoad();
  } else {
    showLanding();
  }

  initDurationPills();
  initEventListeners();
});

function initEventListeners() {
  // Open Admin Login Modal
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

  // Toggle admin key visibility
  const toggleBtn = document.getElementById('toggleKeyVisibility');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const type = adminKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
      adminKeyInput.setAttribute('type', type);
      toggleBtn.innerHTML = type === 'password' ? '<i class="fa-regular fa-eye text-xs"></i>' : '<i class="fa-regular fa-eye-slash text-xs"></i>';
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
        showToast('Login Successful! Welcome Master Admin.', 'success');
        showDashboard();
        loadDashboardData();
      } else {
        showLoginError(data.message || 'Invalid Master Admin Key!');
      }
    } catch (err) {
      showLoginError('Network Error: Could not connect to API');
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    currentAdminToken = '';
    sessionStorage.removeItem('ninja_admin_token');
    showLanding();
    showToast('Logged out of Admin Session', 'info');
  });

  // Key Modal Controls
  newKeyModalBtn.addEventListener('click', () => keyModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => keyModal.classList.add('hidden'));

  // Create Key Form
  createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const durationHours = parseFloat(document.getElementById('selectedHours').value) || 24;
    const durationDays = parseFloat(document.getElementById('selectedDays').value) || 1;
    const customKey = document.getElementById('customKeyInput').value.trim();
    const count = parseInt(document.getElementById('keyCountInput').value) || 1;
    const notes = document.getElementById('keyNotesInput').value.trim();

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentAdminToken}`
        },
        body: JSON.stringify({
          customKey,
          durationHours,
          durationDays,
          count,
          notes
        })
      });
      const data = await res.json();

      if (data.success) {
        keyModal.classList.add('hidden');
        createKeyForm.reset();
        document.getElementById('selectedHours').value = 24;
        document.getElementById('selectedDays').value = 1;
        showToast(`Created ${data.keys.length} Key(s) Successfully!`, 'success');
        loadDashboardData();
      } else {
        showToast(data.message || 'Failed to generate key', 'error');
      }
    } catch (err) {
      showToast('Error communicating with API', 'error');
    }
  });

  // Test / Authenticate Key Form
  testKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = testKeyInput.value.trim().toUpperCase();
    if (!key) return;

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, hwid: 'TEST_CONSOLE_HWID_EMULATOR' })
      });
      const result = await res.json();

      testResultBox.classList.remove('hidden');
      if (result.valid) {
        testResultBox.className = 'mt-4 p-4 rounded-xl text-xs font-mono space-y-1.5 border border-green-500/30 bg-green-500/10 text-green-300';
        testResultBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-sm text-cyberGreen">
            <i class="fa-solid fa-circle-check"></i> AUTHENTICATION PASS (VIP)
          </div>
          <div><b>Key:</b> ${result.key}</div>
          <div><b>Duration:</b> ${result.durationDays} Days (${result.durationHours} Hours)</div>
          <div><b>Remaining:</b> ${formatSeconds(result.remainingSeconds)}</div>
          <div><b>HWID Lock:</b> ${result.hwid}</div>
          <div class="text-[11px] text-green-400 mt-2">${result.message}</div>
        `;
      } else {
        testResultBox.className = 'mt-4 p-4 rounded-xl text-xs font-mono space-y-1.5 border border-red-500/30 bg-red-500/10 text-red-300';
        testResultBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-sm text-cyberCrimson">
            <i class="fa-solid fa-circle-xmark"></i> AUTHENTICATION FAILED (INVALID)
          </div>
          <div>${result.message}</div>
          <div class="text-[11px] text-slate-400 mt-1">Status: Kick Out / Prompt for New Key</div>
        `;
      }
    } catch (err) {
      showToast('Error testing key', 'error');
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
    const blob = new Blob([JSON.stringify(loadedKeys, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ninja_vip_keys_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('License Database Backup exported!', 'success');
  });

  // Filter & Search
  searchInput.addEventListener('input', renderKeysTable);
  statusFilter.addEventListener('change', renderKeysTable);
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
      loadedKeys = data.keys || [];
      statTotal.textContent = data.stats.total;
      statActive.textContent = data.stats.active;
      statExpired.textContent = data.stats.expired;
      statBound.textContent = data.stats.boundDevices;
      renderKeysTable();
    }
  } catch (err) {
    showToast('Failed to load keys data', 'error');
  }
}

function renderKeysTable() {
  const query = searchInput.value.toLowerCase().trim();
  const filter = statusFilter.value;

  const filtered = loadedKeys.filter(k => {
    const matchesQuery = k.key.toLowerCase().includes(query) ||
                         (k.notes && k.notes.toLowerCase().includes(query)) ||
                         (k.hwid && k.hwid.toLowerCase().includes(query));
    const matchesFilter = filter === 'all' || k.status === filter;
    return matchesQuery && matchesFilter;
  });

  keysTableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyTableState.classList.remove('hidden');
    return;
  }
  emptyTableState.classList.add('hidden');

  filtered.forEach(k => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/[0.02] transition-colors border-b border-white/5';

    let statusBadge = '';
    if (k.status === 'active') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-cyberGreen border border-green-500/20">PASS (ACTIVE)</span>';
    } else if (k.status === 'expired') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-cyberCrimson border border-red-500/20">FAILED (EXPIRED)</span>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">REVOKED</span>';
    }

    let timeDisplay = '';
    if (!k.activatedAt) {
      timeDisplay = '<span class="text-slate-500">Unused (Starts on login)</span>';
    } else if (k.status === 'expired') {
      timeDisplay = '<span class="text-cyberCrimson font-bold">Expired</span>';
    } else if (k.remainingSeconds !== null) {
      timeDisplay = `<span class="text-cyberCyan font-bold">${formatSeconds(k.remainingSeconds)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
        <span>${k.key}</span>
        <button onclick="copyToClipboard('${k.key}')" class="text-slate-500 hover:text-cyan-400 p-1" title="Copy Key">
          <i class="fa-regular fa-copy text-xs"></i>
        </button>
      </td>
      <td class="py-3 px-4 text-slate-300 font-mono">${k.durationDays >= 1 ? `${k.durationDays} Days` : `${k.durationHours} Hours`}</td>
      <td class="py-3 px-4 font-mono">${timeDisplay}</td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4 text-slate-400 font-mono truncate max-w-[120px]" title="${k.hwid || 'No device bound'}">
        ${k.hwid ? `<span class="text-cyberGold text-[11px]"><i class="fa-solid fa-lock text-[9px] mr-1"></i>${k.hwid.slice(0, 10)}...</span>` : '<span class="text-slate-600">Unbound</span>'}
      </td>
      <td class="py-3 px-4 text-slate-400 text-xs truncate max-w-[120px]">${k.notes || '-'}</td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          ${k.hwid ? `<button onclick="resetHwid('${k.id}')" class="px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 rounded text-[11px]" title="Reset HWID Lock">Reset HWID</button>` : ''}
          <button onclick="extendTime('${k.id}', 24)" class="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded text-[11px]" title="+24 Hours">+24H</button>
          <button onclick="toggleRevoke('${k.id}', '${k.status}')" class="px-2 py-1 ${k.status === 'revoked' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'} rounded text-[11px]" title="Toggle Revoke">
            ${k.status === 'revoked' ? 'Unban' : 'Revoke'}
          </button>
          <button onclick="deleteKey('${k.id}')" class="p-1 text-slate-500 hover:text-red-400" title="Delete Key">
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

async function extendTime(id, hours) {
  try {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id, action: 'extend_time', extendHours: hours })
    });
    const d = await res.json();
    if (d.success) {
      showToast(`Added +${hours} Hours to key!`, 'success');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to extend time', 'error');
  }
}

async function toggleRevoke(id, currentStatus) {
  const newStatus = currentStatus === 'revoked' ? 'active' : 'revoked';
  try {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id, action: 'set_status', newStatus })
    });
    const d = await res.json();
    if (d.success) {
      showToast(`Key status updated to ${newStatus.toUpperCase()}`, 'info');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function deleteKey(id) {
  if (!confirm('Are you sure you want to delete this key permanently?')) return;
  try {
    const res = await fetch('/api/keys', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({ id })
    });
    const d = await res.json();
    if (d.success) {
      showToast('Key deleted permanently', 'info');
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to delete key', 'error');
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied: ${text}`, 'success');
}

// UI State Toggles
function showLanding() {
  landingSection.classList.remove('hidden');
  adminLoginModal.classList.add('hidden');
  dashboardSection.classList.add('hidden');
}

function showDashboard() {
  landingSection.classList.add('hidden');
  adminLoginModal.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
}

function showLoginError(msg) {
  loginAlertMsg.textContent = msg;
  loginAlert.className = 'mb-5 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400';
  loginAlert.classList.remove('hidden');
  loginCard.classList.remove('animate-shake');
  void loginCard.offsetWidth;
  loginCard.classList.add('animate-shake');
}

function formatSeconds(sec) {
  if (sec <= 0) return '0s';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${sec % 60}s`;
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-500/20 border-green-500/30 text-green-300',
    error: 'bg-red-500/20 border-red-500/30 text-red-300',
    info: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
  };
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info'
  };

  toast.className = `p-4 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-semibold flex items-center gap-3 transition-all duration-300 pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${msg}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
