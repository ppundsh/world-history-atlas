#!/usr/bin/env python3
"""
Morocco-mode units (788–2026): Morocco's old regions (Natural Earth 1:10m admin-1) and Western Sahara, with the
rest of the Maghreb (Algeria in four parts, Tunisia) and al-Andalus (today's Andalusia), which the Moroccan
dynasties often ruled.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'tangier': '01', 'rif': '03 04', 'fes': '05 06', 'rabat': '02 07', 'casablanca': '08 09 10', 'marrakech': '11 12', 'souss': '13 14', 'sahara_n': '15 16'}
for k, v in G.items(): U.put(k, U.a1(*['MA-' + c for c in v.split()]))
if 'SAH' in U.A0: U.put('sahara_n', U.a0('SAH'))
D = {'oran': '13 31 46 22 20 29 27 48 45 32 14 38 02 44', 'algiers': '16 09 35 42 26 10 15 06 17 28 34 19',
     'constantine': '25 23 21 18 36 24 41 04 05 40 12 43 07', 'sahara_dz': '01 11 33 37 08 30 47 03 39'}
for k, v in D.items(): U.put(k, U.a1(*['DZ-' + c for c in v.split()]))
U.put('ifriqiya', U.a0('TUN'))
U.put('andalus', U.a1(*['ES-' + c for c in 'AL CA CO GR H J MA SE'.split()]))
# the country's real first-level divisions (the old ids above are aliases in region.json "groups")
U.admin1('MAR', 'ma_')
U.write(OUT)
