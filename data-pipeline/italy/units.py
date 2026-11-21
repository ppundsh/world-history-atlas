#!/usr/bin/env python3
"""
Italy-mode units (1454–2026): groups of today's Italian provinces (Natural Earth 1:10m admin-1) following the
old states — e.g. milano (the Duchy of Milan's core), venlomb (Bergamo and Brescia, Venetian until 1797),
mantova, valtellina (Sondrio, Grisons 1512–1797), parma (Parma, Piacenza), modena (Modena, Reggio), ferrara,
romagna (Bologna and Romagna), lucca, siena (Siena, Grosseto) — plus Savoy, Nice and Corsica (French
departments), Istria, Rijeka (Fiume) and Dalmatia (Croatian counties) and Malta.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'aosta': 'AO', 'piemonte': 'AL AT BI CN NO TO VB VC', 'liguria': 'GE IM SP SV', 'milano': 'MI MB VA CO LC LO PV CR',
     'valtellina': 'SO', 'venlomb': 'BG BS', 'mantova': 'MN', 'trento': 'TN', 'sudtirol': 'BZ', 'veneto': 'BL PD RO TV VE VI VR',
     'friuli': 'PN UD', 'gorizia': 'GO TS', 'parma': 'PC PR', 'modena': 'MO RE', 'ferrara': 'FE', 'romagna': 'BO FC RA RN',
     'lucca': 'LU', 'toscana': 'AR FI LI MS PI PO PT', 'siena': 'SI GR', 'umbria': 'PG TR', 'marche': 'AN AP FM MC PU',
     'lazio': 'FR LT RI RM VT', 'abruzzo': 'AQ CH PE TE CB IS', 'campania': 'AV BN CE NA SA', 'puglia': 'BA BR BT FG LE TA',
     'basilicata': 'MT PZ', 'calabria': 'CS CZ KR RC VV', 'sicilia': 'AG CL CT EN ME PA RG SR TP', 'sardegna': 'CA CI NU OG OR OT SS VS'}
for k, v in G.items(): U.put(k, U.a1(*['IT-' + c for c in v.split()]))
U.put('savoy', U.a1('FR-73', 'FR-74')); U.put('nice', U.a1('FR-06')); U.put('corsica', U.a1('FR-2A', 'FR-2B'))
U.put('istria', U.a1('HR-18')); U.put('fiume', U.a1('HR-08')); U.put('dalmatia', U.a1('HR-13', 'HR-15', 'HR-17', 'HR-19'))
U.put('malta', U.a0('MLT'))
U.write(OUT)
