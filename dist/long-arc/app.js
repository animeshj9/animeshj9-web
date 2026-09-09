(() => {
  'use strict';

  const STORAGE_KEY = 'long-arc.theses.v1';
  const domains = ['All', 'AI Engineering', 'Technology', 'History', 'Hyderabad', 'Investing', 'Writing', 'Other'];
  const domainCodes = {
    'AI Engineering': 'AI',
    Technology: 'TECH',
    History: 'HIST',
    Hyderabad: 'HYD',
    Investing: 'CAP',
    Writing: 'WRITE',
    Other: 'OTHER'
  };

  const seedData = [
    {
      id: 'agent-orchestration',
      title: 'AI agents become orchestration systems, not better chatbots.',
      why: 'The valuable layer will coordinate knowledge, decisions, tools, and durable work—not merely produce fluent answers.',
      domain: 'AI Engineering',
      horizon: 2029,
      confidence: 78,
      status: 'Active',
      created: '2026-09-09',
      updated: '2026-09-09',
      evidence: [
        'Reliable production systems are converging on explicit state, validators, tool contracts, and human checkpoints.',
        'Enterprise value appears when the system can finish a workflow and leave an auditable decision trail.',
        'Model gains improve the planner, but orchestration determines whether a long-running task survives reality.'
      ],
      counters: [
        'Frontier models may absorb enough planning and memory that dedicated orchestration becomes temporary scaffolding.',
        'Integration and governance costs may keep most agent deployments narrow and human-led.'
      ],
      signals: [
        { text: 'Major platforms expose durable runs and resumable task state as first-class primitives.', state: 'watching' },
        { text: 'A repeatable enterprise workflow completes end-to-end with less than 10% human intervention.', state: 'met' },
        { text: 'Buyers measure work completed rather than seats, tokens, or time saved.', state: 'watching' }
      ]
    },
    {
      id: 'hyderabad-core',
      title: 'Hyderabad’s Financial District compounds into a real urban core.',
      why: 'The investment case depends less on another tower and more on the district becoming useful after office hours.',
      domain: 'Hyderabad',
      horizon: 2032,
      confidence: 59,
      status: 'Active',
      created: '2026-09-09',
      updated: '2026-09-09',
      evidence: [
        'Employment density, schools, and high-income housing already sit unusually close together.',
        'New mixed-use projects can fill daily-life gaps without requiring a city-scale change.'
      ],
      counters: [
        'Road-first planning may preserve car dependence even as density rises.',
        'Infrastructure delivery can lag private construction long enough to cap quality of life and resale demand.'
      ],
      signals: [
        { text: 'A continuous, shaded walking route connects homes, shops, schools, and offices.', state: 'watching' },
        { text: 'Weekend footfall becomes visible outside malls and gated communities.', state: 'unseen' },
        { text: 'Commercial vacancy stays low while new residential supply is absorbed.', state: 'watching' }
      ]
    },
    {
      id: 'authentic-writing',
      title: 'Writing becomes more valuable as generation becomes cheaper.',
      why: 'When competent prose is abundant, lived experience, judgment, and a recognizable mind become the scarce inputs.',
      domain: 'Writing',
      horizon: 2029,
      confidence: 71,
      status: 'Active',
      created: '2026-09-09',
      updated: '2026-09-09',
      evidence: [
        'Readers increasingly evaluate the provenance and stakes behind a piece, not only its surface quality.',
        'Distinctive personal archives compound: each essay gives the next one context and credibility.'
      ],
      counters: [
        'Distribution may dominate authorship so completely that original voice captures little economic value.',
        'Readers may accept synthetic personalities if the work is consistently useful.'
      ],
      signals: [
        { text: 'Returning readers grow faster than search-driven visits.', state: 'watching' },
        { text: 'Essays with concrete personal stakes outperform generic explainers.', state: 'watching' },
        { text: 'Paid subscribers cite voice or worldview as the reason they stay.', state: 'unseen' }
      ]
    },
    {
      id: 'patient-capital',
      title: 'India’s wealth creation remains broad enough for patient index exposure.',
      why: 'If national productivity and formalization keep compounding, diversified ownership should beat repeated attempts to identify each winner.',
      domain: 'Investing',
      horizon: 2036,
      confidence: 64,
      status: 'Watching',
      created: '2026-09-09',
      updated: '2026-09-09',
      evidence: [
        'Formal savings continue moving toward market-linked assets from physical stores of wealth.',
        'A broad index automatically replaces declining businesses with emerging leaders.'
      ],
      counters: [
        'Starting valuations can absorb years of otherwise strong earnings growth.',
        'Index concentration may create less diversification than the headline number implies.'
      ],
      signals: [
        { text: 'Earnings growth closes the gap with headline index valuations.', state: 'watching' },
        { text: 'Domestic participation persists through a meaningful drawdown.', state: 'unseen' },
        { text: 'Market leadership broadens beyond a small group of large companies.', state: 'unseen' }
      ]
    },
    {
      id: 'institutional-memory',
      title: 'Institutions fail when they lose the memory of why a rule exists.',
      why: 'History is most useful when it preserves the causal story behind a norm—not when it merely preserves the norm.',
      domain: 'History',
      horizon: 2035,
      confidence: 67,
      status: 'Watching',
      created: '2026-09-09',
      updated: '2026-09-09',
      evidence: [
        'Rules that outlive their original threat tend to become ritual, then attract indiscriminate removal.',
        'Teams repeat old failures when decisions retain outcomes but discard alternatives and context.'
      ],
      counters: [
        'Institutional memory can also fossilize old assumptions and give incumbents rhetorical cover.',
        'Some systems improve precisely because a new generation ignores inherited explanations.'
      ],
      signals: [
        { text: 'Decision logs record rejected alternatives and predicted failure modes.', state: 'unseen' },
        { text: 'Postmortems are referenced before similar high-stakes changes.', state: 'watching' },
        { text: 'Rules carry review dates and explicit origin stories.', state: 'unseen' }
      ]
    }
  ];

  const state = {
    theses: loadTheses(),
    selectedId: null,
    filter: 'All',
    query: ''
  };

  const els = {
    list: document.querySelector('#thesisList'),
    filters: document.querySelector('#filters'),
    workspace: document.querySelector('#workspace'),
    count: document.querySelector('#libraryCount'),
    search: document.querySelector('#searchInput'),
    newButton: document.querySelector('#newThesisButton'),
    exportButton: document.querySelector('#exportButton'),
    dialog: document.querySelector('#newThesisDialog'),
    form: document.querySelector('#newThesisForm'),
    cancelDialog: document.querySelector('#cancelDialog'),
    emptyTemplate: document.querySelector('#emptyTemplate')
  };

  let saveTimer;
  let indicatorTimer;

  function loadTheses() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {
      console.warn('Could not read saved theses.', error);
    }
    return structuredClone(seedData);
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64) || `thesis-${Date.now()}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function selectedThesis() {
    return state.theses.find((item) => item.id === state.selectedId);
  }

  function filteredTheses() {
    const query = state.query.trim().toLowerCase();
    return state.theses.filter((item) => {
      const domainMatch = state.filter === 'All' || item.domain === state.filter;
      const queryMatch = !query || `${item.title} ${item.why} ${item.domain}`.toLowerCase().includes(query);
      return domainMatch && queryMatch;
    });
  }

  function ensureSelection() {
    const visible = filteredTheses();
    if (!visible.some((item) => item.id === state.selectedId)) {
      state.selectedId = visible[0]?.id || null;
    }
  }

  function persist(showIndicator = true) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.theses));
      if (showIndicator) showSaved();
    }, 180);
  }

  function showSaved() {
    let indicator = document.querySelector('.saved-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'saved-indicator';
      indicator.setAttribute('role', 'status');
      indicator.textContent = 'Saved on this device';
      document.body.append(indicator);
    }
    clearTimeout(indicatorTimer);
    indicator.classList.add('show');
    indicatorTimer = setTimeout(() => indicator.classList.remove('show'), 1200);
  }

  function renderFilters() {
    const counts = state.theses.reduce((acc, item) => {
      acc[item.domain] = (acc[item.domain] || 0) + 1;
      return acc;
    }, {});
    const available = domains.filter((domain) => domain === 'All' || counts[domain]);
    els.filters.innerHTML = available.map((domain) => `
      <button class="filter-button ${state.filter === domain ? 'active' : ''}" type="button" data-filter="${escapeHtml(domain)}">
        ${escapeHtml(domain === 'All' ? `All ${state.theses.length}` : `${domainCodes[domain]} ${counts[domain]}`)}
      </button>
    `).join('');
  }

  function renderList() {
    const visible = filteredTheses();
    els.count.textContent = state.theses.length;
    els.list.innerHTML = visible.map((item) => `
      <button class="thesis-card ${item.id === state.selectedId ? 'active' : ''}" type="button" data-select="${escapeHtml(item.id)}" aria-current="${item.id === state.selectedId ? 'true' : 'false'}">
        <span aria-hidden="true"></span>
        <span>
          <span class="card-meta">
            <span class="eyebrow">${escapeHtml(domainCodes[item.domain] || 'OTHER')} / ${escapeHtml(item.horizon)}</span>
            <span class="mini-score">${escapeHtml(item.confidence)}%</span>
          </span>
          <h3>${escapeHtml(item.title)}</h3>
          <span class="card-foot">
            <span>${escapeHtml(item.status)}</span>
            <span>${item.evidence.length + item.counters.length} notes</span>
          </span>
        </span>
      </button>
    `).join('');
  }

  function renderWorkspace() {
    const thesis = selectedThesis();
    if (!thesis) {
      els.workspace.replaceChildren(els.emptyTemplate.content.cloneNode(true));
      return;
    }

    const domainOptions = domains.slice(1).map((domain) => `<option ${thesis.domain === domain ? 'selected' : ''}>${escapeHtml(domain)}</option>`).join('');
    const statusOptions = ['Active', 'Watching', 'Archived'].map((status) => `<option ${thesis.status === status ? 'selected' : ''}>${status}</option>`).join('');

    els.workspace.innerHTML = `
      <article class="workspace-inner" data-thesis-id="${escapeHtml(thesis.id)}">
        <header class="thesis-header">
          <div>
            <div class="section-label">${escapeHtml(domainCodes[thesis.domain] || 'OTHER')} <span>/ HORIZON ${escapeHtml(thesis.horizon)}</span></div>
            <textarea class="thesis-title-input" data-field="title" rows="2" aria-label="Thesis statement">${escapeHtml(thesis.title)}</textarea>
            <textarea class="thesis-why" data-field="why" rows="2" aria-label="Why this thesis matters" placeholder="Why does this matter?">${escapeHtml(thesis.why)}</textarea>
          </div>
          <div class="confidence-block">
            <div class="confidence-number"><span id="confidenceValue">${escapeHtml(thesis.confidence)}</span><small>%</small></div>
            <div class="confidence-label">Current conviction</div>
            <input type="range" min="0" max="100" step="1" value="${escapeHtml(thesis.confidence)}" data-field="confidence" aria-label="Confidence ${escapeHtml(thesis.confidence)} percent" />
          </div>
        </header>

        <div class="meta-strip">
          <div class="meta-field">
            <label for="domainField">Domain</label>
            <select id="domainField" data-field="domain">${domainOptions}</select>
          </div>
          <div class="meta-field">
            <label for="horizonField">Horizon</label>
            <input id="horizonField" data-field="horizon" type="number" min="2026" max="2100" value="${escapeHtml(thesis.horizon)}" />
          </div>
          <div class="meta-field">
            <label for="statusField">State</label>
            <select id="statusField" data-field="status">${statusOptions}</select>
          </div>
          <div class="delete-wrap">
            <button class="text-button delete-button" data-action="delete" type="button">Delete</button>
          </div>
        </div>

        <div class="thesis-grid">
          ${renderEvidenceColumn('Evidence for', 'What makes the claim more likely?', thesis.evidence, 'evidence')}
          ${renderEvidenceColumn('Case against', 'What would a smart skeptic notice?', thesis.counters, 'counters')}
        </div>

        <section class="signals-section">
          <div class="signals-head">
            <div>
              <h2>Leading indicators</h2>
              <p>Observable changes that should arrive before the thesis resolves.</p>
            </div>
            <button class="outline-button" data-action="add-signal" type="button">Add signal</button>
          </div>
          <div class="signal-list">
            ${thesis.signals.length ? thesis.signals.map(renderSignal).join('') : '<div class="blank-row">No signals yet. Add one that would change your mind.</div>'}
          </div>
        </section>
      </article>
    `;
    autoResizeAll();
  }

  function renderEvidenceColumn(title, description, items, type) {
    return `
      <section class="evidence-column">
        <div class="column-head">
          <div><h2>${title}</h2><p>${description}</p></div>
          <button class="add-small" data-action="add-item" data-type="${type}" type="button" aria-label="Add ${title.toLowerCase()}">+</button>
        </div>
        <ol class="evidence-list">
          ${items.length ? items.map((text, index) => `
            <li class="evidence-item">
              <span class="evidence-index">${String(index + 1).padStart(2, '0')}</span>
              <textarea class="evidence-text" rows="2" data-list="${type}" data-index="${index}" aria-label="${title} item ${index + 1}">${escapeHtml(text)}</textarea>
              <button class="remove-item" type="button" data-action="remove-item" data-type="${type}" data-index="${index}" aria-label="Remove item">×</button>
            </li>
          `).join('') : `<li class="blank-row">Nothing recorded yet.</li>`}
        </ol>
      </section>
    `;
  }

  function renderSignal(signal, index) {
    const labels = { unseen: 'Not seen', watching: 'Watching', met: 'Observed' };
    return `
      <div class="signal-card">
        <div class="signal-top">
          <button class="signal-status" type="button" data-action="cycle-signal" data-index="${index}" data-state="${escapeHtml(signal.state)}">${labels[signal.state] || 'Not seen'}</button>
          <button class="remove-item" type="button" data-action="remove-signal" data-index="${index}" aria-label="Remove signal">×</button>
        </div>
        <textarea class="signal-text" rows="3" data-signal="${index}" aria-label="Leading indicator ${index + 1}">${escapeHtml(signal.text)}</textarea>
        <div class="signal-foot">Signal ${String(index + 1).padStart(2, '0')}</div>
      </div>
    `;
  }

  function render() {
    ensureSelection();
    renderFilters();
    renderList();
    renderWorkspace();
  }

  function updateThesisField(field, value) {
    const thesis = selectedThesis();
    if (!thesis) return;
    thesis[field] = field === 'confidence' || field === 'horizon' ? Number(value) : value;
    thesis.updated = today();
    persist();
  }

  function autoResize(element) {
    if (!(element instanceof HTMLTextAreaElement)) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }

  function autoResizeAll() {
    document.querySelectorAll('textarea').forEach(autoResize);
  }

  function openNewDialog() {
    els.dialog.showModal();
    requestAnimationFrame(() => els.form.elements.title.focus());
  }

  function addThesis(formData) {
    const title = String(formData.get('title') || '').trim();
    if (!title) return;
    const thesis = {
      id: `${slugify(title)}-${Date.now().toString(36)}`,
      title,
      why: String(formData.get('why') || '').trim(),
      domain: String(formData.get('domain') || 'Other'),
      horizon: Number(formData.get('horizon')) || 2030,
      confidence: 50,
      status: 'Active',
      created: today(),
      updated: today(),
      evidence: [],
      counters: [],
      signals: []
    };
    state.theses.unshift(thesis);
    state.selectedId = thesis.id;
    state.filter = 'All';
    state.query = '';
    els.search.value = '';
    persist();
    render();
    els.workspace.focus({ preventScroll: true });
  }

  function exportMarkdown() {
    const thesis = selectedThesis();
    if (!thesis) return;
    const section = (title, items) => `## ${title}\n\n${items.length ? items.map((item) => `- ${item}`).join('\n') : '_None recorded._'}`;
    const signalLabels = { unseen: 'not seen', watching: 'watching', met: 'observed' };
    const markdown = [
      `# ${thesis.title}`,
      '',
      `**Domain:** ${thesis.domain}  `,
      `**Horizon:** ${thesis.horizon}  `,
      `**Confidence:** ${thesis.confidence}%  `,
      `**Status:** ${thesis.status}  `,
      `**Last updated:** ${thesis.updated}`,
      '',
      thesis.why,
      '',
      section('Evidence for', thesis.evidence),
      '',
      section('Case against', thesis.counters),
      '',
      '## Leading indicators',
      '',
      thesis.signals.length ? thesis.signals.map((signal) => `- [${signal.state === 'met' ? 'x' : ' '}] ${signal.text} _(${signalLabels[signal.state]})_`).join('\n') : '_None recorded._',
      '',
      '---',
      '_Exported from Long Arc._'
    ].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(thesis.title)}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  els.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    render();
  });

  els.list.addEventListener('click', (event) => {
    const card = event.target.closest('[data-select]');
    if (!card) return;
    state.selectedId = card.dataset.select;
    render();
    if (window.innerWidth <= 720) els.workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.search.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  els.workspace.addEventListener('input', (event) => {
    const thesis = selectedThesis();
    if (!thesis) return;
    const target = event.target;
    if (target.matches('[data-field]')) {
      updateThesisField(target.dataset.field, target.value);
      if (target.dataset.field === 'confidence') {
        document.querySelector('#confidenceValue').textContent = target.value;
        target.setAttribute('aria-label', `Confidence ${target.value} percent`);
      }
      if (['title', 'domain', 'horizon', 'status'].includes(target.dataset.field)) renderList();
    } else if (target.matches('[data-list]')) {
      thesis[target.dataset.list][Number(target.dataset.index)] = target.value;
      thesis.updated = today();
      persist();
    } else if (target.matches('[data-signal]')) {
      thesis.signals[Number(target.dataset.signal)].text = target.value;
      thesis.updated = today();
      persist();
    }
    autoResize(target);
  });

  els.workspace.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.matches('[data-field]')) return;
    updateThesisField(target.dataset.field, target.value);
    if (['domain', 'horizon', 'status'].includes(target.dataset.field)) render();
  });

  els.workspace.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const thesis = selectedThesis();
    if (action.dataset.action === 'new') return openNewDialog();
    if (!thesis) return;

    if (action.dataset.action === 'add-item') {
      thesis[action.dataset.type].push('');
      thesis.updated = today();
      persist();
      renderWorkspace();
      const items = els.workspace.querySelectorAll(`[data-list="${action.dataset.type}"]`);
      items[items.length - 1]?.focus();
    }

    if (action.dataset.action === 'remove-item') {
      thesis[action.dataset.type].splice(Number(action.dataset.index), 1);
      thesis.updated = today();
      persist();
      renderWorkspace();
    }

    if (action.dataset.action === 'add-signal') {
      thesis.signals.push({ text: '', state: 'unseen' });
      thesis.updated = today();
      persist();
      renderWorkspace();
      const items = els.workspace.querySelectorAll('[data-signal]');
      items[items.length - 1]?.focus();
    }

    if (action.dataset.action === 'remove-signal') {
      thesis.signals.splice(Number(action.dataset.index), 1);
      thesis.updated = today();
      persist();
      renderWorkspace();
    }

    if (action.dataset.action === 'cycle-signal') {
      const signal = thesis.signals[Number(action.dataset.index)];
      const cycle = { unseen: 'watching', watching: 'met', met: 'unseen' };
      signal.state = cycle[signal.state] || 'unseen';
      thesis.updated = today();
      persist();
      renderWorkspace();
    }

    if (action.dataset.action === 'delete') {
      const accepted = window.confirm('Delete this thesis from this device? This cannot be undone.');
      if (!accepted) return;
      state.theses = state.theses.filter((item) => item.id !== thesis.id);
      state.selectedId = null;
      persist(false);
      render();
    }
  });

  els.newButton.addEventListener('click', openNewDialog);
  els.exportButton.addEventListener('click', exportMarkdown);
  els.cancelDialog.addEventListener('click', () => els.dialog.close());
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    addThesis(new FormData(els.form));
    els.form.reset();
    els.dialog.close();
  });

  document.addEventListener('keydown', (event) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      els.search.focus();
    }
    if (event.key.toLowerCase() === 'n' && !typing && !event.metaKey && !event.ctrlKey && !els.dialog.open) {
      event.preventDefault();
      openNewDialog();
    }
    if (event.key === 'Escape' && els.dialog.open) els.dialog.close();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      state.theses = JSON.parse(event.newValue);
      render();
    } catch (error) {
      console.warn('Could not sync saved theses.', error);
    }
  });

  state.selectedId = state.theses[0]?.id || null;
  render();
})();
