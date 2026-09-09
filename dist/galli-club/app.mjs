import {options, stepView, validAdventure, keepsakeHTML} from './play.mjs';
const $=id=>document.getElementById(id);
let adventure=null, index=0, config=options();
async function loadAdventure() {
  $('start').disabled=true; $('start').textContent='Loading the adventure…'; $('retry').hidden=true;
  try {
    const response=await fetch('./adventure.json', {signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Could not load the adventure.');
    const data=await response.json();
    if(!validAdventure(data))throw new Error('The adventure is incomplete.');
    adventure=data; $('start').disabled=false; $('start').textContent='Let’s help Piku →'; $('load-status').textContent='';
  } catch { $('start').textContent='Adventure unavailable'; $('load-status').textContent='The story could not load. Try again, or use the free PDF beside this panel.'; $('retry').hidden=false; }
}
function render() {
  if(!adventure)return;
  const step=stepView(adventure,index,config);
  $('setup').hidden=true; $('finish').hidden=true; $('play').hidden=false;
  $('play-meta').textContent=`${config.name}’s adventure · ${adventure.minutes[config.age]} min · ${config.mood==='quiet'?'quiet play':'a few wiggles'}`;
  $('steps').replaceChildren(...adventure.steps.map((s,i)=>{
    const item=document.createElement('li'), button=document.createElement('button'); button.type='button';button.textContent=`${i+1}. ${s.label}`;
    if(i===index)button.setAttribute('aria-current','step');button.addEventListener('click',()=>{index=i;render();});item.append(button);return item;
  }));
  $('step-title').textContent=step.title; $('story').textContent=step.read; $('hinglish').textContent=step.hinglish; $('mission').textContent=step.do;
  $('age-label').textContent=config.age==='little'?'FOR LITTLE EXPLORERS · 3–4':'FOR BIGGER IMAGINATIONS · 5–7'; $('age-tip').textContent=step.ageTip;
  $('mood-label').textContent=config.mood==='quiet'?'THE QUIET WAY':'A LITTLE MOVEMENT'; $('mood-tip').textContent=step.moodTip; $('parent-tip').textContent=step.parent;
  $('back').disabled=index===0; $('next').textContent=step.last?'Our little adventure is done →':'Next little step →';
  $('step-title').focus({preventScroll:true}); $('play').scrollIntoView({block:'start',behavior:'auto'});
}
function start() {
  if(!adventure)return;
  config=options({name:$('name').value,age:$('age').value,mood:document.querySelector('input[name="mood"]:checked')?.value}); index=0;render();
}
$('start').addEventListener('click',start); $('retry').addEventListener('click',loadAdventure);
$('back').addEventListener('click',()=>{if(index>0){index--;render();}});
$('next').addEventListener('click',()=>{
  if(!adventure)return;
  if(index<adventure.steps.length-1){index++;render();return;}
  $('play').hidden=true; $('finish').hidden=false; $('finish-note').textContent=`${config.name}, keep your postcard somewhere you can find it. Piku may need another picture one day.`;
  $('finish').focus({preventScroll:true}); $('finish').scrollIntoView({block:'start'});
});
function setup() { $('play').hidden=true;$('finish').hidden=true;$('setup').hidden=false;$('start').focus(); }
$('change-settings').addEventListener('click',setup); $('replay').addEventListener('click',setup);
$('keepsake').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([keepsakeHTML(config.name)],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='galli-club-explorer-keepsake.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const previews={
  'post-office':{title:'The four-colour post office',opening:'Piku had opened the smallest post office in Hyderabad. It had one pencil, one very proud pigeon, and four letters with no addresses. “Red door, blue door, yellow door, green door,” he muttered. “If only colours could tell me where to go!” Then someone knocked. It was you.',materials:'You bring: two sheets of paper and crayons. We bring: the story, sorting game, pretend delivery challenge and city-making page.'},
  fort:{title:'The fort’s secret signal',opening:'The pretend gate of Golconda would not open. Not for “please”, not for “pretty please”, and definitely not for “I have brought a banana”. The gatekeeper scratched his head. “It opens for a hello made of three things. I remember a tap. Or was it a wave?” Piku looked at you. A signal-maker was needed.',materials:'You bring: paper, a pencil and your hands. We bring: a call-and-response game, a quiet signal code and a build-your-own code sheet.'},
  lake:{title:'A lake full of wishes',opening:'Piku unfolded a blue drawing and laid it on the floor. “I have made a pretend Hussain Sagar,” he announced. “But something is missing.” There was no one beside the lake, no place to sit, and nowhere for a wish to arrive. “Could you build a neighbourhood around my lake? A city needs people, not just a puddle of blue.”',materials:'You bring: two sheets of paper and crayons. We bring: a neighbourhood story, a turn-taking wish game and a design-your-own lake page. No water needed.'}
};
document.querySelectorAll('.preview').forEach(button=>button.addEventListener('click',()=>{
  const story=previews[button.dataset.story];if(!story)return;
  $('preview-title').textContent=story.title;$('preview-opening').textContent=story.opening;$('preview-materials').textContent=story.materials;$('preview-dialog').showModal();
}));
$('close-preview').addEventListener('click',()=>$('preview-dialog').close());
$('buy').addEventListener('click',()=>{
  $('buy-status').textContent='Not on sale yet. We’re testing the first edition with families before opening checkout. The free Piku adventure and printable kit are available now—no email or payment needed.';
});
loadAdventure();
