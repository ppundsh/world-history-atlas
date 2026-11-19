#!/usr/bin/env python3
"""
Taiwan terrain-shading tiles from the Ministry of the Interior 20 m DTM
(內政部 全台 20 公尺 DEM，政府資料開放授權條款－第1版; https://data.gov.tw/dataset/169807 and later editions).

  python3 data-pipeline/relief_tw.py <DTM .tif or the .zip it came in> [out dir]
      → public/relief/tw/{z}/{x}/{y}.png (z 6–12) + meta.json

Needs only numpy and Pillow. The DTM is a single uncompressed float32 GeoTIFF in TWD97 / TM2 121°
(EPSG:3826); it is read through a memory map, so the whole file is never loaded. Each Web-Mercator pixel
is converted to TM2 with the Transverse Mercator formulas (GRS80) and sampled bilinearly.
Output: grey hillshade lit from the north-west, transparent outside the data and at sea level.
"""
import sys, os, math, zipfile, tempfile, json
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ZMAX, ZMIN = 12, 6
BOUNDS = (119.9, 21.85, 122.1, 25.35)                    # Taiwan main island and nearby islets (the DTM's extent)
R = 6378137.0

def open_dtm(path):
    if path.lower().endswith('.zip'):
        z = zipfile.ZipFile(path)
        name = next(n for n in z.namelist() if n.lower().endswith(('.tif', '.tiff')))
        tmp = os.path.join(tempfile.gettempdir(), os.path.basename(name))
        if not os.path.exists(tmp) or os.path.getsize(tmp) != z.getinfo(name).file_size:
            z.extract(name, tempfile.gettempdir()); os.replace(os.path.join(tempfile.gettempdir(), name), tmp)
        path = tmp
    im = Image.open(path)
    t = im.tag_v2
    w, h = im.size
    sx, sy = t[33550][:2]; tie = t[33922]
    x0, y0 = tie[3] - tie[0] * sx, tie[4] + tie[1] * sy  # upper-left corner
    nodata = float(t.get(42113, -32767))
    offs, counts = t[273], t[279]
    contiguous = t.get(259, 1) == 1 and t[258][0] == 32 and all(offs[i + 1] == offs[i] + counts[i] for i in range(len(offs) - 1))
    if contiguous:
        a = np.memmap(path, dtype='<f4', mode='r', offset=offs[0], shape=(h, w))
    else:
        a = np.asarray(im, dtype='float32')
    print(f'DTM {w}×{h}, {sx} m, origin E {x0} N {y0}, {"memory-mapped" if contiguous else "loaded"}')
    return a, x0, y0, sx, nodata

# GRS80 Transverse Mercator, TWD97 TM2 121° (EPSG:3826)
A, F = 6378137.0, 1 / 298.257222101
E2 = F * (2 - F); EP2 = E2 / (1 - E2)
K0, LON0, FE = 0.9999, math.radians(121), 250000.0
def tm2(lon, lat):
    phi, lam = np.radians(lat), np.radians(lon)
    sin, cos, tan = np.sin(phi), np.cos(phi), np.tan(phi)
    N = A / np.sqrt(1 - E2 * sin ** 2); T = tan ** 2; C = EP2 * cos ** 2; Aa = (lam - LON0) * cos
    M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * np.sin(2 * phi)
             + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * np.sin(4 * phi) - (35 * E2 ** 3 / 3072) * np.sin(6 * phi))
    x = FE + K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * Aa ** 5 / 120)
    y = K0 * (M + N * tan * (Aa ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * Aa ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * Aa ** 6 / 720))
    return x, y

def merc_px(lon, lat, z):
    n = 256 * 2 ** z; s = math.sin(math.radians(lat))
    return (lon + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n

def main(src, out):
    a, x0, y0, cs, nodata = open_dtm(src)
    H0, W0 = a.shape
    z = ZMAX; n = 256 * 2 ** z
    px0, py1 = merc_px(BOUNDS[0], BOUNDS[1], z); px1, py0 = merc_px(BOUNDS[2], BOUNDS[3], z)
    tx0, tx1, ty0, ty1 = int(px0 // 256), int(px1 // 256), int(py0 // 256), int(py1 // 256)
    cols = np.arange(tx0 * 256 - 1, (tx1 + 1) * 256 + 1)                   # one extra pixel each side for the gradient
    lon = (cols + 0.5) / n * 360 - 180
    res = 2 * math.pi * R / n
    tiles = 0
    for ty in range(ty0, ty1 + 1):
        rows = np.arange(ty * 256 - 1, (ty + 1) * 256 + 1)
        lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * (rows + 0.5) / n))))
        LON, LAT = np.meshgrid(lon, lat)
        E, Nn = tm2(LON, LAT)
        fx, fy = (E - x0) / cs - 0.5, (y0 - Nn) / cs - 0.5
        ix, iy = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
        inside = (ix >= 0) & (iy >= 0) & (ix < W0 - 1) & (iy < H0 - 1)
        if not inside.any(): continue
        ixc, iyc = np.clip(ix, 0, W0 - 2), np.clip(iy, 0, H0 - 2)
        r0, r1 = int(iyc[inside].min()), int(iyc[inside].max()) + 2
        blk = np.array(a[r0:r1], dtype='float32')                         # only the DTM rows this strip needs
        blk[blk <= nodata + 1] = np.nan
        wx, wy = fx - ix, fy - iy; yy = iyc - r0
        v = (blk[yy, ixc] * (1 - wx) * (1 - wy) + blk[yy, ixc + 1] * wx * (1 - wy)
             + blk[yy + 1, ixc] * (1 - wx) * wy + blk[yy + 1, ixc + 1] * wx * wy)
        v[~inside] = np.nan
        f = np.nan_to_num(v, nan=0.0)
        k = (res * np.cos(np.radians(lat)))[:, None]
        gy, gx = np.gradient(f)
        dzdx, dzdy = gx / k, -gy / k
        slope = np.arctan(1.3 * np.hypot(dzdx, dzdy)); aspect = np.arctan2(dzdy, -dzdx)
        az, alt = math.radians(315), math.radians(45)
        hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - math.pi / 2 - aspect)
        grey = np.clip(255 * (0.30 + 0.80 * hs), 0, 255).astype('uint8')[1:-1, 1:-1]
        alpha = np.where(np.isnan(v) | (f <= 0.5), 0, 255).astype('uint8')[1:-1, 1:-1]
        for tx in range(tx0, tx1 + 1):
            c = (tx - tx0) * 256
            al = alpha[:, c:c + 256]
            if not al.any(): continue
            d = os.path.join(out, str(z), str(tx)); os.makedirs(d, exist_ok=True)
            Image.fromarray(np.dstack([grey[:, c:c + 256], al]), 'LA').save(os.path.join(d, f'{ty}.png'), optimize=True); tiles += 1
        print(f'z{z} row {ty - ty0 + 1}/{ty1 - ty0 + 1}', flush=True)
    # lower zooms: merge four children and halve
    for z in range(ZMAX - 1, ZMIN - 1, -1):
        kids = {}
        zd = os.path.join(out, str(z + 1))
        for x in os.listdir(zd):
            for f in os.listdir(os.path.join(zd, x)):
                kids.setdefault((int(x) // 2, int(f[:-4]) // 2), []).append((int(x), int(f[:-4])))
        for (x, y), ch in kids.items():
            big = Image.new('LA', (512, 512), (0, 0))
            for cx, cy in ch:
                big.paste(Image.open(os.path.join(zd, str(cx), f'{cy}.png')), ((cx - 2 * x) * 256, (cy - 2 * y) * 256))
            d = os.path.join(out, str(z), str(x)); os.makedirs(d, exist_ok=True)
            big.resize((256, 256), Image.LANCZOS).save(os.path.join(d, f'{y}.png'), optimize=True); tiles += 1
        print(f'z{z}: {len(kids)} tiles', flush=True)
    json.dump({'bounds': list(BOUNDS), 'minzoom': ZMIN, 'maxzoom': ZMAX}, open(os.path.join(out, 'meta.json'), 'w'))
    print(tiles, 'tiles →', out)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'public', 'relief', 'tw'))
