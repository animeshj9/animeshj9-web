import { parseFeed, analyzeFeed, applyFixes, toDelimited, issueCSV, reportHTML, escapeHTML, MAX_BYTES } from './core.mjs';
import { SAMPLE } from './sample.mjs';
import { PILOT } from './config.mjs';
const $ = id => document.getElementById(id);
const esc = escapeHTML;
let result = null, filename = '', visible = 50, requestID = 0;
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function resetView() { result = null; $('results').hidden = true; $('error').hidden = true; $('fix-dialog').close(); $('fix-list').replaceChildren(); $('issue-list').replaceChildren(); }
function fail(error) { resetView(); $('error').textContent = error.message || 'Could not read this file. Try a UTF-8 CSV or TSV.'; $('error').hidden = false; $('status').textContent = ''; }
function check(text, name) {
  resetView();
  try {
    result = analyzeFeed(parseFeed(text)); filename = name;
    $('filename').textContent = name; $('product-count').textContent = result.products.toLocaleString();
    $('error-count').textContent = result.errors.toLocaleString(); $('warning-count').textContent = result.warnings.toLocaleString(); $('fix-count').textContent = result.fixes.length.toLocaleString();
    $('verdict').textContent = result.errors ? 'Resolve the errors first. Formatting fixes can help, but missing product facts still need your attention.' : 'No errors found by these checks. This is not an approval: review category, country, policy, and landing-page requirements separately.';
    $('review-fixes').disabled = !result.fixes.length; $('severity').value = 'all'; $('search').value = ''; visible = 50; renderIssues();
    $('results').hidden = false; $('status').textContent = `Checked ${result.products.toLocaleString()} products locally. Nothing was uploaded.`;
    $('results').focus({ preventScroll: true }); $('results').scrollIntoView({ behavior: 'auto', block: 'start' });
  } catch (error) { fail(error); }
}
async function readFile(file) {
  if (!file) return;
  const current = ++requestID; resetView(); $('status').textContent = 'Reading and checking locally…';
  try {
    if (file.size > MAX_BYTES) throw new Error('This beta accepts files up to 5 MB. Export a smaller feed.');
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error('Choose a CSV, TSV, or tab-delimited TXT file. XML and Excel files are not supported yet.');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (current === requestID) check(text, file.name);
  } catch (error) { if (current === requestID) fail(error instanceof TypeError ? new Error('This file is not UTF-8. Export it as UTF-8 CSV or TSV.') : error); }
}
function renderIssues() {
  if (!result) return;
  const query = $('search').value.toLowerCase().trim(), severity = $('severity').value;
  const issues = result.issues.filter(i => (severity === 'all' || i.severity === severity) && `${i.id} ${i.title} ${i.field} ${i.message}`.toLowerCase().includes(query));
  $('issue-count').textContent = `${Math.min(visible, issues.length)} of ${issues.length.toLocaleString()} findings`;
  $('issue-list').innerHTML = issues.length ? issues.slice(0, visible).map(i => `<article class="issue ${i.severity}"><div><span class="severity">${i.severity === 'error' ? 'Error' : 'Review'}</span><span class="rownum">Record ${i.row}</span></div><div><h3>${esc(i.message)}</h3><p class="context">${esc(i.id || (i.row === 1 ? 'Whole feed' : 'No product ID'))}${i.title ? ' · ' + esc(i.title.slice(0, 140)) : ''} · <code>${esc(i.field)}</code></p>${i.value ? `<p>Found: <code>${esc(i.value.length > 180 ? i.value.slice(0,180) + '…' : i.value)}</code></p>` : ''}<p>${esc(i.action)}</p><a href="${i.source}" target="_blank" rel="noopener noreferrer">Reference specification ↗</a></div></article>`).join('') : '<div class="empty">No matching findings. A clean preflight does not guarantee Merchant Center approval.</div>';
  $('show-more').hidden = issues.length <= visible;
}
$('file').addEventListener('change', e => { readFile(e.target.files[0]); e.target.value = ''; });
$('sample').addEventListener('click', () => { ++requestID; check(SAMPLE, 'Example feed · fictional products'); });
$('check-paste').addEventListener('click', () => { ++requestID; check($('paste-input').value, 'Pasted feed'); });
for (const event of ['dragenter', 'dragover']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.add('dragover'); });
for (const event of ['dragleave', 'drop']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.remove('dragover'); });
$('dropzone').addEventListener('drop', e => { if (e.dataTransfer.files.length !== 1) { ++requestID; fail(new Error('Drop one feed at a time.')); } else readFile(e.dataTransfer.files[0]); });
$('severity').addEventListener('change', () => { visible = 50; renderIssues(); });
$('search').addEventListener('input', () => { visible = 50; renderIssues(); });
$('show-more').addEventListener('click', () => { visible += 50; renderIssues(); });
$('download-report').addEventListener('click', () => { if (result) download(reportHTML(result, filename), 'feedproof-report.html', 'text/html;charset=utf-8'); });
$('download-issues').addEventListener('click', () => { if (result) download(issueCSV(result), 'feedproof-issues.csv', 'text/csv;charset=utf-8'); });
$('review-fixes').addEventListener('click', () => {
  if (!result) return;
  $('fix-consent').checked = false; $('download-fixed').disabled = true;
  const groups = new Map();
  for (const fix of result.fixes) {
    const key = JSON.stringify([fix.field, fix.before, fix.after]);
    if (!groups.has(key)) groups.set(key, { ...fix, count: 0, records: [] });
    const group = groups.get(key); group.count++; if (group.records.length < 5) group.records.push(fix.row);
  }
  $('fix-list').innerHTML = [...groups.values()].map(f => `<div class="fix-row"><strong>${esc(f.field)}</strong> · ${f.count} ${f.count === 1 ? 'cell' : 'cells'} · record${f.records.length > 1 ? 's' : ''} ${f.records.join(', ')}${f.count > 5 ? ', …' : ''}<br><del>${esc(f.before)}</del> → <ins>${esc(f.after)}</ins></div>`).join('');
  $('fix-dialog').showModal();
});
$('close-fixes').addEventListener('click', () => $('fix-dialog').close());
$('fix-consent').addEventListener('change', () => { $('download-fixed').disabled = !$('fix-consent').checked; });
$('download-fixed').addEventListener('click', () => {
  if (!result || !$('fix-consent').checked) return;
  const fixed = toDelimited(applyFixes(result), '\t');
  download(fixed, 'feedproof-formatting-fixed.tsv', 'text/tab-separated-values;charset=utf-8');
  $('fix-dialog').close(); check(fixed, 'Formatting-fixed feed · rechecked locally');
});
$('clear').addEventListener('click', () => { ++requestID; resetView(); filename = ''; $('paste-input').value = ''; $('file').value = ''; $('status').textContent = 'Feed cleared from this page.'; $('sample').focus(); });
function configurePilot() {
  const link = $('pilot-link');
  try {
    const url = new URL(PILOT.checkoutURL);
    // Payment link only; no arbitrary javascript/data URLs and no catalogue query parameters.
    if (!PILOT.enabled || url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password) throw new Error('Not enabled');
    link.href = url.href; link.removeAttribute('aria-disabled'); link.textContent = 'Request the $49 repair pilot'; link.rel = 'noopener noreferrer';
    $('pilot-status').textContent = 'Continue to Stripe. No catalogue data is attached. Confirm scope with us before paying; follow-up uses your checkout email.';
  } catch { link.addEventListener('click', e => { e.preventDefault(); $('pilot-status').textContent = 'Paid requests are not open yet. You can use every checker and export feature for free.'; }); }
}
configurePilot();
