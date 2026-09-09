export const BOUNDS = { south:17.385, west:78.32, north:17.445, east:78.38 };
export const VIEWS = {
  all:{label:'All three areas',center:[17.416,78.350],zoom:14},
  financial:{label:'Financial District',center:[17.420,78.346],zoom:16},
  nanakramguda:{label:'Nanakramguda',center:[17.413,78.352],zoom:16},
  kokapet:{label:'Kokapet',center:[17.397,78.335],zoom:16}
};
export const KINDS = {
  sidewalk:{label:'Sidewalk mapped',joke:'A footpath enters the chat.',colour:'#087d88',description:'OSM records a sidewalk on at least one side. Its current condition, usable width and continuity are not established.'},
  separate:{label:'Sidewalk mapped separately',joke:'The footpath has its own address.',colour:'#087d88',description:'The road tag says the sidewalk is mapped separately. Inspect the nearby path lines; this is not a continuity guarantee.'},
  footway:{label:'Walking link mapped',joke:'A line for feet. Promising.',colour:'#386bca',description:'A walking path is mapped. It may be inside a campus or park; missing access tags are not proof of public access or accessibility.'},
  crossing:{label:'Crossing mapped',joke:'A crossing, on paper at least.',colour:'#8d45b8',description:'A crossing is mapped. Signals, curb ramps, waiting times and present usability have not been surveyed.'},
  absent:{label:'No sidewalk tagged',joke:'The pavement has left the chat.',colour:'#c44721',description:'OSM explicitly tags no sidewalk here. This can be outdated or incomplete; verify the actual edge before treating it as a current observation.'},
  steps:{label:'Steps mapped',joke:'The route has added a staircase.',colour:'#b5750b',description:'OSM maps steps. An accessible alternative, handrail and current condition are unknown.'},
  restricted:{label:'Restricted / motor road',joke:'Feet are not on the guest list.',colour:'#64666a',description:'Access or road-class information makes this unsuitable to present as a public pedestrian route. Check the raw tags; no navigation is offered.'},
  construction:{label:'Construction mapped',joke:'The plot is still under construction.',colour:'#a76a1a',description:'A highway under construction is mapped. No conclusion about a passable pedestrian route follows.'},
  unknown:{label:'Sidewalk information unknown',joke:'Big road. Small amount of evidence.',colour:'#a9adb4',description:'Sidewalk information is missing, incomplete or conflicting. Unknown does not mean missing, blocked, walkable or safe.'}
};
export const REPORT_TYPES = {
  gap:{title:'The footpath has left the chat',plain:'Footpath ends / gap'},
  obstacle:{title:'Footpath, now with bonus obstacles',plain:'Blocked walking space'},
  step:{title:'Parkour was not in the walking plan',plain:'Step, broken kerb or level change'},
  traffic:{title:'Surprise. You are traffic now.',plain:'Pedestrians forced into carriageway'},
  detour:{title:'Cross. Cross back. Character development.',plain:'Unnecessary crossing / discontinuity'},
  crossing:{title:'Crossing the road: the full side quest',plain:'Difficult or missing crossing'},
  good:{title:'An actual continuous footpath. Lovely.',plain:'Working pedestrian connection'}
};
export function classify(tags={}) {
  const pedestrian=tags.foot;
  if (['no','private'].includes(pedestrian) || (!['yes','designated','permissive'].includes(pedestrian) && ['no','private'].includes(tags.access)) || ['motorway','motorway_link'].includes(tags.highway)) return 'restricted';
  if(tags.highway==='construction')return 'construction';
  if(tags.highway==='steps')return 'steps';
  if(tags.footway==='crossing' || tags.highway==='crossing')return 'crossing';
  if(['footway','pedestrian'].includes(tags.highway) || (tags.highway==='path' && ['yes','designated'].includes(pedestrian)))return 'footway';
  const sides=[tags['sidewalk:both'],tags['sidewalk:left'],tags['sidewalk:right']].filter(Boolean);
  const positive=s=>['yes','both','left','right','separate'].includes(s);
  if ((tags.sidewalk==='no'&&sides.some(positive)) || (positive(tags.sidewalk)&&(tags['sidewalk:both']==='no'||(tags['sidewalk:left']==='no'&&tags['sidewalk:right']==='no'))) || (tags['sidewalk:both']==='no'&&[tags['sidewalk:left'],tags['sidewalk:right']].some(positive))) return 'unknown';
  if(sides.some(s=>['yes','both','left','right'].includes(s)) || ['yes','both','left','right'].includes(tags.sidewalk))return 'sidewalk';
  if(sides.includes('separate') || tags.sidewalk==='separate')return 'separate';
  if(tags['sidewalk:both']==='no' || (tags['sidewalk:left']==='no'&&tags['sidewalk:right']==='no') || (tags.sidewalk==='no'&&!sides.some(s=>s!=='no')))return 'absent';
  return 'unknown';
}
export function inBounds(lat,lng) { return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=BOUNDS.south&&lat<=BOUNDS.north&&lng>=BOUNDS.west&&lng<=BOUNDS.east; }
export function distance(a,b) {
  const rad=x=>x*Math.PI/180, lat=rad(b[1]-a[1]),lng=rad(b[0]-a[0]);
  const h=Math.sin(lat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(lng/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
export function lineLength(coords) { return coords.slice(1).reduce((n,p,i)=>n+distance(coords[i],p),0); }
export function escapeHTML(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function filterFeatures(features,{query='',kind='all'}={}) {
  const q=query.trim().toLowerCase();return features.filter(f=>(kind==='all'||f.properties.kind===kind)&&(q===''||`${f.properties.name} ${f.properties.osmId}`.toLowerCase().includes(q)));
}
export function validateReport(input,today=new Date().toISOString().slice(0,10)) {
  const errors=[];const lat=Number(input.lat),lng=Number(input.lng),date=String(input.date||'');
  if(!inBounds(lat,lng)||String(input.lat).trim()===''||String(input.lng).trim()==='')errors.push('Pick a point inside the study window.');
  if(!Object.hasOwn(REPORT_TYPES,input.type))errors.push('Choose what happened.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today)errors.push('Use the actual observation date, not a future date.');
  const note=String(input.note||'').trim();if(note.length<20||note.length>800)errors.push('Describe what you observed in 20–800 characters.');
  if(!['left','right','both','point','unknown'].includes(input.side))errors.push('Choose the side or point location.');
  const direction=String(input.direction||'').trim();if(['left','right'].includes(input.side)&&direction.length<3)errors.push('For left/right, say which direction you were facing.');
  const photo=String(input.photoURL||'').trim();if(photo){try{const u=new URL(photo);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{errors.push('Use a public HTTPS photo link, or leave it blank.');}}
  if(!input.consent)errors.push('Confirm the note contains no private identifying details.');
  return {errors,report:errors.length?null:{type:input.type,lat,lng,date,note,side:input.side,direction:direction.slice(0,120),photoURL:photo,road:String(input.road||'').slice(0,160),osmId:input.osmId?String(input.osmId):null,status:'unreviewed',source:'local-observation',schemaVersion:1}};
}
export function reportGeoJSON(reports) {
  return {type:'FeatureCollection',metadata:{purpose:'Unreviewed local field notes; not published observations or routing data.',schemaVersion:1},features:reports.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lng,r.lat]},properties:{...r,status:'unreviewed'}}))};
}
export function reportMarkdown(report) {
  const plain=s=>String(s??'').replace(/[\r\n]/g,' ').replace(/[<>]/g,'');
  return `Footpath Optional — unreviewed field note\n\nObservation: ${REPORT_TYPES[report.type].plain}\nLocation: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}\nRoad: ${plain(report.road)||'Unnamed / unknown'}\nObserved on: ${report.date}\nSide: ${report.side}; facing: ${plain(report.direction)||'not specified'}\n\n${report.note}\n\nPhoto reference: ${plain(report.photoURL)||'No photo supplied'}\n\nThis is an unreviewed observation, not a claim of current safety or a verified public report.\n`;
}
