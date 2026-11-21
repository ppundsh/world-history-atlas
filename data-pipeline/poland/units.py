#!/usr/bin/env python3
"""
Poland-mode units (966–2026): today's Polish voivodeships, Lithuanian counties, Belarusian regions and western
and central Ukrainian oblasts (Natural Earth 1:10m admin-1), Latvia in three bands (Courland, Livonia, Latgale),
Smolensk and Kaliningrad. Cuts: warmia (the Prince-Bishopric of Warmia, central Warmian-Masurian) / masuria;
lt_vilnius (Vilnius and Utena counties, Polish 1920–1939); memel (Klaipėda county).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units, box
NE, OUT = sys.argv[1:3]
U = Units(NE)
for c in ['PL-DS', 'PL-KP', 'PL-LB', 'PL-LD', 'PL-LU', 'PL-MA', 'PL-MZ', 'PL-OP', 'PL-PD', 'PL-PK', 'PL-PM', 'PL-SK', 'PL-SL', 'PL-WP', 'PL-ZP']:
    U.put(c, U.a1(c))
U.cut('masuria', U.a1('PL-WN'), [('warmia', box(19.8, 53.5, 21.0, 54.45))])
U.put('memel', U.a1('LT-KL'))
U.put('lt_vilnius', U.a1('LT-VL', 'LT-UT'))
U.put('lt_samogitia', U.a1('LT-TE', 'LT-SA', 'LT-TA'))
U.put('lt_kaunas', U.a1('LT-KU', 'LT-MR', 'LT-PN', 'LT-AL'))
for c in ['BY-BR', 'BY-HO', 'BY-HR', 'BY-MA', 'BY-VI']: U.put(c, U.a1(c))
U.put('BY-MI', U.a1('BY-MI', 'BY-HM'))
for c in ['UA-05', 'UA-07', 'UA-18', 'UA-26', 'UA-46', 'UA-53', 'UA-56', 'UA-61', 'UA-68', 'UA-71', 'UA-74']: U.put(c, U.a1(c))
U.put('UA-32', U.a1('UA-32', 'UA-30'))
lv = U.a0('LVA')
U.cut('livonia', lv, [('courland', box(20, 55.5, 23.7, 58)), ('latgale', box(26.1, 55.5, 29, 58))])
U.put('smolensk', U.a1('RU-SMO'))
U.put('kgd', U.a1('RU-KGD'))
U.write(OUT)
