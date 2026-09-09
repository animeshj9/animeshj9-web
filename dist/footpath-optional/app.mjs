import {BOUNDS,VIEWS,KINDS,REPORT_TYPES,classify,filterFeatures,inBounds,escapeHTML as esc,validateReport,reportGeoJSON,reportMarkdown} from './core.mjs';
const $=id=>document.getElementById(id);
let map,roads,highlight,pointMarker,selected=null,features=[],notes=[];
const today=new Date().toISOString().slice(0,10);
$('date').max=today;
for(const [key,value] of Object.entries(KINDS)) {
  $('kind').add(new Option(value.label,key));
  const row=document.createElement('div');const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--swatch',value.colour);row.append(swatch,document.createTextNode(value.label));$('legend').append(row);
}
for(const [key,value] of Object.entries(REPORT_TYPES))$('report-type').add(new Option(value.plain,key));
for(const [key,value] of Object.entries(VIEWS)) {
  const button=document.createElement('button');button.textContent=value.label;button.type='button';button.setAttribute('aria-pressed',String(key==='all'));
  button.addEventListener('click',()=>{map?.setView(value.center,value.zoom);for(const b of $('views').children)b.setAttribute('aria-pressed',String(b===button));});$('views').append(button);
}
function setPoint(lat,lng,road=null){
  if(!inBounds(lat,lng))return;
  $('lat').value=lat.toFixed(6);$('lng').value=lng.toFixed(6);
  selected=road;
  $('point-label').textContent=`Point selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}${road?' · '+road.properties.name:''}. Refine the coordinates if needed.`;
  if(map){if(pointMarker)map.removeLayer(pointMarker);pointMarker=L.circleMarker([lat,lng],{radius:7,color:'#232721',weight:2,fillColor:'#f9d33e',fillOpacity:1}).addTo(map);}
}
function selectRoad(feature,latlng){
  const p=feature.properties,k=KINDS[p.kind];
  if(map){if(highlight)map.removeLayer(highlight);highlight=L.geoJSON(feature,{style:{color:'#232721',weight:8,opacity:.85},interactive:false}).addTo(map);}
  const coords=latlng||{lat:feature.geometry.coordinates[0][1],lng:feature.geometry.coordinates[0][0]};setPoint(coords.lat,coords.lng,feature);
  $('selection').innerHTML=`<div><p class="eyebrow">OSM EVIDENCE · NOT FIELD VERIFIED</p><h3>${esc(k.joke)}</h3><strong>${esc(p.name)}</strong><p>${esc(k.description)}</p><a href="${esc(p.sourceURL)}" target="_blank" rel="noopener noreferrer">Inspect OSM way ${p.osmId} ↗</a><br><a class="button" href="#fieldnotes">Add a dated observation here +</a></div><div><p class="eyebrow">RAW TAGS / SNAPSHOT 9 SEP 2026</p><table class="tag-table"><caption class="small">Map metadata, not a survey of this road today</caption><tbody>${Object.entries(p.tags).map(([key,value])=>`<tr><th scope="row">${esc(key)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(){
  const kind=$('kind').value;let visible=filterFeatures(features,{query:$('search').value,kind});
  if(!$('restricted').checked&&kind!=='restricted')visible=visible.filter(f=>f.properties.kind!=='restricted');
  if(map){if(roads)map.removeLayer(roads);roads=L.geoJSON(visible,{bubblingMouseEvents:false,style:f=>({color:KINDS[f.properties.kind].colour,weight:f.properties.kind==='unknown'?2:4,opacity:f.properties.kind==='restricted'?.35:.85,dashArray:['absent','construction'].includes(f.properties.kind)?'7 5':null}),onEachFeature:(f,layer)=>{layer.bindTooltip(`${esc(f.properties.name)} · ${esc(KINDS[f.properties.kind].label)}`);layer.on('click',e=>{L.DomEvent.stopPropagation(e);selectRoad(f,e.latlng);});}}).addTo(map);if(highlight)highlight.bringToFront();if(pointMarker)pointMarker.bringToFront();}
  $('result-count').textContent=`${visible.length.toLocaleString()} map records match. Showing the first 60 below. Refine the search to find a particular road.`;
  $('results').replaceChildren();
  for(const f of visible.slice(0,60)){
    const button=document.createElement('button');button.type='button';button.textContent=f.properties.name;
    const small=document.createElement('small');small.textContent=`${KINDS[f.properties.kind].label} · OSM ${f.properties.osmId}`;button.append(small);
    button.addEventListener('click',()=>{selectRoad(f);if(map)map.fitBounds(L.geoJSON(f).getBounds(),{maxZoom:18,padding:[35,35]});});$('results').append(button);
  }
}
try{
  if(typeof L!=='undefined'){
    map=L.map('map',{preferCanvas:true,scrollWheelZoom:false,minZoom:12,maxZoom:19}).setView(VIEWS.all.center,VIEWS.all.zoom);
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
    tiles.on('tileerror',()=>{$('tile-note').hidden=false;});
    L.rectangle([[BOUNDS.south,BOUNDS.west],[BOUNDS.north,BOUNDS.east]],{color:'#232721',weight:1,dashArray:'5 5',fill:false,interactive:false}).addTo(map);
    map.on('click',e=>setPoint(e.latlng.lat,e.latlng.lng));
    L.circleMarker([17.419106,78.356281],{bubblingMouseEvents:false,radius:9,color:'#087d88',fillColor:'#fff',fillOpacity:1,weight:3}).addTo(map).bindTooltip('Archived photo · 25 Nov 2025').on('click',()=>{$('possible').scrollIntoView();});
  }else $('map').textContent='The map library could not load. Use the searchable road list.';
  const response=await fetch('./data/streets.geojson');if(!response.ok)throw Error('Snapshot unavailable');
  const data=await response.json();features=data.features.map(f=>({...f,properties:{...f.properties,kind:classify(f.properties.tags)}}));
  $('load-status').textContent=`${features.length.toLocaleString()} map records loaded · snapshot ${data.metadata.snapshot.slice(0,10)} · 0 reviewed field surveys. Records are not unique streets.`;
  render();
}catch(error){$('load-status').textContent='The road snapshot could not load. Reload to retry, or use the GeoJSON download below. No road conditions can be inferred from this error.';}
$('search').addEventListener('input',render);$('kind').addEventListener('change',render);$('restricted').addEventListener('change',render);
$('photo-location').addEventListener('click',()=>{map?.setView([17.419106,78.356281],18);$('explore').scrollIntoView();});
for(const id of ['lat','lng'])$(id).addEventListener('input',()=>{selected=null;$('point-label').textContent='Coordinates edited manually; no road association attached.';});
$('report-form').addEventListener('submit',event=>{
  event.preventDefault();const input=Object.fromEntries(new FormData(event.currentTarget));
  const {errors,report}=validateReport({...input,consent:input.consent==='on',road:selected?.properties.name,osmId:selected?.properties.osmId});
  $('form-errors').textContent=errors.join(' ');if(errors.length)return;
  notes.push(report);
  if(map)L.circleMarker([report.lat,report.lng],{radius:7,color:'#8d45b8',fillColor:'#fff',fillOpacity:1,dashArray:'3 3'}).addTo(map).bindTooltip(`LOCAL, UNREVIEWED: ${esc(REPORT_TYPES[report.type].plain)}`);
  $('note-count').textContent=`${notes.length} unreviewed ${notes.length===1?'note':'notes'} in this tab. Download before leaving.`;
  $('export').disabled=false;$('export-text').disabled=false;
  const card=document.createElement('article');const heading=document.createElement('strong');heading.textContent=REPORT_TYPES[report.type].title;
  const text=document.createElement('p');text.textContent=`${report.date} · ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)} · ${report.note}`;card.append(heading,text);$('local-notes').append(card);
  $('note').value='';$('photo-url').value='';$('form-errors').textContent='Kept in this tab only. Not submitted or published.';
});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').addEventListener('click',()=>download(JSON.stringify(reportGeoJSON(notes),null,2),'application/geo+json','footpath-optional-unreviewed-notes.geojson'));
$('export-text').addEventListener('click',()=>download(notes.map(reportMarkdown).join('\n---\n\n'),'text/plain','footpath-optional-unreviewed-notes.txt'));
