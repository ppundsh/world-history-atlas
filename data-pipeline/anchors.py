"""Label anchors: for polities that are (or match) a modern country, Natural Earth's own label point.
The flat map and globe label a polity in the part of its territory that contains (or lies nearest to)
its anchor, rather than in its largest piece — so the United Kingdom of 1970 is named in Britain, not in
Oman, and Denmark in Denmark, not in Greenland.

  NE=path/to/natural-earth-vector/geojson python3 data-pipeline/anchors.py
writes public/data/anchors.json  {polity row: [lon, lat]}
"""
import json, os, re
NE = os.environ.get('NE', 'data-pipeline/sources/natural-earth-vector/geojson')
ne = json.load(open(os.path.join(NE, 'ne_50m_admin_0_countries.geojson'), encoding='utf-8'))['features']
by_qid, by_name = {}, {}
for f in ne:
    p = f['properties']
    pt = [round(p['LABEL_X'], 2), round(p['LABEL_Y'], 2)]
    if p.get('WIKIDATAID'): by_qid[p['WIKIDATAID']] = pt
    for k in ('NAME', 'NAME_LONG', 'ADMIN', 'FORMAL_EN', 'NAME_EN'):
        if p.get(k): by_name.setdefault(p[k].lower(), pt)
pol = json.load(open('public/data/polities.json', encoding='utf-8'))
rows = pol if isinstance(pol, list) else [pol[k] for k in sorted(pol, key=int)]
# Cliopatria names of empires / regimes whose home is a modern country
ALIAS = {'Estado Novo': 'PRT', 'Portugal (Estado Novo)': 'PRT', 'Portugal (Estado Novo)': 'PRT', 'British Empire': 'GBR', 'French Colonial Empire': 'FRA', 'Union of Soviet Socialist Republics': 'RUS',
         'Kingdom of Italy': 'ITA', 'Empire of Japan': 'JPN', 'Kingdom of the Netherlands': 'NLD', 'Kingdom of Belgium': 'BEL'}
by_a3 = {f['properties']['ADM0_A3']: [round(f['properties']['LABEL_X'], 2), round(f['properties']['LABEL_Y'], 2)] for f in ne}
out = {}
for i, r in enumerate(rows):
    pt = by_a3.get(ALIAS.get(r[0], '')) or by_qid.get(r[10]) or by_name.get(r[0].lower()) or by_name.get(re.sub(r'^(the )', '', (r[6] or '').lower()))
    if pt: out[i] = pt
json.dump(out, open('public/data/anchors.json', 'w'), separators=(',', ':'))
print('anchors:', len(out), 'of', len(rows))
