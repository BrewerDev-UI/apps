// The avenue, the balloon and its ropes. matter-js moves the balloon and rope; everything is drawn on one canvas.
import Matter from 'matter-js';
import { type Balloon, drawBalloon, mix } from './balloons';
import type { Wind } from './wind';

const { Engine, Bodies, Body, Composite, Constraint } = Matter;
export const BLOCKS = 43, START_ST = 77, END_ST = 34;
const BLOCK = 4, TOTAL = BLOCKS * BLOCK, NODES = 6, PULL = 0.3;
const INK = '#1F2340', FOG = '#CFDDFA';
export const ord = (n: number) => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

export type Hud = { blocks: number; street: number; air: number; tension: number; wind: number; warn: number; progress: number; slip: number };
export type Result = { blocks: number; street: number; finished: boolean; air: number; hits: number; secs: number };
export type Fx = 'gust' | 'hit' | 'finish' | 'pull' | 'slip' | 'block';
type Rope = { side: number; nodes: Matter.Body[]; cons: Matter.Constraint[]; seg: number; pull: number; hold: number; slip: number; hot: number; tension: number };
type Lamp = { z: number; side: number; reach: number; done: boolean };
type Gust = { t0: number; dur: number; mph: number; said: boolean };
type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; col: string; s: number };

const hash = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const WALLS = ['#B9775B', '#C98A6C', '#E8D5BC', '#A9627A', '#8E9CC4', '#D9B48A', '#9C6A55', '#F0E2CC'];
const PARTY = ['#FF5FA2', '#5DBA6A', '#D9A92E', '#8FB5FF', '#FFF6E8'];

export class Game {
  private c: CanvasRenderingContext2D; private W = 0; private H = 0; private dpr = 1;
  private engine = Engine.create({ constraintIterations: 4 });
  private body!: Matter.Body; private ropes: Rope[] = []; private R = 60; private restY = 0;
  private b: Balloon; private wind: Wind; private cross = 1;
  mode: 'idle' | 'play' | 'over' = 'idle'; paused = false; reduce = false;
  private dist = 0; private t = 0; private runT = 0; private air = 1; private airShown = 1; private hits = 0; private finished = false; private endIn = 0;
  private steer = 0; private steerT = 0; private crewX = 0; private crewV = 0; private walk = 0;
  private gusts: Gust[] = []; private nextGust = 0; private lamps: Lamp[] = []; private lastBlock = 0;
  private shake = 0; private flash = 0; private fade = 0; private bits: Bit[] = []; private streaks: { x: number; y: number; l: number; a: number }[] = [];
  private shift = 0; private shiftT = 0; private raf = 0; private last = 0; private acc = 0; private seed = 1;
  onHud: (h: Hud) => void = () => { }; onEnd: (r: Result) => void = () => { }; onFx: (k: Fx) => void = () => { };

  constructor(private canvas: HTMLCanvasElement, b: Balloon, wind: Wind) {
    this.c = canvas.getContext('2d')!; this.b = b; this.wind = wind; this.setWind(wind);
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize(); this.shift = this.shiftT = 1;
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  destroy() { cancelAnimationFrame(this.raf); }

  private get half() { return this.W * 0.46; }
  private get hor() { return this.H * 0.4; }
  private get gY() { return this.H * 0.84; }
  private get spread() { return this.W * 0.17; }

  resize() {
    const r = this.canvas.getBoundingClientRect(); if (!r.width) return;
    this.dpr = Math.min(2, devicePixelRatio || 1); this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr); this.canvas.height = Math.round(r.height * this.dpr);
    this.build();
  }
  setBalloon(b: Balloon) { this.b = b; if (this.W) { this.build(); Body.setVelocity(this.body, { x: 0, y: -2.2 }); } }
  setWind(w: Wind) { this.wind = w; const c = Math.cos((w.dir + 180 - 299) * Math.PI / 180); this.cross = (c < 0 ? -1 : 1) * Math.max(0.45, Math.abs(c)); }
  setSteer(v: number) { this.steerT = clamp(v, -1, 1); }

  private build() {
    const w = this.engine.world; Composite.clear(w, false);
    const cx = this.W / 2, gY = this.gY;
    this.R = Math.min(this.W * 0.215, this.H * 0.105) * this.b.r / 60;
    const by = this.restY = this.H * (0.335 + (this.b.weight - 1) * 0.11);
    this.body = Bodies.circle(cx, by, this.R * 0.8, { frictionAir: 0.045, density: 0.0004 * this.b.weight, inertia: Infinity, collisionFilter: { mask: 0 } });
    Composite.add(w, this.body); this.crewX = cx; this.crewV = 0; this.ropes = [];
    for (const side of [-1, 1]) {
      const ax = cx + side * this.spread, ay = gY - 26, off = { x: side * this.R * 0.5, y: this.R * 0.7 };
      const tx = cx + off.x, ty = by + off.y, seg = Math.hypot(tx - ax, ty - ay) / (NODES + 1);
      const nodes: Matter.Body[] = [], cons: Matter.Constraint[] = [];
      for (let i = 1; i <= NODES; i++) { const k = i / (NODES + 1); nodes.push(Bodies.circle(ax + (tx - ax) * k, ay + (ty - ay) * k, 3, { frictionAir: 0.09, density: 0.0006, collisionFilter: { mask: 0 } })); }
      for (let i = 0; i <= NODES; i++) {
        const o: Matter.IConstraintDefinition = { length: seg, stiffness: 0.8, damping: 0.1 };
        if (i === 0) { o.pointA = { x: ax, y: ay }; o.bodyB = nodes[0]; }
        else if (i === NODES) { o.bodyA = nodes[NODES - 1]; o.bodyB = this.body; o.pointB = off; }
        else { o.bodyA = nodes[i - 1]; o.bodyB = nodes[i]; }
        cons.push(Constraint.create(o));
      }
      Composite.add(w, nodes); Composite.add(w, cons);
      this.ropes.push({ side, nodes, cons, seg, pull: 0, hold: 0, slip: 0, hot: 0, tension: 0 });
    }
  }

  /** Back to the calm home view. */
  idle() { this.mode = 'idle'; this.shiftT = 1; this.air = 1; this.steerT = 0; this.bits = []; this.paused = false; }
  start() {
    this.fade = this.dist > 2 ? 1 : 0; this.mode = 'play'; this.paused = false; this.shiftT = 0;
    this.dist = 0; this.runT = 0; this.air = this.airShown = 1; this.hits = 0; this.finished = false; this.lastBlock = 0; this.bits = []; this.gusts = []; this.nextGust = this.t + 4.5;
    this.seed = (Math.random() * 1e9) | 0; this.lamps = [];
    for (let k = 1; k < BLOCKS; k++) {
      const p = k / BLOCKS, n = k < 3 ? 1 : 2;
      for (let j = 0; j < n; j++) {
        const h = hash(this.seed + k * 31 + j * 7), h2 = hash(this.seed + k * 17 + j * 3 + 99);
        this.lamps.push({ z: k * BLOCK + (j ? 3 : 1.1) + h2 * 0.5, side: h < 0.5 ? -1 : 1, reach: 0.16 + (0.1 + 0.18 * p) * h2 + 0.06 * p, done: false });
      }
    }
    this.build();
  }
  pull(side: number) {
    if (this.mode !== 'play' || this.paused) return false;
    const r = this.ropes[side < 0 ? 0 : 1]; if (r.slip > 0) return false;
    r.hold = 0.5; this.onFx('pull'); return true;
  }

  private windAt(time: number): number {
    if (this.mode === 'idle') return Math.sin(time * 0.6) * 5 + Math.sin(time * 1.7) * 2;
    const ease = smooth(this.runT / 3);
    let w = this.cross * this.wind.sustained * (0.5 + 0.18 * Math.sin(time * 0.45)) * ease;
    for (const g of this.gusts) { const u = time - g.t0; if (u > 0 && u < g.dur) w += g.mph * smooth(u / 0.4) * smooth((g.dur - u) / 0.7); }
    return w;
  }

  private step(dt: number) {
    const m = this.body.mass, g = 0.001, play = this.mode === 'play';
    this.t += dt;
    const prog = clamp(this.dist / TOTAL, 0, 1);
    if (play) {
      this.runT += dt; this.dist += (1.9 + 1.3 * prog) * dt;
      while (this.nextGust < this.t + 4) {
        const h = Math.random(), sign = (Math.random() < 0.78 ? 1 : -0.65) * Math.sign(this.cross);
        const peak = Math.max(7, this.wind.sustained + (this.wind.gust - this.wind.sustained) * (0.55 + 0.45 * h));
        const base = Math.abs(this.cross) * this.wind.sustained * 0.5;
        this.gusts.push({ t0: this.nextGust, dur: 1.5 + Math.random() * 0.9, mph: sign > 0 ? sign * Math.max(6, peak - base) : sign * peak, said: false });
        this.nextGust += 4.4 - 1.9 * prog + Math.random() * 1.6;
      }
      this.gusts = this.gusts.filter(q => q.t0 + q.dur > this.t - 0.5);
      for (const q of this.gusts) if (!q.said && q.t0 <= this.t) { q.said = true; this.onFx('gust'); }
      const blocks = Math.min(BLOCKS, Math.floor(this.dist / BLOCK));
      if (blocks > this.lastBlock) { this.lastBlock = blocks; this.onFx('block'); }
      if (this.dist >= TOTAL) this.finish(true);
    } else if (this.mode === 'idle') this.dist += 0.32 * dt;
    else this.dist += 0.9 * dt;

    // crew walks toward where the phone tilts: a damped spring, so no jerks
    this.steer += (this.steerT - this.steer) * Math.min(1, dt * 9);
    const tx = this.W / 2 + this.steer * this.W * 0.27;
    this.crewV += ((tx - this.crewX) * 62 - this.crewV * 15) * dt; this.crewX += this.crewV * dt; this.walk += (1.6 + Math.abs(this.crewV) * 0.02) * dt * (this.mode === 'idle' ? 2.2 : 5);

    const w = this.windAt(this.t), push = Math.tanh(w / 42) * this.b.drift;
    const sink = this.mode === 'over' && !this.finished ? 0.05 : 1;
    const lift = (0.62 + 0.38 * this.air) / this.b.weight * sink;
    Body.applyForce(this.body, this.body.position, { x: m * g * push, y: -m * g * (1 + lift) });
    for (const r of this.ropes) {
      r.hold = Math.max(0, r.hold - dt); r.slip = Math.max(0, r.slip - dt);
      r.pull += ((r.hold > 0 ? 1 : 0) - r.pull) * Math.min(1, dt * (r.hold > 0 ? 11 : 5));
      const len = r.seg * (1 - PULL * r.pull); for (const k of r.cons) k.length = len;
      const a = r.cons[0].pointA as Matter.Vector; a.x = this.crewX + r.side * this.spread - r.side * r.pull * 6;
      const p = this.body.position, off = r.cons[NODES].pointB as Matter.Vector;
      const d = Math.hypot(p.x + off.x - a.x, p.y + off.y - a.y), ratio = d / (r.seg * (NODES + 1));
      const raw = clamp((ratio - 0.99) / 0.085, 0, 0.75) + r.pull * 0.5 + Math.abs(push) * (Math.sign(push) === -r.side ? 0.1 : 0.45);
      r.tension += (clamp(raw, 0, 1.2) - r.tension) * Math.min(1, dt * 8);
      if (play) {
        r.hot = r.tension > 1 ? r.hot + dt : Math.max(0, r.hot - dt * 1.5);
        if (r.hot > 0.75) { r.hot = 0; r.hold = 0; r.slip = 1.3; this.air = Math.max(0, this.air - 0.05); this.shake = Math.max(this.shake, 0.5); this.onFx('slip'); }
      }
    }
    Engine.update(this.engine, dt * 1000);

    if (play) {
      const bx = (this.body.position.x - this.W / 2) / this.half, cr = this.R * 0.56 / this.half;
      for (const l of this.lamps) {
        if (l.done || l.z - this.dist > 0) continue; l.done = true;
        const tip = l.side * (1 - l.reach);
        if (l.side < 0 ? bx - cr < tip : bx + cr > tip) {
          this.hits++; this.air = Math.max(0, this.air - 0.22); this.shake = 1; this.flash = 1; this.onFx('hit');
          Body.setVelocity(this.body, { x: -l.side * 5.5, y: -1.5 });
        }
      }
      if (this.air <= 0) this.finish(false);
    }
    if (this.mode === 'over' && this.endIn > 0) { this.endIn -= dt; if (this.endIn <= 0) this.onEnd(this.result()); }
  }
  private result(): Result {
    const blocks = Math.min(BLOCKS, Math.floor(this.dist / BLOCK));
    return { blocks: this.finished ? BLOCKS : blocks, street: this.finished ? END_ST : START_ST - blocks, finished: this.finished, air: Math.round(this.air * 100), hits: this.hits, secs: Math.round(this.runT) };
  }
  private frozen: Result | null = null;
  private finish(ok: boolean) {
    if (this.mode !== 'play') return;
    this.finished = ok; this.frozen = this.result(); const fr = this.frozen; this.onEnd = ((orig) => (_r: Result) => orig(fr))(this.onEndRaw);
    this.mode = 'over'; this.endIn = ok ? 2.3 : 1.5; this.steerT = 0;
    if (ok) { this.onFx('finish'); this.confetti(170); }
  }
  /** Set by the app; wrapped so the result is the one from the moment the run ended. */
  onEndRaw: (r: Result) => void = () => { };
  private confetti(n: number) {
    if (this.reduce) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) this.bits.push({ x: Math.random() * this.W, y: -20 - Math.random() * this.H * 0.5, vx: (Math.random() - 0.5) * 90, vy: 90 + Math.random() * 170, r: Math.random() * 6, vr: (Math.random() - 0.5) * 9, col: PARTY[i % PARTY.length], s: 5 + Math.random() * 6 });
  }
  /** For tests and the autopilot check. */
  debug() {
    const next = this.lamps.find(l => !l.done);
    return { mode: this.mode, bx: (this.body.position.x - this.W / 2) / this.half, by: this.body.position.y / this.H, air: this.air, dist: this.dist, wind: this.windAt(this.t), soon: this.windAt(this.t + 1), tension: Math.max(...this.ropes.map(r => r.tension)), next: next && { side: next.side, reach: next.reach, rel: next.z - this.dist }, cr: this.R * 0.56 / this.half, hits: this.hits };
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000); this.last = now;
    if (!this.W) { this.resize(); return; }
    if (!this.paused) { this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n++ < 4) { this.step(1 / 60); this.acc -= 1 / 60; } if (n >= 4) this.acc = 0; }
    this.shift += (this.shiftT - this.shift) * Math.min(1, dt * 5); this.airShown += (this.air - this.airShown) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - dt * 2.6); this.flash = Math.max(0, this.flash - dt * 3.5); this.fade = Math.max(0, this.fade - dt * 2.4);
    this.draw(dt);
    if (this.mode !== 'idle') {
      const soon = this.windAt(this.t + 1.2), nowW = this.windAt(this.t), blocks = Math.min(BLOCKS, Math.floor(this.dist / BLOCK));
      this.onHud({ blocks, street: START_ST - blocks, air: this.airShown, tension: Math.max(this.ropes[0].tension, this.ropes[1].tension), wind: nowW, warn: Math.abs(soon) - Math.abs(nowW) > 3.5 || Math.sign(soon) !== Math.sign(nowW) && Math.abs(soon) > 5 ? soon : 0, progress: clamp(this.dist / TOTAL, 0, 1), slip: this.ropes[0].slip > 0 ? -1 : this.ropes[1].slip > 0 ? 1 : 0 });
    }
  }

  // ---------- drawing ----------
  private P(x: number, h: number, rel: number): [number, number, number] { const s = 1 / rel; return [this.W / 2 + x * this.half * s, this.hor + (this.gY - this.hor) * s - h * this.half * s, s]; }
  private quad(a: number[], b: number[], d: number[], e: number[]) { const c = this.c; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath(); }
  private fog(col: string, rel: number) { return mix(col, FOG, clamp((rel - 1.2) / 19, 0, 0.86)); }

  private draw(dt: number) {
    const c = this.c, W = this.W, H = this.H, t = this.t;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#8FB5FF'); sky.addColorStop(1, '#DCE8FF');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sh = this.shake * this.shake * 9;
    c.save(); c.translate(Math.sin(t * 61) * sh, this.shift * H * 0.19 + Math.cos(t * 53) * sh);
    // sun haze and clouds
    const sun = c.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, W * 0.7); sun.addColorStop(0, 'rgba(255,246,232,.75)'); sun.addColorStop(1, 'rgba(255,246,232,0)'); c.fillStyle = sun; c.fillRect(0, -40, W, H * 0.7);
    for (let i = 0; i < 4; i++) { const x = ((hash(i + 5) * W * 1.6 + t * (4 + i * 2)) % (W * 1.6)) - W * 0.3, y = H * (0.05 + hash(i + 11) * 0.2); this.cloud(x, y, 34 + hash(i + 3) * 26); }
    this.ground(); this.buildings();
    const flagW = this.windAt(t + 1.2);
    this.crowd();
    const near: Lamp[] = [];
    const fin = TOTAL - this.dist + 1;
    if (this.mode !== 'idle' && fin >= 1 && fin < 24) this.arch(fin);
    if (this.mode !== 'idle') for (let i = this.lamps.length - 1; i >= 0; i--) { const l = this.lamps[i], rel = l.z - this.dist + 1; if (rel > 22 || rel < 0.42) continue; if (rel < 1) near.push(l); else this.lamp(l, rel, flagW); }
    else for (let k = Math.floor(this.dist / 2) + 10; k >= Math.floor(this.dist / 2); k--) { const rel = k * 2 + 1 - this.dist + 1; if (rel > 0.45) this.lamp({ z: 0, side: k % 2 ? 1 : -1, reach: 0.14, done: false }, rel, flagW); }
    this.streak(dt);
    this.balloon();
    for (const l of near) this.lamp(l, l.z - this.dist + 1, flagW);
    if (this.mode !== 'idle' && fin < 1 && fin > 0.42) this.arch(fin);
    c.restore();
    if (this.bits.length) this.drawBits(dt);
    if (this.flash > 0) { c.fillStyle = `rgba(255,246,232,${this.flash * 0.5})`; c.fillRect(0, 0, W, H); }
    if (this.fade > 0) { c.fillStyle = `rgba(220,232,255,${smooth(this.fade)})`; c.fillRect(0, 0, W, H); }
  }
  private cloud(x: number, y: number, r: number) {
    const c = this.c;
    for (const [dx, dy, k] of [[0, 0, 1], [-0.9, 0.18, 0.7], [0.95, 0.14, 0.78], [0.3, -0.35, 0.72]]) {
      const g = c.createRadialGradient(x + dx * r, y + dy * r, 0, x + dx * r, y + dy * r, r * k); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x + dx * r, y + dy * r, r * k, 0, 7); c.fill();
    }
  }
  private ground() {
    const c = this.c, W = this.W, H = this.H, hor = this.hor;
    const g = c.createLinearGradient(0, hor, 0, H); g.addColorStop(0, FOG); g.addColorStop(0.16, '#A9A8BE'); g.addColorStop(1, '#6A6880');
    c.fillStyle = g; c.fillRect(-40, hor, W + 80, H - hor + 120);
    for (const s of [-1, 1]) { // sidewalks
      const sw = c.createLinearGradient(0, hor, 0, H); sw.addColorStop(0, FOG); sw.addColorStop(0.2, '#E4D6C6'); sw.addColorStop(1, '#D2BCA6');
      c.fillStyle = sw; c.beginPath(); this.quad(this.P(s, 0, 60), this.P(s * 1.36, 0, 60), this.P(s * 1.36, 0, 0.4), this.P(s, 0, 0.4)); c.fill();
      c.strokeStyle = 'rgba(31,35,64,.25)'; c.lineWidth = 2; c.beginPath(); const a = this.P(s, 0, 60), b = this.P(s, 0, 0.4); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    const z0 = Math.floor(this.dist);
    c.fillStyle = 'rgba(255,246,232,.8)'; c.beginPath();
    for (let z = z0 + 24; z >= z0 - 1; z--) { // lane dashes and crosswalks
      const r0 = z - this.dist + 1, r1 = r0 + 0.45; if (r0 < 0.42) continue;
      for (const x of [-0.34, 0.34]) this.quad(this.P(x - 0.018, 0, r0), this.P(x + 0.018, 0, r0), this.P(x + 0.018, 0, r1), this.P(x - 0.018, 0, r1));
      if (z % BLOCK === 0) for (let i = -5; i < 5; i++) { const x = i * 0.19 + 0.03; this.quad(this.P(x, 0, r0 + 0.08), this.P(x + 0.11, 0, r0 + 0.08), this.P(x + 0.11, 0, r0 + 0.5), this.P(x, 0, r0 + 0.5)); }
    }
    c.fill();
    c.fillStyle = 'rgba(217,169,46,.85)'; c.beginPath(); this.quad(this.P(-0.022, 0, 60), this.P(0.022, 0, 60), this.P(0.022, 0, 0.4), this.P(-0.022, 0, 0.4)); c.fill();
  }
  private buildings() {
    const c = this.c, kb = Math.floor((this.dist - 1) / BLOCK);
    for (let k = kb + 7; k >= kb; k--) for (let j = 1; j >= 0; j--) for (const s of [-1, 1]) {
      const z0 = k * BLOCK + 0.62 + j * 1.72, z1 = z0 + 1.62, id = k * 4 + j * 2 + (s > 0 ? 1 : 0);
      const r1 = z1 - this.dist + 1, r0 = Math.max(0.36, z0 - this.dist + 1); if (r1 < 0.4) continue;
      const h = 2.6 + hash(id) * 3.4, base = WALLS[Math.floor(hash(id + 77) * WALLS.length)], x = s * 1.36;
      const rm = (r0 + r1) / 2, wall = this.fog(mix(base, s > 0 ? '#FFF6E8' : INK, s > 0 ? 0.14 : 0.2), rm), front = this.fog(mix(base, INK, 0.08), r0);
      if (z0 - this.dist + 1 > 0.36) { // the face on the cross street
        const a = this.P(x, 0, r0), b = this.P(x, h, r0), far = s * (this.W + 80);
        c.fillStyle = front; c.fillRect(Math.min(a[0], this.W / 2 + far), b[1], Math.abs(this.W / 2 + far - a[0]), a[1] - b[1]);
        if (r0 < 6.5) {
          c.fillStyle = this.fog('#33426E', r0); c.beginPath();
          const u = this.half * a[2];
          for (let f = 1; f * 0.42 + 0.3 < h; f++) for (let q = 0; q < 6; q++) { const wx = a[0] + s * (0.12 + q * 0.34) * u; c.rect(Math.min(wx, wx + s * 0.2 * u), a[1] - (f * 0.42 + 0.3) * u, 0.2 * u, 0.24 * u); }
          c.fill();
        }
      }
      c.fillStyle = wall; c.beginPath(); this.quad(this.P(x, 0, r0), this.P(x, 0, r1), this.P(x, h, r1), this.P(x, h, r0)); c.fill();
      // shop level with an awning stripe
      c.fillStyle = this.fog(mix(base, INK, 0.45), rm); c.beginPath(); this.quad(this.P(x, 0, r0), this.P(x, 0, r1), this.P(x, 0.4, r1), this.P(x, 0.4, r0)); c.fill();
      c.fillStyle = this.fog(PARTY[((id % 3) + 3) % 3], rm); c.beginPath(); this.quad(this.P(x, 0.4, r0), this.P(x, 0.4, r1), this.P(x, 0.5, r1), this.P(x, 0.5, r0)); c.fill();
      if (r0 < 13) { // window grid
        const cols = 4, lit: number[][][] = [];
        c.fillStyle = this.fog(s > 0 ? '#3A4A7A' : '#2A3560', rm); c.beginPath();
        for (let f = 0; 0.72 + f * 0.42 + 0.3 < h; f++) for (let q = 0; q < cols; q++) {
          const za = z0 + (q + 0.2) / cols * (z1 - z0) - this.dist + 1, zb = z0 + (q + 0.8) / cols * (z1 - z0) - this.dist + 1; if (za < 0.36) continue;
          const lo = 0.72 + f * 0.42, pts = [this.P(x, lo, za), this.P(x, lo, zb), this.P(x, lo + 0.26, zb), this.P(x, lo + 0.26, za)];
          if (hash(id * 131 + f * 7 + q) < 0.14) lit.push(pts); else this.quad(pts[0], pts[1], pts[2], pts[3]);
        }
        c.fill();
        if (lit.length) { c.fillStyle = this.fog('#F1CF6B', rm); c.beginPath(); for (const p of lit) this.quad(p[0], p[1], p[2], p[3]); c.fill(); }
      }
      // roof line catches the light
      const ra = this.P(x, h, r0), rb = this.P(x, h, r1); c.strokeStyle = this.fog('#FFF6E8', rm); c.globalAlpha = 0.6; c.lineWidth = Math.max(1, 3 * ra[2]); c.beginPath(); c.moveTo(ra[0], ra[1]); c.lineTo(rb[0], rb[1]); c.stroke(); c.globalAlpha = 1;
    }
  }
  private crowd() {
    const c = this.c, i0 = Math.floor(this.dist / 0.3);
    for (let i = i0 + 30; i >= i0 - 1; i--) {
      const z = i * 0.3, rel = z - this.dist + 1; if (rel < 0.45 || ((z % BLOCK) + BLOCK) % BLOCK < 0.6) continue;
      for (const s of [-1, 1]) {
        const id = i * 2 + (s > 0 ? 1 : 0), x = s * (1.12 + hash(id) * 0.16), [px, py, sc] = this.P(x, 0, rel), u = this.half * sc, bob = Math.abs(Math.sin(this.t * 3 + id)) * 0.02 * u;
        c.fillStyle = this.fog(PARTY[(id & 3)], rel); c.beginPath(); c.ellipse(px, py - 0.1 * u - bob, 0.05 * u, 0.1 * u, 0, 0, 7); c.fill();
        c.fillStyle = this.fog(['#E9B58C', '#C68F66', '#8D5B3E', '#F2CDAA'][id & 3], rel); c.beginPath(); c.arc(px, py - 0.23 * u - bob, 0.038 * u, 0, 7); c.fill();
      }
    }
    for (const s of [-1, 1]) { const a = this.P(s * 1.03, 0.11, 40), b = this.P(s * 1.03, 0.11, 0.42); c.strokeStyle = 'rgba(255,246,232,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }
  private lamp(l: Lamp, rel: number, flagW: number) {
    const c = this.c, x = l.side * 1.05, [bx, by, s] = this.P(x, 0, rel), u = this.half * s, col = this.fog(INK, rel);
    const top = this.P(x, 2.5, rel), tip = this.P(l.side * (1 - l.reach), 2.38, rel);
    c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = Math.max(1.2, 0.05 * u);
    c.beginPath(); c.moveTo(bx, by); c.lineTo(top[0], top[1]); c.stroke();
    c.lineWidth = Math.max(1, 0.04 * u); c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo((top[0] + tip[0]) / 2, top[1] - 0.22 * u, tip[0], tip[1]); c.stroke();
    const gl = c.createRadialGradient(tip[0], tip[1] + 0.05 * u, 0, tip[0], tip[1] + 0.05 * u, 0.2 * u); gl.addColorStop(0, 'rgba(255,236,170,.95)'); gl.addColorStop(0.35, 'rgba(241,207,107,.6)'); gl.addColorStop(1, 'rgba(241,207,107,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(tip[0], tip[1] + 0.05 * u, 0.2 * u, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(tip[0], tip[1], 0.085 * u, 0.04 * u, 0, 0, 7); c.fill();
    // the flag: it leans the way the next gust will blow, before the gust arrives
    const f = clamp(flagW / 22, -1.25, 1.25), af = Math.abs(f), wave = Math.sin(this.t * 10 + rel * 3) * 0.035 * af;
    const p1 = this.P(x, 1.72, rel), p2 = this.P(x, 1.42, rel), tipF = this.P(x + f * 0.4, 1.57 - (1 - Math.min(1, af)) * 0.3 + wave, rel);
    c.fillStyle = this.fog(PARTY[Math.abs(Math.round(l.z * 3 + l.side)) % 3], rel); c.beginPath(); c.moveTo(p1[0], p1[1]); c.quadraticCurveTo((p1[0] + tipF[0]) / 2, p1[1] + wave * u * 2, tipF[0], tipF[1]); c.lineTo(p2[0], p2[1]); c.closePath(); c.fill();
  }
  private arch(rel: number) {
    const c = this.c, a = this.P(-1.05, 0, rel), b = this.P(1.05, 0, rel), ta = this.P(-1.05, 3.05, rel), u = this.half * a[2];
    c.strokeStyle = this.fog('#FF5FA2', rel); c.lineWidth = Math.max(2, 0.09 * u); c.lineCap = 'round';
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(ta[0], ta[1]); c.moveTo(b[0], b[1]); c.lineTo(b[0], ta[1]); c.stroke();
    c.fillStyle = this.fog('#FFF6E8', rel); c.fillRect(a[0], ta[1], b[0] - a[0], 0.46 * u);
    c.fillStyle = this.fog('#FF5FA2', rel); c.fillRect(a[0], ta[1], b[0] - a[0], 0.06 * u); c.fillRect(a[0], ta[1] + 0.4 * u, b[0] - a[0], 0.06 * u);
    c.fillStyle = this.fog(INK, rel); c.font = `${0.26 * u}px "TP Display", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('34th St · FINISH', (a[0] + b[0]) / 2, ta[1] + 0.24 * u);
  }
  private streak(dt: number) {
    const c = this.c, w = this.windAt(this.t), a = Math.abs(w);
    if (!this.reduce && a > 6 && Math.random() < a * dt * 0.9) this.streaks.push({ x: w > 0 ? -40 : this.W + 40, y: Math.random() * this.H * 0.62, l: 30 + Math.random() * 50, a: 1 });
    c.lineCap = 'round'; c.lineWidth = 1.6;
    this.streaks = this.streaks.filter(s => { s.x += w * 26 * dt; s.a -= dt * 0.8; if (s.a <= 0) return false; c.strokeStyle = `rgba(255,255,255,${s.a * 0.55})`; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - Math.sign(w) * s.l, s.y + 2); c.stroke(); return s.x > -90 && s.x < this.W + 90; });
  }
  private balloon() {
    const c = this.c, p = this.body.position, gY = this.gY, k = this.R / this.b.r;
    // shadow on the street
    const far = clamp((gY - p.y) / (this.H * 0.6), 0, 1);
    c.fillStyle = `rgba(31,35,64,${0.2 - far * 0.08})`; c.beginPath(); c.ellipse(p.x + 10, gY + 12, this.R * (0.75 + far * 0.25), this.R * 0.16, 0, 0, 7); c.fill();
    // ropes, drawn through the rope's physics points
    for (const r of this.ropes) {
      const a = r.cons[0].pointA as Matter.Vector, off = r.cons[NODES].pointB as Matter.Vector, pts = [a, ...r.nodes.map(n => n.position), { x: p.x + off.x, y: p.y + off.y }];
      for (const [col, lw] of [['rgba(31,35,64,.55)', 3.6], [r.slip > 0 ? '#FF5FA2' : '#FFF6E8', 2]] as [string, number][]) {
        c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); c.stroke();
      }
      // two lighter guide lines to the belly
      c.strokeStyle = 'rgba(255,246,232,.55)'; c.lineWidth = 1.1;
      for (const q of [-0.5, 0.5]) { c.beginPath(); c.moveTo(a.x + q * 26, a.y + 4); c.quadraticCurveTo((a.x + p.x) / 2 + r.side * 14, (a.y + p.y) / 2 + 30, p.x + off.x * (0.4 + q * 0.5), p.y + off.y * 1.05); c.stroke(); }
    }
    const lean = clamp((p.x - this.crewX) / (this.H * 0.45) * 0.55 + this.body.velocity.x * 0.012, -0.4, 0.4);
    c.save(); c.translate(p.x, p.y + Math.sin(this.t * 1.7) * 2.5); c.rotate(lean); c.scale(k, k); drawBalloon(c, this.b, this.t, this.airShown); c.restore();
    // handlers, three to a rope, seen from behind
    for (const r of this.ropes) {
      const a = r.cons[0].pointA as Matter.Vector;
      for (let i = -1; i <= 1; i++) this.handler(a.x + i * 15, gY + 6 + Math.abs(i) * 5, i === 0 ? '#FF5FA2' : r.side < 0 ? '#5DBA6A' : '#D9A92E', this.walk + i * 1.7 + r.side, -r.side * r.pull * 0.28 + clamp(this.crewV * 0.0012, -0.2, 0.2), a.x, a.y);
    }
  }
  private handler(x: number, y: number, col: string, ph: number, lean: number, hx: number, hy: number) {
    const c = this.c, s = clamp(this.W / 375, 0.85, 1.3), sw = Math.sin(ph) * 4;
    c.strokeStyle = 'rgba(255,246,232,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y - 30 * s); c.lineTo(hx, hy); c.stroke();
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(lean);
    c.fillStyle = 'rgba(31,35,64,.2)'; c.beginPath(); c.ellipse(2, 1, 9, 3, 0, 0, 7); c.fill();
    c.strokeStyle = '#2B3160'; c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, -13); c.lineTo(-3 + sw, -1); c.moveTo(3, -13); c.lineTo(3 - sw, -1); c.stroke();
    const g = c.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, mix(col, '#FFFFFF', 0.3)); g.addColorStop(1, mix(col, INK, 0.3));
    c.fillStyle = g; c.beginPath(); c.roundRect(-7, -31, 14, 20, 6); c.fill();
    c.strokeStyle = mix(col, INK, 0.2); c.lineWidth = 3.4; c.beginPath(); c.moveTo(-6, -27); c.lineTo(-2, -38); c.moveTo(6, -27); c.lineTo(2, -38); c.stroke();
    c.fillStyle = '#D9A07A'; c.beginPath(); c.arc(0, -36, 5.4, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(0, -37.5, 5.6, Math.PI, 0); c.fill();
    c.restore();
  }
  private drawBits(dt: number) {
    const c = this.c;
    this.bits = this.bits.filter(b => {
      b.vy += 60 * dt; b.x += (b.vx + Math.sin(this.t * 3 + b.r) * 30) * dt; b.y += b.vy * dt * 0.8; b.r += b.vr * dt;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.scale(1, Math.cos(b.r * 1.7)); c.fillStyle = b.col; c.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66); c.restore();
      return b.y < this.H + 30;
    });
  }
}
