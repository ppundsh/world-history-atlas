#!/usr/bin/env python3
"""
Automatic checks of the built map data (run after build.py; part of build-all.sh).

For a grid of land sample points (every 0.5°) and every year it finds:
  1. blinks      – land covered the year before and the year after, but not this year
  2. new gaps    – land that was covered and becomes uncovered (from 1500 on), with who held it before
  3. overlaps    – land claimed by two sovereign polities at once (from 1946 on)
  4. polity gaps – a polity that disappears and comes back within 20 years
Writes data-pipeline/qa_report.md. With --strict, exits with status 1 when blinks or new gaps (from 1500) exist,
so a data change that opens a hole cannot be published unnoticed.

  python3 data-pipeline/qa.py NE_GEOJSON_DIR [--strict]
"""
import json, os, sys, glob
from collections import defaultdict
import numpy as np
from shapely.geometry import shape
from shapely import points, STRtree, prepare
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
NE = sys.argv[1]
STRICT = '--strict' in sys.argv
BUILD = os.path.join(HERE, 'build')

meta = json.load(open(os.path.join(BUILD, 'meta.json')))
pol = json.load(open(os.path.join(BUILD, 'polities.json'), encoding='utf-8'))
name = lambda i: (pol[i].get('zh-Hant') or pol[i].get('en') or pol[i]['key'])
nonstate = lambda i: pol[i].get('nonstate')

rows = []
seen = set()
for fn in sorted(glob.glob(os.path.join(BUILD, 'chunks', '*.geojson'))):
    for f in json.load(open(fn))['features']:
        p = f['properties']
        k = (p['p'], p['a'], p['b'], round(shape(f['geometry']).area, 6))
        if k in seen: continue
        seen.add(k)
        rows.append((p['p'], p['a'], p['b'], shape(f['geometry'])))
print(len(rows), 'rows', flush=True)

# land sample points (0.5° grid, inside Natural Earth land, outside Antarctica)
land = unary_union([shape(f['geometry']) for f in json.load(open(os.path.join(NE, 'ne_50m_land.geojson')))['features']])
prepare(land)
xs, ys = np.meshgrid(np.arange(-179.75, 180, 0.5), np.arange(-55.75, 84, 0.5))
pts = points(xs.ravel(), ys.ravel())
from shapely import contains
inside = contains(land, pts)
pts = pts[inside]; lon = xs.ravel()[inside]; lat = ys.ravel()[inside]
print(len(pts), 'land points', flush=True)

geoms = [r[3] for r in rows]
tree = STRtree(geoms)
pi, gi = tree.query(pts, predicate='within')          # every (point, row) containment
by_row = defaultdict(list)
for a, b in zip(pi, gi): by_row[b].append(a)

y0, y1 = meta['from'], meta['to']
years = list(range(max(y0, -3000), y1 + 1))
cover = {}                                           # year -> owner array (-1 none), and overlap flags
pair_years = defaultdict(dict)                       # (polity a, polity b) -> {year: point indexes} (from 1946)
for y in years:
    own = np.full(len(pts), -1, dtype=np.int32)
    sown = np.full(len(pts), -1, dtype=np.int32)    # sovereign owner only
    dup = np.zeros(len(pts), dtype=bool)
    for ri, (p, a, b, g) in enumerate(rows):
        if a <= y <= b and ri in by_row:
            idx = np.asarray(by_row[ri])
            if not nonstate(p):
                clash = idx[(sown[idx] >= 0) & (sown[idx] != p)]
                dup[clash] = True
                if y >= 1946 and len(clash):
                    for o in np.unique(sown[clash]):
                        k = tuple(sorted((int(o), int(p))))
                        pair_years[k][y] = pair_years[k].get(y, 0) + int((sown[clash] == o).sum())
                sown[idx] = p
            own[idx] = p
    cover[y] = (own, dup)

def where(mask):
    """summarise a set of points: count and bounding box"""
    if not mask.any(): return ''
    return f"{int(mask.sum())} 點，約 {lon[mask].min():.1f}–{lon[mask].max():.1f}°E, {lat[mask].min():.1f}–{lat[mask].max():.1f}°N"

blinks, gaps, overlaps = [], [], []
for y in years[1:-1]:
    prev, cur, nxt = cover[y - 1][0], cover[y][0], cover[y + 1][0]
    m = (prev >= 0) & (cur < 0) & (nxt >= 0)
    if m.sum() >= 3:
        blinks.append((y, where(m), sorted({name(int(o)) for o in prev[m]})[:5]))
    if y >= 1500:
        g = (prev >= 0) & (cur < 0) & ~m
        if g.sum() >= 4:
            gaps.append((y, where(g), sorted({name(int(o)) for o in prev[g]})[:5]))
    if y >= 1946 and cover[y][1].sum() >= 4:
        overlaps.append((y, where(cover[y][1])))

# overlapping pairs, with their year runs
pairs = []
for (a, b), ys in pair_years.items():
    yy = sorted(ys)
    runs, st = [], yy[0]
    for u, v in zip(yy, yy[1:] + [None]):
        if v != u + 1: runs.append(f'{st}–{u}' if u != st else str(st)); st = v
    pairs.append((max(ys.values()), name(a), name(b), '、'.join(runs)))
pairs.sort(reverse=True)

alive = defaultdict(set)
for p, a, b, g in rows:
    for y in range(max(a, years[0]), b + 1): alive[p].add(y)
pgaps = []
for p, ys in alive.items():
    s = sorted(ys)
    for a, b in zip(s, s[1:]):
        if 1 < b - a <= 20:
            pgaps.append((name(p), a + 1, b - 1))

with open(os.path.join(HERE, 'qa_report.md'), 'w', encoding='utf-8') as f:
    f.write('# 地圖資料自動檢查報告\n\n由 `data-pipeline/qa.py` 產生。修正方式見 `docs/查核方案.md`。\n\n')
    f.write(f'- 檢查點：{len(pts)} 個陸地取樣點（0.5° 格網）× {len(years)} 年\n')
    f.write(f'- 閃爍空白（前後一年都有政權、當年沒有）：{len(blinks)} 筆\n- 1500 年後新出現的空白：{len(gaps)} 筆\n')
    f.write(f'- 1946 年後兩個主權政權重疊：{len(overlaps)} 年\n- 政權中斷 20 年內又出現：{len(pgaps)} 筆\n\n')
    f.write('## 1. 閃爍空白\n\n| 年 | 範圍 | 前一年的政權 |\n|---|---|---|\n')
    for y, w, n in blinks: f.write(f'| {y} | {w} | {"、".join(n)} |\n')
    f.write('\n## 2. 1500 年後新出現的空白\n\n| 年 | 範圍 | 前一年的政權 |\n|---|---|---|\n')
    for y, w, n in gaps: f.write(f'| {y} | {w} | {"、".join(n)} |\n')
    f.write('\n## 3. 主權政權重疊（1946 年後）\n\n| 年 | 範圍 |\n|---|---|\n')
    for y, w in overlaps: f.write(f'| {y} | {w} |\n')
    f.write('\n### 重疊的政權（依最多重疊點排序）\n\n| 政權 A | 政權 B | 最多點數 | 年份 |\n|---|---|---|---|\n')
    for n, a, b, r in pairs: f.write(f'| {a} | {b} | {n} | {r} |\n')
    f.write('\n## 4. 政權中斷後又出現\n\n| 政權 | 中斷 |\n|---|---|\n')
    for n, a, b in sorted(pgaps): f.write(f'| {n} | {a}–{b} |\n')
print(f'QA: blinks {len(blinks)}, new gaps {len(gaps)}, overlap years {len(overlaps)} ({len(pairs)} pairs), polity gaps {len(pgaps)}')
for n, a, b, r in pairs[:40]: print(f'  {n:5d}  {a} × {b}  {r}')
if STRICT and (blinks or gaps):
    sys.exit(1)
