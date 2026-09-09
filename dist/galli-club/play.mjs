export const AGES = new Set(['little', 'big']);
export const MOODS = new Set(['quiet', 'wiggles']);
export function safeName(input) {
  return [...String(input ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, '').trim()].slice(0,30).join('') || 'Captain';
}
export function options(input = {}) { return { name:safeName(input.name), age:AGES.has(input.age)?input.age:'little', mood:MOODS.has(input.mood)?input.mood:'quiet' }; }
export function personalize(text,name) { return String(text).replaceAll('{name}',()=>safeName(name)); }
export function validAdventure(data) {
  return Boolean(data && typeof data.title === 'string' && typeof data.minutes?.little === 'string' && typeof data.minutes?.big === 'string' && Array.isArray(data.steps) && data.steps.length === 5 && data.steps.every(s=>s && typeof s==='object') && new Set(data.steps.map(s=>s.id)).size === 5 && data.steps.every(s => ['id','label','title','read','hinglish','do','little','big','quiet','wiggles','parent'].every(k=>typeof s[k]==='string'&&s[k].length>0)));
}
export function stepView(data,index,input) {
  if (!validAdventure(data)) throw new Error('The adventure file is incomplete. Please try loading again.');
  if (!Number.isInteger(index) || index < 0 || index >= data.steps.length) throw new Error('That adventure step does not exist.');
  const config=options(input), step=data.steps[index];
  return { ...step, read:personalize(step.read,config.name), hinglish:personalize(step.hinglish,config.name), ageTip:step[config.age], moodTip:step[config.mood], index, total:data.steps.length, last:index===data.steps.length-1 };
}
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function keepsakeHTML(input) {
  const name=escapeHTML(safeName(input));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${name}'s Galli Club keepsake</title><style>@page{size:A4;margin:20mm}body{font:18px/1.6 Georgia,serif;color:#202555;max-width:700px;padding:35px;margin:auto}main{border:3px solid #303dc9;padding:40px;text-align:center}h1{font-size:42px;line-height:1.2}h2{font-size:30px;overflow-wrap:anywhere}p{overflow-wrap:anywhere}.space{height:250px;border:1px dashed #aaa;margin-top:25px}small{font:13px Arial,sans-serif}</style></head><body><main><p>GALLI CLUB / A LITTLE HYDERABAD ADVENTURE</p><h1>Official friend<br>of Piku the pigeon</h1><h2>${name}</h2><p>We counted four, borrowed a colour,<br>and made a city of our own.</p><div class="space"><p>Draw your favourite part here.</p></div><p>Something I want to remember: __________________</p><small>A keepsake, not a test. A little adventure counts.</small></main><p><small>Print this page using your browser's Print command. This file stays on your device. Galli Club / animeshj9.com/galli-club/</small></p></body></html>`;
}
