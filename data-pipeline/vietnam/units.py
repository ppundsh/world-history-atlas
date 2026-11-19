#!/usr/bin/env python3
"""
Vietnam-mode units: today's provinces (Natural Earth 1:10m admin-1) grouped into historical zones, plus
Guangdong, Guangxi, Hainan, Laos and Cambodia for context. Zones follow the southward expansion (Nam tiến):
  delta (Red River delta, Giao Chỉ), ne / nw (northern uplands), thanh (Thanh Hóa, Cửu Chân), nghe (Nghệ An–Hà Tĩnh),
  qb_n / qb_s (Quảng Bình north / south of the Gianh river, 17.75° N — the Trịnh–Nguyễn line), qt (Quảng Trị: the
  17th parallel of 1954 runs through it, drawn on its north edge), hue, quangnam (with Đà Nẵng and Quảng Ngãi),
  vijaya (Bình Định), kauthara (Phú Yên, Khánh Hòa), panduranga (Ninh Thuận, Bình Thuận), highlands, saigon
  (Gia Định and the south-east), mekong, hatien (Kiên Giang).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import json, sys, os
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
NE, OUT = sys.argv[1:3]
A1 = json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']
A0 = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0) for f in json.load(open(os.path.join(NE, 'ne_10m_admin_0_countries.geojson'), encoding='utf-8'))['features']}
Z = {'delta': 'HN 56 66 61 HP 20 67 63 70 18', 'ne': '13 09 04 54 69 53 07 03', 'nw': '71 01 02 05 06 68 14', 'thanh': '21', 'nghe': '22 23',
     'qb': '24', 'qt': '25', 'hue': '26', 'quangnam': 'DN 27 29', 'vijaya': '31', 'kauthara': '32 34', 'panduranga': '36 40',
     'highlands': '28 30 33 72 35', 'saigon': 'SG 39 43 57 58 37 41', 'mekong': '46 50 49 51 45 44 CT 73 52 55 59', 'hatien': '47'}
vn = {f['properties']['iso_3166_2'].split('-')[1]: shape(f['geometry']).buffer(0) for f in A1 if f['properties']['adm0_a3'] == 'VNM'}
U = {}
used = set()
for k, ids in Z.items():
    U[k] = unary_union([vn[i] for i in ids.split()]); used |= set(ids.split())
left = set(vn) - used
assert not left, left
qb = U.pop('qb'); U['qb_n'] = qb.intersection(box(100, 17.75, 110, 19)); U['qb_s'] = qb.difference(box(100, 17.75, 110, 19))
for n, k in (('Guangdong', 'CN-GD'), ('Guangxi', 'CN-GX'), ('Hainan', 'CN-HI')):
    U[k] = unary_union([shape(f['geometry']) for f in A1 if f['properties']['adm0_a3'] == 'CHN' and f['properties']['name'] == n])
U['LAO'] = A0['LAO']; U['KHM'] = A0['KHM']
feats = [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g.buffer(0))} for k, g in U.items() if not g.is_empty]
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(feats), 'units →', OUT); print(' '.join(sorted(U)))
