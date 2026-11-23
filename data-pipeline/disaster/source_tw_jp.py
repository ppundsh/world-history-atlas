# 人為災害地圖：台灣與日本（收錄較細，含地方性的公害與事故）。det=1 的事件在放大地圖後才顯示。
E = []
def ev(**k): E.append(k)

# ---------------------------------------------------------------- 台灣
ev(id='tw_yucheng', c='chem', dt='1979-04', lon=120.60, lat=24.12, sh='e:25,15,20', sz=2,
   zh='米糠油多氯聯苯中毒（油症）', en='Yu-Cheng PCB rice-oil poisoning', ja='台湾油症事件',
   dzh='彰化油脂公司生產的米糠油在加熱過程混入多氯聯苯，中部約兩千人食用後皮膚長出氯痤瘡、肝功能受損，台中惠明學校師生最先發病；受害者的下一代也受影響。', den='Rice-bran oil made by Changhua Oil was contaminated with PCBs from its heating system. About two thousand people in central Taiwan, beginning with the staff and pupils of the Huiming School for the blind, developed chloracne and liver damage; their children were affected too.',
   dead='', mzh='受害者約 2,000 人', men='About 2,000 victims', rzh='台中、彰化一帶受害者分布（示意）', ren='Victims around Taichung and Changhua (sketch)', wzh='油症事件', wen='', wja='台湾油症事件')
ev(id='tw_cdrice', c='chem', dt='1982-12', k=2002, lon=121.08, lat=25.03, sh='c:2', sz=1, det=1,
   zh='觀音鎘米事件', en='Guanyin cadmium rice', ja='観音カドミウム米事件',
   dzh='桃園觀音的高銀化工排放含鎘廢水進入灌溉渠道，周邊稻米鎘含量超標，農地被迫休耕，整治延續到 2000 年代。', den='Kaoyin Chemical in Guanyin, Taoyuan, discharged cadmium-laden waste water into irrigation channels; rice from the fields around exceeded safe levels and the land was taken out of farming, with clean-up lasting into the 2000s.',
   dead='', mzh='', men='', rzh='廠區周邊農地', ren='Farmland around the plant', wzh='鎘米', wen='', wja='')
ev(id='tw_greenoyster', c='chem', dt='1986-01', lon=120.18, lat=22.88, sh='e:6,3,90', sz=1, det=1,
   zh='二仁溪綠牡蠣事件', en='Green oysters of the Erren River', ja='二仁渓の緑色カキ事件',
   dzh='二仁溪沿岸露天燃燒廢五金、酸洗回收金屬，銅等重金屬流進出海口，牡蠣被染成綠色，成為台灣河川污染的代表事件。', den='Open burning and acid-stripping of scrap metal along the Erren River sent copper and other metals into the estuary; the oysters there turned green, a landmark of river pollution in Taiwan.',
   dead='', mzh='', men='', rzh='二仁溪出海口', ren='The Erren River mouth', wzh='二仁溪', wen='Erren River', wja='')
ev(id='tw_linyuan', c='chem', dt='1988-09', lon=120.40, lat=22.50, sh='c:3', sz=1, det=1,
   zh='林園事件', en='Linyuan incident', ja='林園事件',
   dzh='林園石化工業區的廢水處理廠廢水溢流，附近魚塭魚群暴斃，居民包圍工業區要求賠償，石化廠停工，業者最後支付十多億元補償。', den='The waste-water plant of the Linyuan petrochemical zone overflowed and killed the fish in nearby ponds; residents besieged the zone and the plants stopped until the companies paid more than NT$1 billion in compensation.',
   dead='', mzh='補償約 12.7 億元', men='About NT$1.27 billion paid', rzh='工業區周邊魚塭', ren='Fish ponds around the zone', wzh='林園事件', wen='', wja='')
ev(id='tw_rca', c='chem', dt='1994-06', k=2026, lon=121.30, lat=24.99, sh='c:1.5', sz=2,
   zh='RCA 桃園廠污染', en='RCA Taoyuan contamination', ja='RCA 桃園工場汚染事件',
   dzh='美國無線電公司桃園廠長年傾倒三氯乙烯等有機溶劑，地下水嚴重污染，許多前員工罹癌；1994 年經立委揭露，員工訴訟纏訟二十多年後勝訴。', den='RCA\'s Taoyuan plant had dumped trichloroethylene and other solvents for years, badly contaminating the groundwater; many former workers developed cancer. Exposed by a legislator in 1994, the workers\' lawsuit was won after more than two decades.',
   dead='', mzh='罹癌前員工上千人', men='More than a thousand former workers with cancer', rzh='廠區與地下水污染範圍（示意）', ren='The plant and the groundwater plume (sketch)', wzh='RCA污染事件', wen='RCA (Taiwan) pollution', wja='')
ev(id='tw_mercury', c='chem', dt='1998-12', lon=103.62, lat=10.70, sh='c:3', sz=1, det=1,
   zh='台塑汞污泥運柬埔寨', en='Formosa Plastics mercury waste in Cambodia', ja='台湾プラスチックの水銀汚泥カンボジア投棄',
   dzh='台塑把約三千噸含汞污泥運到柬埔寨施亞努港附近傾倒，引發當地恐慌與暴動，污泥最後運回台灣。', den='Formosa Plastics shipped about 3,000 t of mercury-laden sludge to Cambodia and dumped it near Sihanoukville; panic and riots followed, and the waste was finally shipped back to Taiwan.',
   dead='', mzh='污泥約 3,000 噸', men='About 3,000 t of sludge', rzh='傾倒地點', ren='The dumping site', wzh='', wen='', wja='')
ev(id='tw_amorgos', c='marine', dt='2001-01-14', lon=120.86, lat=21.92, sh='e:6,2,20', gd=20, sz=2,
   zh='阿瑪斯號漏油', en='Amorgos oil spill', ja='アモルゴス号座礁事故',
   dzh='希臘籍貨輪阿瑪斯號在墾丁國家公園龍坑生態保護區外擱淺，約 1,150 噸燃油外洩，污染珊瑚礁海岸，是台灣首件重大海洋油污事件。', den='The Greek freighter Amorgos ran aground off the Longkeng reserve in Kenting National Park; about 1,150 t of fuel oil fouled the coral coast, Taiwan\'s first major marine oil spill.',
   dead='0', mzh='燃油約 1,150 噸', men='About 1,150 t of fuel oil', rzh='龍坑一帶海岸', ren='The coast around Longkeng', wzh='阿瑪斯號貨輪漏油事件', wen='', wja='')
ev(id='tw_maanshan', c='nuclear', dt='2001-03-18', lon=120.75, lat=21.96, sh='c:1', sz=1, det=1,
   zh='核三廠全黑事故', en='Maanshan station blackout', ja='第三原発の全交流電源喪失',
   dzh='鹽霧造成輸電線路閃絡，核三廠一號機失去全部交流電源約兩小時，緊急柴油發電機也未能啟動，未造成輻射外洩。', den='Salt-fog flashovers on the lines left Unit 1 of the Maanshan plant without any AC power for about two hours, and the emergency diesels failed to start; no radiation was released.',
   dead='0', mzh='INES 第 2 級', men='INES level 2', rzh='電廠', ren='The plant', wzh='第三核能發電廠', wen='Maanshan Nuclear Power Plant', wja='')
ev(id='tw_anshun', c='chem', dt='2001-06', k=2026, lon=120.13, lat=23.03, sh='c:2', sz=1, det=1,
   zh='中石化安順廠戴奧辛與汞污染', en='CPDC Anshun plant contamination', ja='中石化安順工場のダイオキシン・水銀汚染',
   dzh='台南安南區的舊鹼氯工廠留下大量戴奧辛與汞，2001 年起驗出附近魚塭與居民血液戴奧辛偏高，土地至今仍在整治。', den='A former chlor-alkali plant in Annan, Tainan, left heavy dioxin and mercury contamination; from 2001 high dioxin levels were found in nearby fish ponds and in residents\' blood, and remediation continues.',
   dead='', mzh='', men='', rzh='廠區與鹿耳門溪周邊', ren='The plant and the Luermen creek', wzh='中石化安順廠', wen='', wja='')
ev(id='tw_mailiao', c='chem', dt='2010-07-07', lon=120.20, lat=23.79, sh='c:3', sz=1, det=1,
   zh='六輕大火', en='Mailiao complex fires', ja='台塑六軽の大火災',
   dzh='雲林麥寮的台塑六輕工業區一個月內兩度大火，濃煙引發周邊居民與養殖業的健康與損害爭議。', den='The Formosa Plastics complex at Mailiao, Yunlin, had two large fires within a month; the smoke led to disputes over health and damage to nearby farms and fish ponds.',
   dead='0', mzh='', men='', rzh='工業區周邊', ren='Around the complex', wzh='麥寮六輕工業區', wen='', wja='')
ev(id='tw_kaohsiung', c='chem', dt='2014-07-31', lon=120.31, lat=22.60, sh='e:2.2,0.6,30', sz=2,
   zh='高雄氣爆', en='2014 Kaohsiung gas explosions', ja='高雄ガス爆発事故',
   dzh='埋在高雄前鎮、苓雅區道路下的丙烯管線外洩，深夜沿凱旋三路、一心一路、三多一路等街道連環爆炸，路面被掀開數公里。', den='A propylene pipeline under the streets of Qianzhen and Lingya, Kaohsiung, leaked; late at night the gas exploded along Kaisyuan, Yisin and Sanduo roads, tearing open kilometres of road.',
   dead='32', mzh='321 人受傷', men='321 injured', rzh='爆炸街道沿線', ren='Along the streets that exploded', wzh='2014年高雄氣爆事故', wen='2014 Kaohsiung gas explosions', wja='高雄ガス爆発事故')
ev(id='tw_baxian', c='chem', dt='2015-06-27', lon=121.40, lat=25.14, sh='c:0.3', sz=1, det=1,
   zh='八仙樂園粉塵爆炸', en='Formosa Fun Coast explosion', ja='八仙水上楽園粉塵爆発事故',
   dzh='新北八里八仙樂園的派對噴灑大量彩色玉米粉，遇熱燃起粉塵爆炸，數百名年輕人嚴重燒傷。', den='Coloured corn starch sprayed over a party at Formosa Fun Coast in Bali, New Taipei, caught fire as a dust explosion; hundreds of young people were badly burned.',
   dead='15', mzh='484 人受傷', men='484 injured', rzh='活動場地', ren='The party ground', wzh='八仙樂園粉塵爆炸事故', wen='Formosa Fun Coast explosion', wja='')
ev(id='tw_tstaipei', c='marine', dt='2016-03-10', lon=121.56, lat=25.30, sh='e:8,3,110', gd=20, sz=1, det=1,
   zh='德翔台北輪擱淺漏油', en='TS Taipei grounding', ja='TS タイペイ号座礁事故',
   dzh='德翔海運貨櫃輪在新北石門外海擱淺，船身斷裂後燃油外洩，污染北海岸。', den='A T.S. Lines container ship ran aground off Shimen, New Taipei; she broke up and her fuel oil fouled the north coast.',
   dead='0', mzh='', men='', rzh='北海岸石門一帶', ren='The north coast around Shimen', wzh='德翔台北輪擱淺事故', wen='', wja='')
ev(id='tw_lanyu', c='nuclear', dt='1982-05', k=2026, lon=121.58, lat=21.99, sh='c:1', sz=2,
   zh='蘭嶼核廢料貯存場', en='Lanyu nuclear waste storage', ja='蘭嶼の核廃棄物貯蔵場',
   dzh='台電 1982 年起把核電廠的低放射性廢料運到達悟族居住的蘭嶼存放，部分鐵桶鏽蝕，族人長年抗爭要求遷出，至今仍未遷走。', den='From 1982 Taipower stored low-level waste from its reactors on Lanyu, home of the Tao people. Some drums corroded; the Tao have long campaigned for its removal, which has not yet happened.',
   dead='', mzh='約 10 萬桶低放射性廢料', men='About 100,000 drums of low-level waste', rzh='貯存場', ren='The storage site', wzh='蘭嶼核廢料貯存場', wen='Lanyu Storage Site', wja='')
ev(id='tw_mingyang', c='chem', dt='2023-09-22', lon=120.50, lat=22.66, sh='c:1', sz=1, det=1,
   zh='屏東明揚大火', en='Pingtung Mingyang factory fire', ja='屏東明揚工場火災',
   dzh='屏東科技產業園區的明揚國際高爾夫球廠起火，存放的過氧化物爆炸，四名消防員殉職。', den='A fire at the Mingyang golf-ball factory in the Pingtung industrial park set off stored peroxides; four firefighters were among the dead.',
   dead='10', mzh='百餘人受傷', men='More than 100 injured', rzh='廠區周邊', ren='Around the factory', wzh='明揚國際科技工廠火災', wen='', wja='')

# ---------------------------------------------------------------- 日本
ev(id='jp_ashio', c='chem', dt='1890-08', b=1907, k=1974, lon=139.45, lat=36.63, rt='139.45,36.63 139.33,36.50 139.28,36.43 139.45,36.33 139.55,36.27 139.68,36.22 139.72,36.17', rd=30, sz=2,
   zh='足尾礦毒事件', en='Ashio copper mine pollution', ja='足尾鉱毒事件',
   dzh='古河足尾銅山的礦毒與煙害使渡良瀨川流域農地荒廢，1890 年洪水後災情擴大；田中正造為此向天皇直訴，被稱為日本公害的原點。', den='Waste and fumes from the Furukawa company\'s Ashio copper mine ruined the farmland of the Watarase basin, worst after the flood of 1890. Tanaka Shōzō petitioned the Emperor over it; it is called the starting point of pollution in Japan.',
   dead='', mzh='', men='', rzh='渡良瀨川流域', ren='The Watarase basin', wzh='足尾礦毒事件', wen='Ashio Copper Mine', wja='足尾鉱毒事件')
ev(id='jp_morinaga', c='chem', dt='1955-08', lon=134.58, lat=34.06, sh='e:200,80,80', sz=2,
   zh='森永砷奶粉事件', en='Morinaga arsenic milk poisoning', ja='森永ヒ素ミルク中毒事件',
   dzh='森永乳業德島工廠的嬰兒奶粉混入含砷的工業用添加物，西日本一萬多名嬰兒中毒，百餘人死亡，許多人留下後遺症。', den='Infant formula from Morinaga\'s Tokushima factory was made with an industrial additive containing arsenic; more than ten thousand babies in western Japan were poisoned, over a hundred died and many were left with lasting harm.',
   dead='130+', mzh='受害嬰兒約 1 萬 3 千人', men='About 13,000 infants poisoned', rzh='西日本受害分布（示意）', ren='Victims across western Japan (sketch)', wzh='森永砒霜牛奶事件', wen='Morinaga Milk arsenic poisoning incident', wja='森永ヒ素ミルク中毒事件')
ev(id='jp_minamata', c='chem', dt='1956-05-01', b=1968, k=1997, lon=130.40, lat=32.20, sh='e:45,18,20', sz=3,
   zh='水俣病', en='Minamata disease', ja='水俣病',
   dzh='窒素公司水俣工廠把含甲基汞的廢水排進水俣灣，魚貝類累積汞毒，不知火海沿岸居民出現神經病變；1956 年正式發現，政府到 1968 年才認定是公害。', den='Chisso\'s Minamata factory discharged methylmercury into Minamata Bay; it built up in fish and shellfish, and people around the Shiranui Sea suffered nerve damage. Officially discovered in 1956, it was recognised as pollution by the government only in 1968.',
   dead='', mzh='認定患者約 2,280 人', men='About 2,280 certified patients', rzh='水俣灣與不知火海沿岸', ren='Minamata Bay and the Shiranui Sea coast', wzh='水俁病', wen='Minamata disease', wja='水俣病')
ev(id='jp_yokkaichi', c='air', dt='1961', b=1972, lon=136.62, lat=34.97, sh='c:8', sz=2,
   zh='四日市哮喘', en='Yokkaichi asthma', ja='四日市ぜんそく',
   dzh='四日市石化聯合廠排放的二氧化硫造成周邊居民大量氣喘，1972 年患者勝訴，促使日本建立總量管制。', den='Sulphur dioxide from the Yokkaichi petrochemical complex gave asthma to many people around it; the patients won their lawsuit in 1972, leading Japan to cap total emissions.',
   dead='', mzh='', men='', rzh='石化聯合廠周邊', ren='Around the complex', wzh='四日市哮喘', wen='Yokkaichi asthma', wja='四日市ぜんそく')
ev(id='jp_niigata', c='chem', dt='1965-06', b=1971, lon=139.47, lat=37.68, rt='139.47,37.68 139.30,37.76 139.20,37.88 139.16,37.96', rd=60, sz=2,
   zh='新潟水俣病', en='Niigata Minamata disease', ja='新潟水俣病',
   dzh='昭和電工鹿瀨工廠排放的甲基汞污染阿賀野川，下游居民食魚中毒，是日本四大公害病之一。', den='Methylmercury from Shōwa Denkō\'s Kanose plant polluted the Agano River, and people downstream were poisoned by the fish: one of Japan\'s four big pollution diseases.',
   dead='', mzh='認定患者約 700 人', men='About 700 certified patients', rzh='阿賀野川下游', ren='The lower Agano', wzh='新潟水俁病', wen='Niigata Minamata disease', wja='新潟水俣病')
ev(id='jp_itaiitai', c='chem', dt='1968-05', k=2012, lon=137.30, lat=36.33, rt='137.30,36.33 137.25,36.50 137.21,36.65 137.22,36.76', rd=30, sh='e:9,6,0', sz=2,
   zh='痛痛病', en='Itai-itai disease', ja='イタイイタイ病',
   dzh='三井金屬神岡礦山排出的鎘污染神通川，下游稻米與飲水累積鎘，居民骨骼軟化疼痛；1968 年成為日本第一個政府認定的公害病，農地整治到 2012 年才完成。', den='Cadmium from the Mitsui Kamioka mine polluted the Jinzū River and the rice and water downstream, softening people\'s bones painfully. In 1968 it became the first pollution disease recognised by the Japanese government; the farmland was not cleaned up until 2012.',
   dead='', mzh='認定患者約 200 人', men='About 200 certified patients', rzh='神通川下游農地（示意）', ren='Farmland of the lower Jinzū (sketch)', wzh='痛痛病', wen='Itai-itai disease', wja='イタイイタイ病')
ev(id='jp_kanemi', c='chem', dt='1968-10', lon=130.88, lat=33.88, sh='e:120,60,60', sz=2,
   zh='米糠油事件（油症）', en='Yushō disease (Kanemi rice oil)', ja='カネミ油症事件',
   dzh='北九州 Kanemi 倉庫公司生產的米糠油，在脫臭加熱時混入作為熱媒的多氯聯苯（鐘淵化學製）與戴奧辛，福岡、長崎等西日本一帶大量受害，受害者的下一代也受影響；十一年後台灣發生類似的油症事件。', den='Rice-bran oil made by Kanemi in Kitakyūshū was contaminated with PCBs and dioxins from its heating system; many people in Fukuoka, Nagasaki and elsewhere in western Japan were harmed, as were their children. Taiwan had a similar poisoning eleven years later.',
   dead='', mzh='受害申報約 1 萬 4 千人', men='About 14,000 people reported harm', rzh='福岡、長崎一帶（示意）', ren='Around Fukuoka and Nagasaki (sketch)', wzh='米糠油事件', wen='Yushō disease', wja='カネミ油症事件')
ev(id='jp_smog', c='air', dt='1970-07-18', lon=139.63, lat=35.70, sh='c:25', sz=1, det=1,
   zh='東京光化學煙霧', en='Tokyo photochemical smog', ja='東京の光化学スモッグ',
   dzh='東京杉並區的立正高中學生在操場上課時紛紛眼睛刺痛、呼吸困難，是日本首次確認的光化學煙霧受害。', den='Pupils exercising at Risshō High School in Suginami, Tokyo, collapsed with stinging eyes and trouble breathing: the first recognised harm from photochemical smog in Japan.',
   dead='0', mzh='', men='', rzh='東京都區部', ren='Central Tokyo', wzh='光化學煙霧', wen='Photochemical smog', wja='光化学スモッグ')
ev(id='jp_toroku', c='chem', dt='1971-11', lon=131.27, lat=32.70, sh='c:1', sz=1, det=1,
   zh='土呂久砷公害', en='Toroku arsenic poisoning', ja='土呂久ヒ素公害',
   dzh='宮崎縣高千穗町土呂久礦山燒製亞砷酸的煙害長年毒害村民，1971 年經小學教師調查揭露。', den='Fumes from roasting arsenic ore at the Toroku mine in Takachiho, Miyazaki, poisoned villagers for decades; a primary-school teacher\'s survey exposed it in 1971.',
   dead='', mzh='', men='', rzh='土呂久地區', ren='The Toroku district', wzh='', wen='', wja='土呂久ヒ素公害')
ev(id='jp_mizushima', c='marine', dt='1974-12-18', lon=133.76, lat=34.50, rt='133.76,34.50 134.00,34.42 134.30,34.42 134.60,34.38 134.85,34.30', rd=20, sz=2,
   zh='水島重油外洩', en='Mizushima refinery oil spill', ja='三菱石油水島製油所重油流出事故',
   dzh='岡山水島的三菱石油煉油廠儲油槽破裂，重油流進瀨戶內海，擴散到香川、德島沿岸，漁業損失慘重。', den='A tank at Mitsubishi Oil\'s Mizushima refinery in Okayama ruptured; heavy oil spread through the Seto Inland Sea to the coasts of Kagawa and Tokushima, devastating fisheries.',
   dead='0', mzh='重油約 7,500–9,500 公秉', men='About 7,500–9,500 kl of heavy oil', rzh='瀨戶內海東部', ren='The eastern Seto Inland Sea', wzh='', wen='', wja='三菱石油水島製油所重油流出事故')
ev(id='jp_monju', c='nuclear', dt='1995-12-08', lon=135.99, lat=35.74, sh='c:0.5', sz=1, det=1,
   zh='文殊快滋生爐鈉外洩', en='Monju sodium leak', ja='もんじゅナトリウム漏洩事故',
   dzh='福井縣敦賀的快滋生原型爐「文殊」冷卻用的液態鈉外洩起火，營運單位隱匿現場影片，反應爐長期停機後於 2016 年決定除役。', den='Liquid sodium coolant leaked and burned at the Monju prototype fast breeder in Tsuruga, Fukui; the operator hid video of the scene, and the reactor stood idle for years until it was decommissioned from 2016.',
   dead='0', mzh='INES 第 1 級', men='INES level 1', rzh='反應爐建築', ren='The reactor building', wzh='文殊 (核電廠)', wen='Monju Nuclear Power Plant', wja='もんじゅ')
ev(id='jp_nakhodka', c='marine', dt='1997-01-02', lon=133.80, lat=37.20, rt='133.80,37.20 134.60,36.90 135.40,36.55 136.13,36.22', rd=5, sh='g:133.0,35.62 134.5,35.65 135.6,35.62 136.0,35.9 136.7,36.9 137.1,37.4 138.5,37.9 139.5,38.6 140.0,39.7 139.8,39.8 139.2,38.7 138.2,38.1 136.8,37.6 136.4,37.0 135.8,36.0 134.5,35.85 133.0,35.75', gd=40, sz=2,
   zh='納霍德卡號重油外洩', en='Nakhodka oil spill', ja='ナホトカ号重油流出事故',
   dzh='俄羅斯油輪納霍德卡號在隱岐群島外海斷裂沉沒，船首漂到福井三國町，重油污染島根到秋田的日本海沿岸，約 30 萬名志工清理。', den='The Russian tanker Nakhodka broke up and sank off the Oki Islands; her bow drifted to Mikuni, Fukui, and heavy oil fouled the Sea of Japan coast from Shimane to Akita. About 300,000 volunteers helped clean it.',
   dead='1', mzh='重油約 6,240 公秉', men='About 6,240 kl of heavy oil', rzh='日本海沿岸（示意）', ren='Sea of Japan coast (sketch)', wzh='', wen='Nakhodka oil spill', wja='ナホトカ号重油流出事故')
ev(id='jp_tokaibitumen', c='nuclear', dt='1997-03-11', lon=140.56, lat=36.45, sh='c:0.5', sz=1, det=1,
   zh='東海再處理廠瀝青固化設施火災爆炸', en='Tokai bituminisation plant fire', ja='動燃東海事業所アスファルト固化処理施設火災爆発事故',
   dzh='動力爐核燃料開發事業團東海事業所的瀝青固化設施起火爆炸，工作人員受輕微曝露。', den='A fire and explosion at the bitumen solidification facility of PNC\'s Tokai works exposed workers to small doses.',
   dead='0', mzh='INES 第 3 級', men='INES level 3', rzh='設施', ren='The facility', wzh='', wen='', wja='動燃東海事業所火災爆発事故')
ev(id='jp_jco', c='nuclear', dt='1999-09-30', lon=140.54, lat=36.48, sh='c:10', sz=2,
   zh='東海村 JCO 臨界事故', en='Tokaimura JCO criticality accident', ja='東海村 JCO 臨界事故',
   dzh='JCO 的鈾轉換工廠作業員違規以水桶把鈾溶液倒進沉澱槽，引發臨界反應持續約 20 小時；兩名作業員死亡，350 公尺內居民撤離、10 公里內約 31 萬人被要求留在室內。', den='Workers at JCO\'s uranium plant poured uranyl solution into a precipitation tank by bucket against the rules; a chain reaction ran for about 20 hours. Two workers died; people within 350 m were evacuated and some 310,000 within 10 km were told to stay indoors.',
   dead='2', mzh='INES 第 4 級', men='INES level 4', rzh='10 公里室內避難範圍', ren='10 km shelter-indoors zone', wzh='東海村JCO臨界事故', wen='Tokaimura nuclear accidents', wja='東海村JCO臨界事故')
ev(id='jp_mihama', c='nuclear', dt='2004-08-09', lon=135.96, lat=35.70, sh='c:0.5', sz=1, det=1,
   zh='美濱核電廠蒸汽管破裂', en='Mihama steam pipe rupture', ja='美浜発電所 3 号機配管破損事故',
   dzh='關西電力美濱三號機的二次冷卻系統管線因長期未檢查而減薄破裂，高溫蒸汽噴出，正在準備定檢的工人死傷；沒有輻射外洩。', den='A secondary-loop pipe at Kansai Electric\'s Mihama 3, thinned and never inspected, burst; scalding steam killed and injured workers preparing an inspection. No radiation escaped.',
   dead='5', mzh='6 人受傷', men='6 injured', rzh='渦輪機房', ren='The turbine hall', wzh='美濱核電廠', wen='Mihama Nuclear Power Plant', wja='美浜発電所')
ev(id='jp_fujinuma', c='dam', dt='2011-03-11', lon=140.20, lat=37.30, rt='140.20,37.30 140.23,37.29 140.27,37.28', rd=1, sz=1, det=1,
   zh='藤沼水庫潰決', en='Fujinuma Dam failure', ja='藤沼ダム決壊',
   dzh='東日本大地震中，福島縣須賀川市的農業用藤沼水庫土堤崩潰，洪水沖毀下游的長沼地區。', den='In the Great East Japan Earthquake the earth embankment of the Fujinuma irrigation reservoir in Sukagawa, Fukushima, collapsed and the flood swept the Naganuma district below.',
   dead='8', mzh='', men='', rzh='下游長沼地區', ren='The Naganuma district below', wzh='', wen='Fujinuma Dam', wja='藤沼ダム')
ev(id='jp_atami', c='dam', dt='2021-07-03', lon=139.07, lat=35.11, rt='139.06,35.12 139.07,35.11 139.08,35.10', rd=1, sz=1, det=1,
   zh='熱海土石流', en='2021 Atami landslide', ja='熱海市伊豆山土石流災害',
   dzh='靜岡縣熱海市伊豆山上游違規堆置的盛土在豪雨中崩落，土石流沖下逢初川沿岸住宅；之後日本制定《盛土規制法》。', den='Illegal fill heaped above Izusan in Atami, Shizuoka, collapsed in heavy rain and a debris flow ran down the Aizome River through the houses; Japan then passed a law regulating fill.',
   dead='27', mzh='', men='', rzh='逢初川沿岸', ren='Along the Aizome River', wzh='', wen='2021 Atami landslide', wja='熱海市伊豆山土石流災害')
