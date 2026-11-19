#!/usr/bin/env python3
"""
Russia mode: writes region.json (unit groups), divisions.tsv and admin.tsv. Run after units.py.
The administrative layer has four stages, each an approximation drawn on today's units:
  1708–1795  the eight governorates of Peter I (1708) and their successors (approx);
  1796–1917  the governorates and oblasts as of 1914 (each unit given to the governorate that held most of it);
  1918–1991  Soviet union republics (SSR level; RSFSR internal divisions are not drawn);
  1992–      federal subjects of Russia and the neighbouring states; occupied areas as Russia claims them.
Sources:
  https://en.wikipedia.org/wiki/Governorates_of_the_Russian_Empire
  https://en.wikipedia.org/wiki/Administrative_reform_of_Peter_the_Great  (1708)
  https://en.wikipedia.org/wiki/Republics_of_the_Soviet_Union
  https://en.wikipedia.org/wiki/Federal_subjects_of_Russia
  https://en.wikipedia.org/wiki/1954_transfer_of_Crimea
  https://en.wikipedia.org/wiki/Russian_annexation_of_Donetsk,_Kherson,_Luhansk_and_Zaporizhzhia_oblasts
Names of today's federal subjects: Natural Earth (name_en / name_zh / name_ja, from Wikidata).
"""
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
NE = os.environ.get('NE', '/home/claude/dl/ne/geojson')
units = [f['properties']['id'] for f in json.load(open(os.path.join(HERE, '..', 'build', 'russia_units.geojson'), encoding='utf-8'))['features']]
U = set(units)
def L(s): return [x for x in s.split() if x]

G = {}
def grp(name, s):
    us = L(s) if isinstance(s, str) else s
    bad = [u for u in us if u not in U and u not in G]
    assert not bad, (name, bad)
    G[name] = us
RU = [u for u in units if u.startswith('RU-')]
UA = [u for u in units if u.startswith('UA-')]
grp('russia_all', RU + L('vyborg ladoga_k pechenga sak_s kur_s kur_n'))
grp('novgorod_land', 'RU-NGR RU-LEN RU-SPE RU-KR RU-ARK RU-NEN RU-VLG RU-MUR RU-KO vyborg ladoga_k pechenga')
grp('novgorod_core', 'RU-NGR RU-LEN RU-SPE')
grp('north', 'RU-KR RU-ARK RU-NEN RU-VLG RU-MUR RU-KO ladoga_k pechenga')
grp('ingria', 'RU-LEN RU-SPE')
grp('suzdal', 'RU-VLA RU-IVA RU-YAR RU-KOS RU-MOS RU-MOW RU-NIZ')
grp('moscow', 'RU-MOS RU-MOW')
grp('ryazan_l', 'RU-RYA RU-LIP')
grp('chernigov_l', 'UA-74 RU-BRY RU-ORL RU-KRS RU-KLU RU-TUL UA-59')
grp('seversk', 'UA-74 RU-BRY UA-59 RU-KRS')
grp('kiev_l', 'UA-30 UA-32 UA-18 UA-71 UA-53')
grp('galicia', 'UA-46 UA-26 UA-61')
grp('volhynia', 'UA-07 UA-56')
grp('podolia', 'UA-05 UA-68')
grp('belarus', [u for u in units if u.startswith('BY-')])
grp('belarus_e', 'BY-VI BY-MA BY-HO')
grp('belarus_c', 'BY-MI BY-HM')
grp('belarus_w', 'BY-BR BY-HR')
grp('crimea', 'UA-43 UA-40')
grp('donbas', 'UA-14 UA-14-2014 UA-14-west UA-09 UA-09-2014')
grp('wildfields', 'UA-12 UA-35 UA-23 UA-23-south UA-63 UA-63-east donbas')
grp('pontic', 'UA-65 UA-65-left UA-48 UA-51')
grp('ukraine', UA)
grp('ukraine_east', 'UA-63 UA-63-east UA-12 UA-23 UA-23-south UA-65 UA-65-left UA-48 UA-51 UA-35 donbas crimea')
grp('ukraine_core', 'UA-30 UA-32 UA-18 UA-71 UA-53 UA-74 UA-59 UA-05 UA-68 volhynia')
grp('left_bank', 'UA-74 UA-53 UA-59 UA-30')
grp('right_bank', 'UA-32 UA-18 UA-05 UA-71 UA-35 UA-68')
grp('sloboda', 'UA-63 UA-63-east RU-BEL')
grp('don', 'RU-ROS RU-VGG')
grp('south_ru', 'RU-VOR RU-BEL RU-TAM RU-LIP RU-PNZ RU-SAR')
grp('ncauc', 'RU-KDA RU-AD RU-STA RU-KC RU-KB RU-SE RU-IN RU-CE RU-DA')
grp('kuban', 'RU-KDA RU-AD')
grp('east_cauc', 'RU-CE RU-IN RU-DA')
grp('mid_volga', 'RU-TA RU-CU RU-ULY RU-SAM RU-ME RU-MO RU-UD')
grp('kazan_kh', 'RU-TA RU-CU RU-ME RU-UD')
grp('low_volga', 'RU-AST RU-KL')
grp('vyatka_perm', 'RU-KIR RU-PER')
grp('urals', 'RU-BA RU-ORE RU-CHE RU-SVE RU-KGN')
grp('sibir_kh', 'RU-TYU RU-KGN RU-KHM RU-YAN RU-OMS')
grp('w_siberia', 'RU-TOM RU-NVS RU-KEM RU-ALT RU-AL')
grp('e_siberia', 'RU-KYA RU-KK RU-IRK RU-BU RU-ZAB RU-SA')
grp('ne_siberia', 'RU-MAG RU-CHU RU-KAM RU-KHA')
grp('amur', 'RU-AMU RU-YEV RU-PRI')
grp('sakhalin', 'RU-SAK sak_s')
grp('kurils', 'kur_s kur_n')
grp('siberia_all', 'sibir_kh w_siberia e_siberia ne_siberia amur sakhalin kurils RU-TY')
grp('kazakh', [u for u in units if u.startswith('KZ-')])
grp('kz_junior', 'KZ-ZAP KZ-ATY KZ-AKT KZ-MAN')
grp('kz_middle', 'KZ-KUS KZ-SEV KZ-AKM KZ-AST KZ-KAR KZ-PAV KZ-VOS')
grp('kz_senior', 'KZ-ALA KZ-ALC KZ-ZHA')
grp('kz_south', 'KZ-YUZ KZ-KZY')
grp('central_asia', 'uzbekistan turkmenistan kyrgyzstan tajikistan')
grp('baltic', 'estonia latvia lithuania')
grp('scauc', 'georgia abkhazia s_ossetia armenia azerbaijan nk nk_buffer nakhchivan')
grp('georgia_all', 'georgia abkhazia s_ossetia')
grp('azer_all', 'azerbaijan nk nk_buffer nakhchivan')
grp('moldova_all', 'md md_tr')
grp('finland_all', 'finland vyborg ladoga_k pechenga')
grp('ussr_1991', 'russia_all ukraine belarus baltic moldova_all scauc kazakh central_asia RU-KGD')

json.dump({'start': '0862-01', 'end': '2026-12', 'units': 'russia_units.geojson', 'merge': True, 'groups': G},
          open(os.path.join(HERE, 'region.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- divisions
import colorsys
def col(i, h0=0):
    h = (h0 + i * 47) % 360; l = 0.72 + 0.08 * (i % 3) / 2; s = 0.35 + 0.2 * ((i * 7) % 3) / 2
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
def _cc(strings, frm, to):
    js = 'const O=require("opencc-js");const c=O.Converter({from:"%s",to:"%s"});const a=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(JSON.stringify(a.map(x=>c(x))))' % (frm, to)
    return json.loads(subprocess.run(['node', '-e', js], input=json.dumps(strings), capture_output=True, text=True, errors='replace', cwd=os.path.join(HERE, '..', '..')).stdout)
_hant_q = []
def hant(s): _hant_q.append(s); return ('@@H', len(_hant_q) - 1)
DIV = []
def div(i, h, en, ja, c=None): DIV.append([i, c or col(len(DIV)), h, None, en, ja])
div('none', '未設省（公國、汗國等）', 'No governorate (principalities, khanates…)', '県なし（公国・ハン国など）', '#dedad2')
div('foreign', '（俄國以外）', '(outside Russia)', '（ロシア以外）', '#e6e6e6')
# 1708 governorates
for k, h, en, ja in [('g08_moscow', '莫斯科省', 'Moscow', 'モスクワ'), ('g08_ingria', '英格里亞省（聖彼得堡）', 'Ingermanland (St Petersburg)', 'インゲルマンランド（サンクトペテルブルク）'),
                     ('g08_kiev', '基輔省', 'Kiev', 'キエフ'), ('g08_smolensk', '斯摩稜斯克省', 'Smolensk', 'スモレンスク'),
                     ('g08_arch', '阿爾漢格爾斯克省', 'Archangelgorod', 'アルハンゲリスク'), ('g08_kazan', '喀山省', 'Kazan', 'カザン'),
                     ('g08_azov', '亞速省', 'Azov', 'アゾフ'), ('g08_siberia', '西伯利亞省', 'Siberia', 'シベリア'),
                     ('g08_riga', '里加省', 'Riga', 'リガ'), ('g08_astrakhan', '阿斯特拉罕省', 'Astrakhan', 'アストラハン')]:
    div(k, h, en + ' Governorate (1708)', ja + '県（1708）')
# 1914 governorates / oblasts
G14 = [('moscow', '莫斯科', 'Moscow', 'モスクワ', 'RU-MOS RU-MOW'), ('spb', '聖彼得堡', 'St Petersburg', 'サンクトペテルブルク', 'RU-LEN RU-SPE'),
 ('novgorod', '諾夫哥羅德', 'Novgorod', 'ノヴゴロド', 'RU-NGR'), ('pskov', '普斯科夫', 'Pskov', 'プスコフ', 'RU-PSK'), ('tver', '特維爾', 'Tver', 'トヴェリ', 'RU-TVE'),
 ('smolensk', '斯摩稜斯克', 'Smolensk', 'スモレンスク', 'RU-SMO'), ('vladimir', '弗拉基米爾', 'Vladimir', 'ウラジーミル', 'RU-VLA RU-IVA'),
 ('yaroslavl', '雅羅斯拉夫爾', 'Yaroslavl', 'ヤロスラヴリ', 'RU-YAR'), ('kostroma', '科斯特羅馬', 'Kostroma', 'コストロマ', 'RU-KOS'),
 ('nizhny', '下諾夫哥羅德', 'Nizhny Novgorod', 'ニジニ・ノヴゴロド', 'RU-NIZ'), ('vyatka', '維亞特卡', 'Vyatka', 'ヴャトカ', 'RU-KIR RU-UD'),
 ('perm', '彼爾姆', 'Perm', 'ペルミ', 'RU-PER RU-SVE'), ('kaluga', '卡盧加', 'Kaluga', 'カルーガ', 'RU-KLU'), ('tula', '圖拉', 'Tula', 'トゥーラ', 'RU-TUL'),
 ('ryazan', '梁贊', 'Ryazan', 'リャザン', 'RU-RYA'), ('oryol', '奧廖爾', 'Oryol', 'オリョール', 'RU-ORL RU-BRY'), ('kursk', '庫爾斯克', 'Kursk', 'クルスク', 'RU-KRS RU-BEL'),
 ('tambov', '坦波夫', 'Tambov', 'タンボフ', 'RU-TAM RU-LIP'), ('voronezh', '沃羅涅日', 'Voronezh', 'ヴォロネジ', 'RU-VOR'), ('penza', '奔薩', 'Penza', 'ペンザ', 'RU-PNZ RU-MO'),
 ('simbirsk', '辛比爾斯克', 'Simbirsk', 'シンビルスク', 'RU-ULY RU-CU'), ('kazan', '喀山', 'Kazan', 'カザン', 'RU-TA RU-ME'), ('samara', '薩馬拉', 'Samara', 'サマーラ', 'RU-SAM'),
 ('saratov', '薩拉托夫', 'Saratov', 'サラトフ', 'RU-SAR RU-VGG'), ('astrakhan', '阿斯特拉罕', 'Astrakhan', 'アストラハン', 'RU-AST RU-KL'),
 ('don', '頓河軍區', 'Don Host Oblast', 'ドン・コサック軍州', 'RU-ROS'), ('kuban', '庫班州', 'Kuban Oblast', 'クバン州', 'RU-KDA RU-AD RU-KC'),
 ('stavropol', '斯塔夫羅波爾', 'Stavropol', 'スタヴロポリ', 'RU-STA'), ('terek', '捷列克州', 'Terek Oblast', 'テレク州', 'RU-KB RU-SE RU-IN RU-CE'),
 ('dagestan', '達吉斯坦州', 'Dagestan Oblast', 'ダゲスタン州', 'RU-DA'), ('ufa', '烏法', 'Ufa', 'ウファ', 'RU-BA'), ('orenburg', '奧倫堡', 'Orenburg', 'オレンブルク', 'RU-ORE RU-CHE'),
 ('tobolsk', '托博爾斯克', 'Tobolsk', 'トボリスク', 'RU-TYU RU-KHM RU-YAN RU-KGN RU-OMS'), ('tomsk', '托木斯克', 'Tomsk', 'トムスク', 'RU-TOM RU-NVS RU-KEM RU-ALT RU-AL'),
 ('yeniseysk', '葉尼塞', 'Yeniseysk', 'エニセイスク', 'RU-KYA RU-KK'), ('irkutsk', '伊爾庫次克', 'Irkutsk', 'イルクーツク', 'RU-IRK'),
 ('transbaikal', '外貝加爾州', 'Transbaikal Oblast', 'ザバイカル州', 'RU-BU RU-ZAB'), ('yakutsk', '雅庫茨克州', 'Yakutsk Oblast', 'ヤクーツク州', 'RU-SA'),
 ('amur', '阿穆爾州', 'Amur Oblast', 'アムール州', 'RU-AMU RU-YEV'), ('primorye', '濱海州', 'Primorskaya Oblast', '沿海州', 'RU-PRI RU-KHA'),
 ('kamchatka', '堪察加州', 'Kamchatka Oblast', 'カムチャツカ州', 'RU-MAG RU-KAM RU-CHU'), ('sakhalin', '薩哈林州', 'Sakhalin Oblast', 'サハリン州', 'RU-SAK'),
 ('arkh', '阿爾漢格爾斯克', 'Arkhangelsk', 'アルハンゲリスク', 'RU-ARK RU-NEN RU-MUR pechenga'), ('vologda', '沃洛格達', 'Vologda', 'ヴォログダ', 'RU-VLG RU-KO'),
 ('olonets', '奧洛涅茨', 'Olonets', 'オロネツ', 'RU-KR'), ('estland', '愛斯特蘭', 'Estland', 'エストラント', 'estonia'), ('livland', '利夫蘭與庫爾蘭', 'Livland and Courland', 'リヴラント・クールラント', 'latvia'),
 ('kovno', '科夫諾與維爾納', 'Kovno and Vilna', 'コヴノ・ヴィリナ', 'lithuania'), ('grodno', '格羅德諾', 'Grodno', 'グロドノ', 'BY-BR BY-HR'),
 ('vitebsk', '維捷布斯克', 'Vitebsk', 'ヴィテプスク', 'BY-VI'), ('minsk', '明斯克', 'Minsk', 'ミンスク', 'BY-MI BY-HM'), ('mogilev', '莫吉廖夫', 'Mogilev', 'モギリョフ', 'BY-MA BY-HO'),
 ('volhynia', '沃里尼亞', 'Volhynia', 'ヴォルィーニ', 'UA-07 UA-56 UA-18'), ('kiev', '基輔', 'Kiev', 'キエフ', 'UA-30 UA-32 UA-71'), ('podolia', '波多里亞', 'Podolia', 'ポジーリャ', 'UA-05 UA-68'),
 ('chernigov', '切爾尼戈夫', 'Chernigov', 'チェルニーゴフ', 'UA-74'), ('kharkov', '哈爾科夫', 'Kharkov', 'ハリコフ', 'UA-63 UA-63-east UA-59'), ('poltava', '波爾塔瓦', 'Poltava', 'ポルタヴァ', 'UA-53'),
 ('yekaterinoslav', '葉卡捷琳諾斯拉夫', 'Yekaterinoslav', 'エカテリノスラフ', 'UA-12 UA-14 UA-14-2014 UA-14-west UA-09 UA-09-2014 UA-23'),
 ('taurida', '塔夫利達', 'Taurida', 'タヴリーダ', 'UA-43 UA-40 UA-65-left UA-23-south'), ('kherson', '赫爾松', 'Kherson', 'ヘルソン', 'UA-65 UA-48 UA-51 UA-35 md_tr'),
 ('bessarabia', '比薩拉比亞', 'Bessarabia', 'ベッサラビア', 'md'), ('vistula', '維斯瓦邊區（波蘭王國）', 'Vistula Land (Kingdom of Poland)', 'ヴィスワ地方（ポーランド王国）', 'pl_congress'),
 ('finland', '芬蘭大公國', 'Grand Duchy of Finland', 'フィンランド大公国', 'finland vyborg ladoga_k'), ('tiflis', '提弗利斯與庫塔伊西', 'Tiflis and Kutais', 'ティフリス・クタイシ', 'georgia abkhazia s_ossetia'),
 ('erivan', '埃里溫', 'Erivan', 'エレヴァン', 'armenia nakhchivan'), ('baku', '巴庫與伊麗莎白波爾', 'Baku and Elisavetpol', 'バクー・エリザヴェトポリ', 'azerbaijan nk nk_buffer'),
 ('kars', '卡爾斯州', 'Kars Oblast', 'カルス州', 'kars'), ('uralsk', '烏拉爾斯克州', 'Uralsk Oblast', 'ウラリスク州', 'KZ-ZAP KZ-ATY'), ('turgay', '圖爾蓋州', 'Turgay Oblast', 'トゥルガイ州', 'KZ-KUS KZ-AKT'),
 ('akmolinsk', '阿克莫林斯克州', 'Akmolinsk Oblast', 'アクモリンスク州', 'KZ-AKM KZ-AST KZ-SEV KZ-KAR'), ('semipalatinsk', '塞米巴拉金斯克州', 'Semipalatinsk Oblast', 'セミパラチンスク州', 'KZ-VOS KZ-PAV'),
 ('semirechye', '七河州', 'Semirechye Oblast', 'セミレチエ州', 'KZ-ALA KZ-ALC kyrgyzstan'), ('syrdarya', '錫爾河州', 'Syr-Darya Oblast', 'シルダリヤ州', 'KZ-YUZ KZ-ZHA KZ-KZY'),
 ('transcaspia', '外裏海州', 'Transcaspian Oblast', 'ザカスピ州', 'turkmenistan KZ-MAN'), ('turkestan', '突厥斯坦（撒馬爾罕、費爾干納、布哈拉與希瓦保護國）', 'Turkestan (Samarkand, Fergana; Bukhara and Khiva protectorates)', 'トルキスタン（サマルカンド・フェルガナ、ブハラ・ヒヴァ保護国）', 'uzbekistan tajikistan')]
for k, h, en, ja, us in G14:
    div('g14_' + k, h + ('' if h.endswith(('州', '區', '國', '）')) else '省'), en + ('' if en.endswith(('Oblast', ')', 'Finland')) else ' Governorate'), ja + ('' if ja.endswith(('州', '国', '）')) else '県'))
# Soviet republics
SSR = [('rsfsr', '俄羅斯蘇維埃聯邦社會主義共和國', 'Russian SFSR', 'ロシア・ソビエト連邦社会主義共和国'), ('ukrssr', '烏克蘭蘇維埃社會主義共和國', 'Ukrainian SSR', 'ウクライナ・ソビエト社会主義共和国'),
 ('byssr', '白俄羅斯蘇維埃社會主義共和國', 'Byelorussian SSR', '白ロシア・ソビエト社会主義共和国'), ('zsfsr', '外高加索蘇維埃聯邦社會主義共和國', 'Transcaucasian SFSR', 'ザカフカース・ソビエト連邦社会主義共和国'),
 ('uzssr', '烏茲別克蘇維埃社會主義共和國', 'Uzbek SSR', 'ウズベク・ソビエト社会主義共和国'), ('tmssr', '土庫曼蘇維埃社會主義共和國', 'Turkmen SSR', 'トルクメン・ソビエト社会主義共和国'),
 ('tjssr', '塔吉克蘇維埃社會主義共和國', 'Tajik SSR', 'タジク・ソビエト社会主義共和国'), ('kzssr', '哈薩克蘇維埃社會主義共和國', 'Kazakh SSR', 'カザフ・ソビエト社会主義共和国'),
 ('kgssr', '吉爾吉斯蘇維埃社會主義共和國', 'Kirghiz SSR', 'キルギス・ソビエト社会主義共和国'), ('gessr', '喬治亞蘇維埃社會主義共和國', 'Georgian SSR', 'グルジア・ソビエト社会主義共和国'),
 ('amssr', '亞美尼亞蘇維埃社會主義共和國', 'Armenian SSR', 'アルメニア・ソビエト社会主義共和国'), ('azssr', '亞塞拜然蘇維埃社會主義共和國', 'Azerbaijan SSR', 'アゼルバイジャン・ソビエト社会主義共和国'),
 ('kfssr', '卡累利阿—芬蘭蘇維埃社會主義共和國', 'Karelo-Finnish SSR', 'カレロ＝フィン・ソビエト社会主義共和国'), ('mdssr', '摩爾達維亞蘇維埃社會主義共和國', 'Moldavian SSR', 'モルダビア・ソビエト社会主義共和国'),
 ('eessr', '愛沙尼亞蘇維埃社會主義共和國', 'Estonian SSR', 'エストニア・ソビエト社会主義共和国'), ('lvssr', '拉脫維亞蘇維埃社會主義共和國', 'Latvian SSR', 'ラトビア・ソビエト社会主義共和国'),
 ('ltssr', '立陶宛蘇維埃社會主義共和國', 'Lithuanian SSR', 'リトアニア・ソビエト社会主義共和国')]
for i, (k, h, en, ja) in enumerate(SSR): div('s_' + k, h, en, ja, col(i, 10))
# today: federal subjects (Natural Earth names) and neighbours
A1 = json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']
for f in A1:
    p = f['properties']
    if p['adm0_a3'] != 'RUS': continue
    iso = p['iso_3166_2']
    if iso in ('UA-43', 'UA-40', 'RU-X01~'): continue
    div('f_' + iso, hant(p['name_zh'] or p['name_en'] or p['name'] or iso), p['name_en'] or p['name'] or iso, p['name_ja'] or p['name_en'] or p['name'] or iso)
for k, h, en, ja in [('f_crimea', '克里米亞共和國（俄羅斯實際控制）', 'Republic of Crimea (Russian-held)', 'クリミア共和国（ロシア実効支配）'),
                     ('f_sevastopol', '塞瓦斯托波爾（俄羅斯實際控制）', 'Sevastopol (Russian-held)', 'セヴァストポリ（ロシア実効支配）'),
                     ('f_dpr', '頓涅茨克（俄羅斯實際控制）', 'Donetsk (Russian-held)', 'ドネツク（ロシア実効支配）'), ('f_lpr', '盧甘斯克（俄羅斯實際控制）', 'Luhansk (Russian-held)', 'ルハンスク（ロシア実効支配）'),
                     ('f_zap', '札波羅熱（俄羅斯實際控制）', 'Zaporizhzhia (Russian-held)', 'ザポリージャ（ロシア実効支配）'), ('f_khe', '赫爾松（俄羅斯實際控制）', 'Kherson (Russian-held)', 'ヘルソン（ロシア実効支配）'),
                     ('c_ukraine', '烏克蘭', 'Ukraine', 'ウクライナ'), ('c_belarus', '白俄羅斯', 'Belarus', 'ベラルーシ'), ('c_kazakhstan', '哈薩克', 'Kazakhstan', 'カザフスタン'),
                     ('c_baltic', '波羅的海三國', 'Baltic states', 'バルト三国'), ('c_caucasus', '南高加索諸國', 'South Caucasus states', '南カフカス諸国'),
                     ('c_centralasia', '中亞四國', 'Central Asian states', '中央アジア諸国'), ('c_moldova', '摩爾多瓦', 'Moldova', 'モルドバ')]:
    div(k, h, en, ja)
conv = _cc(_hant_q, 'cn', 'tw')
for d in DIV:
    if isinstance(d[2], tuple): d[2] = conv[d[2][1]]
hs = _cc([d[2] for d in DIV], 'tw', 'cn')
for d, h in zip(DIV, hs): d[3] = h
with open(os.path.join(HERE, 'divisions.tsv'), 'w', encoding='utf-8') as f:
    f.write('# 俄羅斯模式：行政區劃（由 gen.py 產生，勿手改）。欄位：id\t顏色\t繁中\t簡中\tEnglish\t日本語\n')
    for d in DIV: f.write('\t'.join(d) + '\n')

# ---------------------------------------------------------------- admin timeline
A = []
def at(m, us, d): A.append((m, us if isinstance(us, str) else ','.join(us), d))
at('0862-01', ','.join(units), 'none')
# 1708: Peter's governorates (Russian lands of 1708); everything else is outside Russia's governorates
at('1708-12', ','.join(units), 'foreign')
at('1708-12', 'moscow RU-VLA RU-IVA RU-YAR RU-KOS RU-RYA RU-KLU RU-TUL RU-TVE', 'g08_moscow')
at('1708-12', 'RU-NGR RU-LEN RU-SPE RU-PSK RU-KR ladoga_k', 'g08_ingria')
at('1708-12', 'left_bank RU-BRY RU-ORL RU-KRS RU-BEL sloboda', 'g08_kiev')
at('1708-12', 'RU-SMO', 'g08_smolensk')
at('1708-12', 'RU-ARK RU-NEN RU-VLG RU-MUR RU-KO', 'g08_arch')
at('1708-12', 'mid_volga RU-NIZ RU-PNZ RU-SAR RU-BA RU-KIR RU-PER', 'g08_kazan')
at('1708-12', 'RU-VOR RU-TAM RU-LIP RU-ROS RU-VGG', 'g08_azov')
at('1708-12', 'RU-SVE RU-CHE RU-KGN sibir_kh w_siberia e_siberia ne_siberia', 'g08_siberia')
at('1717-01', 'low_volga', 'g08_astrakhan'); at('1721-09', 'estonia latvia', 'g08_riga')
# 1796: the governorates of the late empire (as of 1914), for the units Russian at the time
done = set()
def g14(m, us_filter=None):
    for k, h, en, ja, us in G14:
        sel = [u for u in L(us) if (us_filter is None or u in us_filter) and u not in done]
        if sel:
            at(m, sel, 'g14_' + k); done.update(sel)
RUS1796 = set(L('RU-MOS RU-MOW RU-LEN RU-SPE RU-NGR RU-PSK RU-TVE RU-SMO RU-VLA RU-IVA RU-YAR RU-KOS RU-NIZ RU-KIR RU-UD RU-PER RU-SVE RU-KLU RU-TUL RU-RYA '
               'RU-ORL RU-BRY RU-KRS RU-BEL RU-TAM RU-LIP RU-VOR RU-PNZ RU-MO RU-ULY RU-CU RU-TA RU-ME RU-SAM RU-SAR RU-VGG RU-AST RU-KL RU-ROS RU-STA '
               'RU-BA RU-ORE RU-CHE RU-TYU RU-KHM RU-YAN RU-KGN RU-OMS RU-TOM RU-NVS RU-KEM RU-ALT RU-AL RU-KYA RU-KK RU-IRK RU-BU RU-ZAB RU-SA '
               'RU-MAG RU-KAM RU-CHU RU-ARK RU-NEN RU-MUR RU-VLG RU-KO RU-KR estonia latvia lithuania BY-BR BY-HR BY-VI BY-MI BY-HM BY-MA BY-HO '
               'UA-07 UA-56 UA-18 UA-30 UA-32 UA-71 UA-05 UA-68 UA-74 UA-63 UA-63-east UA-59 UA-53 UA-12 UA-14 UA-14-2014 UA-14-west UA-09 UA-09-2014 '
               'UA-23 UA-43 UA-40 UA-65-left UA-23-south UA-65 UA-48 UA-35 md_tr RU-KDA RU-AD'))
g14('1796-12', RUS1796)
g14('1809-09', set(L('finland vyborg ladoga_k')))
g14('1812-05', set(L('md UA-51')))
g14('1815-06', set(L('pl_congress')))
g14('1801-09', set(L('georgia')))
g14('1813-10', set(L('azerbaijan nk nk_buffer RU-DA')))
g14('1828-02', set(L('armenia nakhchivan RU-KC')))
g14('1859-08', set(L('RU-KB RU-SE RU-IN RU-CE')))
g14('1864-06', set(L('abkhazia s_ossetia')))
g14('1847-01', set(L('KZ-ZAP KZ-ATY KZ-KUS KZ-AKT KZ-AKM KZ-AST KZ-SEV KZ-KAR KZ-VOS KZ-PAV')))
g14('1854-01', set(L('KZ-ALA KZ-ALC')))
g14('1858-05', set(L('RU-AMU RU-YEV')))
g14('1860-11', set(L('RU-PRI RU-KHA')))
g14('1865-06', set(L('KZ-YUZ KZ-ZHA KZ-KZY')))
g14('1868-06', set(L('uzbekistan tajikistan')))
g14('1875-05', set(L('RU-SAK')))
g14('1876-03', set(L('kyrgyzstan')))
g14('1878-07', set(L('kars')))
g14('1881-01', set(L('turkmenistan KZ-MAN')))
at('1867-10', 'alaska', 'foreign')
at('1905-09', 'sak_s', 'foreign'); at('1875-05', 'kur_n', 'foreign')
# Soviet republics
at('1918-01', 'russia_all low_volga', 's_rsfsr')
at('1917-12', 'finland_all', 'foreign'); at('1918-02', 'baltic', 'foreign'); at('1918-11', 'pl_congress', 'foreign')
at('1918-04', 'md', 'foreign'); at('1921-03', 'kars', 'foreign')
at('1919-03', 'ukraine', 's_ukrssr'); at('1919-01', 'belarus', 's_byssr'); at('1921-03', 'belarus_w', 'foreign')
at('1921-03', 'galicia volhynia', 'foreign'); at('1919-06', 'UA-21', 'foreign')
at('1918-01', 'kazakh central_asia', 's_rsfsr')
at('1922-03', 'scauc', 's_zsfsr')
at('1924-10', 'uzbekistan tajikistan', 's_uzssr'); at('1924-10', 'turkmenistan', 's_tmssr'); at('1929-10', 'tajikistan', 's_tjssr')
at('1936-12', 'kazakh', 's_kzssr'); at('1936-12', 'kyrgyzstan', 's_kgssr')
at('1936-12', 'georgia_all', 's_gessr'); at('1936-12', 'armenia', 's_amssr'); at('1936-12', 'azer_all', 's_azssr')
at('1939-11', 'galicia volhynia', 's_ukrssr'); at('1939-11', 'belarus_w', 's_byssr')
at('1940-03', 'RU-KR ladoga_k', 's_kfssr'); at('1940-03', 'vyborg', 's_rsfsr')
at('1940-08', 'md md_tr', 's_mdssr'); at('1940-08', 'UA-77', 's_ukrssr')
at('1940-08', 'estonia', 's_eessr'); at('1940-08', 'latvia', 's_lvssr'); at('1940-08', 'lithuania', 's_ltssr')
at('1944-10', 'RU-TY pechenga', 's_rsfsr'); at('1945-06', 'UA-21', 's_ukrssr'); at('1945-04', 'RU-KGD', 's_rsfsr')
at('1945-09', 'sak_s kurils', 's_rsfsr')
at('1954-02', 'crimea', 's_ukrssr')
at('1956-07', 'RU-KR ladoga_k', 's_rsfsr')
# after 1991
for f in A1:
    p = f['properties']
    if p['adm0_a3'] != 'RUS': continue
    iso = p['iso_3166_2']
    if iso in ('UA-43', 'UA-40', 'RU-X01~'): continue
    extra = {'RU-LEN': 'RU-LEN vyborg', 'RU-KR': 'RU-KR ladoga_k', 'RU-MUR': 'RU-MUR pechenga', 'RU-SAK': 'RU-SAK sak_s kur_s kur_n'}.get(iso, iso)
    at('1992-01', extra, 'f_' + iso)
at('1991-12', 'ukraine', 'c_ukraine'); at('1991-12', 'belarus', 'c_belarus'); at('1991-12', 'kazakh', 'c_kazakhstan')
at('1991-09', 'baltic', 'c_baltic'); at('1991-12', 'scauc', 'c_caucasus'); at('1991-12', 'central_asia', 'c_centralasia'); at('1991-12', 'moldova_all', 'c_moldova')
at('2014-03', 'UA-43', 'f_crimea'); at('2014-03', 'UA-40', 'f_sevastopol')
at('2022-10', 'UA-14 UA-14-2014', 'f_dpr'); at('2022-10', 'UA-09 UA-09-2014', 'f_lpr')
at('2022-10', 'UA-23-south', 'f_zap'); at('2022-10', 'UA-65-left', 'f_khe')
with open(os.path.join(HERE, 'admin.tsv'), 'w', encoding='utf-8') as f:
    f.write('# 俄羅斯模式：行政區劃（逐月；由 gen.py 產生，勿手改，來源見 gen.py 開頭）。欄位：年月\t單元或群組\t行政區 id\n')
    for m, us, d in A:
        f.write(f"{m}\t{','.join(L(us.replace(',', ' ')))}\t{d}\n")
print(len(units), 'units,', len(G), 'groups,', len(DIV), 'divisions,', len(A), 'admin rows')
