// Race rules. No drawing here, so the same numbers drive the screen, the sound and the ghost.

export const COURSE_M = 5000;
export const MILE_M = 1609.344;
export const CLOCK_X = 8; // the race clock runs 8x, so a 3 minute run reads like a real 5K time
export const BASE_V = 27.8; // course metres per real second
export const WU = 0.5; // world units per course metre
export const HALF_W = 4.2; // road half-width, world units
export const FIELD = 60;
export const REC_STEP = 0.25;

export type Weather = 'clear' | 'rain' | 'frost';

export function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Obstacle {
  d: number; // course metres
  x: number; // world units across the road
  kind: 'puddle' | 'leaves' | 'pie';
  r: number; // world units
  hit: boolean;
}

export function buildCourse(weather: Weather): Obstacle[] {
  const r = rng(weather === 'rain' ? 11 : weather === 'frost' ? 23 : 5);
  const puddleShare = weather === 'rain' ? 0.8 : weather === 'frost' ? 0.55 : 0.35;
  const out: Obstacle[] = [];
  let d = 130;
  while (d < COURSE_M - 90) {
    const kind = r() < puddleShare ? 'puddle' : 'leaves';
    const x = (r() * 2 - 1) * 3.1;
    out.push({ d, x, kind, r: 0.85 + r() * 0.3, hit: false });
    if (r() < 0.3) {
      const x2 = x > 0 ? x - 2.4 - r() : x + 2.4 + r();
      out.push({ d: d + 2, x: x2, kind: r() < puddleShare ? 'puddle' : 'leaves', r: 0.85, hit: false });
    }
    d += (weather === 'rain' ? 34 : 40) + r() * 34;
  }
  let p = 70;
  while (p < COURSE_M - 150) {
    out.push({ d: p, x: (r() * 2 - 1) * 3.2, kind: 'pie', r: 0.6, hit: false });
    p += 150 + r() * 80;
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

export interface Rival {
  start: number;
  v: number;
  x: number;
  phase: number;
  costume: number;
  shirt: number;
}

export function buildField(): Rival[] {
  const r = rng(77);
  const out: Rival[] = [];
  for (let i = 0; i < FIELD - 1; i++) {
    const f = i / (FIELD - 2);
    out.push({
      start: 8 + 150 * (1 - f) + r() * 10,
      v: 28.9 - 6.5 * Math.pow(f, 0.8) + (r() - 0.5) * 0.4,
      x: (r() * 2 - 1) * 3.4,
      phase: r() * 6.28,
      costume: Math.floor(r() * 6),
      shirt: Math.floor(r() * 6),
    });
  }
  return out;
}

export const rivalDist = (r: Rival, t: number) => r.start + r.v * t + 5 * Math.sin(t * 0.21 + r.phase);
export const rivalX = (r: Rival, t: number) =>
  Math.max(-3.7, Math.min(3.7, r.x + 0.5 * Math.sin(t * 0.3 + r.phase * 2)));

export type Ev =
  | { k: 'hop' | 'pie' | 'sprint' | 'sprintReady' | 'bump' | 'finish' }
  | { k: 'stumble'; d: number; x: number; what: 'puddle' | 'leaves' }
  | { k: 'mile'; n: number; split: number };

export interface Input {
  steer: number; // -1..1 from tilt
  dragX: number | null; // world x from a finger, or null
  hop: boolean;
  sprint: boolean;
}

export interface Ghost {
  time: number; // real seconds
  place: number;
  samples: number[]; // d, x pairs every REC_STEP
}

export function ghostAt(g: Ghost, t: number): { d: number; x: number } {
  const n = g.samples.length / 2;
  const f = Math.min(n - 1, t / REC_STEP);
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const u = f - i;
  if (t >= g.time) return { d: COURSE_M + (t - g.time) * 6, x: g.samples[n * 2 - 1] };
  return {
    d: g.samples[i * 2] + (g.samples[j * 2] - g.samples[i * 2]) * u,
    x: g.samples[i * 2 + 1] + (g.samples[j * 2 + 1] - g.samples[i * 2 + 1]) * u,
  };
}

const HOP_T = 0.62;

export class Sim {
  t = 0;
  d = 0;
  x = 0;
  vx = 0;
  v = 0;
  y = 0;
  hopT = -1;
  stumbleT = 0;
  sprintT = 0;
  pies = 0;
  place = FIELD;
  finished = false;
  splits: number[] = [];
  rec: number[] = [];
  events: Ev[] = [];
  obstacles: Obstacle[];
  rivals: Rival[];
  private oi = 0;
  private recT = 0;
  private bumpT = 0;

  constructor(public weather: Weather) {
    this.obstacles = buildCourse(weather);
    this.rivals = buildField();
  }

  step(dt: number, inp: Input) {
    if (this.finished) {
      this.t += dt;
      this.v += (7 - this.v) * Math.min(1, dt * 2);
      this.d += this.v * dt;
      this.vx += (0 - this.x * 2 - this.vx) * Math.min(1, dt * 3);
      this.x += this.vx * dt;
      return;
    }
    this.t += dt;

    // Steering. Frost makes the road slippery, so the turkey answers more slowly.
    const grip = this.weather === 'frost' ? 3.2 : 9;
    let want = inp.steer * 7.5;
    if (inp.dragX !== null) want = Math.max(-9, Math.min(9, (inp.dragX - this.x) * 9));
    this.vx += (want - this.vx) * Math.min(1, dt * grip);
    this.x += this.vx * dt;
    const lim = HALF_W - 0.55;
    if (this.x > lim) { this.x = lim; this.vx = Math.min(0, this.vx); }
    if (this.x < -lim) { this.x = -lim; this.vx = Math.max(0, this.vx); }

    // Hop
    if (inp.hop && this.hopT < 0) {
      this.hopT = 0;
      this.events.push({ k: 'hop' });
    }
    if (this.hopT >= 0) {
      this.hopT += dt;
      const p = this.hopT / HOP_T;
      this.y = p >= 1 ? 0 : 1.35 * 4 * p * (1 - p);
      if (p >= 1) this.hopT = -1;
    }
    const air = this.y > 0.22;

    // Sprint
    if (inp.sprint && this.pies >= 3 && this.stumbleT <= 0) {
      this.pies = 0;
      this.sprintT = 5;
      this.events.push({ k: 'sprint' });
    }
    if (this.sprintT > 0) this.sprintT -= dt;
    if (this.stumbleT > 0) this.stumbleT -= dt;

    let target = BASE_V * (this.sprintT > 0 ? 1.38 : 1);
    if (this.stumbleT > 0) target = BASE_V * 0.55;

    // Other runners: count who is ahead, and slow down behind anyone in the way.
    let ahead = 0;
    this.bumpT -= dt;
    for (const r of this.rivals) {
      const rd = rivalDist(r, this.t);
      if (rd > this.d) ahead++;
      if (rd >= COURSE_M) continue;
      const dz = (rd - this.d) * WU;
      if (dz > 0 && dz < 1.5 && Math.abs(rivalX(r, this.t) - this.x) < 0.78) {
        target = Math.min(target, r.v * 0.98);
        if (this.v > r.v + 1) this.v = r.v + 1;
        if (this.bumpT <= 0) {
          this.bumpT = 1.2;
          this.events.push({ k: 'bump' });
        }
      }
    }
    this.place = 1 + ahead;

    const dv = target - this.v;
    this.v += Math.max(-30 * dt, Math.min(9.5 * dt, dv));
    const before = this.d;
    this.d += this.v * dt;

    // Puddles, leaf piles and pie
    const obs = this.obstacles;
    while (this.oi < obs.length && obs[this.oi].d < this.d - 6) this.oi++;
    for (let i = this.oi; i < obs.length && obs[i].d < this.d + 6; i++) {
      const o = obs[i];
      if (o.hit) continue;
      const dz = Math.abs(o.d - this.d) * WU;
      const dx = Math.abs(o.x - this.x);
      if (o.kind === 'pie') {
        if (dz < 1.1 && dx < 1.05) {
          o.hit = true;
          const was = this.pies;
          this.pies = Math.min(3, this.pies + 1);
          this.events.push({ k: 'pie' });
          if (was < 3 && this.pies === 3) this.events.push({ k: 'sprintReady' });
        }
      } else if (dz < o.r * 0.75 && dx < o.r + 0.2 && !air) {
        o.hit = true;
        this.stumbleT = 1.1;
        this.sprintT = 0;
        this.v *= 0.55;
        this.events.push({ k: 'stumble', d: o.d, x: o.x, what: o.kind });
      }
    }

    // Mile splits
    for (let n = 1; n <= 3; n++) {
      const m = n * MILE_M;
      if (before < m && this.d >= m) {
        const clock = this.t * CLOCK_X;
        const prev = this.splits.reduce((a, b) => a + b, 0);
        this.splits.push(clock - prev);
        this.events.push({ k: 'mile', n, split: clock - prev });
      }
    }

    // Ghost recording
    this.recT -= dt;
    if (this.recT <= 0) {
      this.recT += REC_STEP;
      this.rec.push(Math.round(this.d * 10) / 10, Math.round(this.x * 100) / 100);
    }

    if (this.d >= COURSE_M) {
      this.finished = true;
      this.t -= (this.d - COURSE_M) / Math.max(1, this.v);
      const clock = this.t * CLOCK_X;
      this.splits.push(clock - this.splits.reduce((a, b) => a + b, 0));
      this.rec.push(COURSE_M, Math.round(this.x * 100) / 100);
      this.events.push({ k: 'finish' });
    }
  }
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
