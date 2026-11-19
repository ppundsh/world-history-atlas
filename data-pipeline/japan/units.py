#!/usr/bin/env python3
"""
Japan-mode units, built from today's municipalities (国土交通省 国土数値情報 行政区域 N03, 2021-01-01, via
smartnews-smri/japan-topography, 1% simplified). Every historical boundary drawn in Japan mode is a union of units.

Each municipality is given a province (令制国, as of 1869: 84 provinces incl. the 7 new Tōhoku provinces of 1868
and the 11 Hokkaidō provinces) in this order:
  1. RULES below (documented exceptions, from the province articles of ja.wikipedia "領域" sections);
  2. src/wiki_gun.txt: the "郡域" sections of every district article on ja.wikipedia (automatic extract);
  3. the single province of its prefecture (SINGLE);
  4. otherwise the province of the neighbour it shares the longest border with.
Units = province × present prefecture, further split where a historical boundary needs it (Tōhoku latitude
bands for the Emishi frontier, Aizu / Naka-dōri, northern / southern Shinano, Okitama, Ise north / south,
Tokyo's 23 wards / Tama / islands, Wajinchi, Tanegashima-Yakushima, Amami, Tokara, Okinawa's three kingdoms,
Miyako, Yaeyama, Daitō), plus areas outside today's Japan from Natural Earth (northern Kurils, Karafuto) and the
overseas territories for the optional layer (Taiwan, Korea, Kwantung, Manchuria, South Seas).

  python3 units.py <N03 geojson> <NE geojson dir> <china_provinces.geojson> <out.geojson>
"""
import json, sys, re, os
from collections import defaultdict
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

N03, NE, CHINA, OUT = sys.argv[1:5]
HERE = os.path.dirname(os.path.abspath(__file__))

SINGLE = {'青森県': '陸奥', '栃木県': '下野', '群馬県': '上野', '埼玉県': '武蔵', '山梨県': '甲斐', '長野県': '信濃',
          '富山県': '越中', '滋賀県': '近江', '奈良県': '大和', '和歌山県': '紀伊', '徳島県': '阿波', '香川県': '讃岐',
          '愛媛県': '伊予', '高知県': '土佐', '佐賀県': '肥前', '熊本県': '肥後', '宮崎県': '日向', '岩手県': '陸中',
          '宮城県': '陸前', '秋田県': '羽後', '山形県': '羽前', '福島県': '岩代', '茨城県': '常陸', '東京都': '武蔵',
          '神奈川県': '相模', '新潟県': '越後', '福井県': '越前', '岐阜県': '美濃', '三重県': '伊勢', '大分県': '豊後',
          '長崎県': '肥前', '石川県': '加賀', '山口県': '周防', '広島県': '安芸', '島根県': '出雲', '鳥取県': '伯耆',
          '岡山県': '備中', '鹿児島県': '薩摩', '福岡県': '筑前', '愛知県': '尾張', '静岡県': '駿河', '千葉県': '下総',
          '京都府': '山城', '大阪府': '摂津', '兵庫県': '播磨', '沖縄県': '琉球'}

def L(s): return s.split()
# (prefecture, municipality or ward) -> province. Wards are written "区@市".
RULES = {
  '岩手県': {'陸奥': L('二戸市 一戸町'), '陸前': L('陸前高田市 大船渡市 住田町')},
  '宮城県': {'磐城': L('白石市 蔵王町 七ヶ宿町 角田市 丸森町 亘理町 山元町')},
  '秋田県': {'陸中': L('鹿角市 小坂町')},
  '山形県': {'羽後': L('鶴岡市 酒田市 三川町 庄内町 遊佐町')},
  '福島県': {'磐城': L('いわき市 相馬市 南相馬市 広野町 楢葉町 富岡町 川内村 大熊町 双葉町 浪江町 葛尾村 新地町 飯舘村 '
                     '田村市 三春町 小野町 石川町 玉川村 平田村 浅川町 古殿町 白河市 西郷村 泉崎村 中島村 矢吹町 棚倉町 矢祭町 塙町 鮫川村')},
  '茨城県': {'下総': L('古河市 結城市 常総市 坂東市 境町 五霞町 八千代町 守谷市 取手市 利根町')},
  '千葉県': {'安房': L('館山市 南房総市 鋸南町 鴨川市'),
            '上総': L('市原市 袖ケ浦市 木更津市 君津市 富津市 茂原市 東金市 大網白里市 一宮町 睦沢町 長生村 白子町 長柄町 長南町 '
                      'いすみ市 大多喜町 御宿町 勝浦市 山武市 九十九里町 緑区@千葉市')},
  '東京都': {'伊豆': L('大島町 利島村 新島村 神津島村 三宅村 御蔵島村 八丈町 青ヶ島村'), '小笠原': L('小笠原村')},
  '神奈川県': {'武蔵': L('川崎区@川崎市 幸区@川崎市 中原区@川崎市 高津区@川崎市 宮前区@川崎市 多摩区@川崎市 麻生区@川崎市 '
                       '鶴見区@横浜市 神奈川区@横浜市 西区@横浜市 中区@横浜市 南区@横浜市 港南区@横浜市 保土ケ谷区@横浜市 旭区@横浜市 '
                       '磯子区@横浜市 金沢区@横浜市 港北区@横浜市 緑区@横浜市 青葉区@横浜市 都筑区@横浜市')},
  '新潟県': {'佐渡': L('佐渡市')},
  '石川県': {'能登': L('七尾市 輪島市 珠洲市 羽咋市 志賀町 宝達志水町 中能登町 穴水町 能登町')},
  '福井県': {'若狭': L('小浜市 若狭町 おおい町 高浜町 美浜町')},
  '岐阜県': {'飛騨': L('高山市 飛騨市 下呂市 白川村')},
  '静岡県': {'伊豆': L('熱海市 伊東市 下田市 伊豆市 伊豆の国市 東伊豆町 河津町 南伊豆町 松崎町 西伊豆町 函南町 三島市'),
            '遠江': L('中央区@浜松市 浜名区@浜松市 天竜区@浜松市 磐田市 掛川市 袋井市 湖西市 御前崎市 菊川市 森町 牧之原市 吉田町 川根本町')},
  '愛知県': {'尾張': L('南知多町 美浜町 武豊町 阿久比町 東浦町'), '三河': L('豊橋市 豊川市 蒲郡市 新城市 田原市 設楽町 東栄町 豊根村 岡崎市 幸田町 西尾市 碧南市 刈谷市 安城市 知立市 高浜市 豊田市 みよし市')},
  '三重県': {'伊賀': L('伊賀市 名張市'), '志摩': L('鳥羽市 志摩市'), '紀伊': L('尾鷲市 熊野市 紀北町 御浜町 紀宝町')},
  '京都府': {'丹波': L('亀岡市 南丹市 京丹波町 綾部市 福知山市'), '丹後': L('舞鶴市 宮津市 京丹後市 与謝野町 伊根町')},
  '大阪府': {'河内': L('守口市 門真市 寝屋川市 枚方市 交野市 四條畷市 大東市 東大阪市 八尾市 柏原市 藤井寺市 羽曳野市 松原市 富田林市 '
                     '河内長野市 大阪狭山市 太子町 河南町 千早赤阪村 美原区@堺市'),
            '和泉': L('堺区@堺市 中区@堺市 東区@堺市 西区@堺市 南区@堺市 北区@堺市 高石市 泉大津市 和泉市 忠岡町 岸和田市 貝塚市 熊取町 '
                      '泉佐野市 田尻町 泉南市 阪南市 岬町')},
  '兵庫県': {'摂津': L('東灘区@神戸市 灘区@神戸市 中央区@神戸市 兵庫区@神戸市 長田区@神戸市 北区@神戸市 須磨区@神戸市 尼崎市 西宮市 '
                     '芦屋市 伊丹市 宝塚市 川西市 三田市 猪名川町'),
            '但馬': L('豊岡市 養父市 朝来市 香美町 新温泉町'), '丹波': L('丹波篠山市 丹波市'), '淡路': L('淡路市 洲本市 南あわじ市')},
  '鳥取県': {'因幡': L('鳥取市 岩美町 若桜町 智頭町 八頭町')},
  '島根県': {'石見': L('浜田市 益田市 大田市 江津市 川本町 美郷町 邑南町 津和野町 吉賀町'), '隠岐': L('海士町 西ノ島町 知夫村 隠岐の島町')},
  '岡山県': {'備前': L('北区@岡山市 中区@岡山市 東区@岡山市 南区@岡山市 玉野市 備前市 瀬戸内市 赤磐市 和気町'),
            '美作': L('津山市 美作市 真庭市 新庄村 鏡野町 勝央町 奈義町 西粟倉村 久米南町 美咲町')},
  '広島県': {'備後': L('福山市 府中市 三次市 庄原市 尾道市 三原市 世羅町 神石高原町')},
  '山口県': {'長門': L('下関市 長門市 萩市 美祢市 山陽小野田市 宇部市 阿武町')},
  '福岡県': {'豊前': L('門司区@北九州市 小倉北区@北九州市 小倉南区@北九州市 行橋市 豊前市 苅田町 みやこ町 吉富町 上毛町 築上町 田川市 '
                     '香春町 添田町 糸田町 川崎町 大任町 赤村 福智町'),
            '筑後': L('久留米市 大牟田市 柳川市 八女市 筑後市 大川市 小郡市 うきは市 みやま市 広川町 大木町 大刀洗町')},
  '大分県': {'豊前': L('中津市 宇佐市')},
  '長崎県': {'壱岐': L('壱岐市'), '対馬': L('対馬市')},
  '鹿児島県': {'大隅': L('鹿屋市 垂水市 曽於市 志布志市 霧島市 姶良市 湧水町 大崎町 東串良町 錦江町 南大隅町 肝付町 '
                       '西之表市 中種子町 南種子町 屋久島町'),
              '奄美': L('奄美市 大和村 宇検村 瀬戸内町 龍郷町 喜界町 徳之島町 天城町 伊仙町 和泊町 知名町 与論町')},
  '沖縄県': {'琉球': []},
}
# Hokkaidō: provinces of 1869 by today's subprefecture, with exceptions
HK_SUB = {'渡島総合振興局': '渡島', '檜山振興局': '渡島', '後志総合振興局': '後志', '石狩振興局': '石狩', '空知総合振興局': '石狩',
          '上川総合振興局': '石狩', '留萌振興局': '天塩', '宗谷総合振興局': '北見', 'オホーツク総合振興局': '北見', '胆振総合振興局': '胆振',
          '日高振興局': '日高', '十勝総合振興局': '十勝', '釧路総合振興局': '釧路', '根室振興局': '根室'}
HK_RULE = {'後志': L('せたな町 今金町 奥尻町'), '胆振': L('占冠村'),
           '天塩': L('士別市 名寄市 和寒町 剣淵町 下川町 美深町 音威子府村 中川町 幌延町 豊富町'),
           '千島': L('色丹村 泊村 留夜別村 留別村 紗那村 蘂取村')}

# ---- extra splits inside a province × prefecture (unit suffix)
WAJIN = set(L('松前町 福島町 知内町 木古内町 上ノ国町 江差町 函館市 北斗市 七飯町'))
TANE = set(L('西之表市 中種子町 南種子町 屋久島町'))
TOKARA = set(L('十島村'))
OKI_N = set(L('国頭村 大宜味村 東村 今帰仁村 本部町 名護市 伊江村 伊平屋村 伊是名村'))
OKI_S = set(L('豊見城市 糸満市 八重瀬町 南城市 南風原町 与那原町'))
OKI_W = set(L('座間味村 渡嘉敷村 粟国村 渡名喜村 久米島町'))
MIYAKO = set(L('宮古島市 多良間村')); YAEYAMA = set(L('石垣市 竹富町 与那国町')); DAITO = set(L('北大東村 南大東村'))
TAMA_ISL = set(L('大島町 利島村 新島村 神津島村 三宅村 御蔵島村 八丈町 青ヶ島村'))
OKITAMA = set(L('米沢市 南陽市 長井市 高畠町 川西町 小国町 白鷹町 飯豊町'))

wiki = defaultdict(dict)        # name (with optional @qualifier) -> {province: '+'/'-'}
for line in open(os.path.join(HERE, 'src', 'wiki_gun.txt'), encoding='utf-8'):
    if line.startswith('#') or ':' not in line: continue
    prov, rest = line.rstrip('\n').split(':', 1)
    for it in rest.split(','):
        k = '-' if it.endswith('-') else '+'
        n = it.rstrip('-')
        if wiki[n].get(prov) != '+': wiki[n][prov] = k

src = json.load(open(N03, encoding='utf-8'))
munis = []                                      # one record per municipality / ward
groups = defaultdict(list)
for f in src['features']:
    p = f['properties']
    if not p['N03_004'] or p['N03_004'] == '所属未定地': continue
    groups[p['N03_007']].append(f)
for code, fs in groups.items():
    p = fs[0]['properties']
    pref, sub, city, name = p['N03_001'], p['N03_002'], p['N03_003'], p['N03_004']
    ward = city and city.endswith('市') and name.endswith('区')
    g = unary_union([shape(f['geometry']).buffer(0) for f in fs])
    munis.append(dict(code=code, pref=pref, sub=sub, city=city, name=name, key=(name + '@' + city) if ward else name, g=g, c=g.representative_point()))
print(len(munis), 'municipalities / wards')

def wiki_prov(m):
    cands = []
    for n in ([m['key'], m['name'] + '@' + m['pref'], m['name']] + ([m['city']] if m['key'] != m['name'] else [])):
        if n in wiki: cands.append(wiki[n])
    for d in cands:
        full = [p for p, k in d.items() if k == '+']
        if len(full) == 1: return full[0]
    for d in cands:
        if len(d) == 1: return next(iter(d))
    return None

how = defaultdict(int)
for m in munis:
    pref, prov = m['pref'], None
    if pref == '北海道':
        prov = HK_SUB.get(m['sub'])
        for pv, ns in HK_RULE.items():
            if m['name'] in ns: prov = pv
        how['hokkaido'] += 1
    elif pref in RULES:
        for pv, ns in RULES[pref].items():
            if m['key'] in ns or m['name'] in ns: prov = pv
        if prov: how['rule'] += 1
    if not prov and pref != '北海道':
        w = wiki_prov(m)
        if w: prov = w; how['wiki'] += 1
    m['prov'] = prov
# the province must be a plausible one for the prefecture; otherwise drop and fill from neighbours
PLAUSIBLE = defaultdict(set)
for pv in set(HK_SUB.values()) | set(HK_RULE): PLAUSIBLE['北海道'].add(pv)
for pref, pv in SINGLE.items(): PLAUSIBLE[pref].add(pv)
for pref, d in RULES.items(): PLAUSIBLE[pref].update(d)
PLAUSIBLE['京都府'].add('山城'); PLAUSIBLE['大阪府'].add('摂津'); PLAUSIBLE['兵庫県'].add('播磨')
PLAUSIBLE['千葉県'].add('上総'); PLAUSIBLE['静岡県'].add('駿河'); PLAUSIBLE['愛知県'].add('尾張')
for m in munis:
    if m['prov'] and m['prov'] not in PLAUSIBLE[m['pref']]: m['prov'] = None
# single-province prefectures (and prefectures where the rules list every exception)
for m in munis:
    if not m['prov'] and (m['pref'] not in ('千葉県', '静岡県', '愛知県', '大阪府', '京都府')):
        m['prov'] = SINGLE.get(m['pref']); how['single'] += 1 if m['prov'] else 0
# neighbours
from shapely.strtree import STRtree
tree = STRtree([m['g'] for m in munis])
for it in range(6):
    todo = [m for m in munis if not m['prov']]
    if not todo: break
    for m in todo:
        best = defaultdict(float)
        for j in tree.query(m['g'].buffer(0.003)):
            o = munis[j]
            if o is m or not o['prov'] or o['pref'] != m['pref']: continue
            best[o['prov']] += m['g'].buffer(0.003).intersection(o['g']).length + 1e-9
        if best: m['prov'] = max(best, key=best.get); how['neighbour'] += 1
for m in munis:
    if not m['prov']:
        m['prov'] = SINGLE.get(m['pref'], '?'); how['fallback'] += 1; print('  fallback', m['pref'], m['key'], m['prov'])
print('province from', dict(how))

def band(m):            # Emishi frontier bands (latitude of the municipality)
    y = m['c'].y
    return 'a' if y < 38.3 else 'b' if y < 39.2 else 'c' if y < 39.75 else 'd' if y < 40.3 else 'e'

def unit_of(m):
    pv, pref, n = m['prov'], m['pref'], m['name']
    if pref == '沖縄県':
        return 'daito' if n in DAITO else 'miyako' if n in MIYAKO else 'yaeyama' if n in YAEYAMA else \
               'oki_n' if n in OKI_N else 'oki_s' if n in OKI_S else 'oki_w' if n in OKI_W else 'oki_c'
    if pv == '奄美': return 'amami'
    if pv == '小笠原': return 'ogasawara'
    if n in TOKARA: return 'tokara'
    if pref == '鹿児島県' and n in TANE: return 'tane'
    if pv == '千島': return 'kunashiri'                       # Etorofu, Kunashiri, Shikotan (in N03)
    if pref == '北海道':
        return 'h_wajin' if n in WAJIN else 'h_' + pv
    if pv in ('陸前', '陸中', '陸奥', '羽前', '羽後', '磐城', '岩代'):
        b = band(m)
        if pv == '岩代': b = 'aizu' if (m['c'].x < 140.15 and n != '天栄村') else 'naka'
        if pv == '羽前': b = 'okitama' if n in OKITAMA else 'murayama'
        if pv == '磐城': b = 'a'
        return f'{pv}|{pref}|{b}'
    if pv == '信濃': return '信濃|' + ('s' if (m['c'].x < 138.05 or m['c'].y < 36.1) else 'n')
    if pv == '伊勢': return '伊勢|' + ('s' if m['c'].y < 34.62 else 'n')
    if pv == '武蔵' and pref == '東京都': return '武蔵|東京都|' + ('23' if m['city'] is None and n.endswith('区') else 'tama')
    if pv == '伊豆' and pref == '東京都': return 'izu_isl'
    return f'{pv}|{pref}'

units = defaultdict(list)
for m in munis: units[unit_of(m)].append(m)

ROMA = {}   # readable ids
def uid(k):
    return k.replace('|', '_')

feats = []
for k, ms in units.items():
    g = unary_union([m['g'] for m in ms]).buffer(0)
    pv = ms[0]['prov']
    feats.append({'type': 'Feature', 'properties': {'id': uid(k), 'prov': pv, 'pref': ms[0]['pref'], 'n': len(ms),
                  'munis': ' '.join(m['key'] for m in ms)}, 'geometry': mapping(g)})

# ---- outside today's Japan (Natural Earth)
def ne(name):
    return json.load(open(os.path.join(NE, name), encoding='utf-8'))['features']
adm1 = ne('ne_10m_admin_1_states_provinces.geojson')
sakh = unary_union([shape(f['geometry']).buffer(0) for f in adm1 if f['properties'].get('name') == 'Sakhalin'])
japan_now = unary_union([m['g'] for m in munis]).buffer(0.02)
kur = sakh.intersection(box(145.4, 43.0, 157.0, 51.5)).difference(japan_now)      # Kurils north of Etorofu
add = {
  'uruppu': kur.intersection(box(149.0, 45.3, 151.2, 46.6)),             # Uruppu and nearby (Russian until 1875)
  'n_kurils': kur.difference(box(149.0, 45.3, 151.2, 46.6)),
  'o_karafuto_s': sakh.intersection(box(141.0, 45.8, 145.5, 50.0)),
  'o_karafuto_n': sakh.intersection(box(141.0, 50.0, 145.5, 54.5)),
}
adm0 = ne('ne_50m_admin_0_countries.geojson')
A0 = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0) for f in adm0}
china = {f['properties']['id']: shape(f['geometry']).buffer(0) for f in json.load(open(CHINA, encoding='utf-8'))['features']}
kwantung = box(120.9, 38.6, 122.3, 39.45)
liao = china.get('liaoning')
over = {
  'o_taiwan': A0['TWN'].difference(box(118.0, 24.0, 119.6, 26.5)),        # without Kinmen / Matsu
  'o_korea_s': A0['KOR'], 'o_korea_n': A0['PRK'],
  'o_kwantung': liao.intersection(kwantung) if liao else kwantung,
  'o_manchuria': unary_union([g for k, g in china.items() if k in ('heilongjiang', 'jilin', 'liaoning', 'xingan', 'rehe')]).difference(kwantung),
  'o_nanyo': unary_union([A0[a] for a in ('PLW', 'FSM', 'MHL', 'MNP') if a in A0]),
}
for k, g in {**add, **over}.items():
    if g is None or g.is_empty: print('empty unit', k); continue
    feats.append({'type': 'Feature', 'properties': {'id': k, 'prov': '', 'pref': '', 'n': 0, 'munis': ''}, 'geometry': mapping(g.buffer(0))})

json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(feats), 'units →', OUT)
# a readable list for checking
with open(os.path.join(HERE, 'units_list.txt'), 'w', encoding='utf-8') as fo:
    for f in sorted(feats, key=lambda f: f['properties']['id']):
        p = f['properties']; fo.write(f"{p['id']}\t{p['n']}\t{p['munis']}\n")
