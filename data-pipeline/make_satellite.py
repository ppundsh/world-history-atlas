#!/usr/bin/env python3
"""
Builds the satellite base map from NASA Blue Marble: Next Generation images (public domain,
credit "NASA Earth Observatory").

Global layer (required):
  python3 data-pipeline/make_satellite.py world.topo.bathy.200407.3x5400x2700.jpg
    → public/basemap/bluemarble.jpg        4096×2048, flat projections (reprojected in the browser)
    → public/basemap/sat/{z}/{x}/{y}.jpg   Web-Mercator tiles z0–5 for the 3D globe

Regional detail (optional, sharper when zoomed in). The source is an equirectangular crop of one of the
21600×21600 Blue Marble tiles (e.g. D1 = 90–180°E, 0–90°N, 240 px per degree):
  python3 data-pipeline/make_satellite.py --region NAME crop.jpg LON0 LON1 LAT0 LAT1 ZMIN ZMAX
    → public/basemap/NAME.jpg and public/basemap/NAME/{z}/{x}/{y}.webp (only tiles touching the box)
  e.g. --region tw tw.jpg 117.5 123.5 21 27 8 9      (Taiwan)
       --region ea ea.jpg 95 145 10 50 6 7           (East Asia)
Each run updates public/basemap/sat/meta.json.
"""
import sys, os, math, json
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'basemap')
META = os.path.join(OUT, 'sat', 'meta.json')


def tiles(a, box, zmin, zmax, folder):
    """Cut Web-Mercator tiles from an equirectangular array covering box = (lon0, lon1, lat0, lat1)."""
    lon0, lon1, lat0, lat1 = box
    H, W = a.shape[:2]
    for z in range(zmin, zmax + 1):
        n = 2 ** z
        tx0, tx1 = int((lon0 + 180) / 360 * n), int(math.ceil((lon1 + 180) / 360 * n)) - 1
        merc = lambda lat: (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2 * n
        ty0, ty1 = int(merc(min(85.05, lat1))), int(math.ceil(merc(max(-85.05, lat0)))) - 1
        for ty in range(ty0, ty1 + 1):
            py = (ty * 256 + np.arange(256) + 0.5) / (n * 256)
            lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * py))))
            rows = (lat1 - lat) / (lat1 - lat0) * H
            for tx in range(tx0, tx1 + 1):
                px = (tx * 256 + np.arange(256) + 0.5) / (n * 256)
                lon = px * 360 - 180
                cols = (lon - lon0) / (lon1 - lon0) * W
                inside = ((rows >= 0) & (rows < H))[:, None] & ((cols >= 0) & (cols < W))[None, :]
                if not inside.any():
                    continue
                tile = a[np.clip(rows.astype(int), 0, H - 1)[:, None], np.clip(cols.astype(int), 0, W - 1)[None, :]]
                d = os.path.join(OUT, folder, str(z), str(tx))
                os.makedirs(d, exist_ok=True)
                if folder == 'sat':
                    Image.fromarray(tile).save(os.path.join(d, f'{ty}.jpg'), quality=82)
                else:                          # regional tiles: WebP, transparent outside the box
                    tile = np.dstack([tile, np.where(inside, 255, 0).astype(np.uint8)])
                    Image.fromarray(tile).save(os.path.join(d, f'{ty}.webp'), quality=80, method=5)
        print(folder, 'zoom', z, 'done')


def read_meta():
    try:
        with open(META) as f: return json.load(f)
    except Exception:
        return {'maxzoom': 5, 'regions': []}


if sys.argv[1] == '--region':
    name, path = sys.argv[2], sys.argv[3]
    lon0, lon1, lat0, lat1 = map(float, sys.argv[4:8])
    zmin, zmax = int(sys.argv[8]), int(sys.argv[9])
    src = Image.open(path).convert('RGB')
    src.save(os.path.join(OUT, name + '.jpg'), quality=85, optimize=True, progressive=True)
    tiles(np.asarray(src), (lon0, lon1, lat0, lat1), zmin, zmax, name)
    meta = read_meta()
    meta['regions'] = [r for r in meta.get('regions', []) if r['id'] != name] + [
        {'id': name, 'bounds': [lon0, lat0, lon1, lat1], 'minzoom': zmin, 'maxzoom': zmax, 'image': name + '.jpg'}]
    meta['regions'].sort(key=lambda r: r['minzoom'])
else:
    src = Image.open(sys.argv[1]).convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    src.resize((4096, 2048), Image.LANCZOS).save(os.path.join(OUT, 'bluemarble.jpg'), quality=85, optimize=True, progressive=True)
    maxz = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    tiles(np.asarray(src), (-180, 180, -90, 90), 0, maxz, 'sat')
    meta = read_meta(); meta['maxzoom'] = maxz
os.makedirs(os.path.dirname(META), exist_ok=True)
with open(META, 'w') as f:
    json.dump(meta, f)
