// ── INSIGHTS MODULE ───────────────────────────────────────
// Legge da RAW (già in memoria da app.js), zero fetch aggiuntivi.
// Gestisce la sezione Insights > AI Chatbot (Blocco 1).
// File separato — non tocca la logica tabellare esistente.

// ── COSTANTI ──────────────────────────────────────────────
// Mappa di tutti i mesi possibili in ordine cronologico.
// Aggiungere qui i mesi futuri man mano che arrivano.
// insightsAvailableMonths() filtra solo quelli presenti in RAW,
// quindi aggiungere voci future non rompe nulla.
const INSIGHTS_MONTHS_ORDER = [
  'Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26',
  'Jun-26','Jul-26','Aug-26','Sep-26','Oct-26','Nov-26','Dec-26',
];

const INSIGHTS_MESELAB = {
  'Dec-25': 'Dic 2025',
  'Jan-26': 'Gen 2026',
  'Feb-26': 'Feb 2026',
  'Mar-26': 'Mar 2026',
  'Apr-26': 'Apr 2026',
  'May-26': 'Mag 2026',
  'Jun-26': 'Giu 2026',
  'Jul-26': 'Lug 2026',
  'Aug-26': 'Ago 2026',
  'Sep-26': 'Set 2026',
  'Oct-26': 'Ott 2026',
  'Nov-26': 'Nov 2026',
  'Dec-26': 'Dic 2026',
};

// Colori fissi per i top domini (consistenti tra grafici)
const DOMAIN_COLORS = [
  '#534AB7', '#1D9E75', '#D85A30', '#BA7517',
  '#888780', '#185FA5', '#993556', '#3B6D11',
];

// ── STATO INSIGHTS ────────────────────────────────────────
let insightsChatbotLlm  = 'Total';
let insightsChatbotMese = ''; // '' = ultimo mese disponibile
let insightsCharts      = {}; // istanze Chart.js attive

// ── UTILS ─────────────────────────────────────────────────
function ifmt(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  if (n >= 1000)    return Math.round(n / 1000).toLocaleString('it-IT') + 'K';
  return Math.round(n).toLocaleString('it-IT');
}

function ipct(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
}

function idelta(curr, prev, isRank) {
  if (curr == null || prev == null) return '';
  if (isRank) {
    const d = prev - curr; // rank migliorato se scende
    if (d === 0) return '<span class="ins-delta ins-neutral">= vs mese prec.</span>';
    return d > 0
      ? `<span class="ins-delta ins-up">▲ +${d} posizioni</span>`
      : `<span class="ins-delta ins-down">▼ ${d} posizioni</span>`;
  }
  if (!prev || prev === 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  if (!isFinite(pct) || isNaN(pct)) return '';
  if (Math.abs(pct) < 0.05) return '<span class="ins-delta ins-neutral">= vs mese prec.</span>';
  const sign = pct > 0 ? '+' : '';
  const cls  = pct > 0 ? 'ins-up' : 'ins-down';
  return `<span class="ins-delta ${cls}">${sign}${pct.toFixed(1)}% vs mese prec.</span>`;
}

// ── DATI HELPERS ──────────────────────────────────────────

// Restituisce i mesi disponibili in RAW, ordinati
function insightsAvailableMonths() {
  const set = new Set(RAW.map(r => r.mese));
  return INSIGHTS_MONTHS_ORDER.filter(m => set.has(m));
}

// Ultimo mese disponibile
function insightsLastMonth() {
  const avail = insightsAvailableMonths();
  return avail[avail.length - 1] || null;
}

// Mese precedente all'ultimo
function insightsPrevMonth(mese) {
  const avail = insightsAvailableMonths();
  const idx   = avail.indexOf(mese);
  return idx > 0 ? avail[idx - 1] : null;
}

// Filtra RAW per mese e chatbot (LLM)
function insightsGetRows(mese, llm) {
  return RAW.filter(r => r.mese === mese && r.chatbot === llm);
}

// Top N domini per AI Visitors in un mese
function insightsTopDomains(mese, llm, n) {
  return insightsGetRows(mese, llm)
    .sort((a, b) => a.pos - b.pos)
    .slice(0, n);
}

// Trova riga per un dominio specifico in un mese
function insightsDomainRow(mese, llm, domain) {
  return RAW.find(r => r.mese === mese && r.chatbot === llm && r.sito === domain) || null;
}

// ── RENDER KPI CARDS ─────────────────────────────────────
function insightsRenderKpis(mese, llm) {
  const prev   = insightsPrevMonth(mese);
  const top    = insightsTopDomains(mese, llm, 1)[0];
  const topP   = prev ? insightsDomainRow(prev, llm, top?.sito) : null;
  const rows   = insightsGetRows(mese, llm);
  const rowsP  = prev ? insightsGetRows(prev, llm) : [];

  // KPI 1: AI Visitors top dominio
  const k1Val  = top?.vis_ai;
  const k1P    = topP?.vis_ai;

  // KPI 2: Non Visitors top dominio
  const k2Val  = top?.nuovi;
  const k2P    = topP?.nuovi;

  // KPI 3: % Non-Conversion top dominio
  const k3Val  = (top?.vis_ai > 0 && top?.nuovi != null) ? (top.nuovi / top.vis_ai * 100) : null;
  const k3P    = (topP?.vis_ai > 0 && topP?.nuovi != null) ? (topP.nuovi / topP.vis_ai * 100) : null;
  const k3Delta = (k3Val != null && k3P != null) ? (k3Val - k3P) : null;

  // KPI 4: Numero domini monitorati nel mese
  const k4Val  = rows.length;
  const k4P    = rowsP.length;

  const meseLabel = INSIGHTS_MESELAB[mese] || mese;

  document.getElementById('ins-kpi-container').innerHTML = `
    <div class="ins-kpi">
      <div class="ins-kpi-label">AI Visitors · ${top?.sito || '—'} · ${meseLabel}</div>
      <div class="ins-kpi-val">${ifmt(k1Val)}</div>
      ${idelta(k1Val, k1P, false)}
    </div>
    <div class="ins-kpi">
      <div class="ins-kpi-label">Non Visitors · ${top?.sito || '—'} · ${meseLabel}</div>
      <div class="ins-kpi-val">${ifmt(k2Val)}</div>
      ${idelta(k2Val, k2P, false)}
    </div>
    <div class="ins-kpi">
      <div class="ins-kpi-label">% Non-Conversion · ${top?.sito || '—'} · ${meseLabel}</div>
      <div class="ins-kpi-val">${k3Val != null ? ipct(k3Val) : '—'}</div>
      ${k3Delta != null ? `<span class="ins-delta ${k3Delta > 0 ? 'ins-up' : 'ins-down'}">${k3Delta > 0 ? '+' : ''}${k3Delta.toFixed(1)}pp vs mese prec.</span>` : ''}
    </div>
    <div class="ins-kpi">
      <div class="ins-kpi-label">Domini monitorati · ${meseLabel}</div>
      <div class="ins-kpi-val">${k4Val}</div>
      ${idelta(k4Val, k4P, false)}
    </div>`;
}

// ── CHART 1: TOP DOMINI (horizontal bar lollipop) ────────
function insightsRenderChart1(mese, llm) {
  const top = insightsTopDomains(mese, llm, 8);
  const labels = top.map(r => r.sito);
  const data   = top.map(r => r.vis_ai);
  const colors = top.map((_, i) => DOMAIN_COLORS[i] || '#888780');

  if (insightsCharts.chart1) {
    insightsCharts.chart1.destroy();
    insightsCharts.chart1 = null;
  }

  insightsCharts.chart1 = new Chart(document.getElementById('ins-chart1'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 3,
        borderSkipped: false,
        barThickness: 14,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' AI Visitors: ' + ifmt(ctx.parsed.x)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(128,128,128,0.07)' },
          ticks: { font: { size: 10 }, color: '#888780', callback: v => ifmt(v) }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#444441' }
        }
      },
      layout: { padding: { right: 6 } }
    }
  });
}

// ── CHART 2: STACKED BAR — Domain Visitors + Non Visitors ─
function insightsRenderChart2(mese, llm) {
  const top      = insightsTopDomains(mese, llm, 6);
  const labels   = top.map(r => r.sito);
  const existing = top.map(r => r.vis_tot);   // Domain Visitors
  const newAI    = top.map(r => r.nuovi);      // Non Visitors

  if (insightsCharts.chart2) {
    insightsCharts.chart2.destroy();
    insightsCharts.chart2 = null;
  }

  insightsCharts.chart2 = new Chart(document.getElementById('ins-chart2'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Domain Visitors',
          data: existing,
          backgroundColor: '#534AB7',
          borderRadius: 0,
          borderSkipped: false,
          stack: 's',
          barThickness: 14,
        },
        {
          label: 'Non Visitors',
          data: newAI,
          backgroundColor: '#1D9E75',
          borderRadius: 3,
          borderSkipped: 'bottom',
          stack: 's',
          barThickness: 14,
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + ifmt(ctx.parsed.x)
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(128,128,128,0.07)' },
          ticks: { font: { size: 10 }, color: '#888780', callback: v => ifmt(v) }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#444441' }
        }
      }
    }
  });
}

// ── CHART 3: GROUPED BAR — evoluzione mensile ─────────────
// Usa i mesi disponibili dinamicamente, non hardcoded
function insightsRenderChart3(llm) {
  const avail  = insightsAvailableMonths();
  const labels = avail.map(m => INSIGHTS_MESELAB[m] || m);

  // Top 5 domini basati sull'ultimo mese disponibile
  const lastM  = avail[avail.length - 1];
  const top5   = insightsTopDomains(lastM, llm, 5);
  const domains = top5.map(r => r.sito);

  const datasets = domains.map((domain, i) => {
    const data = avail.map(m => {
      const row = insightsDomainRow(m, llm, domain);
      return row ? row.vis_ai : null;
    });
    return {
      label: domain,
      data,
      backgroundColor: DOMAIN_COLORS[i] || '#888780',
      borderRadius: 3,
      borderSkipped: false,
    };
  });

  if (insightsCharts.chart3) {
    insightsCharts.chart3.destroy();
    insightsCharts.chart3 = null;
  }

  // Aggiorna legenda dinamicamente
  const legEl = document.getElementById('ins-chart3-legend');
  if (legEl) {
    legEl.innerHTML = domains.map((d, i) =>
      `<span class="ins-leg-item"><span class="ins-leg-sq" style="background:${DOMAIN_COLORS[i] || '#888'}"></span>${d}</span>`
    ).join('');
  }

  insightsCharts.chart3 = new Chart(document.getElementById('ins-chart3'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + ifmt(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#444441', autoSkip: false }
        },
        y: {
          grid: { color: 'rgba(128,128,128,0.07)' },
          ticks: { font: { size: 10 }, color: '#888780', callback: v => ifmt(v) }
        }
      },
      layout: { padding: { top: 4 } }
    }
  });
}

// ── AGGIORNA TITOLI CARD ──────────────────────────────────
function insightsUpdateTitles(mese, llm) {
  const meseLabel = mese ? (INSIGHTS_MESELAB[mese] || mese) : 'Tutti i mesi';
  const llmLabel  = LLMLAB[llm] || llm;
  const avail     = insightsAvailableMonths();
  const lastLabel = INSIGHTS_MESELAB[avail[avail.length - 1]] || '';

  const elTitle = document.getElementById('ins-card-title');
  if (elTitle) elTitle.textContent = `AI Chatbot · ${llmLabel}`;

  const elSub = document.getElementById('ins-card-sub');
  if (elSub) elSub.textContent = `${meseLabel} · dati Comscore Panel IT`;

  const el1 = document.getElementById('ins-chart1-sub');
  if (el1) el1.textContent = `AI Visitors · ${llmLabel} · ${meseLabel}`;

  const el2 = document.getElementById('ins-chart2-sub');
  if (el2) el2.textContent = `Domain Visitors + Non Visitors · ${llmLabel} · ${meseLabel}`;

  const el3 = document.getElementById('ins-chart3-sub');
  if (el3) el3.textContent = `AI Visitors per mese · ${llmLabel} · top 5 domini (base: ${lastLabel})`;
}

// ── POPULATE MESE SELECT ──────────────────────────────────
function insightsPopulateMeseSelect() {
  const sel  = document.getElementById('ins-f-mese');
  if (!sel) return;
  const avail = insightsAvailableMonths();
  const last  = avail[avail.length - 1];
  sel.innerHTML = avail.map(m =>
    `<option value="${m}"${m === last ? ' selected' : ''}>${INSIGHTS_MESELAB[m] || m}</option>`
  ).join('');
  insightsChatbotMese = last;
}

// ── RENDER PRINCIPALE ─────────────────────────────────────
function insightsRenderChatbot() {
  const mese = insightsChatbotMese || insightsLastMonth();
  const llm  = insightsChatbotLlm;
  if (!mese || !RAW.length) return;

  insightsUpdateTitles(mese, llm);
  insightsRenderKpis(mese, llm);
  insightsRenderChart1(mese, llm);
  insightsRenderChart2(mese, llm);
  insightsRenderChart3(llm);
}

// ── FILTER HANDLERS ───────────────────────────────────────
function insightsOnMeseChange() {
  const sel = document.getElementById('ins-f-mese');
  if (!sel) return;
  insightsChatbotMese = sel.value;
  insightsRenderChart1(insightsChatbotMese, insightsChatbotLlm);
  insightsRenderChart2(insightsChatbotMese, insightsChatbotLlm);
  insightsUpdateTitles(insightsChatbotMese, insightsChatbotLlm);
  insightsRenderKpis(insightsChatbotMese, insightsChatbotLlm);
}

function insightsOnLlmChange() {
  const sel = document.getElementById('ins-f-llm');
  if (!sel) return;
  insightsChatbotLlm = sel.value;
  insightsRenderChatbot();
}

// ── ENTRY POINT — chiamato da switchPanel quando si entra in Insights ──
function initInsights() {
  if (!RAW.length) {
    // Dati non ancora pronti: mostra messaggio
    const kpi = document.getElementById('ins-kpi-container');
    if (kpi) kpi.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">Caricamento dati in corso…</div>';
    return;
  }
  // Popola select mese solo se vuota (evita re-render inutili)
  const sel = document.getElementById('ins-f-mese');
  if (sel && sel.options.length === 0) insightsPopulateMeseSelect();
  insightsRenderChatbot();
}
