# 《吟遊》Troubadour — original composition for this project, CC0.
# D Dorian, 3/4 dance: recorder and fiddle tunes over harp, lute-like guitar and a soft drum.
import os, importlib.util
_s = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(__file__), '_common.py')); c = importlib.util.module_from_spec(_s); _s.loader.exec_module(c)
TITLE = 'Troubadour (吟遊)'
BPM = 112
GAIN = {'recorder': 0.6, 'violin': 0.55, 'orchestral_harp': 0.6, 'acoustic_guitar_nylon': 0.65, 'taiko_drum': 0.6, 'contrabass': 0.5, 'dulcimer': 0.5, 'string_ensemble_1': 0.35}
RELEASE = {'orchestral_harp': 1.2, 'acoustic_guitar_nylon': 0.9, 'dulcimer': 1.0, 'taiko_drum': 0.8}
CH = {'Dm': ['D3', 'A3', 'D4', 'F4'], 'C': ['C3', 'G3', 'C4', 'E4'], 'G': ['G2', 'D3', 'G3', 'B3'], 'F': ['F2', 'C3', 'F3', 'A3'], 'Am': ['A2', 'E3', 'A3', 'C4']}
T1 = c.parse('D5:1 E5:.5 F5:.5 E5:1 D5:2 A4:1 C5:1 D5:1 E5:1 F5:2 - :1 '
             'G5:1 F5:1 E5:1 D5:1.5 C5:.5 A4:1 C5:1 B4:1 G4:1 A4:3 '
             'D5:1 E5:.5 F5:.5 E5:1 D5:2 A4:1 C5:1 D5:1 E5:1 F5:1.5 E5:.5 D5:1 '
             'E5:1 C5:1 A4:1 G4:1.5 A4:.5 B4:1 C5:1 B4:1 G4:1 D5:3')
T2 = c.parse('A5:2 G5:1 F5:1 E5:1 D5:1 C5:1.5 D5:.5 E5:1 A4:3 '
             'F5:2 E5:1 D5:1 C5:1 A4:1 B4:1 C5:1 D5:1 E5:3 '
             'A5:2 G5:1 F5:1 G5:1 A5:1 G5:1 E5:1 C5:1 D5:1.5 E5:.5 F5:1 '
             'E5:1 D5:1 C5:1 A4:1 C5:1 E5:1 D5:3 D5:3')
P1 = ['Dm', 'C', 'Dm', 'Am', 'Dm', 'C', 'G', 'Dm'] * 2
P2 = ['F', 'C', 'Dm', 'Am', 'F', 'G', 'Am', 'Dm', 'F', 'C', 'Dm', 'G', 'C', 'Am', 'Dm', 'Dm']

def events():
    ev = []
    def accomp(bar, prog, harp=.45, guitar=.4, drum=.3, bass=.35, drone=0.0):
        for i, ch in enumerate(prog):
            b0 = (bar + i) * 3
            notes = CH[ch]
            if harp:
                for k, t in enumerate((0, .5, 1, 1.5, 2, 2.5)):
                    ev.append((b0 + t, 'orchestral_harp', notes[[0, 1, 2, 3, 2, 1][k]], .8, harp * (1 if k == 0 else .7), -.3, False))
            if guitar:
                for t in (1, 2):
                    for nn in notes[1:]:
                        ev.append((b0 + t, 'acoustic_guitar_nylon', nn, .9, guitar * .6, .3, False))
            if bass: ev.append((b0, 'contrabass', c.tr(notes[0], -12 if notes[0][-1] != '2' else 0), 2.5, bass, 0, True))
            if drum:
                for t, v in ((0, 1), (1.5, .45), (2, .6)):
                    ev.append((b0 + t, 'taiko_drum', 'D4', .5, drum * v, .1, False))
            if drone:
                for nn in notes[:2]: ev.append((b0, 'string_ensemble_1', nn, 3, drone, 0, True))
    bar = 0
    accomp(bar, ['Dm', 'C', 'Dm', 'Dm'], harp=.5, guitar=0, drum=0, bass=0); bar += 4
    accomp(bar, P1, drum=.25); c.line(ev, bar * 3, T1, 'recorder', .6, -.1); bar += 16
    accomp(bar, P2, drum=.35, drone=.12); c.line(ev, bar * 3, T2, 'violin', .55, .15); bar += 16
    accomp(bar, P1, drum=.4, guitar=.5); c.line(ev, bar * 3, T1, 'recorder', .55, -.15); c.line(ev, bar * 3, T1, 'dulcimer', .4, .3, sus=False, shift=-12); bar += 16
    accomp(bar, P2, drum=.45, drone=.15, guitar=.5); c.line(ev, bar * 3, T2, 'violin', .5, .2); c.line(ev, bar * 3, T2, 'recorder', .45, -.2, shift=-12); bar += 16
    accomp(bar, ['Dm', 'C', 'G', 'Dm'], drum=.2, guitar=.3, drone=.12)
    c.line(ev, bar * 3, c.parse('A4:3 G4:3 B4:3 D5:3'), 'recorder', .5, -.1); bar += 4
    for nn in CH['Dm']: ev.append((bar * 3, 'orchestral_harp', nn, 3, .5, 0, False))
    ev.append((bar * 3, 'contrabass', 'D2', 3, .4, 0, True))
    return ev
