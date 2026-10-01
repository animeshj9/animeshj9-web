import {VERSION, STORAGE_KEY, MAX_TRIALS, SAMPLE, STAGES, validateTrial, assistedMinutes, summarize, parseStored, toJSON, toCSV} from './core.mjs';

const $ = id => document.getElementById(id);
const form = $('trial-form');
const dialog = $('confirm-dialog');
let state = {version: VERSION, trials: [], hourlyValue: null};
let preview = false;
let sampleHourlyValue = 40;
let storageBlocked = false;
let corruptStorage = false;
let pendingAction = null;
let toastTimeout;
const minuteFormat = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
const moneyFormat = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4});
const minutes = value => minuteFormat.format(Math.abs(value) < 0.000001 ? 0 : value);
const money = value => moneyFormat.format(Math.abs(value) < 0.000001 ? 0 : value);
const signedMinutes = value => `${value > 0 ? '+' : ''}${minutes(value)}`;
function node(tag, className, text) { const result = document.createElement(tag); if (className) result.className = className; if (text !== undefined) result.textContent = text; return result; }
function say(message) { clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').hidden = false; toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 6000); }
function warnStorage(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false; }

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try { state = parseStored(raw); }
    catch { corruptStorage = true; warnStorage('Saved data could not be read. It has been left untouched. New entries will stay in memory until you use “Clear my data” to reset this notebook. Export any new entries before leaving.'); }
  }
} catch {
  storageBlocked = true;
  warnStorage('Browser storage is unavailable. You can still use this workbench, but entries will disappear when you leave. Export a backup before closing this page.');
}

function persist() {
  if (corruptStorage) return false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageBlocked = false; $('storage-warning').hidden = true; return true; }
  catch { storageBlocked = true; warnStorage('These results are in memory only: browser storage is unavailable or full. Export a backup before closing this page.'); return false; }
}

function renderChart(summary) {
  const chart = $('bar-chart');
  chart.replaceChildren();
  if (!summary.count) {
    const empty = node('div', 'chart-empty'); const mark = node('span', '', '—'); mark.setAttribute('aria-hidden', 'true');
    empty.append(mark, node('p', '', 'Your baseline and full AI effort will appear side by side.')); chart.append(empty);
    $('hidden-work-note').textContent = 'Review and rework are work. Keep them in the total.';
    return;
  }
  const max = Math.max(summary.baseline, summary.assisted);
  function bar(label, total, segments) {
    const row = node('div', 'bar-row'); const labelRow = node('div', 'bar-label'); labelRow.append(node('span', '', label), node('strong', '', `${minutes(total)} min`));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bar-track'); svg.setAttribute('viewBox', '0 0 1000 40'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${label}: ${minutes(total)} minutes. ${segments.map(segment => `${segment.label}: ${minutes(segment.value)} minutes`).join('. ')}`);
    let x = 0;
    segments.forEach(segment => {
      const width = segment.value / max * 1000;
      if (width > 0) { const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.setAttribute('x', x); rect.setAttribute('y', '0'); rect.setAttribute('width', width); rect.setAttribute('height', '40'); rect.classList.add(segment.className); svg.append(rect); }
      x += width;
    });
    row.append(labelRow, svg); chart.append(row);
  }
  bar('Without AI · baseline', summary.baseline, [{label: 'Baseline', value: summary.baseline, className: 'baseline-bar'}]);
  bar('With AI · the full attempt', summary.assisted, STAGES.map(stage => ({label: stage, value: summary.stages[stage], className: stage})));
  const hidden = summary.stages.review + summary.stages.rework;
  $('hidden-work-note').textContent = `Review + rework: ${minutes(hidden)} min, or ${minutes(hidden / summary.assisted * 100)}% of the AI-assisted effort. Both are included above.`;
}

function renderTrialLog(trials) {
  const list = $('trial-list'); list.replaceChildren();
  $('trial-count').textContent = String(trials.length).padStart(2, '0');
  if (!trials.length) {
    const empty = node('div', 'history-empty'); const plus = node('span', '', '+'); plus.setAttribute('aria-hidden', 'true');
    empty.append(plus, node('h3', '', 'No grand claims. Just your first trial.'), node('p', '', 'Record a task above, then try it again. Small samples are observations, not conclusions.')); list.append(empty); return;
  }
  const repetitions = new Map();
  const numbering = new Map();
  trials.forEach(trial => { const key = trial.task.toLocaleLowerCase('en-US'); const count = (repetitions.get(key) || 0) + 1; repetitions.set(key, count); numbering.set(trial.id, count); });
  [...trials].reverse().forEach(trial => {
    const article = node('article', 'trial-card');
    const top = node('div', 'trial-card-top'); const name = node('div'); name.append(node('h3', 'trial-title', trial.task));
    const timestamp = preview ? 'Fictional data' : new Date(trial.createdAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
    name.append(node('p', 'trial-meta', `${preview ? 'Example trial' : `Attempt ${numbering.get(trial.id)}`} · ${timestamp}`));
    const actions = node('div', 'trial-actions'); actions.append(node('span', `quality-pill ${trial.quality === 'fail' ? 'fail' : ''}`, trial.quality === 'pass' ? 'Quality passed' : 'Quality not met'));
    if (!preview) { const remove = node('button', 'trial-delete', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Delete trial: ${trial.task}, attempt ${numbering.get(trial.id)}`); remove.addEventListener('click', () => askConfirmation('Delete this trial?', `“${trial.task}” will be removed from your real results. This cannot be undone.`, 'Delete trial', () => { state.trials = state.trials.filter(item => item.id !== trial.id); persist(); render(); say('Trial deleted.'); })); actions.append(remove); }
    top.append(name, actions);
    const details = node('div', 'trial-details');
    const effort = assistedMinutes(trial); const delta = trial.baseline - effort;
    [['Baseline', `${minutes(trial.baseline)} min`], ['With AI', `${minutes(effort)} min`], ['Saved', `${signedMinutes(delta)} min`], ['Cost', money(trial.cost)]].forEach(([label, value]) => { const item = node('div', 'trial-detail', label); item.append(node('strong', label === 'Saved' ? (delta < 0 ? 'negative' : 'positive') : '', value)); details.append(item); });
    article.append(top, details);
    const stageDetails = node('details', 'trial-stage-detail'); stageDetails.append(node('summary', '', 'See the effort breakdown'), node('p', '', `Prompting ${minutes(trial.prompting)} min · Generation / waiting ${minutes(trial.generation)} min · Review ${minutes(trial.review)} min · Rework ${minutes(trial.rework)} min`)); article.append(stageDetails);
    if (trial.notes) article.append(node('p', 'trial-notes', trial.notes));
    list.append(article);
  });
}

function render() {
  const trials = preview ? [SAMPLE] : state.trials;
  const hourly = preview ? sampleHourlyValue : state.hourlyValue;
  const summary = summarize(trials, hourly);
  $('sample-toggle').setAttribute('aria-pressed', String(preview));
  $('sample-toggle').textContent = preview ? 'Back to my results →' : 'Explore a synthetic example ↗';
  $('sample-banner').hidden = !preview;
  $('saved-value').replaceChildren(node('span', '', summary.count ? signedMinutes(summary.saved) : '—'));
  if (summary.count) $('saved-value').append(node('span', 'unit', 'min'));
  $('saved-detail').textContent = summary.count ? `${minutes(Math.abs(summary.savedPercent))}% ${summary.saved >= 0 ? 'less' : 'more'} time vs. baseline · all attempts` : 'Your first measurement starts here';
  $('quality-value').textContent = summary.count ? `${minutes(summary.passRate * 100)}%` : '—';
  $('quality-detail').textContent = summary.count ? `${summary.passed} of ${summary.count} ${summary.count === 1 ? 'attempt' : 'attempts'} met your quality bar` : 'Set the same bar for both methods';
  $('cost-value').textContent = summary.count ? money(summary.cost) : '—';
  for (const id of ['saved-value', 'quality-value', 'cost-value']) $(id).classList.toggle('is-long', $(id).textContent.length > 11);
  $('cost-detail').textContent = summary.count ? `Across ${summary.count} ${preview ? 'synthetic' : 'recorded'} ${summary.count === 1 ? 'trial' : 'trials'}` : 'Incremental cost across your trials';
  $('evidence-note').textContent = preview ? 'Synthetic preview · One made-up example, not evidence of AI performance.' : summary.count ? `${summary.count} recorded ${summary.count === 1 ? 'observation' : 'observations'}. Descriptive results only; task differences, practice, and measurement choices matter.${summary.passed < summary.count ? ' Includes quality failures; time saved does not imply a usable result.' : ''}` : 'No observations yet. Start with one task you can measure both ways.';
  $('breakdown-subtitle').textContent = summary.count ? `Total across ${summary.count} ${preview ? 'synthetic' : 'recorded'} ${summary.count === 1 ? 'attempt' : 'attempts'}. All stages count.` : 'A fair comparison includes the invisible work.';
  renderChart(summary);
  if (document.activeElement !== $('hourly-value')) $('hourly-value').value = hourly ?? '';
  $('net-value').textContent = summary.netValue === null ? '—' : money(summary.netValue);
  $('net-value').className = summary.netValue === null ? '' : summary.netValue < 0 ? 'negative' : 'positive';
  $('value-explainer').textContent = !summary.count ? 'Add a trial and an hourly value to see this estimate.' : hourly === null ? 'Enter an hourly value to estimate time value minus tool cost.' : `${preview ? 'Synthetic estimate' : 'Estimate for these trials only'} at ${money(hourly)} / hour. This is time value, not cash earned.${summary.passed < summary.count ? ' Quality failures are included; value may not be realized.' : ''}`;
  $('break-even').textContent = !summary.count ? 'Break-even is shown only when measured time saved is positive.' : summary.breakEvenHourly === null ? 'No positive time savings to offset the tool cost. A break-even hourly value does not apply.' : `Break-even time value: ${money(summary.breakEvenHourly)} / hour. Above this rate, the measured time value covers tool cost. This does not adjust for quality.`;
  renderTrialLog(trials);
  $('export-csv').disabled = !state.trials.length;
  $('export-json').disabled = !state.trials.length;
  $('clear-data').disabled = !state.trials.length && state.hourlyValue === null && !corruptStorage;
  $('export-note').textContent = preview ? `Exports still contain only your ${state.trials.length} real ${state.trials.length === 1 ? 'trial' : 'trials'}, never this example. All costs are USD.` : 'Exports contain your real trials only. All costs are USD.';
  $('task-names').replaceChildren(...[...new Set(state.trials.map(trial => trial.task))].map(task => { const option = node('option'); option.value = task; return option; }));
}

function togglePreview(next) { preview = next; $('hourly-error').hidden = true; $('hourly-value').value = preview ? sampleHourlyValue ?? '' : state.hourlyValue ?? ''; render(); }
$('sample-toggle').addEventListener('click', () => togglePreview(!preview));
$('sample-close').addEventListener('click', () => { togglePreview(false); $('sample-toggle').focus(); });

form.addEventListener('submit', event => {
  event.preventDefault(); $('form-error').hidden = true;
  if (state.trials.length >= MAX_TRIALS) { $('form-error').textContent = `This notebook holds up to ${MAX_TRIALS} trials. Export a backup and clear older trials to continue.`; $('form-error').hidden = false; return; }
  let trial;
  try { trial = validateTrial(Object.fromEntries(new FormData(form))); }
  catch (error) { $('form-error').textContent = error.message; $('form-error').hidden = false; return; }
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  state.trials.push({id, createdAt: new Date().toISOString(), ...trial});
  const saved = persist();
  preview = false; form.reset(); render(); $('task').focus();
  say(saved ? 'Trial saved in this browser. Every minute counts.' : 'Trial added for this session. Export a backup before leaving.');
});

$('hourly-value').addEventListener('input', () => {
  const input = $('hourly-value');
  const raw = input.value;
  let value = raw === '' ? null : Number(raw);
  if (input.validity.badInput || (value !== null && (!Number.isFinite(value) || value < 0 || value > 1000000))) {
    $('hourly-error').textContent = 'Enter an hourly value from 0 to 1,000,000 USD, or leave it blank.'; $('hourly-error').hidden = false; $('net-value').textContent = '—'; return;
  }
  $('hourly-error').hidden = true;
  if (preview) sampleHourlyValue = value;
  else { state.hourlyValue = value; persist(); }
  render();
});

function download(content, type, extension) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = node('a'); link.href = url; link.download = `after-the-demo-${new Date().toISOString().slice(0, 10)}.${extension}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-csv').addEventListener('click', () => { if (!state.trials.length) return; try { download(toCSV(state.trials), 'text/csv;charset=utf-8', 'csv'); say(`${state.trials.length} real ${state.trials.length === 1 ? 'trial' : 'trials'} exported as CSV.`); } catch { say('The CSV export could not be created. Your entries have not changed.'); } });
$('export-json').addEventListener('click', () => { if (!state.trials.length) return; try { download(toJSON(state.trials, state.hourlyValue), 'application/json', 'json'); say(`${state.trials.length} real ${state.trials.length === 1 ? 'trial' : 'trials'} exported as JSON.`); } catch { say('The JSON export could not be created. Your entries have not changed.'); } });

function askConfirmation(title, description, label, action) {
  if (dialog.open) return;
  pendingAction = action; $('confirm-title').textContent = title; $('confirm-description').textContent = description;
  dialog.querySelector('[value="confirm"]').textContent = label; dialog.returnValue = 'cancel'; dialog.showModal();
}
dialog.addEventListener('close', () => { const action = pendingAction; pendingAction = null; if (dialog.returnValue === 'confirm' && action) action(); });
$('clear-data').addEventListener('click', () => askConfirmation('Clear all your data?', `This deletes ${state.trials.length ? `your ${state.trials.length} real ${state.trials.length === 1 ? 'trial' : 'trials'}` : 'your saved notebook'} and hourly value from this browser. It cannot be undone. Export a backup first if you want to keep them.`, 'Clear everything', () => {
  try { localStorage.removeItem(STORAGE_KEY); corruptStorage = false; storageBlocked = false; $('storage-warning').hidden = true; }
  catch { storageBlocked = true; warnStorage('This session was cleared, but browser storage could not be accessed. Previously saved data may remain; use your browser’s site-data controls to remove it.'); }
  state = {version: VERSION, trials: [], hourlyValue: null}; preview = false; form.reset(); $('form-error').hidden = true; $('hourly-error').hidden = true; $('hourly-value').value = ''; render(); say(storageBlocked ? 'Current session cleared. Browser storage could not be verified.' : 'Your local notebook has been cleared.');
}));

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  // Do not replace unsaved in-memory results after a storage failure.
  if (storageBlocked || corruptStorage) {
    warnStorage('This notebook changed in another tab, but this tab has unsaved data. Export this tab’s results before reloading to avoid losing them.');
    return;
  }
  try {
    state = event.newValue === null ? {version: VERSION, trials: [], hourlyValue: null} : parseStored(event.newValue);
    render();
    say('Results updated from another tab. Your unfinished form is still here.');
  } catch {
    corruptStorage = true;
    warnStorage('Another tab saved data this version could not read. Your current results remain here; export a backup before leaving.');
  }
});

render();
