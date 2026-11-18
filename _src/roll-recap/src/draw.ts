// One drawing engine. The on-screen story, the 1080x1920 share image and the video all call drawCard,
// so what gets shared is exactly what was on screen. Everything is laid out on a canvas 1080 units wide.
import { DAYS, MON, MONTHS, hsl, type Card, type Pic, type Recap } from './analyze';

export const INK = '#141217', CLOUD = '#F0EEE9', LIME = '#C8F135', BERRY = '#E23A7D', SKY = '#4F8CFF';
const DISPLAY = '"RR Display", "Arial Black", system-ui, sans-serif', BODY = '"RR Body", system-ui, sans-serif', MONO = '"RR Mono", ui-monospace, Menlo, monospace';
const VW = 1080;
type G = CanvasRenderingContext2D;
export type DrawOpts = { bar?: boolean; hint?: boolean };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
/** A spring that lands with a small bounce. */
const spring = (x: number) => (x <= 0 ? 0 : x >= 1.6 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(8.5 * x));
/** 0 → 1 once `t` passes `delay`. */
const pop = (t: number, delay: number, dur = 0.8) => spring((t - delay) / dur);
const fade = (t: number, delay: number, dur = 0.45) => easeOut((t - delay) / dur);
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const roll = (n: number, t: number, delay = 0.2, dur = 1.3) => fmt(n * easeOut((t - delay) / dur));
const ord = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`;
const clock = (d: Date) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;

let grainTile: HTMLCanvasElement | null = null;
function grain(g: G, vh: number, alpha = 0.5) {
  if (!grainTile) {
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 256; const c = grainTile.getContext('2d')!, d = c.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.random() * 26; }
    c.putImageData(d, 0, 0);
  }
  g.save(); g.globalAlpha = alpha; g.fillStyle = g.createPattern(grainTile, 'repeat')!; g.scale(2, 2); g.fillRect(0, 0, VW / 2, vh / 2); g.restore();
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const dims = (p: Pic) => ('naturalWidth' in p ? [p.naturalWidth, p.naturalHeight] : [p.width, p.height]);

function font(g: G, px: number, family = DISPLAY, weight = 800) { g.font = `${weight} ${px}px ${family}`; }
/** Largest size up to `px` that keeps the text inside `maxW`. */
function fit(g: G, text: string, maxW: number, px: number, family = DISPLAY, weight = 800) {
  font(g, px, family, weight); const w = g.measureText(text).width; if (w > maxW) px = px * maxW / w; font(g, px, family, weight); return px;
}

/** Soft background: flat color, a big blurred light, and paper grain. */
function backdrop(g: G, vh: number, bg: string, lightColor: string, lx = 0.8, ly = 0.15) {
  g.fillStyle = bg; g.fillRect(0, 0, VW, vh);
  const gr = g.createRadialGradient(VW * lx, vh * ly, 0, VW * lx, vh * ly, vh * 0.75); gr.addColorStop(0, lightColor); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, VW, vh);
  grain(g, vh, 0.6);
}

/** A photo print: white edge, soft shadow, slow zoom and drift (Ken Burns). */
function print(g: G, pic: Pic | null, cx: number, cy: number, w: number, h: number, o: { rot?: number; t?: number; edge?: number; r?: number; a?: number; seed?: number; tape?: string; foot?: number } = {}) {
  const a = o.a ?? 1; if (a <= 0.001) return;
  const edge = o.edge ?? 14, r = o.r ?? 10, foot = o.foot ?? 0;
  g.save(); g.translate(cx, cy); g.rotate((o.rot || 0) * Math.PI / 180); g.globalAlpha = clamp(a); const s = 0.86 + 0.14 * Math.min(a, 1.2); g.scale(s, s);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.38)'; g.shadowBlur = 50; g.shadowOffsetY = 24; g.fillStyle = '#fbfaf6'; rr(g, -w / 2 - edge, -h / 2 - edge, w + edge * 2, h + edge * 2 + foot, r + edge * 0.5); g.fill(); g.restore();
  g.save(); rr(g, -w / 2, -h / 2, w, h, r); g.clip();
  if (pic) {
    const [pw, ph] = dims(pic), seed = o.seed ?? 0, kb = clamp((o.t ?? 0) / 9), zoom = 1.04 + 0.1 * kb;
    const k = Math.max(w / pw, h / ph) * zoom, dw = pw * k, dh = ph * k, dirx = seed % 2 ? 1 : -1, diry = seed % 3 ? 1 : -1;
    g.drawImage(pic, -dw / 2 + dirx * (dw - w) / 2 * (kb - 0.5), -dh / 2 + diry * (dh - h) / 2 * (kb - 0.5), dw, dh);
  } else { g.fillStyle = '#d9d4c8'; g.fillRect(-w / 2, -h / 2, w, h); }
  const sh = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.16)'); g.fillStyle = sh; g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  if (o.tape) { g.save(); g.translate(0, -h / 2 - edge); g.rotate(-0.06); g.globalAlpha *= 0.86; g.fillStyle = o.tape; g.shadowColor = 'rgba(0,0,0,0.2)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillRect(-90, -26, 180, 52); g.restore(); }
  g.restore();
}

/** A paper sticker: pill, hard little shadow, slight tilt. */
function sticker(g: G, text: string, cx: number, cy: number, o: { bg?: string; fg?: string; rot?: number; px?: number; a?: number; mono?: boolean; maxW?: number } = {}) {
  const a = o.a ?? 1; if (a <= 0.001) return;
  let px = o.px ?? 40; const fam = o.mono ? MONO : BODY, wt = o.mono ? 700 : 800;
  px = fit(g, text, (o.maxW ?? 900) - px * 1.5, px, fam, wt);
  const w = g.measureText(text).width + px * 1.5, h = px * 2.05;
  g.save(); g.translate(cx, cy); g.rotate((o.rot || 0) * Math.PI / 180); g.scale(a, a); g.globalAlpha = clamp(a);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.32)'; g.shadowBlur = 18; g.shadowOffsetY = 9; g.fillStyle = o.bg || CLOUD; rr(g, -w / 2, -h / 2, w, h, h / 2); g.fill(); g.restore();
  g.save(); rr(g, -w / 2, -h / 2, w, h, h / 2); g.clip();
  const gl = g.createLinearGradient(0, -h / 2, 0, h / 2); gl.addColorStop(0, 'rgba(255,255,255,0.4)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.1)'); g.fillStyle = gl; g.fillRect(-w / 2, -h / 2, w, h);
  if (grainTile) { g.globalAlpha *= 0.9; g.fillStyle = g.createPattern(grainTile, 'repeat')!; g.fillRect(-w / 2, -h / 2, w, h); }
  g.restore();
  g.fillStyle = o.fg || INK; g.textAlign = 'center'; g.textBaseline = 'middle'; font(g, px, fam, wt); g.fillText(text, 0, px * 0.06);
  g.restore();
}

/** Oversized word or number with a chrome sheen that sweeps across once it lands. */
function big(g: G, text: string, x: number, y: number, px: number, o: { t: number; delay?: number; maxW?: number; on: 'dark' | 'light' | 'color'; align?: CanvasTextAlign; tint?: string }) {
  const a = pop(o.t, o.delay ?? 0.1, 0.9); if (a <= 0.001) return px;
  px = fit(g, text, o.maxW ?? VW - 140, px); const w = g.measureText(text).width, align = o.align || 'left';
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, top = y - px * 0.78;
  g.save(); g.globalAlpha = clamp(a * 1.6); g.translate(0, (1 - a) * px * 0.35); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // soft drop shadow
  g.save(); g.shadowColor = o.on === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(20,18,23,0.22)'; g.shadowBlur = px * 0.16; g.shadowOffsetY = px * 0.06; g.fillStyle = o.on === 'dark' ? '#000' : INK; g.globalAlpha *= 0.6; g.fillText(text, x0, y); g.restore();
  const gr = g.createLinearGradient(0, top, 0, y + px * 0.05);
  if (o.on === 'dark') { const c = o.tint || '#ffffff'; gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.42, c); gr.addColorStop(0.5, '#8d8a99'); gr.addColorStop(0.56, '#e9e7f0'); gr.addColorStop(1, c === '#ffffff' ? '#a9a6b6' : c); }
  else { gr.addColorStop(0, '#4a4553'); gr.addColorStop(0.44, INK); gr.addColorStop(0.5, '#000000'); gr.addColorStop(0.58, '#3b3743'); gr.addColorStop(1, INK); }
  g.fillStyle = gr; g.fillText(text, x0, y);
  // the moving glint
  const sweep = ((o.t - (o.delay ?? 0.1)) * 0.45) % 2.2, sx = x0 - w * 0.4 + sweep * (w * 1.8) / 1.2;
  const gl = g.createLinearGradient(sx - px * 0.5, top, sx + px * 0.5, top + px * 0.5);
  const hi = o.on === 'dark' ? '255,255,255' : '255,255,255', peak = o.on === 'dark' ? 0.85 : 0.42;
  gl.addColorStop(0, `rgba(${hi},0)`); gl.addColorStop(0.5, `rgba(${hi},${peak})`); gl.addColorStop(1, `rgba(${hi},0)`);
  g.fillStyle = gl; g.fillText(text, x0, y);
  g.restore(); return px;
}

function label(g: G, text: string, x: number, y: number, px: number, color: string, o: { t: number; delay?: number; align?: CanvasTextAlign; family?: string; weight?: number; maxW?: number; alpha?: number } = { t: 9 }) {
  const a = fade(o.t, o.delay ?? 0); if (a <= 0.001) return;
  g.save(); g.globalAlpha = a * (o.alpha ?? 1); fit(g, text, o.maxW ?? VW - 160, px, o.family || BODY, o.weight ?? 600); g.fillStyle = color; g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic'; g.fillText(text, x, y + (1 - a) * 24); g.restore();
}
function kicker(g: G, text: string, y: number, color: string, t: number) {
  const a = fade(t, 0); g.save(); g.globalAlpha = a; font(g, 30, MONO, 700); g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const up = text.toUpperCase(); let x = 80; for (const ch of up) { g.fillText(ch, x, y); x += g.measureText(ch).width + 5; } g.restore();
}
function footer(g: G, vh: number, color: string, year: number, o: DrawOpts) {
  if (o.bar) return; g.save(); g.globalAlpha = 0.55; font(g, 24, MONO, 600); g.fillStyle = color; g.textBaseline = 'alphabetic';
  g.textAlign = 'left'; g.fillText('ROLL RECAP', 80, vh - 70); g.textAlign = 'right'; g.fillText(String(year), VW - 80, vh - 70); g.restore();
}

/* ---------- the cards ---------- */

function intro(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, INK, 'rgba(226,58,125,0.34)', 0.85, 0.12);
  const gr = g.createRadialGradient(VW * 0.1, vh * 0.75, 0, VW * 0.1, vh * 0.75, vh * 0.6); gr.addColorStop(0, 'rgba(79,140,255,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, VW, vh);
  // fanned stack
  const cy = vh * 0.34, pw = 400, ph = 520, n = c.pics.length, mid = (n - 1) / 2;
  const order = [...c.pics.keys()].sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid));
  for (const i of order) {
    const k = i - mid, a = pop(t, 0.15 + Math.abs(k) * 0.12, 1), sway = Math.sin(t * 0.6 + i) * 1.2;
    print(g, c.pics[i], VW / 2 + k * 150 * a, cy + Math.abs(k) * 34 * a + (1 - a) * 200, pw, ph, { rot: (k * 9 + sway) * a, t, seed: i, a, edge: 16 });
  }
  const y0 = vh * 0.66;
  label(g, 'Your', 80, y0 - 250, 92, CLOUD, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  big(g, String(R.year), 74, y0, 330, { t, delay: 0.6, on: 'dark' });
  label(g, 'in photos', 80, y0 + 120, 124, LIME, { t, delay: 0.85, family: DISPLAY, weight: 800 });
  sticker(g, `${roll(R.total, t, 1, 1.6)} photos`, 80 + 190, y0 + 240, { bg: LIME, rot: -4, px: 44, a: pop(t, 1), mono: true });
  if (o.hint) label(g, 'Tap to move · hold to pause', VW / 2, vh - 150, 30, CLOUD, { t, delay: 2.2, align: 'center', family: MONO, weight: 500, alpha: 0.6 });
  footer(g, vh, CLOUD, R.year, o);
}

function total(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, LIME, 'rgba(255,255,255,0.55)', 0.2, 0.1);
  kicker(g, 'The whole roll', vh * 0.15, INK, t);
  label(g, 'You took', 80, vh * 0.15 + 130, 96, INK, { t, delay: 0.1, family: DISPLAY, weight: 800 });
  const px = big(g, roll(R.total, t, 0.25, 1.5), 70, vh * 0.15 + 440, 380, { t, delay: 0.2, on: 'light' });
  label(g, 'photos', 80, vh * 0.15 + 440 + Math.min(150, px * 0.42), 120, INK, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  const sy = vh * 0.15 + 440 + Math.min(150, px * 0.42) + 120;
  sticker(g, `about ${R.perWeek >= 10 ? Math.round(R.perWeek) : R.perWeek.toFixed(1)} a week`, 300, sy, { bg: INK, fg: CLOUD, rot: -3, px: 42, a: pop(t, 1.0) });
  sticker(g, `on ${fmt(R.activeDays)} different days`, 660, sy + 100, { bg: CLOUD, rot: 2.5, px: 42, a: pop(t, 1.2) });
  if (R.camera) sticker(g, `mostly on ${R.camera}`, 420, sy + 205, { bg: BERRY, fg: '#fff', rot: -1.5, px: 34, a: pop(t, 1.4), mono: true, maxW: 760 });
  const by = Math.max(sy + 480, vh - 400), h = Math.min(360, vh - sy - 420);
  if (h > 180) [[220, -7], [540, 3], [860, -4]].forEach(([x, rot], i) => print(g, c.pics[i] ?? null, x, by + (i === 1 ? 26 : 0), h * 0.78, h, { rot, t, seed: i, a: pop(t, 1.3 + i * 0.12) }));
  footer(g, vh, INK, R.year, o);
}

function month(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, CLOUD, 'rgba(226,58,125,0.2)', 0.9, 0.05);
  kicker(g, 'Busiest month', vh * 0.15, BERRY, t);
  const m = R.topMonth; big(g, MONTHS[m], 72, vh * 0.15 + 250, 250, { t, delay: 0.15, on: 'light' });
  label(g, `${roll(R.months[m], t, 0.4)} photos`, 80, vh * 0.15 + 370, 84, BERRY, { t, delay: 0.4, family: DISPLAY, weight: 800 });
  label(g, `${Math.round(R.months[m] / R.total * 100)}% of your whole year`, 80, vh * 0.15 + 440, 38, INK, { t, delay: 0.6, alpha: 0.7 });
  // photo
  const top = vh * 0.15 + 520, chartH = 260, chartY = vh - 250, ph = Math.max(200, chartY - chartH - top - 110);
  print(g, c.pics[0], 650, top + ph / 2 + 20, Math.min(560, ph * 0.8), ph, { rot: 3.5, t, seed: 1, a: pop(t, 0.7), tape: 'rgba(226,58,125,0.75)' });
  if (c.pics[1] && ph > 420) print(g, c.pics[1], 250, top + ph * 0.62, ph * 0.42, ph * 0.52, { rot: -7, t, seed: 2, a: pop(t, 0.9) });
  // twelve bars
  const max = Math.max(...R.months), bw = (VW - 160) / 12;
  for (let i = 0; i < 12; i++) {
    const grow = easeOut((t - 0.9 - i * 0.04) / 0.7), h = Math.max(6, R.months[i] / max * chartH * grow), x = 80 + i * bw;
    g.save(); if (i === m) { g.shadowColor = 'rgba(226,58,125,0.45)'; g.shadowBlur = 24; g.shadowOffsetY = 8; }
    const gr = g.createLinearGradient(0, chartY - h, 0, chartY); if (i === m) { gr.addColorStop(0, '#f0609a'); gr.addColorStop(1, BERRY); } else { gr.addColorStop(0, '#2a2730'); gr.addColorStop(1, INK); }
    g.fillStyle = gr; g.globalAlpha = i === m ? 1 : 0.82; rr(g, x + 9, chartY - h, bw - 18, h, 12); g.fill(); g.restore();
    g.fillStyle = INK; g.globalAlpha = i === m ? 1 : 0.5; font(g, 24, MONO, i === m ? 800 : 500); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(MON[i][0], x + bw / 2, chartY + 42); g.globalAlpha = 1;
  }
  footer(g, vh, INK, R.year, o);
}

function day(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, INK, 'rgba(79,140,255,0.4)', 0.15, 0.1);
  kicker(g, 'Busiest day', vh * 0.15, SKY, t);
  const d = R.topDay.date;
  label(g, DAYS[d.getDay()], 80, vh * 0.15 + 120, 90, CLOUD, { t, delay: 0.1, family: DISPLAY, weight: 800 });
  big(g, `${MON[d.getMonth()]} ${d.getDate()}`, 72, vh * 0.15 + 360, 260, { t, delay: 0.2, on: 'dark', tint: '#dbe7ff' });
  label(g, `${roll(R.topDay.count, t, 0.5)} photos in one day`, 80, vh * 0.15 + 460, 62, SKY, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  const per = R.total / Math.max(1, R.activeDays), times = R.topDay.count / per;
  if (times >= 1.5) sticker(g, `${times >= 10 ? Math.round(times) : times.toFixed(1)}× a normal day`, 300, vh * 0.15 + 560, { bg: LIME, rot: -3, px: 38, a: pop(t, 0.9), mono: true });
  const top = vh * 0.15 + 660, h = Math.min(620, vh - top - 230), cy = top + h / 2, n = Math.max(1, c.pics.length);
  if (n === 1) print(g, c.pics[0], VW / 2, cy, h * 0.8, h, { rot: -2, t, seed: 0, a: pop(t, 0.8) });
  else [[250, -8, 0.82], [830, 7, 0.82], [540, 1, 1]].slice(3 - Math.min(3, n)).forEach(([x, rot, s], i) => print(g, c.pics[i] ?? c.pics[0], x, cy + (s < 1 ? 20 : 0), h * 0.72 * s, h * s, { rot, t, seed: i, a: pop(t, 0.8 + i * 0.14) }));
  footer(g, vh, CLOUD, R.year, o);
}

function place(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  const P = R.place!; backdrop(g, vh, SKY, 'rgba(255,255,255,0.4)', 0.85, 0.08);
  kicker(g, 'Top place', vh * 0.15, INK, t);
  label(g, 'Most of it happened in', 80, vh * 0.15 + 100, 56, INK, { t, delay: 0.1, weight: 700 });
  const px = big(g, P.name, 72, vh * 0.15 + 330, 250, { t, delay: 0.2, on: 'light' });
  let y = vh * 0.15 + 330 + Math.min(px * 0.3, 70);
  if (P.region) { label(g, P.region, 80, y + 40, 60, '#fff', { t, delay: 0.45, family: DISPLAY, weight: 800 }); y += 80; }
  const top = y + 90, h = Math.min(760, vh - top - 330);
  print(g, c.pics[0], VW / 2, top + h / 2, Math.min(820, h * 0.86), h, { rot: -2.5, t, seed: 3, a: pop(t, 0.6), edge: 18, tape: 'rgba(240,238,233,0.8)' });
  sticker(g, `${roll(P.count, t, 0.8)} photos here`, 300, top + h + 30, { bg: INK, fg: CLOUD, rot: -4, px: 46, a: pop(t, 1.0) });
  const share = Math.round(P.share * 10);
  sticker(g, share >= 1 ? `${share} in every 10` : 'a small favorite', 760, top + h + 110, { bg: LIME, rot: 3, px: 40, a: pop(t, 1.2) });
  label(g, `${Math.abs(P.lat).toFixed(1)}°${P.lat >= 0 ? 'N' : 'S'}  ${Math.abs(P.lon).toFixed(1)}°${P.lon >= 0 ? 'E' : 'W'}`, 80, top + h + 190, 28, INK, { t, delay: 1.3, family: MONO, weight: 600, alpha: 0.7 });
  footer(g, vh, INK, R.year, o);
}

function streak(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  const S = R.streak; backdrop(g, vh, BERRY, 'rgba(255,190,120,0.45)', 0.1, 0.1);
  kicker(g, 'Longest streak', vh * 0.15, '#fff', t);
  const numPx = 520; const px = big(g, roll(S.len, t, 0.2, 1.1), 64, vh * 0.15 + 480, numPx, { t, delay: 0.15, on: 'dark', maxW: 520 });
  font(g, px); const nw = g.measureText(String(S.len)).width;
  label(g, 'days', 80 + nw + 40, vh * 0.15 + 330, 130, INK, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  label(g, 'in a row', 80 + nw + 40, vh * 0.15 + 450, 90, INK, { t, delay: 0.6, family: DISPLAY, weight: 800 });
  sticker(g, `${ord(S.from)}  →  ${ord(S.to)}`, 330, vh * 0.15 + 600, { bg: CLOUD, rot: -2.5, px: 42, a: pop(t, 0.9), mono: true });
  // one dot per day
  const n = Math.min(S.len, 30), gap = Math.min(92, (VW - 160) / n), dy = vh * 0.15 + 740;
  for (let i = 0; i < n; i++) {
    const a = pop(t, 1 + i * (0.9 / n), 0.5); if (a <= 0) continue; const r = gap * 0.36 * a, x = 80 + gap * (i + 0.5);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 12; g.shadowOffsetY = 6; g.fillStyle = i === n - 1 ? LIME : INK; g.beginPath(); g.arc(x, dy, r, 0, 7); g.fill(); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - r * 0.3, dy - r * 0.3, r * 0.28, 0, 7); g.fill();
  }
  const top = dy + 110, h = Math.min(560, vh - top - 220), cy = top + h / 2;
  if (h > 200) [[230, -6], [850, 6], [540, -1]].forEach(([x, rot], i) => { const p = c.pics[i === 2 ? 0 : i + 1] ?? c.pics[0]; print(g, p ?? null, x, cy + (i < 2 ? 24 : 0), h * 0.74 * (i < 2 ? 0.84 : 1), h * (i < 2 ? 0.84 : 1), { rot, t, seed: i, a: pop(t, 1.2 + i * 0.12) }); });
  footer(g, vh, '#fff', R.year, o);
}

function golden(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  g.fillStyle = INK; g.fillRect(0, 0, VW, vh);
  // the photo fills the card, with a warm wash so the words read
  if (c.pics[0]) { const p = c.pics[0], [pw, ph] = dims(p), kb = clamp(t / 9), k = Math.max(VW / pw, vh / ph) * (1.05 + 0.1 * kb); g.drawImage(p, VW / 2 - pw * k / 2 - 30 * (kb - 0.5), vh / 2 - ph * k / 2, pw * k, ph * k); }
  let gr = g.createLinearGradient(0, 0, 0, vh); gr.addColorStop(0, 'rgba(20,18,23,0.86)'); gr.addColorStop(0.38, 'rgba(20,18,23,0.35)'); gr.addColorStop(0.7, 'rgba(20,18,23,0.25)'); gr.addColorStop(1, 'rgba(20,18,23,0.88)'); g.fillStyle = gr; g.fillRect(0, 0, VW, vh);
  gr = g.createRadialGradient(VW * 0.8, vh * 0.3, 0, VW * 0.8, vh * 0.3, vh * 0.6); gr.addColorStop(0, 'rgba(255,170,60,0.4)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, VW, vh);
  grain(g, vh, 0.5);
  kicker(g, 'Golden hour', vh * 0.15, LIME, t);
  big(g, roll(R.golden!.count, t, 0.2), 68, vh * 0.15 + 400, 420, { t, delay: 0.15, on: 'dark', tint: '#ffe2a8' });
  label(g, 'photos in the', 80, vh * 0.15 + 510, 84, CLOUD, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  label(g, 'good light', 80, vh * 0.15 + 620, 124, LIME, { t, delay: 0.6, family: DISPLAY, weight: 800 });
  sticker(g, 'sun low, sky doing the work', 400, vh - 330, { bg: LIME, rot: -3, px: 38, a: pop(t, 1.1) });
  label(g, 'Counted from where the sun sat in the sky', 80, vh - 190, 28, CLOUD, { t, delay: 1.3, family: MONO, weight: 500, alpha: 0.75 });
  footer(g, vh, CLOUD, R.year, o);
}

function night(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  const N = R.night!; backdrop(g, vh, '#0c0b12', 'rgba(79,140,255,0.3)', 0.8, 0.0);
  // stars and a moon
  for (let i = 0; i < 70; i++) { const x = (i * 7919 % 1000) / 1000 * VW, y = (i * 104729 % 1000) / 1000 * vh * 0.6, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i)); g.fillStyle = `rgba(240,238,233,${0.25 + 0.6 * tw * ((i % 5) / 5)})`; g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, 7); g.fill(); }
  const ma = pop(t, 0.3), mx = VW - 210, my = vh * 0.15 + 60; g.save(); g.globalAlpha = clamp(ma);
  let gr = g.createRadialGradient(mx, my, 0, mx, my, 260); gr.addColorStop(0, 'rgba(240,238,233,0.3)'); gr.addColorStop(1, 'rgba(240,238,233,0)'); g.fillStyle = gr; g.fillRect(mx - 260, my - 260, 520, 520);
  gr = g.createRadialGradient(mx - 30, my - 30, 10, mx, my, 100); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(1, '#cfcbbd'); g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 96 * ma, 0, 7); g.fill();
  g.fillStyle = '#0c0b12'; g.globalAlpha *= 0.94; g.beginPath(); g.arc(mx + 44, my - 26, 84 * ma, 0, 7); g.fill(); g.restore();
  kicker(g, 'Night owl', vh * 0.15, SKY, t);
  big(g, roll(N.count, t, 0.2), 68, vh * 0.15 + 400, 420, { t, delay: 0.15, on: 'dark', tint: '#cfe0ff', maxW: 640 });
  label(g, N.count === 1 ? 'photo after 10 pm' : 'photos after 10 pm', 80, vh * 0.15 + 510, 80, CLOUD, { t, delay: 0.5, family: DISPLAY, weight: 800 });
  sticker(g, `latest: ${clock(N.latest)}`, 300, vh * 0.15 + 620, { bg: SKY, fg: '#fff', rot: -3, px: 44, a: pop(t, 0.9), mono: true });
  const top = vh * 0.15 + 730, h = Math.min(700, vh - top - 220);
  if (h > 200) print(g, c.pics[0], VW / 2 + 60, top + h / 2, h * 0.78, h, { rot: 4, t, seed: 5, a: pop(t, 1.0), edge: 16 });
  footer(g, vh, CLOUD, R.year, o);
}

function ends(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, CLOUD, 'rgba(200,241,53,0.35)', 0.1, 0.9);
  kicker(g, 'First and last', vh * 0.15, INK, t);
  label(g, 'How it started,', 80, vh * 0.15 + 120, 96, INK, { t, delay: 0.1, family: DISPLAY, weight: 800 });
  label(g, 'how it’s going', 80, vh * 0.15 + 225, 96, BERRY, { t, delay: 0.25, family: DISPLAY, weight: 800 });
  const top = vh * 0.15 + 300, avail = vh - top - 200, h = Math.min(560, avail * 0.52), w = h * 0.84;
  const pol = (pic: Pic | null, cx: number, cy: number, rot: number, d: Date, tag: string, delay: number, tape: string) => {
    const a = pop(t, delay); print(g, pic, cx, cy, w, h, { rot, t, seed: delay > 0.6 ? 1 : 0, a, edge: 22, foot: 96, r: 4, tape });
    if (a > 0.01) { g.save(); g.translate(cx, cy); g.rotate(rot * Math.PI / 180); g.globalAlpha = clamp(a); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; font(g, 38, MONO, 700); g.fillText(`${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, 0, h / 2 + 78); g.restore(); }
    sticker(g, tag, cx + (rot < 0 ? -w * 0.32 : w * 0.32), cy - h / 2 + 10, { bg: rot < 0 ? LIME : BERRY, fg: rot < 0 ? INK : '#fff', rot: rot * 2, px: 40, a: pop(t, delay + 0.25) });
  };
  pol(c.pics[0], 360, top + h / 2 + 60, -5, R.first, 'first', 0.4, 'rgba(79,140,255,0.7)');
  pol(c.pics[1], 720, top + avail - h / 2 - 90, 4, R.last, 'latest', 0.8, 'rgba(226,58,125,0.7)');
  footer(g, vh, INK, R.year, o);
}

function color(g: G, vh: number, R: Recap, _c: Card, t: number, o: DrawOpts) {
  const lead = R.palette[0]; backdrop(g, vh, INK, `rgba(${lead.rgb.map(Math.round).join(',')},0.5)`, 0.85, 0.1);
  kicker(g, 'The color of your year', vh * 0.15, LIME, t);
  const words = R.paletteName.split(' ');
  label(g, words[0], 80, vh * 0.15 + 150, 130, CLOUD, { t, delay: 0.1, family: DISPLAY, weight: 800 });
  big(g, words.slice(1).join(' '), 72, vh * 0.15 + 370, 250, { t, delay: 0.25, on: 'dark', tint: lighten(lead.rgb) });
  // five paint chips
  const top = vh * 0.15 + 460, n = R.palette.length, availH = vh - top - 200, ch = Math.min(210, (availH - (n - 1) * 26) / n);
  R.palette.forEach((s, i) => {
    const a = pop(t, 0.6 + i * 0.14); if (a <= 0.001) return;
    const y = top + i * (ch + 26), x = 80 + (1 - a) * 260, w = VW - 160, rot = (i % 2 ? 0.6 : -0.6);
    g.save(); g.translate(x + w / 2, y + ch / 2); g.rotate(rot * Math.PI / 180); g.globalAlpha = clamp(a);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 34; g.shadowOffsetY = 16; g.fillStyle = '#fbfaf6'; rr(g, -w / 2, -ch / 2, w, ch, 18); g.fill(); g.restore();
    const cw = w * 0.56; g.save(); rr(g, -w / 2 + 12, -ch / 2 + 12, cw, ch - 24, 10); g.clip(); g.fillStyle = s.hex; g.fillRect(-w / 2, -ch / 2, w, ch);
    const gl = g.createLinearGradient(-w / 2, -ch / 2, -w / 2 + cw, ch / 2); gl.addColorStop(0, 'rgba(255,255,255,0.3)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gl; g.fillRect(-w / 2, -ch / 2, w, ch);
    if (grainTile) { g.fillStyle = g.createPattern(grainTile, 'repeat')!; g.fillRect(-w / 2, -ch / 2, w, ch); } g.restore();
    const tx = -w / 2 + cw + 44; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    fit(g, s.name, w - cw - 80, Math.min(60, ch * 0.34)); g.fillText(s.name, tx, -ch * 0.02);
    font(g, Math.min(30, ch * 0.17), MONO, 600); g.globalAlpha *= 0.7; g.fillText(`${s.hex}  ·  ${Math.max(1, Math.round(s.share * 100))}%`, tx, ch * 0.26);
    g.restore();
  });
  footer(g, vh, CLOUD, R.year, o);
}
const lighten = (c: [number, number, number]) => { const [, , l] = hsl(c), k = l < 0.55 ? 0.5 : 0.15; return `rgb(${c.map(v => Math.round(v + (255 - v) * k)).join(',')})`; };

function mosaic(g: G, vh: number, R: Recap, c: Card, t: number, o: DrawOpts) {
  backdrop(g, vh, CLOUD, 'rgba(79,140,255,0.18)', 0.9, 0.05);
  kicker(g, 'Month by month', vh * 0.13, BERRY, t);
  label(g, `Your ${R.year}`, 80, vh * 0.13 + 125, 110, INK, { t, delay: 0.1, family: DISPLAY, weight: 800 });
  const top = vh * 0.13 + 190, bottom = vh - (o.bar ? 370 : 150), gap = 22, cols = 3, rows = 4;
  let tw = (VW - 120 - gap * (cols - 1)) / cols, th = (bottom - top - gap * (rows - 1)) / rows; if (th > tw * 1.25) th = tw * 1.25; if (tw > th * 1.1) tw = th * 1.1;
  const gw = tw * cols + gap * (cols - 1), x0 = (VW - gw) / 2, tilt = [-2.2, 1.4, -1, 1.8, -1.6, 2.4, -2, 1, 2.2, -1.2, 1.6, -2.4], cols5 = [LIME, BERRY, SKY, INK, '#fff'];
  for (let i = 0; i < 12; i++) {
    const a = pop(t, 0.3 + i * 0.07, 0.7), cx = x0 + (i % 3) * (tw + gap) + tw / 2, cy = top + Math.floor(i / 3) * (th + gap) + th / 2;
    if (c.pics[i]) print(g, c.pics[i], cx, cy, tw - 24, th - 24, { rot: tilt[i], t, seed: i, a, edge: 12, r: 6 });
    else if (a > 0.01) {
      g.save(); g.translate(cx, cy); g.rotate(tilt[i] * Math.PI / 180); g.globalAlpha = clamp(a) * 0.9; g.setLineDash([14, 12]); g.lineWidth = 4; g.strokeStyle = 'rgba(20,18,23,0.3)'; rr(g, -tw / 2 + 8, -th / 2 + 8, tw - 16, th - 16, 14); g.stroke();
      g.setLineDash([]); g.fillStyle = 'rgba(20,18,23,0.45)'; g.textAlign = 'center'; g.textBaseline = 'middle'; font(g, 26, MONO, 600); g.fillText('no photos', 0, 0); g.restore();
    }
    const bg = cols5[i % 5];
    sticker(g, MON[i].toUpperCase(), cx - tw / 2 + 78, cy - th / 2 + 34, { bg, fg: bg === INK || bg === BERRY || bg === SKY ? '#fff' : INK, rot: -tilt[i] * 2.5, px: 28, a: pop(t, 0.5 + i * 0.07, 0.6), mono: true });
    if (R.months[i]) sticker(g, fmt(R.months[i]), cx + tw / 2 - 58, cy + th / 2 - 34, { bg: '#fbfaf6', rot: tilt[i] * 2, px: 24, a: pop(t, 0.7 + i * 0.07, 0.6), mono: true });
  }
  footer(g, vh, INK, R.year, o);
}

const DRAW = { intro, total, month, day, place, streak, golden, night, ends, color, mosaic };
/** The card's own main color, used behind the phone's status bar. */
export const cardBg = (c: Card) => ({ intro: INK, total: LIME, month: CLOUD, day: INK, place: SKY, streak: BERRY, golden: INK, night: '#0c0b12', ends: CLOUD, color: INK, mosaic: CLOUD }[c.kind]);
export const lightCard = (c: Card) => ['total', 'month', 'ends', 'mosaic', 'place'].includes(c.kind);

/** Draws one card into a W×H box at the canvas origin. `t` is seconds since the card appeared. */
export function drawCard(g: G, W: number, H: number, R: Recap, card: Card, t: number, o: DrawOpts = {}) {
  const u = W / VW; g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.scale(u, u);
  DRAW[card.kind](g, H / u, R, card, t, o);
  g.restore();
}
