import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {options,safeName,personalize,validAdventure,stepView,keepsakeHTML} from '../dist/galli-club/play.mjs';
const root=resolve(import.meta.dirname,'..');
const data=JSON.parse(readFileSync(resolve(root,'dist/galli-club/adventure.json'),'utf8'));
test('five complete playable steps with distinct stable IDs',()=>assert.equal(validAdventure(data),true));
test('partial or duplicate-ID adventure cannot start',()=>{assert.equal(validAdventure({}),false);const broken=structuredClone(data);delete broken.steps[2].quiet;assert.equal(validAdventure(broken),false);const duplicate=structuredClone(data);duplicate.steps[1].id=duplicate.steps[0].id;assert.equal(validAdventure(duplicate),false);});
test('defaults are quiet play and the younger age range',()=>assert.deepEqual(options({age:'bad',mood:'bad'}),{name:'Captain',age:'little',mood:'quiet'}));
for(const age of ['little','big'])for(const mood of ['quiet','wiggles'])test(`all steps work for ${age}/${mood}`,()=>{
  for(let i=0;i<5;i++){const view=stepView(data,i,{age,mood,name:'Mango'});assert.equal(view.ageTip,data.steps[i][age]);assert.equal(view.moodTip,data.steps[i][mood]);assert.equal(view.last,i===4);assert.ok(!view.read.includes('{name}'));assert.ok(!view.hinglish.includes('{name}'));}
});
test('step bounds are strict',()=>{for(const i of [-1,5,1.5,NaN])assert.throws(()=>stepView(data,i,{}),/does not exist/);});
test('nickname fallback, length limit and control removal',()=>{assert.equal(safeName('   '),'Captain');assert.equal(safeName('A'.repeat(100)).length,30);assert.equal(safeName('\u202ePiku\n'),'Piku');});
test('replacement tokens in a nickname remain literal',()=>assert.equal(personalize('Hello {name}!','$&'), 'Hello $&!'));
test('keepsake escapes HTML and prevents active content',()=>{const html=keepsakeHTML('<img src=x onerror=alert(1)>');assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes("default-src 'none'"));assert.ok(!html.includes('<script'));});
test('keepsake never contains unresolved template tokens',()=>assert.ok(!keepsakeHTML('Captain').includes('{name}')));
test('paid pack has three complete adventures and no public full-product link',()=>{
  const pack=JSON.parse(readFileSync(resolve(root,'products/galli-club/pack.json'),'utf8'));assert.equal(pack.missions.length,3);assert.equal(pack.price,299);
  for(const m of pack.missions){assert.equal(m.steps.length,5);for(const k of ['opening','middle','twist','ending','little','big','quiet','replay','fact','source'])assert.ok(m[k]?.length>10,`${m.id}/${k}`);}
  assert.ok(!existsSync(resolve(root,'dist/galli-club/downloads/hyderabad-at-home.pdf')));
});
test('free kit, preview and private full pack are genuine PDF files',()=>{
  for(const path of ['dist/galli-club/downloads/pikus-postcard.pdf','dist/galli-club/downloads/pack-preview.pdf','products/galli-club/hyderabad-at-home.pdf']){const bytes=readFileSync(resolve(root,path));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>10000);assert.ok(bytes.length<1500000);}
});
test('no analytics, browser storage, external scripts or child-name upload in sample',()=>{
  const js=readFileSync(resolve(root,'dist/galli-club/app.mjs'),'utf8');const html=readFileSync(resolve(root,'dist/galli-club/index.html'),'utf8');
  assert.ok(!/localStorage|sessionStorage|sendBeacon|XMLHttpRequest|document\.cookie/.test(js));assert.equal((js.match(/fetch\(/g)||[]).length,1);assert.ok(js.includes("fetch('./adventure.json'"));assert.ok(!/<script[^>]+src="https?:/.test(html));
});
