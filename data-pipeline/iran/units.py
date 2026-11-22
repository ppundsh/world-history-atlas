#!/usr/bin/env python3
"""
Iran-mode units (550 BCE–2026): groups of today's provinces (Natural Earth 1:10m admin-1) along the old lands of
Iran (Azerbaijan, Gilan, Tabaristan, Media, the centre, Khuzestan, Fars, Kerman, Sistan, Khorasan), and the
neighbours that Iranian empires often held: Mesopotamia (Iraq), the Caucasus (Azerbaijan, Armenia), Transoxiana
(Turkmenistan, Uzbekistan, Tajikistan) and Afghanistan.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'azarbaijan': '01 02 03 11', 'gilan': '19', 'tabaristan': '21 27', 'centre': '07 28 26 22 12', 'media': '24 17 16 20 05',
     'khuzestan': '10', 'isfahan': '04 08 18 25', 'fars': '14 06', 'kerman': '15 23', 'sistan': '13', 'khorasan': '30 31 29'}
for k, v in G.items(): U.put(k, U.a1(*['IR-' + c for c in v.split()]))
U.put('mesopotamia', U.a0('IRQ'))
U.put('caucasus', U.a0('AZE', 'ARM'))
U.put('transoxiana', U.a0('TKM', 'UZB', 'TJK'))
U.put('afghanistan', U.a0('AFG'))
U.write(OUT)
