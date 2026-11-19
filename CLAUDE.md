# CLAUDE.md — 世界國家演變互動地圖（World History Atlas）

> 本檔是本專案的工作守則。任何人（或 Claude）動手寫程式前先讀這份。
> 狀態：**v1.5**（2026-11-19；第 4 節為實作後的實際架構，第 7 節為後續新增功能）。

## 1. 專案目標

把參考影片 `世界國家演變.mp4`（6HHUNTER 製作，約 4 分 13 秒，1280×720）的概念，做成一個可放在 **GitHub Pages** 的靜態互動網頁：

| 參考影片 | 本專案 |
|---|---|
| 只涵蓋亞歐非（大西洋～日本） | **全世界** |
| 單一等距圓柱 + 衛星底圖 | **多種地圖投影** + **3D 地球模式** |
| 固定播放，無法互動 | 可旋轉／平移／縮放，操作對標 Google Maps |
| 時間到 AD2015 | 時間軸到 **2026** |
| 只有簡體中文 | **多國語言切換**，簡繁各自用在地譯名 |
| 右下角顯示年份 | 年份 + **當年國家數量** + 可拖曳時間軸 + **播放速度控制** |
| 版權不明的配樂 | **合法授權、具歷史感的配樂**，檔案放在 repo 內 |

## 2. 不可違反的原則

1. **純靜態**：最終產物是 HTML/CSS/JS + 資料檔，能直接部署到 GitHub Pages，不需要伺服器。
2. **素材全部自帶（self-hosted）**：地圖資料、字型、音樂、程式庫都放進 repo（或建置時打包），執行時不從 CDN 或第三方 API 抓東西。唯一例外需在本檔明列並經同意。
3. **每項素材都要有授權紀錄**：寫進 `ATTRIBUTION.md`（來源 URL、授權、作者、修改內容）。不確定授權的素材一律不用。
4. **實際控制原則（de facto）**：現代邊界以「該年實際控制者」著色；有主權爭議的地區另以斜線／虛線標示「爭議區」，點擊可看說明。
   - **克里米亞**：2014 年 3 月起顯示為俄羅斯實際控制，加爭議標示。
   - 2022 年後俄軍占領的烏東地區、其他爭議區（克什米爾、西撒哈拉、北賽普勒斯、阿布哈茲／南奧塞提亞、納戈爾諾－卡拉巴赫 2023 年前後變化等）同樣依實際控制＋爭議標示處理。
   - **臺灣**：1949 年後依實際治理顯示為獨立著色的「中華民國（臺灣）」。
5. **中國史政權命名**：不使用「〇〇王朝／〇朝」把不同政權串成單一連續國家的標示法（例如影片中的「大明王朝」「宋王朝」）。每個政權視為**獨立國家**。主要的統一帝國採**對外正式稱呼**：秦帝國、漢帝國、大隋帝國、大唐帝國、大宋帝國、大遼帝國、大金帝國、大元帝國、大明帝國、大清帝國（英文 Great Ming Empire 等；2026-11-18 使用者指定，取代先前只用國號「大明」的做法）；其他政權以國號原文命名（燕、涼、大夏、大理…）。史稱（明朝、南明…）放在別名欄，同名並存時顯示於括號。與同時期其他政權（遼、西夏、金、大理、吐蕃等）平等呈現。同樣邏輯適用於其他地區。
6. **簡繁不是字形轉換**：zh-Hant（臺灣用語）與 zh-Hans（中國大陸用語）各自維護譯名，**禁止用 OpenCC 之類工具把簡體直接轉繁體**。例：紐西蘭／新西兰、義大利／意大利、沙烏地阿拉伯／沙特阿拉伯、寮國／老挝、衣索比亞／埃塞俄比亚、索馬利亞／索马里、肯亞／肯尼亚。

## 3. 可參考的開源專案與資料（已調查）

| 名稱 | 類型 | 授權 | 用途判斷 |
|---|---|---|---|
| **Seshat Cliopatria** (`Seshat-Global-History-Databank/cliopatria`) | 資料：約 1.4 萬筆政權多邊形，3400 BCE–2024 CE，每筆有 `FromYear/ToYear`、Wikidata ID | CC BY 4.0（待複核 LICENSE.md） | **首選主資料**。逐年區間可做出平滑的時間軸，Wikidata ID 可拿來抓多語名稱 |
| **A History of Nations** (42-apps.github.io) | 成品網站：globe.gl 3D 地球 + Cliopatria + 時間軸 + 國家計數 | 網站本身授權未明 | **功能最接近的參考**，可參考 UX，不直接複製程式碼 |
| **aourednik/historical-basemaps** | 資料：約 50 個年份快照的 GeoJSON | GPL-3.0 | 備案／交叉比對。只有快照年份、GPL 對網頁授權有連帶影響，次選 |
| **nrgapple/historic-country-borders-app** | 成品網站：historical-basemaps 的時間軸檢視器 | 見 repo | 參考時間軸 UI |
| **Natural Earth** | 現代國界、海岸線、地形底圖 | Public Domain | 2025–2026 現代邊界、底圖、陸地遮罩 |
| **Wikidata** | 多語國名 | CC0 | 建置時一次抓取，存成本地 i18n 檔 |
| **MapLibre GL JS v5+** | 地圖引擎，支援 globe 投影 | BSD-3 | 3D 地球候選 |
| **d3-geo / d3-geo-projection** | 投影運算 | ISC | 多種平面投影（Robinson、Equal Earth、Natural Earth、Winkel Tripel、Mollweide…） |
| **Musopen**（含 Wikimedia Commons 上的 Musopen 錄音） | 古典音樂錄音 | 多為 Public Domain（逐首確認） | 配樂來源首選 |

## 4. 技術架構（實作）

```
CountryHistory/
├─ CLAUDE.md / README.md / ATTRIBUTION.md / LICENSE
├─ .github/workflows/pages.yml   # push 到 main → 建置 → GitHub Pages
├─ data-pipeline/                # 建置用，不部署
│   ├─ build-all.sh              # 一鍵重建 public/data（需 Cliopatria 與 Natural Earth 原始檔）
│   ├─ build.py                  # Cliopatria → 2026 延伸、實際控制修正、命名、宗教、國家數
│   ├─ finalize.mjs              # 產生 polities.json / religions.json
│   ├─ build_region.mjs          # 中國／台灣模式：TSV → china.json / taiwan.json
│   ├─ overrides/                # 命名、宗教、補充小國等人工表（TSV）
│   ├─ china/  taiwan/           # 區域模式的單元圖與逐月控制表
│   ├─ make_satellite.py         # 使用者自備 NASA Blue Marble → public/basemap/
│   └─ names_review.tsv          # 待人工複核的譯名
├─ music/                        # 原創曲譜（Python）與合成器
├─ src/                          # Vite + 原生 JS
│   ├─ main.js  i18n.js  data.js  modes.js  projections.js
│   ├─ flat.js (d3-geo + Canvas)  globe.js (MapLibre globe)  labels.js  styles.js  audio.js
└─ public/data  public/audio
```

- 平面投影 d3-geo + Canvas；3D 地球 MapLibre GL JS globe。標籤用 Canvas 疊層＋系統字型，不需要 glyph／圖磚。
- 與提案的差異：不自帶網頁字型（用系統字型，以縮小體積）；配樂改為原創曲（見第 7 節）。
- 效能：平面地圖把投影後的幾何快取成 Path2D（參考比例取 2 的次方），縮放、垂直平移、圓柱投影的水平平移都只是 Canvas 矩陣轉換（GPU）；拖曳形狀會變的投影時暫用 1:110m 陸地。政權填色畫在離屏圖層再合成。3D 地球把整個時代分塊一次放進 GPU，換年份只改 filter。
- 過渡動畫（`src/transition.js`）：在粗網格上算出每格新舊擁有者，以帶雜訊成本的 Dijkstra 決定消退／生長時間（黏菌狀）；平面地圖在螢幕空間做遮罩合成，3D 地球在變動範圍的 Web 麥卡托網格上算，經 MapLibre canvas source 顯示。
- 國家數 = 聯合國會員國 + 梵蒂岡 + 科索沃 + 中華民國（2026 年為 196）；非國家實體與自稱國家照畫但不計入。
- 簡繁原則的唯一例外：Wikidata 缺簡體或繁體譯名時，以 OpenCC 逐字轉換暫代，並標記在 `names_review.tsv` 等待人工複核。

## 5. 程式與協作慣例

- 語言：程式註解與 commit 用英文；文件與 UI 說明用繁體中文為主。
- 所有人工修正（改名、爭議區、2025–2026 變化）放 `data-pipeline/overrides/`，**每筆附出處**，不直接改原始資料。
- 新增素材 → 同一個 commit 更新 `ATTRIBUTION.md`。
- 部署：GitHub Actions（`actions/deploy-pages`），Settings → Pages → Source 選 GitHub Actions；repo 單檔 < 100 MB。

## 6. 待決事項（請討論）

已決定：
- ~~Q1~~ 命名用國號原文（大明、大清）。
- ~~Q2~~ 語言：繁中（臺灣）、簡中、英文、日文。
- ~~Q3~~ 3D 地球用 MapLibre globe；平面投影用 d3。
- ~~Q6~~ 配樂用 Musopen 公有領域錄音，逐首確認授權並記錄。

- ~~Q4~~ 起始年：有更早的資料就更早（目前下限 3400 BCE，見時間軸說明）。
- ~~Q5~~ 底圖風格可切換：①簡潔向量（Natural Earth 陸地／海洋）②地形暈渲（Natural Earth Shaded Relief，PD）③衛星影像（NASA Blue Marble，PD）。全部自帶檔案。
- ~~Q7~~ 爭議區提供「觀點」切換開關：預設「實際控制」，可切到 Natural Earth 提供的各國官方觀點（Point-of-View）版本，例如中華民國（臺灣）、中華人民共和國、烏克蘭、俄羅斯、印度、巴基斯坦等。觀點只影響有爭議的現代邊界，不改動古代資料。
- 臺灣、克里米亞、克什米爾等處理方式維持第 2 節原則 4。

## 7. 後續新增功能（已實作）

- **投影分類**：23 種投影，可依「性質（等積／等距／等角／折衷）」「光源（心射／平射／正射）」「投影面（圓柱／圓錐／方位）」分組。
- **顏色深淺**：國家色塊不透明度可調。
- **中國模式（1911-09～1951-12，省級、按月）**：各省實際控制者（北洋、各派軍閥、國民政府、汪政權、滿洲國、日軍、中共等），斜紋表示部分控制；★ 為政府所在地，自稱中華民國政府者特別標示，計數顯示「自稱中華民國的政府數」；中共根據地以示意橢圓表示。
- **宗教模式（大宗派細分）**：依各政權官方或主要宗教著色，不代表人口組成。表格：`overrides/religion*.tsv`。
- **台灣模式（1600～2026，按月）**：兩個可切換圖層——①統治範圍（原住民族、大肚王國、荷蘭、西班牙、鄭氏、清、法、臺灣民主國、日本、中華民國）②歷代行政區劃（荷蘭集會區→鄭氏承天府→清代府縣廳→日治縣廳州→戰後縣市與直轄市）。單元為今日縣市切成平原與山區的近似範圍。
- **配樂**：Musopen 在建置環境無法連線，改為原創曲（CC0），以 FluidR3_GM 音色（CC BY 3.0）合成。
- **衛星底圖**：NASA Earth Observatory Blue Marble: Next Generation（2004-07）經 `make_satellite.py` 轉成 `public/basemap/`（約 19 MB），**已納入 repo** 並部署到 GitHub Pages：全球 5400×2700（層級 0–5），另有東亞（D1 分幅裁切，層級 6–7）與台灣（層級 8–9）高解析度圖層。選用時畫面左下角顯示「NASA Earth Observatory」標註。換圖步驟見 README。
- **2026-11-18 第二批（使用者 11 項需求）**：宗教模式標籤切換（宗教／國名／兩者）；「小國也標名」最小字體鎖定；投影選單改為自訂清單，滑鼠停留顯示用途、優缺點、設計方式（`data-pipeline/projinfo.tsv`），常用投影加 ★；黏菌式過渡動畫；時間軸「重要事件」開關（原 `src/worldEvents.js`，現為 `data-pipeline/events_world.tsv`，中國／台灣模式用各自的大事記）；移除「如原影片」字樣；國家說明擴充（存續年數、當年面積、最大疆域、前身／後繼、維基百科連結、出處；面積與前後繼由 `build.py` 計算），中國／台灣勢力說明（`*/info.tsv`）；台灣高解析衛星圖；放大後改用 1:10m 河流與湖泊；「現代國界」疊加開關；3D 地球上方方位（北／東／南／西，右鍵拖曳自由旋轉）；效能改寫（見第 4 節）。
- **2026-11-18 第三批**：國名在過渡動畫中不再淡入淡出；過渡時間縮短（逐年約 0.2–0.45 秒、跳轉 0.75 秒）；現代國界線改細；音樂增為 7 首（新增帝國行進、吟遊、沙漠商隊、大航海、黎明），可在時間軸右側選曲；3D 地球改用 feature-state 切換年份與顏色，不再閃白；中國模式移除說明段落，自稱中華民國政府的控制範圍以金色外框標示，圖例中的政府可點選查看說明與維基百科連結；「蒙古人民政府／蒙古人民共和國」改為「蒙古人民共和國」；台灣行政區劃圖層中，日治時期的蕃地與戰後的山地鄉不再列為獨立行政區，山區單元歸入其主要所屬的縣／廳／州。
- **2026-11-19 第四批**：
  - **資料查核**：Cliopatria 與現代國家改以 Wikidata QID 優先配對（修正 1971 年以色列被併入埃及）；`build.py` 自動補洞（1500 年後兩年內的閃爍、1946 年後延續前一年）；新增 `qa.py` 與 `qa_report.md`，以及有出處的修正表 `overrides/geometry.tsv`、`holes.tsv`。流程見 `docs/查核方案.md`。
  - **具體修正**：中華民國在台灣屬實際控制，不列爭議區；海南島 1950 年歸中華人民共和國（海南 1988 年建省，超出中國模式範圍）；1864–1876 新疆（東干起事、哲德沙爾）；日本 540–700 年稱「大和」、701 年起稱「日本」，不用「倭」（名稱一律用該政權的對外自稱）。
  - **台灣行政區**：改由內政部鄉鎮界（taiwan-atlas）組成 42 個單元，`admin.tsv` 依實際沿革逐期變動，同色單元合併繪製（`merge`）；山區以 `=parent` 跟隨所屬縣廳。
  - **中國模式**：熱河、興安切分留下的兩塊空白已補。
  - **宗教模式**：標籤選項移到「顯示」選單；宗教可點選看介紹（`overrides/religion_info.tsv`）。
  - **投影選單**：選擇後不關閉；擬圓柱、圓錐投影可全方位旋轉；六角比較圖（`data-pipeline/projmetrics.mjs`，Tissot 取樣）。
  - **重要事件**：時間軸上的事件可點選看說明（`data-pipeline/events_world.tsv`）。
  - **事件系統骨架（未開啟，`?events`）**：`data-pipeline/events/`、`src/eventlayer.js`、`docs/事件系統.md`。
- **2026-11-19 第五批**：
  - 音樂跟隨播放暫停、單曲重複；可自由旋轉投影加鎖定按鈕（鎖定時依標準方式移動，重新鎖定轉正、保留經度）；等距圓柱等圓柱投影亦可解鎖旋轉。
  - **1946 年後現代國家優先**（`build.py` 2e）：舊帝國在獨立後仍蓋在新國家上的形狀（法國蓋阿爾及利亞、英國蓋阿曼）一律移除；`overrides/qid.tsv` 修正 Cliopatria 的錯誤 QID（南韓、南越）。`qa.py` 列出重疊的政權組合。
  - 區域模式的世界底層（灰色 context）：去掉落在區域上的碎片，並裁到陸地內。台灣「統治範圍／行政區劃」改為可同時勾選。
  - **日本模式**（`data-pipeline/japan/`：units.py、gen.py 產生 divisions／admin／region.json；control.tsv 等手寫）與 **俄羅斯模式**（`data-pipeline/russia/`，同樣結構）。新增的區域模式：在 `src/modes.js` 的 UNIT_FILES、LAYERED，`src/main.js` 的 MODES、REGION_VIEW、REGION_TICKS、REGION_RUN，及 i18n 的 modes 加上名稱。
- **語言欄位順序**：網站資料的多語陣列一律是 `LANGS.col` 順序 `[en, zh-Hant, zh-Hans, ja]`；`worldEvents.gen.js` 例外（`[zh-Hant, zh-Hans, en, ja]`，由 `main.js` 轉換）。
- **國家說明不連外**：使用者選擇只用離線資料＋連結，不在執行時抓維基百科摘要。維基百科連結有 Wikidata ID 時經 `Special:GoToLinkedPage`，否則用標題搜尋。

### 已知限制
- 2022 年後俄軍占領的烏克蘭南部未畫出（只有 2014 年 DPR／LPR 範圍）；約旦河西岸／加薩未單獨繪出。
- 約 450 筆譯名待複核（`data-pipeline/names_review.tsv`）。
