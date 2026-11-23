# 人為災害地圖：世界各地的事件（台灣、日本另見 source_tw_jp.py）。由 make_tsv.py 合併成 disasters.tsv。
# 欄位說明見 make_tsv.py。數字有爭議者寫成區間，並在說明中交代官方與估計的差別。
E = []
def ev(**k): E.append(k)

# ---------------------------------------------------------------- 1800–1945
ev(id='puentes', c='dam', dt='1802-04-30', lon=-1.80, lat=37.73, sh='c:6', rt='-1.80,37.73 -1.70,37.68 -1.55,37.62', rd=1, sz=2,
   zh='蓬特斯水壩潰決', en='Puentes Dam failure', ja='プエンテス・ダム決壊',
   dzh='西班牙洛爾卡上游的蓬特斯水壩因地基滲漏崩潰，洪水沖毀洛爾卡城郊。', den='The Puentes Dam above Lorca, Spain, gave way through its foundations; the flood swept the outskirts of Lorca.',
   dead='608', mzh='', men='', rzh='洛爾卡一帶沿瓜達倫廷河的淹沒區（示意）', ren='Flooding along the Guadalentín around Lorca (sketch)', wzh='', wen='Puentes Dam')
ev(id='sheffield', c='dam', dt='1864-03-11', lon=-1.62, lat=53.42, rt='-1.62,53.42 -1.55,53.41 -1.48,53.39 -1.43,53.41 -1.36,53.43', rd=1, sz=2,
   zh='謝菲爾德大洪水', en='Great Sheffield Flood', ja='シェフィールド大洪水',
   dzh='新建的戴爾戴克水壩在首次蓄水時潰決，洪水沿洛克斯利河與頓河沖進謝菲爾德。', den='The new Dale Dyke Dam failed on first filling; the flood ran down the Loxley and the Don into Sheffield.',
   dead='238–240', mzh='', men='', rzh='洛克斯利河、頓河沿岸', ren='Along the Loxley and the Don', wzh='謝菲爾德大洪水', wen='Great Sheffield Flood')
ev(id='johnstown', c='dam', dt='1889-05-31', lon=-78.77, lat=40.35, rt='-78.77,40.35 -78.84,40.34 -78.92,40.33', rd=1, sz=3,
   zh='約翰斯敦洪水', en='Johnstown Flood', ja='ジョンズタウン洪水',
   dzh='維護不良的南福克水壩在豪雨中潰決，洪水在一小時內沖毀下游的約翰斯敦。', den='The poorly kept South Fork Dam failed in heavy rain; within an hour the flood destroyed Johnstown downstream.',
   dead='2209', mzh='', men='', rzh='小科內莫河谷到約翰斯敦', ren='Little Conemaugh valley to Johnstown', wzh='約翰斯敦洪水', wen='Johnstown Flood')
ev(id='halifax', c='chem', dt='1917-12-06', lon=-63.58, lat=44.67, sh='c:2.6', sz=3,
   zh='哈利法克斯大爆炸', en='Halifax Explosion', ja='ハリファックス大爆発',
   dzh='滿載炸藥的法國貨輪白朗峰號在港內與挪威船相撞起火爆炸，夷平哈利法克斯北區，是核武出現前最大的人為爆炸之一。', den='The French munitions ship Mont-Blanc caught fire after a collision in the harbour and exploded, levelling Halifax\'s North End: one of the largest man-made explosions before nuclear weapons.',
   dead='1782', mzh='約 9,000 人受傷', men='About 9,000 injured', rzh='全毀半徑約 2.6 公里', ren='Total destruction within about 2.6 km', wzh='哈利法克斯大爆炸', wen='Halifax Explosion')
ev(id='oppau', c='chem', dt='1921-09-21', lon=8.40, lat=49.52, sh='c:1.5', sz=2,
   zh='奧堡爆炸', en='Oppau explosion', ja='オッパウ爆発事故',
   dzh='巴斯夫奧堡廠以炸藥鬆開結塊的硫酸銨硝酸銨肥料時引發大爆炸。', den='Blasting to loosen caked ammonium sulfate-nitrate fertiliser at BASF\'s Oppau plant set off a huge explosion.',
   dead='500–600', mzh='', men='', rzh='廠區與奧堡村大部毀損', ren='The plant and most of Oppau destroyed', wzh='奧堡爆炸', wen='Oppau explosion')
ev(id='gleno', c='dam', dt='1923-12-01', lon=10.12, lat=46.03, rt='10.12,46.03 10.10,45.98 10.07,45.92', rd=1, sz=2,
   zh='格萊諾水壩潰決', en='Gleno Dam disaster', ja='グレーノ・ダム決壊',
   dzh='義大利貝加莫山區新建的格萊諾水壩完工不久即崩潰，洪水沖毀下游村莊。', den='The newly built Gleno Dam in the Bergamo Alps collapsed soon after completion, destroying villages below.',
   dead='356', mzh='', men='', rzh='代齊奧河谷', ren='The Dezzo valley', wzh='', wen='Gleno Dam')
ev(id='stfrancis', c='dam', dt='1928-03-12', lon=-118.41, lat=34.55, rt='-118.41,34.55 -118.60,34.43 -118.85,34.40 -119.07,34.35 -119.27,34.23', rd=1, sz=2,
   zh='聖法蘭西斯水壩潰決', en='St. Francis Dam disaster', ja='セント・フランシス・ダム決壊',
   dzh='洛杉磯供水用的聖法蘭西斯水壩在半夜崩潰，洪水沿聖克拉拉河奔流約 87 公里入海。', den='Los Angeles\'s St. Francis Dam collapsed at night; the flood ran some 87 km down the Santa Clara River to the sea.',
   dead='431+', mzh='', men='', rzh='聖弗朗西斯基托峽谷到聖克拉拉河口', ren='San Francisquito Canyon to the mouth of the Santa Clara', wzh='聖法蘭西斯水壩', wen='St. Francis Dam')
ev(id='meuse', c='air', dt='1930-12-01', b=1930, lon=5.45, lat=50.60, sh='e:12,3,60', sz=2,
   zh='默茲河谷煙霧事件', en='Meuse Valley fog', ja='ミューズ渓谷事件',
   dzh='比利時列日附近的工業河谷在逆溫下積聚工廠廢氣，數日內數十人死亡，是最早有紀錄的空氣污染致死事件之一。', den='Factory fumes trapped by an inversion in the industrial valley near Liège killed dozens within days: one of the first recorded deadly air-pollution events.',
   dead='63', mzh='', men='', rzh='列日—於伊之間的默茲河谷', ren='The Meuse valley between Liège and Huy', wzh='', wen='1930 Meuse Valley fog')
ev(id='texascity', c='chem', dt='1947-04-16', lon=-94.90, lat=29.38, sh='c:2', sz=2,
   zh='德州城災難', en='Texas City disaster', ja='テキサスシティ大爆発',
   dzh='停在德州城港的格蘭康號所載硝酸銨起火爆炸，引燃鄰船與煉油設施。', den='The ammonium nitrate aboard the Grandcamp in Texas City harbour caught fire and exploded, setting off neighbouring ships and refineries.',
   dead='581', mzh='', men='', rzh='港區與周邊', ren='The port and its surroundings', wzh='德克薩斯城災難', wen='Texas City disaster')
ev(id='donora', c='air', dt='1948-10-27', lon=-79.86, lat=40.18, sh='e:5,2,60', sz=1,
   zh='多諾拉煙霧事件', en='1948 Donora smog', ja='ドノラ事件',
   dzh='賓州多諾拉的鋅廠與鋼廠廢氣被逆溫困在河谷五天，數千人生病。', den='Fumes from the zinc and steel works of Donora, Pennsylvania, were trapped in the valley for five days; thousands fell ill.',
   dead='20', mzh='約 6,000 人生病', men='About 6,000 fell ill', rzh='莫農加希拉河谷', ren='The Monongahela valley', wzh='多諾拉煙霧事件', wen='1948 Donora smog')
# ---------------------------------------------------------------- 1949–1979
ev(id='techa', c='nuclear', dt='1949', b=1956, k=2026, lon=61.10, lat=55.70, rt='61.10,55.70 61.60,55.85 62.20,56.05 62.90,56.30 63.60,56.45', rd=2000, sz=2,
   zh='捷恰河放射性污染', en='Techa River contamination', ja='テチャ川の放射能汚染',
   dzh='蘇聯馬雅克核設施 1949–1956 年把大量放射性廢水直接排入捷恰河，沿岸居民長期受曝露，許多村莊後來遷離。', den='From 1949 to 1956 the Soviet Mayak complex discharged radioactive waste straight into the Techa; people along the river were exposed for years and many villages were later moved.',
   dead='', mzh='沿岸約 2 萬 8 千人受曝露', men='About 28,000 riverside residents exposed', rzh='捷恰河沿岸（示意）', ren='Along the Techa (sketch)', wzh='', wen='Techa River')
ev(id='semipalatinsk', c='war', dt='1949-08-29', b=1989, k=2026, lon=78.4, lat=50.1, sh='c:75', sz=2,
   zh='塞米巴拉金斯克核試場', en='Semipalatinsk Test Site', ja='セミパラチンスク核実験場',
   dzh='蘇聯在哈薩克草原進行了四百多次核試，周邊居民長期受到落塵影響。', den='The Soviet Union carried out over 400 nuclear tests on the Kazakh steppe; people around the site lived with the fallout for decades.',
   dead='', mzh='核試 456 次（1949–1989）', men='456 tests (1949–1989)', rzh='試驗場範圍約 1 萬 8 千平方公里（示意）', ren='Test site of about 18,000 km² (sketch)', wzh='塞米巴拉金斯克核試驗場', wen='Semipalatinsk Test Site')
ev(id='london', c='air', dt='1952-12-05', lon=-0.12, lat=51.50, sh='c:30', sz=3,
   zh='倫敦大霧霾', en='Great Smog of London', ja='ロンドンスモッグ',
   dzh='寒冷無風的五天裡燃煤煙霧籠罩倫敦，當時估計約 4,000 人死亡，後來研究估計達 1 萬人以上，促成 1956 年《清潔空氣法》。', den='For five cold, windless days coal smoke smothered London. About 4,000 deaths were counted at the time; later studies put the toll above 10,000. It led to the Clean Air Act of 1956.',
   dead='4000–12000', mzh='', men='', rzh='大倫敦地區', ren='Greater London', wzh='倫敦煙霧事件', wen='Great Smog of London')
ev(id='bravo', c='war', dt='1954-03-01', lon=165.27, lat=11.69, sh='p:560,110,80', gd=2, sz=3,
   zh='布拉沃城堡核試落塵', en='Castle Bravo fallout', ja='キャッスル・ブラボー（第五福竜丸事件）',
   dzh='美國在比基尼環礁試爆的氫彈威力遠超預期，落塵飄到朗格拉普等環礁與日本漁船第五福龍丸，船員久保山愛吉於半年後去世。', den='The US hydrogen-bomb test at Bikini was far stronger than expected; fallout came down on Rongelap and other atolls and on the Japanese fishing boat Daigo Fukuryū Maru, whose radioman Kuboyama Aikichi died six months later.',
   dead='1+', mzh='威力 1,500 萬噸', men='15 megatons', rzh='落塵帶（依美方事後圖示簡化）', ren='Fallout pattern (simplified from the US post-test map)', wzh='布拉沃城堡', wen='Castle Bravo')
ev(id='kyshtym', c='nuclear', dt='1957-09-29', b=1958, k=2026, lon=60.80, lat=55.71, sh='p:300,40,25', gd=10, sz=3,
   zh='克什特姆核事故', en='Kyshtym disaster', ja='ウラル核惨事',
   dzh='馬雅克核設施的高放射性廢液儲槽冷卻失效爆炸，污染帶向東北延伸約 300 公里，形成「東烏拉爾放射性痕跡」，蘇聯對外隱瞞多年。', den='A cooling failure made a tank of high-level waste at Mayak explode. The plume left the East Urals Radioactive Trace, some 300 km long to the north-east; the Soviet Union kept it secret for years.',
   dead='', mzh='INES 第 6 級', men='INES level 6', rzh='東烏拉爾放射性痕跡（長約 300、寬 30–50 公里）', ren='East Urals Radioactive Trace (about 300 km by 30–50 km)', wzh='克什特姆核事故', wen='Kyshtym disaster')
ev(id='windscale', c='nuclear', dt='1957-10-10', lon=-3.50, lat=54.42, sh='p:60,20,150', gd=2, sz=2,
   zh='溫斯喬火災', en='Windscale fire', ja='ウィンズケール原子炉火災事故',
   dzh='英國溫斯喬鈽生產反應爐起火三天，放射性碘外洩，周邊約 500 平方公里的牛奶被禁售。', den='A plutonium-production reactor at Windscale burned for three days and released radioactive iodine; milk from about 500 km² around was banned.',
   dead='', mzh='INES 第 5 級', men='INES level 5', rzh='禁售牛奶的海岸地帶（示意）', ren='Coastal strip where milk was banned (sketch)', wzh='溫斯喬火災', wen='Windscale fire')
ev(id='malpasset', c='dam', dt='1959-12-02', lon=6.76, lat=43.51, rt='6.76,43.51 6.75,43.47 6.74,43.43', rd=1, sz=2,
   zh='馬爾帕塞水壩潰決', en='Malpasset Dam failure', ja='マルパッセ・ダム決壊',
   dzh='法國南部的馬爾帕塞拱壩因岩盤破裂崩潰，洪水沖進弗雷瑞斯。', den='The Malpasset arch dam in southern France failed when the rock beneath it gave way; the flood swept into Fréjus.',
   dead='423', mzh='', men='', rzh='雷蘭河谷到弗雷瑞斯', ren='The Reyran valley to Fréjus', wzh='馬爾帕塞水壩', wen='Malpasset Dam')
ev(id='agentorange', c='war', dt='1961-08', b=1971, k=2026, lon=106.6, lat=11.9, sh='g:104.5,10.4 105.2,9.0 106.8,9.3 107.6,10.8 108.9,12.9 108.8,15.0 107.6,16.4 106.8,17.0 106.0,16.2 107.2,14.2 106.6,12.6 105.4,11.6', sz=3,
   zh='越戰橙劑噴灑', en='Agent Orange in the Vietnam War', ja='ベトナム戦争の枯葉剤散布',
   dzh='美軍以含戴奧辛的落葉劑大規模噴灑南越森林與農田，戴奧辛殘留與健康影響延續至今；受害人數各方說法差距很大。', den='US forces sprayed dioxin-laced defoliants over South Vietnam\'s forests and fields; the dioxin and its health effects persist, and estimates of the victims differ widely.',
   dead='', mzh='噴灑約 7,600 萬公升落葉劑', men='About 76 million litres of herbicide sprayed', rzh='南越噴灑地區（概略）', ren='Areas sprayed in South Vietnam (rough)', wzh='橙劑', wen='Agent Orange')
ev(id='sl1', c='nuclear', dt='1961-01-03', lon=-112.82, lat=43.52, sh='c:1', sz=1, det=1,
   zh='SL-1 反應爐事故', en='SL-1 accident', ja='SL-1 事故',
   dzh='美國愛達荷州的軍用小型反應爐因控制棒被抽出過多瞬間超臨界爆炸。', den='A small US Army reactor in Idaho went prompt-critical when a control rod was pulled out too far.',
   dead='3', mzh='INES 第 4 級', men='INES level 4', rzh='反應爐建築', ren='The reactor building', wzh='SL-1事故', wen='SL-1')
ev(id='vajont', c='dam', dt='1963-10-09', lon=12.33, lat=46.27, sh='c:3', rt='12.33,46.27 12.31,46.27 12.30,46.26', rd=1, sz=3,
   zh='瓦伊昂水壩災難', en='Vajont Dam disaster', ja='バイオントダム災害',
   dzh='托克山崩落進瓦伊昂水庫，激起的巨浪越過壩頂沖毀下游的隆加羅內；壩體本身未垮，警訊卻長期被忽視。', den='A landslide from Monte Toc fell into the Vajont reservoir; the wave overtopped the dam and wiped out Longarone below. The dam held, but the warnings had long been ignored.',
   dead='1917–2000', mzh='', men='', rzh='隆加羅內與皮亞韋河谷', ren='Longarone and the Piave valley', wzh='瓦依昂水壩', wen='Vajont Dam')
ev(id='palomares', c='war', dt='1966-01-17', lon=-1.80, lat=37.25, sh='c:2', sz=1, det=1,
   zh='帕洛馬雷斯核彈事故', en='1966 Palomares B-52 crash', ja='パロマレス米軍機墜落事故',
   dzh='美軍轟炸機在西班牙上空空中加油時相撞，兩枚氫彈的傳統炸藥爆炸，鈽散布在農地。', den='A US bomber collided with its tanker over Spain; the conventional explosives of two hydrogen bombs went off and scattered plutonium over farmland.',
   dead='0', mzh='', men='', rzh='鈽污染農地約 2 平方公里', ren='About 2 km² of farmland contaminated', wzh='帕洛馬雷斯事件', wen='1966 Palomares B-52 crash')
ev(id='torrey', c='marine', dt='1967-03-18', lon=-6.50, lat=50.04, sh='g:-6.5,50.04 -5.6,50.25 -5.0,50.2 -4.5,49.7 -4.0,48.9 -3.4,48.85 -4.6,48.6 -5.4,48.9 -6.6,49.8', gd=40, sz=3,
   zh='托里峽谷號漏油', en='Torrey Canyon oil spill', ja='トリー・キャニオン号座礁事故',
   dzh='超級油輪托里峽谷號在英國錫利群島附近觸礁，原油污染康瓦爾與布列塔尼海岸；英國甚至轟炸船體燒油。', den='The supertanker Torrey Canyon ran aground near the Isles of Scilly; its crude fouled Cornwall and Brittany, and Britain bombed the wreck to burn the oil.',
   dead='0', mzh='原油約 11 萬 9 千噸', men='About 119,000 t of crude', rzh='康瓦爾與布列塔尼沿岸（示意）', ren='Coasts of Cornwall and Brittany (sketch)', wzh='托里峽谷號', wen='Torrey Canyon oil spill')
ev(id='thule', c='war', dt='1968-01-21', lon=-68.9, lat=76.53, sh='c:3', sz=1, det=1,
   zh='圖勒空軍基地核彈事故', en='1968 Thule Air Base B-52 crash', ja='チューレ空軍基地 B-52 墜落事故',
   dzh='載有四枚氫彈的美軍轟炸機墜毀在格陵蘭海冰上，鈽散落冰面。', den='A US bomber carrying four hydrogen bombs crashed on the sea ice off Greenland, scattering plutonium.',
   dead='1', mzh='', men='', rzh='墜機處海冰', ren='The sea ice at the crash site', wzh='', wen='1968 Thule Air Base B-52 crash')
ev(id='santabarbara', c='marine', dt='1969-01-28', lon=-119.60, lat=34.33, sh='e:55,18,100', gd=30, sz=2,
   zh='聖塔芭芭拉漏油', en='1969 Santa Barbara oil spill', ja='サンタバーバラ原油流出事故',
   dzh='加州外海鑽油平台井噴，原油污染聖塔芭芭拉海岸，催生了美國的環保運動與「地球日」。', den='A blowout at an offshore platform fouled the Santa Barbara coast and helped start the US environmental movement and Earth Day.',
   dead='0', mzh='原油約 8–10 萬桶', men='80,000–100,000 barrels of crude', rzh='海面油污（示意）', ren='Slick at sea (sketch)', wzh='', wen='1969 Santa Barbara oil spill')
ev(id='buffalocreek', c='dam', dt='1972-02-26', lon=-81.75, lat=37.75, rt='-81.75,37.75 -81.70,37.72 -81.62,37.68 -81.55,37.65', rd=1, sz=1,
   zh='水牛溪洪水', en='Buffalo Creek flood', ja='バッファロー・クリーク洪水',
   dzh='西維吉尼亞州煤礦公司的煤渣堆壩在豪雨中潰決，泥流沖毀下游十幾個礦村。', den='A coal-waste dam of a mining company in West Virginia failed in heavy rain; the slurry destroyed more than a dozen mining hamlets downstream.',
   dead='125', mzh='', men='', rzh='水牛溪谷', ren='The Buffalo Creek hollow', wzh='', wen='Buffalo Creek flood')
ev(id='flixborough', c='chem', dt='1974-06-01', lon=-0.70, lat=53.62, sh='c:1', sz=1,
   zh='弗利克斯伯勒爆炸', en='Flixborough disaster', ja='フリックスボロ化学工場爆発',
   dzh='英國化工廠臨時旁通管破裂，環己烷蒸氣雲爆炸，改變了英國化工安全法規。', den='A temporary bypass pipe at a British chemical works burst; the cyclohexane cloud exploded, reshaping British process-safety law.',
   dead='28', mzh='', men='', rzh='廠區', ren='The works', wzh='', wen='Flixborough disaster')
ev(id='banqiao', c='dam', dt='1975-08-08', lon=113.62, lat=33.0, sh='g:113.4,33.1 114.2,33.3 115.3,33.1 116.0,32.8 115.6,32.5 114.6,32.6 113.9,32.7', gd=4, sz=3,
   zh='板橋水庫潰壩', en='Banqiao Dam failure', ja='板橋ダム決壊',
   dzh='颱風妮娜帶來的特大暴雨下，河南板橋、石漫灘等六十多座水庫相繼潰決，駐馬店一帶大片淹沒。直接死亡官方數字約 2 萬 6 千人，連同之後的饑荒與疫病，估計高達 17 萬人以上；當時嚴密封鎖消息。', den='In the torrential rain of Typhoon Nina, the Banqiao, Shimantan and some sixty other dams in Henan failed one after another and the Zhumadian area went under. The official toll of direct deaths is about 26,000; with the famine and disease that followed, estimates reach more than 170,000. News was suppressed at the time.',
   dead='26000–171000+', mzh='60 多座水庫潰決', men='More than 60 dams failed', rzh='淮河上游淹沒區（概略）', ren='Flooded area of the upper Huai (rough)', wzh='1975年河南水災', wen='1975 Banqiao Dam failure')
ev(id='teton', c='dam', dt='1976-06-05', lon=-111.54, lat=43.91, rt='-111.54,43.91 -111.66,43.88 -111.79,43.83 -111.95,43.75', rd=1, sz=1,
   zh='提頓水壩潰決', en='Teton Dam failure', ja='ティートン・ダム決壊',
   dzh='美國愛達荷州剛完工的提頓土壩在首次蓄水時潰決。', den='The newly built Teton earth dam in Idaho failed on first filling.',
   dead='11', mzh='', men='', rzh='提頓河與斯內克河谷', ren='The Teton and Snake valleys', wzh='', wen='Teton Dam')
ev(id='seveso', c='chem', dt='1976-07-10', b=1977, k=1984, lon=9.13, lat=45.65, sh='p:6,1.6,165', gd=2, sz=2,
   zh='塞維索戴奧辛外洩', en='Seveso disaster', ja='セベソ事故',
   dzh='義大利塞維索附近的化工廠反應槽過熱，含戴奧辛的煙雲飄落附近城鎮，數千隻動物死亡、約 8 萬隻被撲殺；促成歐洲的「塞維索指令」。', den='A reactor overheated at a chemical plant near Seveso; a dioxin cloud settled on nearby towns. Thousands of animals died and about 80,000 were slaughtered. It led to the EU\'s Seveso Directive.',
   dead='0', mzh='污染區 A、B、R 共約 18 平方公里', men='Zones A, B and R, about 18 km² in all', rzh='官方劃設的污染區（簡化）', ren='Official contamination zones (simplified)', wzh='塞維索事件', wen='Seveso disaster')
ev(id='amococadiz', c='marine', dt='1978-03-16', lon=-4.72, lat=48.58, sh='g:-4.75,48.6 -4.4,48.68 -3.8,48.72 -3.2,48.85 -3.0,48.75 -3.6,48.62 -4.3,48.5 -4.8,48.35 -4.95,48.45', gd=30, sz=3,
   zh='阿莫科卡迪茲號漏油', en='Amoco Cadiz oil spill', ja='アモコ・カディス号座礁事故',
   dzh='油輪舵機故障在布列塔尼外海觸礁斷裂，原油全部外洩，約 360 公里海岸受污染。', den='The tanker lost her steering off Brittany, ran aground and broke up, spilling her entire cargo onto about 360 km of coast.',
   dead='0', mzh='原油約 22 萬 3 千噸', men='About 223,000 t of crude', rzh='布列塔尼北岸（示意）', ren='North coast of Brittany (sketch)', wzh='', wen='Amoco Cadiz oil spill')
ev(id='lovecanal', c='chem', dt='1978-08-02', k=2004, lon=-79.00, lat=43.08, sh='c:1', sz=1,
   zh='拉夫運河事件', en='Love Canal', ja='ラブ・カナル事件',
   dzh='紐約州尼加拉瀑布市的住宅區蓋在化學廢棄物填埋場上，有毒物質滲出，美國宣布緊急狀態並遷走居民，促成「超級基金法」。', den='A neighbourhood of Niagara Falls, New York, had been built on a chemical dump. Toxins seeped out; a federal emergency was declared, families were moved, and the Superfund law followed.',
   dead='', mzh='約 800 戶遷離', men='About 800 families moved', rzh='填埋場與周邊住宅區', ren='The dump and the houses around it', wzh='拉夫運河事件', wen='Love Canal')
ev(id='tmi', c='nuclear', dt='1979-03-28', lon=-76.72, lat=40.15, sh='c:8', sz=2,
   zh='三哩島核事故', en='Three Mile Island accident', ja='スリーマイル島原子力発電所事故',
   dzh='美國賓州三哩島核電廠二號機冷卻水流失，爐心部分熔毀；州長建議 8 公里內的孕婦與幼童撤離。', den='Unit 2 at Three Mile Island, Pennsylvania, lost coolant and its core partly melted; the governor advised pregnant women and young children within 8 km to leave.',
   dead='0', mzh='INES 第 5 級', men='INES level 5', rzh='8 公里撤離建議範圍', ren='8 km evacuation advisory', wzh='三哩島核洩漏事故', wen='Three Mile Island accident')
ev(id='ixtoc', c='marine', dt='1979-06-03', b=1980, lon=-92.30, lat=19.40, sh='g:-92.3,19.4 -93.5,20.6 -95.5,22.8 -97.3,25.5 -97.6,27.2 -96.8,27.4 -95.8,25.0 -94.6,22.6 -92.8,20.6 -91.6,19.6', gd=290, sz=3,
   zh='伊斯托克一號井噴', en='Ixtoc I oil spill', ja='イストク I 油井噴出事故',
   dzh='墨西哥坎佩切灣的鑽油井井噴，漏油近十個月才封住，油污漂到德州海岸。', den='An exploratory well in Mexico\'s Bay of Campeche blew out and leaked for almost ten months; the oil reached the Texas coast.',
   dead='0', mzh='原油約 330–350 萬桶', men='3.3–3.5 million barrels of crude', rzh='油污漂流範圍（概略）', ren='Area reached by the slick (rough)', wzh='伊斯托克一號', wen='Ixtoc I oil spill')
ev(id='atlanticempress', c='marine', dt='1979-07-19', lon=-60.33, lat=11.98, sh='c:30', sz=1,
   zh='大西洋女皇號撞船漏油', en='Atlantic Empress oil spill', ja='アトランティック・エンプレス号事故',
   dzh='兩艘超級油輪在托巴哥外海相撞起火，是史上最大的船舶漏油，所幸大部分油在海上燃燒或分散。', den='Two supertankers collided off Tobago and caught fire: the largest ship-borne spill on record, though most of the oil burned or dispersed at sea.',
   dead='26', mzh='原油約 28 萬 7 千噸', men='About 287,000 t of crude', rzh='海面（示意）', ren='At sea (sketch)', wzh='', wen='Atlantic Empress')
ev(id='churchrock', c='dam', dt='1979-07-16', lon=-108.50, lat=35.62, rt='-108.50,35.62 -108.62,35.55 -108.75,35.52 -109.05,35.40 -109.40,35.18 -109.65,35.02', rd=5, sz=1,
   zh='教堂岩鈾尾礦外洩', en='Church Rock uranium mill spill', ja='チャーチロック・ウラン鉱滓流出事故',
   dzh='新墨西哥州鈾礦廠的尾礦壩破裂，放射性泥水沿普埃科河流進納瓦荷族的土地，是美國史上最大的放射性物質外洩。', den='A uranium-mill tailings dam in New Mexico broke and radioactive slurry ran down the Puerco River through Navajo land: the largest release of radioactive material in US history.',
   dead='0', mzh='尾礦約 1,100 噸、廢水約 3.6 億公升', men='About 1,100 t of tailings and 360 million litres of liquid', rzh='普埃科河沿岸', ren='Along the Puerco River', wzh='', wen='Church Rock uranium mill spill')
ev(id='machchhu', c='dam', dt='1979-08-11', lon=70.83, lat=22.73, rt='70.83,22.73 70.84,22.81 70.86,22.95', rd=1, sz=2,
   zh='馬丘二號水壩潰決（莫爾比）', en='Machchhu dam failure (Morbi)', ja='マチュ第二ダム決壊（モールビー）',
   dzh='印度古吉拉特邦的馬丘二號水壩在豪雨中潰決，洪水淹沒下游的莫爾比城；死亡人數官方約 1,800 人，估計可能高達 2 萬 5 千人。', den='The Machchhu II dam in Gujarat failed in heavy rain and the flood swept through Morbi below. Officially about 1,800 died; estimates run as high as 25,000.',
   dead='1800–25000', mzh='', men='', rzh='莫爾比市與下游', ren='Morbi and below', wzh='', wen='1979 Machchhu dam failure')
# ---------------------------------------------------------------- 1980–1999
ev(id='castillo', c='marine', dt='1983-08-06', lon=17.9, lat=-33.0, sh='c:25', sz=1, det=1,
   zh='貝爾韋城堡號漏油', en='Castillo de Bellver oil spill', ja='カスティーリョ・デ・ベルベル号事故',
   dzh='油輪在南非薩爾達尼亞灣外海起火斷裂沉沒。', den='The tanker caught fire, broke and sank off Saldanha Bay, South Africa.',
   dead='3', mzh='原油約 25 萬 2 千噸', men='About 252,000 t of crude', rzh='海面（示意）', ren='At sea (sketch)', wzh='', wen='Castillo de Bellver')
ev(id='cubatao', c='chem', dt='1984-02-25', lon=-46.42, lat=-23.89, sh='c:1', sz=1,
   zh='庫巴唐輸油管大火', en='Vila Socó fire, Cubatão', ja='クバトン・ヴィラ・ソコ火災',
   dzh='巴西工業城庫巴唐的輸油管破裂，汽油流進高腳屋聚落起火。庫巴唐當時以「死亡之谷」的污染聞名。', den='A pipeline burst in the industrial town of Cubatão, Brazil, and petrol ran under a stilt-house settlement and caught fire. Cubatão was then known for its pollution as the "Valley of Death".',
   dead='93–500+', mzh='', men='', rzh='維拉索科聚落', ren='The Vila Socó settlement', wzh='', wen='Cubatão')
ev(id='sanjuanico', c='chem', dt='1984-11-19', lon=-99.12, lat=19.52, sh='c:1.5', sz=2,
   zh='聖胡安尼科液化氣爆炸', en='San Juanico disaster', ja='サン・フアニコ爆発事故',
   dzh='墨西哥市北郊國營石油公司的液化石油氣儲運站連環爆炸，波及周邊住宅。', den='A chain of explosions at the state oil company\'s LPG terminal on the northern edge of Mexico City engulfed the homes around it.',
   dead='500–600', mzh='', men='', rzh='儲運站與周邊住宅', ren='The terminal and the houses around it', wzh='', wen='San Juanico disaster')
ev(id='bhopal', c='chem', dt='1984-12-03', lon=77.41, lat=23.28, sh='p:9,6,160', gd=1, sz=3,
   zh='博帕爾毒氣事件', en='Bhopal disaster', ja='ボパール化学工場事故',
   dzh='聯合碳化公司在印度博帕爾的農藥廠外洩約 40 噸異氰酸甲酯，毒氣在夜裡籠罩城市。政府最初公布死亡 2,259 人，中央邦政府後來確認 3,787 人，各方估計達 1 萬 6 千人以上，超過 50 萬人受影響。', den='Union Carbide\'s pesticide plant in Bhopal leaked about 40 t of methyl isocyanate, and the gas spread over the sleeping city. The first official toll was 2,259; the Madhya Pradesh government later confirmed 3,787, and other estimates exceed 16,000. Over half a million people were affected.',
   dead='2259–16000+', mzh='異氰酸甲酯約 40 噸', men='About 40 t of methyl isocyanate', rzh='毒氣籠罩的市區（示意）', ren='Parts of the city under the gas (sketch)', wzh='博帕爾事件', wen='Bhopal disaster')
ev(id='chernobyl', c='nuclear', dt='1986-04-26', b=1987, lon=30.10, lat=51.39, sh='g:28.0,51.0 28.4,51.9 29.3,52.6 30.3,53.5 31.4,54.0 32.6,53.8 33.6,53.2 34.1,52.6 33.0,52.3 31.5,51.6 30.9,51.0 30.3,50.7 29.3,50.7', gd=10, sz=3,
   zh='車諾比核災', en='Chernobyl disaster', ja='チェルノブイリ原子力発電所事故',
   dzh='烏克蘭車諾比核電廠四號機在測試中爆炸起火，放射性物質飄散到白俄羅斯、俄羅斯與歐洲各地。直接死亡 31 人；世界衛生組織估計最終可能有約 4,000 人死於相關癌症，其他研究的估計更高。', den='Reactor 4 at Chernobyl, Ukraine, exploded and burned during a test; radioactive material spread over Belarus, Russia and much of Europe. Thirty-one died directly; the WHO estimates up to about 4,000 eventual cancer deaths, and other studies estimate more.',
   dead='31–4000+', mzh='INES 第 7 級', men='INES level 7', rzh='銫-137 每平方公尺 3.7 萬貝克以上的主要污染區（依歐盟污染圖簡化）', ren='Main area above 37 kBq/m² of caesium-137 (simplified from the EU atlas)', wzh='切爾諾貝利核事故', wen='Chernobyl disaster')
ev(id='chernobylzone', c='nuclear', dt='1986-05', k=2026, lon=30.10, lat=51.39, sh='c:30', sz=2, nolabel=1, det=2,
   zh='車諾比隔離區', en='Chernobyl Exclusion Zone', ja='チェルノブイリ立入禁止区域',
   dzh='核電廠周圍 30 公里劃為隔離區，居民撤離至今未返。', den='The 30 km zone around the plant was evacuated and remains closed.',
   dead='', mzh='約 2,600 平方公里', men='About 2,600 km²', rzh='30 公里隔離區', ren='30 km exclusion zone', wzh='切爾諾貝利隔離區', wen='Chernobyl Exclusion Zone')
ev(id='sandoz', c='chem', dt='1986-11-01', lon=7.68, lat=47.53, rt='7.60,47.58 7.58,48.0 7.80,48.58 8.20,49.0 8.45,49.50 8.27,50.0 7.60,50.36 7.10,50.73 6.77,51.23 6.15,51.85 5.20,51.88 4.20,51.95', rd=10, sz=2,
   zh='山度士化學品倉庫火災（萊茵河污染）', en='Sandoz chemical spill (Schweizerhalle)', ja='サンド社倉庫火災（ライン川汚染）',
   dzh='瑞士巴塞爾附近的山度士倉庫起火，滅火用水夾帶約 30 噸農藥流進萊茵河，下游數百公里魚群大量死亡。', den='A Sandoz warehouse near Basel burned; firefighting water carried about 30 t of agrochemicals into the Rhine and killed fish for hundreds of kilometres downstream.',
   dead='0', mzh='化學品約 30 噸', men='About 30 t of chemicals', rzh='萊茵河至北海', ren='The Rhine to the North Sea', wzh='', wen='Sandoz chemical spill')
ev(id='goiania', c='nuclear', dt='1987-09-13', lon=-49.26, lat=-16.68, sh='c:1', sz=1,
   zh='戈亞尼亞輻射事故', en='Goiânia accident', ja='ゴイアニア被曝事故',
   dzh='巴西戈亞尼亞廢棄醫院的放射治療機被拾荒者拆開，發藍光的銫-137 粉末在居民間傳遞。', den='Scavengers took apart a radiotherapy unit left in an abandoned clinic in Goiânia; the glowing caesium-137 powder was passed around among neighbours.',
   dead='4', mzh='INES 第 5 級', men='INES level 5', rzh='市區數處污染點', ren='Several contaminated sites in the city', wzh='戈亞尼亞輻射事故', wen='Goiânia accident')
ev(id='piperalpha', c='chem', dt='1988-07-06', lon=0.25, lat=58.47, sh='c:2', sz=1,
   zh='派珀阿爾法平台爆炸', en='Piper Alpha', ja='パイパー・アルファ爆発事故',
   dzh='北海油田平台天然氣外洩爆炸起火，是死亡人數最多的海上石油平台事故。', den='A gas leak on a North Sea oil platform exploded and burned: the deadliest offshore oil-platform accident.',
   dead='167', mzh='', men='', rzh='平台', ren='The platform', wzh='派珀阿爾法', wen='Piper Alpha')
ev(id='exxonvaldez', c='marine', dt='1989-03-24', lon=-146.86, lat=60.84, rt='-146.86,60.84 -147.40,60.45 -147.90,60.05 -148.90,59.75 -150.40,59.30 -151.80,58.90 -152.90,58.30 -153.80,57.70 -155.30,57.20', rd=56, sh='g:-146.9,60.9 -146.4,60.5 -147.5,59.9 -150.0,59.2 -152.6,58.1 -155.6,57.0 -155.9,57.4 -153.4,58.5 -151.2,59.4 -148.6,60.2 -147.5,60.9', gd=56, sz=3,
   zh='埃克森瓦德茲號漏油', en='Exxon Valdez oil spill', ja='エクソン・バルディーズ号原油流出事故',
   dzh='油輪在阿拉斯加威廉王子灣觸礁，原油沿海岸向西南漂流約 750 公里，約 2,100 公里海岸受污染，大量海鳥與海獺死亡。', den='The tanker struck Bligh Reef in Prince William Sound, Alaska. The oil drifted some 750 km south-west and fouled about 2,100 km of shoreline, killing huge numbers of seabirds and sea otters.',
   dead='0', mzh='原油約 3 萬 7 千噸（約 1,100 萬加侖）', men='About 37,000 t of crude (about 11 million gallons)', rzh='油污漂流範圍（依美國國家海洋暨大氣總署圖簡化）', ren='Area the oil reached (simplified from NOAA maps)', wzh='埃克森瓦爾迪茲號漏油事故', wen='Exxon Valdez oil spill')
ev(id='kuwaitfires', c='war', dt='1991-02', b=1991, lon=47.8, lat=29.1, sh='p:900,300,105', gd=60, sz=3,
   zh='科威特油井大火', en='Kuwaiti oil fires', ja='クウェート油田火災',
   dzh='伊拉克軍撤退時點燃科威特六百多口油井，大火燒了約九個月，濃煙飄到波斯灣與伊朗。', den='Retreating Iraqi forces set more than 600 Kuwaiti oil wells on fire. The fires burned for about nine months and the smoke drifted over the Gulf and Iran.',
   dead='', mzh='油井 600 多口', men='More than 600 wells', rzh='煙羽範圍（概略）', ren='Smoke plume (rough)', wzh='科威特油田大火', wen='Kuwaiti oil fires')
ev(id='gulfspill', c='war', dt='1991-01-19', lon=48.5, lat=28.6, rt='48.50,28.60 48.90,28.10 49.30,27.60 49.60,27.10 49.80,26.70', rd=60, sh='e:200,40,140', gd=60, sz=3,
   zh='波斯灣戰爭漏油', en='Gulf War oil spill', ja='湾岸戦争の原油流出',
   dzh='伊拉克軍蓄意打開科威特的輸油設施，原油沿沙烏地海岸南漂，是史上最大的漏油事件之一。', den='Iraqi forces deliberately opened Kuwaiti oil terminals; the oil drifted south along the Saudi coast. It is among the largest oil spills ever.',
   dead='', mzh='原油約 400–600 萬桶', men='4–6 million barrels', rzh='沙烏地東北海岸（示意）', ren='North-eastern Saudi coast (sketch)', wzh='海灣戰爭漏油事件', wen='Gulf War oil spill')
ev(id='haven', c='marine', dt='1991-04-11', lon=8.70, lat=44.38, sh='e:60,15,70', gd=20, sz=1, det=1,
   zh='海文號油輪爆炸', en='MT Haven', ja='ヘイヴン号爆発事故',
   dzh='油輪在義大利熱那亞外海爆炸起火沉沒，油污沿利古里亞海岸擴散。', den='The tanker exploded, burned and sank off Genoa; oil spread along the Ligurian coast.',
   dead='6', mzh='原油約 14 萬 4 千噸', men='About 144,000 t of crude', rzh='利古里亞海岸（示意）', ren='Ligurian coast (sketch)', wzh='', wen='MT Haven')
ev(id='braer', c='marine', dt='1993-01-05', lon=-1.35, lat=59.87, sh='c:20', sz=1, det=1,
   zh='布雷爾號漏油', en='Braer oil spill', ja='ブレア号座礁事故',
   dzh='油輪在暴風中於昔德蘭群島擱淺，原油大多被巨浪打散。', den='The tanker went aground on Shetland in a storm; heavy seas broke up most of the oil.',
   dead='0', mzh='原油約 8 萬 5 千噸', men='About 85,000 t of crude', rzh='昔德蘭南端（示意）', ren='Southern Shetland (sketch)', wzh='', wen='MV Braer')
ev(id='seaempress', c='marine', dt='1996-02-15', lon=-5.17, lat=51.68, sh='e:40,15,100', gd=10, sz=1, det=1,
   zh='海洋女皇號漏油', en='Sea Empress oil spill', ja='シー・エンプレス号座礁事故',
   dzh='油輪在威爾斯米爾福德港入口擱淺，污染彭布羅克郡海岸國家公園。', den='The tanker grounded at the entrance to Milford Haven, Wales, fouling the Pembrokeshire Coast National Park.',
   dead='0', mzh='原油約 7 萬 2 千噸', men='About 72,000 t of crude', rzh='彭布羅克郡海岸（示意）', ren='Pembrokeshire coast (sketch)', wzh='', wen='Sea Empress oil spill')
ev(id='haze1997', c='air', dt='1997-09', b=1998, lon=105.0, lat=1.5, sh='g:95.5,5.5 100.5,6.8 104.5,6.0 110.0,4.5 117.5,6.5 118.5,2.0 116.5,-3.8 111.0,-3.5 106.0,-5.2 101.0,-3.2 97.0,1.0', gd=40, sz=2,
   zh='1997 年東南亞霾害', en='1997 Southeast Asian haze', ja='1997 年東南アジア煙害',
   dzh='印尼蘇門答臘與婆羅洲為開墾而放火燒林與泥炭地，聖嬰年乾旱下失控，濃霾籠罩東南亞數月。', den='Fires set to clear forest and peatland in Sumatra and Borneo ran out of control in an El Niño drought; thick haze covered South-East Asia for months.',
   dead='', mzh='', men='', rzh='霾害籠罩範圍（概略）', ren='Area under the haze (rough)', wzh='1997年東南亞霾害', wen='1997 Southeast Asian haze')
ev(id='aznalcollar', c='dam', dt='1998-04-25', lon=-6.23, lat=37.50, rt='-6.23,37.50 -6.24,37.40 -6.25,37.28 -6.24,37.15', rd=3, sz=2,
   zh='阿斯納爾科利亞爾尾礦壩潰決', en='Doñana disaster (Aznalcóllar)', ja='アスナルコリャル鉱滓ダム決壊',
   dzh='西班牙礦場的尾礦壩破裂，含重金屬的酸性泥水沿瓜迪亞馬爾河流到多尼亞納國家公園邊緣。', den='A tailings dam at a Spanish mine broke and acid, metal-laden sludge ran down the Guadiamar to the edge of Doñana National Park.',
   dead='0', mzh='泥水約 500–600 萬立方公尺', men='5–6 million m³ of sludge', rzh='瓜迪亞馬爾河沿岸約 40 公里', ren='About 40 km of the Guadiamar', wzh='', wen='Doñana disaster')
ev(id='erika', c='marine', dt='1999-12-12', lon=-4.90, lat=47.20, sh='g:-4.4,47.8 -3.5,47.7 -2.5,47.3 -2.1,46.9 -1.6,46.3 -1.4,46.1 -2.0,46.2 -3.0,46.8 -4.3,47.2', gd=20, sz=2,
   zh='埃里卡號漏油', en='Erika oil spill', ja='エリカ号沈没事故',
   dzh='老舊油輪在比斯開灣斷裂沉沒，重油污染布列塔尼南部到旺代約 400 公里海岸。', den='An ageing tanker broke in two and sank in the Bay of Biscay; heavy fuel oil fouled about 400 km of coast from southern Brittany to the Vendée.',
   dead='0', mzh='重油約 2 萬噸', men='About 20,000 t of heavy fuel oil', rzh='法國西岸（示意）', ren='French Atlantic coast (sketch)', wzh='', wen='Erika (ship)')
# ---------------------------------------------------------------- 2000–
ev(id='baiamare', c='chem', dt='2000-01-30', lon=23.60, lat=47.65, rt='23.60,47.65 23.10,47.80 22.60,48.05 22.25,48.12 21.60,48.10 20.70,47.50 20.20,47.17 20.15,46.25 20.25,45.25 20.50,44.82 22.00,44.65 23.90,44.10 26.10,44.05 27.90,44.40 28.20,45.10 29.60,45.20', rd=28, sz=2,
   zh='巴亞馬雷氰化物外洩', en='Baia Mare cyanide spill', ja='バイア・マーレのシアン化合物流出',
   dzh='羅馬尼亞金礦的尾礦池潰堤，含氰化物廢水經索梅什河、蒂薩河流進多瑙河，最後到黑海，沿途魚群大量死亡。', den='A tailings pond at a Romanian gold mine overflowed; cyanide-laden water ran down the Someș and the Tisza into the Danube and on to the Black Sea, killing fish all the way.',
   dead='0', mzh='廢水約 10 萬立方公尺', men='About 100,000 m³ of waste water', rzh='索梅什河、蒂薩河、多瑙河', ren='The Someș, Tisza and Danube', wzh='', wen='2000 Baia Mare cyanide spill')
ev(id='azf', c='chem', dt='2001-09-21', lon=1.43, lat=43.57, sh='c:3', sz=1,
   zh='圖盧茲 AZF 化工廠爆炸', en='AZF factory explosion', ja='AZF 化学工場爆発事故',
   dzh='法國圖盧茲的化肥廠硝酸銨倉庫爆炸，市區大片建築受損。', den='Ammonium nitrate stored at a fertiliser plant in Toulouse exploded, damaging buildings across the city.',
   dead='31', mzh='約 2,500 人受傷', men='About 2,500 injured', rzh='受損範圍約 3 公里', ren='Damage within about 3 km', wzh='', wen='AZF (factory)')
ev(id='prestige', c='marine', dt='2002-11-19', lon=-12.0, lat=42.2, sh='g:-9.3,43.2 -8.0,43.7 -5.5,43.6 -3.5,43.5 -1.8,43.4 -1.5,44.6 -2.5,44.2 -5.0,44.0 -8.2,44.0 -9.6,43.5 -9.4,42.6 -12.0,42.2', gd=60, sz=3,
   zh='威望號漏油', en='Prestige oil spill', ja='プレステージ号沈没事故',
   dzh='單殼油輪在加利西亞外海破損，被拖往外海後斷裂沉沒，重油污染西班牙北岸與法國西南海岸。', den='A single-hull tanker was holed off Galicia, towed out to sea and broke up; its heavy fuel oil fouled northern Spain and south-western France.',
   dead='0', mzh='重油約 6 萬 3 千噸', men='About 63,000 t of heavy fuel oil', rzh='加利西亞到法國西南（概略）', ren='Galicia to south-western France (rough)', wzh='威望號油輪', wen='Prestige oil spill')
ev(id='jilin', c='chem', dt='2005-11-13', lon=126.50, lat=43.90, rt='126.50,43.90 126.55,44.60 126.60,45.30 126.62,45.76 127.70,45.95 128.90,46.10 130.32,46.80 131.50,47.30 132.50,47.72 133.80,48.00 135.08,48.48', rd=30, sz=2,
   zh='吉林石化爆炸與松花江苯污染', en='2005 Jilin chemical plant explosions', ja='吉林石化爆発と松花江汚染',
   dzh='吉林石化的苯胺廠爆炸，約 100 噸苯類流進松花江，污染帶經哈爾濱流到黑龍江，哈爾濱停水五天。', den='Explosions at a PetroChina aniline plant in Jilin sent about 100 t of benzene compounds into the Songhua; the slick passed Harbin, which cut its water for five days, and reached the Amur.',
   dead='6', mzh='苯類約 100 噸', men='About 100 t of benzene compounds', rzh='松花江至黑龍江', ren='The Songhua to the Amur', wzh='松花江水污染事件', wen='2005 Jilin chemical plant explosions')
ev(id='abidjan', c='chem', dt='2006-08-19', lon=-4.00, lat=5.33, sh='c:8', sz=1,
   zh='阿比讓有毒廢棄物傾倒', en='2006 Côte d\'Ivoire toxic waste dump', ja='アビジャン有害廃棄物投棄事件',
   dzh='托克運輸公司的貨輪「普羅博無尾熊號」把有毒的石化廢料交給當地業者，傾倒在阿比讓市內十幾處。', den='Waste from the ship Probo Koala, chartered by Trafigura, was handed to a local firm and dumped at more than a dozen sites around Abidjan.',
   dead='17', mzh='約 10 萬人就醫', men='About 100,000 sought treatment', rzh='阿比讓市內傾倒點', ren='Dumping sites in Abidjan', wzh='', wen='2006 Côte d\'Ivoire toxic waste dump')
ev(id='hebeispirit', c='marine', dt='2007-12-07', lon=126.05, lat=36.87, sh='e:60,20,10', gd=20, sz=2,
   zh='河北精神號漏油', en='Hebei Spirit oil spill', ja='ハーベイ・スピリット号原油流出事故',
   dzh='油輪在韓國泰安外海遭起重船撞擊漏油，上百萬志工清理海岸。', den='A crane barge struck the tanker off Taean, South Korea; more than a million volunteers helped clean the coast.',
   dead='0', mzh='原油約 1 萬 900 噸', men='About 10,900 t of crude', rzh='泰安半島海岸（示意）', ren='Taean peninsula coast (sketch)', wzh='', wen='Hebei Spirit oil spill')
ev(id='kingston', c='dam', dt='2008-12-22', lon=-84.50, lat=35.90, sh='c:2', sz=1, det=1,
   zh='金斯頓煤灰外洩', en='Kingston Fossil Plant coal fly ash slurry spill', ja='キングストン石炭灰流出事故',
   dzh='美國田納西河谷管理局燃煤電廠的煤灰池堤防潰決，煤灰泥漿覆蓋周邊住宅與河道。', den='A dike of a coal-ash pond at a TVA power plant failed and ash slurry buried homes and river channels.',
   dead='0', mzh='煤灰約 410 萬立方公尺', men='About 4.1 million m³ of ash', rzh='周邊約 1.2 平方公里', ren='About 1.2 km² around', wzh='', wen='Kingston Fossil Plant coal fly ash slurry spill')
ev(id='deepwater', c='marine', dt='2010-04-20', lon=-88.37, lat=28.74, sh='g:-90.6,28.9 -89.9,30.0 -88.6,30.4 -87.2,30.4 -86.0,30.3 -84.9,29.6 -85.4,28.6 -86.8,27.9 -88.3,27.4 -89.8,27.7', gd=87, sz=3,
   zh='深水地平線漏油', en='Deepwater Horizon oil spill', ja='メキシコ湾原油流出事故',
   dzh='英國石油租用的鑽油平台在墨西哥灣爆炸沉沒，海底油井漏油 87 天，是美國史上最大的海上漏油。', den='A drilling rig leased by BP exploded and sank in the Gulf of Mexico; the well leaked for 87 days: the largest marine oil spill in US history.',
   dead='11', mzh='原油約 490 萬桶（美國政府估計）', men='About 4.9 million barrels (US government estimate)', rzh='累積油污範圍（依美國國家海洋暨大氣總署衛星判讀簡化）', ren='Cumulative slick (simplified from NOAA satellite analyses)', wzh='深水地平線漏油事故', wen='Deepwater Horizon oil spill')
ev(id='ajka', c='dam', dt='2010-10-04', lon=17.50, lat=47.08, rt='17.50,47.08 17.62,47.13 17.55,47.30 17.40,47.45 17.63,47.68 17.70,47.76', rd=4, sz=2,
   zh='艾卡氧化鋁赤泥外洩', en='Ajka alumina plant accident', ja='アイカ赤泥流出事故',
   dzh='匈牙利氧化鋁廠的赤泥池潰堤，強鹼性泥流淹沒科隆塔爾等村莊，經馬爾曹河流到多瑙河。', den='A red-mud reservoir at a Hungarian alumina plant burst; the caustic sludge flooded Kolontár and other villages and reached the Danube by way of the Marcal.',
   dead='10', mzh='赤泥約 100 萬立方公尺', men='About 1 million m³ of red mud', rzh='托爾瑙河、馬爾曹河到多瑙河', ren='The Torna and Marcal to the Danube', wzh='', wen='Ajka alumina plant accident')
ev(id='fukushima', c='nuclear', dt='2011-03-11', b=2012, lon=141.03, lat=37.42, sh='g:141.03,37.42 140.95,37.62 140.80,37.76 140.60,37.80 140.50,37.70 140.55,37.55 140.80,37.40 141.05,37.30', gd=6, sz=3,
   zh='福島第一核電廠事故', en='Fukushima nuclear accident', ja='福島第一原子力発電所事故',
   dzh='東日本大地震的海嘯使福島第一核電廠失去電源，三部機組爐心熔毀、氫氣爆炸。輻射直接致死經官方認定 1 人；避難導致的「震災相關死亡」在福島縣超過 2,300 人。', den='The tsunami of the Great East Japan Earthquake cut power to Fukushima Daiichi; three reactor cores melted and hydrogen explosions followed. One death has been officially attributed to radiation; more than 2,300 "disaster-related deaths" in Fukushima Prefecture followed the evacuations.',
   dead='1–2300+', mzh='INES 第 7 級', men='INES level 7', rzh='西北方向的主要污染帶（飯館村一帶，依文部科學省航空偵測簡化）', ren='Main plume to the north-west toward Iitate (simplified from MEXT airborne surveys)', wzh='福島第一核電廠事故', wen='Fukushima nuclear accident')
ev(id='fukushimazone', c='nuclear', dt='2011-04', k=2026, lon=141.03, lat=37.42, sh='c:20', sz=2, nolabel=1, det=2,
   zh='福島警戒區域與歸還困難區域', en='Fukushima evacuation zone', ja='福島の警戒区域・帰還困難区域',
   dzh='核電廠 20 公里內劃為警戒區域，2013 年後分區逐步解除，部分「歸還困難區域」至今仍未開放。', den='The area within 20 km was closed; zones have been reopened step by step since 2013, but some "difficult-to-return" areas remain closed.',
   dead='', mzh='', men='', rzh='20 公里警戒區域（2011 年）', ren='20 km restricted zone (2011)', wzh='', wen='Fukushima Daiichi nuclear disaster')
ev(id='lacmegantic', c='chem', dt='2013-07-06', lon=-70.88, lat=45.58, sh='c:1', sz=1,
   zh='拉克梅甘蒂克火車爆炸', en='Lac-Mégantic rail disaster', ja='ラック・メガンティック鉄道事故',
   dzh='無人看管的原油列車溜下坡道，在加拿大魁北克的小鎮中心出軌爆炸。', den='An unattended train of crude oil ran away down a grade and derailed and exploded in the centre of a small Quebec town.',
   dead='47', mzh='', men='', rzh='鎮中心', ren='The town centre', wzh='', wen='Lac-Mégantic rail disaster')
ev(id='mountpolley', c='dam', dt='2014-08-04', lon=-121.60, lat=52.51, sh='c:3', sz=1, det=1,
   zh='蒙特波利尾礦壩潰決', en='Mount Polley mine disaster', ja='マウント・ポーリー鉱滓ダム決壊',
   dzh='加拿大卑詩省銅金礦的尾礦壩潰決，廢水流進鮭魚棲息的湖泊。', den='The tailings dam of a copper and gold mine in British Columbia failed, sending waste into salmon lakes.',
   dead='0', mzh='尾礦與廢水約 2,500 萬立方公尺', men='About 25 million m³ of tailings and water', rzh='黑澤爾頓溪與奎內爾湖', ren='Hazeltine Creek and Quesnel Lake', wzh='', wen='Mount Polley mine disaster')
ev(id='tianjin', c='chem', dt='2015-08-12', lon=117.73, lat=39.04, sh='c:2', sz=2,
   zh='天津港爆炸', en='2015 Tianjin explosions', ja='天津浜海新区倉庫爆発事故',
   dzh='天津港瑞海公司危險品倉庫起火後連環爆炸，存放的數百噸氰化鈉等化學品外洩。', den='A fire at Ruihai\'s hazardous-goods warehouse in the port of Tianjin set off a chain of explosions and released hundreds of tonnes of sodium cyanide and other chemicals.',
   dead='173', mzh='約 800 人受傷', men='About 800 injured', rzh='核心區與周邊受損範圍', ren='The blast centre and damaged area around it', wzh='2015年天津港危險品倉庫爆炸事故', wen='2015 Tianjin explosions')
ev(id='mariana', c='dam', dt='2015-11-05', lon=-43.47, lat=-20.21, rt='-43.47,-20.21 -43.10,-20.05 -42.80,-19.75 -42.55,-19.50 -41.95,-18.85 -41.50,-19.20 -40.65,-19.50 -40.00,-19.60 -39.81,-19.65', rd=17, sz=3,
   zh='馬里亞納尾礦壩潰決', en='Mariana dam disaster', ja='マリアナ鉱滓ダム決壊',
   dzh='巴西淡水河谷與必和必拓合資礦場的豐當尾礦壩潰決，泥流沖毀本托羅德里格斯村，沿多西河流約 670 公里入大西洋。', den='The Fundão tailings dam of a Vale–BHP joint venture in Brazil failed; the sludge wiped out Bento Rodrigues and ran some 670 km down the Rio Doce to the Atlantic.',
   dead='19', mzh='尾礦約 4,300 萬立方公尺', men='About 43 million m³ of tailings', rzh='多西河至出海口', ren='The Rio Doce to its mouth', wzh='馬里亞納潰壩事故', wen='Mariana dam disaster')
ev(id='formosahatinh', c='marine', dt='2016-04-06', lon=106.42, lat=18.06, sh='e:110,15,160', gd=20, sz=2,
   zh='台塑河靜鋼廠海洋污染', en='2016 Vietnam marine life disaster', ja='ベトナム中部の魚大量死（台湾プラスチック河静製鉄所）',
   dzh='台塑集團在越南河靜省的鋼廠排放含酚與氰化物的廢水，中部四省約 200 公里海岸魚群大量死亡；台塑承認責任並賠償 5 億美元。', den='Waste water containing phenols and cyanide from Formosa Plastics\' steel works in Hà Tĩnh killed fish along some 200 km of coast in four provinces of central Vietnam; the company admitted responsibility and paid US$500 million.',
   dead='', mzh='賠償 5 億美元', men='US$500 million compensation', rzh='越南中部四省沿岸約 200 公里', ren='About 200 km of coast in four provinces', wzh='2016年越南海洋生物死亡事件', wen='2016 Vietnam marine life disaster')
ev(id='sanchi', c='marine', dt='2018-01-06', lon=125.92, lat=28.37, sh='e:60,25,60', gd=20, sz=2,
   zh='桑吉輪撞船事故', en='Sanchi oil tanker collision', ja='サンチ号衝突事故',
   dzh='伊朗油輪桑吉號在長江口外海與貨輪相撞起火，燃燒一週後沉沒，船員全數罹難，凝析油外洩。', den='The Iranian tanker Sanchi collided with a freighter off the Yangtze estuary, burned for a week and sank; all her crew died and her condensate cargo escaped.',
   dead='32', mzh='凝析油約 13 萬 6 千噸', men='About 136,000 t of condensate', rzh='東海海面（示意）', ren='East China Sea (sketch)', wzh='桑吉輪撞船事故', wen='Sanchi oil tanker collision')
ev(id='brumadinho', c='dam', dt='2019-01-25', lon=-44.12, lat=-20.12, rt='-44.12,-20.12 -44.20,-20.15 -44.30,-20.08 -44.45,-19.95 -44.65,-19.70 -44.90,-19.40', rd=10, sz=3,
   zh='布魯馬迪紐尾礦壩潰決', en='Brumadinho dam disaster', ja='ブルマジーニョ鉱滓ダム決壊',
   dzh='淡水河谷鐵礦的尾礦壩在午餐時間潰決，泥流吞沒礦場餐廳與下游社區，流進帕拉奧佩巴河。', den='The tailings dam of a Vale iron mine collapsed at lunchtime; the mudflow buried the mine canteen and the community below and entered the Paraopeba.',
   dead='270', mzh='尾礦約 1,200 萬立方公尺', men='About 12 million m³ of tailings', rzh='費若溪與帕拉奧佩巴河', ren='Ferro-Carvão stream and the Paraopeba', wzh='布魯馬迪紐潰壩事故', wen='Brumadinho dam disaster')
ev(id='xiangshui', c='chem', dt='2019-03-21', lon=119.78, lat=34.33, sh='c:3', sz=1,
   zh='響水化工廠爆炸', en='2019 Xiangshui chemical plant explosion', ja='響水化学工場爆発事故',
   dzh='江蘇響水陳家港化工園區的天嘉宜化工廠爆炸，周邊村莊與學校受損，事後整個園區關閉。', den='The Tianjiayi chemical plant in the Chenjiagang chemical park, Xiangshui, Jiangsu, exploded, damaging villages and schools around it; the whole park was later closed.',
   dead='78', mzh='', men='', rzh='受損範圍約 3 公里', ren='Damage within about 3 km', wzh='響水「3·21」特別重大爆炸事故', wen='2019 Xiangshui chemical plant explosion')
ev(id='vizag', c='chem', dt='2020-05-07', lon=83.20, lat=17.75, sh='c:3', sz=1,
   zh='維沙卡帕特南苯乙烯外洩', en='Visakhapatnam gas leak', ja='ヴィシャーカパトナムのスチレン漏洩事故',
   dzh='新冠封城後重新開工的 LG 化學工廠儲槽苯乙烯外洩，周邊村莊居民在睡夢中中毒。', den='Styrene escaped from a tank at an LG Polymers plant restarting after the Covid lockdown; villagers nearby were poisoned in their sleep.',
   dead='12–15', mzh='', men='', rzh='方圓約 3 公里', ren='About 3 km around', wzh='', wen='Visakhapatnam gas leak')
ev(id='wakashio', c='marine', dt='2020-07-25', lon=57.75, lat=-20.44, sh='e:20,6,30', gd=20, sz=1,
   zh='若潮號擱淺漏油（模里西斯）', en='MV Wakashio oil spill', ja='わかしお座礁事故（モーリシャス）',
   dzh='日本長鋪汽船所屬、商船三井租用的散裝船在模里西斯外海珊瑚礁擱淺，燃油污染紅樹林與潟湖。', den='A bulk carrier owned by Japan\'s Nagashiki Shipping and chartered by MOL ran onto the reef off Mauritius; her fuel oil fouled mangroves and lagoons.',
   dead='0', mzh='燃油約 1,000 噸', men='About 1,000 t of fuel oil', rzh='東南海岸潟湖（示意）', ren='South-east coast lagoon (sketch)', wzh='', wen='MV Wakashio oil spill')
ev(id='beirut', c='chem', dt='2020-08-04', lon=35.52, lat=33.90, sh='c:5', sz=3,
   zh='貝魯特港大爆炸', en='2020 Beirut explosion', ja='ベイルート港爆発事故',
   dzh='存放在貝魯特港倉庫多年的約 2,750 噸硝酸銨爆炸，摧毀港區並重創半個城市。', den='About 2,750 t of ammonium nitrate stored for years in a warehouse at the port of Beirut exploded, destroying the port and wrecking half the city.',
   dead='218+', mzh='約 7,000 人受傷、30 萬人無家可歸', men='About 7,000 injured and 300,000 left homeless', rzh='嚴重受損範圍約 5 公里', ren='Heavy damage within about 5 km', wzh='2020年貝魯特爆炸事故', wen='2020 Beirut explosion')
ev(id='xpresspearl', c='marine', dt='2021-05-20', lon=79.80, lat=7.00, sh='e:150,25,0', gd=30, sz=2,
   zh='X-Press Pearl 號塑膠粒污染', en='X-Press Pearl disaster', ja='エックスプレス・パール号火災',
   dzh='載運化學品的貨櫃船在斯里蘭卡可倫坡外海起火沉沒，大量塑膠粒沖上海岸，是史上最嚴重的塑膠污染事件。', den='A container ship carrying chemicals burned and sank off Colombo; enormous amounts of plastic pellets washed ashore, the worst plastic spill on record.',
   dead='0', mzh='塑膠粒約 1,680 噸', men='About 1,680 t of plastic pellets', rzh='斯里蘭卡西岸（示意）', ren='West coast of Sri Lanka (sketch)', wzh='', wen='X-Press Pearl')
ev(id='kakhovka', c='war', dt='2023-06-06', lon=33.37, lat=46.78, rt='33.37,46.78 33.10,46.75 32.80,46.68 32.62,46.62 32.30,46.52 31.95,46.55', rd=3, sh='g:33.4,46.8 32.6,46.75 32.0,46.65 31.9,46.45 32.6,46.5 33.3,46.7', gd=3, sz=3,
   zh='卡霍夫卡水壩毀壞', en='Destruction of the Kakhovka Dam', ja='カホフカ・ダム決壊',
   dzh='俄烏戰爭中，俄軍控制下的卡霍夫卡水壩遭破壞崩潰，第聶伯河下游大片淹沒，水庫乾涸。各方認定以俄方蓄意爆破的可能最大。', den='The Kakhovka Dam, held by Russian forces, was breached during the war; the lower Dnieper flooded and the reservoir drained. Most investigations point to deliberate demolition by Russia.',
   dead='59–100+', mzh='', men='', rzh='第聶伯河下游與赫爾松一帶（示意）', ren='The lower Dnieper and Kherson (sketch)', wzh='卡霍夫卡水壩潰壩', wen='Destruction of the Kakhovka Dam')
ev(id='eastpalestine', c='chem', dt='2023-02-03', lon=-80.52, lat=40.84, sh='c:1.6', sz=1, det=1,
   zh='東巴勒斯坦列車出軌', en='East Palestine train derailment', ja='イーストパレスタイン列車脱線事故',
   dzh='載有氯乙烯的貨運列車在俄亥俄州出軌，當局為防爆炸控制燃燒，居民一度撤離。', den='A freight train carrying vinyl chloride derailed in Ohio; to prevent an explosion it was burned off and residents were evacuated for a time.',
   dead='0', mzh='', men='', rzh='1.6 公里撤離範圍', ren='1.6 km evacuation zone', wzh='', wen='East Palestine, Ohio, train derailment')
ev(id='derna', c='dam', dt='2023-09-11', lon=22.60, lat=32.72, rt='22.60,32.72 22.63,32.75 22.64,32.77', rd=1, sh='c:2', sz=3,
   zh='德爾納水壩潰決', en='Derna dam collapses', ja='デルナのダム決壊',
   dzh='風暴丹尼爾的豪雨使利比亞德爾納上游兩座年久失修的水壩相繼潰決，洪水沖走市中心大片街區；死亡人數各方說法從四千多到一萬以上。', den='Storm Daniel\'s rain made two long-neglected dams above Derna, Libya, collapse one after the other; the flood swept away much of the city centre. Death tolls range from over 4,000 to more than 10,000.',
   dead='4000–11300', mzh='', men='', rzh='德爾納河谷與市中心', ren='Wadi Derna and the city centre', wzh='2023年德爾納水壩潰壩', wen='2023 Derna dam collapses')
# ---------------------------------------------------------------- 長期的人為生態破壞
ev(id='aral', c='eco', dt='1960', b=2026, lon=60.0, lat=45.0, sh='g:58.2,46.6 59.5,46.8 61.0,46.5 61.8,45.6 61.3,44.4 60.2,43.6 59.0,43.8 58.3,44.6', sz=3,
   zh='鹹海乾涸', en='Shrinking of the Aral Sea', ja='アラル海の縮小',
   dzh='蘇聯為灌溉棉田大量引走阿姆河與錫爾河的水，曾是世界第四大湖的鹹海在數十年間萎縮到原來的一成左右，鹽塵與農藥揚起危害周邊居民。', den='Soviet irrigation of cotton diverted the Amu Darya and Syr Darya; once the world\'s fourth-largest lake, the Aral Sea shrank to about a tenth of its size, and salt and pesticide dust blew over the people around it.',
   dead='', mzh='湖面縮小約九成', men='About 90 % of the lake lost', rzh='1960 年的湖面範圍（概略）', ren='The lake as it was in 1960 (rough)', wzh='鹹海', wen='Aral Sea')
ev(id='nigerdelta', c='eco', dt='1958', b=2026, lon=6.5, lat=4.8, sh='e:150,80,90', sz=2,
   zh='尼日河三角洲石油污染', en='Oil spills in the Niger Delta', ja='ニジェール・デルタの石油汚染',
   dzh='1958 年起開採石油以來，管線破裂、盜油與燃燒伴生氣長年污染尼日河三角洲的河道、紅樹林與農田，奧格尼蘭的清理至今未完成。', den='Since oil production began in 1958, broken pipelines, oil theft and gas flaring have polluted the creeks, mangroves and farms of the Niger Delta; the clean-up of Ogoniland is still unfinished.',
   dead='', mzh='', men='', rzh='三角洲產油區（概略）', ren='The oil-producing delta (rough)', wzh='', wen='Environmental issues in the Niger Delta')
ev(id='garbagepatch', c='eco', dt='1997', b=2026, lon=-140.0, lat=32.0, sh='e:1500,700,90', sz=2,
   zh='太平洋垃圾帶', en='Great Pacific garbage patch', ja='太平洋ごみベルト',
   dzh='北太平洋環流把各地漂來的塑膠垃圾聚集在夏威夷與加州之間的海域，1997 年由航海者摩爾注意到並引起關注。', den='The North Pacific Gyre gathers floating plastic from around the ocean between Hawaii and California; the sailor Charles Moore drew attention to it in 1997.',
   dead='', mzh='', men='', rzh='東太平洋垃圾聚集區（概略）', ren='Eastern accumulation zone (rough)', wzh='太平洋垃圾帶', wen='Great Pacific garbage patch')
