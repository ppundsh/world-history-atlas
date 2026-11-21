# Builds party.tsv for the Japan mode: in each prefecture, the party that won most single-member districts
# of the House of Representatives at each general election since 1996 (ties: "tie"); before that, multi-member
# districts (not coloured). Seat counts in smd_seats.json were read from the Japanese Wikipedia article on each
# general election (prefecture tables, or the district winners' party colours) on 2026-11-21.
import json
DATES = {41: '1996-10', 42: '2000-06', 43: '2003-11', 44: '2005-09', 45: '2009-08', 46: '2012-12', 47: '2014-12', 48: '2017-10', 49: '2021-10', 50: '2024-10', 51: '2026-02'}
def code(name, n):
    if name == '自民': return 'ldp'
    if name in ('民主',): return 'dpj'
    if name == '新進': return 'nfp'
    if name in ('立民', '立憲'): return 'cdp'
    if name == '中道': return 'chudo'
    if name == '維新': return 'ishin'
    if name == '公明': return 'komei'
    if name == '社民': return 'sdp'
    if name == '共産': return 'jcp'
    if name == '国民': return 'dpfp' if n >= 49 else 'other'      # 2005/2009: the People's New Party
    if name == '希望': return 'kibo'
    if name == '自由': return 'liberal'
    if name == 'さき': return 'sakigake'
    if name.startswith('無'): return 'ind'
    return 'other'
d = json.load(open('data-pipeline/japan/smd_seats.json', encoding='utf-8'))
rows = []
prefs = sorted({p for v in d.values() for p in v})
for p in prefs: rows.append((p, '1947-04', 'mmd'))
for n, v in d.items():
    n = int(n)
    for p, s in v.items():
        seats = {}
        for kv in s.split(','):
            k, c = kv.rsplit(':', 1); cc = code(k, n); seats[cc] = seats.get(cc, 0) + int(c)
        top = sorted(seats.items(), key=lambda x: -x[1])
        win = 'tie' if len(top) > 1 and top[0][1] == top[1][1] else top[0][0]
        rows.append((p, DATES[n], win))
with open('data-pipeline/japan/party.tsv', 'w', encoding='utf-8') as f:
    f.write('# 日本模式「政黨執政」：各都道府縣眾議院小選區最多席次的政黨（由 party_build.py 自 smd_seats.json 產生）。欄位：行政區 id\t起(年-月)\t政黨代碼\n')
    for p, m, c in sorted(rows): f.write(f'k_{p}\t{m}\t{c}\n')
print(len(rows))
