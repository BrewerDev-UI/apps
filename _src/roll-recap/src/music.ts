// A small music bed made on the phone with Web Audio: soft chords, a plucked line, a light beat. No audio files.
import { audioCtx } from './phone';

type M = { ctx: AudioContext; bus: GainNode; out: GainNode; echo: GainNode; noise: AudioBuffer; timer: number; next: number; step: number; rec: MediaStreamAudioDestinationNode | null };
let m: M | null = null, muted = false, ducked = false;

const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [48, 52, 55, 59]];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
const STEP = 60 / 84 / 4;

function level() { if (m) m.out.gain.setTargetAtTime(muted ? 0 : ducked ? 0.22 : 0.85, m.ctx.currentTime, 0.12); }

function pad(M: M, notes: number[], at: number, len: number) {
  const { ctx } = M, f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 780; f.Q.value = 0.6;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.055, at + 0.5); g.gain.setValueAtTime(0.055, at + len - 0.3); g.gain.linearRampToValueAtTime(0, at + len + 0.5);
  f.connect(g); g.connect(M.bus);
  for (const n of notes) for (const d of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = d; o.connect(f); o.start(at); o.stop(at + len + 0.6); }
  const b = ctx.createOscillator(), bg = ctx.createGain(); b.type = 'sine'; b.frequency.value = hz(notes[0] - 12); bg.gain.setValueAtTime(0, at); bg.gain.linearRampToValueAtTime(0.16, at + 0.08); bg.gain.linearRampToValueAtTime(0, at + len);
  b.connect(bg); bg.connect(M.bus); b.start(at); b.stop(at + len + 0.1);
}
function pluck(M: M, n: number, at: number, vol: number) {
  const { ctx } = M, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(n);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.5);
  o.connect(g); g.connect(M.bus); g.connect(M.echo); o.start(at); o.stop(at + 0.55);
}
function kick(M: M, at: number) {
  const { ctx } = M, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
  g.gain.setValueAtTime(0.42, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.3); o.connect(g); g.connect(M.bus); o.start(at); o.stop(at + 0.32);
}
function hiss(M: M, at: number, vol: number, len: number, freq: number) {
  const { ctx } = M, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = M.noise; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + len); s.connect(f); f.connect(g); g.connect(M.bus); s.start(at, Math.random() * 0.5, len + 0.02);
}

function tick() {
  if (!m || m.ctx.state !== 'running') return;
  if (m.next < m.ctx.currentTime) m.next = m.ctx.currentTime + 0.05;
  while (m.next < m.ctx.currentTime + 0.3) {
    const s = m.step % 64, bar = Math.floor(s / 16), q = s % 16, ch = CHORDS[bar], at = m.next;
    if (q === 0) pad(m, ch, at, STEP * 16);
    if (q % 2 === 0) pluck(m, ch[ARP[q / 2]] + 12, at, q === 0 ? 0.11 : 0.075);
    if (q === 0 || q === 8 || (q === 11 && bar === 3)) kick(m, at);
    if (q === 4 || q === 12) hiss(m, at, 0.09, 0.14, 2200);
    if (q % 4 === 2) hiss(m, at, 0.035, 0.05, 7000);
    m.next += STEP; m.step++;
  }
}

export function startMusic() {
  const ctx = audioCtx(); if (!ctx || m) { level(); return; }
  const bus = ctx.createGain(), out = ctx.createGain(), echo = ctx.createGain(), delay = ctx.createDelay(1), fb = ctx.createGain();
  bus.gain.value = 0.9; out.gain.value = 0; echo.gain.value = 0.35; delay.delayTime.value = STEP * 3; fb.gain.value = 0.38;
  echo.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(bus); bus.connect(out); out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  m = { ctx, bus, out, echo, noise, timer: window.setInterval(tick, 60), next: ctx.currentTime + 0.08, step: 0, rec: null };
  level(); tick();
}
export function stopMusic() {
  if (!m) return; const old = m; m = null; clearInterval(old.timer); old.out.gain.setTargetAtTime(0, old.ctx.currentTime, 0.08);
  setTimeout(() => { try { old.out.disconnect(); old.bus.disconnect(); } catch { /* gone */ } }, 600);
}
export function setMuted(v: boolean) { muted = v; level(); }
export function duck(v: boolean) { ducked = v; level(); }
/** The music as a stream, for the video. Works even while the speaker is muted. */
export function musicStream(): MediaStream | null {
  if (!m) return null; try { if (!m.rec) { m.rec = m.ctx.createMediaStreamDestination(); m.bus.connect(m.rec); } return m.rec.stream; } catch { return null; }
}
