#!/usr/bin/env python3
"""
Korea-mode units: today's provinces and metropolitan cities of both Koreas (Natural Earth 1:10m admin-1),
plus Liaoning (east / west of 122.4° E), Jilin, southern Heilongjiang and southern Primorye for Goguryeo,
Buyeo and Balhae. Approximate cuts so that historical lines fall on unit edges:
  gw38n   Gangwon (South Korea) north of 38° N — North Korean 1945–1950, South Korean after 1953
  hw38s   South Hwanghae south of 38° N (Ongjin, Yonan) — South Korean 1945–1950
  kaesong North Hwanghae south of 38.1° N and east of 126.3° E (Kaesong) — South Korean 1945–1950
  gn_e    South Gyeongsang east of 128.95° E (Yangsan) — Silla's side of the Nakdong
  hgs_s   South Hamgyong south of 40.1° N (Hamhung, Yonghung) — Goryeo's eastern frontier, Ssangseong
  python3 units.py <NE geojson dir> <out.geojson>
"""
import json, sys, os
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
NE, OUT = sys.argv[1:3]
A1 = json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']
U = {}
def put(k, g):
    g = g.buffer(0)
    if not g.is_empty: U[k] = unary_union([U[k], g]) if k in U else g
def cut(k, g, pieces):
    rest = g
    for name, p in pieces:
        put(name, g.intersection(p)); rest = rest.difference(p)
    put(k, rest)
for f in A1:
    p = f['properties']
    if p['adm0_a3'] in ('KOR', 'PRK'): put(p['iso_3166_2'], shape(f['geometry']))
cut('KR-42', U.pop('KR-42'), [('gw38n', box(126, 38.0, 130, 39.5))])
cut('KP-05', U.pop('KP-05'), [('hw38s', box(124, 36.5, 127, 38.0))])
cut('KP-06', U.pop('KP-06'), [('kaesong', box(126.3, 37.5, 127.2, 38.1))])
cut('KR-48', U.pop('KR-48'), [('gn_e', box(128.95, 34.5, 130, 36))])
cut('KP-08', U.pop('KP-08'), [('hgs_s', box(126.5, 38.5, 129.5, 40.1))])
prov = {f['properties']['name']: shape(f['geometry']) for f in A1 if f['properties']['adm0_a3'] in ('CHN', 'RUS') and f['properties']['name'] in ('Liaoning', 'Jilin', 'Heilongjiang', "Primor'ye")}
cut('liao_w', prov['Liaoning'], [('liao_e', box(122.4, 38, 126, 44))])
put('CN-JL', prov['Jilin'])
put('hlj_s', prov['Heilongjiang'].intersection(box(120, 40, 135, 46.8)))
put('pri_s', prov["Primor'ye"].intersection(box(128, 40, 140, 45.5)))
feats = [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g)} for k, g in U.items()]
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(feats), 'units →', OUT); print(' '.join(sorted(U)))
