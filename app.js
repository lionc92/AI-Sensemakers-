// ── SUPABASE CONFIG ──────────────────────────────────────
const SUPA_URL = 'https://tjfnhscpfazvuiynnpox.supabase.co';
const SUPA_KEY = 'sb_publishable_VYaSslKCxFiU9tP-6kBrfg_uzGFrNd-';

// ── SUPABASE CLIENT ─────────────────────────────────────── 
const supa = {
  async query(table, params = '') {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${window._supa_token || SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async login(email, password) {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  },
  async logout() {
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${window._supa_token}` }
    });
  }
};

// ── MONTH NORMALISATION ───────────────────────────────────
// New DB uses '25-Dec', '26-Jan' — normalise to 'Dec-25', 'Jan-26' for UI compatibility
function normaliseMonth(m) {
  if (!m) return m;
  // Already in new format like '25-Dec' → convert to 'Dec-25'
  const match = m.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (match) return `${match[2]}-${match[1]}`;
  return m; // already 'Dec-25' style or unknown
}

// ── STATE ─────────────────────────────────────────────────
let RAW = [];
let filtered = [];
let sortKey = 'pos', sortDir = 1, sortType = 'n';
let itaMode = 'all';
let hiddenGroups = new Set();

const MESELAB = { 'Dec-25': 'Dic 2025', 'Jan-26': 'Gen 2026', 'Feb-26': 'Feb 2026' };
const LLMLAB  = { 'Total': 'Total', 'OPENAI CHATGPT': 'ChatGPT', 'PERPLEXITY': 'Perplexity', 'GOOGLE GEMINI': 'Gemini', 'MICROSOFT COPILOT': 'Copilot', 'X GROK': 'Grok' };

// ── FORMATTERS ────────────────────────────────────────────
function fmtN(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  if (n >= 1000) return Math.round(n / 1000).toLocaleString('it-IT') + 'K';
  return n.toLocaleString('it-IT');
}
function fmtD(n, dec) {
  return typeof n === 'number' ? n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
}
function fmtPct(n) { return typeof n === 'number' ? fmtD(n * 100, 1) + ' %' : '—'; }

// ── CELL BUILDERS ─────────────────────────────────────────
function rankCell(pos) {
  const c = pos === 1 ? 'rk1' : pos === 2 ? 'rk2' : pos === 3 ? 'rk3' : '';
  return `<span class="rk ${c}">${pos}</span>`;
}
function llmCell(llm) {
  const label = LLMLAB[llm] || llm;
  const cls   = llm === 'Total' ? 'lb tot' : 'lb other';
  return `<span class="${cls}">${label}</span>`;
}
function domainCell(sito) {
  return `<span class="cs">${sito}</span>`;
}

// ── RENDER ────────────────────────────────────────────────
function render() {
  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = '';
    document.getElementById('nores').style.display = 'block';
    updateStatus();
    return;
  }
  document.getElementById('nores').style.display = 'none';

  tbody.innerHTML = filtered.map(r => `<tr>
<td class="g-id cell-mese">${MESELAB[r.mese] || r.mese}</td>
<td class="g-id">${llmCell(r.chatbot)}</td>
<td class="g-id">${rankCell(r.pos)}</td>
<td class="g-id">${domainCell(r.sito)}</td>
<td class="g-id">${r.cat || '—'}</td>
<td class="g-id">${r.geo || '—'}</td>
<td class="g-vol gs cn">${fmtN(r.vis_ai)}</td>
<td class="g-vol cn">${fmtN(r.conv_ai)}</td>
<td class="g-vol cn">${fmtN(r.dom_ai)}</td>
<td class="g-vol cn">${fmtN(r.nuovi)}</td>
<td class="g-vol cn">${fmtN(r.vis_tot)}</td>
<td class="g-vol cn">${fmtN(r.aud_pot)}</td>
<td class="g-vol cn">${fmtD(r.pct_ai_inc * 100, 1)} %</td>
<td class="g-pct gs cn">${fmtPct(r.pct_nv)}</td>
<td class="g-pct cn">${fmtPct(r.pct_excl)}</td>
<td class="g-eng gs cn">${fmtD(r.conv_v, 2)}</td>
<td class="g-eng cn">${fmtD(r.prom_v, 2)}</td>
<td class="g-eng cn">${fmtD(r.prom_c, 2)}</td>
</tr>`).join('');

  // Reapply hidden groups
  hiddenGroups.forEach(g => document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none'));
  updateStatus();
}

// ── STATUS / CARD HEADER ──────────────────────────────────
function updateStatus() {
  const n = filtered.length;
  document.getElementById('cnt-s').textContent = n.toLocaleString('it-IT');
  document.getElementById('cnt-t').textContent = RAW.length.toLocaleString('it-IT');

  const llmVal = document.getElementById('f-llm').value;
  const isAll  = llmVal === '__ALL__';
  document.getElementById('warn-ovlp').style.display = isAll ? 'block' : 'none';

  // Card header dynamic title
  const meseVal   = document.getElementById('f-mese').value;
  const meseLabel = meseVal ? (MESELAB[meseVal] || meseVal) : 'Tutti i mesi';
  const llmLabel  = LLMLAB[llmVal] || llmVal;
  const ctEl = document.getElementById('card-title');
  if (ctEl) ctEl.textContent = `Domini — ${meseLabel} · ${llmLabel}`;

  const subEl = document.getElementById('card-sub');
  if (subEl) {
    const sk = {
      'mese':        'Mese',
      'chatbot':     'Chatbot',
      'pos':         'Rank',
      'sito':        'Domain',
      'vis_ai':      'AI Visitors',
      'conv_ai':     'AI Convos',
      'dom_ai':      'AI Prompts',
      'nuovi':       'Non Visitors',
      'vis_tot':     'Domain Visitors',
      'aud_pot':     'Total New Reach',
      'pct_ai_inc':  '% AI Incremental',
      'pct_nv':      '% Non-Conversion',
      'pct_excl':    '% AI Exclusive',
      'conv_v':      'Convos per Visitor',
      'prom_v':      'Prompts per Visitor',
      'prom_c':      'Prompts per Convo',
    };
    subEl.textContent = 'Ordinati per ' + (sk[sortKey] || sortKey);
  }
}

// ── FILTERS ───────────────────────────────────────────────
function applyFilters() {
  const mese   = document.getElementById('f-mese').value;
  const llm    = document.getElementById('f-llm').value;
  const sito   = document.getElementById('f-sito').value.toLowerCase().trim();
  // Ricerca multipla: separa per virgola, logica OR
  const sitoTerms = sito ? sito.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
  const rkMin  = parseInt(document.getElementById('f-rk-min').value) || 1;
  const rkMax  = parseInt(document.getElementById('f-rk-max').value) || 99999;
  const visMin = parseInt(document.getElementById('f-vis').value) || 0;

  const catFilt = document.getElementById('f-cat') ? document.getElementById('f-cat').value : '';
  const geoFilt  = document.getElementById('f-geo') ? document.getElementById('f-geo').value : '';
  filtered = RAW.filter(r => {
    if (mese && r.mese !== mese) return false;
    if (llm === '__ALL__') {} else if (llm && r.chatbot !== llm) return false;
    if (sitoTerms.length > 0 && !sitoTerms.some(t => r.sito.toLowerCase().includes(t))) return false;
    if (r.pos < rkMin || r.pos > rkMax) return false;
    if ((r.vis_ai || 0) < visMin) return false;
    if (catFilt && r.cat !== catFilt) return false;
    if (geoFilt  && r.geo !== geoFilt)  return false;
    return true;
  });
  sortAndRender();
}

function resetFilters() {
  document.getElementById('f-mese').value   = '';
  document.getElementById('f-llm').value    = 'Total';
  document.getElementById('f-sito').value   = '';
  ['f-rk-min', 'f-rk-max', 'f-vis'].forEach(id => document.getElementById(id).value = '');
  if (document.getElementById('f-cat')) document.getElementById('f-cat').value = '';
  if (document.getElementById('f-geo')) document.getElementById('f-geo').value = '';
  applyFilters();
}

// ── SORT ──────────────────────────────────────────────────
function doSort(th) {
  const k = th.dataset.k, t2 = th.dataset.t;
  if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; sortType = t2; }
  document.querySelectorAll('th').forEach(h => h.classList.remove('sa', 'sd'));
  th.classList.add(sortDir === 1 ? 'sa' : 'sd');
  sortAndRender();
}
function sortAndRender() {
  filtered.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (sortType === 'n') return (av - bv) * sortDir;
    if (sortType === 'b') return ((av ? 1 : 0) - (bv ? 1 : 0)) * sortDir;
    return String(av || '').localeCompare(String(bv || '')) * sortDir;
  });
  render();
}

// ── COLUMN TOGGLE ─────────────────────────────────────────
function togG(btn) {
  const g = btn.dataset.g;
  if (hiddenGroups.has(g)) {
    hiddenGroups.delete(g);
    btn.classList.add('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = '');
  } else {
    hiddenGroups.add(g);
    btn.classList.remove('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none');
  }
}

// ── TAB SWITCH — gestito da AIO block sotto ───────────────
// (switchPanel e switchTab sono definiti nel blocco AIO in fondo)

// ── DARK MODE ─────────────────────────────────────────────
function toggleTheme() {
  const h = document.documentElement;
  h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ── DATA LOADING ─────────────────────────────────────────
async function refreshToken() {
  const refresh = localStorage.getItem('supa_refresh');
  if (!refresh) throw new Error('Sessione scaduta. Effettua nuovamente il login.');
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh })
  });
  const data = await res.json();
  if (data.error || !data.access_token) throw new Error('Sessione scaduta. Effettua nuovamente il login.');
  window._supa_token = data.access_token;
  localStorage.setItem('supa_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('supa_refresh', data.refresh_token);
  return data.access_token;
}

async function loadData() {
  showLoading(true);
  try {
    let all = [], offset = 0;
    const limit  = 500;
    // New view columns (ai_chatbot view)
    const fields = 'month,chatbot,rank,domain,ai_visitors,ai_convos,ai_prompts,non_visitors,domain_visitors,total_new_reach,pct_ai_incremental,pct_non_conversion,pct_exclusive,convos_per_visitor,prompts_per_convo,prompts_per_visitor,comscore_category,geo';

    while (true) {
      let batch;
      try {
        batch = await supa.query('ai_chatbot', `select=${fields}&order=month.asc,chatbot.asc,rank.asc&limit=${limit}&offset=${offset}`);
      } catch (e) {
        if (e.message && (e.message.includes('JWT') || e.message.includes('expired') || e.message.includes('401'))) {
          await refreshToken();
          batch = await supa.query('ai_chatbot', `select=${fields}&order=month.asc,chatbot.asc,rank.asc&limit=${limit}&offset=${offset}`);
        } else throw e;
      }
      all = all.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }

    // Map new view columns → internal state keys used by render/filters
    RAW = all.map(r => ({
      mese:     normaliseMonth(r.month),        // '25-Dec' → 'Dec-25'
      chatbot:  r.chatbot,
      pos:      r.rank,
      sito:     r.domain,
      ita:      null,                            // not in new DB yet
      cat:      r.comscore_category || null,
      geo:      r.geo || null,
      vis_ai:   r.ai_visitors,
      conv_ai:  r.ai_convos,
      dom_ai:   r.ai_prompts,
      nuovi:    r.non_visitors,
      vis_tot:  r.domain_visitors,
      aud_pot:  r.total_new_reach,
      pct_ai_inc: r.pct_ai_incremental,
      pct_nv:   r.pct_non_conversion,           // already 0–1 ratio
      pct_excl: r.pct_exclusive,                // already 0–1 ratio
      conv_v:   r.convos_per_visitor,
      prom_c:   r.prompts_per_convo,
      prom_v:   r.prompts_per_visitor,
    }));

    showLoading(false);

    // Reset filters
    document.getElementById('f-mese').value   = '';
    document.getElementById('f-llm').value    = 'Total';
    document.getElementById('f-sito').value   = '';
    ['f-rk-min', 'f-rk-max', 'f-vis'].forEach(id => document.getElementById(id).value = '');

    filtered = RAW.filter(r => r.chatbot === 'Total');
    filtered.sort((a, b) => a.pos - b.pos);

    // Mostra tab strip e panel dati
    const tabStrip = document.getElementById('tab-strip-dati');
    if (tabStrip) tabStrip.style.display = 'flex';
    const panelDati = document.getElementById('panel-dati');
    if (panelDati) panelDati.style.display = 'flex';

    applyLang();
    render();
    updateSidebarFooter();

  } catch (e) {
    showLoading(false);
    if (e.message && (e.message.includes('scaduta') || e.message.includes('JWT') || e.message.includes('expired'))) {
      localStorage.removeItem('supa_token');
      localStorage.removeItem('supa_refresh');
      window._supa_token = null;
      showLogin();
      document.getElementById('login-error').textContent = t('session_expired');
      document.getElementById('login-error').style.display = 'block';
    } else {
      showError('Errore nel caricamento dei dati: ' + e.message);
    }
  }
}

function updateSidebarFooter() {
  // Mostra solo "Comscore Panel IT" — stabile e senza dipendenze dai mesi
  const el = document.getElementById('sb-last-update');
  if (el) el.textContent = 'Comscore Panel IT';
}

function showLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── AUTH ──────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const err      = document.getElementById('login-error');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = t('login_loading');
  try {
    const session = await supa.login(email, password);
    window._supa_token = session.access_token;
    window._supa_user  = session.user?.email || email;
    localStorage.setItem('supa_token',   session.access_token);
    localStorage.setItem('supa_refresh', session.refresh_token || '');
    localStorage.setItem('supa_user',    window._supa_user);
    showApp();
    loadData();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = t('login_btn');
  }
}

async function handleLogout() {
  try { await supa.logout(); } catch (e) {}
  window._supa_token = null;
  localStorage.removeItem('supa_token');
  localStorage.removeItem('supa_refresh');
  localStorage.removeItem('supa_user');

  // ── Reset completo dello stato — CRITICO per multi-tenant ─
  // Dati raw e filtrati
  RAW = []; filtered = [];
  RAW_AIO = []; filteredAio = [];
  RAW_CC  = []; filteredCc  = [];

  // Sort state
  sortKey = 'pos'; sortDir = 1; sortType = 'n';
  sortKeyAio = 'rank'; sortDirAio = 1; sortTypeAio = 'n';
  sortKeyCc  = 'ai_visitors'; sortDirCc = -1; sortTypeCc = 'n';

  // Column toggles
  hiddenGroups    = new Set();
  hiddenGroupsAio = new Set();
  hiddenGroupsCc  = new Set();

  // Tab state
  currentTab = 'chatbot';

  // Insights (insights.js)
  if (typeof insightsChatbotLlm  !== 'undefined') insightsChatbotLlm  = 'Total';
  if (typeof insightsChatbotMese !== 'undefined') insightsChatbotMese = '';
  if (typeof insightsCharts      !== 'undefined') {
    Object.values(insightsCharts).forEach(function(c) { try { c.destroy(); } catch(e) {} });
    insightsCharts = {};
  }

  // Competition (insights_aio.js)
  if (typeof aioDomains    !== 'undefined') aioDomains = [];
  if (typeof aioMetric     !== 'undefined') aioMetric  = 'searchers';
  if (typeof aioCat        !== 'undefined') aioCat     = '';
  if (typeof aioChartsInst !== 'undefined') {
    Object.values(aioChartsInst).forEach(function(c) { try { c.destroy(); } catch(e) {} });
    aioChartsInst = {};
  }

  // Flag di caricamento
  window._aioLoading = false;

  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
}
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'block';
  const u = window._supa_user || localStorage.getItem('supa_user') || '';
  const el = document.getElementById('user-email');
  if (el) el.textContent = u;
}

// ── EXPORT ────────────────────────────────────────────────
function exportExcel() {
  if (!filtered.length) { alert('Nessun dato da esportare.'); return; }
  const headers = [
    'Mese', 'Chatbot', 'Rank', 'Domain', 'Domain Category', 'Geo',
    'AI Visitors', 'AI Convos', 'AI Prompts',
    'Non Visitors', 'Domain Visitors', 'Total New Reach', '% AI Incremental',
    '% Non-Conversion', '% AI Exclusive',
    'Convos per Visitor', 'Prompts per Visitor', 'Prompts per Convo'
  ];
  const rows = filtered.map(r => [
    MESELAB[r.mese] || r.mese,
    LLMLAB[r.chatbot] || r.chatbot,
    r.pos, r.sito, r.cat || '', r.geo || '',
    r.vis_ai, r.conv_ai, r.dom_ai, r.nuovi,
    r.vis_tot, r.aud_pot,
    r.pct_ai_inc != null ? parseFloat((r.pct_ai_inc * 100).toFixed(2)) : null,
    r.pct_nv   != null ? parseFloat((r.pct_nv   * 100).toFixed(2)) : null,
    r.pct_excl != null ? parseFloat((r.pct_excl * 100).toFixed(2)) : null,
    r.conv_v, r.prom_v, r.prom_c
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:12},{wch:14},{wch:10},{wch:28},{wch:28},{wch:6},
    {wch:16},{wch:14},{wch:14},{wch:14},
    {wch:18},{wch:18},
    {wch:18},{wch:16},{wch:18},
    {wch:18},{wch:16},{wch:18}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AI Chatbot Intelligence');
  const mese  = document.getElementById('f-mese').value || 'tutti';
  const llm   = document.getElementById('f-llm').value  || 'Total';
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, ('sensemakers_ai_' + mese + '_' + llm + '_' + today + '.xlsx').toLowerCase().replace(/ /g, '_'));
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  applyLang();
  const saved = localStorage.getItem('supa_token');
  if (saved) {
    window._supa_token = saved;
    window._supa_user  = localStorage.getItem('supa_user') || '';
    showApp();
    loadData();
  } else {
    showLogin();
  }
});

// ══════════════════════════════════════════════════════════
// AIO — STATE, RENDER, FILTERS, SORT, EXPORT
// ══════════════════════════════════════════════════════════

let RAW_AIO = [];
let filteredAio = [];
let sortKeyAio = 'rank', sortDirAio = 1, sortTypeAio = 'n';
let hiddenGroupsAio = new Set();
let currentTab = 'chatbot'; // 'chatbot' | 'aio'

const MESELAB_AIO = {
  '25-Apr':'Apr 2025','25-May':'Mag 2025','25-Jun':'Giu 2025',
  '25-Jul':'Lug 2025','25-Aug':'Ago 2025','25-Sep':'Set 2025',
  '25-Oct':'Ott 2025','25-Nov':'Nov 2025','25-Dec':'Dic 2025','26-Jan':'Gen 2026','26-Feb':'Feb 2026'
};

// ── TAB SWITCH ────────────────────────────────────────────
function switchPanel(id, btn) {
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const panelDati       = document.getElementById('panel-dati');
  const panelNota       = document.getElementById('panel-nota');
  const panelInsights   = document.getElementById('panel-insights');
  const panelInsAio     = document.getElementById('panel-insights-aio');
  const tabStrip        = document.getElementById('tab-strip-dati');
  panelDati.style.display     = 'none';
  panelNota.style.display     = 'none';
  if (panelInsights) panelInsights.style.display = 'none';
  if (panelInsAio)   panelInsAio.style.display   = 'none';
  tabStrip.style.display      = 'none';
  if (id === 'dati') {
    panelDati.style.display = 'flex';
    tabStrip.style.display  = 'flex';
    document.getElementById('ptitle').innerHTML = 'Dati <span class="tt-sub">| Comscore</span>';
  } else if (id === 'insights') {
    if (panelInsights) panelInsights.style.display = 'flex';
    document.getElementById('ptitle').innerHTML = 'Insights <span class="tt-sub">| AI Chatbot</span>';
    initInsights();
  } else if (id === 'insights-aio') {
    if (panelInsAio) panelInsAio.style.display = 'flex';
    document.getElementById('ptitle').innerHTML = 'Competition <span class="tt-sub">| AI Overview</span>';
    if (typeof initInsightsAio === 'function') initInsightsAio();
  } else {
    panelNota.style.display = 'flex';
    document.getElementById('ptitle').innerHTML = 'Nota metodologica';
    buildNota();
  }
}

function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const chatbotPanel   = document.getElementById('subpanel-chatbot');
  const cocitationPanel = document.getElementById('subpanel-cocitation');
  const aioPanel       = document.getElementById('subpanel-aio');
  chatbotPanel.style.display    = tab === 'chatbot'    ? '' : 'none';
  cocitationPanel.style.display = tab === 'cocitation' ? '' : 'none';
  aioPanel.style.display        = tab === 'aio'        ? '' : 'none';
  if (tab === 'chatbot') {
    ACTIVE_COLS = COLS_CHATBOT;
    rebuildHeaders();
  } else if (tab === 'cocitation') {
    rebuildHeadersCc();
    if (!RAW_CC.length) loadDataCc();
  } else {
    rebuildHeadersAio();
    if (!RAW_AIO.length) loadDataAio();
  }
}

// ══════════════════════════════════════════════════════════
// CO-CITATION — STATE, RENDER, FILTERS, SORT, EXPORT
// ══════════════════════════════════════════════════════════

let RAW_CC = [];
let filteredCc = [];
let sortKeyCc = 'ai_visitors', sortDirCc = -1, sortTypeCc = 'n';
let hiddenGroupsCc = new Set();

const MESELAB_CC = { 'Dec-25': 'Dic 2025', 'Jan-26': 'Gen 2026', 'Feb-26': 'Feb 2026' };

// ── CO-CITATION DATA LOADING ──────────────────────────────
async function loadDataCc() {
  showLoading(true);
  try {
    let all = [], offset = 0;
    const limit  = 500;
    const fields = 'month,chatbot,domain,cocited_domain,ai_visitors,ai_convos,ai_prompts,pct_uv_share,pct_convo_share,pct_prompt_share';
    while (true) {
      let batch;
      try {
        batch = await supa.query('co_citation', `select=${fields}&order=month.desc,chatbot.asc,domain.asc,ai_visitors.desc&limit=${limit}&offset=${offset}`);
      } catch(e) {
        if (e.message && (e.message.includes('JWT') || e.message.includes('expired') || e.message.includes('401'))) {
          await refreshToken();
          batch = await supa.query('co_citation', `select=${fields}&order=month.desc,chatbot.asc,domain.asc,ai_visitors.desc&limit=${limit}&offset=${offset}`);
        } else throw e;
      }
      all = all.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    RAW_CC = all.map(r => ({
      mese:             r.month,
      chatbot:          r.chatbot,
      domain:           r.domain,
      cocited_domain:   r.cocited_domain,
      ai_visitors:      r.ai_visitors,
      ai_convos:        r.ai_convos,
      ai_prompts:       r.ai_prompts,
      pct_uv_share:     r.pct_uv_share,
      pct_convo_share:  r.pct_convo_share,
      pct_prompt_share: r.pct_prompt_share,
    }));
    showLoading(false);
    filteredCc = RAW_CC.filter(r => r.chatbot === 'Total' && r.domain !== r.cocited_domain);
    sortKeyCc = 'ai_visitors'; sortDirCc = -1; sortTypeCc = 'n';
    sortAndRenderCc();
    updateSidebarFooter();
  } catch(e) {
    showLoading(false);
    showError('Errore caricamento Co-citation: ' + e.message);
  }
}

// ── CO-CITATION RENDER ────────────────────────────────────
function renderCc() {
  const tbody = document.getElementById('cc-tbody');
  if (!filteredCc.length) {
    tbody.innerHTML = '';
    document.getElementById('cc-nores').style.display = 'block';
    updateStatusCc();
    return;
  }
  document.getElementById('cc-nores').style.display = 'none';

  tbody.innerHTML = filteredCc.map(r => {
    const isSelf = r.domain === r.cocited_domain;
    const cocitedCell = isSelf
      ? `<span class="lb tot">${r.cocited_domain}</span>`
      : `<span class="cs">${r.cocited_domain}</span>`;
    return `<tr>
<td class="cc-g-id cell-mese">${MESELAB_CC[r.mese] || r.mese}</td>
<td class="cc-g-id">${llmCell(r.chatbot)}</td>
<td class="cc-g-id"><span class="cs">${r.domain}</span></td>
<td class="cc-g-id">${cocitedCell}</td>
<td class="cc-g-vol gs cn">${fmtN(r.ai_visitors)}</td>
<td class="cc-g-vol cn">${fmtN(r.ai_convos)}</td>
<td class="cc-g-vol cn">${fmtN(r.ai_prompts)}</td>
<td class="cc-g-pct gs cn">${r.pct_uv_share != null ? fmtD(r.pct_uv_share, 0) + ' %' : '—'}</td>
<td class="cc-g-pct cn">${r.pct_convo_share != null ? fmtD(r.pct_convo_share, 0) + ' %' : '—'}</td>
<td class="cc-g-pct cn">${r.pct_prompt_share != null ? fmtD(r.pct_prompt_share, 0) + ' %' : '—'}</td>
</tr>`;
  }).join('');

  hiddenGroupsCc.forEach(g => document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none'));
  updateStatusCc();
}

// ── CO-CITATION STATUS ────────────────────────────────────
function updateStatusCc() {
  const n = filteredCc.length;
  document.getElementById('cc-cnt-s').textContent = n.toLocaleString('it-IT');
  document.getElementById('cc-cnt-t').textContent = RAW_CC.length.toLocaleString('it-IT');

  const meseVal    = document.getElementById('cc-f-mese').value;
  const chatbotVal = document.getElementById('cc-f-chatbot').value;
  const meseLabel  = meseVal ? (MESELAB_CC[meseVal] || meseVal) : 'Tutti i mesi';
  const llmLabel   = LLMLAB[chatbotVal] || chatbotVal;
  const el = document.getElementById('cc-card-title');
  if (el) el.textContent = `AI Co-citation — ${meseLabel} · ${llmLabel}`;

  const sub = document.getElementById('cc-card-sub');
  if (sub) {
    const sk = {
      'mese':             'Mese',
      'chatbot':          'Chatbot',
      'domain':           'Domain',
      'cocited_domain':   'Co-cited Domain',
      'ai_visitors':      'AI Visitors',
      'ai_convos':        'AI Convos',
      'ai_prompts':       'AI Prompts',
      'pct_uv_share':     '% AI Visitors Share',
      'pct_convo_share':  '% AI Convos Share',
      'pct_prompt_share': '% AI Prompts Share',
    };
    sub.textContent = 'Ordinati per ' + (sk[sortKeyCc] || sortKeyCc);
  }
}

// ── CO-CITATION FILTERS ───────────────────────────────────
function applyFiltersCc() {
  const mese    = document.getElementById('cc-f-mese').value;
  const chatbot = document.getElementById('cc-f-chatbot').value;
  const domain  = document.getElementById('cc-f-domain').value.toLowerCase().trim();
  const cocited = document.getElementById('cc-f-cocited').value.toLowerCase().trim();
  const visMin  = parseInt(document.getElementById('cc-f-vis').value) || 0;
  const self    = document.getElementById('cc-f-self').value;

  const domainTerms  = domain  ? domain.split(',').map(s => s.trim()).filter(s => s) : [];
  const cocitedTerms = cocited ? cocited.split(',').map(s => s.trim()).filter(s => s) : [];

  filteredCc = RAW_CC.filter(r => {
    if (mese && r.mese !== mese) return false;
    if (chatbot === '__ALL__') {} else if (chatbot && r.chatbot !== chatbot) return false;
    if (domainTerms.length  && !domainTerms.some(t => r.domain.toLowerCase().includes(t))) return false;
    if (cocitedTerms.length && !cocitedTerms.some(t => r.cocited_domain.toLowerCase().includes(t))) return false;
    if ((r.ai_visitors || 0) < visMin) return false;
    if (self === 'no_self'   && r.domain === r.cocited_domain) return false;
    if (self === 'only_self' && r.domain !== r.cocited_domain) return false;
    return true;
  });
  sortAndRenderCc();
}

function resetFiltersCc() {
  document.getElementById('cc-f-mese').value    = '';
  document.getElementById('cc-f-chatbot').value = 'Total';
  document.getElementById('cc-f-domain').value  = '';
  document.getElementById('cc-f-cocited').value = '';
  document.getElementById('cc-f-vis').value     = '';
  document.getElementById('cc-f-self').value    = 'no_self';
  applyFiltersCc();
}

// ── CO-CITATION SORT ──────────────────────────────────────
function doSortCc(th) {
  const k = th.dataset.k, t2 = th.dataset.t;
  if (sortKeyCc === k) sortDirCc *= -1; else { sortKeyCc = k; sortDirCc = 1; sortTypeCc = t2; }
  document.querySelectorAll('#cc-thead-row th').forEach(h => h.classList.remove('sa','sd'));
  th.classList.add(sortDirCc === 1 ? 'sa' : 'sd');
  sortAndRenderCc();
}
function sortAndRenderCc() {
  filteredCc.sort((a, b) => {
    const av = a[sortKeyCc], bv = b[sortKeyCc];
    if (sortTypeCc === 'n') return ((av ?? -Infinity) - (bv ?? -Infinity)) * sortDirCc;
    return String(av || '').localeCompare(String(bv || '')) * sortDirCc;
  });
  renderCc();
}

// ── CO-CITATION COL TOGGLE ────────────────────────────────
function togGCc(btn) {
  const g = btn.dataset.g;
  if (hiddenGroupsCc.has(g)) {
    hiddenGroupsCc.delete(g);
    btn.classList.add('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = '');
  } else {
    hiddenGroupsCc.add(g);
    btn.classList.remove('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none');
  }
}

// ── CO-CITATION EXPORT ────────────────────────────────────
function exportExcelCc() {
  if (!filteredCc.length) { alert('Nessun dato da esportare.'); return; }
  const headers = [
    'Mese', 'Chatbot', 'Domain', 'Co-cited Domain',
    'AI Visitors', 'AI Convos', 'AI Prompts',
    '% AI Visitors Share', '% AI Convos Share', '% AI Prompts Share'
  ];
  const rows = filteredCc.map(r => [
    MESELAB_CC[r.mese] || r.mese,
    LLMLAB[r.chatbot] || r.chatbot,
    r.domain, r.cocited_domain,
    r.ai_visitors, r.ai_convos, r.ai_prompts,
    r.pct_uv_share, r.pct_convo_share, r.pct_prompt_share
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:28},{wch:14},{wch:12},{wch:12},{wch:20},{wch:18},{wch:20}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AI Co-citation');
  const mese  = document.getElementById('cc-f-mese').value || 'tutti';
  const llm   = document.getElementById('cc-f-chatbot').value || 'Total';
  const today = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `sensemakers_cocitation_${mese}_${llm}_${today}.xlsx`.toLowerCase().replace(/ /g,'_'));
}

// ── AIO DATA LOADING ──────────────────────────────────────
async function loadDataAio() {
  showLoading(true);
  try {
    let all = [], offset = 0;
    const limit  = 500;
    const fields = 'month,search_domain,search_cat,cited_domain,rank,searchers,searches,clickers,clicks,clickers_to_domain,clicks_to_domain,pct_conv_clickers,pct_conv_clicks,pct_conv_to_domain_clickers,pct_conv_to_domain_clicks,comscore_category,geo';
    while (true) {
      let batch;
      try {
        batch = await supa.query('aio', `select=${fields}&order=month.desc,search_cat.asc,rank.asc&limit=${limit}&offset=${offset}`);
      } catch(e) {
        if (e.message && (e.message.includes('JWT') || e.message.includes('expired') || e.message.includes('401'))) {
          await refreshToken();
          batch = await supa.query('aio', `select=${fields}&order=month.desc,search_cat.asc,rank.asc&limit=${limit}&offset=${offset}`);
        } else throw e;
      }
      all = all.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    RAW_AIO = all.map(r => ({
      mese:    normaliseMonthAio(r.month),
      se:      r.search_domain || 'TOTAL',
      cat:     r.search_cat,
      cited:   r.cited_domain,
      cat_domain: r.comscore_category || null,
      geo:        r.geo || null,
      rank:    r.rank,
      searchers: r.searchers,
      searches:  r.searches,
      clickers:  r.clickers,
      clicks:    r.clicks,
      clickers_to_domain: r.clickers_to_domain,
      clicks_to_domain:   r.clicks_to_domain,
      pct_conv_clk:  r.pct_conv_clickers,
      pct_conv_srch: r.pct_conv_clicks,
      pct_ctd_clk:   r.pct_conv_to_domain_clickers,
      pct_ctd_srch:  r.pct_conv_to_domain_clicks,
    }));
    showLoading(false);
    filteredAio = RAW_AIO.filter(r => r.se === 'TOTAL');
    // Default sort: searchers decrescente
    sortKeyAio = 'searchers'; sortDirAio = -1; sortTypeAio = 'n';
    sortAndRenderAio();
    updateSidebarFooter();
  } catch(e) {
    showLoading(false);
    showError('Errore caricamento AIO: ' + e.message);
  }
}

function normaliseMonthAio(m) {
  // '25-Apr' → rimane '25-Apr' (già nel formato AIO)
  return m || '';
}

// ── AIO RENDER ────────────────────────────────────────────
function renderAio() {
  const tbody = document.getElementById('aio-tbody');
  if (!filteredAio.length) {
    tbody.innerHTML = '';
    document.getElementById('aio-nores').style.display = 'block';
    updateStatusAio();
    return;
  }
  document.getElementById('aio-nores').style.display = 'none';

  tbody.innerHTML = filteredAio.map(r => {
    const isAgg  = r.cited === 'TOTAL';
    const citedCell = isAgg
      ? `<span class="lb tot">TOTAL</span>`
      : `<span class="cs">${r.cited}</span>`;
    const rankCell = r.rank === 0
      ? `<span class="rk rk0">AGG</span>`
      : rankCellN(r.rank);
    return `<tr>
<td class="aio-g-id cell-mese">${MESELAB_AIO[r.mese] || r.mese}</td>
<td class="aio-g-id">${r.se || 'TOTAL'}</td>
<td class="aio-g-id">${r.cat}</td>
<td class="aio-g-id">${rankCell}</td>
<td class="aio-g-id">${citedCell}</td>
<td class="aio-g-id">${r.cat_domain || '—'}</td>
<td class="aio-g-id">${r.geo || '—'}</td>
<td class="aio-g-vol gs cn">${fmtN(r.searchers)}</td>
<td class="aio-g-vol cn">${fmtN(r.searches)}</td>
<td class="aio-g-vol aio-col-clickers cn">${fmtN(r.clickers)}</td>
<td class="aio-g-vol cn">${fmtN(r.clickers_to_domain)}</td>
<td class="aio-g-vol cn">${fmtN(r.clicks_to_domain)}</td>
<td class="aio-g-pct gs cn">${fmtPct(r.pct_conv_clk)}</td>
<td class="aio-g-pct cn">${fmtPct(r.pct_ctd_srch)}</td>
<td class="aio-g-pct cn">${fmtPct(r.pct_ctd_clk)}</td>
</tr>`;
  }).join('');

  hiddenGroupsAio.forEach(g => document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none'));
  updateStatusAio();
}

function rankCellN(pos) {
  const c = pos === 1 ? 'rk1' : pos === 2 ? 'rk2' : pos === 3 ? 'rk3' : '';
  return `<span class="rk ${c}">${pos}</span>`;
}

// ── AIO STATUS ────────────────────────────────────────────
function updateStatusAio() {
  const n = filteredAio.length;
  document.getElementById('aio-cnt-s').textContent = n.toLocaleString('it-IT');
  document.getElementById('aio-cnt-t').textContent = RAW_AIO.length.toLocaleString('it-IT');
  const meseVal = document.getElementById('aio-f-mese').value;
  const catVal  = document.getElementById('aio-f-cat').value;
  const meseLabel = meseVal ? (MESELAB_AIO[meseVal] || meseVal) : 'Tutti i mesi';
  const catLabel  = catVal || 'Tutte le categorie';
  const el = document.getElementById('aio-card-title');
  if (el) el.textContent = `AIO — ${meseLabel} · ${catLabel}`;

  const sub = document.getElementById('aio-card-sub');
  if (sub) {
    const sk = {
      'mese':                 'Mese',
      'cat':                  'Search Category',
      'rank':                 'Rank',
      'cited':                'Domain',
      'searchers':            'Searchers',
      'searches':             'Searches',
      'clickers':             'Clickers',
      'clickers_to_domain':   'Clickers to Domain',
      'se':                   'Search Engine',
      'se':                   'Search Engine',
      'pct_conv_clk':         '% Conv. Clickers',
      'pct_ctd_clk':          '% Conv. To Domain (Clickers)',
    };
    sub.textContent = 'Ordinati per ' + (sk[sortKeyAio] || sortKeyAio);
  }
}

// ── AIO FILTERS ───────────────────────────────────────────
function applyFiltersAio() {
  const mese   = document.getElementById('aio-f-mese').value;
  const cat    = document.getElementById('aio-f-cat').value;
  const sito    = document.getElementById('aio-f-sito').value.toLowerCase().trim();
  // Ricerca multipla: separa per virgola, logica OR
  const sitoTerms = sito ? sito.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
  const rkMin  = parseInt(document.getElementById('aio-f-rk-min').value);
  const rkMax  = parseInt(document.getElementById('aio-f-rk-max').value);
  const srchMin = parseInt(document.getElementById('aio-f-srch').value) || 0;
  const agg    = document.getElementById('aio-f-agg').value;

  const catDomFilt = document.getElementById('aio-f-cat-domain') ? document.getElementById('aio-f-cat-domain').value : '';
  const geoAioFilt  = document.getElementById('aio-f-geo') ? document.getElementById('aio-f-geo').value : '';
  const seFilt = document.getElementById('aio-f-se') ? document.getElementById('aio-f-se').value : 'TOTAL';
  filteredAio = RAW_AIO.filter(r => {
    if (mese && r.mese !== mese) return false;
    if (r.se !== (seFilt || 'TOTAL')) return false;
    if (cat  && r.cat  !== cat)  return false;
    if (sitoTerms.length > 0 && !sitoTerms.some(t => r.cited.toLowerCase().includes(t))) return false;
    if (!isNaN(rkMin) && r.rank < rkMin) return false;
    if (!isNaN(rkMax) && r.rank > rkMax) return false;
    if ((r.searchers || 0) < srchMin) return false;
    if (agg === 'only_domains' && r.cited === 'TOTAL') return false;
    if (agg === 'only_agg'     && r.cited !== 'TOTAL') return false;
    if (catDomFilt && r.cat_domain !== catDomFilt) return false;
    if (geoAioFilt  && r.geo        !== geoAioFilt)  return false;
    return true;
  });
  sortAndRenderAio();
}

function resetFiltersAio() {
  ['aio-f-mese','aio-f-cat','aio-f-agg'].forEach(id => document.getElementById(id).value = id === 'aio-f-agg' ? 'all' : '');
  if (document.getElementById('aio-f-se')) document.getElementById('aio-f-se').value = 'TOTAL';
  if (document.getElementById('aio-f-se')) document.getElementById('aio-f-se').value = 'TOTAL';
  ['aio-f-sito','aio-f-rk-min','aio-f-rk-max','aio-f-srch'].forEach(id => document.getElementById(id).value = '');
  if (document.getElementById('aio-f-cat-domain')) document.getElementById('aio-f-cat-domain').value = '';
  if (document.getElementById('aio-f-geo')) document.getElementById('aio-f-geo').value = '';
  applyFiltersAio();
}

// ── AIO SORT ──────────────────────────────────────────────
function doSortAio(th) {
  const k = th.dataset.k, t2 = th.dataset.t;
  if (sortKeyAio === k) sortDirAio *= -1; else { sortKeyAio = k; sortDirAio = 1; sortTypeAio = t2; }
  document.querySelectorAll('#aio-thead-row th').forEach(h => h.classList.remove('sa','sd'));
  th.classList.add(sortDirAio === 1 ? 'sa' : 'sd');
  sortAndRenderAio();
}
function sortAndRenderAio() {
  filteredAio.sort((a, b) => {
    const av = a[sortKeyAio], bv = b[sortKeyAio];
    if (sortTypeAio === 'n') return ((av ?? -Infinity) - (bv ?? -Infinity)) * sortDirAio;
    return String(av || '').localeCompare(String(bv || '')) * sortDirAio;
  });
  renderAio();
}

// ── AIO COL TOGGLE ────────────────────────────────────────
function togGAio(btn) {
  const g = btn.dataset.g;
  if (hiddenGroupsAio.has(g)) {
    hiddenGroupsAio.delete(g);
    btn.classList.add('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = '');
  } else {
    hiddenGroupsAio.add(g);
    btn.classList.remove('on');
    document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none');
  }
}

// ── AIO EXPORT ────────────────────────────────────────────
function exportExcelAio() {
  if (!filteredAio.length) { alert('Nessun dato da esportare.'); return; }
  const headers = [
    'Mese','Search Engine','Categoria','Rank','Dominio citato','Domain Category','Geo',
    'Searchers','Searches','Clickers','Clicks','Clickers to Domain','Clicks to Domain',
    '% Conv Clickers','% Conv Clicks','% Conv to Domain (Clickers)','% Conv to Domain (Clicks)'
  ];
  const rows = filteredAio.map(r => [
    MESELAB_AIO[r.mese] || r.mese, r.se || 'TOTAL', r.cat, r.rank, r.cited, r.cat_domain || '', r.geo || '',
    r.searchers, r.searches, r.clickers, r.clicks, r.clickers_to_domain, r.clicks_to_domain,
    r.pct_conv_clk  != null ? parseFloat((r.pct_conv_clk  * 100).toFixed(2)) : null,
    r.pct_conv_srch != null ? parseFloat((r.pct_conv_srch * 100).toFixed(2)) : null,
    r.pct_ctd_clk   != null ? parseFloat((r.pct_ctd_clk   * 100).toFixed(2)) : null,
    r.pct_ctd_srch  != null ? parseFloat((r.pct_ctd_srch  * 100).toFixed(2)) : null,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:6},{wch:28},{wch:28},{wch:6},{wch:12},{wch:12},{wch:12},{wch:12},{wch:18},{wch:16},{wch:18},{wch:14},{wch:26},{wch:24}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AIO');
  const mese = document.getElementById('aio-f-mese').value || 'tutti';
  const cat  = document.getElementById('aio-f-cat').value  || 'all';
  const today = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `sensemakers_aio_${mese}_${cat}_${today}.xlsx`.toLowerCase().replace(/ /g,'_'));
}
