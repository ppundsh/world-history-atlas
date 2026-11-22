"""Small helpers for the regional-mode unit builders (units.py of poland, italy, india, spain).
  U = Units(NE)                     load Natural Earth 1:10m admin-0 / admin-1 once
  U.put(id, U.a1('PL-MZ', …))       admin-1 regions by ISO 3166-2 code (unioned)
  U.put(id, U.a0('LTU'))            a whole country
  U.cut(id, geom, [(name, shape)])  split: each piece's part goes to name, the rest to id
  U.write(out)                      GeoJSON FeatureCollection with properties.id
"""
import json, os
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union

class Units:
    def __init__(self, NE):
        self.NE = NE
        self.A1 = {}
        for f in json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']:
            k = f['properties']['iso_3166_2']; g = shape(f['geometry']).buffer(0)
            self.A1[k] = unary_union([self.A1[k], g]) if k in self.A1 else g
        self.A0 = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0)
                   for f in json.load(open(os.path.join(NE, 'ne_10m_admin_0_countries.geojson'), encoding='utf-8'))['features']}
        self.U = {}
    def a1(self, *codes): return unary_union([self.A1[c] for c in codes])
    def a1where(self, pred): return unary_union([g for k, g in self.A1.items() if pred(k)])
    def a0(self, *codes): return unary_union([self.A0[c] for c in codes])
    def put(self, k, g):
        g = g.buffer(0)
        if not g.is_empty: self.U[k] = unary_union([self.U[k], g]) if k in self.U else g
    def cut(self, k, g, pieces):
        rest = g
        for name, p in pieces:
            self.put(name, rest.intersection(p)); rest = rest.difference(p)
        self.put(k, rest)
    def admin1(self, iso, prefix):
        """replace units lying mostly inside country `iso` by its Natural Earth admin-1 regions (id prefix+code);
        what an old unit had outside them stays as <old>_rest (see _gen/admin1.py, which also records the aliases)"""
        A = {k.split('-')[-1]: g for k, g in self.A1.items() if k.startswith(self._iso2(iso) + '-') and '~' not in k}
        country = unary_union(list(A.values()))
        inside = [k for k, g in self.U.items() if g.area > 0 and g.intersection(country).area / g.area > 0.5]
        for k in inside:
            g = self.U.pop(k); rest = g.difference(country)
            if not rest.is_empty and rest.area > 0.03 * g.area: self.U[k + '_rest'] = rest
        for c, g in A.items(): self.U[prefix + c.lower()] = g
    def _iso2(self, iso):
        import json as _j
        if not hasattr(self, '_isomap'):
            self._isomap = {}
            for f in _j.load(open(os.path.join(self.NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']:
                p = f['properties']; self._isomap.setdefault(p['adm0_a3'], p['iso_3166_2'].split('-')[0])
        return self._isomap[iso]
    def write(self, out):
        feats = [{'type': 'Feature', 'properties': {'id': k}, 'geometry': mapping(g)} for k, g in self.U.items() if not g.is_empty]
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
        print(len(feats), 'units →', out); print(' '.join(sorted(self.U)))
