// Decides each light's brightness and colour for the current frame.
// Live shows follow the audio clock (beats). Idle is a slow gleam.
export type Mode = 'chase' | 'twinkle' | 'wave' | 'pulse' | 'wheel';
export const MODES: { id: Mode; name: string }[] = [
  { id: 'chase', name: 'Chase' },
  { id: 'twinkle', name: 'Twinkle' },
  { id: 'wave', name: 'Wave' },
  { id: 'pulse', name: 'Pulse to beat' },
  { id: 'wheel', name: 'Color wheel' },
];

export type On = { u: number; v: number; rank: number; h: number };

const PAL: [number, number, number][] = [
  [0.95, 0.77, 0.42],
  [1, 0.95, 0.86],
  [0.91, 0.54, 0.31],
  [0.88, 0.35, 0.29],
  [0.65, 0.87, 0.66],
  [0.61, 0.8, 1],
];

const fract = (x: number) => x - Math.floor(x);

function hash01(i: number) {
  return fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);
}

// Adds a left-to-right rank and a random seed to each lit light.
export function buildOn(list: { u: number; v: number }[]): On[] {
  const order = list.map((_, i) => i).sort((a, b) => list[a].u - list[b].u);
  const rank = new Array<number>(list.length);
  order.forEach((idx, k) => {
    rank[idx] = list.length > 1 ? k / (list.length - 1) : 0;
  });
  return list.map((p, i) => ({ u: p.u, v: p.v, rank: rank[i], h: hash01(i + 1) }));
}

export function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

export type ShowIn = { on: On[]; mode: Mode; live: boolean; beat: number; t: number; drop: number };

export function computeShow(inp: ShowIn, n: number, bright: Float32Array, col: Float32Array) {
  const { on, mode, live, beat, t, drop } = inp;
  for (let i = 0; i < n; i++) {
    const o = on[i];
    let b = 0.5;
    let c: [number, number, number] = PAL[Math.floor(o.h * PAL.length) % PAL.length];
    if (!live) {
      b = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.3 + o.h * 6.28));
    } else if (mode === 'chase') {
      const ph = fract(o.rank * 3 - beat * 0.25);
      b = 0.12 + 0.88 * Math.max(0, 1 - ph * 4);
    } else if (mode === 'twinkle') {
      const s = 0.5 + 0.5 * Math.sin(t * (1.6 + o.h * 3.5) + o.h * 60);
      b = 0.12 + 0.88 * s * s * s;
    } else if (mode === 'wave') {
      b = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(o.v * 6 - beat * 0.9));
    } else if (mode === 'pulse') {
      const env = Math.exp(-fract(beat) * 4.5);
      b = 0.3 + 0.7 * env;
    } else {
      c = hsv(fract(o.rank * 0.8 + t * 0.06), 0.75, 1);
      b = 0.85;
    }
    if (live) b = Math.min(1, b + drop * 0.5);
    bright[i] = b;
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
}
