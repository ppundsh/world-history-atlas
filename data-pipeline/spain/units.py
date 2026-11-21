#!/usr/bin/env python3
"""
Spain-mode units (711–2026): groups of today's Spanish provinces (Natural Earth 1:10m admin-1) following the
medieval kingdoms and the fronts of the Civil War, Portugal's districts in five bands, Roussillon (French
department 66) and Gibraltar.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'asturias': 'O', 'cantabria': 'S', 'galicia': 'C LU OR PO', 'leon': 'LE ZA', 'salamanca': 'SA', 'castilla_n': 'BU P VA SO SG AV',
     'basque': 'BI SS VI', 'navarra': 'NA', 'rioja': 'LO', 'aragon': 'HU Z TE', 'cat_old': 'B GI', 'cat_new': 'L T',
     'valencia': 'CS V A', 'murcia': 'MU', 'madrid': 'M', 'castilla_s': 'TO GU CU AB CR', 'extremadura': 'CC BA',
     'cordoba': 'CO', 'jaen': 'J', 'sevilla': 'SE H CA', 'granada': 'GR AL MA', 'baleares': 'PM', 'canarias': 'GC TF', 'ceuta': 'CE ML'}
for k, v in G.items(): U.put(k, U.a1(*['ES-' + c for c in v.split()]))
P = {'pt_norte': '16 03 13 17 04', 'pt_centro': '01 18 09 06 10 05', 'pt_lisboa': '11 14 15', 'pt_alentejo': '12 07 02', 'pt_algarve': '08'}
for k, v in P.items(): U.put(k, U.a1(*['PT-' + c for c in v.split()]))
U.put('roussillon', U.a1('FR-66')); U.put('gibraltar', U.a0('GIB'))
U.write(OUT)
