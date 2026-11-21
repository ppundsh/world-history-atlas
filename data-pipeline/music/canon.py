# "時光卡農 Canon of Ages" — an original three-voice canon at the unison over a two-bar ground (E minor), CC0.
import mido
TPB = 480; Q = TPB; H = 2 * Q; E8 = Q // 2
BPM = 72
GROUND = [40, 35, 36, 43, 45, 40, 45, 35]          # E B C G A E A B (half notes) — bass
CHORDS = [[52, 55, 59], [50, 54, 59], [52, 55, 60], [50, 55, 59], [52, 57, 60], [52, 55, 59], [52, 57, 60], [51, 54, 59]]
# each segment: list of (pitch, duration) filling 2 bars = 16 quarter... = 8 half notes
def halves(ps): return [(p, H) for p in ps]
def quarters(pairs): return [(p, Q) for pr in pairs for p in pr]
def eighths(groups): return [(p, E8) for g in groups for p in g]
SEGS = [
  halves([71, 74, 72, 71, 69, 67, 64, 63]),
  quarters([[76, 74], [74, 73], [72, 71], [71, 69], [69, 72], [71, 67], [69, 72], [71, 75]]),
  eighths([[64, 67, 71, 67], [62, 66, 71, 66], [64, 67, 72, 67], [62, 67, 71, 67], [64, 69, 72, 69], [64, 67, 71, 76], [72, 69, 64, 69], [71, 66, 63, 66]]),
  eighths([[79, 78, 76, 74], [74, 73, 71, 69], [72, 71, 72, 76], [74, 72, 71, 69], [72, 71, 69, 67], [67, 69, 71, 74], [72, 74, 76, 72], [71, 72, 71, 69]]),
  halves([79, 78, 76, 74, 76, 79, 76, 75]),
  quarters([[71, 76], [74, 71], [72, 79], [79, 74], [76, 72], [71, 79], [81, 76], [78, 75]]),
]
PERIOD = 8 * H                                       # four bars
CYCLES = 2
V1_START = 2                                         # periods of ground before the first voice
n_v1 = len(SEGS) * CYCLES
TOTAL = V1_START + n_v1 + 2                          # the other voices finish their last segments
mid = mido.MidiFile(ticks_per_beat=TPB)
def track(ch, prog, pan, name):
    t = mido.MidiTrack(); mid.tracks.append(t)
    t.append(mido.MetaMessage('track_name', name=name, time=0))
    t.append(mido.Message('program_change', channel=ch, program=prog, time=0))
    t.append(mido.Message('control_change', channel=ch, control=10, value=pan, time=0))
    t.append(mido.Message('control_change', channel=ch, control=91, value=70, time=0))   # reverb
    return t
def write(t, ch, events):                           # events: (start_tick, pitch, dur, vel)
    msgs = []
    for s, p, d, v in events:
        msgs.append((s, 1, mido.Message('note_on', channel=ch, note=p, velocity=v)))
        msgs.append((s + d - 10, 0, mido.Message('note_off', channel=ch, note=p, velocity=0)))
    msgs.sort(key=lambda x: (x[0], x[1])); now = 0
    for s, _, m in msgs: m.time = s - now; now = s; t.append(m)
tempo = mido.MidiTrack(); mid.tracks.append(tempo)
tempo.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0))
def vel(period, base):                              # gentle swell over the cycles, softer at the end
    k = min(1.0, 0.55 + 0.45 * period / (TOTAL - 3))
    return int(base * k)
# ground: cello + contrabass, every period, then the final chord
bass = []
for per in range(TOTAL):
    for i, p in enumerate(GROUND): bass.append((per * PERIOD + i * H, p, H, vel(per, 92)))
END = TOTAL * PERIOD
bass.append((END, 40, 4 * H, 80))
write(track(0, 42, 54, 'Cello'), 0, bass)
write(track(1, 43, 54, 'Contrabass'), 1, [(s, p - 12, d, int(v * 0.8)) for s, p, d, v in bass])
# soft string pad on the ground's chords from the second period
pad = []
for per in range(1, TOTAL):
    for i, ch in enumerate(CHORDS):
        for p in ch: pad.append((per * PERIOD + i * H, p, H, vel(per, 38)))
pad += [(END, p, 4 * H, 40) for p in (52, 56, 59, 64)]            # E major to close
write(track(2, 48, 64, 'Strings'), 2, pad)
# the canon: three voices enter one period apart, each playing the same line
def voice(offset):
    ev = []
    for k in range(n_v1):
        per = V1_START + offset + k
        if per >= TOTAL: break
        t0 = per * PERIOD
        for p, d in SEGS[k % len(SEGS)]:
            ev.append((t0, p, d, vel(per, 96))); t0 += d
    return ev
v1 = voice(0); v1.append((END, 76, 4 * H, 70))
v2 = voice(1); v2.append((END, 71, 4 * H, 65))
v3 = voice(2); v3.append((END, 68, 4 * H, 60))
write(track(3, 40, 30, 'Violin I'), 3, v1)
write(track(4, 40, 98, 'Violin II'), 4, v2)
write(track(5, 41, 76, 'Viola'), 5, [(s, p - 12 if p > 74 else p, d, v) for s, p, d, v in v3])
# harpsichord continuo: broken chords on the eighths, middle cycle only
hp = []
for per in range(V1_START + len(SEGS), V1_START + 2 * len(SEGS)):
    for i, ch in enumerate(CHORDS):
        t0 = per * PERIOD + i * H
        for j, p in enumerate([ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]): hp.append((t0 + j * E8, p, E8, 55))
write(track(6, 6, 64, 'Harpsichord'), 6, hp)
mid.save('canon.mid')
print('length s', round(mid.length, 1))
