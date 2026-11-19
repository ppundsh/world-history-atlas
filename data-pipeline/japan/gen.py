#!/usr/bin/env python3
"""
Japan mode: writes region.json (unit groups), divisions.tsv and admin.tsv (the administrative-division layer)
from the compact tables below. Run after units.py:  python3 data-pipeline/japan/gen.py
Names: Japanese as written today; Traditional / Simplified Chinese by OpenCC (jp→tw, jp→cn) in build_region
is NOT used for names, so both are produced here with a small table of shinjitai→kyūjitai characters.

Sources (dates of every change):
  https://ja.wikipedia.org/wiki/令制国一覧            (provinces, splits and merges 701–1869)
  https://ja.wikipedia.org/wiki/廃藩置県               (1871)
  https://ja.wikipedia.org/wiki/府県統合               (1871–1876)
  https://ja.wikipedia.org/wiki/都道府県の変遷         (1871–1888)
  https://ja.wikipedia.org/wiki/北海道_(令制)           (1869 provinces)
  https://ja.wikipedia.org/wiki/三県一局時代           (Hokkaidō 1882–1886)
  https://ja.wikipedia.org/wiki/琉球処分               (1872, 1879)
  https://ja.wikipedia.org/wiki/東京都の歴史            (1878 Izu islands, 1880 Ogasawara, 1893 Tama, 1943)
  https://ja.wikipedia.org/wiki/琉球列島米国民政府     (1945–1972)
  https://ja.wikipedia.org/wiki/奄美群島の復帰運動     (1946–1953)
Where a prefecture of 1871–1876 split a province along district lines that the units do not follow, the
whole unit is given to the prefecture that held most of it (noted below as "approx").
"""
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
units = [l.split('\t')[0] for l in open(os.path.join(HERE, 'units_list.txt'), encoding='utf-8')]

# ---------------------------------------------------------------- groups
G = {}
def grp(name, us):
    us = [u for u in us if u in units or u in G]
    assert us, name
    G[name] = us
PROVS = sorted({u.split('_')[0] for u in units if '_' in u and not u.startswith(('h_', 'o_', 'oki_', 'n_', 'izu_'))})
for p in PROVS:
    grp(p, [u for u in units if u.split('_')[0] == p])
grp('伊豆', G['伊豆'] + ['izu_isl'])
for p in ['渡島', '後志', '石狩', '天塩', '北見', '胆振', '日高', '十勝', '釧路', '根室']:
    grp(p, ['h_' + p] + (['h_wajin'] if p == '渡島' else []))
grp('大隅', G['大隅'] + ['tane'])
grp('ezo', ['渡島', '後志', '石狩', '天塩', '北見', '胆振', '日高', '十勝', '釧路', '根室'])
grp('ezo_rest', ['h_渡島', '後志', '石狩', '天塩', '北見', '胆振', '日高', '十勝', '釧路', '根室'])
grp('ezo_east', ['h_渡島', '胆振', '日高', '十勝', '釧路', '根室'])
grp('ezo_west', ['後志', '石狩', '天塩', '北見'])
grp('okinawa', ['oki_n', 'oki_c', 'oki_s', 'oki_w'])
grp('sakishima', ['miyako', 'yaeyama'])
grp('kurils_n', ['uruppu', 'n_kurils'])
grp('mutsu_old', ['磐城', '岩代', '陸前', '陸中', '陸奥'])
grp('dewa_old', ['羽前', '羽後'])
for b in 'abcde':
    grp('band_' + b, [u for u in units if re.match(r'^(陸前|陸中|陸奥|羽後)_.*_' + b + '$', u)])
grp('kinai', ['山城', '大和', '河内', '和泉', '摂津'])
grp('overseas', [u for u in units if u.startswith('o_')])
grp('o_korea', ['o_korea_n', 'o_korea_s'])
grp('o_karafuto', ['o_karafuto_s', 'o_karafuto_n'])
mainland = [p for p in PROVS if p not in ('琉球', '奄美', '千島', '小笠原')]
grp('hondo', mainland + ['izu_isl', 'tane'])     # the islands of ritsuryō Japan (without Hokkaidō, Ryūkyū)

json.dump({'start': '0701-01', 'end': '2026-12', 'units': 'japan_units.geojson', 'merge': True, 'groups': G},
          open(os.path.join(HERE, 'region.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- names
KYU = str.maketrans('対壱騨奥摂蔵総芸予豊塩胆隠狭児縄庁総関桜県国広沢鉄浜辺済発労伝営覚帯稲', '對壹驒奧攝藏總藝豫豐鹽膽隱狹兒繩廳總關櫻縣國廣澤鐵濱邊濟發勞傳營覺帶稻')
KAN = str.maketrans('対壱騨奥摂蔵総芸予豊塩胆隠狭児縄庁総関桜県国広沢鉄浜辺済発労伝営覚帯稲馬鹿島東長門陸', '对壹驒奥摄藏总艺予丰盐胆隐狭儿绳厅总关樱县国广泽铁滨边济发劳传营觉带稻马鹿岛东长门陆')
def hant(s): return s.translate(KYU)
def hans(s): return s.translate(KAN)
ROMA = dict(山城='Yamashiro', 大和='Yamato', 河内='Kawachi', 和泉='Izumi', 摂津='Settsu', 伊賀='Iga', 伊勢='Ise', 志摩='Shima',
            尾張='Owari', 三河='Mikawa', 遠江='Tōtōmi', 駿河='Suruga', 伊豆='Izu', 甲斐='Kai', 相模='Sagami', 武蔵='Musashi', 安房='Awa',
            上総='Kazusa', 下総='Shimōsa', 常陸='Hitachi', 近江='Ōmi', 美濃='Mino', 飛騨='Hida', 信濃='Shinano', 上野='Kōzuke',
            下野='Shimotsuke', 陸奥='Mutsu', 出羽='Dewa', 磐城='Iwaki', 岩代='Iwashiro', 陸前='Rikuzen', 陸中='Rikuchū', 羽前='Uzen',
            羽後='Ugo', 若狭='Wakasa', 越前='Echizen', 加賀='Kaga', 能登='Noto', 越中='Etchū', 越後='Echigo', 佐渡='Sado', 丹波='Tanba',
            丹後='Tango', 但馬='Tajima', 因幡='Inaba', 伯耆='Hōki', 出雲='Izumo', 石見='Iwami', 隠岐='Oki', 播磨='Harima', 美作='Mimasaka',
            備前='Bizen', 備中='Bitchū', 備後='Bingo', 安芸='Aki', 周防='Suō', 長門='Nagato', 紀伊='Kii', 淡路='Awaji', 阿波='Awa',
            讃岐='Sanuki', 伊予='Iyo', 土佐='Tosa', 筑前='Chikuzen', 筑後='Chikugo', 豊前='Buzen', 豊後='Bungo', 肥前='Hizen', 肥後='Higo',
            日向='Hyūga', 大隅='Ōsumi', 薩摩='Satsuma', 壱岐='Iki', 対馬='Tsushima', 渡島='Oshima', 後志='Shiribeshi', 石狩='Ishikari',
            天塩='Teshio', 北見='Kitami', 胆振='Iburi', 日高='Hidaka', 十勝='Tokachi', 釧路='Kushiro', 根室='Nemuro', 千島='Chishima',
            多禰='Tane', 石城='Iwaki', 石背='Iwase')
CIRCUIT = {'kinai': '山城 大和 河内 和泉 摂津', 'tokai': '伊賀 伊勢 志摩 尾張 三河 遠江 駿河 伊豆 甲斐 相模 武蔵 安房 上総 下総 常陸',
           'tosan': '近江 美濃 飛騨 信濃 上野 下野 陸奥 出羽 磐城 岩代 陸前 陸中 羽前 羽後 石城 石背', 'hokuriku': '若狭 越前 加賀 能登 越中 越後 佐渡',
           'sanin': '丹波 丹後 但馬 因幡 伯耆 出雲 石見 隠岐', 'sanyo': '播磨 美作 備前 備中 備後 安芸 周防 長門',
           'nankai': '紀伊 淡路 阿波 讃岐 伊予 土佐', 'saikai': '筑前 筑後 豊前 豊後 肥前 肥後 日向 大隅 薩摩 壱岐 対馬 多禰',
           'hokkaido': '渡島 後志 石狩 天塩 北見 胆振 日高 十勝 釧路 根室 千島'}
HUE = dict(kinai=12, tokai=40, tosan=95, hokuriku=180, sanin=210, sanyo=260, nankai=300, saikai=335, hokkaido=150)
import colorsys
def col(h, i):
    l = 0.70 + 0.10 * ((i * 7) % 4) / 3; s = 0.38 + 0.18 * ((i * 5) % 3) / 2
    r, g, b = colorsys.hls_to_rgb(((h + (i % 5) * 9 - 18) % 360) / 360, l, s)
    return '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
DIV = []                                  # id, colour, hant, hans, en, ja
for c, ps in CIRCUIT.items():
    for i, p in enumerate(ps.split()):
        ja = p + '国'
        DIV.append(('p_' + p, col(HUE[c], i), hant(ja), hans(ja), ROMA[p] + ' Province', ja))
DIV += [('izumigen', '#e8b48f', '和泉監', '和泉监', 'Izumi-gen (Izumi district office)', '和泉監'),
        ('none', '#d8d4cc', '未設國郡（蝦夷之地）', '未设国郡（虾夷之地）', 'No province (Emishi lands)', '国郡未設置（蝦夷の地）'),
        ('ezochi', '#cfd8d0', '蝦夷地（愛努）', '虾夷地（阿伊努）', 'Ezochi (Ainu lands)', '蝦夷地（アイヌ）'),
        ('wajinchi', '#e3c08f', '和人地（松前藩）', '和人地（松前藩）', 'Wajinchi (Matsumae domain)', '和人地（松前藩）'),
        ('ryukyu_k', '#d7a6c9', '琉球王國（間切）', '琉球王国（间切）', 'Ryūkyū Kingdom (magiri districts)', '琉球王国（間切）'),
        ('ryukyu_pre', '#e6cfe0', '琉球諸按司', '琉球诸按司', 'Ryūkyū chiefdoms (aji)', '琉球の按司'),
        ('foreign', '#dddddd', '（日本以外）', '（日本以外）', '(outside Japan)', '（日本以外）'),
        ('empty', '#eeeeee', '無人島', '无人岛', 'Uninhabited', '無人島')]
# prefectures etc.
PREF = """東京府 Tōkyō-fu|京都府 Kyōto-fu|大阪府 Ōsaka-fu|神奈川県 Kanagawa|埼玉県 Saitama|千葉県 Chiba|茨城県 Ibaraki|栃木県 Tochigi|群馬県 Gunma
長野県 Nagano|筑摩県 Chikuma|新潟県 Niigata|相川県 Aikawa|新川県 Niikawa|富山県 Toyama|七尾県 Nanao|石川県 Ishikawa|足羽県 Asuwa|敦賀県 Tsuruga|福井県 Fukui
山梨県 Yamanashi|静岡県 Shizuoka|浜松県 Hamamatsu|足柄県 Ashigara|額田県 Nukata|愛知県 Aichi|岐阜県 Gifu|三重県 Mie|度会県 Watarai|滋賀県 Shiga
豊岡県 Toyooka|堺県 Sakai|奈良県 Nara|兵庫県 Hyōgo|飾磨県 Shikama|和歌山県 Wakayama|鳥取県 Tottori|島根県 Shimane|浜田県 Hamada|北条県 Hōjō
岡山県 Okayama|小田県 Oda|広島県 Hiroshima|山口県 Yamaguchi|名東県 Myōdō|徳島県 Tokushima|香川県 Kagawa|石鉄県 Sekitetsu|愛媛県 Ehime|高知県 Kōchi
福岡県 Fukuoka|三潴県 Mizuma|小倉県 Kokura|大分県 Ōita|佐賀県 Saga|長崎県 Nagasaki|熊本県 Kumamoto|宮崎県 Miyazaki|鹿児島県 Kagoshima|青森県 Aomori
岩手県 Iwate|磐井県 Iwai|宮城県 Miyagi|磐前県 Iwasaki|福島県 Fukushima|若松県 Wakamatsu|秋田県 Akita|山形県 Yamagata|置賜県 Okitama|鶴岡県 Tsuruoka
開拓使 Kaitakushi (Hokkaidō Development Commission)|函館県 Hakodate|札幌県 Sapporo|根室県 Nemuro|北海道庁 Hokkaidō-chō|北海道 Hokkaidō|琉球藩 Ryūkyū Domain|沖縄県 Okinawa
東京都 Tōkyō-to (Metropolis)|小笠原（内務省） Ogasawara (Home Ministry)|樺太庁 Karafuto-chō|台湾総督府 Government-General of Taiwan|朝鮮総督府 Government-General of Korea|関東州 Kwantung Leased Territory
南洋庁 South Seas Mandate (Nan'yō-chō)|満洲国 Manchukuo|琉球列島米国民政府 USCAR (US Civil Administration of the Ryūkyū Islands)|臨時北部南西諸島政庁 Provisional Northern Ryūkyū Government (Amami)|小笠原（米海軍） Ogasawara (US Navy)|ソ連・ロシア Soviet Union / Russia"""
for i, item in enumerate(PREF.replace('\n', '|').split('|')):
    ja, en = item.split(' ', 1)
    en = en if ('(' in en or ' ' in en or en.endswith(('-fu', '-to', '-chō'))) else en + ' Prefecture'
    zh = ja.replace('ソ連・ロシア', '蘇聯・俄羅斯').replace('満洲国', '滿洲國')
    DIV.append(('k_' + ja, col([20, 70, 120, 170, 220, 270, 320][i % 7], i), hant(zh), hans(zh), en, ja))
with open(os.path.join(HERE, 'divisions.tsv'), 'w', encoding='utf-8') as f:
    f.write('# 日本模式：行政區劃（由 gen.py 產生，勿手改）。欄位：id\t顏色\t繁中\t簡中\tEnglish\t日本語\n')
    for d in DIV: f.write('\t'.join(d) + '\n')

# ---------------------------------------------------------------- admin timeline
A = []
def at(m, us, d): A.append((m, us, d))
P = lambda p: 'p_' + p
K = lambda k: 'k_' + k
# 701 大宝律令: 58 provinces and 3 islands (approx: the Ugo / Uzen lands not yet provinces)
for p in PROVS:
    if p in ('琉球', '奄美', '千島', '小笠原'): continue
    at('0701-01', p, P(p))
at('0701-01', 'mutsu_old', P('陸奥'))
at('0701-01', 'izu_isl', P('伊豆')); at('0701-01', 'tane', P('日向'))
at('0701-01', '羽前', P('陸奥')); at('0701-01', '羽後_山形県_b', P('越後'))
at('0701-01', '羽後_秋田県_b,羽後_秋田県_c,羽後_秋田県_d,羽後_秋田県_e', 'none')
at('0701-01', '陸前_宮城県_b,陸前_岩手県_b,band_c,band_d,band_e', 'none')
at('0701-01', '加賀,能登', P('越前')); at('0701-01', '丹後', P('丹波')); at('0701-01', '美作', P('備前'))
at('0701-01', '薩摩,大隅', P('日向')); at('0701-01', '和泉', P('河内')); at('0701-01', '安房', P('上総'))
at('0701-01', 'ezo', 'ezochi'); at('0701-01', 'kunashiri,kurils_n', 'ezochi')
at('0701-01', 'okinawa,sakishima,amami,tokara', 'ryukyu_pre'); at('0701-01', 'daito,ogasawara', 'empty')
at('0701-01', 'overseas', 'foreign')
at('0702-01', '薩摩', P('薩摩')); at('0702-01', 'tane', P('多禰'))
at('0712-10', '羽後_山形県_b', P('出羽'))
at('0713-04', '羽前', P('出羽')); at('0713-04', '丹後', P('丹後')); at('0713-04', '美作', P('美作')); at('0713-04', '大隅', P('大隅'))
at('0716-04', '和泉', 'izumigen')
at('0718-05', '能登', P('能登')); at('0718-05', '安房', P('安房')); at('0718-05', '磐城', P('石城')); at('0718-05', '岩代', P('石背'))
at('0724-01', '磐城,岩代', P('陸奥'))            # 石城・石背 rejoined Mutsu by c. 724 (exact year unknown)
at('0724-01', '陸前_宮城県_b', P('陸奥'))         # 多賀城 724
at('0733-12', '羽後_秋田県_c', P('出羽'))         # 出羽柵 moved to Akita 733
at('0740-08', '和泉', P('河内'))
at('0741-12', '能登', P('越中')); at('0741-12', '安房', P('上総'))
at('0743-02', '佐渡', P('越後')); at('0752-11', '佐渡', P('佐渡'))
at('0757-05', '能登', P('能登')); at('0757-05', '安房', P('安房')); at('0757-05', '和泉', P('和泉'))
at('0767-10', '陸前_岩手県_b,陸中_岩手県_b,羽後_秋田県_b', P('陸奥')); at('0767-10', '羽後_秋田県_b', P('出羽'))
at('0802-01', '陸中_岩手県_c', P('陸奥'))         # 胆沢城 802
at('0803-01', '陸中_岩手県_d', P('陸奥'))         # 志波城 803
at('0823-03', '加賀', P('加賀'))
at('0824-01', 'tane', P('大隅'))
at('1087-12', '陸奥_岩手県_d,陸中_秋田県_d', P('陸奥')); at('1087-12', '羽後_秋田県_d', P('出羽'))
at('1189-09', '陸中_岩手県_e,陸中_秋田県_e,陸奥_青森県_e', P('陸奥')); at('1189-09', '羽後_秋田県_e', P('出羽'))
at('1429-01', 'okinawa', 'ryukyu_k'); at('1466-01', 'amami', 'ryukyu_k'); at('1500-01', 'sakishima', 'ryukyu_k')
at('1609-05', 'amami,tokara', P('大隅')); at('1609-05', 'tokara', P('薩摩'))
at('1604-01', 'h_wajin', 'wajinchi')
# 1868-12 陸奥・出羽 split
for p in ['磐城', '岩代', '陸前', '陸中', '陸奥', '羽前', '羽後']: at('1868-12', p, P(p))
at('1869-08', 'ezo', None)
for p in ['渡島', '後志', '石狩', '天塩', '北見', '胆振', '日高', '十勝', '釧路', '根室']: at('1869-08', p, P(p))
at('1869-08', 'kunashiri', P('千島'))
at('1875-05', 'kurils_n', P('千島'))
# 1871-12 (明治4年11月) 3府72県 — approx at unit level
PREF71 = {
 '東京府': '武蔵_東京都_23', '神奈川県': '武蔵_神奈川県,武蔵_東京都_tama,相模', '足柄県': '伊豆', '埼玉県': '武蔵_埼玉県',
 '千葉県': '下総_千葉県,上総,安房', '茨城県': '常陸,下総_茨城県', '栃木県': '下野', '群馬県': '上野', '長野県': '信濃_n', '筑摩県': '信濃_s,飛騨',
 '新潟県': '越後', '相川県': '佐渡', '新川県': '越中', '七尾県': '能登', '石川県': '加賀', '足羽県': '越前', '敦賀県': '若狭', '山梨県': '甲斐',
 '静岡県': '駿河', '浜松県': '遠江', '額田県': '三河', '愛知県': '尾張', '岐阜県': '美濃', '三重県': '伊勢_n,伊賀', '度会県': '伊勢_s,志摩,紀伊_三重県',
 '滋賀県': '近江', '京都府': '山城,丹波_京都府', '豊岡県': '丹後,但馬,丹波_兵庫県', '大阪府': '摂津_大阪府', '堺県': '和泉,河内', '奈良県': '大和',
 '兵庫県': '摂津_兵庫県', '飾磨県': '播磨', '名東県': '阿波,淡路', '和歌山県': '紀伊_和歌山県', '鳥取県': '因幡,伯耆,隠岐', '島根県': '出雲',
 '浜田県': '石見', '北条県': '美作', '岡山県': '備前', '小田県': '備中,備後', '広島県': '安芸', '山口県': '周防,長門', '香川県': '讃岐',
 '石鉄県': '伊予', '高知県': '土佐', '福岡県': '筑前', '三潴県': '筑後', '小倉県': '豊前', '大分県': '豊後', '佐賀県': '肥前_佐賀県,対馬',
 '長崎県': '肥前_長崎県,壱岐', '熊本県': '肥後', '宮崎県': '日向', '鹿児島県': '薩摩,大隅,amami,tokara', '青森県': '陸奥',
 '岩手県': '陸中_岩手県_c,陸中_岩手県_d,陸中_岩手県_e', '磐井県': '陸中_岩手県_b,陸前_岩手県_b,陸前_宮城県_b', '宮城県': '陸前_宮城県_a',
 '磐前県': '磐城', '福島県': '岩代_福島県_naka', '若松県': '岩代_福島県_aizu', '秋田県': '羽後_秋田県_b,羽後_秋田県_c,羽後_秋田県_d,羽後_秋田県_e,陸中_秋田県_d,陸中_秋田県_e',
 '山形県': '羽前_山形県_murayama', '置賜県': '羽前_山形県_okitama', '鶴岡県': '羽後_山形県_b'}
for k, us in PREF71.items(): at('1871-12', us, K(k))
at('1869-08', 'ezo,kunashiri', K('開拓使')); at('1875-05', 'kurils_n', K('開拓使'))
at('1872-10', 'okinawa,sakishima', K('琉球藩'))
at('1872-08', '対馬', K('長崎県'))
at('1872-10', '能登', K('石川県'))
at('1873-01', '越前', K('敦賀県'))
at('1873-02', '讃岐', K('名東県')); at('1873-02', '伊予', K('愛媛県'))
at('1873-06', '下総_千葉県,上総,安房', K('千葉県'))
at('1875-09', '讃岐', K('香川県'))
at('1875-12', '備中,備後', K('岡山県'))
at('1876-04', '伊豆', K('静岡県')); at('1876-04', 'izu_isl', K('静岡県')); at('1876-04', '佐渡', K('新潟県')); at('1876-04', '越中', K('石川県'))
at('1876-04', '浜田県' and '石見', K('島根県')); at('1876-04', '美作', K('岡山県')); at('1876-04', '備後', K('広島県')); at('1876-04', '大和', K('堺県'))
at('1876-04', '伊勢_s,志摩,紀伊_三重県', K('三重県')); at('1876-04', '豊前_大分県', K('大分県')); at('1876-04', '肥前_佐賀県', K('三潴県'))
at('1876-04', '陸中_岩手県_b,陸前_岩手県_b', K('岩手県')); at('1876-04', '陸前_宮城県_b', K('宮城県'))
at('1876-08', '信濃', K('長野県')); at('1876-08', '飛騨', K('岐阜県')); at('1876-08', '越前', K('石川県')); at('1876-08', '若狭', K('滋賀県'))
at('1876-08', '遠江', K('静岡県')); at('1876-08', '丹後', K('京都府')); at('1876-08', '但馬,丹波_兵庫県,播磨,淡路', K('兵庫県'))
at('1876-08', '因幡,伯耆,隠岐', K('島根県')); at('1876-08', '阿波', K('高知県')); at('1876-08', '讃岐', K('愛媛県'))
at('1876-08', '筑後,豊前_福岡県', K('福岡県')); at('1876-08', '肥前_佐賀県', K('長崎県')); at('1876-08', '日向', K('鹿児島県'))
at('1876-08', '磐城_宮城県_a', K('宮城県')); at('1876-08', '磐城_福島県_a,岩代', K('福島県'))
at('1876-08', '羽前,羽後_山形県_b', K('山形県')); at('1876-08', '武蔵_埼玉県', K('埼玉県')); at('1876-08', '常陸,下総_茨城県', K('茨城県'))
at('1876-10', 'ogasawara', K('小笠原（内務省）'))
at('1878-01', 'izu_isl', K('東京府'))
at('1879-04', 'okinawa,sakishima', K('沖縄県'))
at('1880-03', '阿波', K('徳島県')); at('1880-10', 'ogasawara', K('東京府'))
at('1881-02', '越前,若狭', K('福井県')); at('1881-02', '和泉,河内,大和', K('大阪府'))
at('1881-09', '因幡,伯耆', K('鳥取県'))
at('1882-02', '渡島', K('函館県')); at('1882-02', '後志,石狩,天塩,胆振,日高', K('札幌県')); at('1882-02', '北見,十勝,釧路,根室,kunashiri,kurils_n', K('根室県'))
at('1883-05', '越中', K('富山県')); at('1883-05', '肥前_佐賀県', K('佐賀県')); at('1883-05', '日向', K('宮崎県'))
at('1885-11', 'daito', K('沖縄県'))
at('1886-01', 'ezo,kunashiri,kurils_n', K('北海道庁'))
at('1887-11', '大和', K('奈良県')); at('1888-12', '讃岐', K('香川県'))
at('1893-04', '武蔵_東京都_tama', K('東京府'))
at('1943-07', '武蔵_東京都_23,武蔵_東京都_tama,izu_isl,ogasawara', K('東京都'))
# overseas
at('1895-06', 'o_taiwan', K('台湾総督府')); at('1945-10', 'o_taiwan', 'foreign')
at('1905-09', 'o_karafuto_s', K('樺太庁')); at('1945-08', 'o_karafuto_s', K('ソ連・ロシア'))
at('1905-09', 'o_kwantung', K('関東州')); at('1945-08', 'o_kwantung', 'foreign')
at('1910-08', 'o_korea', K('朝鮮総督府')); at('1945-08', 'o_korea', 'foreign')
at('1914-10', 'o_nanyo', K('南洋庁')); at('1945-01', 'o_nanyo', 'foreign')
at('1932-03', 'o_manchuria', K('満洲国')); at('1945-08', 'o_manchuria', 'foreign')
# after 1945
at('1945-08', 'kunashiri,kurils_n', K('ソ連・ロシア'))
at('1945-06', 'okinawa,sakishima,daito', K('琉球列島米国民政府'))
at('1946-02', 'amami,tokara', K('臨時北部南西諸島政庁')); at('1952-02', 'tokara', K('鹿児島県')); at('1953-12', 'amami', K('鹿児島県'))
at('1946-01', 'ogasawara', K('小笠原（米海軍）')); at('1968-06', 'ogasawara', K('東京都'))
at('1947-05', 'ezo', K('北海道'))
at('1972-05', 'okinawa,sakishima,daito', K('沖縄県'))

with open(os.path.join(HERE, 'admin.tsv'), 'w', encoding='utf-8') as f:
    f.write('# 日本模式：行政區劃（逐月；由 gen.py 產生，勿手改，來源見 gen.py 開頭）。欄位：年月\t單元或群組\t行政區 id\n')
    for m, us, d in A:
        if d is None: continue
        f.write(f'{m}\t{us}\t{d}\n')
print(len(units), 'units,', len(G), 'groups,', len(DIV), 'divisions,', len(A), 'admin rows')
