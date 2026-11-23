// Carols built note by note in Web Audio. Every note and drum hit is scheduled
// on the AudioContext clock, so the light show reads the same clock and never drifts.
// The tunes are short, simple versions written for this app (public-domain carols).

export type Style = 'lofi' | 'box' | 'pop' | 'trap';
export const STYLES: { id: Style; name: string }[] = [
  { id: 'lofi', name: 'Lo-fi' },
  { id: 'box', name: 'Music box' },
  { id: 'pop', name: '2020s pop' },
  { id: 'trap', name: 'Trap carol' },
];

// [midi note (0 = rest), length in beats]
type Tune = [number, number][];
export const CAROLS: { id: string; name: string; bpm: number; tune: Tune }[] = [
  {
    id: 'halls',
    name: 'Deck the Halls',
    bpm: 112,
    tune: [[67, 1], [65, 1], [64, 1], [62, 1], [60, 2], [62, 1], [64, 1], [65, 1], [67, 1.5], [65, 0.5], [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [65, 1], [67, 1], [64, 2], [62, 1], [60, 1], [60, 2]],
  },
  {
    id: 'bells-jingle',
    name: 'Jingle Bells',
    bpm: 128,
    tune: [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4], [65, 1], [65, 1], [65, 1], [65, 0.5], [64, 0.5], [64, 1], [64, 0.5], [64, 0.5], [62, 1], [62, 1], [64, 1], [62, 2], [67, 2]],
  },
  {
    id: 'tree',
    name: 'O Christmas Tree',
    bpm: 110,
    tune: [[60, 1], [65, 2], [65, 1], [67, 1], [69, 1], [67, 1], [65, 1], [64, 2], [64, 1], [60, 1], [62, 1], [64, 1], [65, 1], [64, 1], [62, 1], [60, 2]],
  },
  {
    id: 'wish',
    name: 'We Wish You a Merry Christmas',
    bpm: 100,
    tune: [[62, 1], [67, 1], [67, 1], [69, 1], [67, 1], [65, 1], [64, 1], [62, 1], [62, 1], [64, 1], [65, 1], [64, 1], [62, 1], [60, 1], [62, 2]],
  },
  {
    id: 'bells',
    name: 'Carol of the Bells',
    bpm: 144,
    tune: [[69, 0.5], [67, 0.5], [64, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [62, 0.5], [64, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [62, 0.5], [60, 0.5]],
  },
];

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let recDest: MediaStreamAudioDestinationNode | null = null;
let timer = 0;
let startT = 0;
let spb = 0.5; // seconds per beat
let noteBeat = 0;
let noteIdx = 0;
let drumK = 0;
let tune: Tune = [];
let style: Style = 'lofi';
let kickBuf: AudioBuffer | null = null;
let noiseBuf: AudioBuffer | null = null;
let running = false;

function ensureCtx(): Ctx | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    recDest = ctx.createMediaStreamDestination();
    const len = Math.floor(ctx.sampleRate * 0.25);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    kickBuf = null;
  }
  // iPhone: play Web Audio even when the silent switch is on (Safari 16.4+).
  try {
    const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (as) as.type = 'playback';
  } catch {
    /* not supported: the silent switch may mute the show */
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(t: number, f: number, len: number, type: OscillatorType, cutoff: number, peak: number, decay: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = cutoff;
  const g = ctx.createGain();
  const end = t + Math.max(len, decay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  o.connect(flt).connect(g).connect(master);
  o.start(t);
  o.stop(end + 0.05);
}

function kick(t: number, level: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.32);
}

function noise(t: number, cutoff: number, type: BiquadFilterType, level: number, len: number) {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(flt).connect(g).connect(master);
  s.start(t, Math.random() * 0.1, len + 0.01);
}

function melodyNote(t: number, midi: number, len: number) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const dur = len * spb;
  if (style === 'lofi') {
    tone(t, f, dur * 0.95, 'triangle', 1500, 0.22, 0.35);
    tone(t, f / 2, dur * 0.95, 'sine', 600, 0.14, 0.4);
  } else if (style === 'box') {
    tone(t, f, dur, 'sine', 8000, 0.3, 0.8);
    tone(t, f * 2, dur * 0.6, 'sine', 8000, 0.07, 0.35);
  } else if (style === 'pop') {
    tone(t, f, dur * 0.9, 'sawtooth', 2200, 0.1, 0.14);
    tone(t, f / 2, dur * 0.9, 'triangle', 900, 0.12, 0.2);
  } else {
    tone(t, f * 2, dur * 0.8, 'sine', 5000, 0.16, 0.25);
    tone(t, f / 4, dur * 0.9, 'sine', 300, 0.3, 0.5);
  }
}

// Drums on half-beat steps. k = 0 is the downbeat of beat 0.
function drumStep(t: number, k: number) {
  if (style === 'box') return;
  if (style === 'lofi') {
    if (k % 8 === 0) kick(t, 0.25);
    if (k % 2 === 0) noise(t, 7000, 'highpass', 0.03, 0.04);
    return;
  }
  if (style === 'pop') {
    if (k % 4 === 0) kick(t, 0.5);
    if (k % 4 === 2) noise(t, 1600, 'bandpass', 0.12, 0.12);
    noise(t, 7000, 'highpass', k % 2 === 0 ? 0.06 : 0.03, 0.05);
    return;
  }
  // trap: half-time kicks on 0 and 2.5, rolling hats
  if (k % 8 === 0 || k % 8 === 5) kick(t, 0.65);
  noise(t, 8000, 'highpass', k % 2 === 0 ? 0.07 : 0.035, 0.04);
}

function tick() {
  const c = ctx;
  if (!c || !running) return;
  const now = (c.currentTime - startT) / spb; // current beat position
  while (noteBeat < now + 0.4) {
    const [m, d] = tune[noteIdx % tune.length];
    if (m > 0) melodyNote(startT + noteBeat * spb, m, d);
    noteBeat += d;
    noteIdx++;
  }
  while (drumK * 0.5 < now + 0.4) {
    drumStep(startT + drumK * 0.5 * spb, drumK);
    drumK++;
  }
}

export function startShow(carolId: string, s: Style): { bpm: number; name: string } {
  const c = ensureCtx();
  const carol = CAROLS.find((x) => x.id === carolId) ?? CAROLS[0];
  stopShow();
  if (!c || !recDest) return { bpm: carol.bpm, name: carol.name };
  master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  master.connect(recDest);
  tune = carol.tune;
  style = s;
  // Trap carols run at half the written tempo for the feel.
  const bpm = s === 'trap' ? carol.bpm * 0.9 : carol.bpm;
  spb = 60 / bpm;
  startT = c.currentTime + 0.15;
  noteBeat = 0;
  noteIdx = 0;
  drumK = 0;
  running = true;
  timer = window.setInterval(tick, 40);
  tick();
  return { bpm, name: carol.name };
}

export function stopShow() {
  running = false;
  if (timer) window.clearInterval(timer);
  timer = 0;
  if (master) {
    try {
      master.disconnect();
    } catch {
      /* already gone */
    }
  }
  master = null;
}

// Beats since the show started, read from the audio clock. -1 when not playing.
export function beatPos(): number {
  if (!running || !ctx) return -1;
  return (ctx.currentTime - startT) / spb;
}

export function isRunning() {
  return running;
}

export function recordTrack(): MediaStreamTrack | null {
  const t = recDest?.stream.getAudioTracks()[0] ?? null;
  return t ?? null;
}

export function ensureAudio() {
  ensureCtx();
}

export function bpmFor(carolId: string, s: Style): number {
  const carol = CAROLS.find((x) => x.id === carolId) ?? CAROLS[0];
  return s === 'trap' ? carol.bpm * 0.9 : carol.bpm;
}
