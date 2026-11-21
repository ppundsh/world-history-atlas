# How the World's Countries Changed · 世界國家演變

**English** · [繁體中文](README.md)

A static web page that animates the world's political map from 3400 BCE to 2026. It runs on GitHub Pages and loads nothing from outside its own folder: no map tiles, fonts or CDNs.

## Features

- **Modes**
  - **World**: historical polities, with a count of sovereign states for each year (196 in 2026).
  - **Religion**: each polity coloured by its official or dominant religion, with major branches subdivided (Sunni, Shia, Ibadi, Theravada, Mahayana and others). Labels can show the religion, the country, or both (religion first).
  - **China 1911–1951**: province by province and month by month. Covers warlords, the rival governments that each claimed to be the ROC, and Communist base areas.
  - **Taiwan 1600–2026**: month by month, with two layers you can switch between:
    - who controlled each area (indigenous peoples, VOC, Spain, the Zheng regime, Qing, Japan, ROC);
    - the administrative divisions of each era.
  - **Japan 701–2026**: month by month, control and administrative layers (both can be on at once), plus an optional **overseas territories** layer (Taiwan, Korea, Karafuto, Kwantung, the South Seas, Manchukuo). Control covers the Emishi and Hayato frontiers, the Northern Fujiwara, the two courts, the main Sengoku daimyō (1560–1590, by province, approximate), the shogunates, Ryūkyū, Ezochi, the Boshin War, the Empire, the occupation and US rule of Okinawa, and the Kurils. Divisions: the provinces (with their changes from 701), the prefectures of 1871–1888 and today's prefectures, built from today's municipalities.
  - **Russia 862–2026**: month by month, control and administrative layers, from Rurik and Kievan Rus' through the Horde, Muscovy, the Tsardom, the Empire, the Civil War and the Soviet Union to the Russian Federation, including the Baltic, the Caucasus, Central Asia, Alaska, the Eastern Front (by region, approximate) and the areas held after 2014 and 2022. Divisions: Peter I's governorates (1708), the governorates of 1914, the Soviet republics and today's federal subjects.
- **Map**
  - 23 projections, grouped by property, light source or projection surface. Common ones are marked ★; hovering over a menu item shows what the projection is for, its strengths and weaknesses, and how it is constructed.
  - "Up" can be north, east, south or west, on the 3D globe and on flat projections such as equirectangular and Mollweide; flat maps turn together with their projection, so only the viewing angle changes (not offered for latitude-limited projections such as Mercator). On the globe, right-drag rotates and tilts freely.
  - On phones the map fills the screen, the timeline takes two rows, the info panel is a bottom sheet, and the menus and music fold into the top menu.
  - Navigation works like Google Maps: drag, wheel, pinch, double-click and keyboard.
- **Regional modes**: capitals and seats of government (★) and administrative seats (◆) are clickable, with their dates, notes and Wikipedia sources; "↩ World" goes back to the world map at the same year. With both layers on, divisions are the fill and control is a coloured ribbon along the inside of its border, as on printed historical maps. Taiwan adds **feuds** (⚔) and **local powers** (◉: the five great families, post-war county factions) switches. Switching modes moves the map to that region. Re-locking a freely turned map keeps its current look and only restores the standard movement; "North up" returns to the normal aspect.
- **More modes**: **Regime types** (V-Dem Regimes of the World from 1900, worked out for 1789–1899, inferred from names before that; gold stripes for monarchs), **Art history** (81 movements, schools and centres from ancient Egypt to today, with thumbnails of representative works on the map; the info panel lists each work's artist, date, collection with a link to the museum, Wikipedia and Wikidata, and each picture's Commons author and licence), **Development of languages** (language areas and migration arrows, with a focus on Taiwan: the Austronesian dispersal out of Taiwan, every Formosan language, the formation and branches of Min, Hokkien and Hakka settlement of Taiwan, and later language policy), **History of finance** (financial centres, currency zones, flows of silver and capital, the spread of crises, and 44 dated and placed events), **Korea (1–2026)**, **Vietnam (1–2026)**, **Germany (1648–2026)**, **Poland (966–2026)**, **Italy (1454–2026)**, **Spain (711–2026)** and **India (321 BCE–2026)**.
- **Base maps**: plain, physical, antique, and satellite (NASA Blue Marble, with sharper layers for East Asia and Taiwan).
- **Transitions**: when borders change, the new territory spreads from the old one like a slime mould; when you jump to another period, the old map withers first and the new one grows back. Works on flat maps and the globe.
- **"Show" menu**: names, **keep names on screen** (a country only partly in view is named in its visible part), borders, rivers (1:10m when zoomed in, plus OpenStreetMap rivers for Taiwan), graticule, **modern borders** (dashed, over the historical map), **label small states** (minimum font size lock), **distortion mask** (shades where the projection distorts: area for conformal maps, shape for equal-area maps, distance for the rest; errors under about 12% are left clear, strength set per projection), **floating Taiwan** (an idea from Mindi's *Small Island, Big Area* map, credited in About; drag Taiwan's main island anywhere at true size: inside one country it shows how many Taiwans fit, across a border it shows distances between Taiwan's main cities), **detailed terrain** (hillshade for Taiwan and Japan on the physical base map; off by default, and each of those modes loads only its own tiles), transitions, and **key events** (the world wars and others, marked on the timeline and shown under the year while playing).
- **Info panel**: click a country for its years, area this year, largest extent, predecessors and successors (click to jump), a Wikipedia link and its sources. In the China and Taiwan modes, click a unit for notes on the faction and a Wikipedia link.
- **Performance**: geometry is projected once and cached as Path2D, so zooming and panning are GPU transforms; the globe keeps a whole era on the GPU and changes year with a filter.
- **Disputed areas**: drawn as hatching, with an 11-option point-of-view switch based on the Natural Earth POV files.
- **De facto control**: Crimea is shown as Russian from 2014.
- **Languages**: 繁體中文（臺灣）, 简体中文, English and 日本語. Country names are translated separately for each language, not converted character by character.
- **Playback**: a draggable timeline, speed control (¼× to 8×), and seven original background pieces (CC0) you can pick from next to the timeline.
- **Screenshots and recording**: 📷 saves a PNG; ⏺ records video together with the music (MP4 or WebM); both carry the title, mode and year.
- **Hold the map on a country**: select a country and press "📌 Hold the map on this": the projection centres on it, its extent is fitted to the screen and follows it through the years, and dragging and zooming pause until you release it.
- **Capitals switch** in the top bar.
- **Event timeline** switch: a list of events; click one to jump there. Event panels show the Wikipedia introduction and picture in the current language, and while playing each event's picture appears above the year, then fades (the next one replaces it). Only freely licensed Commons pictures are used, with author and licence.
- **Art history** also has 15 architecture styles (⌂) with representative buildings and 18 cultural figures (❖) with portraits and major works; thumbnail size is adjustable.
- **Event places** switch: passing an event on the timeline marks where it happened with a pulsing dot, its name and a picture, then fades. Places come from the event lists (every Taiwan event and about 150 newly added events that each regional mode cares about: uprisings, famines, disasters, massacres) or from Wikipedia/Wikidata. Taiwan's feuds are marked too when their switch is on.
- The projection menu shows a small vector drawing of each projection; recordings can include the music or not.

## Viewing it locally

**Windows:** double-click `本地預覽.bat` ("local preview"). It opens your browser for you.

- If Node.js is installed, it runs `npm install` the first time, then starts the dev server at http://localhost:5173/. Pages reload automatically when you edit files.
- Otherwise, if Python is installed, it serves the pre-built `dist/` folder at http://localhost:8000/.

Opening `index.html` directly does not work, because browsers block the page from loading its data files from `file://`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # output in dist/
npm run preview    # serve dist/
```

The URL hash stores the current state, so a view can be shared as a link:
`#m=taiwan&t=3540&L=admin&p=globe&l=en`

## Deploying to GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages → Source** and choose **GitHub Actions**.

The workflow in `.github/workflows/pages.yml` builds and publishes the site on every push to `main`. `vite.config.js` uses `base: './'`, so the site works under any repository name.

## Rebuilding the data (optional)

`public/data/` is already built. You only need this step if you change the source data or the override tables.

Download:

- Seshat Cliopatria v0.21 (`cliopatria_polities_only_v021.geojson`)
- natural-earth-vector (the `geojson/` folder)

Then run:

```bash
pip install shapely numpy
CLIO=path/to/cliopatria_polities_only_v021.geojson NE=path/to/natural-earth-vector/geojson npm run data
```

Hand-maintained tables:

| Path | Contents |
|---|---|
| `data-pipeline/overrides/names.tsv` | 國號 and corrections to names in the four languages |
| `data-pipeline/overrides/religion*.tsv` | religion of each polity, and the colours used for each religion |
| `data-pipeline/china/*.tsv` | China mode: factions, monthly control, governments, events |
| `data-pipeline/taiwan/*.tsv` | Taiwan mode: control, administrative divisions, seats of government, events |
| `data-pipeline/projinfo.tsv` | projection notes (purpose, strengths, weaknesses, construction); run `node data-pipeline/build_projinfo.mjs` after editing |
| `data-pipeline/china/info.tsv`, `taiwan/info.tsv` | faction notes and Wikipedia articles |
| `data-pipeline/names_review.tsv` | about 450 names that need checking (taken from Wikidata or converted automatically) |

## Satellite base map

The satellite base map is included (`public/basemap/`, about 19 MB). It is committed to the repository, so it also works on GitHub Pages.

- **Source**: NASA Earth Observatory, "Blue Marble: Next Generation w/ Topography and Bathymetry", July 2004, by Reto Stöckli.
- **License**: NASA imagery is in the public domain. NASA asks users to credit "NASA Earth Observatory". The site shows this credit in the bottom-left corner whenever the satellite base map is selected, and in the About box.
- **Layers**:

| Layer | Source | Resolution | Files |
|---|---|---|---|
| World | the 5400×2700 global image | about 8 km per pixel | `bluemarble.jpg` (flat maps), `sat/{z}/{x}/{y}.jpg` (globe, levels 0–5) |
| East Asia | the 21600×21600 D1 tile, cropped to 95–145°E, 10–50°N and halved | about 1 km per pixel | `ea.jpg`, `ea/{z}/{x}/{y}.webp` (levels 6–7) |
| Taiwan | the D1 tile, cropped to 117.5–123.5°E, 21–27°N | about 500 m per pixel | `tw.jpg`, `tw/{z}/{x}/{y}.webp` (levels 8–9) |

Flat maps switch to the regional images when zoomed in beyond about 2.5×; the globe switches by zoom level.

**Rebuilding, or using another month** (needs Python, Pillow and numpy):

1. Go to https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry, pick a month, and download the **5400x2700** **JPEG** and the **D1** JPEG from the "Bathymetry" row (East Asia, 21600×21600).
2. World layer:

```bash
python3 data-pipeline/make_satellite.py world.topo.bathy.200407.3x5400x2700.jpg
```

3. Regional layers: crop the area from D1 first (D1 covers 90–180°E, 0–90°N at 240 pixels per degree), then run:

```bash
python3 data-pipeline/make_satellite.py --region ea ea.jpg 95 145 10 50 6 7
python3 data-pipeline/make_satellite.py --region tw tw.jpg 117.5 123.5 21 27 8 9
```

The downloaded source JPGs do not need to be committed (`.gitignore` excludes `world.topo.bathy.*`).

## Music

`music/` contains the scores (Python) and a renderer. All seven pieces are original compositions, released under CC0; instrument sounds come from FluidR3_GM (CC BY 3.0).

| Track | Style |
|---|---|
| Chronicle | D minor sarabande, strings |
| Silk Road | pentatonic, koto and shakuhachi |
| March of Empires | D major march, horns, trumpet, timpani |
| Troubadour | D Dorian dance in 3/4, recorder and harp |
| Caravan | E Hijaz scale, oboe, dulcimer, drum |
| Voyage | G minor passacaglia, harpsichord and strings |
| Dawn | slow C major, choir, strings, harp |

To re-render, get the FluidR3_GM samples from gleitz/midi-js-soundfonts and run `python3 music/render.py <FluidR3_GM folder> music/scores/march.py public/audio/march`.

## Data checks

- Every build runs `data-pipeline/qa.py`, which checks each year for gaps, blinks and sovereign overlaps and writes `data-pipeline/qa_report.md`.
- All manual corrections live in the tables under `data-pipeline/overrides/`, each line with a source URL.
- The process is described in `docs/查核方案.md` (Chinese).

## Event system (not enabled yet)

Steps through an event on the existing map and timeline (control areas, front lines, arrows, places), grouped by main category. Add `?events` to the URL to preview the sample (Eight-Nation Alliance). The file format and the standard process for adding events are in `docs/事件系統.md`.

## Known limitations

- Historical borders come from Cliopatria and are approximate. Before about 1500, the coverage outside Eurasia is thin.
- Russian-occupied areas of southern Ukraine after 2022 are not drawn beyond the 2014 extents of the DPR and LPR. The West Bank and Gaza are not drawn as a separate polity.
- The China and Taiwan modes use approximate units: modern provinces, or modern counties split into plains and mountains. Some lines are sketches, including the mountain boundary, Puli, Hengchun and Matsu. Diagonal stripes mean the controller held only part of the area, or administered it in name only.
- The religion shown is the official or dominant religion of each polity, not the religious make-up of its population.

Taiwan rivers come from OpenStreetMap (© OpenStreetMap contributors, ODbL). See [ATTRIBUTION.md](ATTRIBUTION.md) for data and software licences.
