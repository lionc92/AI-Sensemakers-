// ── INSIGHTS AIO MODULE ───────────────────────────────────
// Legge da RAW_AIO (già in memoria da app.js), zero fetch aggiuntivi.
// Gestisce la sezione Competition > AI Overview.

// ── COLORI FISSI PER DOMINI ───────────────────────────────
const AIO_DOMAIN_COLORS = [
  '#534AB7', '#1D9E75', '#D85A30', '#BA7517', '#888780',
];

// ── STATO ─────────────────────────────────────────────────
let aioDomains    = [];
let aioMetric     = 'searchers';
let aioCat        = '';           // '' = TOTAL aggregato tutte le search cat
let aioChartsInst = {};

// ── UTILS ─────────────────────────────────────────────────
function afmt(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  if (n >= 1000)    return Math.round(n / 1000).toLocaleString('it-IT') + 'K';
  return Math.round(n).toLocaleString('it-IT');
}

function apct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// ── MESI — derivati dinamicamente da RAW_AIO ─────────────
// FIX BUG 2: non più hardcoded — usa MESELAB_AIO da app.js
// Ordine cronologico garantito da sort() sul formato YY-Mon
function aioAvailableMonths() {
  const set = new Set(
    RAW_AIO.filter(r => r.se === 'TOTAL').map(r => r.mese)
  );
  return [...set].sort((a, b) => {
    // Formato: '25-Apr', '26-Jan' — ordina per anno poi per mese
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [ya, ma] = a.split('-');
    const [yb, mb] = b.split('-');
    if (ya !== yb) return parseInt(ya) - parseInt(yb);
    return months.indexOf(ma) - months.indexOf(mb);
  });
}

function aioLastMonth() {
  const avail = aioAvailableMonths();
  return avail[avail.length - 1] || null;
}

function aioMeseLabel(m) {
  // Usa MESELAB_AIO da app.js — già aggiornato con tutti i mesi
  return (typeof MESELAB_AIO !== 'undefined' && MESELAB_AIO[m]) || m;
}

// ── DATI HELPERS ──────────────────────────────────────────
// FIX BUG 1 & 4: filtra sempre r.se === 'TOTAL' per evitare doppi conteggi

function aioGetDomainRows(domain, catDomain) {
  // se=TOTAL: righe aggregate per search_domain
  // Usa sempre search_cat=TOTAL (searchers aggregati su tutte le query)
  // catDomain: filtra per cat_domain (Domain Category) se specificata
  return RAW_AIO.filter(r => {
    if (r.cited !== domain) return false;
    if (r.se !== 'TOTAL') return false;
    if (r.cat !== 'TOTAL') return false;           // sempre aggregato search_cat
    if (catDomain && r.cat_domain !== catDomain) return false;
    return true;
  });
}

function aioGetValue(domain, mese, catDomain) {
  // Cerca sempre search_cat=TOTAL (aggregato query), filtra per cat_domain se specificata
  const rows = RAW_AIO.filter(r =>
    r.cited  === domain &&
    r.mese   === mese &&
    r.se     === 'TOTAL' &&
    r.cat    === 'TOTAL' &&
    (!catDomain || r.cat_domain === catDomain)
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (aioMetric === 'searchers')    return r.searchers;
  if (aioMetric === 'pct_conv_clk') return r.pct_conv_clk;
  if (aioMetric === 'pct_ctd_clk')  return r.pct_ctd_clk;
  return r.searchers;
}

function aioAvgSearchers(domain) {
  const rows = aioGetDomainRows(domain, '');     // già filtrate su se=TOTAL, cat=TOTAL
  const vals = rows.map(r => r.searchers).filter(v => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function aioAllCats() {
  // Domain Category (comscore_category) — proprietà del dominio citato, non della query
  const set = new Set(
    RAW_AIO.filter(r => r.se === 'TOTAL' && r.cat === 'TOTAL' && r.cat_domain).map(r => r.cat_domain)
  );
  return [...set].sort();
}

// ── RENDER KPI ────────────────────────────────────────────
function aioRenderKpis() {
  const container = document.getElementById('aio-kpi-container');
  if (!container) return;

  if (!aioDomains.length) {
    container.innerHTML = `<div style="grid-column:1/-1;background:var(--surface2);border-radius:9px;padding:20px 18px;text-align:center">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">Aggiungi i domini da analizzare</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6">Inserisci fino a 5 domini nel campo qui sopra per confrontare la loro visibilità nelle AI Overview di Google.<br>
      <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">Es: corriere.it · repubblica.it · ansa.it</span></div>
    </div>`;
    return;
  }

  const metricLabel = {
    searchers:    'Searchers (media mensile)',
    pct_conv_clk: '% Conv. Clickers (media mensile)',
    pct_ctd_clk:  '% Conv. To Domain (media mensile)',
  }[aioMetric] || 'Searchers';

  const avail = aioAvailableMonths();
  const nMesi = avail.length;

  container.innerHTML = aioDomains.map((domain, i) => {
    const rows = aioGetDomainRows(domain, '');  // se=TOTAL, cat=TOTAL
    let valFmt;

    if (aioMetric === 'searchers') {
      valFmt = afmt(aioAvgSearchers(domain));
    } else {
      const vals = rows.map(r => aioMetric === 'pct_conv_clk' ? r.pct_conv_clk : r.pct_ctd_clk)
        .filter(v => v != null && isFinite(v));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      valFmt = avg != null ? apct(avg) : '—';
    }

    // FIX BUG 1: conta mesi effettivi per questo dominio (non tutte le righe)
    const mesiDominio = new Set(rows.map(r => r.mese)).size;
    const color = AIO_DOMAIN_COLORS[i] || '#888780';

    return `<div class="ins-kpi">
      <div class="ins-kpi-label">${metricLabel} · ${domain}</div>
      <div class="ins-kpi-val" style="color:${color}">${valFmt}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;font-family:'DM Mono',monospace">${mesiDominio} mesi disponibili</div>
    </div>`;
  }).join('');
}

// ── CHART 1: TREND METRICA NEL TEMPO ─────────────────────
function aioRenderChart1() {
  const avail  = aioAvailableMonths();
  const labels = avail.map(m => aioMeseLabel(m));
  const isPct  = aioMetric !== 'searchers';

  const datasets = aioDomains.map((domain, i) => {
    const data = avail.map(m => {
      const v = aioGetValue(domain, m, aioCat);
      return v != null ? (isPct ? parseFloat((v * 100).toFixed(2)) : v) : null;
    });
    return {
      label: domain,
      data,
      backgroundColor: AIO_DOMAIN_COLORS[i] || '#888780',
      borderRadius: 2,
      borderSkipped: false,
    };
  });

  if (aioChartsInst.c1) { aioChartsInst.c1.destroy(); aioChartsInst.c1 = null; }
  const el = document.getElementById('aio-chart1');
  if (!el) return;

  aioChartsInst.c1 = new Chart(el, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (v == null) return ' ' + ctx.dataset.label + ': n/d';
              return ' ' + ctx.dataset.label + ': ' + (isPct ? v.toFixed(1) + '%' : afmt(v));
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#888780', autoSkip: false, maxRotation: 0 } },
        y: { grid: { color: 'rgba(128,128,128,0.07)' }, ticks: { font: { size: 10 }, color: '#888780', callback: v => isPct ? v + '%' : afmt(v) } }
      }
    }
  });

  const sub = document.getElementById('aio-chart1-sub');
  const metricLabel = { searchers: 'Searchers', pct_conv_clk: '% Conv. Clickers', pct_ctd_clk: '% Conv. To Domain (Clickers)' }[aioMetric] || 'Searchers';
  const catLabel = aioCat || 'tutte le categorie';
  if (sub) sub.textContent = `${metricLabel} · ${catLabel} · mensile`;
}

// ── CHART 2: % Conv. To Domain (Clickers) LINE ───────────
function aioRenderChart2() {
  const avail  = aioAvailableMonths();
  const labels = avail.map(m => aioMeseLabel(m));

  const datasets = aioDomains.map((domain, i) => {
    const data = avail.map(m => {
      const rows = RAW_AIO.filter(r =>
        r.cited  === domain &&
        r.mese   === m &&
        r.se     === 'TOTAL' &&
        r.cat    === 'TOTAL' &&
        (!aioCat || r.cat_domain === aioCat)
      );
      if (!rows.length || rows[0].pct_ctd_clk == null) return null;
      return parseFloat((rows[0].pct_ctd_clk * 100).toFixed(2));
    });
    return {
      label: domain,
      data,
      borderColor: AIO_DOMAIN_COLORS[i] || '#888780',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: AIO_DOMAIN_COLORS[i] || '#888780',
      tension: 0.3,
      spanGaps: false,
    };
  });

  if (aioChartsInst.c2) { aioChartsInst.c2.destroy(); aioChartsInst.c2 = null; }
  const el = document.getElementById('aio-chart2');
  if (!el) return;

  aioChartsInst.c2 = new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (v == null) return ' ' + ctx.dataset.label + ': n/d';
              return ' ' + ctx.dataset.label + ': ' + v.toFixed(1) + '%';
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#888780', autoSkip: false, maxRotation: 0 } },
        y: { grid: { color: 'rgba(128,128,128,0.07)' }, ticks: { font: { size: 10 }, color: '#888780', callback: v => v + '%' } }
      }
    }
  });

  const sub = document.getElementById('aio-chart2-sub');
  const catLabel = aioCat || 'tutte le categorie';
  if (sub) sub.textContent = `% Conv. To Domain (Clickers) · ${catLabel} · mensile`;
}

// ── CHART 3: SEARCHERS PER DOMAIN CATEGORY ──────────────
function aioRenderChart3() {
  const lastM = aioLastMonth();
  if (!lastM) return;

  // Asse Y = Domain Category (cat_domain) dei domini aggiunti
  // Un dominio ha una sola cat_domain — barre mostrano searchers TOTAL per quel dominio
  const catSet = new Set();
  aioDomains.forEach(d => {
    const row = RAW_AIO.find(r =>
      r.cited === d && r.se === 'TOTAL' && r.cat === 'TOTAL' && r.mese === lastM
    );
    if (row && row.cat_domain) catSet.add(row.cat_domain);
    else if (row) catSet.add('Non classificato');
  });
  const cats = [...catSet].sort();

  if (!cats.length) {
    const el = document.getElementById('aio-chart3');
    if (el) el.parentElement.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:20px 0;text-align:center">Nessuna Domain Category disponibile per i domini selezionati.</div>';
    return;
  }

  // Per ogni categoria: una barra per ogni domain che appartiene a quella categoria
  const datasets = aioDomains.map((domain, i) => {
    const data = cats.map(cat => {
      const row = RAW_AIO.find(r =>
        r.cited  === domain &&
        r.mese   === lastM &&
        r.se     === 'TOTAL' &&
        r.cat    === 'TOTAL' &&
        ((r.cat_domain || 'Non classificato') === cat)
      );
      return row ? (row.searchers || 0) : 0;
    });
    return {
      label: domain,
      data,
      backgroundColor: AIO_DOMAIN_COLORS[i] || '#888780',
      borderRadius: 2,
      borderSkipped: false,
    };
  });

  if (aioChartsInst.c3) { aioChartsInst.c3.destroy(); aioChartsInst.c3 = null; }
  const el = document.getElementById('aio-chart3');
  if (!el) return;

  const barHeight = 28;
  const wrapHeight = Math.max(120, cats.length * barHeight * aioDomains.length + 80);
  el.parentElement.style.height = wrapHeight + 'px';

  aioChartsInst.c3 = new Chart(el, {
    type: 'bar',
    data: { labels: cats, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + afmt(ctx.parsed.x) }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(128,128,128,0.07)' }, ticks: { font: { size: 10 }, color: '#888780', callback: v => afmt(v) } },
        y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#444441' } }
      }
    }
  });

  const sub = document.getElementById('aio-chart3-sub');
  if (sub) sub.textContent = `Searchers per Domain Category · ${aioMeseLabel(lastM)} · domini selezionati`;
}

// ── RENDER LEGENDA DOMINI ────────────────────────────────
function aioRenderLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = aioDomains.map((d, i) =>
    `<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)">
      <span style="width:9px;height:9px;border-radius:2px;background:${AIO_DOMAIN_COLORS[i] || '#888'};display:inline-block"></span>${d}
    </span>`
  ).join('');
}

// ── RENDER CHIPS DOMINI ──────────────────────────────────
function aioRenderChips() {
  const container = document.getElementById('aio-domain-chips');
  if (!container) return;

  const chips = aioDomains.map((d, i) => {
    const color = AIO_DOMAIN_COLORS[i];
    return `<div class="aio-chip" style="
      display:inline-flex;align-items:center;gap:5px;padding:4px 10px 4px 8px;
      border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;
      background:${color}18;color:${color};border:0.5px solid ${color}44;margin-right:4px
    " onclick="aioRemoveDomain('${d}')">
      <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></span>
      ${d}
      <span style="font-size:10px;opacity:.7;margin-left:2px">×</span>
    </div>`;
  }).join('');

  const addBtn = aioDomains.length < 5
    ? `<div id="aio-add-wrap" style="display:inline-flex;align-items:center;gap:5px">
        <input id="aio-domain-input" type="text" placeholder="aggiungi dominio…"
          style="font-size:11px;padding:4px 9px;border:0.5px dashed var(--border2);
          border-radius:20px;background:var(--surface2);color:var(--text);outline:none;width:160px;font-family:'DM Mono',monospace"
          onkeydown="if(event.key==='Enter')aioAddDomain()"
        >
        <button onclick="aioAddDomain()" style="font-size:10px;padding:3px 9px;border:0.5px solid var(--border2);
          border-radius:20px;background:var(--surface2);color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif">
          +
        </button>
       </div>`
    : `<span style="font-size:10px;color:var(--text3);padding:4px 0">Max 5 domini</span>`;

  container.innerHTML = chips + addBtn;
}

// ── ADD / REMOVE DOMAIN ──────────────────────────────────
function aioAddDomain() {
  const input = document.getElementById('aio-domain-input');
  if (!input) return;
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  if (aioDomains.includes(val)) { input.value = ''; return; }
  if (aioDomains.length >= 5) return;

  const exists = RAW_AIO.some(r => r.cited === val && r.se === 'TOTAL');
  if (!exists) {
    input.style.borderColor = 'var(--red)';
    input.title = 'Dominio non trovato nel dataset AIO';
    setTimeout(() => { input.style.borderColor = ''; input.title = ''; }, 2000);
    return;
  }

  aioDomains.push(val);
  input.value = '';
  aioRenderAll();
}

function aioRemoveDomain(domain) {
  aioDomains = aioDomains.filter(d => d !== domain);
  aioRenderAll();
}

// ── FILTER HANDLERS ───────────────────────────────────────
function aioOnMetricChange() {
  const sel = document.getElementById('aio-f-metric');
  if (!sel) return;
  aioMetric = sel.value;
  aioRenderKpis();
  aioRenderChart1();
  aioRenderLegend('aio-chart1-legend');
}

function aioOnCatChange() {
  const sel = document.getElementById('aio-ins-f-cat');
  if (!sel) return;
  aioCat = sel.value;
  aioRenderChart1();
  aioRenderChart2();
  aioRenderLegend('aio-chart1-legend');
  aioRenderLegend('aio-chart2-legend');
  const sub = document.getElementById('aio-ins-card-sub');
  if (sub) {
    const last = aioLastMonth();
    sub.textContent = `${aioMeseLabel(last)} · dati Comscore Panel IT`;
  }
}

// ── POPOLA SELECT CATEGORIE ───────────────────────────────
function aioPopulateCatSelect() {
  const sel = document.getElementById('aio-ins-f-cat');
  if (!sel) return;
  // Reset e ripopola sempre — preserva selezione corrente se ancora valida
  const prev = aioCat;
  while (sel.options.length > 1) sel.remove(1);
  const cats = aioAllCats();
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === prev) opt.selected = true;
    sel.appendChild(opt);
  });
  // Rileggi il valore effettivo dopo il repopulate
  aioCat = sel.value;
}

// ── RENDER COMPLETO ───────────────────────────────────────
function aioRenderAll() {
  aioRenderChips();
  aioRenderKpis();
  if (aioDomains.length) {
    aioRenderChart1();
    aioRenderChart2();
    aioRenderChart3();
    aioRenderLegend('aio-chart1-legend');
    aioRenderLegend('aio-chart2-legend');
    aioRenderLegend('aio-chart3-legend');
  }

  const title = document.getElementById('aio-ins-card-title');
  const sub   = document.getElementById('aio-ins-card-sub');
  const last  = aioLastMonth();
  if (title) title.textContent = 'Competition · AI Overview';
  if (sub)   sub.textContent   = `${aioMeseLabel(last)} · dati Comscore Panel IT`;
}

// ── ENTRY POINT ───────────────────────────────────────────
function initInsightsAio() {
  if (!RAW_AIO.length) {
    const title = document.getElementById('aio-ins-card-title');
    const sub   = document.getElementById('aio-ins-card-sub');
    if (title) title.textContent = 'Competition · AI Overview';
    if (sub)   sub.textContent   = 'Caricamento dati…';
    if (typeof loadDataAio === 'function' && !window._aioLoading) {
      window._aioLoading = true;
      const p = loadDataAio();
      if (p && p.then) p.then(() => { window._aioLoading = false; _aioAfterLoad(); })
                        .catch(() => { window._aioLoading = false; });
    }
    return;
  }
  _aioAfterLoad();
}

function _aioAfterLoad() {
  aioPopulateCatSelect();
  aioRenderChips();
  aioRenderKpis();
  const title = document.getElementById('aio-ins-card-title');
  const sub   = document.getElementById('aio-ins-card-sub');
  const last  = aioLastMonth();
  if (title) title.textContent = 'Competition · AI Overview';
  if (sub)   sub.textContent   = `${aioMeseLabel(last)} · dati Comscore Panel IT`;
}
