#!/usr/bin/env python3
"""
Philippines-mode units (1521–2026): today's provinces (Natural Earth 1:10m admin-1) grouped into today's regions,
with Palawan, the Sulu archipelago, Lanao and the Cotabato basin kept apart for the sultanates' history.
  python3 units.py <NE geojson dir> <out.geojson>
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from regionkit import Units
NE, OUT = sys.argv[1:3]
U = Units(NE)
G = {'ilocos': 'ILN ILS LUN PAN', 'cordillera': 'ABR APA BEN IFU KAL MOU', 'cagayan': 'BTN CAG ISA NUV QUI',
     'c_luzon': 'AUR BAN BUL NUE PAM TAR ZMB', 'manila': 'MNL', 'calabarzon': 'BTG CAV LAG QUE RIZ',
     'mindoro': 'MAD MDC MDR ROM', 'palawan': 'PLW', 'bicol': 'ALB CAN CAS CAT MAS SOR',
     'w_visayas': 'AKL ANT CAP GUI ILI NEC BCD', 'c_visayas': 'BOH CEB NER SIG LAP MDE', 'e_visayas': 'BIL EAS LEY NSA SLE WSA',
     'zamboanga': 'ZAN ZAS ZSI', 'n_mindanao': 'BUK CAM LAN MSC MSR', 'davao': 'COM DAO DAS DAV', 'caraga': 'AGN AGS SUN SUR DIN',
     'lanao': 'LAS', 'cotabato': 'MAG NCO SUK SAR SCO', 'sulu': 'SLU TAW BAS'}
used = set()
for k, v in G.items():
    codes = ['PH-' + c for c in v.split() if 'PH-' + c in U.A1]; used |= set(codes)
    U.put(k, U.a1(*codes))
left = [k for k in U.A1 if k.startswith('PH-') and k not in used]
if left: print('unassigned:', left)
U.write(OUT)
