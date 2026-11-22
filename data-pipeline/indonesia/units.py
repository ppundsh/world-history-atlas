#!/usr/bin/env python3
"""
Indonesia-mode units (671–2026): groups of today's provinces (Natural Earth 1:10m admin-1) by island and old
kingdom, with East Timor.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'aceh': 'AC', 'sumatra_n': 'SU SB RI KR', 'sumatra_s': 'JA SS BE LA BB', 'banten': 'BT JK', 'java_w': 'JB', 'java_c': 'JT YO', 'java_e': 'JI',
     'bali_nt': 'BA NB NT', 'kal_w': 'KB KT', 'kal_e': 'KS KI', 'sulawesi_s': 'SN SR SG', 'sulawesi_n': 'SA GO ST', 'maluku': 'MA MU', 'papua': 'PA PB'}
for k, v in G.items(): U.put(k, U.a1(*['ID-' + c for c in v.split()]))
U.put('timor_leste', U.a0('TLS'))
# the country's real first-level divisions (the old ids above are aliases in region.json "groups")
U.admin1('IDN', 'id_')
U.write(OUT)
