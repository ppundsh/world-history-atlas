// Background music: self-hosted files listed in public/audio/tracks.json (licences in ATTRIBUTION.md).
import { safeGet, safeSet } from './i18n.js';

export class Music {
  constructor() {
    this.el = new Audio();
    this.el.preload = 'none';
    this.tracks = [];
    this.i = +(safeGet('track') || 0);
    this.enabled = safeGet('music') !== 'off';
    this.el.volume = +(safeGet('volume') ?? 0.5);
    this.el.loop = true;                        // the chosen track repeats until another is picked
  }

  async load() {
    try {
      const r = await fetch(import.meta.env.BASE_URL + 'audio/tracks.json');
      if (r.ok) this.tracks = await r.json();
    } catch { this.tracks = []; }
    if (!(this.i < this.tracks.length)) this.i = 0;
    return this.tracks.length > 0;
  }

  current() { return this.tracks[this.i]; }

  src(i) { return import.meta.env.BASE_URL + 'audio/' + this.tracks[i].file; }

  async play() {
    if (!this.enabled || !this.tracks.length) return;
    if (!this.el.src) this.el.src = this.src(this.i);
    try { await this.el.play(); } catch { /* blocked until the user interacts */ }
  }

  pause() { this.el.pause(); }

  // tracks that belong to one mode ("mode" in tracks.json) are only offered in that mode
  usable(mode) { return this.tracks.map((t, i) => i).filter(i => !this.tracks[i].mode || this.tracks[i].mode === mode); }
  next(mode) { const u = this.usable(mode); if (u.length) this.select(u[(u.indexOf(this.i) + 1) % u.length]); }

  // switch track; keeps playing if music was already playing
  select(i) {
    const playing = !this.el.paused;
    this.i = i; safeSet('track', String(i));
    this.el.src = this.src(i);
    if (playing) this.play();
    this.onchange?.();
  }

  setEnabled(on) {
    this.enabled = on;
    safeSet('music', on ? 'on' : 'off');
    if (on) this.play(); else this.pause();
  }

  setVolume(v) { this.el.volume = v; safeSet('volume', String(v)); }
}
