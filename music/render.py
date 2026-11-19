#!/usr/bin/env python3
"""
Renders the project's original background music from a plain-text score.

The compositions in music/scores/*.py are original works written for this project and dedicated to the
public domain (CC0). The instrument sounds are FluidR3_GM samples (Frank Wen et al.) as distributed
pre-rendered by gleitz/midi-js-soundfonts, licensed CC BY 3.0 — see ATTRIBUTION.md.

Usage: python3 render.py <samples dir: .../FluidR3_GM> <score.py> <out basename>
"""
import sys, os, subprocess, importlib.util
import numpy as np
from scipy.signal import fftconvolve

SR = 44100
SAMPLES = sys.argv[1]
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
ALIAS = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}

def midi(n):
    """'D5' / 'C#4' / 'Bb3' -> midi number"""
    name, octv = (n[:2], n[2:]) if len(n) > 2 and n[1] in '#b' else (n[:1], n[1:])
    name = ALIAS.get(name, name)
    return 12 * (int(octv) + 1) + NAMES.index(name)

def note_name(m):
    return NAMES[m % 12] + str(m // 12 - 1)

_cache = {}
def sample(inst, m):
    key = (inst, m)
    if key not in _cache:
        path = os.path.join(SAMPLES, f'{inst}-mp3', note_name(m) + '.mp3')
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                             capture_output=True, check=True).stdout
        a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
        # trim leading silence
        nz = np.where(np.abs(a).max(axis=1) > 1e-4)[0]
        _cache[key] = a[nz[0]:] if len(nz) else a
    return _cache[key]

def shaped(inst, m, dur, release=0.5, sustain=True):
    """Note of `dur` seconds: sustained instruments are looped with crossfades, then released."""
    s = sample(inst, m)
    n = int(dur * SR)
    rel = int(release * SR)
    if not sustain:                               # plucked / struck: let the sample ring, cut gently
        out = s[:n + rel].copy()
    elif n + rel <= len(s) - int(0.3 * SR):
        out = s[:n + rel].copy()
    else:                                         # loop the steady middle part
        a, b = int(0.9 * SR), min(len(s) - int(0.25 * SR), int(2.5 * SR))
        loop = s[a:b]
        xf = int(0.25 * SR)
        out = s[:b].copy()
        while len(out) < n + rel:
            seg = loop.copy()
            ramp = np.linspace(0, 1, xf)[:, None]
            out[-xf:] = out[-xf:] * (1 - ramp) + seg[:xf] * ramp
            out = np.concatenate([out, seg[xf:]])
        out = out[:n + rel]
    k = min(rel, len(out))
    out[-k:] *= np.linspace(1, 0, k)[:, None] ** 2
    att = min(int(0.02 * SR), len(out))
    out[:att] *= np.linspace(0, 1, att)[:, None]
    return out

def reverb(x, seconds=2.6, wet=0.28, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / seconds)[:, None]
    ir[:int(0.012 * SR)] = 0                      # pre-delay
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    w = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + w * wet * 1.6

def render(score):
    bpm = score.BPM
    beat = 60 / bpm
    events = score.events()                       # (start_beat, inst, note, beats, vel, pan, sustain)
    end = max(e[0] + e[3] for e in events) * beat + 4
    mix = np.zeros((int(end * SR), 2), dtype=np.float32)
    for (b, inst, note, beats, vel, pan, sus) in events:
        x = shaped(inst, midi(note), beats * beat, release=score.RELEASE.get(inst, 0.5), sustain=sus)
        g = vel * score.GAIN.get(inst, 1.0)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        i = int(b * beat * SR)
        j = min(len(mix), i + len(x))
        mix[i:j, 0] += x[:j - i, 0] * g * l * 1.414
        mix[i:j, 1] += x[:j - i, 1] * g * r * 1.414
    mix = reverb(mix)
    # trim tail silence, fade, normalise to -1 dBFS
    nz = np.where(np.abs(mix).max(axis=1) > 1e-3)[0]
    mix = mix[:nz[-1] + int(0.5 * SR)]
    f = int(1.5 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
    mix *= 0.72 / np.abs(mix).max()          # headroom for MP3 encoding overshoot
    return mix

if __name__ == '__main__':
    spec = importlib.util.spec_from_file_location('score', sys.argv[2])
    score = importlib.util.module_from_spec(spec); spec.loader.exec_module(score)
    out = sys.argv[3]
    mix = render(score)
    raw = out + '.f32'
    mix.astype(np.float32).tofile(raw)
    common = ['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw,
              '-metadata', f'title={score.TITLE}', '-metadata', 'artist=CountryHistory project (CC0 composition)',
              '-metadata', 'comment=Samples: FluidR3_GM, CC BY 3.0']
    subprocess.run(common + ['-c:a', 'libmp3lame', '-q:a', '4', out + '.mp3'], check=True)
    os.remove(raw)
    print(out, round(len(mix) / SR, 1), 's')
