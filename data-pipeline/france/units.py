#!/usr/bin/env python3
"""
France-mode units (843–2026): groups of today's departments (Natural Earth 1:10m admin-1) that follow the old
provinces and fit inside both the 22 regions of 1982 and the 13 regions of 2016, plus Belgium and the left bank
of the Rhine (French 1795–1814).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {
  'idf': '75 77 78 91 92 93 94 95', 'picardie': '02 60 80', 'artois': '62', 'flandre': '59',
  'champagne': '08 10 51 52', 'lorraine': '54 55 88', 'moselle': '57', 'alsace': '67 68', 'belfort': '90',
  'fcomte': '25 39 70', 'bourgogne': '21 58 71 89', 'lyonnais': '69 42', 'ain': '01', 'dauphine': '38 26',
  'hautes_alpes': '05', 'savoie': '73 74', 'nice': '06', 'provence': '13 83 04', 'vaucluse': '84',
  'vivarais': '07', 'velay': '43', 'auvergne': '63 15 03', 'languedoc': '30 34 11 48', 'toulouse': '31 81',
  'roussillon': '66', 'foix': '09', 'gascogne': '32 65', 'quercy': '46 12 82', 'bearn': '64', 'landes': '40',
  'guyenne': '33 24 47', 'limousin': '87 23 19', 'poitou': '86 79 17 16', 'vendee': '85', 'nantes': '44',
  'bretagne': '22 29 35 56', 'anjou_maine': '49 53 72', 'touraine': '37', 'berry': '18 36', 'orleanais': '45 41 28',
  'hnormandie': '27 76', 'bnormandie': '14 50 61', 'corse': '2A 2B',
}
for k, v in G.items(): U.put(k, U.a1(*['FR-' + c for c in v.split()]))
U.put('belgique', U.a0('BEL'))
U.put('rhenanie', U.a1('DE-RP', 'DE-SL'))
U.write(OUT)
