// A made-up year of drawn "photos" so the story can be tried without picking anything. No network, no real places visited.
import SunCalc from 'suncalc';
import { measure, type Photo, type PlaceName } from './analyze';

type Scene = 'sunset' | 'ocean' | 'forest' | 'city' | 'dunes' | 'snow' | 'street';
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function ridge(g: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, r: () => number, fill: string | CanvasGradient, peaks = false) {
  const a = r() * 9, b = r() * 9, f1 = 1.2 + r() * 1.6, f2 = 3 + r() * 4, f3 = 9 + r() * 8;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += Math.max(1, w / 160)) {
    const u = x / w; let y = Math.sin(u * f1 * 6.28 + a) * 0.55 + Math.sin(u * f2 * 6.28 + b) * 0.3 + Math.sin(u * f3 * 6.28 + a * 2) * 0.12;
    if (peaks) y = -Math.abs(y) * 1.5 + 0.4;
    g.lineTo(x, base * h + y * amp * h);
  }
  g.lineTo(w, h); g.closePath(); g.fillStyle = fill; g.fill();
}
function sky(g: CanvasRenderingContext2D, w: number, h: number, stops: string[], to = 1) {
  const gr = g.createLinearGradient(0, 0, 0, h * to); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function glow(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, core = 0.12) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, color); gr.addColorStop(core, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function clouds(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, color: string, n: number, band: [number, number]) {
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = (band[0] + r() * (band[1] - band[0])) * h, rw = (0.12 + r() * 0.25) * w;
    for (let k = 0; k < 5; k++) { g.save(); g.translate(cx + (r() - 0.5) * rw, cy + (r() - 0.5) * rw * 0.12); g.scale(1, 0.28); glow(g, 0, 0, rw * (0.4 + r() * 0.4), color, 0.05); g.restore(); }
  }
}

function paint(c: HTMLCanvasElement, scene: Scene, seed: number) {
  const g = c.getContext('2d')!, w = c.width, h = c.height, r = rng(seed), hz = 0.52 + r() * 0.14;
  if (scene === 'sunset') {
    sky(g, w, h, ['#2b2a5e', '#8a3f7a', '#e8674a', '#f7b25a', '#fde3a0'], hz);
    const sx = (0.25 + r() * 0.5) * w, sy = (hz - 0.05 - r() * 0.08) * h;
    glow(g, sx, sy, w * 0.7, 'rgba(255,214,140,0.55)', 0.02); glow(g, sx, sy, w * 0.09, 'rgba(255,248,220,1)', 0.7);
    clouds(g, w, h, r, 'rgba(255,170,130,0.35)', 5, [0.08, hz - 0.12]);
    ridge(g, w, h, hz, 0.035, r, '#7a3f5e'); ridge(g, w, h, hz + 0.08, 0.05, r, '#4b274a'); ridge(g, w, h, hz + 0.2, 0.06, r, '#261530');
  } else if (scene === 'ocean') {
    sky(g, w, h, ['#3f8fd6', '#8cc6ee', '#dff1f7'], hz);
    clouds(g, w, h, r, 'rgba(255,255,255,0.75)', 4, [0.1, hz - 0.1]);
    const sea = g.createLinearGradient(0, hz * h, 0, h); sea.addColorStop(0, '#1e6fa3'); sea.addColorStop(0.55, '#1c8fa8'); sea.addColorStop(1, '#5fc7c0'); g.fillStyle = sea; g.fillRect(0, hz * h, w, h);
    for (let i = 0; i < 90; i++) { const y = hz * h + r() ** 1.6 * (1 - hz) * h, len = (0.02 + r() * 0.1) * w * (0.4 + (y / h - hz) * 2); g.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.3})`; g.fillRect(r() * w, y, len, Math.max(1, h * 0.003)); }
    const sand = g.createLinearGradient(0, h * 0.86, 0, h); sand.addColorStop(0, '#e9d7ad'); sand.addColorStop(1, '#cdb485');
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * (0.9 + r() * 0.04)); g.quadraticCurveTo(w * 0.5, h * (0.84 + r() * 0.05), w, h * (0.93 + r() * 0.04)); g.lineTo(w, h); g.fillStyle = sand; g.fill();
  } else if (scene === 'forest') {
    sky(g, w, h, ['#dfeec8', '#9fc98a', '#4f8a4e', '#234a2c']);
    glow(g, w * (0.3 + r() * 0.4), h * 0.12, w * 0.8, 'rgba(255,250,200,0.5)', 0.02);
    for (let layer = 0; layer < 3; layer++) {
      const n = 5 + layer * 3;
      for (let i = 0; i < n; i++) {
        const x = (i + r()) / n * w, tw = w * (0.02 + r() * 0.03) * (1 + layer * 0.7), shade = 60 - layer * 18;
        const tr = g.createLinearGradient(x, 0, x + tw, 0); tr.addColorStop(0, `rgb(${shade + 30},${shade + 22},${shade})`); tr.addColorStop(1, `rgb(${shade - 12},${shade - 16},${shade - 22})`);
        g.fillStyle = tr; g.fillRect(x, 0, tw, h);
        for (let k = 0; k < 4; k++) glow(g, x + (r() - 0.5) * w * 0.25, r() * h * 0.5, w * (0.1 + r() * 0.12), `rgba(${40 + layer * 10},${110 - layer * 25 + r() * 40},${50},0.5)`, 0.2);
      }
    }
    ridge(g, w, h, 0.9, 0.02, r, '#16301c');
  } else if (scene === 'city') {
    sky(g, w, h, ['#070a1c', '#141a40', '#3a2a5e', '#7a3f6a'], hz + 0.1);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(r() * w, r() * h * 0.45, Math.max(1, w * 0.004), Math.max(1, w * 0.004)); }
    for (let layer = 0; layer < 2; layer++) {
      let x = -r() * w * 0.05;
      while (x < w) {
        const bw = w * (0.07 + r() * 0.1), bh = h * (0.15 + r() * 0.3) * (layer ? 0.75 : 1), top = h * (hz + 0.22) - bh;
        g.fillStyle = layer ? '#0b0d1c' : '#161a34'; g.fillRect(x, top, bw, h);
        const cw = bw / 5, ch = cw * 1.3;
        for (let yy = top + ch; yy < h * (hz + 0.2); yy += ch * 1.6) for (let xx = x + cw * 0.6; xx < x + bw - cw; xx += cw * 1.5) if (r() < 0.45) { g.fillStyle = r() < 0.75 ? 'rgba(255,205,120,0.9)' : 'rgba(150,200,255,0.85)'; g.fillRect(xx, yy, cw * 0.8, ch * 0.8); }
        x += bw + w * 0.01;
      }
    }
    const wet = g.createLinearGradient(0, h * (hz + 0.22), 0, h); wet.addColorStop(0, '#0a0c1a'); wet.addColorStop(1, '#1b1730'); g.fillStyle = wet; g.fillRect(0, h * (hz + 0.22), w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.6 ? `rgba(255,190,110,${0.1 + r() * 0.3})` : `rgba(226,58,125,${0.1 + r() * 0.3})`; g.fillRect(r() * w, h * (hz + 0.23) + r() * h * 0.3, w * 0.012, h * (0.03 + r() * 0.12)); }
  } else if (scene === 'dunes') {
    sky(g, w, h, ['#5aa7e0', '#bfe0f0', '#f6e6c8'], hz);
    glow(g, w * (0.2 + r() * 0.6), h * 0.15, w * 0.5, 'rgba(255,255,240,0.7)', 0.05);
    const cols = [['#f0c98a', '#d99a52'], ['#e8b06a', '#c27a3a'], ['#d99450', '#9c5a26'], ['#c57a3c', '#7a421a']];
    cols.forEach((cc, i) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, cc[0]); gr.addColorStop(1, cc[1]); ridge(g, w, h, hz + i * 0.11, 0.05, r, gr); });
  } else if (scene === 'snow') {
    sky(g, w, h, ['#7fb2e6', '#cfe4f5', '#f4f8fb'], hz + 0.1);
    clouds(g, w, h, r, 'rgba(255,255,255,0.7)', 3, [0.05, 0.3]);
    const m1 = g.createLinearGradient(0, h * 0.2, w, h * 0.8); m1.addColorStop(0, '#ffffff'); m1.addColorStop(1, '#8fa9c9'); ridge(g, w, h, hz - 0.05, 0.16, r, m1, true);
    const m2 = g.createLinearGradient(0, h * 0.4, w, h); m2.addColorStop(0, '#f2f6fa'); m2.addColorStop(1, '#6f8db3'); ridge(g, w, h, hz + 0.1, 0.1, r, m2, true);
    ridge(g, w, h, hz + 0.24, 0.03, r, '#2e4a3c'); ridge(g, w, h, hz + 0.33, 0.03, r, '#f5f8fb');
  } else {
    // a sunlit street: warm walls, a strip of sky, tiled ground
    sky(g, w, h, ['#4f9be0', '#a9d4f2']);
    const lw = w * (0.3 + r() * 0.12), rw = w * (0.3 + r() * 0.12), walls = [['#f2c14e', '#d99a2b'], ['#e8795a', '#c2573c'], ['#f4e4c4', '#d9c39a'], ['#7fb7c9', '#4f8ea3']];
    const a = walls[Math.floor(r() * 4)], b = walls[Math.floor(r() * 4)];
    let gr = g.createLinearGradient(0, 0, lw, 0); gr.addColorStop(0, a[0]); gr.addColorStop(1, a[1]);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(lw, h * 0.3); g.lineTo(lw, h * 0.72); g.lineTo(0, h); g.fillStyle = gr; g.fill();
    gr = g.createLinearGradient(w - rw, 0, w, 0); gr.addColorStop(0, b[1]); gr.addColorStop(1, b[0]);
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w - rw, h * 0.3); g.lineTo(w - rw, h * 0.72); g.lineTo(w, h); g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(40,30,50,0.55)';
    for (let i = 0; i < 3; i++) { const t = (i + 0.5) / 3; g.fillRect(lw * t * 0.9, h * (0.25 + t * 0.12), lw * 0.14, h * 0.1); g.fillRect(w - rw * t * 0.9 - rw * 0.14, h * (0.25 + t * 0.12), rw * 0.14, h * 0.1); }
    gr = g.createLinearGradient(0, h * 0.72, 0, h); gr.addColorStop(0, '#b9a58c'); gr.addColorStop(1, '#8a7560');
    g.beginPath(); g.moveTo(lw, h * 0.72); g.lineTo(w - rw, h * 0.72); g.lineTo(w, h); g.lineTo(0, h); g.fillStyle = gr; g.fill();
    g.beginPath(); g.moveTo(0, h); g.lineTo(lw, h * 0.72); g.lineTo(w * 0.5, h * 0.72); g.lineTo(w * 0.35, h); g.fillStyle = 'rgba(30,20,40,0.28)'; g.fill();
  }
  // lens falloff and a little film grain
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  const step = Math.max(1, Math.round(w / 220));
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(r() * w, r() * h, step, step); }
}

/** One drawn scene, for the landing screen. */
export function sceneCanvas(scene: Scene, seed: number, w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c, scene, seed); return c; }

const SPOTS = {
  lisbon: { lat: 38.72, lon: -9.14, off: (m: number) => (m >= 3 && m <= 9 ? 60 : 0), name: { name: 'Lisbon', region: 'Portugal' } },
  porto: { lat: 41.15, lon: -8.63, off: (m: number) => (m >= 3 && m <= 9 ? 60 : 0), name: { name: 'Porto', region: 'Portugal' } },
  reykjavik: { lat: 64.15, lon: -21.94, off: () => 0, name: { name: 'Reykjavik', region: 'Iceland' } },
  marrakesh: { lat: 31.63, lon: -7.99, off: () => 60, name: { name: 'Marrakesh', region: 'Morocco' } },
};
type Spot = keyof typeof SPOTS;
export const samplePlace = (lat: number, lon: number): PlaceName | null => Object.values(SPOTS).sort((a, b) => Math.hypot(a.lat - lat, a.lon - lon) - Math.hypot(b.lat - lat, b.lon - lon))[0].name;

/** About 140 pretend photos across the year. */
export function samplePhotos(year: number): Photo[] {
  const r = rng(2026), out: Photo[] = []; let seed = 100;
  const add = (month: number, day: number, spot: Spot | null, scene: Scene, hour?: number) => {
    const s = spot ? SPOTS[spot] : null, off = s ? s.off(month) : null, id = seed++;
    let date: Date;
    if (s && scene === 'sunset') { // just before the real sunset there
      const set = SunCalc.getTimes(new Date(Date.UTC(year, month, day, 12)), s.lat, s.lon).sunset, t = new Date(+set - (8 + r() * 30) * 60000 + off! * 60000);
      date = new Date(year, month, day, t.getUTCHours(), t.getUTCMinutes(), Math.floor(r() * 60));
    } else {
      const hr = hour ?? (scene === 'city' ? (r() < 0.5 ? 22 + r() * 2 : r() * 2.6) : scene === 'sunset' ? 18.5 + r() : 9 + r() * 8);
      date = new Date(year, month, day, Math.floor(hr), Math.floor((hr % 1) * 60), Math.floor(r() * 60));
    }
    const wide = r() < 0.25, cache = new Map<number, HTMLCanvasElement>();
    const render = (size: number) => { let c = cache.get(size); if (!c) { c = sceneCanvas(scene, id * 7919, wide ? size : Math.round(size * 0.75), wide ? Math.round(size * 0.75) : size); cache.set(size, c); } return c; };
    const m = measure(render(72)); cache.delete(72);
    out.push({ date, offsetMin: off, lat: s ? s.lat + (r() - 0.5) * 0.05 : undefined, lon: s ? s.lon + (r() - 0.5) * 0.05 : undefined, camera: r() < 0.8 ? 'Pocket Cam 12' : 'Field Camera II', ...m, sharp: m.sharp * (0.6 + r() * 0.8), render: async size => render(Math.min(size, 720)) });
  };
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  // winter at home (no location saved), then a few trips
  for (let i = 0; i < 9; i++) add(0, 3 + Math.floor(r() * 26), null, pick<Scene>(['snow', 'forest', 'snow']));
  for (let i = 0; i < 7; i++) add(1, 9 + Math.floor(i / 2), 'reykjavik', pick<Scene>(['snow', 'snow', 'sunset', 'ocean']));
  for (let i = 0; i < 6; i++) add(2, 2 + Math.floor(r() * 27), null, pick<Scene>(['forest', 'street', 'sunset']));
  for (let i = 0; i < 12; i++) add(3, 17 + Math.floor(i / 3), 'marrakesh', pick<Scene>(['dunes', 'street', 'dunes', 'sunset']));
  for (let i = 0; i < 8; i++) add(4, 1 + Math.floor(r() * 29), null, pick<Scene>(['forest', 'ocean', 'street']));
  for (let i = 0; i < 9; i++) add(5, 4 + Math.floor(r() * 24), null, pick<Scene>(['ocean', 'forest', 'sunset', 'street']));
  // the big one: nine days in Lisbon, two in Porto
  const perDay = [5, 6, 4, 17, 6, 5, 7, 4, 5];
  perDay.forEach((n, d) => { for (let i = 0; i < n; i++) add(6, 11 + d, 'lisbon', i % 5 === 4 ? 'city' : pick<Scene>(['street', 'ocean', 'sunset', 'street', 'ocean'])); });
  for (let i = 0; i < 9; i++) add(6, 20 + (i % 2), 'porto', pick<Scene>(['street', 'sunset', 'city', 'ocean']));
  for (let i = 0; i < 8; i++) add(7, 2 + Math.floor(r() * 27), null, pick<Scene>(['ocean', 'forest', 'sunset']));
  for (let i = 0; i < 7; i++) add(8, 5 + Math.floor(r() * 23), null, pick<Scene>(['forest', 'street', 'dunes']));
  for (let i = 0; i < 9; i++) add(9, 3 + Math.floor(r() * 26), 'lisbon', pick<Scene>(['sunset', 'street', 'city', 'ocean']));
  for (let i = 0; i < 5; i++) add(10, 1 + Math.floor(r() * 13), null, pick<Scene>(['forest', 'snow', 'city']));
  add(0, 1, null, 'snow', 8.2);
  return out;
}
