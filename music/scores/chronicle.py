# 《編年》Chronicle — original composition for this project, CC0.
# A slow sarabande in D minor (3/4): harp, strings, cello, horn, timpani.
TITLE = 'Chronicle (編年)'
BPM = 62
GAIN = {'string_ensemble_1': 0.55, 'contrabass': 0.7, 'orchestral_harp': 0.6, 'violin': 0.75, 'cello': 0.9,
        'french_horn': 0.75, 'timpani': 0.8, 'choir_aahs': 0.35, 'flute': 0.6}
RELEASE = {'orchestral_harp': 1.2, 'timpani': 1.5, 'string_ensemble_1': 0.9, 'choir_aahs': 1.0}

CH = {
    'Dm': ('D2', ['D3', 'F3', 'A3', 'D4']), 'Gm': ('G1', ['D3', 'G3', 'Bb3', 'D4']), 'A': ('A1', ['E3', 'A3', 'C#4', 'E4']),
    'A7': ('A1', ['E3', 'G3', 'C#4', 'E4']), 'F': ('F2', ['C3', 'F3', 'A3', 'C4']), 'C': ('C2', ['C3', 'E3', 'G3', 'C4']),
    'Bb': ('Bb1', ['D3', 'F3', 'Bb3', 'D4']), 'Am': ('A1', ['C3', 'E3', 'A3', 'C4']),
}
UP = {'1': '2', '2': '3', '3': '4', '4': '5', '5': '6'}
def up(n, k=1):
    for _ in range(k):
        n = n[:-1] + UP[n[-1]]
    return n

# melodies: per bar a list of (note, beats); 'r' = rest
A1 = [[('D5', 1), ('F5', 1.5), ('E5', .5)], [('D5', 1), ('G5', 1.5), ('F5', .5)], [('E5', 1), ('C#5', 1.5), ('D5', .5)], [('A4', 3)],
      [('C5', 1), ('F5', 1.5), ('E5', .5)], [('E5', 1), ('G5', 1.5), ('F5', .5)], [('D5', 1), ('F5', 1), ('E5', .5), ('D5', .5)], [('C#5', 2), ('A4', 1)]]
A2 = [[('D5', 1), ('A5', 1.5), ('G5', .5)], [('F5', 1), ('Bb5', 1.5), ('A5', .5)], [('G5', 1), ('E5', 1.5), ('F5', .5)], [('A5', 1), ('F5', 2)],
      [('D5', 1), ('F5', 1), ('Bb5', 1)], [('Bb5', 1), ('A5', 1), ('G5', 1)], [('E5', 1), ('G5', 1), ('C#5', 1)], [('D5', 3)]]
B = [[('A3', 1), ('C4', 1.5), ('Bb3', .5)], [('G3', 1), ('E4', 1.5), ('D4', .5)], [('F4', 1), ('D4', 1.5), ('E4', .5)], [('C4', 1), ('E4', 2)],
     [('D4', 1), ('F4', 1.5), ('E4', .5)], [('C4', 1), ('A3', 2)], [('Bb3', 1), ('D4', 1), ('G4', 1)], [('E4', 1), ('C#4', 1), ('A3', 1)]]
C = [[('A5', 1), ('D6', 1.5), ('C6', .5)], [('Bb5', 1), ('F5', 1.5), ('G5', .5)], [('A5', 1), ('C6', 1.5), ('Bb5', .5)], [('G5', 1), ('E5', 2)],
     [('F5', 1), ('G5', 1.5), ('A5', .5)], [('Bb5', 1), ('A5', 1), ('F5', 1)], [('E5', 1), ('F5', 1), ('G5', 1)], [('A5', 1.5), ('G5', .5), ('C#5', 1)]]

PROG_A1 = ['Dm', 'Gm', 'A', 'Dm', 'F', 'C', 'Bb', 'A']
PROG_A2 = ['Dm', 'Gm', 'C', 'F', 'Bb', 'Gm', 'A', 'Dm']
PROG_B = ['F', 'C', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'A']
PROG_C = ['Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'A', 'A7']

def events():
    ev = []
    bar = 0
    def chords(prog, pad=0.22, bass=0.35, harp=0.0, timp=0.0, choir=0.0):
        nonlocal bar
        for i, c in enumerate(prog):
            b0 = (bar + i) * 3
            root, tones = CH[c]
            if pad:
                for k, n in enumerate(tones):
                    ev.append((b0, 'string_ensemble_1', n, 3, pad, -0.3 + 0.2 * k, True))
            if bass:
                ev.append((b0, 'contrabass', root, 2.5, bass, 0.0, True))
            if harp:
                h = [up(tones[0]), up(tones[1]), up(tones[2]), up(tones[3]), up(tones[2]), up(tones[1])]
                for k, n in enumerate(h):
                    ev.append((b0 + k * 0.5, 'orchestral_harp', n, 1.0, harp * (1.0 if k == 0 else 0.75), 0.35, False))
            if timp and c in ('Dm', 'A', 'A7', 'Gm', 'Bb'):
                tn = {'Dm': 'D2', 'A': 'A1', 'A7': 'A1', 'Gm': 'D2', 'Bb': 'D2'}[c]
                ev.append((b0, 'timpani', tn, 2, timp, 0.0, False))
            if choir:
                for n in tones[1:3]:
                    ev.append((b0, 'choir_aahs', up(n), 3, choir, 0.0, True))
    def melody(m, inst, vel, octave=0, pan=-0.1):
        b = bar * 3
        for meas in m:
            for n, d in meas:
                if n != 'r':
                    ev.append((b, inst, up(n, octave) if octave else n, d, vel, pan, True))
                b += d
    # intro: harp alone, strings creeping in
    chords(['Dm', 'Gm', 'A', 'Dm'], pad=0.12, bass=0.2, harp=0.55); bar += 4
    # A: violin melody
    chords(PROG_A1, harp=0.4); melody(A1, 'violin', 0.5); bar += 8
    chords(PROG_A2, harp=0.4); melody(A2, 'violin', 0.55); bar += 8
    # B: cello sings, harp continues
    chords(PROG_B, pad=0.18, harp=0.35); melody(B, 'cello', 0.65, pan=0.2); bar += 8
    # A with horn
    chords(PROG_A1, pad=0.25, harp=0.3); melody(A1, 'french_horn', 0.5); melody(A1, 'violin', 0.3); bar += 8
    # C: climax
    chords(PROG_C, pad=0.34, bass=0.5, timp=0.6, choir=0.4); melody(C, 'violin', 0.6); melody(C, 'french_horn', 0.45, octave=0, pan=0.2)
    melody([[(n[:-1] + str(int(n[-1]) - 1), d) for n, d in meas] for meas in C], 'cello', 0.45, pan=0.3); bar += 8
    # A2 calm return, flute
    chords(PROG_A2, pad=0.2, harp=0.4); melody(A2, 'flute', 0.5); bar += 8
    # coda
    chords(['Dm', 'Gm', 'A', 'Dm'], pad=0.2, bass=0.3, harp=0.4); melody([[('F5', 3)], [('G5', 3)], [('E5', 3)], [('D5', 3)]], 'violin', 0.4); bar += 4
    ev.append((bar * 3, 'string_ensemble_1', 'D3', 5, 0.2, 0, True)); ev.append((bar * 3, 'string_ensemble_1', 'A3', 5, 0.18, 0, True))
    ev.append((bar * 3, 'contrabass', 'D2', 5, 0.3, 0, True)); ev.append((bar * 3, 'orchestral_harp', 'D4', 2, 0.4, 0.3, False))
    return ev
