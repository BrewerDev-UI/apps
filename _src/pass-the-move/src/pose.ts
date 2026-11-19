// The dancer's body, the 24 moves, and the scoring. All original; no code from other projects.
// Angles are degrees in the flat "mirror" plane: 0 hangs straight down, 90 points out to that side, 180 is straight up.
// "L" is the left side of the screen. You mirror the dancer, so screen-left is your left arm too.

export type Pose = { a: number[]; l: number; x: number; h: number; t: number };
export type Move = { id: string; name: string; cue: string; bpm: number; hard: 1 | 2 | 3; poses: Pose[]; combo?: boolean; w: number[] };
type V3 = [number, number, number];
export type Joints = Record<'hipC' | 'shC' | 'lHip' | 'rHip' | 'lSh' | 'rSh' | 'lEl' | 'rEl' | 'lWr' | 'rWr' | 'lKn' | 'rKn' | 'lAn' | 'rAn' | 'neck' | 'head', V3>;

type Pair = [number, number];
const D: Pair = [8, 5], T: Pair = [90, 90], V: Pair = [150, 150], UP: Pair = [176, 178], CAC: Pair = [90, 180], LOW: Pair = [90, 0], HIP: Pair = [52, -42],
  FLEX: Pair = [92, 205], TOP: Pair = [160, 202], CH: Pair = [40, -80], DU: Pair = [135, 135], DD: Pair = [45, 45], XU: Pair = [205, 205], XD: Pair = [-22, -38],
  WD: Pair = [60, -115], WU: Pair = [105, -100], SP: Pair = [70, 140], AX: Pair = [-88, -90];
const st: Pair = [3, 0], wd: Pair = [18, 18], sq: Pair = [42, -6], dsq: Pair = [58, -14], kn: Pair = [82, 4], kk: Pair = [58, 58], bend: Pair = [48, 0], str: Pair = [32, 32],
  tp: Pair = [14, 14], star: Pair = [28, 28], knock: Pair = [-6, 22];
type X = { l?: number; x?: number; h?: number; t?: number };
const p = (l: Pair, r: Pair, ll: Pair = st, rl: Pair = st, e: X = {}): Pose => ({ a: [...l, ...r, ...ll, ...rl], l: e.l || 0, x: e.x || 0, h: e.h || 0, t: e.t || 0 });

const raw: [string, string, number, 1 | 2 | 3, Pose[]][] = [
  ['Window Wiper', 'Both arms up, wipe side to side', 112, 1, [p(DU, XU, st, st, { l: -8 }), p(XU, DU, st, st, { l: 8 }), p(DU, XU, tp, st, { l: -8 }), p(UP, UP, st, st, { h: 0.12 })]],
  ['Pizza Toss', 'Dip, then toss it high', 108, 1, [p(CAC, HIP, sq, sq), p(UP, HIP), p(HIP, CAC, sq, sq), p(HIP, UP)]],
  ['Sunrise Pop', 'Start low, open up, reach the sky', 104, 1, [p(D, D, sq, sq), p(T, T), p(V, V, wd, wd, { h: 0.1 }), p(TOP, TOP)]],
  ['Robot Lunch', 'Square elbows, swap, swap', 116, 1, [p(CAC, LOW, st, st, { t: 14 }), p(LOW, CAC, st, st, { t: -14 }), p(CAC, CAC, wd, wd), p(LOW, LOW, sq, sq)]],
  ['Jelly Knees', 'Knees out, knees in', 120, 2, [p(HIP, HIP, dsq, dsq), p(T, T, knock, knock), p(HIP, HIP, dsq, dsq), p(V, V, knock, knock)]],
  ['Traffic Cop', 'One arm out, one arm up', 112, 1, [p(T, UP, st, st, { l: 5 }), p(UP, T, st, st, { l: -5 }), p(CH, T, wd, wd, { t: 18 }), p(T, CH, wd, wd, { t: -18 })]],
  ['Starfish Snap', 'Jump wide, tuck in tight', 124, 2, [p(DU, DU, star, star, { h: 0.14 }), p(CH, CH, sq, sq), p(DU, DU, star, star, { h: 0.14 }), p(UP, UP, st, st, { h: 0.1 })]],
  ['Lasso Loop', 'Hand on hip, spin the rope', 116, 2, [p(HIP, [165, 235], st, tp, { l: -6 }), p(HIP, [165, 125], tp, st, { l: 6 }), p(HIP, [165, 235], st, tp, { l: -6 }), p(T, UP, wd, wd)]],
  ['Teapot Tip', 'Handle, spout, pour', 100, 1, [p(HIP, SP), p(HIP, SP, st, tp, { l: 18 }), p(SP, HIP), p(SP, HIP, tp, st, { l: -18 })]],
  ['Zigzag Zap', 'One long diagonal, flip it', 120, 1, [p(DU, DD, st, st, { l: 6 }), p(DD, DU, st, st, { l: -6 }), p(DU, DD, wd, wd, { l: 6, h: 0.06 }), p(DD, DU, wd, wd, { l: -6, h: 0.06 })]],
  ['Shelf Stacker', 'Grab it low, stack it high', 108, 2, [p(DU, XU, st, tp, { l: -10 }), p(XD, DD, sq, sq, { l: 10 }), p(XU, DU, tp, st, { l: 10 }), p(DD, XD, sq, sq, { l: -10 })]],
  ['Kick Flick', 'Kick out, arm up on the far side', 116, 2, [p(HIP, UP, kk, st, { l: 8 }), p(D, D, sq, sq), p(UP, HIP, st, kk, { l: -8 }), p(D, D, sq, sq)]],
  ['Flamingo Flex', 'Knee up, hold it, hands high', 100, 3, [p(T, T, kn, st), p(TOP, TOP), p(T, T, st, kn), p(TOP, TOP)]],
  ['Box Builder', 'Tap the four corners of a box', 124, 2, [p(DU, XU, st, st, { l: -6 }), p(XU, DU, st, st, { l: 6 }), p(XD, DD, sq, sq, { l: 6 }), p(DD, XD, sq, sq, { l: -6 })]],
  ['Muscle Museum', 'Flex, aim left, aim right, crab', 104, 1, [p(FLEX, FLEX, wd, wd), p(FLEX, T, bend, str, { x: -0.08 }), p(T, FLEX, str, bend, { x: 0.08 }), p([60, -60], [60, -60], sq, sq)]],
  ['Rain Shaker', 'Hands high, shake it down', 128, 1, [p(V, V, st, st, { l: -10 }), p(CAC, CAC, sq, sq), p(V, V, st, st, { l: 10 }), p(CAC, CAC, sq, sq)]],
  ['Sidewalk Skater', 'Glide left, glide right', 112, 3, [p([75, 75], [-20, -70], bend, [25, 70], { x: -0.1, l: -12 }), p([-20, -70], [75, 75], [25, 70], bend, { x: 0.1, l: 12 }), p([120, 120], [-20, -70], bend, [25, 70], { x: -0.1, l: -12 }), p([-20, -70], [120, 120], [25, 70], bend, { x: 0.1, l: 12 })]],
  ['Cactus Clap', 'Cactus arms, clap up top', 120, 1, [p(CAC, CAC, wd, wd), p(TOP, TOP), p(CAC, CAC, sq, sq), p(TOP, TOP, st, st, { h: 0.1 })]],
  ['Wing It', 'Flap low, flap high, take off', 124, 1, [p(WD, WD, sq, sq), p(WU, WU), p(WD, WD, sq, sq), p(T, T, wd, wd, { h: 0.08 })]],
  ['Rocket Launch', 'Crouch, crouch lower, blast off', 108, 2, [p(HIP, HIP, sq, sq), p(TOP, TOP, dsq, dsq), p(UP, UP, st, st, { h: 0.22 }), p(DU, DU, star, star, { h: 0.1 })]],
  ['Compass Point', 'Point north, east, south, west', 116, 2, [p(UP, UP), p(AX, T, st, tp, { t: -16 }), p(D, D, sq, sq), p(T, AX, tp, st, { t: 16 })]],
  ['Wobble Tower', 'Hands together, lean and dip', 104, 1, [p([160, 186], [196, 218], st, st, { l: -16 }), p(TOP, TOP, sq, sq), p([196, 218], [160, 186], st, st, { l: 16 }), p(TOP, TOP, sq, sq)]],
  ['Slow-Mo Hero', 'Fist up, hands on hips, flex', 100, 2, [p(HIP, UP, bend, str, { x: -0.08 }), p(HIP, HIP, wd, wd), p(UP, HIP, str, bend, { x: 0.08 }), p(FLEX, FLEX, sq, sq)]],
  ['Seaweed Sway', 'Loose arms, drift with the tide', 104, 2, [p([120, 170], [60, 20], st, tp, { l: -10 }), p([60, 20], [120, 170], tp, st, { l: 10 }), p([150, 200], [100, 60], st, tp, { l: -10 }), p([100, 60], [150, 200], tp, st, { l: 10 })]],
];
const BASE_W = [1.4, 1.2, 1.4, 1.2, 1, 0.8, 1, 0.8];
function mk(name: string, cue: string, bpm: number, hard: 1 | 2 | 3, poses: Pose[], combo = false): Move {
  // Limbs that never move in this move count for less, so standing still can't score well.
  const w = BASE_W.map((b, i) => { const v = poses.map(q => q.a[i]); return Math.max(...v) - Math.min(...v) < 12 ? b * 0.35 : b; });
  return { id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, cue, bpm, hard, poses, combo, w };
}
const SINGLES = raw.map(r => mk(...r));
const by = (n: string) => SINGLES.find(m => m.name === n)!;
const combo = (name: string, a: string, b: string, bpm: number): Move => mk(name, `${a}, then ${b}`, bpm, 3, [...by(a).poses, ...by(b).poses], true);
export const MOVES: Move[] = [...SINGLES,
  combo('Cop & Cactus', 'Traffic Cop', 'Cactus Clap', 112), combo('Rocket Wiper', 'Rocket Launch', 'Window Wiper', 108), combo('Jelly Starfish', 'Jelly Knees', 'Starfish Snap', 116),
  combo('Pizza Robot', 'Pizza Toss', 'Robot Lunch', 108), combo('Hero Wings', 'Slow-Mo Hero', 'Wing It', 104), combo('Zap Tower', 'Zigzag Zap', 'Wobble Tower', 112)];
export const movesFor = (kid: boolean) => MOVES.filter(m => (kid ? m.hard === 1 && !m.combo : true));
export const bpmFor = (m: Move, kid: boolean) => (kid ? Math.min(m.bpm, 104) - 4 : m.bpm);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { a: a.a.map((v, i) => mix(v, b.a[i], t)), l: mix(a.l, b.l, t), x: mix(a.x, b.x, t), h: mix(a.h, b.h, t), t: mix(a.t, b.t, t) };
}
/** The pose at a beat position. Each key pose lands exactly on its beat, holds a moment, then travels to the next. */
export function poseAt(m: Move, beat: number): Pose {
  const n = m.poses.length, b = ((beat % n) + n) % n, i = Math.floor(b), f = b - i;
  const q = lerpPose(m.poses[i], m.poses[(i + 1) % n], ease(Math.min(1, Math.max(0, (f - 0.38) / 0.62))));
  q.h += -0.035 * Math.exp(-f * 7) * Math.cos(f * 9); // a little clay squash on every beat
  return q;
}
export const REST: Pose = p(D, D);

const rad = Math.PI / 180;
const LEN = { ua: 0.28, fa: 0.26, th: 0.43, sh: 0.42, spine: 0.52, hipW: 0.105, shW: 0.2 };
/** Works out where every joint sits, with the lowest foot on the floor (y = 0). Screen-left is -x. */
export function joints(q: Pose): Joints {
  const s = (side: -1 | 1, from: V3, ang: number, len: number): V3 => [from[0] + side * Math.sin(ang * rad) * len, from[1] - Math.cos(ang * rad) * len, from[2]];
  const hipC: V3 = [q.x, 0, 0], ln = q.l * rad, tw = q.t * rad;
  const up: V3 = [Math.sin(ln), Math.cos(ln), 0], across: V3 = [Math.cos(ln), -Math.sin(ln), 0];
  const shC: V3 = [hipC[0] + up[0] * LEN.spine, up[1] * LEN.spine, 0];
  const sh = (side: -1 | 1): V3 => [shC[0] + side * across[0] * LEN.shW * Math.cos(tw), shC[1] + side * across[1] * LEN.shW * Math.cos(tw), -side * Math.sin(tw) * LEN.shW];
  const lSh = sh(-1), rSh = sh(1), lHip: V3 = [hipC[0] - LEN.hipW, 0, 0], rHip: V3 = [hipC[0] + LEN.hipW, 0, 0];
  const lEl = s(-1, lSh, q.a[0], LEN.ua), lWr = s(-1, lEl, q.a[1], LEN.fa), rEl = s(1, rSh, q.a[2], LEN.ua), rWr = s(1, rEl, q.a[3], LEN.fa);
  const lKn = s(-1, lHip, q.a[4], LEN.th), lAn = s(-1, lKn, q.a[5], LEN.sh), rKn = s(1, rHip, q.a[6], LEN.th), rAn = s(1, rKn, q.a[7], LEN.sh);
  const neck: V3 = [shC[0] + up[0] * 0.09, shC[1] + up[1] * 0.09, 0], head: V3 = [shC[0] + up[0] * 0.25, shC[1] + up[1] * 0.25, 0.01];
  const J: Joints = { hipC, shC, lHip, rHip, lSh, rSh, lEl, rEl, lWr, rWr, lKn, rKn, lAn, rAn, neck, head };
  const lift = 0.075 + Math.max(0, q.h) + Math.min(0, q.h) - Math.min(lAn[1], rAn[1]);
  for (const k in J) (J as any)[k][1] += lift;
  return J;
}

// ---------- Scoring ----------
/** A point on the screen in pixels, already mirrored. v is how sure the camera is (0 to 1). */
export type Pt = { x: number; y: number; v: number };
export type Body = Record<'lSh' | 'rSh' | 'lEl' | 'rEl' | 'lWr' | 'rWr' | 'lHip' | 'rHip' | 'lKn' | 'rKn' | 'lAn' | 'rAn', Pt>;
export const SEGS: [keyof Body, keyof Body, -1 | 1, string][] = [
  ['lSh', 'lEl', -1, 'Left arm'], ['lEl', 'lWr', -1, 'Left hand'], ['rSh', 'rEl', 1, 'Right arm'], ['rEl', 'rWr', 1, 'Right hand'],
  ['lHip', 'lKn', -1, 'Left knee'], ['lKn', 'lAn', -1, 'Left foot'], ['rHip', 'rKn', 1, 'Right knee'], ['rKn', 'rAn', 1, 'Right foot']];
const diff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export type Judged = { score: number; seen: boolean; legs: boolean; seg: number[]; worst: number; tip: string };
/** Compares the eight limb angles to the target pose. 0 to 100. */
export function judge(body: Body | null, target: Pose, w: number[], kid: boolean): Judged {
  if (!body) return { score: 0, seen: false, legs: false, seg: [], worst: -1, tip: 'Step back so I can see you' };
  const tol = kid ? 22 : 14, zero = kid ? 100 : 78, seg: number[] = [];
  let sum = 0, tot = 0, worst = -1, worstLoss = 0, armsSeen = 0, legsSeen = 0, tip = '';
  SEGS.forEach(([a, b, side], i) => {
    const A = body[a], B = body[b];
    if (A.v < 0.45 || B.v < 0.45) { seg.push(-1); return; }
    if (i < 4) armsSeen++; else legsSeen++;
    const ang = Math.atan2(side * (B.x - A.x), B.y - A.y) / rad, d = diff(ang, target.a[i]);
    const s = Math.min(1, Math.max(0, 1 - (d - tol) / (zero - tol)));
    seg.push(s); sum += s * w[i]; tot += w[i];
    const loss = (1 - s) * w[i];
    if (loss > worstLoss && s < 0.8) {
      worstLoss = loss; worst = i;
      // Which way to fix it: compare how high the far end should be.
      const want = -Math.cos(target.a[i] * rad), have = -Math.cos(ang * rad), name = SEGS[i][3];
      tip = Math.abs(want - have) > 0.3 ? `${name} ${want > have ? 'higher' : 'lower'}` : `${name} ${Math.sin(target.a[i] * rad) > Math.sin(ang * rad) ? 'further out' : 'further in'}`;
    }
  });
  if (armsSeen < 2) return { score: 0, seen: false, legs: false, seg, worst: -1, tip: 'Step back so I can see you' };
  const score = Math.round(100 * Math.pow(sum / tot, 0.85));
  return { score, seen: true, legs: legsSeen >= 2, seg, worst, tip: tip || (score >= 90 ? 'Spot on' : 'Nice, hold it') };
}
/** Turns the dancer's joints into screen points, for the no-camera demo. */
export function bodyFrom(J: Joints, cx: number, floorY: number, scale: number, wobble: (i: number) => number): Body {
  const keys: (keyof Body)[] = ['lSh', 'rSh', 'lEl', 'rEl', 'lWr', 'rWr', 'lHip', 'rHip', 'lKn', 'rKn', 'lAn', 'rAn'];
  const out = {} as Body;
  keys.forEach((k, i) => { const j = J[k]; out[k] = { x: cx + j[0] * scale + wobble(i * 2), y: floorY - j[1] * scale + wobble(i * 2 + 1), v: 1 }; });
  return out;
}
export const verdict = (s: number) => (s >= 90 ? 'Nailed it' : s >= 75 ? 'So close' : s >= 55 ? 'Getting there' : s >= 30 ? 'Loose but brave' : 'Was that the move?');
