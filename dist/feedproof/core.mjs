export const RULESET = '2026-09-09';
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCTS = 10000;
export const SPEC = 'https://support.google.com/merchants/answer/7052112?hl=en';
const REQUIRED = ['id', 'title', 'description', 'link', 'image_link', 'availability', 'price'];
const KNOWN_HEADERS = new Set([...REQUIRED, 'gtin', 'brand', 'mpn', 'condition', 'sale_price', 'availability_date', 'identifier_exists']);
const ENUMS = { availability: ['in_stock', 'out_of_stock', 'preorder', 'backorder'], condition: ['new', 'refurbished', 'used'] };
const currencyCodes = new Set(('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG').split(' '));

export function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/^g:/, '').replace(/\s+/g, '_');
}

// RFC-4180 style state machine. Never silently repairs malformed quoting or ragged rows.
export function parseFeed(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Choose or paste a feed with a header and at least one product.');
  if (new TextEncoder().encode(input).length > MAX_BYTES) throw new Error('This beta accepts files up to 5 MB. Export a smaller feed.');
  if (/[\u0000\ufffd]/u.test(input)) throw new Error('This file is not valid UTF-8 text. Export it as UTF-8 CSV or TSV.');
  const text = input.replace(/^\uFEFF/, '');
  if (/^\s*[<{]/.test(text)) throw new Error('XML and JSON are not supported yet. Export a Google-format CSV or TSV.');
  let quoted = false, comma = 0, tab = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
    if (!quoted) { if (c === ',') comma++; if (c === '\t') tab++; if (c === '\r' || c === '\n') break; }
  }
  const delimiter = tab > comma ? '\t' : ',';
  const records = []; let cells = [], cell = '', state = 'start';
  function pushCell() { cells.push(cell); cell = ''; state = 'start'; }
  function pushRow() {
    pushCell();
    if (!cells.some(v => v.trim())) throw new Error(`Blank record ${records.length + 1}. Remove empty rows before checking so record numbers stay accurate.`);
    records.push(cells);
    cells = [];
    if (records.length > MAX_PRODUCTS + 1) throw new Error('This beta checks up to 10,000 products. Split your feed and try again.');
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === 'quoted') {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else state = 'closed'; }
      else cell += c;
    } else if (c === delimiter) pushCell();
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (state === 'closed') throw new Error('Unexpected text after a closing quote. Check your CSV export.');
    else if (c === '"') { if (state !== 'start') throw new Error('A quote appears inside an unquoted field. Export properly quoted CSV.'); state = 'quoted'; }
    else { cell += c; state = 'plain'; }
    if (cells.length > 200) throw new Error('Too many columns. This beta supports up to 200 columns.');
  }
  if (state === 'quoted') throw new Error('An opening quote is missing its closing quote. Check your CSV export.');
  if (cell || cells.length || state === 'closed') pushRow();
  if (records.length < 2) throw new Error('The feed needs a header row and at least one product.');
  const originalHeaders = records.shift();
  if (originalHeaders.length > 200) throw new Error('Too many columns. This beta supports up to 200 columns.');
  const headers = originalHeaders.map(normalizeHeader);
  if (headers.some(h => !h)) throw new Error('A column has no name. Name every column and try again.');
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate column names were found (ignoring case and spaces). Give each column a unique name.');
  for (const [index, row] of records.entries()) if (row.length !== headers.length) throw new Error(`Record ${index + 2} has ${row.length} columns; expected ${headers.length}. Check its delimiters and quoting.`);
  return { headers, originalHeaders, rows: records, delimiter };
}

export function validGTIN(value) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false;
  let total = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) total += Number(value[i]) * weight;
  return (10 - total % 10) % 10 === Number(value.at(-1));
}

function price(value) {
  const match = /^(\d+(?:\.\d{1,2})?) ([A-Z]{3})$/.exec(value);
  if (!match || !currencyCodes.has(match[2])) return null;
  const [whole, fraction = ''] = match[1].split('.');
  return { cents: BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')), currency: match[2] };
}

function urlValid(value) {
  if (/\s/.test(value)) return false;
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) && Boolean(u.hostname) && !u.username && !u.password; } catch { return false; }
}

export function analyzeFeed(feed) {
  const { headers, rows, originalHeaders } = feed;
  const issues = [], fixes = [], seen = new Map();
  const missing = REQUIRED.filter(field => !headers.includes(field));
  const add = (row, field, code, message, action, severity = 'error', value = '') => {
    const cells = row >= 2 ? rows[row - 2] : [];
    issues.push({ row, field, code, message, action, severity, value, id: cells[headers.indexOf('id')] || '', title: cells[headers.indexOf('title')] || '', source: SPEC });
  };
  missing.forEach(field => add(1, field, 'missing_column', `Missing ${field} column`, `Add a ${field} column with a value for each product.`));
  originalHeaders.forEach((value, column) => { if (KNOWN_HEADERS.has(headers[column]) && value !== headers[column]) fixes.push({ row: 1, column, field: headers[column], before: value, after: headers[column] }); });
  rows.forEach((cells, index) => {
    const row = index + 2;
    const get = field => cells[headers.indexOf(field)] || '';
    const fixed = {};
    for (const [field, allowed] of Object.entries(ENUMS)) {
      const value = get(field), normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
      if (value && allowed.includes(normalized) && value !== normalized) {
        fixes.push({ row, column: headers.indexOf(field), field, before: value, after: normalized }); fixed[field] = normalized;
      }
    }
    for (const field of ['price', 'sale_price']) {
      const value = get(field), normalized = value.trim().replace(/\s+([a-zA-Z]{3})$/, (_, currency) => ' ' + currency.toUpperCase());
      if (value !== normalized && price(normalized)) { fixes.push({ row, column: headers.indexOf(field), field, before: value, after: normalized }); fixed[field] = normalized; }
    }
    for (const field of REQUIRED) if (headers.includes(field) && !get(field).trim()) add(row, field, 'missing_value', `Missing ${field}`, `Supply the product’s actual ${field}; don’t infer it from other products.`);
    for (const [field, max] of [['id', 50], ['title', 150], ['description', 5000]]) if ([...get(field)].length > max) add(row, field, 'too_long', `${field} exceeds ${max} characters`, `Shorten ${field} to ${max} characters or fewer.`, 'error', get(field));
    const id = get('id');
    if (id.trim()) {
      const key = id.trim().toLowerCase();
      if (seen.has(key)) add(row, 'id', 'duplicate_id', `ID collides with record ${seen.get(key)}`, 'Assign a unique, stable ID to each product/variant; IDs should not differ only by case.', 'error', id);
      else seen.set(key, row);
      if (id !== id.trim()) add(row, 'id', 'id_whitespace', 'ID has leading or trailing whitespace', 'Review the source ID before changing it; changing IDs can affect product history.', 'warning', id);
    }
    for (const field of ['link', 'image_link']) if (get(field).trim() && !urlValid(get(field))) add(row, field, 'invalid_url', `Invalid ${field} URL`, 'Supply an absolute http:// or https:// URL with no whitespace or embedded credentials.', 'error', get(field));
    for (const [field, allowed] of Object.entries(ENUMS)) if (get(field).trim() && !allowed.includes(get(field))) add(row, field, 'invalid_enum', `Unrecognized ${field}`, fixed[field] ? `Formatting fix available: ${fixed[field]}.` : `Use one of: ${allowed.join(', ')}.`, 'error', get(field));
    for (const field of ['price', 'sale_price']) if (get(field).trim() && !price(get(field))) add(row, field, 'invalid_price', `Invalid ${field} format`, fixed[field] ? `Formatting fix available: ${fixed[field]}.` : 'Use a non-negative amount, decimal point, and ISO currency: 29.95 USD. Currency support and special pricing rules need manual review.', 'error', get(field));
    const regular = price(get('price')), sale = price(get('sale_price'));
    if (regular?.cents === 0n) add(row, 'price', 'zero_price', 'Zero price needs an eligibility check', 'Confirm this product qualifies for Google’s special zero-price rules; most products need a positive price.', 'warning', get('price'));
    if (regular && sale && (regular.currency !== sale.currency || sale.cents >= regular.cents)) add(row, 'sale_price', 'sale_price_conflict', 'Sale price conflicts with regular price', 'Use the same currency and a sale price lower than the regular price.', 'error', get('sale_price'));
    if (get('gtin').trim() && !validGTIN(get('gtin'))) add(row, 'gtin', 'invalid_gtin', 'GTIN length or checksum is invalid', 'Check the manufacturer’s barcode. Preserve leading zeros; never generate a replacement identifier.', 'error', get('gtin'));
    const identifier = get('identifier_exists').trim().toLowerCase();
    if (identifier && !['yes', 'no', 'true', 'false'].includes(identifier)) add(row, 'identifier_exists', 'invalid_identifier_flag', 'Unrecognized identifier_exists value', 'Use yes/true or no/false based on whether the product actually has identifiers.', 'error', get('identifier_exists'));
    if (['no', 'false'].includes(identifier) && (get('gtin').trim() || get('mpn').trim())) add(row, 'identifier_exists', 'identifier_conflict', 'Identifier flag conflicts with supplied identifiers', 'Verify the source facts. Don’t set identifier_exists to no simply to bypass missing identifiers.', 'warning', get('identifier_exists'));
    else if (!['no', 'false'].includes(identifier) && !get('gtin').trim()) add(row, 'gtin', 'identifier_review', 'Product identifiers need a check', 'If assigned, supply the manufacturer’s GTIN. For products without a GTIN, check brand/MPN requirements; don’t invent identifiers.', 'warning');
    if (['preorder', 'backorder'].includes(fixed.availability || get('availability')) && !get('availability_date').trim()) add(row, 'availability_date', 'missing_availability_date', 'Availability date is missing', 'Supply the confirmed availability date and timezone for preorder/backorder products.', 'error');
    else if (get('availability_date').trim()) add(row, 'availability_date', 'availability_date_review', 'Confirm availability date and timezone', 'Date formatting, actual stock date, and landing-page consistency require a manual check in this beta.', 'warning', get('availability_date'));
  });
  issues.sort((a,b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || a.row - b.row);
  return { feed, issues, fixes, products: rows.length, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length, ruleset: RULESET };
}

export function applyFixes(result) {
  const rows = [result.feed.originalHeaders.slice(), ...result.feed.rows.map(row => row.slice())];
  for (const fix of result.fixes) rows[fix.row - 1][fix.column] = fix.after;
  return rows;
}

export function toDelimited(rows, delimiter = ',', spreadsheetSafe = false) {
  return rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (spreadsheetSafe && /^[\s]*[=+@\-]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(delimiter)).join('\r\n') + '\r\n';
}

export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export function issueCSV(result) {
  return toDelimited([['severity','record','product_id','title','field','code','value','issue','next_action'], ...result.issues.map(i => [i.severity,i.row,i.id,i.title,i.field,i.code,i.value,i.message,i.action])], ',', true);
}

export function reportHTML(result, name, timestamp = new Date().toISOString()) {
  const esc = escapeHTML;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>FeedProof report — ${esc(name)}</title><style>body{font:16px/1.6 Arial,sans-serif;max-width:1000px;margin:40px auto;padding:20px;color:#15202e}h1{color:#143de5}article{border-top:1px solid #ccc;padding:14px 0;break-inside:avoid}p{overflow-wrap:anywhere}small{color:#526172}@media print{body{margin:0}}</style><h1>FeedProof / Preflight report</h1><p>${esc(name)} · ${esc(timestamp)} · Rule set ${RULESET}</p><p><strong>${result.products} products · ${result.errors} errors · ${result.warnings} review items · ${result.fixes.length} available formatting fixes</strong></p><p>Independent local checks, not a Google approval or policy audit. No URLs were fetched. Missing findings do not establish feed eligibility. Record numbers include the header as record 1.</p>${result.issues.length ? result.issues.map(i => `<article><strong>${esc(i.severity.toUpperCase())} · Record ${i.row} · ${esc(i.field)}</strong><h2>${esc(i.message)}</h2><p>Product: ${esc(i.id || '(missing ID)')} — ${esc(i.title)}</p><p>Value: ${esc(i.value || '(empty)')}</p><p>Next action: ${esc(i.action)}</p><small>Rule: ${esc(i.code)}</small></article>`).join('') : '<p>No issues found by the implemented checks. Complete country/category and Merchant Center checks before submitting.</p>'}<p>Reference: <a href="${SPEC}">Google product data specification</a>. Built by Animesh Jain / FeedProof.</p></html>`;
}
