#!/usr/bin/env python3
"""
Give a regional mode its real first-level divisions (states, provinces, governorates …).

Older modes were built on coarse units (several provinces merged), so their administrative layer could only
show approximate groups. This tool:
  1. replaces every unit lying mostly inside the country by the Natural Earth 1:10m admin-1 regions it contains
     (unit id = prefix + ISO 3166-2 suffix); the old unit id becomes an alias in region.json "groups", so the
     control / admin / local tables that name it still work. Any part of an old unit not covered by admin-1
     regions is kept as "<old>_rest";
  2. writes the modern divisions (names from Natural Earth: Chinese, English, Japanese) and their history to
     divisions.tsv / admin.tsv, replacing the old approximate modern layer (rows whose division id starts with
     one of spec.drop).

spec (JSON):
  { "iso": "MEX", "prefix": "mx_", "drop": ["s_"], "suffix_zh": "州", "header": "…",
    "phases": [ { "at": "1824-10",                       # simple phase: every admin-1 region its own division
                  "created": { "AGU": ["1857-02", "ZAC"] } },   # created later; before that it follows its parent
                { "at": "2025-07", "merge": [ ["id", "zh", "en", "ja", ["CODE", …]] ] }   # merged divisions
              ] }
  python3 admin1.py <region> <spec.json> <NE dir>
Run once per mode; units.py then calls Units.admin1() so later rebuilds give the same units.
"""
import sys, os, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); DP = os.path.dirname(HERE)
sys.path.insert(0, DP)
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

region, specf, NE = sys.argv[1:4]
S = json.load(open(specf, encoding='utf-8'))
RD = os.path.join(DP, region)
A1 = {}
for f in json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']:
    p = f['properties']
    if p['adm0_a3'] != S['iso']: continue
    code = p['iso_3166_2'].split('-')[-1]
    if '~' in code: continue
    g = shape(f['geometry']).buffer(0)
    if code in A1: A1[code]['g'] = unary_union([A1[code]['g'], g]); continue
    A1[code] = {'g': g, 'zh': p.get('name_zh') or p.get('name_zht') or p['name'], 'en': p.get('name_en') or p['name'], 'ja': p.get('name_ja') or p['name']}
for code, (zh, en, ja) in S.get('names', {}).items(): A1[code].update(zh=zh, en=en, ja=ja)
country = unary_union([v['g'] for v in A1.values()])

# ---- 1. units
upath = os.path.join(DP, 'build', region + '_units.geojson')
old = {f['properties']['id']: shape(f['geometry']).buffer(0) for f in json.load(open(upath, encoding='utf-8'))['features']}
pre = S['prefix']
if any(k.startswith(pre) for k in old): sys.exit(f'{region}: units already split (ids start with {pre})')
inside = {k: g for k, g in old.items() if g.area > 0 and g.intersection(country).area / g.area > 0.5}
groups, units = {}, {k: g for k, g in old.items() if k not in inside}
for code, v in A1.items():
    pt = v['g'].representative_point()
    owner = next((k for k, g in inside.items() if g.contains(pt)), None)
    if owner is None:   # nearest / largest overlap
        owner = max(inside, key=lambda k: inside[k].intersection(v['g']).area) if inside else None
    units[pre + code.lower()] = v['g']
    if owner: groups.setdefault(owner, []).append(pre + code.lower())
for k, g in inside.items():
    rest = g.difference(country)
    if rest.area > 0.03 * g.area:
        units[k + '_rest'] = rest; groups.setdefault(k, []).append(k + '_rest')
    if k not in groups:   # an old unit with no region of its own: give it the region it overlaps most
        best = max(A1, key=lambda c: A1[c]['g'].intersection(g).area)
        groups[k] = [pre + best.lower()]
json.dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g)} for k, g in units.items()]},
          open(upath, 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(groups, open(os.path.join(RD, 'admin1_groups.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
R = json.load(open(os.path.join(RD, 'region.json'), encoding='utf-8'))
R.setdefault('groups', {}).update(groups)
json.dump(R, open(os.path.join(RD, 'region.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(region, len(A1), 'admin-1 regions;', len(inside), 'old units replaced:', ' '.join(f'{k}→{len(v)}' for k, v in groups.items()))

# ---- 2. divisions and admin history
cc = lambda s: subprocess.run(['node', '-e', "const O=require('opencc-js');const c=O.Converter({from:'cn',to:'tw'});const h=O.Converter({from:'tw',to:'cn'});const s=require('fs').readFileSync(0,'utf8');const a=JSON.parse(s);console.log(JSON.stringify(a.map(x=>[c(x),h(c(x))])))"],
                               input=json.dumps(s), capture_output=True, text=True, cwd=os.path.dirname(DP)).stdout
names = json.loads(cc([v['zh'] for v in A1.values()]))
for (code, v), (hant, hans) in zip(A1.items(), names): v['hant'], v['hans'] = hant, hans
PAL = ['#e9c46a', '#f4a261', '#e76f51', '#8ab17d', '#2a9d8f', '#6fb3c7', '#b5a7d8', '#d8a7b1', '#c9b79c', '#f6b98a', '#a594cf', '#cc94a0', '#d6c8b0', '#8cc5d6', '#a3c4a8', '#e3c9a8']
dl = open(os.path.join(RD, 'divisions.tsv'), encoding='utf-8').read().split('\n')
drop = tuple(S.get('drop', []))
keep = [l for l in dl if l.strip() and (l.startswith('#') or not l.split('\t')[0].startswith(drop))]
divs, seen = [], set()
def div(i, hant, hans, en, ja):
    if i in seen: return
    seen.add(i); divs.append([i, PAL[(len(divs) * 5) % 16], hant, hans, en, ja])
dv = S.get('div_prefix', 'a_')
admin = []
for ph in S['phases']:
    at = ph['at']
    if 'merge' in ph:
        cover = set()
        for i, hant, en, ja, members in ph['merge']:
            hans = json.loads(cc([hant]))[0][1]
            div(i, hant, hans, en, ja)
            for m in members: admin.append([at, pre + m.lower(), i]); cover.add(m)
        for code, v in A1.items():   # regions not named in a merge keep their own division
            if code not in cover:
                div(dv + code.lower(), v['hant'], v['hans'], v['en'], v['ja']); admin.append([at, pre + code.lower(), dv + code.lower()])
        continue
    created = ph.get('created', {})
    for code, v in A1.items():
        div(dv + code.lower(), v['hant'], v['hans'], v['en'], v['ja'])
    def owner(code, when):   # the division a region belongs to at a date (follows parents until created)
        c = code
        while c in created and created[c][0] > when: c = created[c][1]
        return 'none' if c == '-' else dv + c.lower()
    for code in A1:
        admin.append([at, pre + code.lower(), owner(code, at)])
        if code in created and created[code][0] > at:
            # each later step: when this region or one of its ancestors is created
            c = code
            while c in created and created[c][0] > at:
                admin.append([created[c][0], pre + code.lower(), owner(code, created[c][0])]); c = created[c][1]
al = open(os.path.join(RD, 'admin.tsv'), encoding='utf-8').read().split('\n')
hdr = [l for l in al if l.startswith('#')]
oldrows = [l.split('\t') for l in al if l.strip() and not l.startswith('#') and not l.split('\t')[2].startswith(drop)]
if S.get('header'): hdr = hdr[:1] + ['# ' + S['header']]
rows = sorted(oldrows + admin, key=lambda r: (int(r[0].split('-')[0]) if not r[0].startswith('-') else -int(r[0].split('-')[1]), r[0]))
rows = sorted(oldrows + admin, key=lambda r: (int(r[0][:r[0].rfind('-')]), int(r[0][r[0].rfind('-') + 1:])))
open(os.path.join(RD, 'admin.tsv'), 'w', encoding='utf-8').write('\n'.join(hdr + ['\t'.join(r) for r in rows]) + '\n')
open(os.path.join(RD, 'divisions.tsv'), 'w', encoding='utf-8').write('\n'.join(keep + ['\t'.join(d) for d in divs]) + '\n')
print(len(divs), 'divisions;', len(admin), 'admin rows')
