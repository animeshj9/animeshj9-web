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

  // Keep only predictions with an observable outcome and an explicit resolution date.
  // Broader former starter ideas remain in Git history, not as scored predictions.
  const seedData = [
    {
      id: 'agent-orchestration',
      title: 'By 2029, a public evaluation will show an enterprise agent workflow completing over 90% of attempted runs unaided.',
      why: 'Proposed resolution test: by 2029-12-31, an independently checkable public report shows a named, fixed-scope, multi-step, tool-using production workflow completing over 90% of all attempted runs without human help. The workflow must use a model to choose a subsequent tool action from intermediate results, rather than only execute a fixed sequence. The proposed evaluation minimum is 100 consecutive eligible attempts, with eligibility, the reporting window and success criteria fixed in advance. Count from the initial request to verified downstream completion; approvals, corrections and handoffs count as help. Human-assisted runs plus unassisted unsuccessful runs must be <10% of the full denominator, including failures, timeouts and abandoned attempts. The report must disclose run counts, dates, outcome checks and an interruption/resumption test. No qualifying report by the deadline fails this public-evidence prediction, not the possibility of private capability. The 100-run protocol is newly proposed; 78% is the unchanged starter conviction, not a recalibrated estimate.',
      domain: 'AI Engineering',
      horizon: 2029,
      confidence: 78,
      status: 'Active',
      created: '2026-09-09',
      updated: '2026-09-30',
      evidence: [
        'OpenAI documents background tasks, status polling and stream resumption: https://developers.openai.com/api/docs/guides/background. These are infrastructure primitives, not evidence that the resolution test has passed.',
        'Hypothesis to test: explicit task state, tool contracts and validators make completed work auditable, rather than treating a fluent answer as a finished workflow.'
      ],
      counters: [
        'A workflow that still needs approval, repair or human completion in 10% or more of attempts fails the test; abandoned, timed-out and incorrect runs also count against it.',
        'A selected demo, a small sample below the proposed minimum, or a report that omits attempted runs, unsuccessful outcomes or the evaluation method cannot resolve this prediction.',
        'Even a qualifying result would establish one bounded workflow, not broad autonomous enterprise adoption or proof that a separate orchestration layer wins.'
      ],
      signals: [
        { text: 'A public evaluation fixes its workflow boundary, reporting window and correctness checks before measuring results.', state: 'unseen' },
        { text: 'Published logs distinguish accepted inputs, verified completions, human assistance and unsuccessful attempts.', state: 'unseen' },
        { text: 'An interrupted task resumes from recorded state without losing or duplicating completed work.', state: 'unseen' }
      ]
    },
    {
      id: 'hyderabad-core',
      title: 'By 2032, a public audit will document a continuous Financial District walking route linking homes, shops, a school and offices.',
      why: 'Proposed resolution test: by 2032-12-31, a public, dated on-foot audit maps one connected route in Hyderabad’s Financial District linking the public-facing entrances of occupied homes, a trading shop, an operating school and occupied offices. Declare the district study boundary, map source and named endpoints before the audit. Show every segment and crossing: the route must use publicly accessible sidewalks or separated pedestrian paths and formal pedestrian crossings, with no forced walk along a live traffic lane or passage through a private gate. Entry into private grounds is not required. No qualifying audit by the deadline fails this public-evidence prediction; it does not establish that no physical route exists. This tests one connection, not an urban core. The audit protocol is newly proposed; 59% is the unchanged starter conviction, not a recalibrated estimate.',
      domain: 'Hyderabad',
      horizon: 2032,
      confidence: 59,
      status: 'Active',
      created: '2026-09-09',
      updated: '2026-09-30',
      evidence: [
        'The public Footpath Optional project provides a dated OpenStreetMap snapshot and a field-audit method, but records zero reviewed firsthand surveys: https://github.com/animeshj9/animeshj9-web/blob/c2533cf2a4d9dc4496649c3816b3466fbe1bf8a4/docs/FOOTPATH_OPTIONAL.md.',
        'That snapshot is a starting point for finding candidate links, not proof of current access, usable crossings or a continuous route. No qualifying route is established here.'
      ],
      counters: [
        'Separate footpath segments do not pass if a missing link, impassable obstruction or restricted gate forces pedestrians off the route.',
        'A plan, rendering, construction announcement or map tag without a dated end-to-end field audit cannot resolve the prediction.',
        'One working connection would not establish district-wide walkability, weekend activity, low vacancy or investment returns.'
      ],
      signals: [
        { text: 'A candidate route is mapped with named endpoints and a segment-by-segment inventory of missing pedestrian links.', state: 'unseen' },
        { text: 'Dated field evidence shows missing footpath links and crossings becoming usable and publicly accessible.', state: 'unseen' },
        { text: 'Shade is recorded by segment, date and time as a comfort indicator; it is not treated as proof of connectivity.', state: 'unseen' }
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
