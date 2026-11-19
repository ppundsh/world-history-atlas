#!/usr/bin/env python3
"""
CountryHistory data pipeline — stage 1.

Reads Cliopatria (CC BY 4.0) + Natural Earth (PD), applies the project's
de-facto-control and naming rules (see CLAUDE.md §2), and writes:

  build/chunks/<id>.geojson   per-era feature chunks (simplified later by mapshaper)
  build/polities.json         polity table: names (en/zh-Hant/zh-Hans/ja), color, flags
  build/disputed.geojson      disputed areas with start/end years and per-POV owners
  build/meta.json             year range, chunk index, per-year country counts

Usage:  python3 build.py <cliopatria.geojson> <natural-earth geojson dir>
"""
import json
import numpy as np, sys, os, re, hashlib, colorsys
from collections import defaultdict
from shapely.geometry import shape, mapping, Point, box as shapely_box
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'build')
CLIO, NE = sys.argv[1], sys.argv[2]
END_YEAR = 2026
CLIO_END = 2024

os.makedirs(os.path.join(OUT, 'chunks'), exist_ok=True)

def geom(g):
    s = shape(g)
    if not s.is_valid:
        s = make_valid(s)
        # keep only polygonal parts
        if s.geom_type == 'GeometryCollection':
            s = unary_union([p for p in s.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    return s

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

# ---------------------------------------------------------------- inputs
print('loading Cliopatria …', flush=True)
clio = load(CLIO)['features']
rows = []
for f in clio:
    p = f['properties']
    if p['Type'] != 'POLITY' or not f['geometry']:
        continue
    if p['Name'].startswith('('):          # umbrella entries such as "(British Empire)": overlap their members
        continue
    rows.append({'name': p['Name'], 'from': p['FromYear'], 'to': p['ToYear'],
                 'qid': p['Wikidata'], 'g': geom(f['geometry'])})
print(len(rows), 'polity rows')
# Wikidata ID corrections (overrides/qid.tsv)
for line in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'overrides', 'qid.tsv'), encoding='utf-8'):
    if line.startswith('#') or not line.strip(): continue
    nm, bad, good = line.rstrip('\n').split('\t')[:3]
    for r in rows:
        if r['name'] == nm and r['qid'] == bad: r['qid'] = good

ne_countries = load(os.path.join(NE, 'ne_50m_admin_0_countries.geojson'))['features']
ne_disputed = load(os.path.join(NE, 'ne_50m_admin_0_breakaway_disputed_areas.geojson'))['features']
disp_by_name = {f['properties']['BRK_NAME']: f for f in ne_disputed}

# ---------------------------------------------------------------- helpers
def split_rows(name, year, fn_after):
    """Split every row of `name` that spans `year` so rows from `year` on can be edited by fn_after(row)."""
    out = []
    for r in rows:
        if r['name'] != name or r['to'] < year:
            out.append(r); continue
        if r['from'] < year:
            out.append({**r, 'to': year - 1})
            r = {**r, 'from': year}
        out.append(fn_after(r) or r)
    rows[:] = out

def cap_rows(name, last_year):
    rows[:] = [r if not (r['name'] == name and r['to'] > last_year) else {**r, 'to': last_year}
               for r in rows if not (r['name'] == name and r['from'] > last_year)]

def subtract(g, cut):
    d = g.difference(cut)
    return d if not d.is_empty else None

# ---------------------------------------------------------------- 1) extend 2024 → 2026
for r in rows:
    if r['to'] == CLIO_END:
        r['to'] = END_YEAR

# ---------------------------------------------------------------- 2) de-facto corrections (CLAUDE.md §2 rule 4)
crimea = geom(disp_by_name['Crimea']['geometry'])
dpr = geom(disp_by_name["Donetsk People's Republic"]['geometry'])
lpr = geom(disp_by_name["Luhansk People's Republic"]['geometry'])
donbas = unary_union([dpr, lpr])

# Crimea: under Russian control from March 2014 — remove from Ukraine, make sure Russia has it.
def ukr_2014(r):
    r['g'] = subtract(r['g'], unary_union([crimea, donbas])) or r['g']
split_rows('Ukraine', 2014, ukr_2014)

def rus_2014(r):
    r['g'] = unary_union([r['g'], crimea])
split_rows('Russian Federation', 2014, rus_2014)

# Donetsk / Luhansk: self-proclaimed (Russian-backed) 2014–2021, under Russian control from 2022.
for nm, g in (("Donetsk People's Republic", dpr), ("Luhansk People's Republic", lpr)):
    rows.append({'name': nm, 'from': 2014, 'to': 2021, 'qid': '', 'g': g, 'unrecognized': True})
def rus_2022(r):
    r['g'] = unary_union([r['g'], donbas])
split_rows('Russian Federation', 2022, rus_2022)

# Other self-governing breakaway areas (de facto independent, recognised by few or no UN members):
# carve them out of whatever polity Cliopatria draws there for those years.
SELF_ADMIN = [('Abkhazia', 1993, END_YEAR), ('Somaliland', 1991, END_YEAR), ('Artsakh', 1991, 2023)]
for nm, y0, y1 in SELF_ADMIN:
    g = geom(disp_by_name[nm]['geometry'])
    out = []
    for r in rows:
        if r['to'] < y0 or r['from'] > y1 or not r['g'].intersects(g) or r['g'].intersection(g).area < 0.2 * g.area:
            out.append(r); continue
        if r['from'] < y0: out.append({**r, 'to': y0 - 1})
        cut = subtract(r['g'], g)
        if cut is not None: out.append({**r, 'from': max(r['from'], y0), 'to': min(r['to'], y1), 'g': cut})
        if r['to'] > y1: out.append({**r, 'from': y1 + 1})
    rows[:] = out
    rows.append({'name': nm, 'from': y0, 'to': y1, 'qid': disp_by_name[nm]['properties'].get('WIKIDATAID', ''), 'g': g, 'unrecognized': True})

# Syria: the Assad government fell in Dec 2024; from 2025 the former opposition areas belong to Syria's
# de-facto government. Merge Cliopatria's "Mujahideen" (Syrian opposition) polygons into Syria.
muj = [r for r in rows if r['name'] == 'Mujahideen' and r['to'] >= 2025]
if muj:
    mg = unary_union([r['g'] for r in muj])
    cap_rows('Mujahideen', 2024)
    split_rows('Syria', 2025, lambda r: {**r, 'g': unary_union([r['g'], mg])})

rows = [r for r in rows if r['g'] is not None and not r['g'].is_empty]

# ---------------------------------------------------------------- 2b) sourced geometry corrections (overrides/geometry.tsv)
ne1 = None
def named_geom(spec):
    global ne1
    parts = []
    for s in spec.split('+'):
        kind, name = s.split(':', 1)
        if kind == 'NE':
            parts.append(next(geom(f['geometry']) for f in ne_countries if f['properties']['ADM0_A3'] == name))
        elif kind == 'NE1':
            ne1 = ne1 or load(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'))['features']
            parts.append(next(geom(f['geometry']) for f in ne1 if f['properties']['name'] == name))
        elif kind == 'TW':
            tw = load(os.path.join(HERE, 'build', 'taiwan_units.geojson'))['features']
            parts.append(unary_union([shape(f['geometry']) for f in tw if f['properties']['id'] == name]))
    return unary_union(parts)
for line in open(os.path.join(HERE, 'overrides', 'geometry.tsv'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'): continue
    name, y0, y1, action, spec, src = line.rstrip('\n').split('\t')
    y0, y1, g = int(y0), int(y1), named_geom(spec)
    def fix(r, action=action, g=g):
        if action == 'set': r['g'] = g
        elif action == 'add': r['g'] = unary_union([r['g'], g])
        else: r['g'] = subtract(r['g'], g) or r['g']
        return r
    out = []
    for r in rows:
        if r['name'] != name or r['to'] < y0 or r['from'] > y1:
            out.append(r); continue
        if r['from'] < y0: out.append({**r, 'to': y0 - 1})
        out.append(fix({**r, 'from': max(r['from'], y0), 'to': min(r['to'], y1)}))
        if r['to'] > y1: out.append({**r, 'from': y1 + 1})
    rows[:] = out
print('geometry corrections applied', flush=True)

# ---------------------------------------------------------------- 2c) fill land Cliopatria leaves empty (overrides/holes.tsv)
land = unary_union([geom(f['geometry']) for f in load(os.path.join(NE, 'ne_50m_land.geojson'))['features']])
HOLE_NAMES = {}
for line in open(os.path.join(HERE, 'overrides', 'holes.tsv'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'): continue
    key, y0, y1, box, en, hant, hans, ja, qid, src = line.rstrip('\n').split('\t')
    y0, y1 = int(y0), int(y1)
    x0, b0, x1, b1 = map(float, box.split(','))
    area = land.intersection(shapely_box(x0, b0, x1, b1))
    HOLE_NAMES[key] = (en, hant, hans, ja, qid)
    # periods inside [y0, y1] during which the set of polities touching the box is constant
    near = [r for r in rows if r['to'] >= y0 and r['from'] <= y1 and r['g'].intersects(area)]
    cuts = sorted({y0, y1 + 1} | {r['from'] for r in near if y0 < r['from'] <= y1} | {r['to'] + 1 for r in near if y0 <= r['to'] < y1})
    for a, b in zip(cuts, cuts[1:]):
        alive = [r['g'] for r in near if r['from'] <= a and r['to'] >= b - 1]
        hole = subtract(area, unary_union(alive)) if alive else area
        if hole is None: continue
        hole = unary_union([p for p in getattr(hole, 'geoms', [hole]) if p.geom_type == 'Polygon' and p.area > 0.05])
        if not hole.is_empty:
            rows.append({'name': key, 'from': a, 'to': b - 1, 'qid': qid, 'g': hole})
print('holes filled', flush=True)

# ---------------------------------------------------------------- 3) names
def read_tsv(path):
    out = defaultdict(list)
    for line in open(path, encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        c = (line.rstrip('\n').split('\t') + [''] * 11)[:11]
        name, a, b, en, hant, hans, ja, alt_hant, alt_hans, alt_en = c[:10]
        hans = hant if hans == '=' else hans
        ja = hant if ja == '=' else ja
        alt_hans = alt_hant if alt_hans == '=' else alt_hans
        out[name].append({'from': int(a) if a else -99999, 'to': int(b) if b else 99999,
                          'en': en, 'zh-Hant': hant, 'zh-Hans': hans, 'ja': ja,
                          'alt': {'en': alt_en, 'zh-Hant': alt_hant, 'zh-Hans': alt_hans, 'ja': alt_hant} if alt_hant else None})
    return out

overrides = read_tsv(os.path.join(HERE, 'overrides', 'names.tsv'))

wd = {}
for line in open(os.path.join(HERE, 'raw', 'wikidata_labels.txt'), encoding='utf-8'):
    line = line.rstrip('\n')
    if ':' not in line:
        continue
    q, rest = line.split(':', 1)
    hant, hans, ja = (rest.split('|') + ['', ''])[:3]
    review = ja.endswith('*')
    ja = ja.rstrip('*')
    if hans == '^':
        hans = hant
    wd['Q' + q] = {'zh-Hant': hant, 'zh-Hans': hans, 'ja': ja, 'review': review}

# modern countries: each row from 1946 on is matched to a Natural Earth country by overlap.
#  - mutual match (≥50% of the row and ≥50% of the country)    -> key "NE:<A3>"
#  - small fragment (<10% of the country, ≥80% inside it) -> merged into that country's key, if the
#    country also has a mutual match in the same years (e.g. Cabinda tagged "Estado Novo" -> Angola)
ne_shapes = [(f['properties'], geom(f['geometry'])) for f in ne_countries]
ne_by_a3 = {p['ADM0_A3']: p for p, g in ne_shapes}
sov_home = {p['SOV_A3']: p['ADM0_A3'] for p, g in ne_shapes if p['ADMIN'] == p['SOVEREIGNT']}
def home(a3):   # dependencies (Greenland, Falklands …) belong to their sovereign's polity
    p = ne_by_a3[a3]
    return sov_home.get(p['SOV_A3'], a3)
MODERN_FROM = 1946
mutual, fragment = {}, {}
# 1) identity first: a row whose Wikidata item is a Natural Earth country IS that country, whatever
#    territory it holds that year (Israel 1967–1972 holds Sinai and must not be merged into Egypt)
qid_a3 = {p.get('WIKIDATAID'): home(p['ADM0_A3']) for p, g in ne_shapes if p.get('WIKIDATAID')}
by_qid = {}
for i, r in enumerate(rows):
    if r['to'] >= MODERN_FROM and r['name'] not in overrides and not r.get('unrecognized') and r.get('qid') in qid_a3:
        mutual[i] = qid_a3[r['qid']]
        by_qid.setdefault(mutual[i], []).append((r['from'], r['to'], r['qid']))
def claimed(a3, r):     # is this country already represented by a different state in these years?
    return any(a <= r['to'] and b >= r['from'] and q != r.get('qid') for a, b, q in by_qid.get(a3, []))
from shapely.ops import transform as _tf
def _ea(g):     # area on a cylindrical equal-area plane (x = lon, y = sin lat)
    return _tf(lambda x, y, z=None: (x, np.sin(np.radians(y))), g).area if not g.is_empty else 0.0
# 2) otherwise by overlap (predecessor names, untagged fragments)
for i, r in enumerate(rows):
    if i in mutual or r['to'] < MODERN_FROM or r['name'] in overrides or r.get('unrecognized'):
        continue
    ra = r['g'].area
    for p, g in ne_shapes:
        if not g.intersects(r['g'].envelope):
            continue
        a = g.intersection(r['g']).area
        # the row must essentially BE that country (≥80% of its true area inside): an empire or union whose biggest
        # piece is a later state keeps its own name (Estado Novo is not "Angola", the USSR not "Russia",
        # Czechoslovakia not "Czech Republic"). Areas in lon/sin(lat) — equal-area — so northern land isn't overweighted.
        if a >= 0.5 * ra and a >= 0.5 * g.area and _ea(g.intersection(r['g'])) >= 0.8 * _ea(r['g']) and not claimed(home(p['ADM0_A3']), r):
            mutual[i] = home(p['ADM0_A3']); break
        if ra < 0.1 * g.area and a >= 0.5 * ra and not (r.get('qid') and claimed(home(p['ADM0_A3']), r)):
            fragment[i] = home(p['ADM0_A3'])
alive_mutual = defaultdict(list)
for i, a3 in mutual.items():
    alive_mutual[a3].append((rows[i]['from'], rows[i]['to']))
for i, a3 in fragment.items():
    if i not in mutual and any(a <= rows[i]['to'] and b >= rows[i]['from'] for a, b in alive_mutual[a3]):
        mutual[i] = a3

# sovereign states missing from Cliopatria (overrides/extra_states.tsv)
alive_geoms = [r['g'] for r in rows if r['to'] >= END_YEAR]
for line in open(os.path.join(HERE, 'overrides', 'extra_states.tsv'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'):
        continue
    a3, y0 = line.split('\t')[:2]
    g = next(g for p, g in ne_shapes if p['ADM0_A3'] == a3)
    # already present as its own polity? (an enclosing country such as Italy around the Vatican doesn't count)
    if any(x.area < 3 * g.area and x.intersection(g).area > 0.5 * g.area for x in alive_geoms if x.intersects(g)):
        continue
    i = len(rows)
    rows.append({'name': 'NE:' + a3, 'from': int(y0), 'to': END_YEAR, 'qid': '', 'g': g})
    mutual[i] = a3

# split rows that straddle MODERN_FROM so that only the modern part gets the modern name
new_rows = []
for i, r in enumerate(rows):
    if i in mutual:
        if r['from'] < MODERN_FROM and not r['name'].startswith('NE:'):
            new_rows.append({**r, 'to': MODERN_FROM - 1})
            r = {**r, 'from': MODERN_FROM}
        r = {**r, 'ne': mutual[i]}
    new_rows.append(r)
rows = new_rows

# ---------------------------------------------------------------- 2d) automatic gap repair (see docs/查核方案.md)
# Land that a polity held the year before and that nobody holds now:
#  - from 1500: if the same polity holds it again within 2 years, it is a data blink -> keep it there;
#  - from 1946: modern borders don't simply vanish -> the previous holder keeps it until someone else does.
# Everything else stays empty and is listed by qa.py for manual research.
REPAIR_FROM, MODERN_REPAIR = 1500, 1946
by_year = defaultdict(list)
for r in rows:
    for yy in range(max(r['from'], REPAIR_FROM - 1), min(r['to'], END_YEAR) + 1):
        by_year[yy].append(r)
_union = {}
def cover(y):
    if y not in _union:
        _union[y] = unary_union([r['g'] for r in by_year[y]]).buffer(0)
    return _union[y]
def covered_frac(y, g):
    a = 0.0
    for r in by_year[y]:
        if r['g'].intersects(g):
            a += r['g'].intersection(g).area
            if a >= 0.5 * g.area: return 1.0
    return a / g.area
repairs = 0
years_changed = sorted({r['from'] for r in rows if r['from'] > REPAIR_FROM} | {r['to'] + 1 for r in rows if REPAIR_FROM < r['to'] < END_YEAR})
for y in years_changed:
    try:
        lost = cover(y - 1).difference(cover(y)).intersection(land)
    except Exception:
        continue
    for g in [g for g in getattr(lost, 'geoms', [lost]) if g.geom_type == 'Polygon' and g.area > 0.02]:
        cand = [r for r in by_year[y - 1] if r['g'].intersects(g)]
        if not cand: continue
        prev = max(cand, key=lambda r: r['g'].intersection(g).area)
        t = y
        while t <= END_YEAR and covered_frac(t, g) < 0.5 and t - y < 200:
            t += 1
        same_back = t <= END_YEAR and any(r['name'] == prev['name'] and r['g'].intersects(g) for r in by_year[t])
        if (same_back and t - y <= 2) or y >= MODERN_REPAIR:
            fill = {**prev, 'from': y, 'to': min(t - 1, END_YEAR), 'g': g, 'repaired': True}
            rows.append(fill)
            for yy in range(y, fill['to'] + 1):
                by_year[yy].append(fill); _union.pop(yy, None)
            repairs += 1
print('automatic gap repairs:', repairs, flush=True)

# ---------------------------------------------------------------- 2e) modern precedence (see docs/查核方案.md)
# From 1946, land that a modern sovereign state actually holds (its drawn shape, inside its own Natural Earth
# territory) cannot also belong to another polity in the same years. Cliopatria often keeps old empires
# drawn over their former colonies after independence (France over Algeria after 1962, Britain over Oman),
# which stays hidden under the new state's colour but breaks labels, clicks and areas. The other polity
# loses that land for those years. De-facto exceptions (occupations etc.) are made in geometry.tsv,
# which runs before this step: they change the modern state's drawn shape, so they are respected here.
ne_home_geom = defaultdict(list)
for p_, g_ in ne_shapes:
    ne_home_geom[home(p_['ADM0_A3'])].append(g_)
ne_home_geom = {k: unary_union(v).buffer(0) for k, v in ne_home_geom.items()}
def _bb(a, b):
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]
# rows renamed in names.tsv are not given a modern key ('ne'), but still are the modern state of their land
def _prec_a3(r):
    if r.get('ne'): return r['ne']
    if r['to'] < MODERN_FROM or r.get('unrecognized'): return None
    if r.get('qid') in qid_a3: return qid_a3[r['qid']]
    ra = r['g'].area
    for p_, g_ in ne_shapes:
        if not _bb(g_.bounds, r['g'].bounds): continue
        a_ = g_.intersection(r['g']).area
        if a_ >= 0.5 * ra and a_ >= 0.5 * g_.area and not claimed(home(p_['ADM0_A3']), r): return home(p_['ADM0_A3'])
    return None
for r in rows:
    r['pa3'] = _prec_a3(r)
modern = [r for r in rows if r['pa3'] and r['to'] >= MODERN_FROM]
prec = 0
for m in modern:
    try:
        own = m['g'].intersection(ne_home_geom[m['pa3']]).buffer(0)
    except Exception:
        continue
    if own.is_empty or own.area < 1e-4:
        continue
    ob = own.bounds
    out = []
    for o in rows:
        if (o is m or o['to'] < m['from'] or o['from'] > m['to'] or o.get('pa3') == m['pa3']
                or not _bb(o['g'].bounds, ob)):
            out.append(o); continue
        try:
            inter = o['g'].intersection(own)
        except Exception:
            out.append(o); continue
        if inter.is_empty or inter.area < 1e-4:
            out.append(o); continue
        a, b = max(o['from'], m['from']), min(o['to'], m['to'])
        if o['from'] < a: out.append({**o, 'to': a - 1})
        rest = o['g'].difference(own).buffer(0)
        if not rest.is_empty and rest.area > 1e-5:
            out.append({**o, 'from': a, 'to': b, 'g': rest})
        if o['to'] > b: out.append({**o, 'from': b + 1})
        prec += 1
    rows[:] = out
print('modern precedence fixes:', prec, flush=True)

def ne_names(p):
    w = wd.get(p.get('WIKIDATAID'), {})
    return {'en': p['NAME_EN'],
            'zh-Hant': w.get('zh-Hant') or p['NAME_ZHT'],   # Wikidata zh-tw first (Taiwan usage)
            'zh-Hans': w.get('zh-Hans') or p['NAME_ZH'],
            'ja': w.get('ja') or p['NAME_JA']}

polities = {}       # key -> record
# a name that changes within a Cliopatria row (names.tsv with several year ranges) splits the row there
for nm, lst in overrides.items():
    for o in lst[1:]:
        if o['from'] > -99999:
            split_rows(nm, o['from'], lambda r: r)

def polity_key(r):
    for i, o in enumerate(overrides.get(r['name'], [])):
        if o['from'] <= r['from'] <= o['to']:
            return (f"{r['name']}#{i}" if len(overrides[r['name']]) > 1 else r['name']), o
    if r.get('ne'):
        return 'NE:' + r['ne'], None
    return r['name'], None

for r in rows:
    key, o = polity_key(r)
    r['key'] = key
    if key in polities:
        continue
    rec = {'qid': r['qid']}
    if o:
        rec.update({k: o[k] for k in ('en', 'zh-Hant', 'zh-Hans', 'ja')})
        if o['alt']:
            rec['alt'] = o['alt']
        rec['src'] = 'override'
    elif key.startswith('NE:'):
        p = ne_by_a3[r['ne']]
        rec.update(ne_names(p))
        rec['qid'] = p.get('WIKIDATAID', '')
        rec['src'] = 'naturalearth+wikidata'
    else:
        w = wd.get(r['qid'], {})
        rec['en'] = r['name']
        rec['zh-Hant'] = w.get('zh-Hant') or ''
        rec['zh-Hans'] = w.get('zh-Hans') or ''
        rec['ja'] = w.get('ja') or ''
        rec['src'] = 'wikidata' if w else 'cliopatria'
        if w.get('review'):
            rec['review'] = True
    if r.get('unrecognized'):
        rec['unrecognized'] = True
    polities[key] = rec

# hand names for the two entities created above
polities["Donetsk People's Republic"].update({'en': "Donetsk People's Republic", 'zh-Hant': '頓涅茨克人民共和國',
    'zh-Hans': '顿涅茨克人民共和国', 'ja': 'ドネツク人民共和国', 'src': 'override'})
polities["Luhansk People's Republic"].update({'en': "Luhansk People's Republic", 'zh-Hant': '盧甘斯克人民共和國',
    'zh-Hans': '卢甘斯克人民共和国', 'ja': 'ルハンスク人民共和国', 'src': 'override'})

for nm in ('Abkhazia', 'Somaliland', 'Artsakh'):
    q = disp_by_name[nm]['properties']
    polities[nm].update({'en': q['NAME_EN'] or nm, 'zh-Hant': wd.get(q.get('WIKIDATAID'), {}).get('zh-Hant') or q['NAME_ZHT'],
                         'zh-Hans': wd.get(q.get('WIKIDATAID'), {}).get('zh-Hans') or q['NAME_ZH'], 'ja': q['NAME_JA'], 'src': 'naturalearth'})
polities['Artsakh'].update({'zh-Hant': '阿爾札赫共和國', 'zh-Hans': '阿尔扎赫共和国', 'ja': 'アルツァフ共和国'})

# polity life span (first/last year drawn)
for r in rows:
    rec = polities[r['key']]
    rec['y0'] = min(rec.get('y0', 99999), r['from'])
    rec['y1'] = max(rec.get('y1', -99999), r['to'])

# ---------------------------------------------------------------- religion mode (overrides/religion*.tsv + rules)
def read_rel():
    out = defaultdict(list)
    for line in open(os.path.join(HERE, 'overrides', 'religion.tsv'), encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        k, a, b, code = (line.rstrip('\n').split('\t') + ['', '', ''])[:4]
        out[k].append([int(a) if a else -99999, int(b) if b else 99999, code])
    return out
REL = read_rel()
REL_CODES = [l.split('\t')[0] for l in open(os.path.join(HERE, 'overrides', 'religions.tsv'), encoding='utf-8') if l.strip() and not l.startswith('#')]
REL_MODERN = {}
for line in open(os.path.join(HERE, 'overrides', 'religion_modern.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        a3, code = line.split()[:2]
        REL_MODERN[a3] = code
for codes in REL.values():
    for _, _, c in codes:
        assert c in REL_CODES, 'unknown religion code ' + c

lp_of = {}
for r in rows:
    if r['key'] not in lp_of:
        lp_of[r['key']] = r['g'].representative_point()

def infer_religion(name, y0, pt):
    lon, lat = pt.x, pt.y
    if re.search(r'Imamate', name) and 40 < lon < 50 and lat < 20: return 'shia'
    if re.search(r'Sultanate|Emirate|Caliphate|Beylik|Nawab|Sharifate|Sheikhdom|Sultan', name): return 'sunni'
    if re.search(r'Khanate|Horde|Ulus', name):
        if lon >= 85 and y0 >= 1578: return 'vajra'
        return 'sunni' if y0 >= 1330 and lon < 100 else 'tengri'
    if lon < -30:                                                   # the Americas
        if y0 < 1500:
            if 8 <= lat <= 25 and lon < -85: return 'meso'
            if lat < 2 and -82 < lon < -60: return 'andes'
            return 'trad'
        return 'prot' if lat > 30 and y0 >= 1600 else 'cath'
    if -11 <= lon <= 40 and 35 <= lat <= 71:                        # Europe
        if y0 < 300: return 'greco' if lat < 46 else 'pagan_eu'
        east = (lon >= 22 and lat < 52) or lon >= 27
        if east: return 'orth' if y0 >= 900 else 'pagan_eu'
        if y0 >= 1530 and (lat > 53.5 or (lat > 50.5 and lon > 8)): return 'prot'
        if y0 >= 1000: return 'cath'
        return 'cath' if lat < 54 else 'pagan_eu'
    if -18 <= lon <= 62 and 12 <= lat <= 42:                        # Middle East & North Africa
        if y0 >= 640:
            return 'shia' if 44 <= lon <= 62 and lat > 25 and y0 >= 1501 else 'sunni'
        if y0 < -330: return 'egypt' if 25 <= lon <= 35 and lat < 31.5 else 'neareast'
        return 'greco' if lon < 45 else 'zoro'
    if 50 <= lon <= 90 and 35 <= lat <= 56: return 'sunni' if y0 >= 900 else 'tengri'
    if 60 <= lon <= 92 and 5 <= lat <= 36:                          # South Asia
        if y0 >= 1200 and re.search(r'Sultan|Nawab|Shah|Mughal', name): return 'sunni'
        return 'hindu'
    if 92 <= lon <= 110 and 8 <= lat <= 28: return 'thera' if y0 >= 1100 else 'hindu'
    if 95 <= lon <= 130 and -11 <= lat <= 8:
        if lon > 120 and lat > 5 and y0 >= 1570: return 'cath'
        return 'sunni' if y0 >= 1400 else 'hindu'
    if 124 <= lon <= 131 and 33 <= lat <= 43: return 'maha' if y0 < 1392 else 'confu'
    if lon > 129 and 30 <= lat <= 46: return 'shinto'
    if 100 <= lon <= 135 and 18 <= lat <= 42: return 'confu'
    if lat > 40 and 50 <= lon <= 135: return 'vajra' if y0 >= 1578 and lon > 85 else 'tengri'
    if lat < 12 and -20 <= lon <= 52:
        return 'sunni' if 8 <= lat <= 18 and y0 >= 1100 else 'trad_af'
    if lon > 110 and lat < -10: return 'prot' if y0 >= 1850 else 'trad'
    return None

n_rel = n_inf = 0
for k, rec in polities.items():
    base = k.split('#')[0]
    y0 = rec.get('y0', 0)
    spans = [s for s in REL.get(base, []) if s[0] <= rec.get('y1', 99999) and s[1] >= y0]
    if spans:
        rec['rel'] = spans; n_rel += 1; continue
    if base.startswith('NE:') and base[3:] in REL_MODERN:
        rec['rel'] = [[-99999, 99999, REL_MODERN[base[3:]]]]; n_rel += 1; continue
    code = infer_religion(base, y0, lp_of.get(k, Point(0, 0))) if k in lp_of else None
    if code:
        rec['rel'] = [[-99999, 99999, code]]; rec['relInferred'] = True; n_inf += 1
print('religion: assigned', n_rel, 'inferred', n_inf, 'unknown', len(polities) - n_rel - n_inf)

# Drawn, but not counted as countries: self-declared states recognised by at most one UN member
UNCOUNTED = {'Turkish Republic of Northern Cyprus', "Donetsk People's Republic", "Luhansk People's Republic",
             'Abkhazia', 'Somaliland', 'Artsakh'}
for k, rec in polities.items():
    if k.split('#')[0] in UNCOUNTED:
        rec['unrecognized'] = True; rec['nonstate'] = True

# Polities that are drawn but not counted as countries (armed movements, occupation zones, party-controlled areas)
NON_STATE = {'Netherlands Antilles', 'British Overseas Territories', 'Cuban Nationalists', 'Italian Nationalists', 'Maderistas',
             'Mexican Monarchists', 'Nalyvaiko Uprising', 'Polish Armed Forces', 'Spanish Nationalists', 'Huguenots', 'Kharijites',
             'Poles', 'Mujahideen', 'Gaza/Hamas', 'Chinese Communists', 'Communist Party of China', 'Anti-Kuomintang Coalition',
             'Yugoslav Partisans', 'Taliban', 'Russian-occupied territories', 'Khmer Rouge', 'Li Zicheng',
             "Donetsk People's Republic", "Luhansk People's Republic", 'Panthay Rebellion', 'Cao Cao'}
for k, rec in polities.items():
    if k.split('#')[0] in NON_STATE:
        rec['nonstate'] = True

# ---------------------------------------------------------------- 4) colors (stable per polity, video-like saturated palette)
def color_for(key):
    h = int(hashlib.md5(key.split('#')[0].encode()).hexdigest()[:8], 16)
    hue = (h % 360) / 360
    sat = 0.55 + ((h >> 9) % 30) / 100
    lig = 0.50 + ((h >> 15) % 16) / 100
    r_, g_, b_ = colorsys.hls_to_rgb(hue, lig, sat)
    return '#%02x%02x%02x' % (int(r_ * 255), int(g_ * 255), int(b_ * 255))

FIXED = {'Republic of China': '#2f6fd6', "People's Republic of China": '#e0453a', 'NE:RUS': '#b04a5a',
         'NE:UKR': '#f2c230', 'Qing Dynasty': '#f0d43a', 'Ming Dynasty': '#4fd65a'}
ids = {}
for i, (k, rec) in enumerate(sorted(polities.items())):
    rec['color'] = FIXED.get(k.split('#')[0], color_for(k))
    ids[k] = i
    rec['id'] = i

# ---------------------------------------------------------------- 5) chunks
EDGES = [-3400, -2000, -1000, -500, 0, 300, 600, 900, 1100, 1300, 1450, 1550, 1650, 1750, 1800, 1850,
         1880, 1910, 1930, 1950, 1970, 1990, 2010, END_YEAR + 1]
chunks = []
for a, b in zip(EDGES[:-1], EDGES[1:]):
    feats = []
    for r in rows:
        if r['from'] <= b - 1 and r['to'] >= a:
            feats.append({'type': 'Feature', 'properties': {'p': ids[r['key']], 'a': max(r['from'], a), 'b': min(r['to'], b - 1)},
                          'geometry': mapping(r['g'])})
    cid = f'{a}_{b - 1}'
    with open(os.path.join(OUT, 'chunks', cid + '.geojson'), 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f)
    chunks.append({'id': cid, 'from': a, 'to': b - 1, 'n': len(feats)})
    print('chunk', cid, len(feats), flush=True)

# ---------------------------------------------------------------- 6) counts per year
counts = []
for y in range(EDGES[0], END_YEAR + 1):
    alive = {r['key'] for r in rows if r['from'] <= y <= r['to'] and not polities[r['key']].get('nonstate')}
    counts.append(len(alive))

# ---------------------------------------------------------------- 7) disputed areas & points of view
DISPUTE_YEARS = {  # NE BRK_NAME -> (from, to, note key)
    'Arunachal Pradesh': (1951, END_YEAR), 'Tirpani Valleys': (1951, END_YEAR), 'Bara Hotii Valleys': (1951, END_YEAR),
    'Demchok': (1951, END_YEAR), 'Samdu Valleys': (1951, END_YEAR), 'Jammu and Kashmir': (1947, END_YEAR),
    'Shaksam Valley': (1963, END_YEAR), 'Aksai Chin': (1957, END_YEAR), 'Gilgit-Baltistan': (1947, END_YEAR),
    'Abyei': (2011, END_YEAR), 'Lawa Headwaters': (1975, END_YEAR), 'Courantyne Headwaters': (1975, END_YEAR),
    'Golan Heights': (1967, END_YEAR), 'Ilemi Triangle': (1956, END_YEAR), 'W. Sahara': (1976, END_YEAR),
    'N. Cyprus': (1974, END_YEAR), 'Kuril Is.': (1945, END_YEAR), 'Somaliland': (1991, END_YEAR),
    'Abkhazia': (1993, END_YEAR), 'Transnistria': (1992, END_YEAR), 'South Ossetia': (1992, END_YEAR),
    'Artsakh': (1991, 2023), 'Siachen Glacier': (1984, END_YEAR), 'Crimea': (2014, END_YEAR),
    "Donetsk People's Republic": (2014, END_YEAR), 'Junagadh and Manavadar': (1948, END_YEAR),
    "Luhansk People's Republic": (2014, END_YEAR),
}
POVS = ['iso', 'twn', 'chn', 'jpn', 'kor', 'usa', 'ukr', 'rus', 'ind', 'pak', 'tur']

# ADM0_A3 -> polity key alive in 2026, via the same overlap match
alive_end = {r['key'] for r in rows if r['to'] >= END_YEAR}
a3_to_key = {a3: 'NE:' + home(a3) for a3 in ne_by_a3 if 'NE:' + home(a3) in alive_end}
a3_to_key.update({'TWN': 'Republic of China', 'CHN': "People's Republic of China", 'JPN': 'Japan',
                  'KOR': 'Republic of Korea', 'PRK': "Democratic People's Republic of Korea", 'MNG': 'Mongolia'})

areas = []
for f in ne_disputed:
    p = f['properties']
    if p['BRK_NAME'] not in DISPUTE_YEARS:
        continue
    a, b = DISPUTE_YEARS[p['BRK_NAME']]
    areas.append({'name': p['BRK_NAME'], 'from': a, 'to': b, 'note': p['NOTE_BRK'],
                  'names': {'en': p['NAME_EN'] or p['BRK_NAME'], 'zh-Hant': p['NAME_ZHT'], 'zh-Hans': p['NAME_ZH'], 'ja': p['NAME_JA']},
                  'g': geom(f['geometry'])})
# Taiwan is not listed: the ROC's control there is de facto, and the map shows de-facto control.

for pov in POVS:
    path = os.path.join(NE, f'ne_10m_admin_0_countries_{pov}.geojson')
    feats = [(fe['properties'], geom(fe['geometry'])) for fe in load(path)['features']]
    for ar in areas:
        pt = ar['g'].representative_point()
        owner = None
        for p, g in feats:
            if g.contains(pt):
                owner = p['ADM0_A3']; break
        ar.setdefault('pov', {})[pov] = a3_to_key.get(owner, None) if owner else None
        ar.setdefault('pov_a3', {})[pov] = owner
    print('pov', pov, 'done', flush=True)

disputed = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'geometry': mapping(ar['g']),
     'properties': {'name': ar['name'], 'a': ar['from'], 'b': ar['to'], 'note': ar['note'],
                    'names': ar['names'],
                    'pov': {k: (ids.get(v) if v else None) for k, v in ar['pov'].items()},
                    'pov_a3': ar['pov_a3']}} for ar in areas]}
with open(os.path.join(OUT, 'disputed.geojson'), 'w') as f:
    json.dump(disputed, f, ensure_ascii=False)

# ---------------------------------------------------------------- 7b) extent, predecessors, successors (info panel)
# Largest extent: the year in which a polity's pieces covered most land (planar degrees × cos(latitude),
# good enough for a "about N km²" figure). Predecessors / successors: the polities that held most of a
# polity's territory the year before it first appears / the year after it last appears.
from shapely.strtree import STRtree
import math
from shapely.ops import transform as _transform
def _eqarea(x, y, z=None):          # Lambert cylindrical equal-area, km
    R = 6371.0
    import numpy as _np
    return _np.radians(_np.asarray(x)) * R, _np.sin(_np.radians(_np.clip(_np.asarray(y), -90, 90))) * R
for r in rows:
    try: r['km2'] = _transform(_eqarea, r['g']).area
    except Exception: r['km2'] = 0.0
by_key = defaultdict(list)
for r in rows: by_key[r['key']].append(r)
tree = STRtree([r['g'] for r in rows])
def holders(geom, year, exclude):
    tot = defaultdict(float)
    for i in tree.query(geom):
        o = rows[int(i)]
        if o['key'] == exclude or not (o['from'] <= year <= o['to']): continue
        try: a = o['g'].intersection(geom).area
        except Exception: continue
        if a > 0: tot[o['key']] += a
    ga = geom.area or 1e-9
    return [k for k, a in sorted(tot.items(), key=lambda kv: -kv[1]) if a > 0.12 * ga][:3]
for k, rs in by_key.items():
    rec = polities[k]
    years = sorted({r['from'] for r in rs})
    best = max(years, key=lambda y: sum(r['km2'] for r in rs if r['from'] <= y <= r['to']))
    rec['peak'] = [round(sum(r['km2'] for r in rs if r['from'] <= best <= r['to']), -2), best]
    if rec['y0'] > EDGES[0]:
        g0 = unary_union([r['g'] for r in rs if r['from'] == rec['y0']])
        rec['pred'] = holders(g0, rec['y0'] - 1, k)
    if rec['y1'] < END_YEAR:
        g1 = unary_union([r['g'] for r in rs if r['to'] == rec['y1']])
        rec['succ'] = holders(g1, rec['y1'] + 1, k)
print('extents / predecessors done', flush=True)

# ---------------------------------------------------------------- 8) write tables
plist = [None] * len(polities)
for k, rec in polities.items():
    rec = dict(rec); rec['key'] = k
    rec['pred'] = [ids[x] for x in rec.get('pred', [])]
    rec['succ'] = [ids[x] for x in rec.get('succ', [])]
    plist[rec.pop('id')] = rec
with open(os.path.join(OUT, 'polities.json'), 'w', encoding='utf-8') as f:
    json.dump(plist, f, ensure_ascii=False)
with open(os.path.join(OUT, 'meta.json'), 'w') as f:
    json.dump({'from': EDGES[0], 'to': END_YEAR, 'chunks': chunks, 'counts': counts, 'povs': POVS}, f)

# review report
need = [p for p in plist if not p['zh-Hant'] or p.get('review')]
with open(os.path.join(OUT, 'names_review.tsv'), 'w', encoding='utf-8') as f:
    f.write('key\tqid\ten\tzh-Hant\tzh-Hans\tja\tsrc\n')
    for p in need:
        f.write('\t'.join(str(p.get(k, '')) for k in ('key', 'qid', 'en', 'zh-Hant', 'zh-Hans', 'ja', 'src')) + '\n')
print('polities', len(plist), 'need review', len(need))
print('count 2026:', counts[-1], 'count 1500:', counts[1500 - EDGES[0]], 'count -1000:', counts[-1000 - EDGES[0]])
