#!/usr/bin/env python3
"""
Brazil-mode units (1500–2026): groups of today's states (Natural Earth 1:10m admin-1) by the old captaincies,
with Acre (Bolivian until 1903) and Uruguay (the Cisplatine Province, 1817–1828).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'bahia': 'BA SE', 'pernambuco': 'PE AL PB RN', 'ceara': 'CE PI', 'maranhao': 'MA', 'para': 'PA AP', 'amazonas': 'AM RR', 'acre': 'AC',
     'rondonia': 'RO', 'mato_grosso': 'MT MS', 'goias': 'GO DF TO', 'minas': 'MG', 'rio': 'RJ ES', 'sao_paulo': 'SP', 'parana': 'PR SC', 'rio_grande': 'RS'}
for k, v in G.items(): U.put(k, U.a1(*['BR-' + c for c in v.split()]))
U.put('uruguay', U.a0('URY'))
U.write(OUT)
