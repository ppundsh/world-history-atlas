#!/usr/bin/env bash
# Rebuilds public/data from the raw sources. Needs: python3 + shapely, node (npm install done).
#   CLIO=path/to/cliopatria_polities_only_v021.geojson NE=path/to/natural-earth-vector/geojson bash data-pipeline/build-all.sh
# Defaults expect the sources under data-pipeline/sources/ (see README).
set -euo pipefail
cd "$(dirname "$0")/.."
CLIO=${CLIO:-data-pipeline/sources/cliopatria/cliopatria_polities_only_v021.geojson}
NE=${NE:-data-pipeline/sources/natural-earth-vector/geojson}
MS="npx mapshaper"
OUT=public/data
python3 data-pipeline/build.py "$CLIO" "$NE"
# automatic checks → data-pipeline/qa_report.md (QA_STRICT=1 stops the build on blinks / modern gaps / modern overlaps)
python3 data-pipeline/qa.py "$NE" ${QA_STRICT:+--strict}
rm -rf $OUT/chunks && mkdir -p $OUT/chunks
for f in data-pipeline/build/chunks/*.geojson; do
  id=$(basename "$f" .geojson)
  $MS -i "$f" -simplify 15% weighted keep-shapes -o format=topojson quantization=200000 "$OUT/chunks/$id.json" >/dev/null 2>&1
done
$MS -i data-pipeline/build/disputed.geojson -simplify 30% keep-shapes -o format=topojson quantization=100000 $OUT/disputed.json >/dev/null 2>&1
$MS -i "$NE/ne_50m_land.geojson" "$NE/ne_50m_lakes.geojson" "$NE/ne_50m_rivers_lake_centerlines.geojson" combine-files \
    -simplify 40% keep-shapes -o format=topojson quantization=100000 $OUT/base50.json >/dev/null 2>&1
# physical base map: bathymetry bands, deserts / mountains / plateaus, glaciers and ice shelves
TMP=$(mktemp -d)
for b in K_200 I_2000 G_4000 E_6000; do
  $MS -i "$NE/ne_10m_bathymetry_$b.geojson" -simplify 3% keep-shapes -filter-slivers -each "depth=${b#*_}" -o $TMP/bathy_$b.geojson >/dev/null 2>&1
done
$MS -i $TMP/bathy_*.geojson combine-files -merge-layers name=bathy force -filter-fields depth -o $TMP/bathy.geojson >/dev/null 2>&1
$MS -i "$NE/ne_50m_geography_regions_polys.geojson" -filter "['Range/mtn','Desert','Plateau','Tundra'].indexOf(FEATURECLA)>-1" \
    -each "k=FEATURECLA" -filter-fields k -simplify 20% keep-shapes -o $TMP/regions.geojson >/dev/null 2>&1
$MS -i "$NE/ne_50m_glaciated_areas.geojson" "$NE/ne_50m_antarctic_ice_shelves_polys.geojson" combine-files \
    -merge-layers name=ice force -filter-fields -simplify 30% keep-shapes -o $TMP/ice.geojson >/dev/null 2>&1
$MS -i $TMP/bathy.geojson $TMP/regions.geojson $TMP/ice.geojson combine-files -o format=topojson quantization=50000 $OUT/physical.json >/dev/null 2>&1
rm -rf $TMP
# modern borders overlay and the 1:10m detail layers used when zoomed in
$MS -i "$NE/ne_50m_admin_0_boundary_lines_land.geojson" name=modern -filter-fields -simplify 40% keep-shapes -o format=topojson quantization=100000 $OUT/modern.json >/dev/null 2>&1
$MS -i "$NE/ne_10m_rivers_lake_centerlines.geojson" name=rivers -filter-fields -simplify 25% \
    -i "$NE/ne_10m_lakes.geojson" name=lakes -filter 'scalerank<=8' -filter-fields -simplify 20% keep-shapes \
    -o format=topojson quantization=200000 target=* combine-layers $OUT/detail.json >/dev/null 2>&1
node data-pipeline/build_projinfo.mjs
node data-pipeline/build_events.mjs
node data-pipeline/people/build.mjs             # people named in cards -> public/data/people.json
# capitals: node data-pipeline/capitals/build.mjs (needs Wikidata) -> public/data/capitals.json
python3 data-pipeline/taiwan/party_build.py      # Taiwan party map -> data-pipeline/taiwan/party.tsv
node data-pipeline/projmetrics.mjs > /dev/null
node data-pipeline/events/build.mjs   # event system: validates every event, fails the build on errors
# regional modes: hand-drawn unit maps + month-by-month tables in data-pipeline/<region>/
mkdir -p data-pipeline/build
python3 data-pipeline/china/provinces.py "$NE" data-pipeline/build/china_provinces.geojson
$MS -i data-pipeline/build/china_provinces.geojson -simplify 4% keep-shapes -o format=topojson quantization=100000 $OUT/china_provinces.json >/dev/null 2>&1
python3 data-pipeline/taiwan/units.py data-pipeline/taiwan/src/towns-10t.json data-pipeline/build/taiwan_units.geojson
$MS -i data-pipeline/build/taiwan_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 20% keep-shapes -o format=topojson quantization=100000 $OUT/taiwan_units.json >/dev/null 2>&1
python3 data-pipeline/japan/units.py data-pipeline/japan/src/N03-21_210101_s0010.json "$NE" data-pipeline/build/china_provinces.geojson data-pipeline/build/japan_units.geojson
python3 data-pipeline/japan/gen.py
$MS -i data-pipeline/build/japan_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 15% keep-shapes -o format=topojson quantization=100000 $OUT/japan_units.json >/dev/null 2>&1
python3 data-pipeline/taiwan/rivers_tw.py data-pipeline/build/rivers_tw.geojson
$MS -i data-pipeline/build/rivers_tw.geojson name=rivers -filter-fields -o format=topojson quantization=100000 $OUT/rivers_tw.json >/dev/null 2>&1
node data-pipeline/finalize.mjs
node data-pipeline/build_region.mjs china
# railway and road routes of the regional modes, laid on Natural Earth 1:10m railroads / roads (routes.json)
if [ -f "$NE/ne_10m_railroads.geojson" ]; then python3 data-pipeline/snap_routes.py "$NE"; fi
node data-pipeline/build_region.mjs taiwan
node data-pipeline/build_region.mjs japan
python3 data-pipeline/russia/units.py "$NE" data-pipeline/build/russia_units.geojson
NE="$NE" python3 data-pipeline/russia/gen.py
$MS -i data-pipeline/build/russia_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/russia_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs russia
python3 data-pipeline/korea/units.py "$NE" data-pipeline/build/korea_units.geojson
$MS -i data-pipeline/build/korea_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 10% keep-shapes -o format=topojson quantization=100000 $OUT/korea_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs korea
python3 data-pipeline/vietnam/units.py "$NE" data-pipeline/build/vietnam_units.geojson
$MS -i data-pipeline/build/vietnam_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 10% keep-shapes -o format=topojson quantization=100000 $OUT/vietnam_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs vietnam
python3 data-pipeline/germany/units.py "$NE" data-pipeline/build/germany_units.geojson
$MS -i data-pipeline/build/germany_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/germany_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs germany
python3 data-pipeline/poland/units.py "$NE" data-pipeline/build/poland_units.geojson
$MS -i data-pipeline/build/poland_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/poland_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs poland
python3 data-pipeline/italy/units.py "$NE" data-pipeline/build/italy_units.geojson
$MS -i data-pipeline/build/italy_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/italy_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs italy
python3 data-pipeline/spain/units.py "$NE" data-pipeline/build/spain_units.geojson
$MS -i data-pipeline/build/spain_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/spain_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs spain
python3 data-pipeline/india/units.py "$NE" data-pipeline/build/india_units.geojson
$MS -i data-pipeline/build/india_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/india_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs india
node data-pipeline/art/build.mjs
node data-pipeline/build_theme.mjs language
node data-pipeline/build_theme.mjs finance
node data-pipeline/fgo/build.mjs
# label anchors (modern countries are named in their home part, not their biggest piece)
NE="$NE" python3 data-pipeline/anchors.py
du -sh $OUT
python3 data-pipeline/prc/units.py "$NE" data-pipeline/build/prc_units.geojson
$MS -i data-pipeline/build/prc_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 15% keep-shapes -o format=topojson quantization=100000 $OUT/prc_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs prc
python3 data-pipeline/france/units.py "$NE" data-pipeline/build/france_units.geojson
$MS -i data-pipeline/build/france_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/france_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs france
python3 data-pipeline/egypt/units.py "$NE" data-pipeline/build/egypt_units.geojson
$MS -i data-pipeline/build/egypt_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/egypt_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs egypt
python3 data-pipeline/iran/units.py "$NE" data-pipeline/build/iran_units.geojson
$MS -i data-pipeline/build/iran_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/iran_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs iran
python3 data-pipeline/turkey/units.py "$NE" data-pipeline/build/turkey_units.geojson
$MS -i data-pipeline/build/turkey_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/turkey_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs turkey
python3 data-pipeline/uk/units.py "$NE" data-pipeline/build/uk_units.geojson
$MS -i data-pipeline/build/uk_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 6% keep-shapes -o format=topojson quantization=100000 $OUT/uk_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs uk
python3 data-pipeline/mexico/units.py "$NE" data-pipeline/build/mexico_units.geojson
$MS -i data-pipeline/build/mexico_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/mexico_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs mexico
python3 data-pipeline/morocco/units.py "$NE" data-pipeline/build/morocco_units.geojson
$MS -i data-pipeline/build/morocco_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 6% keep-shapes -o format=topojson quantization=100000 $OUT/morocco_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs morocco
python3 data-pipeline/brazil/units.py "$NE" data-pipeline/build/brazil_units.geojson
$MS -i data-pipeline/build/brazil_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 5% keep-shapes -o format=topojson quantization=100000 $OUT/brazil_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs brazil
python3 data-pipeline/argentina/units.py "$NE" data-pipeline/build/argentina_units.geojson
$MS -i data-pipeline/build/argentina_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 5% keep-shapes -o format=topojson quantization=100000 $OUT/argentina_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs argentina
python3 data-pipeline/thailand/units.py "$NE" data-pipeline/build/thailand_units.geojson
$MS -i data-pipeline/build/thailand_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 6% keep-shapes -o format=topojson quantization=100000 $OUT/thailand_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs thailand
python3 data-pipeline/philippines/units.py "$NE" data-pipeline/build/philippines_units.geojson
$MS -i data-pipeline/build/philippines_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 20% keep-shapes -o format=topojson quantization=100000 $OUT/philippines_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs philippines
python3 data-pipeline/indonesia/units.py "$NE" data-pipeline/build/indonesia_units.geojson
$MS -i data-pipeline/build/indonesia_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 5% keep-shapes -o format=topojson quantization=100000 $OUT/indonesia_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs indonesia
python3 data-pipeline/usa/units.py "$NE" data-pipeline/build/usa_units.geojson
$MS -i data-pipeline/build/usa_units.geojson snap snap-interval=0.001 -clean gap-fill-area=0.05km2 -simplify 6% keep-shapes -o format=topojson quantization=100000 $OUT/usa_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs usa
node data-pipeline/build_theme.mjs internet
python3 data-pipeline/disaster/make_json.py
node data-pipeline/disaster/build_disaster.mjs
node data-pipeline/econ/build-econ.mjs
node data-pipeline/econ/build-compare.mjs "$NE"
node data-pipeline/growth/build-growth.mjs
python3 data-pipeline/compare/outlines.py "$NE"
node data-pipeline/seo/build-seo.mjs
