import {cpSync,readFileSync,writeFileSync,readdirSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const output=join(root,'_site');
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
cpSync(join(root,'dist'),output,{recursive:true});
// Pages ignores _headers. Preserve browser-enforceable policies in HTML.
// HTTP-only controls cannot be reproduced with meta tags (see LAUNCH.md).
const headers=readFileSync(join(root,'dist/_headers'),'utf8');
for(const block of headers.trim().split(/\n\s*\n/)) {
  const [route,...lines]=block.split('\n');
  if(!/^\/[a-z-]+\/\*$/.test(route))throw Error('Unsupported header route: '+route);
  const csp=lines.find(l=>l.trim().startsWith('Content-Security-Policy:'))?.split('Content-Security-Policy:')[1].trim();
  const referrer=lines.find(l=>l.trim().startsWith('Referrer-Policy:'))?.split('Referrer-Policy:')[1].trim();
  const policy=csp?.split(';').map(x=>x.trim()).filter(x=>x&&!x.startsWith('frame-ancestors ')).join('; ');
  const directory=join(output,route.slice(1,-2));
  const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
  for(const file of walk(directory).filter(f=>f.endsWith('.html'))) {
    let html=readFileSync(file,'utf8');
    const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
    const meta=(policy?`<meta http-equiv="Content-Security-Policy" content="${escape(policy)}">`:'')+(referrer?`<meta name="referrer" content="${escape(referrer)}">`:'');
    if(!/<meta charset="utf-8"\s*\/?\s*>/i.test(html))throw Error('Missing early charset: '+relative(root,file));
    html=html.replace(/(<meta charset="utf-8"\s*\/?\s*>)/i,'$1'+meta);
    writeFileSync(file,html);
  }
}
rmSync(join(output,'_headers'));
writeFileSync(join(output,'.nojekyll'),'');
console.log('Packaged dist/ into _site/ for GitHub Pages. Private products and repository files excluded.');
