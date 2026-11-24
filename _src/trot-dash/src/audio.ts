// Drumline and brass made in Web Audio. No sound files.
// The tempo follows the turkey's speed.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let silentEl: HTMLAudioElement | null = null;
let timer = 0;
let nextT = 0;
let step = 0;
let speed = 0; // 0..1.4
let brassOn = false;
let muted = false;

// A short silent sound played on a normal audio tag. On iPhone this switches the page to
// "playback" sound, so the music still plays with the ring switch on silent.
function silentWav(): string {
  const n = 4000;
  const b = new Uint8Array(44 + n);
  const dv = new DataView(b.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  w(36, 'data'); dv.setUint32(40, n, true);
  b.fill(128, 44);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return 'data:audio/wav;base64,' + btoa(s);
}

/** Call inside a tap. */
export function unlock() {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch { /* older phones */ }
  try {
    if (!silentEl) {
      silentEl = new Audio(silentWav());
      silentEl.loop = true;
      silentEl.setAttribute('playsinline', '');
    }
    void silentEl.play().catch(() => {});
  } catch { /* fine */ }
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.03);
}

export function pause(p: boolean) {
  if (!ctx) return;
  if (p) { void ctx.suspend(); silentEl?.pause(); }
  else { void ctx.resume(); void silentEl?.play().catch(() => {}); }
}

function noise(t: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function tone(t: number, dur: number, f0: number, f1: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function brass(t: number, dur: number, midi: number, gain: number) {
  if (!ctx || !master) return;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(500, t);
  f.frequency.linearRampToValueAtTime(2100, t + 0.06);
  f.frequency.linearRampToValueAtTime(1100, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain * 0.8, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(master);
  for (const det of [-6, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

// A four-bar marching tune. [step, note, length in steps]
const TUNE: number[][][] = [
  [[0, 60, 3], [4, 64, 2], [6, 67, 2], [8, 72, 4], [12, 67, 3]],
  [[0, 69, 3], [4, 65, 2], [6, 69, 2], [8, 67, 5], [14, 64, 2]],
  [[0, 65, 3], [4, 62, 2], [6, 65, 2], [8, 64, 4], [12, 60, 3]],
  [[0, 62, 2], [2, 64, 2], [4, 65, 2], [6, 67, 2], [8, 72, 7]],
];
const BASS = [[36, 43], [41, 36], [38, 45], [43, 43]];
const SNARE = [1, 0, 0.35, 0.35, 1, 0, 0.35, 0, 1, 0, 0.35, 0.35, 1, 0.35, 0.6, 0.6];

function playStep(s: number, t: number, len: number) {
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  const drive = Math.min(1, 0.45 + speed * 0.55);
  // bass drum
  if (i === 0 || i === 8 || (bar === 3 && i === 14)) tone(t, 0.22, 130, 45, 0.7 * drive);
  // snares
  const sn = bar === 3 && i >= 12 ? 0.8 : SNARE[i];
  if (sn > 0) {
    noise(t, 0.09, 2300, 0.8, 0.26 * sn * drive);
    tone(t, 0.05, 210, 170, 0.1 * sn * drive, 'triangle');
  }
  if (!brassOn) return;
  if (i === 0 || i === 8) brass(t, len * 3.4, BASS[bar][i === 0 ? 0 : 1], 0.2);
  for (const n of TUNE[bar]) {
    if (n[0] === i) {
      brass(t, len * n[2] * 0.92, n[1], 0.15);
      if (speed > 1.1) brass(t, len * n[2] * 0.92, n[1] + 12, 0.07);
    }
  }
  if (speed > 1.1 && i === 0) noise(t, 0.7, 7000, 0.4, 0.14, 'highpass');
}

export function startMusic() {
  if (!ctx) return;
  stopMusic();
  step = 0;
  nextT = ctx.currentTime + 0.08;
  timer = window.setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.16) {
      const bpm = 96 + 58 * Math.min(1.4, speed);
      const len = 60 / bpm / 4;
      playStep(step, nextT, len);
      nextT += len;
      step++;
    }
  }, 40);
}

export function stopMusic() {
  if (timer) window.clearInterval(timer);
  timer = 0;
}

/** speed 0..1.4 (1 = normal pace). brass plays only while racing. */
export function setDrive(s: number, withBrass: boolean) {
  speed = s;
  brassOn = withBrass;
}

const now = () => (ctx ? ctx.currentTime : 0);

export function gobble() {
  if (!ctx || !master) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.36);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 23;
  const lg = ctx.createGain();
  lg.gain.value = 150;
  lfo.connect(lg).connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1000; f.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(f).connect(g).connect(master);
  o.start(t); lfo.start(t);
  o.stop(t + 0.42); lfo.stop(t + 0.42);
}

export function cheer(dur = 1.6) {
  if (!ctx || !master || !noiseBuf) return;
  const t = now();
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.3, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.05);
  for (let i = 0; i < 4; i++) {
    const a = t + 0.1 + Math.random() * dur * 0.5;
    const base = 500 + Math.random() * 300;
    tone(a, 0.45, base, base * 1.7, 0.07, 'triangle');
  }
}

export function ding() {
  const t = now();
  tone(t, 0.18, 1319, 1319, 0.22);
  tone(t + 0.07, 0.3, 1760, 1760, 0.22);
}

export function thud(wet: boolean) {
  const t = now();
  tone(t, 0.25, 140, 50, 0.6);
  noise(t, wet ? 0.4 : 0.3, wet ? 3000 : 900, 0.5, 0.3);
}

export function rip() {
  const t = now();
  for (let i = 0; i < 5; i++) brass(t + i * 0.06, 0.2, 60 + [0, 4, 7, 12, 16][i], 0.16);
  noise(t + 0.3, 0.9, 6500, 0.4, 0.2, 'highpass');
}

export function tick(high: boolean) {
  const t = now();
  tone(t, 0.09, high ? 1400 : 900, high ? 1400 : 900, 0.3, 'square');
  noise(t, 0.05, 2500, 1, 0.2);
}

export function fanfare() {
  const t = now();
  [60, 64, 67].forEach((m, i) => brass(t + i * 0.14, 0.3, m, 0.16));
  [60, 64, 67, 72].forEach((m) => brass(t + 0.45, 1.6, m, 0.12));
  tone(t + 0.45, 0.3, 130, 45, 0.7);
  noise(t + 0.45, 1.2, 6500, 0.4, 0.2, 'highpass');
}
