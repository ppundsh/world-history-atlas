# "英靈之詩 Ode to the Heroic Spirits" — an original instrumental composition for the hidden mode (CC0).
# Melody and harmony written for this project (D minor, ending on D major); it does not quote any existing music.
# Standalone: needs the midi-js-soundfonts FluidR3_GM *-mp3.js files in SF and ffmpeg; writes heroic.mp3.
# Rendered with FluidR3_GM samples (midi-js-soundfonts, CC BY 3.0) by a small sampler.
import re, base64, subprocess, io, os, json
import numpy as np
SR = 44100
BPM = 84; BEAT = 60 / BPM
SF = '/tmp/sf'
cache = {}
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
def note_name(m): return NAMES[m % 12] + str(m // 12 - 1)
banks = {}
def bank(inst):
    if inst not in banks:
        txt = open(f'{SF}/{inst}.js').read()
        banks[inst] = dict(re.findall(r'"([A-G]b?\d)":\s*"data:audio/mp3;base64,([^"]+)"', txt))
    return banks[inst]
def sample(inst, m):
    k = (inst, m)
    if k in cache: return cache[k]
    b = bank(inst); n = note_name(m)
    if n not in b:  # nearest available note, pitch-shifted by resampling
        avail = sorted(b, key=lambda x: abs((NAMES.index(re.match(r'[A-G]b?', x).group()) + 12 * (int(x[-1]) + 1)) - m))
        n2 = avail[0]; m2 = NAMES.index(re.match(r'[A-G]b?', n2).group()) + 12 * (int(n2[-1]) + 1)
        base = sample(inst, m2); r = 2 ** ((m - m2) / 12)
        idx = np.arange(0, len(base) - 1, r); out = np.interp(idx, np.arange(len(base)), base)
        cache[k] = out; return out
    mp3 = base64.b64decode(b[n])
    p = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'], input=mp3, capture_output=True)
    a = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
    cache[k] = a; return a

TOTAL_BEATS = 4 * 66
mix = np.zeros(int((TOTAL_BEATS * BEAT + 6) * SR))
def play(inst, m, t, dur, vel=0.6, rel=0.35):
    s = sample(inst, m); n = int((dur * BEAT + rel) * SR); s = s[:n].copy()
    if len(s) < n: s = np.pad(s, (0, n - len(s)))
    env = np.ones(n); a = int(0.012 * SR); env[:a] = np.linspace(0, 1, a)
    r = int(rel * SR); env[-r:] *= np.linspace(1, 0, r)
    i = int(t * BEAT * SR); mix[i:i + n] += s * env * vel

# chords as MIDI roots/triads (D minor)
def triad(root, kind='m'):
    third = 3 if kind == 'm' else 4
    return [root, root + third, root + 7]
D, F, G, A, Bb, C, E = 50, 53, 55, 57, 58, 48, 52
prog_A = [(D, 'm'), (Bb, 'M'), (F, 'M'), (C + 12, 'M'), (D, 'm'), (G, 'm'), (A, 'M'), (D, 'm')]
prog_B = [(Bb, 'M'), (F, 'M'), (G, 'm'), (A, 'M'), (Bb, 'M'), (C + 12, 'M'), (D, 'm'), (D, 'm')]
prog_C = [(F, 'M'), (A, 'm'), (Bb, 'M'), (C + 12, 'M'), (F, 'M'), (A, 'm'), (Bb, 'M'), (A, 'M')]

def pad(prog, start, bars_per=1, inst='strings', vel=0.28, octave=0):
    t = start
    for root, kind in prog:
        for nt in triad(root + octave, kind): play(inst, nt, t, 4 * bars_per, vel, 0.6)
        play('contrabass', root - 12, t, 4 * bars_per, vel * 1.4, 0.4)
        t += 4 * bars_per
    return t
def harp(prog, start, vel=0.35):
    t = start
    for root, kind in prog:
        ns = triad(root + 12, kind); seq = [ns[0], ns[1], ns[2], ns[1] + 12, ns[2] + 12, ns[1] + 12, ns[2], ns[1]]
        for k, nt in enumerate(seq): play('orchestral_harp', nt, t + k * 0.5, 1.5, vel, 0.8)
        t += 4
    return t
def timp(start, bars, vel=0.5):
    for b in range(bars):
        play('timpani', 38, start + b * 4, 1, vel, 0.8); play('timpani', 45, start + b * 4 + 2.5, 0.5, vel * 0.7, 0.6); play('timpani', 38, start + b * 4 + 3, 1, vel * 0.8, 0.8)
def melody(notes, start, inst, vel=0.55, transpose=0):
    t = start
    for m, d in notes:
        if m is not None: play(inst, m + transpose, t, d, vel, 0.3)
        t += d
    return t

# the theme (original), 8 bars = 32 beats, over prog_A; None = rest
theme = [(62, 1.5), (64, .5), (65, 1), (69, 1), (70, 2), (69, 1), (67, 1),
         (65, 1.5), (64, .5), (65, 1), (67, 1), (69, 3), (None, 1),
         (74, 1.5), (72, .5), (70, 1), (69, 1), (67, 2), (65, 1), (64, 1),
         (65, 1), (67, 1), (69, 1), (65, 1), (64, 3), (None, 1)]
theme2 = [(67, 1.5), (69, .5), (70, 1), (72, 1), (74, 2), (72, 1), (70, 1),
          (69, 1.5), (67, .5), (69, 1), (70, 1), (72, 3), (None, 1),
          (70, 1.5), (72, .5), (74, 1), (76, 1), (77, 2), (76, 1), (74, 1),
          (73, 1), (74, 1), (76, 1), (73, 1), (74, 4)]
interlude = [(72, 2), (69, 1), (67, 1), (65, 2), (67, 2), (69, 3), (70, 1), (72, 4),
             (74, 2), (72, 1), (70, 1), (69, 2), (67, 2), (65, 3), (64, 1), (61, 4)]

t = 0
# intro: harp + soft strings + timpani swell (8 bars)
harp(prog_A, t, 0.3); pad(prog_A, t, inst='strings', vel=0.18); timp(t + 24, 2, 0.35); t += 32
# A: horn theme
pad(prog_A, t, vel=0.24); harp(prog_A, t, 0.2); melody(theme, t, 'french_horn', 0.6); t += 32
# B: brass + choir, timpani
pad(prog_B, t, vel=0.26); pad(prog_B, t, inst='choir_aahs', vel=0.16, octave=12); timp(t, 8, 0.45)
melody(theme2, t, 'brass_section', 0.5); melody(theme2, t, 'strings', 0.25, 12); t += 32
# interlude: flute over harp (quiet)
harp(prog_C, t, 0.3); pad(prog_C, t, vel=0.14); melody(interlude, t, 'flute', 0.5, 12); t += 32
# A again, cellos take the theme, horns answer an octave up
pad(prog_A, t, vel=0.24); melody(theme, t, 'cello', 0.55, -12); melody(theme, t, 'french_horn', 0.35); harp(prog_A, t, 0.22); t += 32
# finale: tutti — brass + choir + strings, timpani
pad(prog_B, t, vel=0.3); pad(prog_B, t, inst='choir_aahs', vel=0.2, octave=12); timp(t, 8, 0.55)
melody(theme2, t, 'brass_section', 0.6); melody(theme2, t, 'choir_aahs', 0.3); melody(theme2, t, 'strings', 0.3, 12); t += 32
# coda: D major chord (Picardy third), long
for nt in [50, 54, 57, 62, 66, 69]: play('strings', nt, t, 12, 0.3, 2.0); play('brass_section', nt, t, 8, 0.18, 2.0)
for nt in [62, 66, 69]: play('choir_aahs', nt + 12, t, 10, 0.18, 2.0)
play('contrabass', 38, t, 12, 0.5, 2.0); play('timpani', 38, t, 2, 0.6, 2.0); harp([(D, 'M')], t, 0.3)
end = t + 14
mix = mix[:int(end * BEAT * SR)]
# simple reverb (feedback delays) and normalisation
rv = mix.copy()
for d, g in [(0.029, .3), (0.037, .27), (0.053, .22), (0.071, .18), (0.11, .12)]:
    k = int(d * SR); rv[k:] += mix[:-k] * g
rv /= np.max(np.abs(rv)) * 1.12
fade = int(3 * SR); rv[-fade:] *= np.linspace(1, 0, fade)
pcm = (rv * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-y', '-v', 'quiet', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0', '-b:a', '128k', '/tmp/song/heroic.mp3'], input=pcm)
print('seconds', len(rv) / SR)
