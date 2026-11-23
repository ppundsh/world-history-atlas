// One list of every data source, reference project, music and software, with its licence.
// node data-pipeline/credits.mjs  →  src/credits.gen.js (the "About" dialog) and ATTRIBUTION.md
// Text: [zh-Hant, English, 日本語]; zh-Hans is converted with OpenCC.
import fs from 'node:fs';
import * as OpenCC from 'opencc-js';
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const OGDL = ['政府資料開放授權條款－第1版', 'Open Government Data License, version 1.0', '政府データオープンライセンス第1版'];
const SECTIONS = [
  { id: 'data', t: ['資料來源', 'Data sources', 'データの出典'], items: [
    { n: 'Seshat Global History Databank — Cliopatria v0.21', url: 'https://github.com/Seshat-Global-History-Databank/cliopatria', lic: 'CC BY 4.0', licUrl: 'https://creativecommons.org/licenses/by/4.0/',
      u: ['歷代政權疆界（西元前 3400 年–2024 年），本專案再加修正', 'Historical polity borders, 3400 BCE–2024, with this project\'s corrections', '歴代政権の領域（前 3400–2024 年）、本プロジェクトで修正'] },
    { n: 'Natural Earth', url: 'https://www.naturalearthdata.com/', lic: ['公有領域', 'Public domain', 'パブリックドメイン'],
      u: ['現代國界、各國觀點與爭議地區、省級行政區、海岸、湖泊、河流、海深、自然地理區、冰川、首都位置；地區模式的鐵路與道路路線（1:10m railroads、roads）；漂浮國家比較的人口與 GDP（POP_EST、GDP_MD）', 'Modern borders, points of view and disputed areas, admin-1 regions, coastlines, lakes, rivers, bathymetry, physical regions, glaciers, capitals; railway and road routes in the regional modes (1:10m railroads and roads); population and GDP in the floating-country comparison (POP_EST, GDP_MD)', '現在の国境、各国視点と係争地、州・県、海岸線、湖、河川、海深、自然地域、氷河、首都の位置；地域モードの鉄道・道路の路線（1:10m railroads、roads）；国の比較の人口と GDP（POP_EST、GDP_MD）'] },
    { n: 'Wikidata', url: 'https://www.wikidata.org/', lic: 'CC0 1.0', licUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      u: ['政權的繁中、簡中、日文名稱；首都；藝術史作品的名稱、作者、年代與收藏館；世界模式的機場與港口數（依開港、關閉年份計算）（事先擷取，隨網站提供）', 'Polity names in Chinese and Japanese; capitals; titles, artists, dates and collections of the artworks; the numbers of airports and ports in the world mode (from their opening and closing years) (fetched once and bundled with the site)', '政権の中国語・日本語名、首都、美術作品の名称・作者・年代・所蔵館；世界モードの空港と港の数（開港・閉鎖年から計算）（事前に取得してサイトに同梱）'] },
    { n: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/', lic: ['各圖不同（公有領域、CC BY、CC BY-SA 等）', 'Varies by file (public domain, CC BY, CC BY-SA …)', 'ファイルごとに異なる（パブリックドメイン、CC BY、CC BY-SA など）'],
      u: ['所有縮圖（作品、事件、人物、首都、地點、國家照片與國旗）：事先縮小並轉為 WebP 隨網站提供，未做其他修改；每張圖的作者、授權與原始頁面列在圖旁，完整清單見 offline/CREDITS.md', 'Every thumbnail (artworks, events, people, capitals, places, photographs and flags of countries): shrunk and re-encoded as WebP and bundled with the site, otherwise unchanged; each picture\'s author, licence and file page are shown beside it, and the full list is in offline/CREDITS.md', 'すべてのサムネイル（作品・出来事・人物・首都・場所・国の写真と国旗）：縮小して WebP に変換しサイトに同梱（その他の改変なし）。作者・ライセンス・元ページは各画像に表示、全一覧は offline/CREDITS.md'] },
    { n: 'V-Dem Country-Year Dataset v15（Varieties of Democracy Institute；vdemdata）', url: 'https://www.v-dem.net/', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      u: ['政體模式：世界政體四分類與元首類型（衍生資料 public/data/regimes.json 依同授權釋出）', 'Regime-type mode: Regimes of the World and head-of-state type (the derived public/data/regimes.json is released under the same licence)', '政治体制モード：世界の体制 4 分類と元首の種類（派生データ public/data/regimes.json は同じライセンス）'] },
    { n: 'NASA Earth Observatory — Blue Marble: Next Generation (Reto Stöckli)', url: 'https://earthobservatory.nasa.gov/features/BlueMarble', lic: ['公有領域（註明 NASA Earth Observatory）', 'Public domain (credit NASA Earth Observatory)', 'パブリックドメイン（NASA Earth Observatory と明記）'],
      u: ['衛星影像底圖', 'Satellite base map', '衛星画像の背景地図'] },
    { n: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', lic: 'ODbL 1.0', licUrl: 'https://opendatacommons.org/licenses/odbl/',
      u: ['台灣主要河川（放大時）；地區模式的鐵路與道路路線（各模式的 routes_osm.json 以 ODbL 授權提供）；各國模式補充的發電廠（econ/osm_plants.tsv，ODbL）', 'Main rivers of Taiwan (when zoomed in); railway and road routes in the regional modes (each mode\'s routes_osm.json is available under the ODbL); additional power plants in the country modes (econ/osm_plants.tsv, ODbL)', '台湾の主な河川（拡大時）；地域モードの鉄道・道路の路線（各モードの routes_osm.json は ODbL で提供）'] },
    { n: 'Terrain Tiles（Mapzen／Tilezen，AWS 開放資料）', url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md', lic: 'SRTM、GMTED2010、ETOPO1 等（公有領域／開放授權）', licUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
      u: ['各國模式自然地理底圖的地形陰影（本專案以高程資料計算）', 'Hill shading of the country modes\' physical base map (computed here from the elevation data)', '国別モードの自然地理の地図の陰影起伏（標高データから計算）'] },
    { n: 'World Resources Institute — Global Power Plant Database 1.3.0', url: 'https://datasets.wri.org/dataset/globalpowerplantdatabase', lic: 'CC BY 4.0', licUrl: 'https://creativecommons.org/licenses/by/4.0/',
      u: ['各國模式的發電廠：名稱、燃料、裝置容量、啟用年、經營者；漂浮國家比較的電廠數與總裝置容量；世界模式各年的電廠數與裝置容量（依啟用年計算）', 'Power plants in the country modes: name, fuel, capacity, commissioning year, owner; the number of plants in each country and total capacity in the floating-country comparison; plants and capacity per year in the world mode (from commissioning years)', '国別モードの発電所：名称、燃料、設備容量、運転開始年、事業者；国の比較の発電所数と総設備容量；世界モードの年ごとの発電所数と設備容量（運転開始年から計算）'] },
    { n: 'TeleGeography — Submarine Cable Map', url: 'https://www.submarinecablemap.com/', lic: 'CC BY-NC-SA 3.0', licUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      u: ['網際網路模式與各地區模式的現役海底電纜路線、登陸站、啟用年、長度與營運者（路線已簡化）；世界模式各年的海纜數（依啟用年計算）', 'Routes, landing stations, ready-for-service years, lengths and operators of current submarine cables in the Internet and regional modes (routes simplified); the number of cables per year in the world mode (from ready-for-service years)', 'インターネットモードと各地域モードの現役海底ケーブルの経路、陸揚げ局、運用開始年、長さ、運営者（経路は簡略化）；世界モードの年ごとのケーブル数（運用開始年から計算）'] },
    { n: '內政部 鄉鎮市區界線（經 npm 套件 taiwan-atlas）', url: 'https://data.gov.tw/', lic: OGDL, licUrl: 'https://data.gov.tw/license',
      u: ['台灣模式的單元（由鄉鎮市區組成）', 'Taiwan-mode units (built from townships)', '台湾モードの単位（郷鎮市区から作成）'] },
    { n: '內政部地政司 2025 年版全臺灣 20 公尺網格數值地形模型 DTM 資料', url: 'https://data.gov.tw/dataset/176927', lic: OGDL, licUrl: 'https://data.gov.tw/license',
      u: ['台灣地形陰影圖磚（本專案加工製作，public/relief/tw）', 'Taiwan hillshade tiles (made by this project, public/relief/tw)', '台湾の陰影タイル（本プロジェクトで加工、public/relief/tw）'] },
    { n: '国土交通省 国土数値情報（行政区域データ N03，2021 年）', url: 'https://nlftp.mlit.go.jp/ksj/', lic: ['国土数値情報利用約款：「国土数値情報（行政区域データ）（国土交通省）」を加工して作成', 'National Land Numerical Information terms: processed from "国土数値情報（行政区域データ）（国土交通省）"', '国土数値情報利用約款：「国土数値情報（行政区域データ）（国土交通省）」を加工して作成'], licUrl: 'https://nlftp.mlit.go.jp/ksj/other/agreement.html',
      u: ['日本模式的單元（由市區町村組成）', 'Japan-mode units (built from municipalities)', '日本モードの単位（市区町村から作成）'] },
    { n: '国土地理院 地理院タイル「陰影起伏図」', url: 'https://maps.gsi.go.jp/development/ichiran.html', lic: ['國土地理院內容利用規約（須註明出處）', 'GSI content terms of use (credit required)', '国土地理院コンテンツ利用規約（出典明示）'], licUrl: 'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html',
      u: ['日本地形陰影（開啟高解析地形時即時載入，未存檔）', 'Japan hillshade (loaded live when detailed terrain is on; not stored)', '日本の陰影起伏（高解像度地形を有効にした時に読み込み、保存しない）'] },
    { n: 'Wikipedia（中文、English、日本語）', url: 'https://www.wikipedia.org/', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      u: ['各模式年表、說明與覆寫表的參考來源；事件說明卡中的條目導言摘錄（CC BY-SA 4.0，事先擷取隨網站提供，每段附條目連結）；日文維基各郡條目「郡域」整理出市町村所屬令制國', 'References for the timelines, notes and override tables; the article introductions quoted in event cards (CC BY-SA 4.0, fetched once and bundled, each linked to its article); the 郡域 sections of Japanese district articles for which province each municipality lay in', '各モードの年表・解説・修正表の参考。出来事の説明に引用する記事冒頭（CC BY-SA 4.0、事前取得して同梱、各記事にリンク）。日本語版各郡記事の「郡域」から市町村の旧国を整理'] },
    { n: ['語言的發展模式參考文獻', 'References for the languages mode', '言語の発展モードの参考文献'], url: 'https://en.wikipedia.org/wiki/Austronesian_peoples', lic: ['學術文獻（僅引用年代與分布，以本專案文字改寫）', 'Scholarly literature (dates and distributions only, in this project\'s own words)', '学術文献（年代と分布のみ、本プロジェクトの文章で記述）'],
      u: ['Blust (1999, 2009)；Bellwood, Prehistory of the Indo-Malaysian Archipelago；Gray, Drummond & Greenhill (2009) Science 323:479；Spriggs (2011) Antiquity 85:510；李壬癸《台灣南島民族的族群與遷徙》；Norman, Chinese (1988)；《中國語言地圖集》(1987)', 'Blust (1999, 2009); Bellwood, Prehistory of the Indo-Malaysian Archipelago; Gray, Drummond & Greenhill (2009) Science 323:479; Spriggs (2011) Antiquity 85:510; Li Paul Jen-kuei on Formosan peoples and migrations; Norman, Chinese (1988); Language Atlas of China (1987)', 'Blust (1999, 2009)、Bellwood、Gray ほか (2009) Science 323:479、Spriggs (2011) Antiquity 85:510、李壬癸、Norman (1988)、『中国語言地図集』(1987)'] },
    { n: ['金融史模式參考文獻', 'References for the finance mode', '金融史モードの参考文献'], url: 'https://en.wikipedia.org/wiki/History_of_money', lic: ['學術文獻（僅引用年代與地點，以本專案文字改寫）', 'Scholarly literature (dates and places only, in this project\'s own words)', '学術文献（年代と場所のみ、本プロジェクトの文章で記述）'],
      u: ['Ferguson《貨幣崛起》；Kindleberger《瘋狂、恐慌與崩盤》；Reinhart & Rogoff《這次不一樣》；彭信威《中國貨幣史》；Flynn & Giráldez (1995) Journal of World History 6:201', 'Ferguson, The Ascent of Money; Kindleberger, Manias, Panics and Crashes; Reinhart & Rogoff, This Time Is Different; Peng Xinwei, A Monetary History of China; Flynn & Giráldez (1995) Journal of World History 6:201', 'Ferguson『マネーの進化史』、Kindleberger『熱狂、恐慌、崩壊』、Reinhart & Rogoff『国家は破綻する』、彭信威『中国貨幣史』、Flynn & Giráldez (1995)'] },
    { n: ['本專案整理的資料', 'Data compiled for this project', '本プロジェクトの作成データ'], url: 'https://github.com/ppundsh/world-history-atlas', lic: 'CC BY 4.0', licUrl: 'https://creativecommons.org/licenses/by/4.0/',
      u: ['各地區模式的勢力、統治、行政區劃、政府所在地與事件表，世界事件、宗教、藝術史、語言的發展、金融史、投影說明與名稱對照', 'The regional modes\' factions, control, divisions, seats and events; world events, religions, art history, projection notes and name tables', '地域モードの勢力・支配・行政区画・政庁・年表、世界の出来事、宗教、美術史、図法の解説、名称表'] },
  ] },
  { id: 'projects', t: ['參考與使用的專案', 'Projects used', '利用したプロジェクト'], items: [
    { n: 'taiwan-atlas（dkaoster）', url: 'https://github.com/dkaoster/taiwan-atlas', lic: 'MIT', u: ['台灣鄉鎮界線 TopoJSON', 'Taiwan township TopoJSON', '台湾の郷鎮境界 TopoJSON'] },
    { n: 'japan-topography（smartnews-smri）', url: 'https://github.com/smartnews-smri/japan-topography', lic: ['資料依国土数値情報利用約款', 'Data under the National Land Numerical Information terms', 'データは国土数値情報利用約款による'], u: ['日本市區町村界線（国土数値情報 N03 的 GeoJSON 版）', 'Japanese municipal boundaries (GeoJSON of N03)', '市区町村境界（N03 の GeoJSON 版）'] },
    { n: 'vdemdata（V-Dem Institute）', url: 'https://github.com/vdeminstitute/vdemdata', lic: ['資料：CC BY-SA 4.0', 'Data: CC BY-SA 4.0', 'データ：CC BY-SA 4.0'], u: ['V-Dem 資料檔 vdem.RData', 'The V-Dem data file vdem.RData', 'V-Dem データファイル vdem.RData'] },
    { n: 'natural-earth-vector（nvkelso）', url: 'https://github.com/nvkelso/natural-earth-vector', lic: ['公有領域', 'Public domain', 'パブリックドメイン'], u: ['Natural Earth 的 GeoJSON 版', 'GeoJSON edition of Natural Earth', 'Natural Earth の GeoJSON 版'] },
    { n: 'midi-js-soundfonts（gleitz）', url: 'https://github.com/gleitz/midi-js-soundfonts', lic: ['FluidR3_GM：CC BY 3.0', 'FluidR3_GM: CC BY 3.0', 'FluidR3_GM：CC BY 3.0'], u: ['背景音樂的樂器音色', 'Instrument samples for the music', 'BGM の楽器音源'] },
  ] },
  { id: 'inspiration', t: ['靈感來源', 'Inspiration', '着想のもと'], items: [
    { n: ['敏迪選讀《小島大面積》（Pinkoi）', 'Mindi World News, "Small Island, Big Area" (Pinkoi)', '敏迪選読『小島大面積』（Pinkoi）'], url: 'https://www.pinkoi.com/product/SPRcAfXL', lic: ['僅介紹與連結，未使用其圖文', 'Credited and linked only; none of its text or artwork is used', '紹介とリンクのみ。図版・文章は使用していない'],
      u: ['以等比例國家卡片比較各國真實大小的桌遊；「懸浮台灣」的構想來自這個產品，本站以自己的資料與程式實作', 'A board game of to-scale country cards for comparing real sizes; the idea for "Floating Taiwan" came from it, built here with this project\'s own data and code', '縮尺をそろえた国のカードで実際の大きさを比べるボードゲーム。「浮かぶ台湾」はこの製品から着想し、本サイト独自のデータとプログラムで実装'] },
  ] },
  { id: 'music', t: ['音樂', 'Music', '音楽'], items: [
    { n: ['〈編年 Chronicle〉〈絲路 Silk Road〉〈帝國行進 March of Empires〉〈吟遊 Troubadour〉〈沙漠商隊 Caravan〉〈大航海 Voyage〉〈黎明 Dawn〉〈英靈之詩 Ode to the Heroic Spirits〉', '"Chronicle", "Silk Road", "March of Empires", "Troubadour", "Caravan", "Voyage", "Dawn", "Ode to the Heroic Spirits"', '「編年」「絲路」「帝国行進」「吟遊」「隊商」「大航海」「黎明」「英霊の詩」'], url: 'https://github.com/ppundsh/world-history-atlas/tree/main/music', lic: 'CC0 1.0', licUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      u: ['本專案原創曲（樂譜程式在 music/scores）', 'Original compositions for this project (scores in music/scores)', '本プロジェクトのオリジナル曲（楽譜は music/scores）'] },
    { n: 'FluidR3_GM SoundFont（Frank Wen）', url: 'https://github.com/gleitz/midi-js-soundfonts', lic: 'CC BY 3.0', licUrl: 'https://creativecommons.org/licenses/by/3.0/', u: ['音色', 'Instrument sounds', '音色'] },
  ] },
  { id: 'software', t: ['軟體', 'Software', 'ソフトウェア'], items: [
    { n: 'MapLibre GL JS', url: 'https://maplibre.org/', lic: 'BSD-3-Clause', u: ['3D 地球', '3D globe', '3D 地球儀'] },
    { n: 'd3-geo、d3-geo-projection、d3-array、d3-selection、d3-zoom', url: 'https://d3js.org/', lic: 'ISC', u: ['投影與平面地圖', 'Projections and flat maps', '図法と平面地図'] },
    { n: 'topojson-client、polylabel、versor', url: 'https://github.com/topojson/topojson-client', lic: 'ISC', u: ['幾何資料與標籤位置', 'Geometry and label placement', '幾何データとラベル位置'] },
    { n: ['建置工具：Vite（MIT）、mapshaper（MPL-2.0）、opencc-js（MIT、Apache-2.0）、shapely（BSD-3-Clause）、numpy（BSD-3-Clause）、Pillow（MIT-CMU）、pyreadr（AGPL-3.0，僅用於讀取 V-Dem 資料，不隨網站發布）', 'Build tools: Vite (MIT), mapshaper (MPL-2.0), opencc-js (MIT, Apache-2.0), shapely (BSD-3-Clause), numpy (BSD-3-Clause), Pillow (MIT-CMU), pyreadr (AGPL-3.0, only to read the V-Dem file; not shipped)', 'ビルドツール：Vite（MIT）、mapshaper（MPL-2.0）、opencc-js（MIT・Apache-2.0）、shapely（BSD-3-Clause）、numpy（BSD-3-Clause）、Pillow（MIT-CMU）、pyreadr（AGPL-3.0、V-Dem の読み込みのみ。サイトには含まない）'], lic: '—', u: ['', '', ''] },
  ] },
];
const tri = v => typeof v === 'string' ? [v, v, toHans(v), v] : [v[1], v[0], toHans(v[0]), v[2]];   // → [en, hant, hans, ja] (polity column order)
const gen = SECTIONS.map(s => ({ id: s.id, t: tri(s.t), items: s.items.map(i => ({ n: tri(i.n), url: i.url, lic: tri(i.lic), licUrl: i.licUrl || '', u: tri(i.u) })) }));
fs.writeFileSync('src/credits.gen.js', '// generated by data-pipeline/credits.mjs — do not edit\n// text arrays: [en, zh-Hant, zh-Hans, ja] (the polity column order)\nexport const CREDITS = ' + JSON.stringify(gen) + ';\n');
let md = '# Attribution / 資料來源與授權\n\n由 `data-pipeline/credits.mjs` 產生，網站「關於」視窗顯示同一份清單。Generated by `data-pipeline/credits.mjs`; the site\'s About dialog shows the same list.\n';
for (const s of gen) {
  md += `\n## ${s.t[1]} / ${s.t[0]}\n\n| 名稱 | 用途 | 授權 |\n|---|---|---|\n`;
  for (const i of s.items) md += `| [${i.n[1]}](${i.url}) | ${i.u[1]} | ${i.licUrl ? `[${i.lic[1]}](${i.licUrl})` : i.lic[1]} |\n`;
}
fs.writeFileSync('ATTRIBUTION.md', md);
console.log('credits:', gen.reduce((a, s) => a + s.items.length, 0), 'items');
