#!/usr/bin/env python3
"""
Lay the railways and roads of every regional mode (infra.tsv, kinds rail / hsr / highway / road) onto real map
data: Natural Earth 1:10m railroads and roads (public domain, naturalearthdata.com).

infra.tsv keeps the stations / towns a line runs through. For each pair of neighbouring points the shortest
path along the Natural Earth network is taken, when it is a believable match:
  - both points lie within SNAP_KM of the network,
  - the path is not much longer than the straight distance (a detour means the network lacks the line),
  - it stays near the straight line between the two points.
A pair that fails keeps its straight segment, and the line is then marked as partly sketched.

Writes data-pipeline/<region>/routes.json: { id: { parts: [[[lon, lat], …], …], src: 'ne' | 'mixed' | 'sketch',
net: 'rail' | 'road' } }, which build_region.mjs uses instead of the sketched points.
  python3 data-pipeline/snap_routes.py <NE geojson dir> [region …]
"""
import sys, os, json, math, heapq
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
NE = sys.argv[1]
REGIONS = sys.argv[2:] or sorted(d for d in os.listdir(HERE) if os.path.exists(os.path.join(HERE, d, 'infra.tsv')))
SNAP_KM = 25          # a town further than this from the network is not on it (sketch points are town centres)
JOIN_KM = 1.5         # a loose line end this close to another line is joined to it
GRID = 0.002          # vertices closer than ~200 m are joined (Natural Earth lines are not always noded)
R = 6371.0


def km(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(d)))


class Net:
    """A network graph: vertices on a ~200 m grid, edges weighted by length × the line's cost factor."""
    def __init__(self, feats, cost):
        self.pts, self.idx, self.adj = [], {}, []
        for f in feats:
            c = cost(f['properties'])
            if c is None: continue
            g = f['geometry']
            lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
            for line in lines:
                prev = None
                for p in line:
                    v = self.vertex(p)
                    if prev is not None and prev != v:
                        d = km(self.pts[prev], self.pts[v])
                        self.adj[prev].append((v, d * c, d)); self.adj[v].append((prev, d * c, d))
                    prev = v
        arr = np.array(self.pts)
        self.lat0 = np.cos(np.radians(arr[:, 1]))
        self.tree = cKDTree(np.c_[arr[:, 0] * self.lat0, arr[:, 1]])
        # Natural Earth lines often stop just short of the line they meet: join each loose end to the nearest
        # vertex of another line within JOIN_KM
        ends = [v for v in range(len(self.pts)) if len(self.adj[v]) == 1]
        for v in ends:
            p = self.pts[v]
            ds, ix = self.tree.query((p[0] * math.cos(math.radians(p[1])), p[1]), k=8)
            for d, w in zip(ds, ix):
                w = int(w)
                if w == v or w == self.adj[v][0][0]: continue
                dk = km(p, self.pts[w])
                if dk <= JOIN_KM:
                    self.adj[v].append((w, dk * 1.5, dk)); self.adj[w].append((v, dk * 1.5, dk)); break

    def vertex(self, p):
        k = (round(p[0] / GRID), round(p[1] / GRID))
        v = self.idx.get(k)
        if v is None:
            v = self.idx[k] = len(self.pts); self.pts.append((p[0], p[1])); self.adj.append([])
        return v

    def near(self, p, n=6):
        """the nearest few vertices within SNAP_KM (several, so a station by a dead-end spur still finds the main line)"""
        q = (p[0] * math.cos(math.radians(p[1])), p[1])
        ds, ix = self.tree.query(q, k=n)
        return [int(i) for d, i in zip(ds, ix) if km(p, self.pts[int(i)]) <= SNAP_KM]

    def path(self, a, b, box):
        """cheapest path between two points, searching only inside box (lon0, lat0, lon1, lat1)"""
        A, B = self.near(a), set(self.near(b))
        if not A or not B: return None
        x0, y0, x1, y1 = box
        dist, prev, heap = {}, {}, []
        for v in A:
            d0 = km(a, self.pts[v]); dist[v] = d0; heapq.heappush(heap, (d0, v))
        end = None
        while heap:
            d, v = heapq.heappop(heap)
            if d > dist.get(v, 1e18): continue
            if v in B: end = v; break
            for w, c, _ in self.adj[v]:
                lon, lat = self.pts[w]
                if not (x0 <= lon <= x1 and y0 <= lat <= y1): continue
                nd = d + c
                if nd < dist.get(w, 1e18): dist[w] = nd; prev[w] = v; heapq.heappush(heap, (nd, w))
        if end is None: return None
        out = [end]
        while out[-1] in prev: out.append(prev[out[-1]])
        return [self.pts[v] for v in reversed(out)]


def seg_dev(p, a, b):
    """distance (km, roughly) from p to the great-circle-ish straight segment a–b, in a local plane"""
    lat0 = math.radians((a[1] + b[1]) / 2)
    X = lambda q: ((q[0] - a[0]) * math.cos(lat0) * 111.32, (q[1] - a[1]) * 110.57)
    (bx, by), (px, py) = X(b), X(p)
    L = bx * bx + by * by
    t = 0 if L == 0 else max(0, min(1, (px * bx + py * by) / L))
    return math.hypot(px - t * bx, py - t * by)


def route(net, a, b, via=()):
    """the network path from a to b; via = sketch points skipped in between (the path must still pass near them)"""
    ref = [a, *via, b]
    gc = sum(km(ref[i], ref[i + 1]) for i in range(len(ref) - 1))
    if gc < 0.5: return None
    pad = max(0.5, gc / 111 * 0.5)
    box = (min(q[0] for q in ref) - pad, min(q[1] for q in ref) - pad, max(q[0] for q in ref) + pad, max(q[1] for q in ref) + pad)
    p = net.path(a, b, box)
    if not p or len(p) < 2: return None
    L = sum(km(p[i], p[i + 1]) for i in range(len(p) - 1))
    if L < 0.3 * gc: return None                                                # both ends on one spot: no line between
    if L > max(1.6 * gc, gc + 40): return None                                  # a detour: the line itself is missing
    dev = lambda q: min(seg_dev(q, ref[i], ref[i + 1]) for i in range(len(ref) - 1))
    if max(dev(q) for q in p[::max(1, len(p) // 400)]) > max(30, 0.35 * gc / len(ref[1:])): return None   # strays into another corridor
    if via and max(min(km(v, q) for q in p) for v in via) > 60: return None    # misses a town it should pass
    # the sketch points are town centres: join them to the line only when they are close to it
    head = [list(a)] if km(a, p[0]) < 3 else []
    tail = [list(b)] if km(b, p[-1]) < 3 else []
    return head + [list(q) for q in p] + tail


def thin(line, tol=0.003):
    """drop points closer than tol degrees to the previous one (keeps the files small)"""
    out = [line[0]]
    for q in line[1:-1]:
        if abs(q[0] - out[-1][0]) + abs(q[1] - out[-1][1]) >= tol: out.append(q)
    out.append(line[-1])
    return [[round(x, 4), round(y, 4)] for x, y in out]


def main():
    load = lambda f: json.load(open(os.path.join(NE, f), encoding='utf-8'))['features']
    print('building networks …', flush=True)
    rail = Net(load('ne_10m_railroads.geojson'), lambda p: 1.0)
    ROAD_COST = {'Major Highway': 1.0, 'Beltway': 1.0, 'Bypass': 1.0, 'Secondary Highway': 1.15, 'Road': 1.3, 'Unknown': 1.4, 'Track': 2.0}
    roads = load('ne_10m_roads.geojson')
    road = Net(roads, lambda p: None if p.get('type') == 'Ferry Route' else ROAD_COST.get(p.get('type'), 1.4))
    # motorways: the same network, but expressways much cheaper, so a motorway follows the motorway
    hw = Net(roads, lambda p: None if p.get('type') == 'Ferry Route' else (0.7 if p.get('expressway') else ROAD_COST.get(p.get('type'), 1.4)))
    NETS = {'rail': rail, 'hsr': rail, 'road': road, 'highway': hw}
    for r in REGIONS:
        out, stat = {}, {'ne': 0, 'mixed': 0, 'sketch': 0}
        for line in open(os.path.join(HERE, r, 'infra.tsv'), encoding='utf-8'):
            if not line.strip() or line.startswith('#'): continue
            c = line.rstrip('\n').split('\t')
            kind, wid, geom = c[0], c[1], c[4]
            if kind not in NETS: continue
            net, parts, ok, bad = NETS[kind], [], 0, 0
            for part in geom.split(';'):
                pts = [tuple(map(float, q.split(','))) for q in part.split()]
                res = [list(pts[0])]
                i = 0
                while i < len(pts) - 1:
                    a, seg, j = pts[i], None, i + 1
                    # a sketch point off the network (a rough town position) may be skipped: route on to the next
                    while j < len(pts) and j <= i + 3:
                        seg = route(net, a, pts[j], pts[i + 1:j])
                        if seg or net.near(pts[j]): break
                        j += 1
                    j = min(j, len(pts) - 1)
                    if seg:
                        # replace the sketch point by where the line really passes
                        if seg[0] != list(a) and res and res[-1] == list(a): res[-1] = seg[0]
                        res += seg[1:]; ok += j - i
                    else:
                        j = i + 1; res.append(list(pts[j])); bad += 1
                    i = j
                parts.append(thin(res))
            src = 'ne' if bad == 0 else 'mixed' if ok else 'sketch'
            stat[src] += 1
            out[wid] = {'parts': parts, 'src': src, 'net': 'rail' if kind in ('rail', 'hsr') else 'road'}
        json.dump(out, open(os.path.join(HERE, r, 'routes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print(r, stat, flush=True)


main()
