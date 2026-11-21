#!/usr/bin/env python3
"""
India-mode units (322 BCE–2026): today's Indian states and Pakistani provinces (Natural Earth 1:10m admin-1),
the north-east grouped, Afghanistan in three parts (east: Kabul and Gandhara's west; south: Kandahar and
Helmand, ancient Arachosia; north: Bactria), and Bangladesh, Nepal, Bhutan, Sri Lanka and Myanmar whole.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
for c in ['AP', 'BR', 'CT', 'DL', 'GA', 'HP', 'JH', 'JK', 'KA', 'LA', 'MH', 'MP', 'OR', 'RJ', 'SK', 'TG', 'UP', 'UT', 'WB', 'AS']:
    U.put('IN-' + c, U.a1('IN-' + c))
U.put('IN-PB', U.a1('IN-PB', 'IN-CH')); U.put('IN-HR', U.a1('IN-HR'))
U.put('IN-GJ', U.a1('IN-GJ', 'IN-DH')); U.put('IN-KL', U.a1('IN-KL', 'IN-LD')); U.put('IN-TN', U.a1('IN-TN', 'IN-PY'))
U.put('ne_india', U.a1('IN-ML', 'IN-TR', 'IN-MZ', 'IN-MN', 'IN-NL', 'IN-AR')); U.put('andaman', U.a1('IN-AN'))
for c in ['PB', 'SD', 'BA', 'GB', 'JK']: U.put('PK-' + c, U.a1('PK-' + c))
U.put('PK-KP', U.a1('PK-KP', 'PK-TA', 'PK-IS'))
E = 'KAB NAN KNR LAG LOG PKA KHO PIA GHA WAR KAP PAR NUR'.split(); S = 'KAN HEL ZAB URU NIM FRA'.split()
U.put('afg_e', U.a1(*['AF-' + c for c in E])); U.put('afg_s', U.a1(*['AF-' + c for c in S]))
U.put('afg_n', U.a1where(lambda k: k.startswith('AF-') and k[3:] not in E + S))
for k in ['BGD', 'NPL', 'BTN', 'LKA', 'MMR']: U.put(k, U.a0(k))
U.write(OUT)
