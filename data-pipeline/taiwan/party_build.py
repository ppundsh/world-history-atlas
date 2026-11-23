# Builds party.tsv (who governed each county / city, by party) from the Wikipedia table
# 「中華民國歷屆縣市長選舉政黨版圖」 (retrieved 2026-11-21) plus the municipalities and the dated mid-term changes.
# Codes: kmt 中國國民黨, dpp 民主進步黨, tpp 台灣民眾黨, pfp 親民黨, np 新黨, cdsp 中國民主社會黨, ycp 中國青年黨,
#        ind 無黨籍（黨外）, appt 官派, mil 戰地政務
K, D, I, C, Y, T, P, N = 'kmt', 'dpp', 'ind', 'cdsp', 'ycp', 'tpp', 'pfp', 'np'
START = ['1951-01', '1954-06', '1957-06', '1960-06', '1964-06', '1968-06', '1973-02', '1977-12', '1981-12', '1985-12',
         '1989-12', '1993-12', '1997-12', '2001-12', '2005-12', '2009-12', '2014-12', '2018-12', '2022-12']
# terms 1–19 per county (None = no such office); a pair = the party changed during the term (see MID)
T1 = {
 'r_taipei_co':    [K,K,K,K,K,K,K,K,K,K, D,D,D,D,K, None,None,None,None],
 'r_tpe_c':        [I,I,K,K,I, None,None,None,None,None, None,None,None,None,None,None,None,None,None],
 'r_keelung_c':    [K,K,K,C,(C,K),K,K,K,K,K, K,K,D,K,K,K,D,D,K],
 'r_yilan':        [K,K,K,K,K,K,K,K,I,I, D,D,D,D,K,D,D,K,K],
 'r_taoyuan_co':   [K,K,K,K,K,K,K,I,K,K, K,(K,D),D,K,K,K,None,None,None],
 'r_hsinchu_co':   [K,K,K,K,K,I,K,K,K,K, D,D,D,K,K,K,K,K,K],
 'r_hsinchu_c':    [None]*8 + [I,K, K,K,D,K,K,K,D,D,T],
 'r_miaoli':       [K,K,K,K,K,K,K,K,K,K, K,I,I,I,K,K,K,K,I],
 'r_taichung_co':  [K,K,K,K,K,K,K,K,K,K, K,K,D,K,K, None,None,None,None],
 'r_taichung_c':   [I,K,K,K,K,I,K,I,K,K, K,K,D,K,K, None,None,None,None],
 'r_changhua':     [K,K,K,K,K,K,K,K,I,I, D,K,K,D,K,K,D,K,K],
 'r_nantou':       [K,K,K,K,K,K,K,K,K,K, K,K,I,D,K,K,K,K,K],
 'r_yunlin':       [K,K,K,K,K,K,K,K,K,K, K,K,(K,I),K,D,D,D,K,K],
 'r_chiayi_co':    [K,I,K,K,K,K,K,K,K,K, K,K,K,D,D,D,D,D,D],
 'r_chiayi_c':     [None]*8 + [I,I, I,I,I,I,K,K,D,K,K],
 'r_tainan_co':    [K,K,K,K,K,K,K,K,K,K, K,D,D,D,D, None,None,None,None],
 'r_tainan_c':     [I,K,I,K,I,K,K,I,I,K, K,K,D,D,D, None,None,None,None],
 'r_kaohsiung_co': [K,K,K,I,K,K,K,I,K,I, D,D,D,D,D, None,None,None,None],
 'r_kaohsiung_c':  [K,K,K,K,K,C,K,K, None,None, None,None,None,None,None,None,None,None,None],
 'r_pingtung':     [K,K,K,K,K,K,K,K,I,K, D,K,D,D,D,D,D,D,D],
 'r_hualien':      [C,K,K,K,K,K,K,K,K,K, K,K,K,K,K,I,I,K,K],
 'r_taitung':      [K,K,Y,K,K,K,K,K,K,K, K,K,K,P,(I,K),K,K,K,K],
 'r_penghu':       [K,K,K,K,K,K,K,K,K,K, (K,D),D,K,K,K,K,D,K,D],
 'r_kinmen':       [None]*11 + [K,K,N,N,K,I,K,(I,T)],
 'r_lianjiang':    [None]*11 + [K,K,P,P,K,K,K,K],
}
# dated mid-term changes (Wikipedia lists of county heads)
MID = {('r_keelung_c', 5): '1965-10', ('r_taoyuan_co', 12): '1997-03', ('r_yunlin', 13): '1999-11',
       ('r_taitung', 15): '2006-04', ('r_penghu', 11): '1993-03', ('r_kinmen', 19): '2023-04'}
rows = []
for div, terms in T1.items():
    for i, p in enumerate(terms):
        if p is None: continue
        if isinstance(p, tuple):
            rows.append((div, START[i], p[0])); rows.append((div, MID[(div, i + 1)], p[1]))
        else: rows.append((div, START[i], p))
# appointed before the first elections; merged-away counties end when the municipality starts
for div in T1:
    if div in ('r_kinmen', 'r_lianjiang'): rows.append((div, '1945-10', 'mil'))
    elif div not in ('r_hsinchu_c', 'r_chiayi_c'): rows.append((div, '1945-10', 'appt'))
for div, first in (('r_hsinchu_c', '1945-10'), ('r_chiayi_c', '1945-10')): rows.append((div, first, 'appt'))
rows += [('r_yms', '1949-08', 'appt'),
 ('r_tpe_d', '1967-07', 'appt'), ('r_tpe_d', '1994-12', D), ('r_tpe_d', '1998-12', K), ('r_tpe_d', '2014-12', I), ('r_tpe_d', '2019-08', T), ('r_tpe_d', '2022-12', K),
 ('r_kaohsiung_d', '1979-07', 'appt'), ('r_kaohsiung_d', '1994-12', K), ('r_kaohsiung_d', '1998-12', D), ('r_kaohsiung_d', '2018-12', K), ('r_kaohsiung_d', '2020-08', D),
 ('r_newtaipei', '2010-12', K), ('r_taichung_d', '2010-12', K), ('r_taichung_d', '2014-12', D), ('r_taichung_d', '2018-12', K),
 ('r_tainan_d', '2010-12', D), ('r_taoyuan_d', '2014-12', D), ('r_taoyuan_d', '2022-12', K),
 # 新竹市：高虹安 2024-07 一審後退出民眾黨並停職（民眾黨籍副市長邱臣遠代理），2025-12 二審改判無罪後以無黨籍復職
 ('r_hsinchu_c', '2025-12', I)]
rows.sort()
with open('data-pipeline/taiwan/party.tsv', 'w') as f:
    f.write('# 台灣模式「政黨執政」：各縣市首長所屬政黨（由 party_build.py 產生）。欄位：行政區 id\t起(年-月)\t政黨代碼\n')
    f.write('# 來源：維基百科「中華民國歷屆縣市長選舉政黨版圖」及各縣市首長列表（2026-11-21 擷取）。屆期起始以就職月份計，任內改變依各縣市首長列表。\n')
    for r in rows: f.write('\t'.join(r) + '\n')
print(len(rows))
