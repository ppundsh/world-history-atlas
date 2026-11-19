#!/usr/bin/env python3
"""
Approximate Republican-era (1911–1951) provincial units for China mode, built from today's
Natural Earth admin-1 boundaries (public domain).

Today's provinces are used where they roughly match. Units that no longer exist are cut out of
today's provinces with hand-drawn approximate polygons — 熱河 Rehe, 察哈爾 Chahar, 綏遠 Suiyuan,
興安 Xing'an (Hulunbuir), 西康 Xikang (western Sichuan) — and 阿拉善 Alxa goes to 寧夏 Ningxia.
These cuts are rough sketches, not survey boundaries; the UI says so.

Usage: python3 provinces.py <natural-earth geojson dir> <out.geojson>
"""
import json, sys, os
from shapely.geometry import shape, mapping, Polygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid

NE, OUT = sys.argv[1], sys.argv[2]
adm1 = json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson')))['features']
adm0 = json.load(open(os.path.join(NE, 'ne_50m_admin_0_countries.geojson')))['features']

def g(f):
    s = shape(f['geometry'])
    return s if s.is_valid else make_valid(s)

by_iso = {f['properties']['iso_3166_2']: g(f) for f in adm1 if f['properties']['adm0_a3'] in ('CHN', 'TWN', 'HKG', 'MAC')}
def iso(*codes): return unary_union([by_iso[c] for c in codes])
tw = unary_union([g(f) for f in adm1 if f['properties']['adm0_a3'] == 'TWN' and f['properties']['iso_3166_2'] != 'TW-KIN'])
kinmen = by_iso['TW-KIN']
hk = unary_union([g(f) for f in adm1 if f['properties']['adm0_a3'] == 'HKG'])
tuva = next(g(f) for f in adm1 if f['properties']['adm0_a3'] == 'RUS' and f['properties']['name'] == 'Tuva')
mongolia = next(g(f) for f in adm0 if f['properties']['ADM0_A3'] == 'MNG')

im = by_iso['CN-NM']
hebei = iso('CN-HE', 'CN-BJ', 'CN-TJ')
liaoning = by_iso['CN-LN']

# hand-drawn approximate outlines of vanished provinces (lon, lat)
REHE = Polygon([(116.3, 40.45), (117.4, 40.2), (119.0, 39.95), (120.5, 40.6), (121.7, 41.6), (122.2, 42.6),
                (121.6, 44.1), (120.6, 45.2), (118.8, 45.1), (117.0, 43.9), (116.0, 42.6)])
XINGAN = Polygon([(115.0, 46.6), (119.4, 46.6), (119.9, 44.9), (126.8, 44.9), (126.8, 54.0), (115.0, 54.0)])
CHAHAR_HEBEI = box(113.8, 40.3, 116.3, 42.7)        # Zhangjiakou area, now in Hebei
WEST_SICHUAN = box(95.0, 26.0, 102.3, 35.0)

rehe = (im.union(hebei).union(liaoning)).intersection(REHE)
xingan = im.union(by_iso['CN-HL']).intersection(XINGAN).difference(REHE)   # Hulunbuir + western Heilongjiang
im_rest = im.difference(REHE).difference(XINGAN)
chahar = im_rest.intersection(box(111.6, 37, 120.5, 47)).union(hebei.intersection(CHAHAR_HEBEI).difference(REHE))
suiyuan = im_rest.intersection(box(106.0, 37, 111.6, 47))
alxa = im_rest.intersection(box(90, 35, 106.0, 47))
sichuan_all = iso('CN-SC', 'CN-CQ')
xikang = sichuan_all.intersection(WEST_SICHUAN)

P = {
    # id: (geometry, zh-Hant, zh-Hans, en, ja)
    'zhili': (hebei.difference(REHE).difference(CHAHAR_HEBEI), '直隸／河北', '直隶／河北', 'Zhili / Hebei', '直隷／河北'),
    'rehe': (rehe, '熱河', '热河', 'Rehe (Jehol)', '熱河'),
    'chahar': (chahar, '察哈爾', '察哈尔', 'Chahar', 'チャハル'),
    'suiyuan': (suiyuan, '綏遠', '绥远', 'Suiyuan', '綏遠'),
    'xingan': (xingan, '興安（呼倫貝爾）', '兴安（呼伦贝尔）', "Xing'an (Hulunbuir)", '興安（ホロンバイル）'),
    'shanxi': (by_iso['CN-SX'], '山西', '山西', 'Shanxi', '山西'),
    'shandong': (by_iso['CN-SD'], '山東', '山东', 'Shandong', '山東'),
    'henan': (by_iso['CN-HA'], '河南', '河南', 'Henan', '河南'),
    'jiangsu': (by_iso['CN-JS'], '江蘇', '江苏', 'Jiangsu', '江蘇'),
    'shanghai': (by_iso['CN-SH'], '上海', '上海', 'Shanghai', '上海'),
    'zhejiang': (by_iso['CN-ZJ'], '浙江', '浙江', 'Zhejiang', '浙江'),
    'anhui': (by_iso['CN-AH'], '安徽', '安徽', 'Anhui', '安徽'),
    'jiangxi': (by_iso['CN-JX'], '江西', '江西', 'Jiangxi', '江西'),
    'hubei': (by_iso['CN-HB'], '湖北', '湖北', 'Hubei', '湖北'),
    'hunan': (by_iso['CN-HN'], '湖南', '湖南', 'Hunan', '湖南'),
    'fujian': (by_iso['CN-FJ'].union(kinmen), '福建', '福建', 'Fujian', '福建'),
    'guangdong': (by_iso['CN-GD'], '廣東', '广东', 'Guangdong', '広東'),
    'hainan': (by_iso['CN-HI'], '海南（瓊崖）', '海南（琼崖）', 'Hainan', '海南'),
    'guangxi': (by_iso['CN-GX'], '廣西', '广西', 'Guangxi', '広西'),
    'yunnan': (by_iso['CN-YN'], '雲南', '云南', 'Yunnan', '雲南'),
    'guizhou': (by_iso['CN-GZ'], '貴州', '贵州', 'Guizhou', '貴州'),
    'sichuan': (sichuan_all.difference(WEST_SICHUAN), '四川', '四川', 'Sichuan', '四川'),
    'xikang': (xikang, '西康（川邊）', '西康（川边）', 'Xikang', '西康'),
    'shaanxi': (by_iso['CN-SN'], '陝西', '陕西', 'Shaanxi', '陝西'),
    'gansu': (by_iso['CN-GS'], '甘肅', '甘肃', 'Gansu', '甘粛'),
    'ningxia': (by_iso['CN-NX'].union(alxa), '寧夏（含阿拉善）', '宁夏（含阿拉善）', 'Ningxia (with Alxa)', '寧夏'),
    'qinghai': (by_iso['CN-QH'], '青海', '青海', 'Qinghai', '青海'),
    'xinjiang': (by_iso['CN-XJ'], '新疆', '新疆', 'Xinjiang', '新疆'),
    'tibet': (by_iso['CN-XZ'], '西藏', '西藏', 'Tibet', 'チベット'),
    'liaoning': (liaoning.difference(REHE), '奉天／遼寧', '奉天／辽宁', 'Fengtian / Liaoning', '奉天／遼寧'),
    'jilin': (by_iso['CN-JL'], '吉林', '吉林', 'Jilin', '吉林'),
    'heilongjiang': (by_iso['CN-HL'].difference(XINGAN), '黑龍江', '黑龙江', 'Heilongjiang', '黒竜江'),
    'taiwan': (tw, '臺灣', '台湾', 'Taiwan', '台湾'),
    'waimeng': (mongolia, '外蒙古', '外蒙古', 'Outer Mongolia', '外モンゴル'),
    'tuva': (tuva, '唐努烏梁海', '唐努乌梁海', 'Tannu Uriankhai (Tuva)', 'タンヌ・ウリャンハイ'),
    'hongkong': (hk, '香港', '香港', 'Hong Kong', '香港'),
    'macau': (by_iso['MO-M'], '澳門', '澳门', 'Macau', 'マカオ'),
}
# Every bit of the source provinces must belong to some unit: leftovers from the hand-drawn cuts (e.g.
# eastern Inner Mongolia between Rehe and Xing'an) go to the neighbour sharing the longest border.
whole = unary_union([geom for geom, *_ in P.values()])
source = unary_union([by_iso[c] for c in by_iso if c.startswith('CN-')] + [mongolia])
left = source.difference(whole)
moved = 0
for piece in getattr(left, 'geoms', [left]):
    if piece.geom_type != 'Polygon' or piece.area < 0.01: continue
    best = max(P, key=lambda k: P[k][0].buffer(0.02).intersection(piece.boundary).length)
    geom, *rest = P[best]
    P[best] = (unary_union([geom, piece]), *rest); moved += 1
print('leftover pieces assigned:', moved)
feats = []
for pid, (geom, hant, hans, en, ja) in P.items():
    geom = make_valid(geom)
    if geom.geom_type == 'GeometryCollection':
        geom = unary_union([x for x in geom.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
    feats.append({'type': 'Feature', 'geometry': mapping(geom),
                  'properties': {'id': pid, 'zh-Hant': hant, 'zh-Hans': hans, 'en': en, 'ja': ja}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w'), ensure_ascii=False)
print(len(feats), 'units')
