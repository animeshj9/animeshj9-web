import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const css = readFileSync(resolve(root, 'dist/lab.css'), 'utf8');
const experimentHtml = readFileSync(resolve(root, 'dist/long-arc/index.html'), 'utf8');
const experimentCss = readFileSync(resolve(root, 'dist/long-arc/styles.css'), 'utf8');
const js = readFileSync(resolve(root, 'dist/long-arc/app.js'), 'utf8');

assert.match(html, /<html lang="en">/);
assert.match(html, /<meta\s+name="description"/);
assert.match(html, /ANIMESH \/ LAB/);
assert.match(html, /href="\.\/long-arc\/"/);
assert.match(experimentHtml, /<main class="workspace" id="workspace"/);
assert.match(experimentHtml, /<dialog[^>]+id="newThesisDialog"/);
assert.match(experimentHtml, /aria-label="Thesis library"/);

for (const ref of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
  assert.ok(existsSync(resolve(root, 'dist', ref[1])), `Missing local asset: ${ref[1]}`);
}

for (const ref of experimentHtml.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
  assert.ok(existsSync(resolve(root, 'dist/long-arc', ref[1])), `Missing Long Arc asset: ${ref[1]}`);
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(experimentCss, /@media \(max-width: 720px\)/);
assert.match(js, /localStorage\.setItem\(STORAGE_KEY/);
assert.match(js, /function escapeHtml/);
assert.match(js, /function exportMarkdown/);
const seedSource = js.match(/const seedData = (\[[\s\S]*?\n  \]);/);
assert.ok(seedSource, 'Expected an inspectable seed thesis array');
const seeds = JSON.parse(JSON.stringify(runInNewContext(seedSource[1])));
assert.deepEqual(seeds.map(({ id, horizon, confidence }) => ({ id, horizon, confidence })), [
  { id: 'agent-orchestration', horizon: 2029, confidence: 78 },
  { id: 'hyderabad-core', horizon: 2032, confidence: 59 }
], 'Keep the two measurable seed theses and preserve their original identity and conviction');
for (const thesis of seeds) {
  assert.match(thesis.title, new RegExp(`By ${thesis.horizon}`));
  assert.match(thesis.why, /Proposed resolution test:/);
  assert.ok(thesis.why.includes(`${thesis.horizon}-12-31`), 'Each test needs an exact resolution deadline');
  assert.ok(thesis.evidence.length && thesis.counters.length && thesis.signals.length);
  assert.ok(thesis.signals.every(({ state }) => state === 'unseen'), 'Do not seed unverified outcomes as observed');
}
assert.match(seeds[0].why, /all attempted runs/);
assert.match(seeds[0].why, /unsuccessful runs/);
assert.match(seeds[0].why, /100 consecutive eligible attempts/);
assert.match(seeds[0].why, /model to choose a subsequent tool action from intermediate results/);
assert.match(seeds[1].why, /public, dated on-foot audit/);
assert.match(seeds[1].why, /traffic lane/);

console.log('Smoke tests passed: lab routing, local assets, accessibility hooks, persistence, export, responsive CSS, and seed data.');
