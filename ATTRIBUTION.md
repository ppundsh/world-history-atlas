# Attribution

## Data

| Source | Used for | License |
|---|---|---|
| Seshat Global History Databank — **Cliopatria** v0.21 (Bennett et al.) | historical polity borders, 3400 BCE–2024 | CC BY 4.0 |
| **Natural Earth** (naturalearthdata.com) | modern borders, POV files, disputed areas, admin-1 (China/Taiwan units), coastlines, lakes, rivers, bathymetry, physical regions, glaciers | Public domain |
| **Wikidata** | polity names in zh-Hant / zh-Hans / ja | CC0 |
| NASA Earth Observatory — **Blue Marble: Next Generation** w/ Topography and Bathymetry, July 2004 (Reto Stöckli): the 5400×2700 global image and the 21600×21600 D1 tile | satellite base map (`public/basemap/`: global image + tiles z0–5; East Asia crop z6–7; Taiwan crop z8–9) | Public domain; credit "NASA Earth Observatory" |
| **OpenStreetMap** contributors — main rivers of Taiwan (waterway=river, fetched via Overpass 2026-11-18, simplified; `data-pipeline/taiwan/rivers_osm.txt`, `public/data/rivers_tw.json`) | Taiwan rivers when zoomed in (Natural Earth has none there) | ODbL 1.0 — © OpenStreetMap contributors |
| **Natural Earth** 1:50m boundary lines, 1:10m rivers and lakes | modern-borders overlay, rivers and lakes when zoomed in | Public domain |
| Ministry of the Interior (Taiwan) township boundaries, via the npm package **taiwan-atlas** 2021.9.20 (`data-pipeline/taiwan/src/towns-10t.json`) | Taiwan mode units (built from townships) | Government Open Data License v1.0 (data); MIT (topology package) |
| 国土数値情報（行政区域データ N03, 2021-01-01）, 国土交通省, via smartnews-smri/japan-topography (`data-pipeline/japan/src/`) | Japan mode units (built from municipalities) | 「国土数値情報（行政区域データ）」（国土交通省）を加工して作成 — 国土数値情報利用約款 |
| Japanese Wikipedia, 郡域 sections of the district articles (extracted list in `data-pipeline/japan/src/wiki_gun.txt`) | which province each municipality lay in | CC BY-SA 4.0 (facts extracted; articles linked) |
| 內政部 全台 20 公尺 DEM（2025 年版，`不分幅_全台20MDEM(2025).zip`）https://data.gov.tw/dataset/169807 | Taiwan terrain shading tiles (`public/relief/tw/`, made by `data-pipeline/relief_tw.py`) | 政府資料開放授權條款－第1版 |
| 国土地理院 地理院タイル「陰影起伏図」 https://maps.gsi.go.jp/development/ichiran.html | Japan terrain shading on the physical base map (loaded from GSI at view time, not stored) | 出典明示で利用可（国土地理院コンテンツ利用規約）; credited on the map while shown |
| Wikipedia (linked, not copied) | sources cited in the override tables, event files and info panels | — |

Projection notes (`data-pipeline/projinfo.tsv`), faction notes (`data-pipeline/*/info.tsv`), the world-events list (`data-pipeline/events_world.tsv`), the religion notes (`data-pipeline/overrides/religion_info.tsv`), the event-system files (`data-pipeline/events/`), the projection distortion scores (`src/projmetrics.gen.js`, computed), the China and Taiwan mode tables (`data-pipeline/china`, `data-pipeline/taiwan`), the name overrides and the religion tables are original compilations from general historical references and are released under CC BY 4.0 together with the derived map data.

## Music

| Item | License |
|---|---|
| "編年 Chronicle", "絲路 Silk Road", "帝國行進 March of Empires", "吟遊 Troubadour", "沙漠商隊 Caravan", "大航海 Voyage", "黎明 Dawn" — original compositions for this project (`music/scores/`) | CC0 1.0 |
| FluidR3_GM SoundFont (Frank Wen), via gleitz/midi-js-soundfonts | CC BY 3.0 |

## Software (bundled)

| Package | License |
|---|---|
| MapLibre GL JS | BSD-3-Clause |
| d3-geo, d3-geo-projection, d3-array, d3-selection, d3-zoom | ISC |
| topojson-client | ISC |
| polylabel (Mapbox) | ISC |
| versor | ISC |

## Build tools

mapshaper (MPL-2.0), opencc-js (MIT), Vite (MIT), shapely (BSD-3-Clause).
