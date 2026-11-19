# 《大航海》Voyage — original composition for this project, CC0.
# G minor passacaglia, 3/4: a four-bar ground bass (G F Eb D) with harpsichord and string variations.
import os, importlib.util
_s = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(__file__), '_common.py')); c = importlib.util.module_from_spec(_s); _s.loader.exec_module(c)
TITLE = 'Voyage (大航海)'
BPM = 72
GAIN = {'harpsichord': 0.55, 'cello': 0.7, 'contrabass': 0.5, 'violin': 0.55, 'oboe': 0.5, 'string_ensemble_1': 0.4, 'bassoon': 0.55}
RELEASE = {'harpsichord': 0.7, 'string_ensemble_1': 0.9}
GROUND = [('G2', 'Gm'), ('F2', 'F'), ('Eb2', 'Eb'), ('D2', 'D')]
CH = {'Gm': ['G3', 'Bb3', 'D4'], 'F': ['F3', 'A3', 'C4'], 'Eb': ['Eb3', 'G3', 'Bb3'], 'D': ['D3', 'F#3', 'A3']}
VARS = [
    c.parse('D5:2 Bb4:1 C5:2 A4:1 Bb4:1.5 G4:.5 C5:1 A4:2 F#4:1'),
    c.parse('G5:1 F5:.5 Eb5:.5 D5:1 F5:1 Eb5:.5 D5:.5 C5:1 Eb5:1 D5:.5 C5:.5 Bb4:1 A4:1 Bb4:.5 C5:.5 D5:1'),
    c.parse('Bb4:.5 C5:.5 D5:.5 Eb5:.5 F5:.5 D5:.5 A4:.5 Bb4:.5 C5:.5 D5:.5 Eb5:.5 C5:.5 G4:.5 A4:.5 Bb4:.5 C5:.5 D5:.5 Bb4:.5 F#4:.5 G4:.5 A4:.5 Bb4:.5 C5:.5 A4:.5'),
    c.parse('D5:3 C5:3 Bb4:2 G4:1 A4:3'),
    c.parse('G5:1.5 A5:.5 Bb5:1 A5:1 G5:.5 F5:.5 Eb5:1 G5:1 F5:.5 Eb5:.5 D5:1 C5:1 Bb4:.5 A4:.5 Bb4:1 A4:3'),
]

def events():
    ev = []
    def cycle(bar, hc=.45, strings=0.0, bass=.5, cello=0.0, bassoon=0.0):
        for i, (root, ch) in enumerate(GROUND):
            b0 = (bar + i) * 3
            ev.append((b0, 'contrabass', root, 3, bass, 0, True))
            if cello: ev.append((b0, 'cello', c.tr(root, 12), 3, cello, -.2, True))
            if bassoon: ev.append((b0, 'bassoon', c.tr(root, 12), 3, bassoon, -.25, True))
            if hc:
                for t in (0, 1, 2):
                    for nn in CH[ch]: ev.append((b0 + t, 'harpsichord', nn, .9, hc * (1 if t == 0 else .7), .25, False))
            if strings:
                for nn in CH[ch]: ev.append((b0, 'string_ensemble_1', c.tr(nn, 12), 3, strings, 0, True))
    bar = 0
    cycle(bar, hc=.4, cello=.5); bar += 4
    cycle(bar, hc=.45); c.line(ev, bar * 3, VARS[0], 'violin', .5, .2); bar += 4
    cycle(bar, hc=.45, cello=.35); c.line(ev, bar * 3, VARS[1], 'violin', .55, .2); bar += 4
    cycle(bar, hc=.5, strings=.15); c.line(ev, bar * 3, VARS[0], 'oboe', .5, -.15); bar += 4
    cycle(bar, hc=.5, strings=.18, bassoon=.35); c.line(ev, bar * 3, VARS[2], 'violin', .5, .2); bar += 4
    cycle(bar, hc=.45, strings=.2); c.line(ev, bar * 3, VARS[3], 'oboe', .5, -.1); c.line(ev, bar * 3, VARS[3], 'violin', .4, .25, shift=-12); bar += 4
    cycle(bar, hc=.5, strings=.22, cello=.4); c.line(ev, bar * 3, VARS[4], 'violin', .55, .2); bar += 4
    cycle(bar, hc=.55, strings=.25, bassoon=.35); c.line(ev, bar * 3, VARS[1], 'oboe', .5, -.15); c.line(ev, bar * 3, VARS[2], 'violin', .45, .25); bar += 4
    cycle(bar, hc=.5, strings=.25, cello=.45); c.line(ev, bar * 3, VARS[4], 'violin', .55, .2); c.line(ev, bar * 3, VARS[0], 'oboe', .4, -.2); bar += 4
    cycle(bar, hc=.4, strings=.18); c.line(ev, bar * 3, VARS[3], 'violin', .45, .2); bar += 4
    for nn in ('G2', 'G3', 'Bb3', 'D4'): ev.append((bar * 3, 'string_ensemble_1' if nn != 'G2' else 'contrabass', nn, 4, .35, 0, True))
    for nn in CH['Gm']: ev.append((bar * 3, 'harpsichord', nn, 2, .5, .25, False))
    return ev
