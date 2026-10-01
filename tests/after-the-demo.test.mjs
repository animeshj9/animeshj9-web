import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VERSION, STORAGE_KEY, MAX_TRIALS, SAMPLE, STAGES, validateTrial, assistedMinutes, summarize, parseStored, toCSV, toJSON} from '../dist/after-the-demo/core.mjs';

const trial = (overrides = {}) => ({id: 'trial-1', createdAt: '2026-10-01T08:00:00.000Z', task: 'Write a project brief', baseline: 45, prompting: 6, generation: 4, review: 12, rework: 9, cost: 0.8, quality: 'pass', notes: 'All decisions checked.', ...overrides});
const stored = (trials = [trial()], extra = {}) => JSON.stringify({version: VERSION, trials, hourlyValue: null, ...extra});

test('After the Demo validates and normalizes actual form data', () => {
  const input = Object.fromEntries(Object.entries(trial()).map(([key, value]) => [key, String(value)]));
  input.task = '  Project brief  ';
  const clean = validateTrial(input);
  assert.equal(clean.task, 'Project brief');
  assert.equal(clean.baseline, 45);
  assert.equal(clean.cost, 0.8);
  assert.equal(clean.id, undefined);
  assert.deepEqual(STAGES, ['prompting', 'generation', 'review', 'rework']);
});

test('After the Demo counts prompting, waiting, review and rework', () => {
  assert.equal(assistedMinutes(trial()), 31);
  const summary = summarize([trial()], 60);
  assert.equal(summary.baseline, 45);
  assert.equal(summary.assisted, 31);
  assert.equal(summary.saved, 14);
  assert.equal(summary.passed, 1);
  assert.equal(summary.passRate, 1);
  assert.equal(summary.cost, 0.8);
  assert.equal(summary.netValue, 13.2);
  assert.ok(Math.abs(summary.breakEvenHourly - 24 / 7) < 1e-10);
  assert.deepEqual(summary.stages, {prompting: 6, generation: 4, review: 12, rework: 9});
});

test('After the Demo includes repeated trials and quality failures without discarding negative results', () => {
  const summary = summarize([trial(), trial({id: 'trial-2', baseline: 20, rework: 19, quality: 'fail', cost: 1.2})]);
  assert.equal(summary.count, 2);
  assert.equal(summary.baseline, 65);
  assert.equal(summary.assisted, 72);
  assert.equal(summary.saved, -7);
  assert.equal(summary.passed, 1);
  assert.equal(summary.passRate, 0.5);
  assert.equal(summary.cost, 2);
  assert.equal(summary.breakEvenHourly, null);
  assert.equal(summary.netValue, null);
});

test('After the Demo is honest about empty, zero and negative outcomes', () => {
  const empty = summarize([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.saved, 0);
  assert.equal(empty.passRate, null);
  assert.equal(empty.savedPercent, null);
  assert.equal(empty.breakEvenHourly, null);
  assert.equal(empty.netValue, null);
  assert.equal(summarize([trial({baseline: 31})], 50).breakEvenHourly, null);
  assert.equal(summarize([trial({baseline: 20})], 60).netValue, -11.8);
  assert.equal(summarize([trial({cost: 0})], 0).netValue, 0);
  assert.equal(summarize([trial({cost: 0})]).breakEvenHourly, 0);
});

test('After the Demo rejects missing, nonfinite, negative and extreme numeric values', () => {
  for (const field of ['baseline', ...STAGES, 'cost']) {
    for (const value of ['', ' ', undefined, null, false, [], {}, NaN, Infinity, -Infinity, 'NaN', 'Infinity', -1, 'not a number', 1e30]) {
      assert.throws(() => validateTrial(trial({[field]: value})), undefined, `${field}=${String(value)}`);
    }
  }
  assert.throws(() => validateTrial(trial({baseline: 0})));
  assert.throws(() => validateTrial(trial({baseline: 1e-320})));
  assert.throws(() => validateTrial(trial({prompting: 0, generation: 0, review: 0, rework: 0})));
  assert.doesNotThrow(() => validateTrial(trial({baseline: 0.01, prompting: 0, generation: 0, review: 0.01, rework: 0, cost: 0})));
  assert.doesNotThrow(() => validateTrial(trial({baseline: 100000, prompting: 100000, generation: 100000, review: 100000, rework: 100000, cost: 1000000})));
});

test('After the Demo requires a task and explicit quality result', () => {
  for (const task of ['', ' ', null, undefined, 'a'.repeat(101)]) assert.throws(() => validateTrial(trial({task})));
  for (const quality of ['', null, undefined, 'maybe', true]) assert.throws(() => validateTrial(trial({quality})));
  assert.throws(() => validateTrial(trial({notes: 'n'.repeat(501)})));
  assert.equal(validateTrial(trial({task: '<script>alert(1)</script>'})).task, '<script>alert(1)</script>');
});

test('After the Demo accepts an optional zero hourly value and rejects invalid values', () => {
  assert.equal(summarize([trial()], null).netValue, null);
  assert.equal(summarize([trial()], '').netValue, null);
  assert.equal(summarize([trial()], '0').netValue, -0.8);
  for (const value of [-1, NaN, Infinity, 'oops', ' ', {}, false, 1000001]) assert.throws(() => summarize([trial()], value));
});

test('After the Demo caps notebook size and keeps derived totals finite', () => {
  const trials = Array.from({length: MAX_TRIALS}, (_, i) => trial({id: `trial-${i}`, baseline: 100000, prompting: 100000, generation: 100000, review: 100000, rework: 100000, cost: 1000000}));
  for (const value of Object.values(summarize(trials, 1000000))) if (typeof value === 'number') assert.ok(Number.isFinite(value));
  assert.throws(() => summarize([...trials, trial()]));
  assert.throws(() => parseStored(stored([...trials, trial()])));
  assert.throws(() => summarize(null));
});

test('After the Demo validates storage without trusting browser-saved records', () => {
  assert.deepEqual(parseStored(stored()), {version: VERSION, trials: [trial()], hourlyValue: null});
  assert.equal(parseStored(stored([], {hourlyValue: 45})).hourlyValue, 45);
  for (const raw of ['{broken', 'null', '[]', '{}', stored([], {version: 99}), stored(null), stored([], {hourlyValue: Infinity}), stored([trial({id: ''})]), stored([trial({createdAt: 'yesterday'})]), stored([trial(), trial()]), stored([SAMPLE])]) {
    // JSON.stringify normalizes Infinity to null; test its string representation separately below.
    if (raw === stored([], {hourlyValue: null})) continue;
    assert.throws(() => parseStored(raw));
  }
  assert.throws(() => parseStored(stored([], {hourlyValue: 'Infinity'})));
  assert.throws(() => parseStored(stored([trial({cost: -4})])));
  assert.ok(STORAGE_KEY.startsWith('after-the-demo:'));
});

test('After the Demo exports round-trippable real records and labels USD and methodology', () => {
  const json = toJSON([trial()], 60);
  const payload = JSON.parse(json);
  assert.equal(payload.currency, 'USD');
  assert.match(payload.methodology, /quality failures/);
  assert.deepEqual(parseStored(json), {version: VERSION, trials: [trial()], hourlyValue: 60});
  assert.throws(() => toJSON([SAMPLE]));
  assert.throws(() => toCSV([SAMPLE]));
  const csv = toCSV([trial()]);
  assert.match(csv, /"generation_waiting_minutes"/);
  assert.match(csv, /"saved_minutes"/);
  assert.match(csv, /"tool_cost_usd"/);
  assert.match(csv, /"31","14","pass","0.8"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('After the Demo CSV quotes multiline values and neutralizes user-authored formulas', () => {
  const csv = toCSV([trial({task: '=HYPERLINK("bad")', notes: '  @SUM(1,2)\n"quoted"', baseline: 20})]);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"'@SUM\(1,2\)\n""quoted"""/);
  assert.match(csv, /"31","-11","pass"/); // Numeric negatives remain numbers.
  for (const prefix of ['+', '-', '@', '=', '\t=', '\r=']) assert.ok(toCSV([trial({task: `${prefix}formula`})]).includes(`"'${prefix.trimStart()}formula"`));
});

test('After the Demo keeps the synthetic example separate and immutable', () => {
  assert.ok(Object.isFrozen(SAMPLE));
  assert.throws(() => { SAMPLE.cost = 20; });
  assert.equal(summarize([SAMPLE]).saved, 14);
  assert.equal(summarize([]).count, 0);
  assert.equal(toJSON([]).includes('synthetic-example'), false);
});

test('After the Demo uses external modules, semantic controls and no external requests', async () => {
  const dir = new URL('../dist/after-the-demo/', import.meta.url);
  const [html, app, css] = await Promise.all(['index.html', 'app.mjs', 'styles.css'].map(file => readFile(new URL(file, dir), 'utf8')));
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<script type="module" src="\.\/app.mjs"><\/script>/);
  assert.doesNotMatch(html, /\son\w+=/i);
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(/);
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(css, /@import|https?:\/\//);
  assert.match(html, /https:\/\/lab\.animeshj9\.com\//);
  assert.match(html, /<dialog id="confirm-dialog"/);
  assert.match(html, /role="status" aria-live="polite"/);
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(html.includes(`id="${match[1]}"`), `Missing DOM binding ${match[1]}`);
  for (const match of html.matchAll(/<label for="([^"]+)"/g)) assert.ok(html.includes(`id="${match[1]}"`), `Missing input ${match[1]}`);
});
