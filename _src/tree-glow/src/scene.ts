// Draws the tree. Used for the sample tree and the placeholder photos for "Tree goes up".
export type Bulb = { x: number; y: number; c: string };

export const TREE = { top: 0.12, base: 0.8, half: 0.34 };
const BULB_COLS = ['#F2C46B', '#FFF3DC', '#E7894F', '#E0584B', '#A6DDA8', '#9CCBFF'];

// Half the tree's width at t (0 = top, 1 = base), as a fraction of the frame width.
export function treeHalfAt(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return TREE.half * k * (1 + 0.06 * Math.sin(k * 31));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bulbsFor(count: number, seed: number): Bulb[] {
  const rnd = mulberry32(seed);
  const out: Bulb[] = [];
  let tries = 0;
  while (out.length < count && tries < 40000) {
    tries++;
    const t = 0.06 + rnd() * 0.9;
    const y = TREE.top + t * (TREE.base - TREE.top);
    const x = 0.5 + (rnd() * 2 - 1) * treeHalfAt(t) * 0.9;
    if (out.some((p) => Math.hypot((p.x - x) * 0.75, p.y - y) < 0.03)) continue;
    out.push({ x, y, c: BULB_COLS[Math.floor(rnd() * BULB_COLS.length)] });
  }
  return out;
}

function treePath(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = (TREE.top + t * (TREE.base - TREE.top)) * h;
    const half = treeHalfAt(t) * w;
    if (i === 0) g.moveTo(w / 2, y);
    else g.lineTo(w / 2 - half, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = (TREE.top + t * (TREE.base - TREE.top)) * h;
    g.lineTo(w / 2 + treeHalfAt(t) * w, y);
  }
  g.closePath();
}

function dusk(g: CanvasRenderingContext2D, w: number, h: number) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2A1E26');
  sky.addColorStop(0.7, '#3A2A31');
  sky.addColorStop(1, '#4A3440');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#EEF2EE';
  g.beginPath();
  g.ellipse(w / 2, h * 0.98, w * 0.7, h * 0.12, 0, 0, Math.PI * 2);
  g.globalAlpha = 0.85;
  g.fill();
  g.globalAlpha = 1;
}

function branch(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, depth: number) {
  if (depth === 0 || len < 4) return;
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  g.lineWidth = Math.max(1, depth * 1.4);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x2, y2);
  g.stroke();
  branch(g, x2, y2, len * 0.7, ang - 0.5, depth - 1);
  branch(g, x2, y2, len * 0.7, ang + 0.5, depth - 1);
}

// kind 0 = bare tree, 1 = lit tree, 2 = finished tree with star and gifts.
export function drawPhoto(kind: 0 | 1 | 2, w: number, h: number, bulbs: Bulb[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return c;
  dusk(g, w, h);
  if (kind === 0) {
    g.strokeStyle = '#6B4A3A';
    g.lineCap = 'round';
    branch(g, w / 2, h * 0.8, h * 0.22, -Math.PI / 2, 7);
    g.fillStyle = '#5A3E33';
    g.fillRect(w / 2 - w * 0.02, h * 0.8, w * 0.04, h * 0.14);
    return c;
  }
  g.fillStyle = '#2E4A3A';
  treePath(g, w, h);
  g.fill();
  g.fillStyle = '#5A3E33';
  g.fillRect(w / 2 - w * 0.02, h * 0.79, w * 0.04, h * 0.1);
  const r = Math.max(2, w * 0.011);
  for (const b of bulbs) {
    const x = b.x * w;
    const y = b.y * h;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
    halo.addColorStop(0, b.c + 'AA');
    halo.addColorStop(1, b.c + '00');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, r * 3.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = b.c;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (kind === 2) {
    const sx = w / 2;
    const sy = h * (TREE.top - 0.03);
    g.fillStyle = '#F2C46B';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? w * 0.05 : w * 0.022;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#E0584B';
    g.fillRect(w * 0.12, h * 0.86, w * 0.16, h * 0.08);
    g.fillStyle = '#F2C46B';
    g.fillRect(w * 0.2, h * 0.86, w * 0.02, h * 0.08);
    g.fillStyle = '#9CCBFF';
    g.fillRect(w * 0.7, h * 0.88, w * 0.14, h * 0.06);
  }
  return c;
}
