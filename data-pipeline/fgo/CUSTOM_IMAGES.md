# 英靈模式：自訂圖片

對照表另有試算表版本：`data-pipeline/fgo/servant-ids.csv`（可用 Excel 開啟）。

在英靈模式（選單中的「英靈列傳」）中，可以為英靈加上自訂圖片。進入方式：打開「事件時間軸」，在篩選框輸入 `fgo` 或「英靈」後按 Enter。地圖上的頭像會變成「現實原型肖像｜自訂圖片」左右並列，點開的說明卡也會並排顯示兩張圖。顯示選單「標記 → 本模式」裡的「自訂圖片（與原型並列）」可以隨時關掉；資料夾裡沒有任何圖片時，這個開關不會出現。

## 放置位置

```
public/fgo/custom/
```

## 檔名

- 檔名是英靈的 id 加副檔名，例如 `artoria.webp`、`iskandar.png`、`gilgamesh.jpg`。
- 副檔名可用 `.webp`、`.png`、`.jpg`、`.jpeg`（大小寫皆可）。每個 id 只放一張。
- 同一原型的兩位英靈（伊莉莎白・巴托里／卡蜜拉、亞歷山大／伊斯坎達爾）在地圖上是同一個點，但各有自己的 id，可以各放一張；兩張都放時，頭像會是「原型｜自訂圖一｜自訂圖二」三張並列，說明卡也各自標上名字。
- 檔名對不到任何 id 時，執行 `node data-pipeline/fgo/build.mjs` 會列出來提醒。

## 圖片規格

- 正方形最好，建議 400×400 像素（至少 256×256）。不是正方形時會從中間裁成正方形。
- 地圖上的頭像顯示約 54–120 像素，說明卡約 150 像素，400 像素在高解析螢幕上也夠清楚。
- 建議用 WebP（品質 80 左右），每張 30–80 KB；PNG、JPG 也可以，但檔案較大，會拖慢載入。
- 人物臉部盡量放在畫面中央偏上。

## 圖片說明（選填）

在同一個資料夾放 `credits.tsv`，每行「id<Tab>說明文字」，說明會顯示在說明卡的圖片下方：

```
artoria	繪者：○○○
gilgamesh	來源：○○○
```

## 放好之後

不需要任何額外步驟：資料夾裡有圖片就會顯示。網站會自動列出資料夾裡的圖片（`npm run dev` 時即時讀取，`npx vite build` 時寫進輸出），新增、刪除、改名後重新整理網頁即可。

只有在想檢查檔名有沒有對到英靈 id 時，可以執行 `node data-pipeline/fgo/build.mjs`，對不到的檔名會列出來。

## 不會推到公開網站

`public/fgo/custom/` 裡的圖片與 `credits.tsv` 已列在 `.gitignore`，不會被 commit；公開網站（GitHub Pages）是從儲存庫建置的，那裡的資料夾是空的，所以公開網站不會出現自訂圖片，「自訂圖片」開關也不會出現。（資料夾裡的 `.gitkeep` 只是讓 git 保留這個空資料夾。）

網站顯示自訂圖片時，說明卡會標示「自訂圖片由網站維護者另行放入，不屬於自由授權圖片，權利屬於各權利人」。

## 英靈 → 名稱 → id 對照表（133 位英靈，依職階、年代排列）

「id」就是圖片檔名（不含副檔名）。

| 職階 | 英靈（繁中） | English | 日本語 | id | 備註 |
|---|---|---|---|---|---|
| 弓兵（Archer） | 吉爾伽美什 | Gilgamesh | ギルガメッシュ | `gilgamesh` | |
| 弓兵（Archer） | 阿塔蘭塔 | Atalante | アタランテ | `atalanta` | |
| 弓兵（Archer） | 凱隆 | Chiron | ケイローン | `chiron` | |
| 弓兵（Archer） | 帕里斯 | Paris | パリス | `paris` | |
| 弓兵（Archer） | 大衛 | David | ダビデ | `david` | |
| 弓兵（Archer） | 阿拉什 | Arash | アーラシュ | `arash` | |
| 弓兵（Archer） | 阿周那 | Arjuna | アルジュナ | `arjuna` | |
| 弓兵（Archer） | 馬嘶 | Ashwatthama | アシュヴァッターマン | `ashwatthama` | |
| 弓兵（Archer） | 芝諾比婭 | Zenobia | ゼノビア | `zenobia` | |
| 弓兵（Archer） | 崔斯坦 | Tristan | トリスタン | `tristan` | |
| 弓兵（Archer） | 俵藤太 | Tawara Touta | 俵藤太 | `tawara` | |
| 弓兵（Archer） | 巴御前 | Tomoe Gozen | 巴御前 | `tomoe` | |
| 弓兵（Archer） | 羅賓漢 | Robin Hood | ロビンフッド | `robinhood` | |
| 弓兵（Archer） | 織田信長 | Oda Nobunaga | 織田信長 | `nobunaga` | |
| 弓兵（Archer） | 拿破崙 | Napoleon | ナポレオン | `napoleon` | |
| 弓兵（Archer） | 尼古拉・特斯拉 | Nikola Tesla | ニコラ・テスラ | `tesla` | |
| 弓兵（Archer） | 比利小子 | Billy the Kid | ビリー・ザ・キッド | `billy` | |
| 暗殺者（Assassin） | 塞彌拉彌斯 | Semiramis | セミラミス | `semiramis` | |
| 暗殺者（Assassin） | 荊軻 | Jing Ke | 荊軻 | `jingke` | |
| 暗殺者（Assassin） | 克麗奧佩脫拉 | Cleopatra | クレオパトラ | `cleopatra` | |
| 暗殺者（Assassin） | 武則天 | Wu Zetian | 武則天 | `wuzetian` | |
| 暗殺者（Assassin） | 哈桑・薩巴赫 | Hassan-i Sabbah | ハサン・サッバーハ | `hassan` | |
| 暗殺者（Assassin） | 燕青 | Yan Qing | 燕青 | `yanqing` | |
| 暗殺者（Assassin） | 加藤段藏 | Katou Danzo | 加藤段蔵 | `katodanzo` | |
| 暗殺者（Assassin） | 風魔小太郎 | Fuuma Kotarou | 風魔小太郎 | `fuuma` | |
| 暗殺者（Assassin） | 佐佐木小次郎 | Sasaki Kojirou | 佐々木小次郎 | `sasaki` | |
| 暗殺者（Assassin） | 夏爾-亨利・桑松 | Charles-Henri Sanson | シャルル＝アンリ・サンソン | `sanson` | |
| 暗殺者（Assassin） | 岡田以藏 | Okada Izou | 岡田以蔵 | `okada` | |
| 暗殺者（Assassin） | 瑪塔・哈里 | Mata Hari | マタ・ハリ | `matahari` | |
| 暗殺者（Assassin） | 開膛手傑克 | Jack the Ripper | ジャック・ザ・リッパー | `jack` | |
| 狂戰士（Berserker） | 阿斯忒里俄斯 | Asterios | アステリオス | `asterios` | |
| 狂戰士（Berserker） | 海克力斯 | Heracles | ヘラクレス | `heracles` | |
| 狂戰士（Berserker） | 彭忒西勒亞 | Penthesilea | ペンテシレイア | `penthesilea` | |
| 狂戰士（Berserker） | 大流士三世 | Darius III | ダレイオス三世 | `darius` | |
| 狂戰士（Berserker） | 項羽 | Xiang Yu | 項羽 | `xiangyu` | |
| 狂戰士（Berserker） | 斯巴達克斯 | Spartacus | スパルタクス | `spartacus` | |
| 狂戰士（Berserker） | 卡利古拉 | Caligula | カリギュラ | `caligula` | |
| 狂戰士（Berserker） | 呂布奉先 | Lu Bu | 呂布奉先 | `lubu` | |
| 狂戰士（Berserker） | 蘭斯洛特 | Lancelot | ランスロット | `lancelot` | |
| 狂戰士（Berserker） | 貝奧武夫 | Beowulf | ベオウルフ | `beowulf` | |
| 狂戰士（Berserker） | 血斧埃里克 | Eric Bloodaxe | 血斧王エイリーク | `eric` | |
| 狂戰士（Berserker） | 清姬 | Kiyohime | 清姫 | `kiyohime` | |
| 狂戰士（Berserker） | 源賴光 | Minamoto no Raikou | 源頼光 | `raikou` | |
| 狂戰士（Berserker） | 坂田金時 | Sakata Kintoki | 坂田金時 | `kintoki` | |
| 狂戰士（Berserker） | 茶茶 | Chacha | 茶々 | `chacha` | |
| 狂戰士（Berserker） | 弗蘿倫絲・南丁格爾 | Florence Nightingale | ナイチンゲール | `nightingale` | |
| 狂戰士（Berserker） | 土方歲三 | Hijikata Toshizou | 土方歳三 | `hijikata` | |
| 狂戰士（Berserker） | 保羅・班揚 | Paul Bunyan | ポール・バニヤン | `bunyan` | |
| 術士（Caster） | 尼托克莉絲 | Nitocris | ニトクリス | `nitocris` | |
| 術士（Caster） | 美狄亞 | Medea | メディア | `medea` | |
| 術士（Caster） | 喀耳刻 | Circe | キルケー | `circe` | |
| 術士（Caster） | 所羅門 | Solomon | ソロモン | `solomon` | |
| 術士（Caster） | 諸葛孔明 | Zhuge Liang | 諸葛孔明 | `zhuge` | |
| 術士（Caster） | 玄奘三藏 | Xuanzang | 玄奘三蔵 | `xuanzang` | |
| 術士（Caster） | 山魯佐德 | Scheherazade | シェヘラザード | `scheherazade` | |
| 術士（Caster） | 阿維斯布朗 | Avicebron | アヴィケブロン | `avicebron` | |
| 術士（Caster） | 玉藻前 | Tamamo no Mae | 玉藻の前 | `tamamo` | |
| 術士（Caster） | 吉爾・德・雷 | Gilles de Rais | ジル・ド・レェ | `gilles` | |
| 術士（Caster） | 李奧納多・達文西 | Leonardo da Vinci | レオナルド・ダ・ヴィンチ | `davinci` | |
| 術士（Caster） | 梅菲斯特 | Mephistopheles | メフィストフェレス | `mephisto` | |
| 術士（Caster） | 帕拉塞爾蘇斯 | Paracelsus | パラケルスス | `paracelsus` | |
| 術士（Caster） | 威廉・莎士比亞 | William Shakespeare | ウィリアム・シェイクスピア | `shakespeare` | |
| 術士（Caster） | 沃夫岡・阿瑪迪斯・莫札特 | Wolfgang Amadeus Mozart | ヴォルフガング・アマデウス・モーツァルト | `mozart` | |
| 術士（Caster） | 查爾斯・巴貝奇 | Charles Babbage | チャールズ・バベッジ | `babbage` | |
| 術士（Caster） | 漢斯・克里斯汀・安徒生 | Hans Christian Andersen | ハンス・クリスチャン・アンデルセン | `andersen` | |
| 術士（Caster） | 海倫娜・布拉瓦茨基 | Helena Blavatsky | エレナ・ブラヴァツキー | `blavatsky` | |
| 術士（Caster） | 湯瑪斯・愛迪生 | Thomas Edison | トーマス・エジソン | `edison` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 安哥拉・曼紐（Avenger） | Angra Mainyu (Avenger) | アンリマユ | `angra` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 始皇帝（Ruler） | Qin Shi Huang (Ruler) | 始皇帝 | `qinshihuang` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 卑彌呼（Ruler） | Himiko (Ruler) | 卑弥呼 | `himiko` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 楊貴妃（Foreigner） | Yang Guifei (Foreigner) | 楊貴妃 | `yangguifei` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 蘆屋道滿（Alter Ego） | Ashiya Doman (Alter Ego) | 蘆屋道満 | `doman` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 平景清（Avenger） | Taira no Kagekiyo (Avenger) | 平景清 | `kagekiyo` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 貞德（Ruler） | Jeanne d'Arc (Ruler) | ジャンヌ・ダルク | `jeanne` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 天草四郎時貞（Ruler） | Amakusa Shirou Tokisada (Ruler) | 天草四郎時貞 | `amakusa` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 阿比蓋爾・威廉斯（Foreigner） | Abigail Williams (Foreigner) | アビゲイル・ウィリアムズ | `abigail` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 安東尼奧・薩列里（Avenger） | Antonio Salieri (Avenger) | アントニオ・サリエリ | `salieri` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 葛飾北齋（Foreigner） | Katsushika Hokusai (Foreigner) | 葛飾北斎 | `hokusai` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 梵谷（Foreigner） | Van Gogh (Foreigner) | ゴッホ | `vangogh` | |
| 特殊職階（Ruler、Avenger、Foreigner 等） | 狼王羅伯（Avenger） | Hessian Lobo (Avenger) | ヘシアン・ロボ | `lobo` | |
| 槍兵（Lancer） | 恩奇都 | Enkidu | エルキドゥ | `enkidu` | |
| 槍兵（Lancer） | 凱妮斯 | Caenis | カイニス | `caenis` | |
| 槍兵（Lancer） | 赫克托爾 | Hektor | ヘクトール | `hektor` | |
| 槍兵（Lancer） | 迦爾納 | Karna | カルナ | `karna` | |
| 槍兵（Lancer） | 羅穆盧斯 | Romulus | ロムルス | `romulus` | |
| 槍兵（Lancer） | 列奧尼達一世 | Leonidas I | レオニダス一世 | `leonidas` | |
| 槍兵（Lancer） | 庫・丘林 | Cu Chulainn | クー・フーリン | `cuchulainn` | |
| 槍兵（Lancer） | 斯卡哈 | Scathach | スカサハ | `scathach` | |
| 槍兵（Lancer） | 芬恩・麥克庫爾 | Fionn mac Cumhaill | フィン・マックール | `fionn` | |
| 槍兵（Lancer） | 迪盧木多・奧迪那 | Diarmuid Ua Duibhne | ディルムッド・オディナ | `diarmuid` | |
| 槍兵（Lancer） | 布倫希爾德 | Brynhildr | ブリュンヒルデ | `brynhild` | |
| 槍兵（Lancer） | 布拉達曼特 | Bradamante | ブラダマンテ | `bradamante` | |
| 槍兵（Lancer） | 武藏坊弁慶 | Musashibou Benkei | 武蔵坊弁慶 | `benkei` | |
| 槍兵（Lancer） | 弗拉德三世 | Vlad III | ヴラド三世 | `vlad` | |
| 槍兵（Lancer） | 伊莉莎白・巴托里 | Elisabeth Báthory | エリザベート・バートリー | `elisabeth` | 與 卡蜜拉 同一原型，地圖上同一個點 |
| 暗殺者（Assassin） | 卡蜜拉 | Carmilla | カーミラ | `carmilla` | 與 伊莉莎白・巴托里 同一原型，地圖上同一個點 |
| 槍兵（Lancer） | 秦良玉 | Qin Liangyu | 秦良玉 | `qinliangyu` | |
| 槍兵（Lancer） | 李書文 | Li Shuwen | 李書文 | `lishuwen` | |
| 騎兵（Rider） | 奧茲曼迪亞斯 | Ozymandias | オジマンディアス | `ozymandias` | |
| 騎兵（Rider） | 美杜莎 | Medusa | メドゥーサ | `medusa` | |
| 騎兵（Rider） | 阿基里斯 | Achilles | アキレウス | `achilles` | |
| 騎兵（Rider） | 亞歷山大 | Alexander | アレキサンダー | `alexander` | 與 伊斯坎達爾（征服王） 同一原型，地圖上同一個點 |
| 騎兵（Rider） | 伊斯坎達爾（征服王） | Iskandar | イスカンダル | `iskandar` | 與 亞歷山大 同一原型，地圖上同一個點 |
| 騎兵（Rider） | 瑪爾大 | Saint Martha | マルタ | `martha` | |
| 騎兵（Rider） | 布狄卡 | Boudica | ブーディカ | `boudica` | |
| 騎兵（Rider） | 聖喬治 | Saint George | ゲオルギウス | `george` | |
| 騎兵（Rider） | 阿斯托爾福 | Astolfo | アストルフォ | `astolfo` | |
| 騎兵（Rider） | 克察爾科亞特爾 | Quetzalcoatl | ケツァルコアトル | `quetzalcoatl` | |
| 騎兵（Rider） | 牛若丸 | Ushiwakamaru | 牛若丸 | `ushiwaka` | |
| 騎兵（Rider） | 伊凡雷帝 | Ivan the Terrible | イヴァン雷帝 | `ivan` | |
| 騎兵（Rider） | 法蘭西斯・德瑞克 | Francis Drake | フランシス・ドレイク | `drake` | |
| 騎兵（Rider） | 愛德華・蒂奇 | Edward Teach | エドワード・ティーチ | `teach` | |
| 騎兵（Rider） | 安妮・伯妮與瑪麗・里德 | Anne Bonny & Mary Read | アン・ボニー＆メアリー・リード | `annemary` | |
| 騎兵（Rider） | 瑪麗・安托瓦內特 | Marie Antoinette | マリー・アントワネット | `marie` | |
| 騎兵（Rider） | 坂本龍馬 | Sakamoto Ryouma | 坂本龍馬 | `ryoma` | |
| 劍兵（Saber） | 羅摩 | Rama | ラーマ | `rama` | |
| 劍兵（Saber） | 蓋烏斯・尤利烏斯・凱撒 | Gaius Julius Caesar | ガイウス・ユリウス・カエサル | `caesar` | |
| 劍兵（Saber） | 弗格斯・馬克・羅伊 | Fergus mac Róich | フェルグス・マック・ロイ | `fergus` | |
| 劍兵（Saber） | 尼祿・克勞狄烏斯 | Nero Claudius | ネロ・クラウディウス | `nero` | |
| 劍兵（Saber） | 齊格飛 | Siegfried | ジークフリート | `siegfried` | |
| 劍兵（Saber） | 西格德 | Sigurd | シグルド | `sigurd` | |
| 劍兵（Saber） | 阿提拉 | Altera (Attila) | アルテラ | `attila` | |
| 劍兵（Saber） | 阿爾托莉亞・潘德拉剛 | Artoria Pendragon | アルトリア・ペンドラゴン | `artoria` | |
| 劍兵（Saber） | 莫德雷德 | Mordred | モードレッド | `mordred` | |
| 劍兵（Saber） | 高文 | Gawain | ガウェイン | `gawain` | |
| 劍兵（Saber） | 貝德維爾 | Bedivere | ベディヴィエール | `bedivere` | |
| 劍兵（Saber） | 蘭陵王 | Prince of Lan Ling | 蘭陵王 | `lanling` | |
| 劍兵（Saber） | 查理曼 | Charlemagne | シャルルマーニュ | `charlemagne` | |
| 劍兵（Saber） | 鈴鹿御前 | Suzuka Gozen | 鈴鹿御前 | `suzuka` | |
| 劍兵（Saber） | 柳生但馬守宗矩 | Yagyu Munenori | 柳生但馬守宗矩 | `munenori` | |
| 劍兵（Saber） | 宮本武藏 | Miyamoto Musashi | 宮本武蔵 | `musashi` | |
| 劍兵（Saber） | 謝瓦利埃・德・艾昂 | Chevalier d'Eon | シュヴァリエ・デオン | `deon` | |
| 劍兵（Saber） | 沖田總司 | Okita Souji | 沖田総司 | `okita` | |
