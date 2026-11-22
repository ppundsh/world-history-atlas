#!/usr/bin/env python3
"""
Brazil-mode units (1500–2026): one unit per state and the Federal District (Natural Earth 1:10m admin-1), so the
administrative layer shows the real states; the old captaincy groups are aliases in region.json. With Uruguay
(the Cisplatine Province, 1817–1828).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
for c in 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split():
    U.put('br_' + c.lower(), U.a1('BR-' + c))
U.put('uruguay', U.a0('URY'))
U.write(OUT)
