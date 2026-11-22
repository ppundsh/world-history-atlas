#!/usr/bin/env python3
"""
Mexico-mode units (1428–2026): groups of today's states (Natural Earth 1:10m admin-1) by the old lands of
Mesoamerica and New Spain, with Texas, California and the US South-west (Mexican until 1836/1848), Guatemala and
the rest of Central America (part of New Spain).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'valle': 'DIF MEX MOR HID', 'tlaxcala': 'TLA', 'puebla': 'PUE', 'veracruz': 'VER', 'oaxaca': 'OAX', 'guerrero': 'GRO',
     'michoacan': 'MIC', 'jalisco': 'JAL COL NAY AGU', 'bajio': 'GUA QUE', 'zacatecas': 'SLP ZAC', 'north_e': 'NLE TAM COA',
     'north_w': 'CHH DUR SIN SON', 'baja': 'BCN BCS', 'tabasco': 'TAB CAM', 'yucatan': 'YUC ROO', 'chiapas': 'CHP'}
for k, v in G.items(): U.put(k, U.a1(*['MX-' + c for c in v.split()]))
U.put('texas', U.a1('US-TX')); U.put('california', U.a1('US-CA'))
U.put('southwest', U.a1('US-NM', 'US-AZ', 'US-NV', 'US-UT'))
U.put('guatemala', U.a0('GTM')); U.put('centam', U.a0('SLV', 'HND', 'NIC', 'CRI', 'BLZ'))
U.write(OUT)
