"""Convert an Overpass highway snapshot into a bounded, attributed map layer.
Usage: python scripts/build-footpath-data.py /path/to/overpass.json
No missing tag is treated as proof of a missing sidewalk. No routes are computed.
"""
import json,sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])
data=json.loads(SOURCE.read_text())
S,W,N,E=17.385,78.32,17.445,78.38
OUT=ROOT/'dist/footpath-optional/data';OUT.mkdir(parents=True,exist_ok=True)
KEEP={'name','highway','foot','access','sidewalk','sidewalk:left','sidewalk:right','sidewalk:both','footway','surface','smoothness','width','incline','wheelchair','lit','crossing','kerb','tactile_paving','bridge','tunnel','layer','service'}
def clip(a,b):
    x,y=a;dx,dy=b[0]-x,b[1]-y;t0,t1=0,1
    for p,q in [(-dx,x-W),(dx,E-x),(-dy,y-S),(dy,N-y)]:
        if p==0:
            if q<0:return None
        else:
            t=q/p
            if p<0:t0=max(t0,t)
            else:t1=min(t1,t)
            if t0>t1:return None
    return [[round(x+t0*dx,7),round(y+t0*dy,7)],[round(x+t1*dx,7),round(y+t1*dy,7)]]
features=[]
for way in data.get('elements',[]):
    if way.get('type')!='way' or not way.get('geometry'):continue
    tags={k:v for k,v in way.get('tags',{}).items() if k in KEEP}
    # Indoor corridors and racing circuits aren't useful street survey candidates.
    if tags.get('highway') in ['corridor','raceway']:continue
    coords=[[p['lon'],p['lat']] for p in way['geometry']];pieces=[];current=[]
    for a,b in zip(coords,coords[1:]):
        pair=clip(a,b)
        if not pair or pair[0]==pair[1]:
            if len(current)>1:pieces.append(current)
            current=[];continue
        if current and current[-1]==pair[0]:current.append(pair[1])
        else:
            if len(current)>1:pieces.append(current)
            current=pair
    if len(current)>1:pieces.append(current)
    for i,piece in enumerate(pieces):
        features.append({'type':'Feature','geometry':{'type':'LineString','coordinates':piece},'properties':{'id':f"osm-{way['id']}-{i}",'osmId':way['id'],'name':tags.get('name') or 'Unnamed '+tags.get('highway','road'),'tags':tags,'sourceURL':f"https://www.openstreetmap.org/way/{way['id']}"}})
output={'type':'FeatureCollection','metadata':{'title':'Footpath Optional study window','source':'OpenStreetMap contributors / Overpass API','license':'ODbL-1.0','licenseURL':'https://www.openstreetmap.org/copyright','snapshot':data.get('osm3s',{}).get('timestamp_osm_base'),'bounds':[W,S,E,N],'query':'[out:json][timeout:35];way["highway"](17.385,78.32,17.445,78.38);out tags geom;','endpoint':'https://overpass-api.de/api/interpreter','caveat':'Snapshot time is not a survey date. Missing sidewalk tags mean unknown. Study bounds are not administrative boundaries. Roads may be split into multiple clipped features.','inputWays':len(data.get('elements',[]))},'features':features}
(OUT/'streets.geojson').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print(f"Saved {len(features)} clipped features from {output['metadata']['inputWays']} source ways; snapshot {output['metadata']['snapshot']}")
