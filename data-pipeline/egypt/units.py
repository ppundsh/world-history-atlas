#!/usr/bin/env python3
"""
Egypt-mode units (3100 BCE–2026): groups of today's governorates (Natural Earth 1:10m admin-1) along the Nile
(Delta, Memphis, Middle and Upper Egypt, Aswan), the deserts, Sinai and the canal; Nubia (Kush) and central Sudan;
Canaan (Israel, Palestine, Lebanon) and Cyrenaica, which Egypt's rulers often held.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'alex': 'ALX BH', 'delta_w': 'GH KFS MNF', 'delta_e': 'DK DT SHR', 'memphis': 'C GZ KB', 'canal': 'PTS IS SUZ',
     'fayyum': 'FYM BNS', 'middle': 'MN AST', 'thebes': 'SHG KN LX', 'aswan': 'ASN', 'redsea': 'BA', 'oases': 'WAD',
     'marmarica': 'MT', 'sinai': 'SIN JS'}
for k, v in G.items(): U.put(k, U.a1(*['EG-' + c for c in v.split()]))
U.put('nubia', U.a1('SD-NO', 'SD-NR'))
U.put('sennar', U.a1('SD-KH', 'SD-GZ', 'SD-NW', 'SD-SI', 'SD-NB', 'SD-GD', 'SD-KA', 'SD-RS'))
U.put('canaan', U.a0('ISR', 'PSX', 'LBN') if 'PSX' in U.A0 else U.a0('ISR', 'LBN'))
U.put('cyrenaica', U.a1('LY-BU', 'LY-JA', 'LY-MJ', 'LY-QB', 'LY-BA', 'LY-AJ'))
U.write(OUT)
