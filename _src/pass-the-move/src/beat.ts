// The beat. Four original drum-and-bass loops made with Web Audio, no samples and no songs.
// One clock (performance.now) drives the dancer, the count dots and the sound, so they stay together.
import { audioCtx } from './phone';

export const now = () => performance.now() / 1000;
export const beat = { bpm: 112, t0: now(), style: 0, sound: true };
const spb = () => 60 / beat.bpm;
export const beatPos = () => (now() - beat.t0) / spb();
export const timeOfBeat = (b: number) => beat.t0 + b * spb();

type Style = { root: number; kick: number[]; clap: number[]; hat: number[]; bass: Record<number, number>; lead: Record<number, number>; wave: OscillatorType };
const STYLES: Style[] = [
  { root: 55, kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], bass: { 0: 0, 3: 0, 6: 3, 8: 0, 11: 0, 13: 5, 14: 3 }, lead: { 0: 12, 6: 15, 10: 19, 12: 17 }, wave: 'square' },
  { root: 65.4, kick: [0, 6, 8, 14], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bass: { 0: 0, 2: 0, 6: 7, 8: 5, 10: 5, 14: 3 }, lead: { 2: 12, 4: 14, 8: 19, 11: 17, 14: 14 }, wave: 'triangle' },
  { root: 49, kick: [0, 3, 8, 11], clap: [4, 12, 15], hat: [2, 6, 10, 14, 15], bass: { 0: 0, 3: 0, 6: 10, 8: 7, 11: 7, 14: 5 }, lead: { 0: 19, 3: 17, 6: 15, 8: 12, 12: 15 }, wave: 'sawtooth' },
  { root: 58.3, kick: [0, 4, 8, 10, 12], clap: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], bass: { 0: 0, 4: 0, 7: 5, 8: 7, 12: 3, 15: 2 }, lead: { 0: 12, 2: 16, 4: 19, 8: 24, 10: 19, 12: 16 }, wave: 'square' },
];
export const STYLE_COUNT = STYLES.length;

let out: GainNode | null = null, tap: MediaStreamAudioDestinationNode | null = null, noise: AudioBuffer | null = null, step = 0, timer = 0;
function bus(): GainNode | null {
  const c = audioCtx(); if (!c) return null;
  if (!out) {
    out = c.createGain(); out.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out.connect(comp); comp.connect(c.destination);
    noise = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return out;
}
/** The beat as a stream, for recording into the share clip. */
export function musicStream(): MediaStream | null {
  const c = audioCtx(), o = bus(); if (!c || !o) return null;
  try { if (!tap) { tap = c.createMediaStreamDestination(); o.connect(tap); } return tap.stream; } catch { return null; }
}
function tone(t: number, f: number, dur: number, vol: number, type: OscillatorType, to = f, cut = 0) {
  const c = audioCtx()!, o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f, t); if (to !== f) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cut) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; o.connect(lp); lp.connect(g); } else o.connect(g);
  g.connect(out!); o.start(t); o.stop(t + dur + 0.03);
}
function hiss(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType) {
  const c = audioCtx()!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise;
  f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out!); s.start(t); s.stop(t + dur + 0.02);
}
const semi = (root: number, n: number) => root * Math.pow(2, n / 12);
function playStep(n: number, t: number) {
  const S = STYLES[beat.style % STYLES.length], k = n % 16, bar = Math.floor(n / 16);
  if (S.kick.includes(k)) tone(t, 150, 0.22, 0.9, 'sine', 42);
  if (S.clap.includes(k)) { hiss(t, 0.13, 0.42, 1700, 'bandpass'); hiss(t + 0.012, 0.09, 0.3, 2400, 'bandpass'); }
  if (S.hat.includes(k)) hiss(t, 0.035, 0.13, 7800, 'highpass');
  if (k in S.bass) tone(t, semi(S.root, S.bass[k]), 0.2, 0.42, 'triangle', semi(S.root, S.bass[k]), 600);
  if (k in S.lead && bar % 2 === 1) tone(t, semi(S.root * 2, S.lead[k]), 0.14, 0.085, S.wave, semi(S.root * 2, S.lead[k]), 2400);
  if (k % 4 === 0) tone(t, k === 0 ? 1560 : 1040, 0.045, k === 0 ? 0.16 : 0.09, 'sine'); // the count tick
}
function tick() {
  const c = audioCtx(); if (!c || c.state !== 'running' || !bus()) return;
  const off = c.currentTime - now(), per = spb() / 4;
  if (!beat.sound) { step = Math.max(step, Math.ceil((now() - beat.t0) / per)); return; }
  let first = Math.ceil((now() - beat.t0 + 0.02) / per); if (step < first) step = first;
  while (beat.t0 + step * per < now() + 0.3) { playStep(step, beat.t0 + step * per + off); step++; }
}
export function startBeat() { if (!timer) timer = window.setInterval(tick, 60); }
/** Change move: new tempo and loop, starting again on count one. */
export function setGroove(bpm: number, style: number, delay = 0.15) { beat.bpm = bpm; beat.style = style; beat.t0 = now() + delay; step = 0; }
/** Line the next count one up a few beats from now (the count-in). Returns nothing; read beatPos(). */
export function restartIn(beats: number) { beat.t0 = now() + beats * spb(); step = Math.ceil(-beats * 4); }

/** Little result sounds. */
export function sting(score: number) {
  const c = audioCtx(); if (!c || c.state !== 'running' || !bus() || !beat.sound) return;
  const t = c.currentTime + 0.03, notes = score >= 90 ? [0, 4, 7, 12, 16] : score >= 55 ? [0, 4, 7] : [3, 0];
  notes.forEach((n, i) => tone(t + i * 0.09, semi(523.25, n), 0.22, 0.2, 'triangle'));
}
export function blip(high = false) {
  const c = audioCtx(); if (!c || c.state !== 'running' || !bus() || !beat.sound) return;
  tone(c.currentTime + 0.01, high ? 1320 : 880, 0.07, 0.16, 'sine');
}
