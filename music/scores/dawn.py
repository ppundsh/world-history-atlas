# 《黎明》Dawn — original composition for this project, CC0.
# C major, slow 4/4: choir and strings, harp arpeggios, flute and cello, bells at the close.
import os, importlib.util
_s = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(__file__), '_common.py')); c = importlib.util.module_from_spec(_s); _s.loader.exec_module(c)
TITLE = 'Dawn (黎明)'
BPM = 62
GAIN = {'choir_aahs': 0.5, 'string_ensemble_1': 0.45, 'orchestral_harp': 0.55, 'flute': 0.55, 'cello': 0.65, 'contrabass': 0.5, 'tubular_bells': 0.35, 'french_horn': 0.5}
RELEASE = {'choir_aahs': 1.6, 'string_ensemble_1': 1.6, 'orchestral_harp': 1.5, 'tubular_bells': 2.5}
CH = {'C': ['C3', 'G3', 'C4', 'E4'], 'Am': ['A2', 'E3', 'A3', 'C4'], 'F': ['F2', 'C3', 'F3', 'A3'], 'G': ['G2', 'D3', 'G3', 'B3'],
      'Em': ['E2', 'B2', 'E3', 'G3'], 'Dm': ['D3', 'A3', 'D4', 'F4'], 'Fm': ['F2', 'C3', 'F3', 'Ab3'], 'Gsus': ['G2', 'D3', 'G3', 'C4']}
P = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'Gsus', 'Am', 'F', 'C', 'G', 'F', 'Fm', 'C', 'C']
MEL = c.parse('E5:3 D5:1 C5:2 G4:2 A4:3 C5:1 B4:4 C5:3 D5:1 E5:2 G5:2 F5:4 D5:2 E5:1 D5:1 '
              'C5:3 B4:1 A4:2 E4:2 F4:2 A4:2 C5:2 D5:2 E5:4 D5:4 C5:3 D5:1 Ab4:4 G4:4 C5:4')

def events():
    ev = []
    def pad(bar, choir=.3, strings=.3, harp=.4, bass=.4):
        for i, ch in enumerate(P):
            b0 = (bar + i) * 4
            notes = CH[ch]
            if choir:
                for nn in notes[1:]: ev.append((b0, 'choir_aahs', nn, 4, choir, 0, True))
            if strings:
                for nn in notes: ev.append((b0, 'string_ensemble_1', c.tr(nn, 12), 4, strings * .7, -.1, True))
            if harp:
                for k, nn in enumerate(notes + [c.tr(notes[1], 12), c.tr(notes[2], 12), c.tr(notes[3], 12), c.tr(notes[2], 12)]):
                    ev.append((b0 + k * .5, 'orchestral_harp', nn, 1, harp * (1 if k == 0 else .6), .3, False))
            if bass: ev.append((b0, 'contrabass', c.tr(notes[0], -12) if notes[0][-1] != '2' else notes[0], 4, bass, 0, True))
    bar = 0
    pad(bar, choir=.18, strings=.0, harp=.45, bass=0); bar += 16
    pad(bar, choir=.25, strings=.25); c.line(ev, bar * 4, MEL, 'flute', .5, .15); bar += 16
    pad(bar, choir=.3, strings=.32, harp=.35, bass=.45); c.line(ev, bar * 4, MEL, 'cello', .55, -.2, shift=-12); c.line(ev, bar * 4 + 32, MEL[8:], 'french_horn', .4, -.1, shift=-12); bar += 16
    for k, nn in enumerate(('C5', 'G4', 'E4', 'C4')): ev.append((bar * 4 + k * 1.5, 'tubular_bells', nn, 4, .5, .1, False))
    for nn in CH['C']: ev.append((bar * 4, 'choir_aahs', nn, 6, .3, 0, True)); ev.append((bar * 4, 'string_ensemble_1', c.tr(nn, 12), 6, .25, 0, True))
    return ev
