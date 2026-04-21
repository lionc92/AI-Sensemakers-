// ═══════════════════════════════════════════════════════════════════════════
// PERF PATCHES — applicabili senza toccare app.js / insights*.js
// Caricare PRIMA di app.js in index.html.
// Tutte le modifiche sono monkey-patch: se rimuovi questo <script>, torni
// allo stato originale. Zero modifiche invasive.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── 1. DEBOUNCE UTILITY ──────────────────────────────────────────────────
  function debounce(fn, delay) {
    let t;
    const wrapped = function () {
      clearTimeout(t);
      const args = arguments, ctx = this;
      t = setTimeout(() => fn.apply(ctx, args), delay);
    };
    wrapped.flush = () => { clearTimeout(t); fn(); };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  // ── 2. DEBOUNCE DEI FILTRI — sostituisco le funzioni dopo che app.js le ha
  // definite. app.js dichiara `function applyFilters()` a top-level: nei
  // browser questo crea window.applyFilters riassegnabile. Al DOMContentLoaded
  // le funzioni esistono già → salvo riferimento original e sostituisco con
  // la versione debounced. Gli onchange dei select chiamano direttamente
  // la versione sincrona (*Now) per risposta immediata.

  const DEBOUNCE_MS = 180;

  document.addEventListener('DOMContentLoaded', function () {
    ['applyFilters', 'applyFiltersCc', 'applyFiltersAio'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name + 'Now'] = orig;
      window[name] = debounce(orig, DEBOUNCE_MS);
    });

    // resetFilters* chiamano applyFilters* in fondo: rimpiazziamo la chiamata
    // con la versione sincrona per un reset istantaneo (no wait 180ms).
    [['resetFilters', 'applyFiltersNow'],
     ['resetFiltersCc', 'applyFiltersCcNow'],
     ['resetFiltersAio', 'applyFiltersAioNow']].forEach(([reset, applyNow]) => {
      const origReset = window[reset];
      if (typeof origReset !== 'function') return;
      window[reset] = function () {
        const r = origReset.apply(this, arguments);
        // Il reset ha già chiamato la versione debounced; forziamo sync
        if (typeof window[applyNow] === 'function') window[applyNow]();
        return r;
      };
    });

    // I select (onchange) vogliono risposta immediata → riattaccati a *Now
    const selectMap = [
      { ids: ['f-mese', 'f-llm', 'f-cat', 'f-geo'], fn: 'applyFiltersNow' },
      { ids: ['cc-f-mese', 'cc-f-chatbot', 'cc-f-self'], fn: 'applyFiltersCcNow' },
      { ids: ['aio-f-mese', 'aio-f-se', 'aio-f-cat', 'aio-f-agg',
              'aio-f-cat-domain', 'aio-f-geo'], fn: 'applyFiltersAioNow' },
    ];
    selectMap.forEach(({ ids, fn }) => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeAttribute('onchange');
        el.addEventListener('change', () => {
          if (typeof window[fn] === 'function') window[fn]();
        });
      });
    });
  });

  // ── 3. HIDDEN GROUPS VIA CSS CLASS (elimina il secondo layout pass) ─────
  // app.js fa: hiddenGroups.forEach(g => querySelectorAll('.'+g).style.display='none')
  // DOPO aver settato innerHTML. È un full layout in più. Lo sostituiamo con
  // classi sul wrapper .twrap: .hide-g-vol su twrap nasconde tutte le .g-vol.

  const STYLE_ID = '__perf_hidden_groups_css__';
  function ensureHiddenGroupCss(classes) {
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent = classes.map(c =>
      `.twrap.hide-${c} .${c} { display: none !important; }`
    ).join('\n');
  }

  // Ricava tutte le classi-gruppo possibili da togG/togGCc/togGAio.
  const ALL_GROUPS = [
    'g-id', 'g-vol', 'g-pct', 'g-eng',
    'cc-g-id', 'cc-g-vol', 'cc-g-pct',
    'aio-g-id', 'aio-g-vol', 'aio-g-pct',
  ];
  ensureHiddenGroupCss(ALL_GROUPS);

  function syncHiddenGroupsToCss() {
    const wraps = document.querySelectorAll('.twrap');
    wraps.forEach(w => {
      ALL_GROUPS.forEach(g => w.classList.remove('hide-' + g));
    });
    // Unione dei 3 set — applichiamo a tutti i wrap; le classi non in conflitto
    // (g-* vs cc-g-* vs aio-g-*) restano innocue sugli altri wrap.
    const all = new Set();
    if (typeof hiddenGroups !== 'undefined')    hiddenGroups.forEach(g => all.add(g));
    if (typeof hiddenGroupsCc !== 'undefined')  hiddenGroupsCc.forEach(g => all.add(g));
    if (typeof hiddenGroupsAio !== 'undefined') hiddenGroupsAio.forEach(g => all.add(g));
    wraps.forEach(w => all.forEach(g => w.classList.add('hide-' + g)));
  }

  // Dopo il DOMContentLoaded + dopo ogni togG*, risincronizziamo.
  // Strategia: wrappare togG, togGCc, togGAio con un post-hook.
  function wrapToggle(name) {
    const orig = window[name];
    if (typeof orig !== 'function') {
      // Non ancora definita: ritenta dopo DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => wrapToggle(name));
      return;
    }
    window[name] = function () {
      const r = orig.apply(this, arguments);
      syncHiddenGroupsToCss();
      return r;
    };
  }
  // wrapToggle legge da window; lo chiamiamo dopo che app.js ha definito le funzioni
  document.addEventListener('DOMContentLoaded', function () {
    ['togG', 'togGCc', 'togGAio'].forEach(wrapToggle);
    syncHiddenGroupsToCss();
  });

  // ── 4. DARK MODE: persistenza + re-theme Chart.js ───────────────────────
  // A. Persistenza: leggi al boot, salva al toggle.
  const THEME_KEY = 'sm_theme';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) { /* localStorage bloccato */ }

  // B. Wrappiamo toggleTheme quando viene definita
  document.addEventListener('DOMContentLoaded', function () {
    const origToggle = window.toggleTheme;
    if (typeof origToggle === 'function') {
      window.toggleTheme = function () {
        const r = origToggle.apply(this, arguments);
        try {
          localStorage.setItem(THEME_KEY,
            document.documentElement.getAttribute('data-theme') || 'light');
        } catch (e) {}
        retintCharts();
        return r;
      };
    }
  });

  // C. Re-theme Chart.js leggendo le CSS vars del tema corrente
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      tickStrong: cs.getPropertyValue('--text2').trim() || '#4A4A6A',
      tickMuted:  cs.getPropertyValue('--text3').trim() || '#8888A8',
      grid:       (document.documentElement.getAttribute('data-theme') === 'dark')
                    ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    };
  }

  function retintChartInstance(chart) {
    if (!chart || !chart.options || !chart.options.scales) return;
    const c = themeColors();
    ['x', 'y'].forEach(axis => {
      const sc = chart.options.scales[axis];
      if (!sc) return;
      if (sc.ticks) sc.ticks.color = (axis === 'y' && sc.indexAxis !== 'y') ? c.tickStrong : c.tickMuted;
      if (sc.grid && sc.grid.color && sc.grid.color !== false) sc.grid.color = c.grid;
    });
    // Le barre orizzontali (indexAxis:'y') hanno y con labels dei domini: usa tickStrong
    if (chart.config && chart.config.options && chart.config.options.indexAxis === 'y') {
      if (chart.options.scales.y && chart.options.scales.y.ticks)
        chart.options.scales.y.ticks.color = c.tickStrong;
      if (chart.options.scales.x && chart.options.scales.x.ticks)
        chart.options.scales.x.ticks.color = c.tickMuted;
    }
    try { chart.update('none'); } catch (e) {}
  }

  function retintCharts() {
    if (typeof insightsCharts !== 'undefined')
      Object.values(insightsCharts).forEach(retintChartInstance);
    if (typeof aioChartsInst !== 'undefined')
      Object.values(aioChartsInst).forEach(retintChartInstance);
  }

  // D. Chart.js defaults globali: chart creati DOPO il boot prendono il tema
  //    via plugin "afterInit". Così non devi modificare insights.js.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chart === 'undefined') return;
    Chart.register({
      id: 'sm-auto-theme',
      afterInit(chart) { retintChartInstance(chart); },
    });
  });

  // ── 5. FOOTER LOGIN DINAMICO (rimuove "Marzo 2026" hardcoded) ───────────
  // Se RAW è popolato, calcola l'ultimo mese al volo.
  function updateLoginFooter() {
    const el = document.getElementById('login-footer');
    if (!el) return;
    let label = '—';
    try {
      if (typeof insightsLastMonth === 'function' &&
          typeof INSIGHTS_MESELAB !== 'undefined') {
        const m = insightsLastMonth();
        if (m && INSIGHTS_MESELAB[m]) label = INSIGHTS_MESELAB[m];
      }
    } catch (e) {}
    el.textContent = `Fonte: Comscore Panel IT · Desktop · ${label}`;
  }
  // Aggiorna quando RAW è pronto: hook su loadData
  document.addEventListener('DOMContentLoaded', function () {
    const orig = window.loadData;
    if (typeof orig !== 'function') return;
    window.loadData = async function () {
      const r = await orig.apply(this, arguments);
      updateLoginFooter();
      return r;
    };
  });

  // ── 6. PROGRESS LOGGING (performance budget) ────────────────────────────
  // Log dei tempi di filter/sort/render. Utile per spotting regressioni.
  // Attivabile con localStorage.setItem('sm_perf_log', '1').
  const PERF_LOG = (function () {
    try { return localStorage.getItem('sm_perf_log') === '1'; } catch (e) { return false; }
  })();
  if (PERF_LOG) {
    ['render', 'renderCc', 'renderAio'].forEach(name => {
      document.addEventListener('DOMContentLoaded', () => {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
          const t0 = performance.now();
          const r = orig.apply(this, arguments);
          console.log(`[perf] ${name}: ${(performance.now() - t0).toFixed(1)}ms`);
          return r;
        };
      });
    });
  }

  // ── 7. PARALLEL LOAD AL LOGIN (opzionale, attivabile) ───────────────────
  // Di default attivo — riduce l'attesa cross-tab. Disattivabile con
  // localStorage.setItem('sm_parallel_load', '0').
  const PARALLEL_LOAD = (function () {
    try { return localStorage.getItem('sm_parallel_load') !== '0'; } catch (e) { return true; }
  })();
  if (PARALLEL_LOAD) {
    document.addEventListener('DOMContentLoaded', function () {
      const origLoadData = window.loadData;
      if (typeof origLoadData !== 'function') return;
      window.loadData = async function () {
        // Chatbot (blocking — serve per il primo render)
        await origLoadData.apply(this, arguments);
        // Co-citation e AIO in background: non bloccano l'UI
        setTimeout(() => {
          if (typeof loadDataCc  === 'function' && (!window.RAW_CC  || !RAW_CC.length))  loadDataCc();
          if (typeof loadDataAio === 'function' && (!window.RAW_AIO || !RAW_AIO.length)) loadDataAio();
        }, 50);
      };
    });
  }

})();
