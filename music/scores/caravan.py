# 《沙漠商隊》Caravan — original composition for this project, CC0.
# E Phrygian dominant (Hijaz: E F G# A B C D), 4/4: oboe like a reed pipe, dulcimer like a santur,
# drone, and a doum–tek drum pattern.
import os, importlib.util
_s = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(__file__), '_common.py')); c = importlib.util.module_from_spec(_s); _s.loader.exec_module(c)
TITLE = 'Caravan (沙漠商隊)'
BPM = 96
GAIN = {'oboe': 0.6, 'dulcimer': 0.55, 'contrabass': 0.55, 'taiko_drum': 0.7, 'string_ensemble_1': 0.4, 'sitar': 0.5, 'cello': 0.6, 'flute': 0.5}
RELEASE = {'dulcimer': 1.1, 'taiko_drum': 0.6, 'sitar': 1.4}
M1 = c.parse('E5:1 F5:.5 G#5:.5 A5:2 G#5:1 F5:.5 E5:.5 F5:2 E5:4 '
             'B4:1 C5:.5 D5:.5 E5:1 D5:1 C5:1.5 B4:.5 A4:1 G#4:1 A4:2 F4:1 G#4:1 E4:4')
M2 = c.parse('A5:1.5 B5:.5 C6:1 B5:1 A5:1 G#5:1 A5:2 F5:1 G#5:1 A5:1 B5:1 G#5:4 '
             'E5:1 F5:1 G#5:1 A5:1 B5:1.5 A5:.5 G#5:1 F5:1 E5:1 F5:1 D5:1 C5:1 B4:1 C5:.5 B4:.5 A4:1 G#4:1 E4:4')
SANTUR = ['E4', 'B4', 'G#4', 'B4', 'F4', 'B4', 'G#4', 'E5']

def events():
    ev = []
    def groove(bar, bars, drum=.6, santur=.4, drone=.25, bass=.4, sitar=0.0):
        for i in range(bars):
            b0 = (bar + i) * 4
            if drum:   # maqsum: doum . tek tek . doum . tek .
                for t, note, v in ((0, 'C3', 1), (1, 'D4', .55), (1.5, 'D4', .5), (2.5, 'C3', .8), (3, 'D4', .55)):
                    ev.append((b0 + t, 'taiko_drum', note, .5, drum * v, 0, False))
            if santur:
                for k, nn in enumerate(SANTUR):
                    ev.append((b0 + k * .5, 'dulcimer', nn, .5, santur * (1 if k % 4 == 0 else .7), .3, False))
            if drone and i % 2 == 0:
                for nn in ('E3', 'B3'): ev.append((b0, 'string_ensemble_1', nn, 8, drone, -.1, True))
            if bass:
                for t in (0, 2.5): ev.append((b0 + t, 'contrabass', 'E2', 1, bass, 0, True))
            if sitar and i % 2 == 1:
                ev.append((b0 + 3, 'sitar', 'E4', 1, sitar, -.3, False))
    bar = 0
    groove(bar, 4, drum=.5, santur=0, drone=.2, bass=0)
    c.line(ev, 0, c.parse('E4:2 F4:1 G#4:1 A4:3 G#4:1 F4:2 E4:6'), 'cello', .5, -.2); bar += 4
    groove(bar, 8, santur=.35); c.line(ev, bar * 4, M1, 'oboe', .55, -.1); bar += 8
    groove(bar, 8, santur=.4, sitar=.4); c.line(ev, bar * 4, M2, 'oboe', .55, -.1); bar += 8
    groove(bar, 8, drum=.7, santur=.45, sitar=.45); c.line(ev, bar * 4, M1, 'flute', .5, .2); c.line(ev, bar * 4, M1, 'oboe', .45, -.2, shift=-12); bar += 8
    groove(bar, 4, drum=.0, santur=.35, drone=.25, bass=0)
    c.line(ev, bar * 4, c.parse('B4:2 A4:1 G#4:1 F4:3 E4:1 F4:2 G#4:2 E4:4'), 'cello', .55, -.2); bar += 4
    groove(bar, 8, drum=.75, santur=.45, sitar=.45, bass=.5); c.line(ev, bar * 4, M2, 'oboe', .6, -.1); c.line(ev, bar * 4, M2, 'flute', .4, .25, shift=12); bar += 8
    groove(bar, 2, drum=.5, santur=.3, drone=.2)
    c.line(ev, bar * 4, c.parse('G#4:2 F4:2 E4:4'), 'oboe', .55, -.1); bar += 2
    ev.append((bar * 4, 'dulcimer', 'E4', 3, .5, .3, False)); ev.append((bar * 4, 'taiko_drum', 'C3', 1, .7, 0, False))
    ev.append((bar * 4, 'string_ensemble_1', 'E3', 4, .25, 0, True))
    return ev
