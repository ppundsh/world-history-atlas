#!/usr/bin/env python3
"""
Thailand-mode units (1238–2026): groups of today's provinces (Natural Earth 1:10m admin-1) by historic region
(Lanna, Sukhothai, the Chao Phraya plain, Isan, the south), with Laos, Cambodia and the four northern Malay states
that Siam held until 1909.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'lanna': '50 51 52 54 55 56 57 58', 'sukhothai': '53 60 61 62 64 65 66 67', 'central': '10 11 12 13 14 15 16 17 18 19 72 73 74 75',
     'west': '63 70 71 76 77', 'east': '20 21 22 23 24 25 26 27', 'isan_s': '30 31 32 33 34 35 37', 'isan_n': '36 38 39 40 41 42 43 44 45 46 47 48 49',
     'south': '80 81 82 83 84 85 86 90 91 92 93', 'patani': '94 95 96'}
for k, v in G.items(): U.put(k, U.a1(*['TH-' + c for c in v.split()]))
U.put('laos', U.a0('LAO')); U.put('cambodia', U.a0('KHM'))
U.put('malay_n', U.a1('MY-02', 'MY-03', 'MY-09', 'MY-11'))
# the country's real first-level divisions (the old ids above are aliases in region.json "groups")
U.admin1('THA', 'th_')
U.write(OUT)
