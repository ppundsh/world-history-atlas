#!/usr/bin/env python3
"""
US-mode units (1607–2026): today's states and the District of Columbia (Natural Earth 1:10m admin-1).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
for c in sorted(k for k in U.A1 if k.startswith('US-')):
    U.put(c.replace('US-', ''), U.a1(c))
U.write(OUT)
