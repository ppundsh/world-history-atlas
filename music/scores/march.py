# 《帝國行進》March of Empires — original composition for this project, CC0.
# D major, 4/4: horn fanfare, string chords, timpani, trumpet in the climax.
import os, importlib.util
_s = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(__file__), '_common.py')); c = importlib.util.module_from_spec(_s); _s.loader.exec_module(c)
TITLE = 'March of Empires (帝國行進)'
BPM = 84
GAIN = {'french_horn': 0.8, 'trumpet': 0.55, 'string_ensemble_1': 0.5, 'timpani': 0.9, 'contrabass': 0.6, 'cello': 0.7, 'violin': 0.55}
RELEASE = {'timpani': 1.4, 'string_ensemble_1': 0.9, 'french_horn': 0.6}
CH = {'D': ['D3', 'F#3', 'A3', 'D4'], 'G': ['D3', 'G3', 'B3', 'D4'], 'A': ['E3', 'A3', 'C#4', 'E4'], 'Bm': ['D3', 'F#3', 'B3', 'D4'],
      'Em': ['E3', 'G3', 'B3', 'E4'], 'F#m': ['C#3', 'F#3', 'A3', 'C#4'], 'A7': ['E3', 'G3', 'C#4', 'E4'], 'Bb': ['D3', 'F3', 'Bb3', 'D4']}
ROOT = {'D': 'D2', 'G': 'G2', 'A': 'A2', 'Bm': 'B2', 'Em': 'E2', 'F#m': 'F#2', 'A7': 'A2', 'Bb': 'Bb2'}
FAN = c.parse('A3:.5 D4:.5 F#4:1 A4:2 - :0 A4:.5 A4:.5 B4:.5 A4:.5 F#4:1 D4:1')
A = c.parse('D4:1.5 E4:.5 F#4:1 D4:1 A4:2 F#4:1 D4:1 G4:1.5 F#4:.5 E4:1 D4:1 E4:3 - :1 '
            'F#4:1.5 G4:.5 A4:1 F#4:1 B4:2 A4:1 G4:1 F#4:1 E4:1 D4:1 E4:1 D4:3 - :1')
B = c.parse('B4:2 A4:1 G4:1 F#4:2 E4:1 D4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 - :1 '
            'C#5:2 B4:1 A4:1 B4:1.5 A4:.5 G4:1 F#4:1 G4:1 E4:1 C#4:1 E4:1 A4:3 - :1')
PA = ['D', 'A', 'G', 'A', 'D', 'G', 'A7', 'D']
PB = ['G', 'D', 'A', 'D', 'F#m', 'Bm', 'Em', 'A']

def events():
    ev = []
    def chords(bar, prog, vel=0.35, timp=0.0, bass=0.4, march=True):
        for i, ch in enumerate(prog):
            b0 = (bar + i) * 4
            for k, note in enumerate(CH[ch]):
                if march:      # string chords on 1 and 3, short on 2 and 4
                    for t, d, v in ((0, 1.6, 1), (2, 1.6, .9)):
                        ev.append((b0 + t, 'string_ensemble_1', note, d, vel * v, -0.3 + 0.2 * k, True))
                else:
                    ev.append((b0, 'string_ensemble_1', note, 4, vel, -0.3 + 0.2 * k, True))
            ev.append((b0, 'contrabass', ROOT[ch], 1.5, bass, 0, True))
            ev.append((b0 + 2, 'contrabass', c.tr(ROOT[ch], 7), 1.5, bass * .8, 0, True))
            if timp:
                for t, v in ((0, 1), (2, .6), (3.5, .45)):
                    ev.append((b0 + t, 'timpani', c.tr(ROOT[ch], 12) if ch in ('D', 'A', 'A7') else 'D3', 1, timp * v, 0, False))
    bar = 0
    chords(0, ['D', 'D', 'A', 'D'], vel=.2, timp=.8, march=False)
    c.line(ev, 0, FAN, 'french_horn', .8, -.2); c.line(ev, 8, FAN, 'french_horn', .85, -.2, shift=-5)
    bar = 4
    chords(bar, PA, timp=.35); c.line(ev, bar * 4, A, 'french_horn', .7, -.15); bar += 8
    chords(bar, PB, timp=.25, vel=.38); c.line(ev, bar * 4, B, 'violin', .6, .2); c.line(ev, bar * 4, B, 'cello', .45, -.3, shift=-12); bar += 8
    chords(bar, PA, timp=.55, vel=.42, bass=.5); c.line(ev, bar * 4, A, 'french_horn', .75, -.2); c.line(ev, bar * 4, A, 'trumpet', .45, .25, shift=12); bar += 8
    chords(bar, ['Bm', 'G', 'Em', 'A', 'Bb', 'A', 'G', 'A7'], timp=.3, vel=.34, march=False)
    c.line(ev, bar * 4, c.parse('F#4:4 D4:4 G4:4 E4:4 F4:4 E4:4 D4:2 B3:2 C#4:4'), 'cello', .6, -.2); bar += 8
    chords(bar, PB, timp=.6, vel=.45, bass=.55); c.line(ev, bar * 4, B, 'trumpet', .5, .15); c.line(ev, bar * 4, B, 'french_horn', .55, -.25, shift=-12); bar += 8
    chords(bar, PA, timp=.7, vel=.48, bass=.6); c.line(ev, bar * 4, A, 'french_horn', .8, -.2); c.line(ev, bar * 4, A, 'trumpet', .5, .25, shift=12); bar += 8
    chords(bar, ['D', 'G', 'A7', 'D'], timp=.9, vel=.5, march=False)
    c.line(ev, bar * 4, FAN, 'trumpet', .6, .2); c.line(ev, bar * 4 + 8, c.parse('A4:2 F#4:2 D4:4'), 'french_horn', .8, -.2); bar += 4
    for note in CH['D']: ev.append((bar * 4, 'string_ensemble_1', note, 4, .45, 0, True))
    ev.append((bar * 4, 'timpani', 'D3', 2, .9, 0, False)); ev.append((bar * 4, 'contrabass', 'D2', 4, .6, 0, True))
    ev.append((bar * 4, 'french_horn', 'D4', 4, .8, -.2, True))
    return ev
