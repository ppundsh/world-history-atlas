#!/usr/bin/env python3
"""
Germany-mode units (1648–2026): today's German states (Natural Earth 1:10m admin-1), several cut along old
borders, plus the lands Germany held or claimed at some time: western Polish voivodeships (Pomerania, Silesia,
Posen, West and East Prussia), Kaliningrad, Bohemia and Moravia, Austria, Alsace-Lorraine, North Schleswig and
Luxembourg. Approximate cuts (straight lines near the old borders):
  by_franconia (Bavaria north of 49° N, west of 11.6° E), by_opf (Upper Palatinate), by_swabia (west of 10.9° E,
  south of 49° N), by_old (Old Bavaria); bw_baden (Baden: the Rhine side) / bw_wue (Württemberg);
  nrw_rhine (Rhine Province, west of 7.3° E) / nrw_westf (Westphalia); ni_west (Oldenburg and East Frisia),
  ni_bs (Brunswick), ni_han (Hanover); he_n (Hesse-Kassel, north of 50.55° N) / he_s;
  rp_pfalz (Palatinate, south of 49.75° N) / rp_n; st_n (Magdeburg, Altmark) / st_s; mv_w (Mecklenburg) /
  mv_e (Western Pomerania); berlin_w / berlin_e (13.4° E); n_schleswig (Danish since 1920).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import json, sys, os
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union
NE, OUT = sys.argv[1:3]
A1 = json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']
A0 = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0) for f in json.load(open(os.path.join(NE, 'ne_10m_admin_0_countries.geojson'), encoding='utf-8'))['features']}
iso = {f['properties']['iso_3166_2']: shape(f['geometry']).buffer(0) for f in A1 if f['properties']['adm0_a3'] in ('DEU', 'POL', 'CZE', 'FRA', 'DNK', 'RUS')}
U = {}
def put(k, g):
    g = g.buffer(0)
    if not g.is_empty: U[k] = unary_union([U[k], g]) if k in U else g
def cut(k, g, pieces):
    rest = g
    for name, p in pieces:
        put(name, rest.intersection(p)); rest = rest.difference(p)
    put(k, rest)
cut('by_old', iso['DE-BY'], [('by_franconia', box(8, 49.0, 11.6, 51)), ('by_opf', box(11.6, 48.9, 13, 50.4)), ('by_swabia', box(9.5, 47, 10.9, 49.0))])
cut('bw_wue', iso['DE-BW'], [('bw_baden', Polygon([(7.4, 47.4), (8.55, 47.4), (8.55, 48.8), (9.3, 49.2), (9.3, 49.9), (7.4, 49.9)]))])
cut('nrw_westf', iso['DE-NW'], [('nrw_rhine', box(5.8, 50.2, 7.3, 52))])
cut('ni_han', iso['DE-NI'], [('ni_west', box(6.5, 52.4, 8.6, 54)), ('ni_bs', box(10.2, 51.8, 11.1, 52.5))])
cut('he_s', iso['DE-HE'], [('he_n', box(8, 50.55, 10.5, 52))])
cut('rp_n', iso['DE-RP'], [('rp_pfalz', box(6, 48.9, 8.6, 49.75))])
cut('st_s', iso['DE-ST'], [('st_n', box(10.5, 51.75, 12.5, 53.1))])
cut('mv_w', iso['DE-MV'], [('mv_e', box(12.8, 53.4, 14.5, 54.8))])
cut('berlin_e', iso['DE-BE'], [('berlin_w', box(13.0, 52.3, 13.4, 52.7))])
for k, i in [('saar', 'DE-SL'), ('th', 'DE-TH'), ('sn', 'DE-SN'), ('bb', 'DE-BB'), ('sh', 'DE-SH'), ('hh', 'DE-HH'), ('hb', 'DE-HB'),
             ('pl_wpom', 'PL-ZP'), ('pl_lub', 'PL-LB'), ('pl_lsil', 'PL-DS'), ('pl_opo', 'PL-OP'), ('pl_sil', 'PL-SL'), ('pl_wlkp', 'PL-WP'),
             ('pl_kuj', 'PL-KP'), ('pl_pom', 'PL-PM'), ('pl_wm', 'PL-WN'), ('pl_maz', 'PL-MZ'), ('pl_lodz', 'PL-LD'), ('kgd', 'RU-KGD')]:
    put(k, iso[i])
put('alsace', unary_union([iso['FR-67'], iso['FR-68'] if 'FR-68' in iso else iso['FR-67']]))
put('lorraine', iso['FR-57'])
put('n_schleswig', iso['DK-83'].intersection(box(8, 54.8, 10.2, 55.45)))
moravia = ['CZ-JM', 'CZ-ZL', 'CZ-OL', 'CZ-MO']
put('moravia', unary_union([iso[i] for i in moravia]))
put('bohemia', unary_union([g for i, g in iso.items() if i.startswith('CZ-') and i not in moravia]))
put('austria', A0['AUT']); put('lux', A0['LUX'])
feats = [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g)} for k, g in U.items() if not g.is_empty]
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(feats), 'units →', OUT); print(' '.join(sorted(U)))
