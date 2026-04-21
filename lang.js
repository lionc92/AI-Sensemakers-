// ── LABELS — solo italiano ────────────────────────────────
// Questo file gestisce:
//   1. LABELS         — tutte le stringhe visibili nella UI
//   2. COLS_CHATBOT   — definizione colonne tabella AI Chatbot
//   3. COLS_AIO       — definizione colonne tabella AIO (placeholder)
//   4. ACTIVE_COLS    — colonne attive (sostituito da app.js al cambio vista)
//   5. applyLang()    — aggiorna DOM con le label
//   6. rebuildHeaders() — ricostruisce <thead>
//   7. buildNota()    — nota metodologica

// ── STRINGHE UI ───────────────────────────────────────────
const LABELS = {
  // Header / topbar
  hdr_fonte:        'Fonte: Comscore Panel IT · Desktop · Marzo 2026',
  hdr_periodo:      'Dic 2025 – Gen 2026',

  // Sidebar
  tab_dati:         'Dati',
  tab_nota:         'Nota metodologica',

  // Filtri
  fl_mese:          'Mese',
  fl_chatbot:       'Chatbot',
  fl_cerca:         'Cerca dominio',
  fl_posmin:        'Posiz. min',
  fl_posmax:        'Posiz. max',
  fl_esposti:       'AI Visitors ≥',

  // Status bar
  sb_su:            'domini su',
  sk_esposti:       'AI Visitors',
  sk_nonvis:        '% Non-Conversion media',
  sk_reach:         '% AI Exclusive media',

  // Gruppi colonne
  cg_id:            'Identificatori',
  cg_vol:           'Volumi',
  cg_pct:           'Indicatori %',
  cg_eng:           'Engagement',

  // Avvisi
  w_ovlp:           '⚠ Modalità "tutti i chatbot": i totali aggregano righe distinte per chatbot sullo stesso dominio. Per confronti corretti selezionare "Total".',

  // Loading / empty state
  loading:          'Caricamento dati…',
  no_results:       'Nessun risultato. Modifica i filtri per espandere la selezione.',

  // Auth
  login_email:      'Email',
  login_pwd:        'Password',
  login_btn:        'Accedi',
  login_loading:    'Accesso in corso…',
  login_footer:     'Fonte: Comscore Panel IT · Desktop · Marzo 2026',
  session_expired:  'Sessione scaduta. Accedi di nuovo.',

  // Card header sort labels (usati in updateStatus in app.js)
  sort_vis_ai:      'AI Visitors',
  sort_conv_ai:     'AI Convos',
  sort_pos:         'Rank',
  sort_pct_nv:      '% Non-Conversion',
  sort_all_months:  'Tutti i mesi',
  sorted_by:        'Ordinati per',
};

// Shortcut — sostituisce t() del vecchio sistema
function L(k) { return LABELS[k] || k; }

// Alias backward-compat: app.js chiama t() in 3 punti
// (session_expired, login_loading, login_btn) — reindirizza a L()
function t(k) { return L(k); }

// ── COLONNE — AI Chatbot ──────────────────────────────────
// label = testo intestazione colonna
// dk    = data key (chiave in RAW, usata per sort in app.js)
// dt    = tipo sort: n=number, s=string
// grp   = classe CSS gruppo per toggle colonne
// id    = (opzionale) id HTML sull'elemento <span> interno
// tip   = tooltip HTML (supporta <strong> e <span class="tip-ex">)
const COLS_CHATBOT = [
  {
    label: 'Mese',
    dk: 'mese', dt: 's', grp: 'g-id',
    tip: 'Mese di rilevazione del dato.'
  },
  {
    label: 'Chatbot',
    dk: 'chatbot', dt: 's', grp: 'g-id',
    tip: '<strong>Total</strong> (default): aggregato di tutti i chatbot monitorati. Per l\'Italia solo ChatGPT ha un campione statisticamente robusto. Non sommare più chatbot: "Total" li include già tutti.'
  },
  {
    label: 'Rank',
    dk: 'pos', dt: 'n', grp: 'g-id', id: 'rank-label',
    tip: 'Classifica dei domini per AI Visitors nel mese. Il dominio al primo posto ha ricevuto più citazioni dal chatbot. La classifica cambia al variare del filtro chatbot.'
  },
  {
    label: 'Domain',
    dk: 'sito', dt: 's', grp: 'g-id',
    tip: 'Indirizzo del sito web.'
  },
  {
    label: 'Domain Category',
    dk: 'cat', dt: 's', grp: 'g-id',
    tip: 'Categoria Comscore del dominio.'
  },
  {
    label: 'Geo',
    dk: 'geo', dt: 's', grp: 'g-id',
    tip: 'ITA = dominio italiano, INT = dominio internazionale.'
  },
  {
    label: 'AI Visitors',
    dk: 'vis_ai', dt: 'n', grp: 'g-vol gs',
    tip: 'Persone uniche a cui il chatbot ha citato il dominio in una risposta nel mese. Include chi ha poi visitato il sito e chi non lo ha fatto.<span class="tip-ex">Es: 2,1M su reddit.com a gennaio — circa 2,1 milioni di persone hanno ricevuto una risposta AI che citava Reddit.</span>'
  },
  {
    label: 'AI Convos',
    dk: 'conv_ai', dt: 'n', grp: 'g-vol',
    tip: 'Conversazioni col chatbot in cui il dominio è stato citato almeno una volta nel mese.<span class="tip-ex">Es: 4,3M conversazioni su reddit.com a gennaio 2026.</span>'
  },
  {
    label: 'AI Prompts',
    dk: 'dom_ai', dt: 'n', grp: 'g-vol',
    tip: 'Singoli messaggi inviati al chatbot che hanno generato una risposta contenente il dominio. Sempre uguale o superiore alle AI Convos.<span class="tip-ex">Es: 8,4M prompt su reddit.com — circa 2 messaggi per conversazione in media.</span>'
  },
  {
    label: 'Non Visitors',
    dk: 'nuovi', dt: 'n', grp: 'g-vol',
    tip: 'Persone incluse nell\'AI Audience che non hanno visitato il dominio in nessun momento del mese. Rappresenta l\'audience aggiuntiva raggiunta esclusivamente tramite AI.<span class="tip-ex">Es: 1,78M su reddit.com a gennaio — queste persone hanno ricevuto la citazione ma non hanno mai visitato il sito quel mese.</span>'
  },
  {
    label: 'Domain Visitors',
    dk: 'vis_tot', dt: 'n', grp: 'g-vol',
    tip: 'Stima dei visitatori unici mensili del dominio da tutti i canali (ricerca, direct, social, referral).'
  },
  {
    label: 'Total New Reach',
    dk: 'aud_pot', dt: 'n', grp: 'g-vol',
    tip: 'Domain Visitors più Non Visitors AI. Totale delle persone raggiunte dal dominio nel mese tramite qualsiasi canale inclusa AI.<span class="tip-ex">Es: Total New Reach = Domain Visitors + Non Visitors.</span>'
  },
  {
    label: '% AI Incremental',
    dk: 'pct_ai_inc', dt: 'n', grp: 'g-vol',
    tip: 'Percentuale incrementale AI fornita direttamente da Comscore. Misura l\'impatto incrementale dell\'AI sul traffico del dominio rispetto al baseline organico.'
  },
  {
    label: '% Non-Conversion',
    dk: 'pct_nv', dt: 'n', grp: 'g-pct gs',
    tip: 'Su 100 persone dell\'AI Audience, quante non hanno visitato il dominio nel mese. Più è alto, più l\'AI genera audience aggiuntiva.<span class="tip-ex">Es: 81% su reddit.com — 81 su 100 persone esposte tramite AI non avevano visitato il sito quel mese.</span>'
  },
  {
    label: '% AI Exclusive',
    dk: 'pct_excl', dt: 'n', grp: 'g-pct',
    tip: 'Non Visitors AI come percentuale del Total New Reach. Misura il peso esclusivo dell\'AI sull\'audience complessiva raggiunta.<span class="tip-ex">Es: 33% su reddit.com — i Non Visitors AI equivalgono al 33% del Total New Reach.</span>'
  },
  {
    label: 'Convos per Visitor',
    dk: 'conv_v', dt: 'n', grp: 'g-eng gs',
    tip: 'Quante conversazioni AI in media per ogni persona nell\'AI Audience.'
  },
  {
    label: 'Prompts per Visitor',
    dk: 'prom_v', dt: 'n', grp: 'g-eng',
    tip: 'Totale prompt AI per persona nell\'AI Audience.'
  },
  {
    label: 'Prompts per Convo',
    dk: 'prom_c', dt: 'n', grp: 'g-eng',
    tip: 'Quanti prompt per conversazione hanno citato il dominio.'
  },
];

// ── COLONNE — AIO ─────────────────────────────────────────
// Verrà completato allo step AIO
const COLS_AIO = [];

// ── COLONNE — AI CO-CITATION ───────────────────────────────
const COLS_COCITATION = [
  { label: 'Mese',            dk: 'mese',          dt: 's', grp: 'cc-g-id',
    tip: 'Mese di rilevazione.' },
  { label: 'Chatbot',         dk: 'chatbot',        dt: 's', grp: 'cc-g-id',
    tip: '<strong>Total</strong>: aggregato di tutti i chatbot. È il dato di riferimento principale.' },
  { label: 'Domain',          dk: 'domain',         dt: 's', grp: 'cc-g-id',
    tip: 'Dominio principale — quello per cui si analizzano le co-citazioni.' },
  { label: 'Co-cited Domain', dk: 'cocited_domain', dt: 's', grp: 'cc-g-id',
    tip: 'Dominio citato insieme al Domain nella stessa conversazione AI. Quando coincide con Domain è la riga di riferimento (self-citation, UV share = 100%).' },
  { label: 'AI Visitors',     dk: 'ai_visitors',    dt: 'n', grp: 'cc-g-vol gs',
    tip: 'Persone uniche che hanno ricevuto una risposta AI che citava sia Domain che Co-cited Domain nella stessa conversazione.' },
  { label: 'AI Convos',       dk: 'ai_convos',      dt: 'n', grp: 'cc-g-vol',
    tip: 'Conversazioni AI in cui sia Domain che Co-cited Domain sono stati citati insieme.' },
  { label: 'AI Prompts',      dk: 'ai_prompts',     dt: 'n', grp: 'cc-g-vol',
    tip: 'Prompt AI che hanno generato risposte contenenti sia Domain che Co-cited Domain.' },
  { label: '% AI Visitors Share', dk: 'pct_uv_share',     dt: 'n', grp: 'cc-g-pct gs',
    tip: 'AI Visitors co-citation come percentuale degli AI Visitors totali del Domain principale.<span class="tip-ex">Es: 69% su wikipedia.org per amazon.com → il 69% delle persone esposte ad amazon.com ha ricevuto anche una risposta con wikipedia.org.</span>' },
  { label: '% AI Convos Share',   dk: 'pct_convo_share',  dt: 'n', grp: 'cc-g-pct',
    tip: 'AI Convos co-citation come percentuale delle AI Convos totali del Domain principale.' },
  { label: '% AI Prompts Share',  dk: 'pct_prompt_share', dt: 'n', grp: 'cc-g-pct',
    tip: 'AI Prompts co-citation come percentuale degli AI Prompts totali del Domain principale.' },
];

// ── COLONNE ATTIVE ────────────────────────────────────────
// app.js sostituisce ACTIVE_COLS quando cambia vista (chatbot ↔ aio)
let ACTIVE_COLS = COLS_CHATBOT;

// ── REBUILD HEADERS ───────────────────────────────────────
function rebuildHeaders() {
  const tr = document.getElementById('thead-row');
  if (!tr) return;
  tr.innerHTML = ACTIVE_COLS.map(c => {
    const idAttr = c.id ? ` id="${c.id}"` : '';
    return `<th class="${c.grp}" data-k="${c.dk}" data-t="${c.dt}" onclick="doSort(this)"><span${idAttr}>${c.label}</span><span class="tip">${c.tip}</span></th>`;
  }).join('');
  if (typeof hiddenGroups !== 'undefined') {
    hiddenGroups.forEach(g =>
      document.querySelectorAll('.' + g).forEach(el => el.style.display = 'none')
    );
  }
}

// ── APPLY LABELS ──────────────────────────────────────────
function applyLang() {
  const setText = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = L(key);
  };

  // Header
  setText('hdr-fonte',   'hdr_fonte');
  setText('hdr-periodo', 'hdr_periodo');

  // Sidebar nav
  const navDati = document.getElementById('nav-dati');
  const navNota = document.getElementById('nav-nota');
  if (navDati) navDati.querySelector('.ni-lbl').textContent = L('tab_dati');
  if (navNota) navNota.querySelector('.ni-lbl').textContent = L('tab_nota');

  // Filtri label via data-tl
  document.querySelectorAll('.fl[data-tl]').forEach(el => {
    el.textContent = L(el.dataset.tl);
  });

  // Select chatbot — prima opzione
  const fllm = document.getElementById('f-llm');
  if (fllm && fllm.options[0]) {
    fllm.options[0].text = 'Total — aggregato tutti';
  }

  // Status bar KPI
  setText('sb-su',      'sb_su');
  setText('sk-esposti', 'sk_esposti');
  setText('sk-nonvis',  'sk_nonvis');
  setText('sk-reach',   'sk_reach');

  // Gruppi colonne toggle
  document.querySelectorAll('.ctg[data-cg]').forEach(el => {
    el.textContent = L(el.dataset.cg);
  });

  // Warning
  setText('warn-ovlp', 'w_ovlp');

  // Loading / empty state
  setText('loading-msg', 'loading');
  setText('nores',       'no_results');

  // Login
  const loginEmail = document.querySelector('label[data-tl="login_email"]');
  if (loginEmail) loginEmail.textContent = L('login_email');
  const loginPwd = document.querySelector('label[data-tl="login_pwd"]');
  if (loginPwd) loginPwd.textContent = L('login_pwd');
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn && loginBtn.textContent !== L('login_loading')) {
    loginBtn.textContent = L('login_btn');
  }
  const loginFooter = document.getElementById('login-footer');
  if (loginFooter) loginFooter.textContent = L('login_footer');

  // Ricostruisce header tabella
  rebuildHeaders();

  // Aggiorna nota metodologica se visibile
  buildNota();
}

// ── NOTA METODOLOGICA ─────────────────────────────────────
function buildNota() {
  const el = document.getElementById('nota-content');
  if (!el) return;

  function card(c) {
    return `<div class="nota-card">
      <div class="nota-card-name">${c.name}</div>
      ${c.formula ? `<div class="nota-formula">${c.formula}</div>` : ''}
      <div class="nota-card-desc">${c.desc}</div>
      ${c.ex ? `<div class="nota-card-ex">${c.ex}</div>` : ''}
    </div>`;
  }
  function section(title, cards) {
    return `<div class="nota-section">
      <div class="nota-section-title">${title}</div>
      <div class="nota-grid">${cards.map(card).join('')}</div>
    </div>`;
  }

  // ── AI CHATBOT ──────────────────────────────────────────
  const chat_fonte = [
    { name: 'Ambito',
      desc: 'Dati relativi al traffico generato da chatbot AI su browser desktop in Italia. Non sono inclusi accessi da dispositivi mobili o app.' },
    { name: 'Chatbot monitorati',
      desc: 'OpenAI ChatGPT, Google Gemini, Microsoft Copilot, Perplexity, X Grok.' },
    { name: 'Riga "Total"',
      desc: 'Aggrega tutti i chatbot monitorati. È il dato di riferimento principale. Non sommare le righe dei singoli chatbot: "Total" li include già tutti.' },
  ];

  const chat_vol = [
    { name: 'AI Visitors',
      formula: '= Stima panel',
      desc: 'Persone uniche a cui il chatbot ha citato il dominio in una risposta nel mese. Include chi ha poi visitato il sito e chi non lo ha fatto.',
      ex: 'Es: 2,1M su reddit.com a gennaio — circa 2,1 milioni di persone hanno ricevuto una risposta AI che citava Reddit.' },
    { name: 'AI Convos',
      formula: '≤ AI Prompts',
      desc: 'Conversazioni col chatbot in cui il dominio è stato citato almeno una volta nel mese.',
      ex: 'Es: 4,3M conversazioni su reddit.com a gennaio 2026.' },
    { name: 'AI Prompts',
      formula: '≥ AI Convos',
      desc: 'Singoli messaggi inviati al chatbot che hanno generato una risposta contenente il dominio.',
      ex: 'Es: 8,4M prompt su reddit.com — circa 2 messaggi per conversazione in media.' },
    { name: 'Non Visitors',
      formula: '= AI Visitors non visitatori nel mese',
      desc: 'Persone nell\'AI Audience che non hanno visitato il dominio in nessun momento del mese.',
      ex: 'Es: 1,78M su reddit.com a gennaio.' },
    { name: 'Domain Visitors',
      formula: '= Stima panel tutti i canali',
      desc: 'Visitatori unici mensili del dominio da tutti i canali (ricerca, direct, social, referral).' },
    { name: 'Total New Reach',
      formula: '= Domain Visitors + Non Visitors',
      desc: 'Totale delle persone raggiunte dal dominio nel mese tramite qualsiasi canale, inclusa AI.',
      ex: 'Es: reddit.com gennaio — Domain Visitors + Non Visitors AI = Total New Reach.' },
    { name: '% AI Incremental',
      formula: '= Non Visitors ÷ Domain Visitors',
      desc: 'Peso dell\'audience AI incrementale rispetto al traffico organico del dominio.',
      ex: 'Es: arxiv.org — % AI Incremental molto alta per domini con traffico organico ridotto.' },
  ];

  const chat_pct = [
    { name: '% Non-Conversion',
      formula: '= Non Visitors ÷ AI Visitors',
      desc: 'Su 100 persone dell\'AI Audience, quante non hanno visitato il dominio nel mese.',
      ex: 'Es: 81% su reddit.com — 81 su 100 persone esposte tramite AI non avevano visitato il sito quel mese.' },
    { name: '% AI Exclusive',
      formula: '= Non Visitors ÷ Total New Reach',
      desc: 'Non Visitors AI come percentuale del Total New Reach. Misura il peso esclusivo dell\'AI sull\'audience complessiva raggiunta.',
      ex: 'Es: 33% su reddit.com — i Non Visitors AI equivalgono al 33% del Total New Reach.' },
  ];

  const chat_eng = [
    { name: 'Convos per Visitor',
      formula: '= AI Convos ÷ AI Visitors',
      desc: 'Quante conversazioni AI in media per ogni persona nell\'AI Audience.' },
    { name: 'Prompts per Visitor',
      formula: '= AI Prompts ÷ AI Visitors',
      desc: 'Totale prompt AI per persona nell\'AI Audience.' },
    { name: 'Prompts per Convo',
      formula: '= AI Prompts ÷ AI Convos',
      desc: 'Quanti prompt per conversazione hanno citato il dominio.' },
  ];

  // ── AIO ─────────────────────────────────────────────────
  const aio_fonte = [
    { name: 'Ambito',
      desc: 'Dati relativi alle ricerche che hanno generato un AI Overview (riquadro AI) nella SERP di Google, su browser desktop in Italia.' },
    { name: 'Search Category',
      desc: 'Classificazione Comscore della query di ricerca. "TOTAL" rappresenta l\'aggregato di tutte le categorie.' },
    { name: 'Domain / TOTAL',
      desc: 'Domain è il sito citato nell\'AI Overview. "TOTAL" con Rank 0 indica la riga aggregato dell\'intera categoria.' },
  ];

  const aio_vol = [
    { name: 'Searchers',
      formula: '= Stima panel',
      desc: 'Persone uniche che hanno effettuato almeno una ricerca AI Overview nella categoria nel mese.' },
    { name: 'Searches',
      formula: '≥ Searchers',
      desc: 'Numero totale di ricerche AI Overview nella categoria nel mese.' },
    { name: 'Clickers',
      formula: '≤ Searchers',
      desc: 'Persone uniche che hanno cliccato su almeno un risultato nell\'AI Overview.',
      ex: 'Può essere assente se il volume è sotto soglia di rilevazione.' },
    { name: 'Clicks',
      formula: '≥ Clickers',
      desc: 'Numero totale di click su risultati dell\'AI Overview.',
      ex: 'Può essere assente se il volume è sotto soglia di rilevazione.' },
    { name: 'Clickers to Domain',
      desc: 'Persone uniche che hanno cliccato direttamente sul dominio citato nell\'AI Overview.',
      ex: 'Frequentemente assente — molti domini vengono citati senza generare click diretti.' },
    { name: 'Clicks to Domain',
      desc: 'Numero totale di click diretti verso il dominio citato nell\'AI Overview.',
      ex: 'Frequentemente assente — molti domini vengono citati senza generare click diretti.' },
  ];

  const aio_pct = [
    { name: '% Conv. Clickers',
      formula: '= Clickers ÷ Searchers',
      desc: 'Percentuale di ricercatori che hanno cliccato su almeno un risultato nell\'AI Overview.',
      ex: 'Es: 60% → 60 persone su 100 che hanno cercato hanno cliccato su un risultato.' },
    { name: '% Conv. Clicks',
      formula: '= Clicks ÷ Searches',
      desc: 'Tasso di click sul totale delle ricerche AI Overview.' },
    { name: '% Conv. To Domain (Clickers)',
      formula: '= Clickers to Domain ÷ Searchers',
      desc: 'Percentuale di ricercatori che hanno cliccato direttamente sul dominio.',
      ex: 'Es: 18% su motor1.com → 18 persone su 100 hanno cliccato su motor1.com dall\'AI Overview.' },
    { name: '% Conv. To Domain (Clicks)',
      formula: '= Clicks to Domain ÷ Searches',
      desc: 'Tasso di click diretti al dominio sul totale delle ricerche.' },
  ];

  el.innerHTML = `
    <div class="nota-section">
      <div class="nota-section-title" style="font-size:13px;font-weight:700;color:var(--text);letter-spacing:0;text-transform:none;border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:16px">AI Chatbot</div>
      ${section('Fonte e copertura', chat_fonte)}
      ${section('Metriche di volume', chat_vol)}
      ${section('Indicatori percentuali', chat_pct)}
      ${section('Engagement', chat_eng)}
    </div>
    <div class="nota-section" style="margin-top:32px">
      <div class="nota-section-title" style="font-size:13px;font-weight:700;color:var(--text);letter-spacing:0;text-transform:none;border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:16px">AI Co-citation</div>
      ${section('Concetto', [
        { name: 'Cos\'è la co-citation',
          desc: 'Misura quanti domini vengono citati insieme nella stessa conversazione AI. Per ogni Domain principale mostra quali altri domini (Co-cited Domain) appaiono nelle stesse sessioni chatbot.',
          ex: 'Es: amazon.com + reddit.com con 108K AI Visitors → in 108.000 conversazioni il chatbot ha citato sia amazon.com che reddit.com nella stessa sessione.' },
        { name: 'Self-citation',
          desc: 'La riga dove Domain = Co-cited Domain rappresenta il totale di riferimento del Domain principale. UV share = 100% su questa riga.',
          ex: 'Es: amazon.com / amazon.com → 217K AI Visitors = tutti gli utenti esposti ad amazon.com. Base per calcolare le share.' },
      ])}
      ${section('Metriche di volume', [
        { name: 'AI Visitors',
          formula: '= Stima panel',
          desc: 'Persone uniche che hanno ricevuto una risposta AI contenente sia Domain che Co-cited Domain nella stessa conversazione.' },
        { name: 'AI Convos',
          formula: '≤ AI Visitors',
          desc: 'Conversazioni AI in cui sia Domain che Co-cited Domain sono stati citati insieme.' },
        { name: 'AI Prompts',
          formula: '≥ AI Convos',
          desc: 'Prompt AI che hanno generato risposte contenenti entrambi i domini.' },
      ])}
      ${section('Indicatori percentuali', [
        { name: '% AI Visitors Share',
          formula: '= AI Visitors co-citation ÷ AI Visitors Domain principale',
          desc: 'Quota degli AI Visitors del Domain principale che ha ricevuto anche una risposta con Co-cited Domain.',
          ex: 'Es: 69% su wikipedia.org per amazon.com → il 69% delle persone esposte ad amazon.com ha ricevuto anche wikipedia.org nella stessa sessione.' },
        { name: '% AI Convos Share',
          formula: '= AI Convos co-citation ÷ AI Convos Domain principale',
          desc: 'Quota delle conversazioni del Domain principale che includono anche Co-cited Domain.' },
        { name: '% AI Prompts Share',
          formula: '= AI Prompts co-citation ÷ AI Prompts Domain principale',
          desc: 'Quota dei prompt del Domain principale che includono anche Co-cited Domain.' },
      ])}
    </div>
    <div class="nota-section" style="margin-top:32px">
      <div class="nota-section-title" style="font-size:13px;font-weight:700;color:var(--text);letter-spacing:0;text-transform:none;border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:16px">AI Overview</div>
      ${section('Fonte e copertura', aio_fonte)}
      ${section('Metriche di volume', aio_vol)}
      ${section('Indicatori percentuali', aio_pct)}
    </div>`;
}

// ── COLONNE — AIO (aggiornato) ────────────────────────────
COLS_AIO.length = 0; // svuota placeholder
COLS_AIO.push(
  { label: 'Mese',       dk: 'mese',    dt: 's', grp: 'aio-g-id',
    tip: 'Mese di rilevazione.' },
  { label: 'Search Engine', dk: 'se', dt: 's', grp: 'aio-g-id',
    tip: 'Motore di ricerca: TOTAL = aggregato, google.com, bing.com.' },
  { label: 'Search Category', dk: 'cat',     dt: 's', grp: 'aio-g-id',
    tip: 'Categoria Comscore della ricerca AI Overview.' },
  { label: 'Rank',       dk: 'rank',    dt: 'n', grp: 'aio-g-id',
    tip: 'Posizione del dominio citato nella categoria. Rank 0 = riga aggregato categoria (TOTAL).' },
  { label: 'Domain', dk: 'cited', dt: 's', grp: 'aio-g-id',
    tip: 'Dominio citato dall\'AI Overview. "TOTAL" indica il totale aggregato della categoria.' },
  { label: 'Domain Category', dk: 'cat_domain', dt: 's', grp: 'aio-g-id',
    tip: 'Categoria Comscore del dominio.' },
  { label: 'Geo', dk: 'geo', dt: 's', grp: 'aio-g-id',
    tip: 'ITA = dominio italiano, INT = dominio internazionale.' },
  { label: 'Searchers',  dk: 'searchers', dt: 'n', grp: 'aio-g-vol gs',
    tip: 'Persone uniche che hanno effettuato ricerche AI Overview nella categoria nel mese.' },
  { label: 'Searches',   dk: 'searches',  dt: 'n', grp: 'aio-g-vol',
    tip: 'Numero totale di ricerche AI Overview nella categoria nel mese.' },
  { label: 'Clickers',   dk: 'clickers',  dt: 'n', grp: 'aio-g-vol aio-col-clickers',
    tip: 'Persone uniche che hanno cliccato su almeno un risultato nell\'AI Overview.<span class="tip-ex">Può essere NULL se Comscore non riporta il dato (sotto soglia).</span>' },
  { label: 'Clickers to Domain', dk: 'clickers_to_domain', dt: 'n', grp: 'aio-g-vol',
    tip: 'Persone uniche che hanno cliccato direttamente sul dominio citato nell\'AI Overview.<span class="tip-ex">Frequentemente NULL — molti domini vengono citati senza generare click diretti.</span>' },
  { label: 'Clicks to Domain',    dk: 'clicks_to_domain', dt: 'n', grp: 'aio-g-vol',
    tip: 'Numero totale di click - inclusa la SERP -  diretti verso il dominio citato nell\'AI Overview.<span class="tip-ex">Frequentemente NULL — molti domini vengono citati senza generare click diretti.</span>' },
  { label: '% Conv. Clickers',   dk: 'pct_conv_clk',  dt: 'n', grp: 'aio-g-pct gs',
    tip: 'Clickers ÷ Searchers. Percentuale di ricercatori che hanno cliccato su un risultato AI Overview o SERP Google.<span class="tip-ex">Es: 60% → 60 persone su 100 che hanno cercato hanno cliccato su un risultato.</span>' },
  { label: '% Conv. To Domain (Clicks)', dk: 'pct_ctd_srch', dt: 'n', grp: 'aio-g-pct',
    tip: 'Clicks to Domain ÷ Searches. Tasso di click diretti al dominio sul totale delle ricerche.' },
  { label: '% Conv. To Domain (Clickers)', dk: 'pct_ctd_clk',  dt: 'n', grp: 'aio-g-pct',
    tip: 'Clickers to Domain ÷ Searchers. Percentuale di ricercatori che hanno cliccato direttamente sul dominio.<span class="tip-ex">Es: 18% su motor1.com → 18 persone su 100 hanno cliccato su motor1.com dall\'AI Overview o SERP.</span>' },
);

// Aggiorna rebuildHeadersAio (usata da app.js)
function rebuildHeadersAio() {
  const tr = document.getElementById('aio-thead-row');
  if (!tr) return;
  tr.innerHTML = COLS_AIO.map(c =>
    `<th class="${c.grp}" data-k="${c.dk}" data-t="${c.dt}" onclick="doSortAio(this)"><span>${c.label}</span><span class="tip">${c.tip}</span></th>`
  ).join('');
}

// Aggiorna rebuildHeadersCc (usata da app.js)
function rebuildHeadersCc() {
  const tr = document.getElementById('cc-thead-row');
  if (!tr) return;
  tr.innerHTML = COLS_COCITATION.map(c =>
    `<th class="${c.grp}" data-k="${c.dk}" data-t="${c.dt}" onclick="doSortCc(this)"><span>${c.label}</span><span class="tip">${c.tip}</span></th>`
  ).join('');
}
