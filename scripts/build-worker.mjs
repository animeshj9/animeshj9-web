import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sites } from '../worker/sites.mjs';
const root = resolve(import.meta.dirname, '..');
const output = join(root, '_worker-assets');
rmSync(output, { recursive: true, force: true });
cpSync(join(root, 'dist'), output, { recursive: true });
// Only deployment output changes. Existing Pages assets stay intact.
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
for (const folder of Object.values(sites)) {
  cpSync(join(root, 'dist/lab-favicon.svg'), join(output, folder, 'lab-favicon.svg'));
  for (const path of walk(join(output, folder)).filter(p => p.endsWith('.html'))) {
    const html = readFileSync(path, 'utf8').replaceAll('href="../lab-favicon.svg"', 'href="/lab-favicon.svg"').replaceAll('href="../"', 'href="https://lab.animeshj9.com/"');
    writeFileSync(path, html);
  }
}
let dashboard = readFileSync(join(output, 'index.html'), 'utf8');
for (const [host, folder] of Object.entries(sites)) dashboard = dashboard.replaceAll(`href="./${folder}/"`, `href="https://${host}/"`);
writeFileSync(join(output, 'index.html'), dashboard);
rmSync(join(output, '_headers'));
console.log('Built host-routed assets; names and content preserved.');
