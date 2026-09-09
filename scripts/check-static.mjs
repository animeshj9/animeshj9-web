import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(path,item.name)) : [join(path,item.name)]); }
for (const file of walk(dist)) {
  if (/\.(?:mjs|js)$/.test(file)) execFileSync(process.execPath, ['--check', file]);
  if (!file.endsWith('.html')) continue;
  const html = readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${file}`);
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:https?:|mailto:|data:)/.test(ref)) continue;
    const path = ref.startsWith('/') ? resolve(dist, '.' + ref.split('#')[0]) : resolve(dirname(file),ref.split('#')[0]);
    assert.ok(existsSync(path), `Missing local asset ${ref} in ${file}`);
  }
}
const ui = readFileSync(join(dist,'feedproof/index.html'),'utf8');
const app = readFileSync(join(dist,'feedproof/app.mjs'),'utf8');
for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ui.includes(`id="${id}"`), `Missing UI element ${id}`);
console.log('Static checks passed: local links/assets, unique IDs, DOM bindings and JavaScript syntax.');
