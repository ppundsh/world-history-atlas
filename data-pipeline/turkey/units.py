#!/usr/bin/env python3
"""
Turkey-mode units (1071–2026): groups of today's provinces (Natural Earth 1:10m admin-1) by the old lands of
Anatolia and Thrace, with Greece, Bulgaria, Syria and Cyprus, which the Ottomans held for centuries.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'thrace': '22 39 59', 'istanbul': '34', 'bithynia': '41 54 77 16 11', 'mysia': '17 10', 'ionia': '35 45', 'caria': '09 48 20',
     'phrygia': '03 43 64 32 15 26', 'antalya': '07', 'cilicia': '01 33 80', 'hatay': '31', 'konya': '42 70 68 51 50', 'ankara': '06 71 40 18',
     'cappadocia': '38 66 58', 'paphlagonia': '14 81 67 74 78 37 57', 'pontus': '55 05 19 60 52', 'trebizond': '61 28 53 08 29 69',
     'erzurum': '25 24 36 75 04 76', 'van': '65 13 49 30', 'diyarbakir': '21 72 56 73 47 12 62 23 44', 'urfa': '63 27 79 02 46'}
for k, v in G.items(): U.put(k, U.a1(*['TR-' + c for c in v.split()]))
U.put('greece', U.a0('GRC')); U.put('bulgaria', U.a0('BGR')); U.put('syria', U.a0('SYR')); U.put('cyprus', U.a0('CYP', 'CYN') if 'CYN' in U.A0 else U.a0('CYP'))
# the country's real first-level divisions (the old ids above are aliases in region.json "groups")
U.admin1('TUR', 'tr_')
U.write(OUT)
