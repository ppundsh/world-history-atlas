// Screenshot (PNG) and screen recording (video with the background music) of the map.
// Every frame the visible map canvases are copied into one canvas, with the title, mode and year drawn on top;
// the recording takes that canvas's video and, through Web Audio, the music player's sound.

const MIME = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export class Capture {
  constructor({ stage, music, info }) {
    this.stage = stage; this.music = music; this.info = info;        // info(): { title, mode, year, credit }
    this.rec = null; this.audio = null;
  }

  // the canvases that make up the map right now, back to front
  layers() {
    return [...this.stage.querySelectorAll('#flat, #globe canvas, #globe-labels')]
      .filter(c => c.offsetParent !== null && c.width && c.height && !c.closest('[hidden]'));
  }

  compose(ctx, W, H) {
    const r = this.stage.getBoundingClientRect();
    ctx.fillStyle = '#a9cbe6'; ctx.fillRect(0, 0, W, H);
    for (const c of this.layers()) {
      const b = c.getBoundingClientRect();
      ctx.drawImage(c, (b.left - r.left) / r.width * W, (b.top - r.top) / r.height * H, b.width / r.width * W, b.height / r.height * H);
    }
    const { title, mode, year, credit } = this.info(), u = W / 1000;
    ctx.save();
    ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const text = (s, x, y, size, weight, align) => {
      ctx.font = `${weight} ${size}px "Noto Serif TC", "Noto Serif JP", serif`; ctx.textAlign = align;
      ctx.lineWidth = size / 6; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(s, x, y);
      ctx.fillStyle = '#fff'; ctx.fillText(s, x, y);
    };
    text(year, W - 24 * u, H - 24 * u, Math.max(22, Math.min(W, H) * 0.07), 700, 'right');
    ctx.fillStyle = 'rgba(17,26,41,0.78)'; ctx.fillRect(0, 0, W, Math.max(28, 40 * u));
    ctx.font = `700 ${Math.max(14, 20 * u)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(`${title} · ${mode}`, 14 * u, Math.max(20, 28 * u));
    ctx.font = `${Math.max(10, 12 * u)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeText(credit, 12 * u, H - 10 * u); ctx.fillText(credit, 12 * u, H - 10 * u);
    ctx.restore();
  }

  size() {
    const r = this.stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    let W = Math.round(r.width * d), H = Math.round(r.height * d);
    const f = Math.min(1, 1920 / Math.max(W, H)); W = Math.round(W * f / 2) * 2; H = Math.round(H * f / 2) * 2;   // even sizes for video encoders
    return [W, H];
  }

  async screenshot(name) {
    const [W, H] = this.size(), c = document.createElement('canvas'); c.width = W; c.height = H;
    this.compose(c.getContext('2d'), W, H);
    const blob = await new Promise((res, rej) => { try { c.toBlob(res, 'image/png'); } catch (e) { rej(e); } });
    download(blob, name + '.png');
  }

  get recording() { return !!this.rec; }
  supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }

  // the music player's sound, routed through Web Audio so it can be recorded and still heard
  audioTrack() {
    const el = this.music?.el; if (!el || !this.music.tracks?.length) return null;
    if (!this.audio) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(el), dest = ctx.createMediaStreamDestination();
      src.connect(ctx.destination); src.connect(dest);
      this.audio = { ctx, dest };
    }
    this.audio.ctx.resume();
    return this.audio.dest.stream.getAudioTracks()[0] || null;
  }

  start(name, onTick, withMusic = true) {
    if (this.rec) return;
    const [W, H] = this.size(), c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    this.compose(ctx, W, H);
    const stream = c.captureStream(30), a = withMusic ? this.audioTrack() : null;
    if (a) { stream.addTrack(a); if (!this.music.enabled) this.music.setEnabled(true); else this.music.play(); }
    const type = MIME.find(m => MediaRecorder.isTypeSupported(m)) || '';
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
    const chunks = [], t0 = performance.now();
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => download(new Blob(chunks, { type: mr.mimeType || type }), name + (/mp4/.test(mr.mimeType || type) ? '.mp4' : '.webm'));
    let raf = 0;
    const loop = () => { this.compose(ctx, W, H); onTick?.((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    mr.start(1000);
    this.rec = { mr, stop: () => { cancelAnimationFrame(raf); mr.stop(); stream.getVideoTracks().forEach(t => t.stop()); } };
  }

  stop() { if (!this.rec) return; this.rec.stop(); this.rec = null; }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
