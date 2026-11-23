#!/usr/bin/env python3
"""
Outlines of modern countries for the floating comparison shape (the default shape follows the visitor's locale):
the country's home part only (its largest landmass and the islands near it, not far-off territories such as
Alaska or Hawaii), simplified. Natural Earth 1:10m admin-0 (public domain).
  python3 data-pipeline/compare/outlines.py <Natural Earth geojson dir>  ->  public/data/outlines/<ISO3>.json
"""
import json, os, sys, math
from shapely.geometry import shape, mapping, MultiPolygon
NE = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data', 'outlines')
os.makedirs(OUT, exist_ok=True)
def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    return 6371 * math.acos(min(1, math.sin(la1) * math.sin(la2) + math.cos(la1) * math.cos(la2) * math.cos(lo1 - lo2)))
n = 0
index = {}
for f in json.load(open(os.path.join(NE, 'ne_10m_admin_0_countries.geojson'), encoding='utf-8'))['features']:
    p = f['properties']; iso = p['ADM0_A3']
    if p['TYPE'] in ('Dependency', 'Lease', 'Indeterminate') and iso not in ('TWN', 'HKG'): continue
    g = shape(f['geometry']).buffer(0)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    big = max(polys, key=lambda q: q.area); c0 = big.centroid.coords[0]
    keep = [q for q in polys if q is big or (q.area >= big.area * 0.02 and km(q.centroid.coords[0], c0) <= 1500)]
    home = MultiPolygon(keep)
    tol = max(0.01, math.sqrt(home.area) / 400)                 # about 1/400 of the country's size
    s = home.simplify(tol, preserve_topology=True)
    geo = mapping(s)
    rnd = lambda x: [round(x[0], 3), round(x[1], 3)]
    coords = [[[rnd(pt) for pt in ring] for ring in poly] for poly in (geo['coordinates'] if geo['type'] == 'MultiPolygon' else [geo['coordinates']])]
    names = [p.get('NAME_EN') or p['NAME'], p.get('NAME_ZHT') or p.get('NAME_ZH') or '', p.get('NAME_ZH') or '', p.get('NAME_JA') or '']
    json.dump({'iso': iso, 'q': p.get('WIKIDATAID'), 'n': names, 'type': 'Feature', 'properties': {},
               'geometry': {'type': 'MultiPolygon', 'coordinates': coords}}, open(os.path.join(OUT, iso + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    iso2 = p.get('ISO_A2_EH') if p.get('ISO_A2_EH') not in (None, '-99') else p.get('ISO_A2')
    if iso2 and iso2 != '-99': index[iso2] = iso
    n += 1
json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'), sort_keys=True)
print(n, 'outlines')
