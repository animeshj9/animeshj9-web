import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
test('Pages package preserves public routes and browser policies while excluding private products',()=>{
  execFileSync(process.execPath,['scripts/build-pages.mjs'],{cwd:root});
  const path=p=>resolve(root,'_site',p);
  for(const name of ['index.html','404.html','.nojekyll','footpath-optional/index.html','feedproof/index.html','galli-club/index.html','long-arc/index.html'])assert.ok(existsSync(path(name)),name);
  for(const name of ['products','docs','tests','.github','_headers'])assert.ok(!existsSync(path(name)),name);
  const map=readFileSync(path('footpath-optional/index.html'),'utf8');
  assert.match(map,/http-equiv="Content-Security-Policy"/);
  assert.match(map,/https:\/\/tile.openstreetmap.org/);
  assert.match(map,/name="referrer" content="strict-origin-when-cross-origin"/);
  assert.ok(map.indexOf('Content-Security-Policy')<map.indexOf('<script'));
  assert.doesNotMatch(map,/frame-ancestors/);
  assert.match(readFileSync(path('feedproof/index.html'),'utf8'),/connect-src 'none'/);
});
