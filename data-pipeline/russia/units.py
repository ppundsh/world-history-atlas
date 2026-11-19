#!/usr/bin/env python3
"""
Russia-mode units, from Natural Earth 1:10m admin-1 (federal subjects of Russia, oblasts of Ukraine, Belarus and
Kazakhstan, Polish voivodeships, Moldovan / Georgian / Azerbaijani districts merged where history needs it) and
countries (Baltic states, Finland, Central Asia, Armenia, Mongolia), plus Alaska and Kars-Ardahan-Artvin.

Some units are cut further so that historical lines fall on unit edges. These cuts are approximate sketches:
  Vyborg (Karelian Isthmus) and Ladoga Karelia, Finnish 1920–1940/44; Pechenga, Finnish 1920–1944;
  southern Sakhalin and the Kurils (Japanese 1875/1905–1945);
  Donetsk and Luhansk: the line of 2014–2022; Kherson: Dnipro left bank; Zaporizhzhia: south of 47.55° N;
  Kharkiv: east of 37° E (occupied March–September 2022); Transnistria; Abkhazia; South Ossetia;
  Nagorno-Karabakh (core and the districts held 1993–2020).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import json, sys, os
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union

NE, OUT = sys.argv[1:3]
ne = lambda n: json.load(open(os.path.join(NE, n), encoding='utf-8'))['features']
A1 = ne('ne_10m_admin_1_states_provinces.geojson')
A0 = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0) for f in ne('ne_10m_admin_0_countries.geojson')}
def a1(cc, names=None):
    return [f for f in A1 if f['properties']['adm0_a3'] == cc and (names is None or f['properties']['name'] in names)]
U = {}
def put(k, g):
    g = g.buffer(0)
    if not g.is_empty: U[k] = unary_union([U[k], g]) if k in U else g
def cut(k, g, pieces):
    """split g by named boxes / polygons; the rest stays under k"""
    rest = g
    for name, p in pieces:
        part = g.intersection(p); put(name, part); rest = rest.difference(p)
    put(k, rest)

for f in a1('RUS'):
    iso = f['properties']['iso_3166_2']
    if iso == 'RU-X01~': iso = 'RU-YAN'          # a sliver on the Yamal peninsula
    put(iso, shape(f['geometry']))
cut('RU-LEN', U.pop('RU-LEN'), [('vyborg', Polygon([(27.6, 60.1), (29.9, 60.15), (30.6, 60.6), (31.2, 61.2), (29.5, 61.3), (27.6, 60.7)]))])
cut('RU-KR', U.pop('RU-KR'), [('ladoga_k', box(29.3, 61.0, 32.6, 62.4))])
cut('RU-MUR', U.pop('RU-MUR'), [('pechenga', box(28.0, 69.0, 31.3, 70.2))])
sak = U.pop('RU-SAK')
cut('RU-SAK', sak, [('sak_s', box(141.0, 45.8, 145.5, 50.0)), ('kur_s', box(145.4, 43.0, 149.0, 45.7)),
                    ('kur_n', box(149.0, 45.3, 157.0, 51.5))])

for f in a1('UKR'):
    put(f['properties']['iso_3166_2'], shape(f['geometry']))
D, L = U.pop('UA-14'), U.pop('UA-09')                  # Donetsk, Luhansk
line14_d = Polygon([(37.95, 48.45), (38.4, 48.55), (39.9, 48.4), (39.9, 46.9), (37.75, 46.9), (37.75, 47.3), (37.95, 47.9)])
cut('UA-14', D, [('UA-14-2014', line14_d), ('UA-14-west', Polygon([(36.4, 49.3), (38.3, 49.3), (38.3, 48.4), (37.6, 48.3), (36.4, 48.4)]))])
cut('UA-09', L, [('UA-09-2014', Polygon([(38.2, 48.75), (39.2, 48.6), (40.3, 48.5), (40.3, 47.8), (38.2, 47.8)]))])
cut('UA-65', U.pop('UA-65'), [('UA-65-left', Polygon([(31.4, 46.45), (32.0, 46.52), (32.6, 46.63), (33.35, 46.75), (33.9, 47.15), (35.6, 47.5), (35.6, 45.5), (31.4, 45.5)]))])
cut('UA-23', U.pop('UA-23'), [('UA-23-south', box(34.0, 45.5, 37.5, 47.55))])
cut('UA-63', U.pop('UA-63'), [('UA-63-east', box(37.0, 48.8, 38.5, 50.5))])

for f in a1('BLR'): put(f['properties']['iso_3166_2'], shape(f['geometry']))
for f in a1('KAZ'):
    k = 'KZ-ALC' if f['properties']['name'] == 'Almaty City' else f['properties']['iso_3166_2']
    put(k, shape(f['geometry']))
congress = ['Masovian', 'Łódź', 'Lublin', 'Świętokrzyskie', 'Podlachian']
put('pl_congress', unary_union([shape(f['geometry']) for f in a1('POL', congress)]))
put('pl_rest', unary_union([shape(f['geometry']) for f in a1('POL') if f['properties']['name'] not in congress]))
tr = ['Transnistria', 'Stîngă Nistrului', 'Grigoriopol', 'Bender', 'Camenca']
put('md_tr', unary_union([shape(f['geometry']) for f in a1('MDA', tr)]))
put('md', unary_union([shape(f['geometry']) for f in a1('MDA') if f['properties']['name'] not in tr]))
geo = {f['properties']['name']: shape(f['geometry']) for f in a1('GEO')}
put('abkhazia', geo.pop('Abkhazia'))
so = box(43.6, 42.15, 44.6, 42.65)
g_rest = unary_union(list(geo.values()))
put('s_ossetia', g_rest.intersection(so).intersection(unary_union([geo['Shida Kartli'], geo['Mtskheta-Mtianeti'], geo['Racha-Lechkhumi-Kvemo Svaneti'], geo['Imereti']])))
put('georgia', g_rest.difference(U['s_ossetia']))
nk_core = ['Xocalı', 'Şuşa', 'Stepanakert', 'Xocavənd']
nk_buf = ['Kəlbəcər', 'Qubadli', 'Zəngilan', 'Cəbrayıl', 'Füzuli', 'Ağdam']
put('nk', unary_union([shape(f['geometry']) for f in a1('AZE', nk_core)]))
put('nk_buffer', unary_union([shape(f['geometry']) for f in a1('AZE', nk_buf)]))
nax = ['Şərur', 'Sədərək', 'Kangarli', 'Babək', 'Şahbuz', 'Culfa', 'Ordubad', 'Naxçıvan']
put('nakhchivan', unary_union([shape(f['geometry']) for f in a1('AZE', nax)]))
put('azerbaijan', unary_union([shape(f['geometry']) for f in a1('AZE') if f['properties']['name'] not in nk_core + nk_buf + nax]))
for a3, k in [('ARM', 'armenia'), ('EST', 'estonia'), ('LVA', 'latvia'), ('LTU', 'lithuania'), ('FIN', 'finland'), ('UZB', 'uzbekistan'),
              ('TKM', 'turkmenistan'), ('KGZ', 'kyrgyzstan'), ('TJK', 'tajikistan'), ('MNG', 'mongolia')]:
    put(k, A0[a3])
put('alaska', unary_union([shape(f['geometry']) for f in a1('USA', ['Alaska'])]))
put('kars', unary_union([shape(f['geometry']) for f in a1('TUR', ['Kars', 'Ardahan', 'Artvin'])]))

feats = [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g)} for k, g in U.items()]
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(feats), 'units →', OUT)
print(' '.join(sorted(U)))
