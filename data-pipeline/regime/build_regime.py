"""Regime-type mode data from V-Dem (Varieties of Democracy), CC BY-SA 4.0.
  python3 data-pipeline/regime/build_regime.py path/to/vdem.RData path/to/natural-earth-vector/geojson
(vdem.RData: https://github.com/vdeminstitute/vdemdata, data/vdem.RData; or the V-Dem country-year CSV)
writes public/data/regimes.json:
  { countries: [{ id, n, p: [lon, lat] capital, runs: [[from, to, code], …] }], source }
code "R|H|S":
  R  regime: 0 closed autocracy, 1 electoral autocracy, 2 electoral democracy, 3 liberal democracy
     (V-Dem "Regimes of the World", v2x_regime, 1900–; before 1900 the same rules are applied to
     V-Dem's indicators here and the result is marked approximate with a trailing "~")
  H  head of state: 0 not a monarch, 1 monarch without real power (constitutional / ceremonial),
     2 ruling monarch   (hereditary or royal-council succession; ruling = HoS is also HoG or has ≥ half
     the executive power, v2exhoshog / v2ex_hosw)
  S  who runs an autocracy: p one party, m military, '' other / not applicable
"""
import json, sys, os, math
import pandas as pd

src, NE = sys.argv[1], sys.argv[2]
COLS = ['country_name', 'country_text_id', 'year', 'v2x_regime', 'v2x_polyarchy', 'v2x_liberal', 'v2elmulpar_osp', 'v2elfrfair_osp',
        'v2cltrnslw_osp', 'v2clacjstm_osp', 'v2clacjstw_osp', 'v2expathhs', 'v2exhoshog', 'v2ex_hosw', 'v2x_ex_hereditary',
        'v2x_ex_party', 'v2x_ex_military', 'v2x_elecreg']
if src.endswith('.RData'):
    import pyreadr
    df = next(iter(pyreadr.read_r(src).values()))
else:
    df = pd.read_csv(src, usecols=lambda c: c in COLS)
df = df[[c for c in COLS if c in df.columns]]

def nz(v): return v is not None and not (isinstance(v, float) and math.isnan(v))

def regime(r):
    if nz(r.v2x_regime): return int(r.v2x_regime), ''
    # pre-1900: Regimes-of-the-World rules on the underlying indicators (approximate)
    if not nz(r.v2x_polyarchy): return None, ''
    mul, fair = r.v2elmulpar_osp, r.v2elfrfair_osp
    if not nz(mul) or mul < 2 or (nz(r.v2x_elecreg) and r.v2x_elecreg < 0.5): return 0, '~'
    if r.v2x_polyarchy <= 0.5 or not nz(fair) or fair <= 2 or mul <= 2: return 1, '~'
    lib = nz(r.v2x_liberal) and r.v2x_liberal > 0.8 and all(nz(x) and x > 3 for x in (r.v2cltrnslw_osp, r.v2clacjstm_osp, r.v2clacjstw_osp))
    return (3 if lib else 2), '~'

def head(r):
    hered = r.v2expathhs in (3, 4) or (nz(r.v2x_ex_hereditary) and r.v2x_ex_hereditary >= 0.5)
    if not hered: return 0
    ruling = r.v2exhoshog == 1 or (nz(r.v2ex_hosw) and r.v2ex_hosw >= 0.5)
    return 2 if ruling else 1

def sub(r, R):
    if R is None or R > 1: return ''
    if nz(r.v2x_ex_party) and r.v2x_ex_party >= 0.5: return 'p'
    if nz(r.v2x_ex_military) and r.v2x_ex_military >= 0.5: return 'm'
    return ''

# capitals (Natural Earth admin-0 capitals), with historical states placed by hand
pp = json.load(open(os.path.join(NE, 'ne_50m_populated_places.geojson'), encoding='utf-8'))['features']
cap = {}
for f in pp:
    p = f['properties']
    if p.get('FEATURECLA') == 'Admin-0 capital' and p.get('ADM0_A3') not in cap:
        cap[p['ADM0_A3']] = [round(f['geometry']['coordinates'][0], 2), round(f['geometry']['coordinates'][1], 2)]
HIST = {'HKG': [114.17, 22.28], 'BDN': [8.40, 49.01], 'BRW': [10.52, 52.27], 'BVR': [11.58, 48.14], 'DDR': [12.5, 51.5], 'HDM': [8.65, 49.87], 'HKS': [9.48, 51.31],
        'HRG': [10.0, 53.55], 'HVR': [9.73, 52.37], 'MCL': [11.41, 53.63], 'MDN': [10.93, 44.65], 'NSS': [8.24, 50.08], 'OLD': [8.21, 53.14],
        'PPS': [12.48, 41.9], 'PRM': [10.33, 44.8], 'PSB': [35.2, 31.78], 'PSG': [34.45, 31.5], 'SAX': [11.33, 50.98], 'SML': [44.06, 9.56],
        'SPD': [7.68, 45.07], 'SXN': [13.74, 51.05], 'TSC': [11.25, 43.77], 'TWS': [14.25, 40.85], 'VDR': [106.7, 10.78], 'WRG': [9.18, 48.78],
        'XKX': [21.16, 42.66], 'YMD': [45.03, 12.8], 'ZZB': [39.2, -6.16],
        # capitals that moved: the state's seat in the earlier period is what identifies its polity
        'DEU': [13.4, 52.52], 'ITA': [12.48, 41.9], 'RUS': [37.62, 55.75], 'TUR': [28.98, 41.01], 'BRA': [-43.2, -22.9], 'PAK': [67.0, 24.86],
        'NGA': [3.39, 6.45], 'KAZ': [76.9, 43.25], 'TZA': [39.28, -6.8], 'CIV': [-4.03, 5.32], 'MMR': [96.16, 16.8], 'VNM': [105.85, 21.03],
        'PSE': [35.2, 31.9], 'ISR': [34.78, 32.08]}
out = []
for cid, g in df.groupby('country_text_id'):
    p = HIST.get(cid) or cap.get(cid)
    if not p:
        print('no position for', cid, g.country_name.iloc[0]); continue
    runs = []
    for r in g.sort_values('year').itertuples():
        R, approx = regime(r)
        if R is None: continue
        code = f'{R}|{head(r)}|{sub(r, R)}{approx}'
        y = int(r.year)
        if runs and runs[-1][2] == code and runs[-1][1] == y - 1: runs[-1][1] = y
        else: runs.append([y, y, code])
    if runs: out.append({'id': cid, 'n': g.country_name.iloc[0], 'p': p, 'runs': runs})
os.makedirs('public/data', exist_ok=True)
json.dump({'source': 'V-Dem Country-Year v15 (vdemdata), CC BY-SA 4.0', 'countries': out}, open('public/data/regimes.json', 'w'), separators=(',', ':'))
print('regimes:', len(out), 'countries,', sum(len(c['runs']) for c in out), 'runs')
