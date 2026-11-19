#!/usr/bin/env python3
"""
Taiwan-mode units, built from today's township boundaries (內政部國土測繪中心 鄉鎮市區界線, via the
taiwan-atlas npm package, towns-10t.json). Historical divisions are unions of these units.

Each unit is a group of townships chosen so that every historical boundary we draw falls on unit edges:
the plains and the mountain indigenous townships of each county, the old city areas whose limits changed
(Taipei before 1968, the old Taichung / Tainan / Kaohsiung cities, Hsinchu and Chiayi cities), and a few
places with their own history (Puli, Hengchun, Lanyu).
`parent` = the plains unit a mountain unit belonged to administratively (蕃地 / 山地鄉 were part of the
surrounding 廳・州・縣); admin.tsv can say "=parent" for them.

  python3 units.py <towns-10t.json> <out.geojson>
"""
import json, sys
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

TOWNS, OUT = sys.argv[1], sys.argv[2]
topo = json.load(open(TOWNS, encoding='utf-8'))

# topojson → shapely (small decoder: quantized, delta-encoded arcs)
tr = topo.get('transform')
arcs = []
for arc in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * tr['scale'][0] + tr['translate'][0], y * tr['scale'][1] + tr['translate'][1]) if tr else (dx, dy))
    arcs.append(pts)
def ring(ids):
    out = []
    for i in ids:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(a if not out else a[1:])
    return out
def geom(g):
    if g['type'] == 'Polygon': return shape({'type': 'Polygon', 'coordinates': [ring(r) for r in g['arcs']]})
    return shape({'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['arcs']]})

towns = {}
for g in topo['objects']['towns']['geometries']:
    p = g['properties']
    towns[(p['COUNTYNAME'].replace('台', '臺'), p['TOWNNAME'].replace('台', '臺'))] = geom(g).buffer(0)

MOUNTAIN = {   # 山地原住民鄉（區）
    'mt_wulai': ('新北市', ['烏來區']), 'mt_fuxing': ('桃園市', ['復興區']), 'mt_hsinchu': ('新竹縣', ['尖石鄉', '五峰鄉']),
    'mt_taian': ('苗栗縣', ['泰安鄉']), 'mt_heping': ('臺中市', ['和平區']), 'mt_nantou': ('南投縣', ['仁愛鄉', '信義鄉']),
    'mt_alishan': ('嘉義縣', ['阿里山鄉']), 'mt_kaohsiung': ('高雄市', ['茂林區', '桃源區', '那瑪夏區']),
    'mt_pingtung': ('屏東縣', ['三地門鄉', '霧臺鄉', '瑪家鄉', '泰武鄉', '來義鄉', '春日鄉', '獅子鄉', '牡丹鄉']),
    'mt_yilan': ('宜蘭縣', ['大同鄉', '南澳鄉']), 'mt_hualien': ('花蓮縣', ['秀林鄉', '萬榮鄉', '卓溪鄉']),
    'mt_taitung': ('臺東縣', ['海端鄉', '延平鄉', '金峰鄉', '達仁鄉']),
}
SPECIAL = {
    'tpe_core': ('臺北市', ['松山區', '信義區', '大安區', '中山區', '中正區', '大同區', '萬華區']),   # Taipei before 1968
    'tpe_ext': ('臺北市', ['文山區', '南港區', '內湖區']),                                       # added 1968 from Taipei County
    'tpe_ym': ('臺北市', ['士林區', '北投區']),                                                  # Yangmingshan, added 1968
    'taichung_city': ('臺中市', ['中區', '東區', '西區', '南區', '北區', '西屯區', '南屯區', '北屯區']),
    'tainan_city': ('臺南市', ['中西區', '東區', '南區', '北區', '安平區', '安南區']),
    'kaohsiung_city': ('高雄市', ['鹽埕區', '鼓山區', '左營區', '楠梓區', '三民區', '新興區', '前金區', '苓雅區', '前鎮區', '旗津區', '小港區']),
    'puli': ('南投縣', ['埔里鎮', '魚池鄉']),
    'hengchun': ('屏東縣', ['恆春鎮', '車城鄉', '滿州鄉']),
    'lanyu': ('臺東縣', ['蘭嶼鄉']),
}
REST = {   # the rest of each county
    'keelung': '基隆市', 'newtaipei': '新北市', 'taoyuan': '桃園市', 'hsinchu_city': '新竹市', 'hsinchu_co': '新竹縣',
    'miaoli': '苗栗縣', 'taichung_co': '臺中市', 'changhua': '彰化縣', 'nantou': '南投縣', 'yunlin': '雲林縣',
    'chiayi_city': '嘉義市', 'chiayi_co': '嘉義縣', 'tainan_co': '臺南市', 'kaohsiung_co': '高雄市', 'pingtung': '屏東縣',
    'yilan': '宜蘭縣', 'hualien': '花蓮縣', 'taitung': '臺東縣', 'penghu': '澎湖縣', 'kinmen': '金門縣', 'matsu': '連江縣',
}
NAMES = {  # id: (zh-Hant, zh-Hans, en, ja)
    'keelung': ('基隆', '基隆', 'Keelung', '基隆'), 'tpe_core': ('臺北舊市區', '台北旧市区', 'Old Taipei', '台北旧市街'),
    'tpe_ext': ('內湖・南港・文山', '内湖・南港・文山', 'Neihu, Nangang, Wenshan', '内湖・南港・文山'),
    'tpe_ym': ('士林・北投', '士林・北投', 'Shilin and Beitou', '士林・北投'), 'newtaipei': ('新北平原', '新北平原', 'New Taipei', '新北'),
    'taoyuan': ('桃園', '桃园', 'Taoyuan', '桃園'), 'hsinchu_city': ('新竹市區', '新竹市区', 'Hsinchu City', '新竹市'),
    'hsinchu_co': ('新竹平原', '新竹平原', 'Hsinchu', '新竹'), 'miaoli': ('苗栗', '苗栗', 'Miaoli', '苗栗'),
    'taichung_city': ('臺中市區', '台中市区', 'Taichung City', '台中市'), 'taichung_co': ('臺中平原', '台中平原', 'Taichung', '台中'),
    'changhua': ('彰化', '彰化', 'Changhua', '彰化'), 'nantou': ('南投', '南投', 'Nantou', '南投'), 'puli': ('埔里', '埔里', 'Puli', '埔里'),
    'yunlin': ('雲林', '云林', 'Yunlin', '雲林'), 'chiayi_city': ('嘉義市區', '嘉义市区', 'Chiayi City', '嘉義市'),
    'chiayi_co': ('嘉義平原', '嘉义平原', 'Chiayi', '嘉義'), 'tainan_city': ('臺南市區', '台南市区', 'Tainan City', '台南市'),
    'tainan_co': ('臺南平原', '台南平原', 'Tainan', '台南'), 'kaohsiung_city': ('高雄市區', '高雄市区', 'Kaohsiung City', '高雄市'),
    'kaohsiung_co': ('高雄平原', '高雄平原', 'Kaohsiung', '高雄'), 'pingtung': ('屏東', '屏东', 'Pingtung', '屏東'),
    'hengchun': ('恆春半島', '恒春半岛', 'Hengchun Peninsula', '恒春半島'), 'yilan': ('宜蘭', '宜兰', 'Yilan', '宜蘭'),
    'hualien': ('花蓮', '花莲', 'Hualien', '花蓮'), 'taitung': ('臺東', '台东', 'Taitung', '台東'), 'lanyu': ('蘭嶼', '兰屿', 'Lanyu (Orchid Island)', '蘭嶼'),
    'penghu': ('澎湖', '澎湖', 'Penghu', '澎湖'), 'kinmen': ('金門', '金门', 'Kinmen', '金門'), 'matsu': ('馬祖', '马祖', 'Matsu', '馬祖'),
    'mt_wulai': ('烏來山區', '乌来山区', 'Wulai mountains', '烏来山地'), 'mt_fuxing': ('復興山區', '复兴山区', 'Fuxing mountains', '復興山地'),
    'mt_hsinchu': ('尖石・五峰山區', '尖石・五峰山区', 'Jianshi and Wufeng mountains', '尖石・五峰山地'),
    'mt_taian': ('泰安山區', '泰安山区', 'Tai\'an mountains', '泰安山地'), 'mt_heping': ('和平山區', '和平山区', 'Heping mountains', '和平山地'),
    'mt_nantou': ('仁愛・信義山區', '仁爱・信义山区', 'Ren\'ai and Xinyi mountains', '仁愛・信義山地'),
    'mt_alishan': ('阿里山區', '阿里山区', 'Alishan mountains', '阿里山地'),
    'mt_kaohsiung': ('茂林・桃源・那瑪夏山區', '茂林・桃源・那玛夏山区', 'Maolin, Taoyuan and Namaxia mountains', '茂林・桃源・那瑪夏山地'),
    'mt_pingtung': ('屏東山區', '屏东山区', 'Pingtung mountains', '屏東山地'), 'mt_yilan': ('大同・南澳山區', '大同・南澳山区', 'Datong and Nan\'ao mountains', '大同・南澳山地'),
    'mt_hualien': ('花蓮山區', '花莲山区', 'Hualien mountains', '花蓮山地'), 'mt_taitung': ('臺東山區', '台东山区', 'Taitung mountains', '台東山地'),
}
PARENT = {'mt_wulai': 'newtaipei', 'mt_fuxing': 'taoyuan', 'mt_hsinchu': 'hsinchu_co', 'mt_taian': 'miaoli', 'mt_heping': 'taichung_co',
          'mt_nantou': 'nantou', 'mt_alishan': 'chiayi_co', 'mt_kaohsiung': 'kaohsiung_co', 'mt_pingtung': 'pingtung',
          'mt_yilan': 'yilan', 'mt_hualien': 'hualien', 'mt_taitung': 'taitung'}

used, units = set(), {}
for uid, (county, names) in {**MOUNTAIN, **SPECIAL}.items():
    parts = []
    for n in names:
        k = (county, n)
        if k not in towns: raise SystemExit(f'unknown township {k}')
        parts.append(towns[k]); used.add(k)
    units[uid] = unary_union(parts)
for uid, county in REST.items():
    parts = [g for k, g in towns.items() if k[0] == county and k not in used]
    if not parts: raise SystemExit(f'no townships left for {uid}')
    for k in [k for k in towns if k[0] == county and k not in used]: used.add(k)
    units[uid] = unary_union(parts)
missing = [k for k in towns if k not in used]
if missing: raise SystemExit(f'townships not in any unit: {missing}')

feats = []
for uid, g in units.items():
    hant, hans, en, ja = NAMES[uid]
    props = {'id': uid, 'zh-Hant': hant, 'zh-Hans': hans, 'en': en, 'ja': ja}
    if uid in PARENT: props['parent'] = PARENT[uid]
    feats.append({'type': 'Feature', 'properties': props, 'geometry': mapping(g)})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w'), ensure_ascii=False)
print(len(feats), 'units from', len(towns), 'townships')
