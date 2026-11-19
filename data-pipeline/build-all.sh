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
node data-pipeline/projmetrics.mjs > /dev/null
node data-pipeline/events/build.mjs   # event system: validates every event, fails the build on errors
# regional modes: hand-drawn unit maps + month-by-month tables in data-pipeline/<region>/
mkdir -p data-pipeline/build
python3 data-pipeline/china/provinces.py "$NE" data-pipeline/build/china_provinces.geojson
$MS -i data-pipeline/build/china_provinces.geojson -simplify 4% keep-shapes -o format=topojson quantization=100000 $OUT/china_provinces.json >/dev/null 2>&1
python3 data-pipeline/taiwan/units.py data-pipeline/taiwan/src/towns-10t.json data-pipeline/build/taiwan_units.geojson
$MS -i data-pipeline/build/taiwan_units.geojson -simplify 20% keep-shapes -o format=topojson quantization=100000 $OUT/taiwan_units.json >/dev/null 2>&1
python3 data-pipeline/japan/units.py data-pipeline/japan/src/N03-21_210101_s0010.json "$NE" data-pipeline/build/china_provinces.geojson data-pipeline/build/japan_units.geojson
python3 data-pipeline/japan/gen.py
$MS -i data-pipeline/build/japan_units.geojson -simplify 15% keep-shapes -o format=topojson quantization=100000 $OUT/japan_units.json >/dev/null 2>&1
python3 data-pipeline/taiwan/rivers_tw.py data-pipeline/build/rivers_tw.geojson
$MS -i data-pipeline/build/rivers_tw.geojson name=rivers -filter-fields -o format=topojson quantization=100000 $OUT/rivers_tw.json >/dev/null 2>&1
node data-pipeline/finalize.mjs
node data-pipeline/build_region.mjs china
node data-pipeline/build_region.mjs taiwan
node data-pipeline/build_region.mjs japan
python3 data-pipeline/russia/units.py "$NE" data-pipeline/build/russia_units.geojson
NE="$NE" python3 data-pipeline/russia/gen.py
$MS -i data-pipeline/build/russia_units.geojson -simplify 8% keep-shapes -o format=topojson quantization=100000 $OUT/russia_units.json >/dev/null 2>&1
node data-pipeline/build_region.mjs russia
# label anchors (modern countries are named in their home part, not their biggest piece)
NE="$NE" python3 data-pipeline/anchors.py
du -sh $OUT
