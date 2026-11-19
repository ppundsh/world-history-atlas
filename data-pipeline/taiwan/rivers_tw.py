#!/usr/bin/env python3
"""rivers_osm.txt (OpenStreetMap extract, ODbL) → GeoJSON lines for the zoomed-in Taiwan river layer."""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'rivers_osm.txt'), encoding='utf-8').read().split('\n')
body = ''.join(l for l in src if l and not l.startswith('#'))
feats = []
for item in body.split(';'):
    if '|' not in item: continue
    name, nums = item.split('|')
    v = list(map(int, nums.split(',')))
    x = y = 0; pts = []
    for i in range(0, len(v) - 1, 2):
        x += v[i]; y += v[i + 1]; pts.append([x / 1000, y / 1000])
    if len(pts) > 1:
        feats.append({'type': 'Feature', 'properties': {'name': name}, 'geometry': {'type': 'LineString', 'coordinates': pts}})
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'build', 'rivers_tw.geojson')
json.dump({'type': 'FeatureCollection', 'features': feats}, open(out, 'w'), ensure_ascii=False)
print('rivers_tw:', len(feats), 'lines')
