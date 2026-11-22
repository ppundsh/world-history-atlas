#!/usr/bin/env python3
"""
Argentina-mode units (1536–2026): groups of today's provinces (Natural Earth 1:10m admin-1) by historic region,
with Uruguay (the Banda Oriental), Paraguay and the Falkland Islands (Malvinas).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'buenos_aires': 'B C', 'litoral': 'S E', 'mesopotamia': 'W N', 'chaco': 'H P', 'cordoba': 'X', 'cuyo': 'M J D',
     'northwest': 'A Y T K F G', 'pampa': 'L', 'patagonia_n': 'Q R', 'patagonia_s': 'U Z V'}
for k, v in G.items(): U.put(k, U.a1(*['AR-' + c for c in v.split()]))
U.put('uruguay', U.a0('URY')); U.put('paraguay', U.a0('PRY'))
if 'FLK' in U.A0: U.put('malvinas', U.a0('FLK'))
# the country's real first-level divisions (the old ids above are aliases in region.json "groups")
U.admin1('ARG', 'ar_')
U.write(OUT)
