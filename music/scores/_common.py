# Small helpers shared by the scores (imported by path from each score file).
# Event: (start_beat, instrument, note, beats, velocity, pan, sustained)
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
ALIAS = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}

def m(n):
    name, o = (n[:2], n[2:]) if len(n) > 2 and n[1] in '#b' else (n[:1], n[1:])
    return 12 * (int(o) + 1) + NAMES.index(ALIAS.get(name, name))

def n(mid):
    return NAMES[mid % 12] + str(mid // 12 - 1)

def tr(note, semis):
    return n(m(note) + semis)

def line(ev, start, notes, inst, vel, pan=0.0, sus=True, shift=0):
    """notes: [(note or None for rest, beats), …]; returns the beat after the line"""
    b = start
    for note, d in notes:
        if note:
            ev.append((b, inst, tr(note, shift) if shift else note, d, vel, pan, sus))
        b += d
    return b

def parse(s):
    """'D5:1 E5:.5 - :1 …' → [(note|None, beats)]"""
    out = []
    for tok in s.replace('- :', '-:').split():
        note, d = tok.split(':')
        out.append((None if note == '-' else note, float(d)))
    return out
