# 《絲路》Silk Road — original composition for this project, CC0.
# D minor pentatonic (D F G A C), 4/4: koto ostinato, shakuhachi melody, string drone, taiko.
TITLE = 'Silk Road (絲路)'
BPM = 70
GAIN = {'koto': 0.7, 'shakuhachi': 0.75, 'string_ensemble_1': 0.5, 'contrabass': 0.6, 'taiko_drum': 0.9, 'cello': 0.8, 'flute': 0.55}
RELEASE = {'koto': 1.5, 'taiko_drum': 1.2, 'string_ensemble_1': 1.2}

DRONES = {'D': ['D3', 'A3'], 'C': ['C3', 'G3'], 'F': ['F3', 'C4'], 'G': ['G2', 'D3'], 'A': ['A2', 'E3']}
KOTO = {  # one-bar ostinati, eighth notes
    'D': ['D4', 'A4', 'D5', 'A4', 'F4', 'A4', 'C5', 'A4'],
    'C': ['C4', 'G4', 'C5', 'G4', 'F4', 'G4', 'A4', 'G4'],
    'F': ['F4', 'C5', 'F5', 'C5', 'A4', 'C5', 'D5', 'C5'],
    'G': ['G3', 'D4', 'G4', 'D4', 'C4', 'D4', 'F4', 'D4'],
    'A': ['A3', 'E4', 'A4', 'E4', 'C4', 'E4', 'G4', 'E4'],
}
M1 = [[('A4', 3), ('G4', .5), ('F4', .5)], [('G4', 2), ('C5', 2)], [('A4', 1.5), ('G4', .5), ('F4', 1), ('D4', 1)], [('F4', 4)],
      [('D5', 3), ('C5', 1)], [('A4', 2), ('C5', 1), ('D5', 1)], [('C5', 1.5), ('A4', .5), ('G4', 1), ('F4', 1)], [('D4', 4)]]
M2 = [[('F5', 2), ('D5', 1), ('C5', 1)], [('D5', 3), ('A4', 1)], [('C5', 1), ('D5', 1), ('F5', 1), ('G5', 1)], [('A5', 4)],
      [('G5', 1.5), ('F5', .5), ('D5', 2)], [('C5', 2), ('A4', 2)], [('G4', 1), ('A4', 1), ('C5', 1), ('A4', 1)], [('D5', 4)]]
P1 = ['D', 'C', 'D', 'D', 'F', 'C', 'G', 'D']
P2 = ['F', 'D', 'C', 'A', 'G', 'F', 'C', 'D']

def events():
    ev = []
    bar = 0
    def accomp(prog, koto=0.4, drone=0.22, taiko=0.0, bass=0.3):
        nonlocal bar
        for i, c in enumerate(prog):
            b0 = (bar + i) * 4
            if drone:
                for k, n in enumerate(DRONES[c]):
                    ev.append((b0, 'string_ensemble_1', n, 4, drone, -0.2 + 0.4 * k, True))
            if bass:
                ev.append((b0, 'contrabass', DRONES[c][0][:-1] + str(int(DRONES[c][0][-1]) - 1), 3.5, bass, 0, True))
            if koto:
                for k, n in enumerate(KOTO[c]):
                    ev.append((b0 + k * 0.5, 'koto', n, 0.6, koto * (1 if k % 4 == 0 else 0.7), 0.35, False))
            if taiko:
                for t, v in ((0, 1.0), (1.5, 0.5), (2, 0.8), (3.5, 0.6)):
                    ev.append((b0 + t, 'taiko_drum', 'C3', 1, taiko * v, 0, False))
    def melody(m, inst, vel, shift=0, pan=-0.15):
        b = bar * 4
        for meas in m:
            for n, d in meas:
                nn = n if not shift else n[:-1] + str(int(n[-1]) + shift)
                ev.append((b, inst, nn, d, vel, pan, True))
                b += d
    accomp(['D', 'D', 'C', 'D'], koto=0.5, drone=0.12, bass=0); bar += 4                      # koto alone, drone enters
    accomp(P1); melody(M1, 'shakuhachi', 0.55); bar += 8
    accomp(P2, taiko=0.35); melody(M2, 'shakuhachi', 0.6); bar += 8
    accomp(P1, koto=0.3, drone=0.28); melody(M1, 'cello', 0.6, shift=-1, pan=0.2); bar += 8
    accomp(P2, taiko=0.55, drone=0.3, bass=0.4); melody(M2, 'flute', 0.5); melody(M2, 'shakuhachi', 0.45, shift=-1); bar += 8
    accomp(['D', 'C', 'G', 'D'], koto=0.45, drone=0.18, bass=0.25); melody([[('A4', 4)], [('G4', 4)], [('F4', 2), ('G4', 2)], [('D4', 4)]], 'shakuhachi', 0.45); bar += 4
    ev.append((bar * 4, 'koto', 'D4', 3, 0.5, 0.3, False)); ev.append((bar * 4, 'string_ensemble_1', 'D3', 4, 0.15, 0, True))
    return ev
