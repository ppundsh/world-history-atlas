#!/usr/bin/env python3
"""
UK-mode units (871–2026): England's regions, Wales, Scotland in three parts and Northern Ireland (Natural Earth
1:10m admin-1, grouped by its statistical regions), with the island of Ireland's southern part (today's Republic).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
from shapely.geometry import shape
from shapely.ops import unary_union
NE, OUT = sys.argv[1:3]
U = Units(NE)
R = {'North East': 'north_east', 'North West': 'north_west', 'Yorkshire and the Humber': 'yorkshire', 'East Midlands': 'east_midlands',
     'West Midlands': 'west_midlands', 'East': 'east', 'Greater London': 'london', 'South East': 'south_east', 'South West': 'south_west',
     'East Wales': 'wales', 'West Wales and the Valleys': 'wales', 'North Eastern': 'scotland_e', 'Eastern': 'scotland_e',
     'South Western': 'scotland_sw', 'Highlands and Islands': 'scotland_n', 'Northern Ireland': 'n_ireland'}
parts = {}
for f in json.load(open(os.path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'), encoding='utf-8'))['features']:
    p = f['properties']
    if p['adm0_a3'] != 'GBR': continue
    k = R.get(p.get('region') or '')
    if not k: print('no group for', p['name'], p.get('region')); continue
    parts.setdefault(k, []).append(shape(f['geometry']).buffer(0))
for k, gs in parts.items(): U.put(k, unary_union(gs))
U.put('ireland', U.a0('IRL'))
U.write(OUT)
