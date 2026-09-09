import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, analyzeFeed, validGTIN, applyFixes, toDelimited, issueCSV, reportHTML, MAX_BYTES, MAX_PRODUCTS } from '../dist/feedproof/core.mjs';
import { SAMPLE } from '../dist/feedproof/sample.mjs';
const headers = ['id','title','description','link','image_link','availability','price','gtin','identifier_exists'];
const good = ['SKU-1','A mug','A ceramic mug','https://example.com/mug','https://example.com/mug.jpg','in_stock','29.95 USD','4006381333931','yes'];
const feed = (overrides = {}, extra = {}) => {
  const keys = [...headers,...Object.keys(extra)];
  return toDelimited([keys,[...headers.map((key,index) => overrides[key] ?? good[index]),...Object.values(extra)]]);
};
const analyze = (overrides, extra) => analyzeFeed(parseFeed(feed(overrides, extra)));
test('valid standard product has no findings', () => { const r=analyze(); assert.equal(r.products,1); assert.deepEqual(r.issues,[]); });
test('UTF-8 BOM, CRLF, quoted comma, double quote and multiline text roundtrip', () => {
  const text = 'A, "special"\r\nceramic mug'; const parsed = parseFeed('\uFEFF'+feed({description:text})); assert.equal(parsed.rows[0][2],text);
  assert.deepEqual(parseFeed(toDelimited([parsed.originalHeaders,...parsed.rows],'\t')).rows,parsed.rows);
});
test('tabs inside quoted headers do not force TSV detection', () => { const p=parseFeed('"a\tb",c\n1,2'); assert.equal(p.delimiter,','); });
test('last record does not need a newline', () => assert.equal(parseFeed(feed().trimEnd()).rows.length,1));
test('CSV trailing empty field is preserved', () => assert.equal(parseFeed('a,b\n1,').rows[0][1],''));
for (const [name,input,pattern] of [
  ['empty','',/header/], ['header only','id,title',/at least one/], ['unterminated','id,title\n1,"oops',/closing quote/],
  ['quote in plain value','id,title\n1,hel"lo',/unquoted/],['trailing quote text','id,title\n1,"hello"oops',/closing quote/],
  ['ragged','id,title\n1,hello,extra',/Record 2/], ['duplicate column','id,ID\n1,2',/Duplicate column/],
  ['empty column',',title\n1,x',/no name/], ['invalid unicode','id,title\n1,\ufffd',/UTF-8/],
  ['XML','<rss></rss>',/XML/],['blank record','id,title\n\n1,a',/Blank record 2/]
]) test(`rejects ${name}`,()=>assert.throws(()=>parseFeed(input),pattern));
test('enforces byte limit',()=>assert.throws(()=>parseFeed('x'.repeat(MAX_BYTES+1)),/5 MB/));
test('enforces product limit',()=>assert.throws(()=>parseFeed('id\n'+Array(MAX_PRODUCTS+1).fill('1').join('\n')),/10,000/));
test('enforces column limit',()=>assert.throws(()=>parseFeed(Array.from({length:201},(_,i)=>'c'+i).join(',')+'\n'+Array(201).fill('a').join(',')),/columns/));
test('missing column is a single whole-feed error',()=>{ const r=analyzeFeed(parseFeed('id,title\n1,Product\n2,Other')); assert.equal(r.errors,5); assert.ok(r.issues.filter(i=>i.code==='missing_column').every(i=>i.row===1)); });
test('blank required value is an error',()=>assert.ok(analyze({title:' '}).issues.some(i=>i.code==='missing_value'&&i.field==='title')));
test('duplicate IDs are case-insensitive and refer to first occurrence',()=>{const r=analyzeFeed(parseFeed(toDelimited([headers,good,['sku-1',...good.slice(1)]]))); assert.ok(r.issues.some(i=>i.code==='duplicate_id'&&i.row===3&&i.message.includes('2')));});
test('character limits count Unicode code points',()=>{assert.equal(analyze({title:'😀'.repeat(150)}).errors,0); assert.ok(analyze({title:'😀'.repeat(151)}).issues.some(i=>i.code==='too_long'));});
for(const value of ['javascript:alert(1)','example.com','https://example.com/a b','https://user:pass@example.com']) test(`rejects unsafe/malformed URL ${value}`,()=>assert.ok(analyze({link:value}).issues.some(i=>i.code==='invalid_url')));
test('sale price uses exact cents and matching currency',()=>{
  assert.ok(analyze({}, {sale_price:'29.95 USD'}).issues.some(i=>i.code==='sale_price_conflict'));
  assert.ok(analyze({}, {sale_price:'10.00 INR'}).issues.some(i=>i.code==='sale_price_conflict'));
  assert.ok(!analyze({}, {sale_price:'29.94 USD'}).issues.some(i=>i.code==='sale_price_conflict'));
});
test('invalid prices are not guessed',()=>{for(const value of ['-1.00 USD','1,299.00 USD','29.999 USD','10 ZZZ','$29.95','10e2 USD']) assert.ok(analyze({price:value}).issues.some(i=>i.code==='invalid_price'),value);});
test('zero price requires context, not an unconditional disapproval',()=>assert.ok(analyze({price:'0 USD'}).issues.some(i=>i.code==='zero_price'&&i.severity==='warning')));
test('GTIN checksum, leading zeros, lengths and all-zero code',()=>{assert.equal(validGTIN('4006381333931'),true);assert.equal(validGTIN('036000291452'),true);assert.equal(validGTIN('96385074'),true);for(const value of ['4006381333932','123','00000000','03600029145x'])assert.equal(validGTIN(value),false);});
test('missing GTIN is contextual, not fabricated',()=>{const r=analyze({gtin:''});assert.equal(r.errors,0);assert.ok(r.issues.some(i=>i.code==='identifier_review'));assert.equal(r.fixes.length,0);});
test('custom product with no assigned identifiers is allowed',()=>assert.deepEqual(analyze({gtin:'',identifier_exists:'no'}).issues,[]));
test('identifier contradiction is flagged',()=>assert.ok(analyze({identifier_exists:'no'}).issues.some(i=>i.code==='identifier_conflict')));
test('preorders need a date',()=>assert.ok(analyze({availability:'preorder'}).issues.some(i=>i.code==='missing_availability_date')));
test('formatting fixes recheck cleanly and never mutate input',()=>{
  const r=analyze({availability:' In Stock ',price:'29.95 usd'}), original=JSON.stringify(r.feed);
  assert.equal(r.fixes.length,2);
  const fixed=applyFixes(r);assert.equal(JSON.stringify(r.feed),original);
  const rechecked=analyzeFeed(parseFeed(toDelimited(fixed,'\t')));assert.equal(rechecked.errors,0);assert.equal(rechecked.fixes.length,0);
  assert.equal(fixed[1][7],'4006381333931');assert.equal(fixed.length,2);
});
test('header normalization is proposed explicitly',()=>{const r=analyzeFeed(parseFeed(feed().replace('"id"','" ID "')));assert.ok(r.fixes.some(f=>f.row===1&&f.after==='id'));});
test('unknown custom column names are preserved in the export',()=>{const r=analyze({}, {'Custom Field':'raw value'});const fixed=applyFixes(r);assert.equal(fixed[0].at(-1),'Custom Field');assert.equal(fixed[1].at(-1),'raw value');});
test('unsafe ID changes are never automatic',()=>{const r=analyze({id:' SKU-1 '});assert.ok(r.issues.some(i=>i.code==='id_whitespace'));assert.ok(!r.fixes.some(f=>f.field==='id'));});
test('sample catches real errors; fix pass retains unresolved facts',()=>{const r=analyzeFeed(parseFeed(SAMPLE));assert.equal(r.products,5);assert.equal(r.fixes.length,2);assert.ok(r.errors>=7);const fixed=analyzeFeed(parseFeed(toDelimited(applyFixes(r),'\t')));assert.ok(fixed.errors>0);assert.equal(fixed.errors,r.errors-2);});
test('HTML report escapes malicious catalogue fields and filenames',()=>{const r=analyze({id:'<script>alert(1)</script>',title:'<img src=x onerror=alert(1)>',gtin:'bad'});const html=reportHTML(r,'<script>evil</script>','fixed');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes("default-src 'none'"));});
test('issue CSV neutralizes spreadsheet formulas without changing feed values',()=>{const r=analyze({id:'=HYPERLINK("https://evil.example")',gtin:'bad'});const csv=issueCSV(r);assert.ok(csv.includes("'=HYPERLINK"));assert.equal(applyFixes(r)[1][0],r.feed.rows[0][0]);});
test('healthy report explicitly avoids guaranteeing approval',()=>assert.match(reportHTML(analyze(),'good.csv','fixed'),/not a Google approval/));
