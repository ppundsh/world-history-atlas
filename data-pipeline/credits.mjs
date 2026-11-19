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
      u: ['現代國界、各國觀點與爭議地區、省級行政區、海岸、湖泊、河流、海深、自然地理區、冰川、首都位置', 'Modern borders, points of view and disputed areas, admin-1 regions, coastlines, lakes, rivers, bathymetry, physical regions, glaciers, capitals', '現在の国境、各国視点と係争地、州・県、海岸線、湖、河川、海深、自然地域、氷河、首都の位置'] },
    { n: 'Wikidata', url: 'https://www.wikidata.org/', lic: 'CC0 1.0', licUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      u: ['政權的繁中、簡中、日文名稱', 'Polity names in Chinese and Japanese', '政権の中国語・日本語名'] },
    { n: 'V-Dem Country-Year Dataset v15（Varieties of Democracy Institute；vdemdata）', url: 'https://www.v-dem.net/', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      u: ['政體模式：世界政體四分類與元首類型（衍生資料 public/data/regimes.json 依同授權釋出）', 'Regime-type mode: Regimes of the World and head-of-state type (the derived public/data/regimes.json is released under the same licence)', '政治体制モード：世界の体制 4 分類と元首の種類（派生データ public/data/regimes.json は同じライセンス）'] },
    { n: 'NASA Earth Observatory — Blue Marble: Next Generation (Reto Stöckli)', url: 'https://earthobservatory.nasa.gov/features/BlueMarble', lic: ['公有領域（註明 NASA Earth Observatory）', 'Public domain (credit NASA Earth Observatory)', 'パブリックドメイン（NASA Earth Observatory と明記）'],
      u: ['衛星影像底圖', 'Satellite base map', '衛星画像の背景地図'] },
    { n: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', lic: 'ODbL 1.0', licUrl: 'https://opendatacommons.org/licenses/odbl/',
      u: ['台灣主要河川（放大時）', 'Main rivers of Taiwan (when zoomed in)', '台湾の主な河川（拡大時）'] },
    { n: '內政部 鄉鎮市區界線（經 npm 套件 taiwan-atlas）', url: 'https://data.gov.tw/', lic: OGDL, licUrl: 'https://data.gov.tw/license',
      u: ['台灣模式的單元（由鄉鎮市區組成）', 'Taiwan-mode units (built from townships)', '台湾モードの単位（郷鎮市区から作成）'] },
    { n: '內政部地政司 2025 年版全臺灣 20 公尺網格數值地形模型 DTM 資料', url: 'https://data.gov.tw/dataset/176927', lic: OGDL, licUrl: 'https://data.gov.tw/license',
      u: ['台灣地形陰影圖磚（本專案加工製作，public/relief/tw）', 'Taiwan hillshade tiles (made by this project, public/relief/tw)', '台湾の陰影タイル（本プロジェクトで加工、public/relief/tw）'] },
    { n: '国土交通省 国土数値情報（行政区域データ N03，2021 年）', url: 'https://nlftp.mlit.go.jp/ksj/', lic: ['国土数値情報利用約款：「国土数値情報（行政区域データ）（国土交通省）」を加工して作成', 'National Land Numerical Information terms: processed from "国土数値情報（行政区域データ）（国土交通省）"', '国土数値情報利用約款：「国土数値情報（行政区域データ）（国土交通省）」を加工して作成'], licUrl: 'https://nlftp.mlit.go.jp/ksj/other/agreement.html',
      u: ['日本模式的單元（由市區町村組成）', 'Japan-mode units (built from municipalities)', '日本モードの単位（市区町村から作成）'] },
    { n: '国土地理院 地理院タイル「陰影起伏図」', url: 'https://maps.gsi.go.jp/development/ichiran.html', lic: ['國土地理院內容利用規約（須註明出處）', 'GSI content terms of use (credit required)', '国土地理院コンテンツ利用規約（出典明示）'], licUrl: 'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html',
      u: ['日本地形陰影（開啟高解析地形時即時載入，未存檔）', 'Japan hillshade (loaded live when detailed terrain is on; not stored)', '日本の陰影起伏（高解像度地形を有効にした時に読み込み、保存しない）'] },
    { n: 'Wikipedia（中文、English、日本語）', url: 'https://www.wikipedia.org/', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      u: ['各模式年表、說明與覆寫表的參考來源（以連結引用，不轉載內文）；日文維基各郡條目「郡域」整理出市町村所屬令制國', 'References for the timelines, notes and override tables (linked, not copied); the 郡域 sections of Japanese district articles for which province each municipality lay in', '各モードの年表・解説・修正表の参考（リンクのみ、本文は転載しない）。日本語版各郡記事の「郡域」から市町村の旧国を整理'] },
    { n: ['本專案整理的資料', 'Data compiled for this project', '本プロジェクトの作成データ'], url: 'https://github.com/ppundsh/world-history-atlas', lic: 'CC BY 4.0', licUrl: 'https://creativecommons.org/licenses/by/4.0/',
      u: ['各地區模式的勢力、統治、行政區劃、政府所在地與事件表，世界事件、宗教、藝術史、投影說明與名稱對照', 'The regional modes\' factions, control, divisions, seats and events; world events, religions, art history, projection notes and name tables', '地域モードの勢力・支配・行政区画・政庁・年表、世界の出来事、宗教、美術史、図法の解説、名称表'] },
  ] },
  { id: 'projects', t: ['參考與使用的專案', 'Projects used', '利用したプロジェクト'], items: [
    { n: 'taiwan-atlas（dkaoster）', url: 'https://github.com/dkaoster/taiwan-atlas', lic: 'MIT', u: ['台灣鄉鎮界線 TopoJSON', 'Taiwan township TopoJSON', '台湾の郷鎮境界 TopoJSON'] },
    { n: 'japan-topography（smartnews-smri）', url: 'https://github.com/smartnews-smri/japan-topography', lic: ['資料依国土数値情報利用約款', 'Data under the National Land Numerical Information terms', 'データは国土数値情報利用約款による'], u: ['日本市區町村界線（国土数値情報 N03 的 GeoJSON 版）', 'Japanese municipal boundaries (GeoJSON of N03)', '市区町村境界（N03 の GeoJSON 版）'] },
    { n: 'vdemdata（V-Dem Institute）', url: 'https://github.com/vdeminstitute/vdemdata', lic: ['資料：CC BY-SA 4.0', 'Data: CC BY-SA 4.0', 'データ：CC BY-SA 4.0'], u: ['V-Dem 資料檔 vdem.RData', 'The V-Dem data file vdem.RData', 'V-Dem データファイル vdem.RData'] },
    { n: 'natural-earth-vector（nvkelso）', url: 'https://github.com/nvkelso/natural-earth-vector', lic: ['公有領域', 'Public domain', 'パブリックドメイン'], u: ['Natural Earth 的 GeoJSON 版', 'GeoJSON edition of Natural Earth', 'Natural Earth の GeoJSON 版'] },
    { n: 'midi-js-soundfonts（gleitz）', url: 'https://github.com/gleitz/midi-js-soundfonts', lic: ['FluidR3_GM：CC BY 3.0', 'FluidR3_GM: CC BY 3.0', 'FluidR3_GM：CC BY 3.0'], u: ['背景音樂的樂器音色', 'Instrument samples for the music', 'BGM の楽器音源'] },
  ] },
  { id: 'music', t: ['音樂', 'Music', '音楽'], items: [
    { n: ['〈編年 Chronicle〉〈絲路 Silk Road〉〈帝國行進 March of Empires〉〈吟遊 Troubadour〉〈沙漠商隊 Caravan〉〈大航海 Voyage〉〈黎明 Dawn〉', '"Chronicle", "Silk Road", "March of Empires", "Troubadour", "Caravan", "Voyage", "Dawn"', '「編年」「絲路」「帝国行進」「吟遊」「隊商」「大航海」「黎明」'], url: 'https://github.com/ppundsh/world-history-atlas/tree/main/music', lic: 'CC0 1.0', licUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
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
