// A marching drumline made on the phone with Web Audio. No recordings. It speeds up as the run goes on.

const BASS = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0];
const SNARES = [
  [0, 0, 1, 1, 2, 0, 1, 0, 0, 1, 1, 1, 2, 0, 1, 1],
  [1, 0, 1, 1, 2, 0, 0, 1, 1, 0, 1, 1, 2, 1, 1, 1],
  [0, 1, 1, 0, 2, 0, 1, 1, 0, 1, 0, 1, 2, 1, 2, 1],
];
const FILL = [3, 0, 3, 3, 4, 0, 4, 4, 5, 5, 0, 5, 6, 6, 6, 6]; // tenor toms, high to low

export class Drumline {
  private ctx: AudioContext | null = null; private out: GainNode | null = null; private noise: AudioBuffer | null = null;
  private timer = 0; private next = 0; private step = 0; private bar = 0;
  bpm = 100; on = true;

  start(ctx: AudioContext | null) {
    if (!ctx || !this.on) return; this.stop(); this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(comp);
    this.out.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.3);
    if (!this.noise) { const b = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; }
    this.next = ctx.currentTime + 0.08; this.step = 0; this.bar = 0;
    this.timer = window.setInterval(() => this.pump(), 25);
  }
  stop() {
    clearInterval(this.timer); this.timer = 0;
    const o = this.out, c = this.ctx; if (o && c) { try { o.gain.cancelScheduledValues(c.currentTime); o.gain.setTargetAtTime(0.0001, c.currentTime, 0.08); setTimeout(() => o.disconnect(), 500); } catch { /* gone */ } }
    this.out = null;
  }
  private pump() {
    const c = this.ctx; if (!c || !this.out) return;
    if (this.next < c.currentTime - 0.3) this.next = c.currentTime + 0.05; // came back from the background
    while (this.next < c.currentTime + 0.14) {
      const s = this.step, t = this.next, fill = this.bar % 4 === 3;
      if (BASS[s]) this.bass(t);
      const sn = fill && s >= 8 ? 0 : SNARES[(this.bar >> 1) % SNARES.length][s];
      if (sn) this.snare(t, sn === 2 ? 1 : 0.32);
      if (fill && s >= 8 && FILL[s]) this.tom(t, [0, 0, 0, 330, 262, 208, 156][FILL[s]]);
      if (s === 0 && this.bar % 4 === 0) this.crash(t, 0.22);
      if (s % 4 === 2) this.snare(t, 0.07, 6500);
      this.next += 60 / this.bpm / 4; this.step = (s + 1) % 16; if (this.step === 0) this.bar++;
    }
  }
  private env(t: number, peak: number, dur: number) { const g = this.ctx!.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); g.connect(this.out!); return g; }
  private src(t: number, dur: number, node: AudioNode) { const n = this.ctx!.createBufferSource(); n.buffer = this.noise; n.connect(node); n.start(t, Math.random() * 0.3, dur); }
  private osc(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine') {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(this.env(t, peak, dur)); o.start(t); o.stop(t + dur + 0.02);
  }
  private bass(t: number) { this.osc(t, 120, 44, 0.2, 0.95); }
  private tom(t: number, f: number) { this.osc(t, f, f * 0.72, 0.16, 0.5, 'triangle'); }
  private snare(t: number, v: number, hp = 1700) {
    const f = this.ctx!.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.connect(this.env(t, 0.6 * v, 0.09 + v * 0.05));
    this.src(t, 0.16, f); if (hp < 3000) this.osc(t, 210, 170, 0.07, 0.3 * v, 'triangle');
  }
  private crash(t: number, v: number) { const f = this.ctx!.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5200; f.connect(this.env(t, v, 0.5)); this.src(t, 0.5, f); }

  /** One-off sounds on top of the beat. */
  fx(kind: 'gust' | 'hit' | 'finish' | 'pull') {
    const c = this.ctx; if (!c || !this.out || !this.on) return; const t = c.currentTime + 0.01;
    if (kind === 'gust') {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.35); f.frequency.exponentialRampToValueAtTime(350, t + 0.6);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.6); g.connect(this.out); f.connect(g); this.src(t, 0.6, f);
    } else if (kind === 'hit') { this.osc(t, 190, 50, 0.3, 0.9, 'triangle'); this.crash(t, 0.3); }
    else if (kind === 'pull') { this.osc(t, 480, 700, 0.05, 0.08, 'triangle'); }
    else { for (let i = 0; i < 12; i++) this.snare(t + i * 0.055, 0.3 + i * 0.06); this.crash(t + 0.68, 0.6); this.bass(t + 0.68); [392, 494, 587, 784].forEach((f, i) => this.osc(t + 0.68 + i * 0.09, f, f, 0.5, 0.16, 'triangle')); }
  }
}
