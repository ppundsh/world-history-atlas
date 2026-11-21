#!/usr/bin/env python3
"""
PRC-mode units (1949–2026): today's provincial-level divisions (Natural Earth 1:10m admin-1), Taiwan, Hong Kong
and Macau. Cuts: zhoushan (held by the ROC until May 1950), chamdo (eastern Tibet, taken in October 1950),
sc_w (western Sichuan, the Xikang province 1950–1955).
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units, box
NE, OUT = sys.argv[1:3]
U = Units(NE)
for c in ['CN-AH', 'CN-BJ', 'CN-CQ', 'CN-FJ', 'CN-GD', 'CN-GS', 'CN-GX', 'CN-GZ', 'CN-HA', 'CN-HB', 'CN-HE', 'CN-HI', 'CN-HL', 'CN-HN',
          'CN-JL', 'CN-JS', 'CN-JX', 'CN-LN', 'CN-NM', 'CN-NX', 'CN-QH', 'CN-SD', 'CN-SH', 'CN-SN', 'CN-SX', 'CN-TJ', 'CN-XJ', 'CN-YN']:
    U.put(c, U.a1(c))
U.cut('CN-ZJ', U.a1('CN-ZJ'), [('zhoushan', box(121.85, 29.5, 123.2, 30.9))])
U.cut('CN-XZ', U.a1('CN-XZ'), [('chamdo', box(95.0, 28.3, 99.5, 32.8))])
U.cut('CN-SC', U.a1('CN-SC'), [('sc_w', box(97.0, 26.0, 102.25, 34.5))])
U.put('TW', U.a0('TWN'))
U.put('HK', U.a0('HKG'))
U.put('MO', U.a0('MAC'))
U.write(OUT)
