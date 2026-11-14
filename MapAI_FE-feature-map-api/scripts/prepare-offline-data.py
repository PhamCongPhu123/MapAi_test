"""Build a clipped ODbL road graph from the pinned OSM Overpass cache.
Usage: python scripts/prepare-offline-data.py /path/to/danang-routing/cache
No third-party application code is used; only OSM facts in cache/*.json.
"""
import sys, json, pathlib, collections
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/offline'
BOUNDS = [108.14, 15.97, 108.33, 16.16]
def inside(n):
    return BOUNDS[0] <= n['lon'] <= BOUNDS[2] and BOUNDS[1] <= n['lat'] <= BOUNDS[3]
def write(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))
nodes, ways = {}, {}
for p in sorted(pathlib.Path(sys.argv[1]).glob('*.json')):
    data = json.loads(p.read_text())
    if not isinstance(data, dict): continue
    for e in data.get('elements', []):
        if e['type'] == 'node': nodes[e['id']] = e
        elif e['type'] == 'way' and e.get('tags', {}).get('highway'): ways[e['id']] = e
points, ids, edges, names, features = [], {}, [], [], []
def node_id(i):
    if i not in ids:
        ids[i] = len(points)
        points.append([round(nodes[i]['lon'], 6), round(nodes[i]['lat'], 6)])
    return ids[i]
for i, w in sorted(ways.items()):
    t = w['tags']; road = t['highway']; name = t.get('name', t.get('ref', 'Đường dân cư'))
    if name not in names: names.append(name)
    ni = names.index(name)
    foot = road not in ('motorway', 'motorway_link', 'trunk', 'trunk_link') and t.get('foot') not in ('no', 'private')
    drive = road not in ('motorway', 'motorway_link') and t.get('motorcycle', t.get('motor_vehicle', t.get('vehicle'))) not in ('no', 'private')
    if t.get('access') in ('no', 'private'): foot = drive = False
    oneway = t.get('oneway', 'yes' if t.get('junction') == 'roundabout' else 'no')
    flags = (3 if foot else 0) | ((8 if oneway == '-1' else 4 if oneway in ('yes','1','true') else 12) if drive else 0)
    segments = []; line = []
    for a, b in zip(w['nodes'], w['nodes'][1:]):
        if a not in nodes or b not in nodes or not inside(nodes[a]) or not inside(nodes[b]):
            if len(line) > 1: segments.append(line)
            line = []; continue
        ai, bi = node_id(a), node_id(b)
        if flags: edges.append([ai, bi, ni, flags])
        if not line: line.append(points[ai])
        line.append(points[bi])
    if len(line) > 1: segments.append(line)
    for line in segments:
        features.append({'type':'Feature','properties':{'name':name,'class':road},'geometry':{'type':'LineString','coordinates':line}})
write('roads.json', {'bounds': BOUNDS, 'nodes':points,'names':names,'edges':edges})
# Input for the PMTiles builder; not shipped twice in the app.
(ROOT / 'scripts/roads.geojson.local').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
print('Graph:', len(points), 'nodes,', len(edges), 'edges,', len(features), 'road features')
# Local, clearly labelled illustrations, never presented as photos of a business.
for name, color, motif in [('food','#EA580C','bowl'),('sightseeing','#0284C7','bridge'),('entertainment','#7C3AED','wheel')]:
    im=Image.new('RGB',(480,320),'#F1F5F9'); d=ImageDraw.Draw(im)
    d.ellipse((230,-100,610,280),fill=color); d.ellipse((-110,180,180,470),fill='#CCFBF1')
    if motif=='bowl':
        d.ellipse((110,130,350,240),fill=color); d.ellipse((110,110,350,190),fill='white'); d.arc((130,127,330,180),0,180,fill=color,width=7)
        for x in (200,230,260): d.arc((x,50,x+22,116),80,260,fill=color,width=5)
    elif motif=='bridge':
        d.rectangle((70,205,410,220),fill=color); d.arc((105,100,375,320),180,360,fill=color,width=12)
        for x in range(130,370,40): d.line((x,150,x,207),fill=color,width=5)
        for y in (250,268): d.line((40,y,440,y),fill='#7DD3FC',width=5)
    else:
        d.ellipse((145,65,335,255),outline=color,width=10)
        for a,b in [((145,160),(335,160)),((240,65),(240,255)),((175,90),(305,230)),((175,230),(305,90))]: d.line((a,b),fill=color,width=4)
        d.line((240,160,185,280),fill=color,width=10); d.line((240,160,295,280),fill=color,width=10)
    im.save(OUT / f'{name}.webp',quality=82)
