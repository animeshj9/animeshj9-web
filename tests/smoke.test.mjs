import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
assert.equal((js.match(/id: '[^']+',/g) || []).length, 5, 'Expected five useful seed theses');

console.log('Smoke tests passed: lab routing, local assets, accessibility hooks, persistence, export, responsive CSS, and seed data.');
