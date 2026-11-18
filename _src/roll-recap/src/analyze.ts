// Reads photos on the phone and turns them into the numbers for the story. Nothing here uploads a photo.
import exifr from 'exifr';
import SunCalc from 'suncalc';

export type Pic = HTMLImageElement | HTMLCanvasElement;
export type RGB = [number, number, number];
export type Photo = {
  /** Wall-clock time where the photo was taken (use the local getters). */
  date: Date;
  /** Minutes ahead of UTC at the time, when the camera wrote it. */
  offsetMin: number | null;
  lat?: number; lon?: number; camera?: string;
  avg: RGB; sharp: number;
  render: (size: number) => Promise<Pic>;
};
export type PlaceName = { name: string; region: string };
export type CardKind = 'intro' | 'total' | 'month' | 'day' | 'place' | 'streak' | 'golden' | 'night' | 'ends' | 'color' | 'mosaic';
export type Card = { kind: CardKind; pics: (Pic | null)[] };
export type Swatch = { hex: string; rgb: RGB; name: string; share: number };
export type Recap = {
  year: number; total: number; otherYears: number; perWeek: number; activeDays: number; camera?: string;
  months: number[]; topMonth: number;
  topDay: { date: Date; count: number };
  place?: { name: string; region: string; count: number; share: number; lat: number; lon: number; named: boolean };
  streak: { len: number; from: Date; to: Date };
  golden?: { count: number };
  night?: { count: number; latest: Date };
  first: Date; last: Date;
  palette: Swatch[]; paletteName: string;
  cards: Card[];
};

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON = MONTHS.map(m => m.slice(0, 3));
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- reading one file ---------- */

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('decode')); i.src = src; });
}

/** A small canvas copy of a picture, longest side `size`. */
async function shrink(file: Blob, size: number): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  if (size <= 200 && 'createImageBitmap' in window) {
    try {
      const bm = await createImageBitmap(file, { resizeWidth: size, resizeQuality: 'low' } as any);
      if (bm.width <= size * 1.5) { c.width = bm.width; c.height = bm.height; c.getContext('2d')!.drawImage(bm, 0, 0); bm.close(); return c; }
      bm.close();
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImg(url); const k = Math.min(1, size / Math.max(im.naturalWidth, im.naturalHeight));
    c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
    im.src = '';
  } finally { URL.revokeObjectURL(url); }
  return c;
}

/** Average color (leaning toward the colorful parts) and a sharpness score. */
export function measure(c: HTMLCanvasElement): { avg: RGB; sharp: number } {
  const w = c.width, h = c.height, d = (c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, ws = 0; const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const wt = 0.25 + (mx - mn) / 255; r += R * wt; g += G * wt; b += B * wt; ws += wt;
    gray[p] = 0.299 * R + 0.587 * G + 0.114 * B;
  }
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x, l = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w]; s += l; s2 += l * l; n++;
  }
  const mean = n ? s / n : 0;
  return { avg: [r / ws, g / ws, b / ws], sharp: n ? s2 / n - mean * mean : 0 };
}

function parseOffset(v: unknown): number | null {
  if (typeof v !== 'string') return null; const m = /^([+-])(\d\d):?(\d\d)$/.exec(v.trim()); if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

async function readFile(file: File): Promise<Photo | null> {
  let meta: any = null;
  try { meta = await exifr.parse(file, { tiff: true, exif: true, gps: true, ifd1: false, interop: false, xmp: false, icc: false, iptc: false } as any); } catch { /* no data in the file */ }
  let small: HTMLCanvasElement;
  try { small = await shrink(file, 96); } catch { return null; } // not a picture this browser can open
  let date: any = meta?.DateTimeOriginal ?? meta?.CreateDate ?? meta?.ModifyDate;
  if (!(date instanceof Date) || isNaN(+date)) date = new Date(file.lastModified || Date.now());
  const lat = Number(meta?.latitude), lon = Number(meta?.longitude), has = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
  const model = typeof meta?.Model === 'string' ? meta.Model.trim().slice(0, 28) : undefined;
  const cache = new Map<number, Promise<Pic>>();
  return {
    date, offsetMin: parseOffset(meta?.OffsetTimeOriginal ?? meta?.OffsetTime), lat: has ? lat : undefined, lon: has ? lon : undefined, camera: model || undefined,
    ...measure(small),
    render: size => { let p = cache.get(size); if (!p) { p = toPic(file, size); cache.set(size, p); } return p; },
  };
}

/** A resized copy for the story. Kept as a JPEG-backed image so the browser can manage the memory. */
async function toPic(file: File, size: number): Promise<Pic> {
  const c = await shrink(file, size);
  const blob: Blob | null = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.86));
  if (!blob) return c;
  const im = await loadImg(URL.createObjectURL(blob)); c.width = c.height = 0; return im;
}

/** Reads every file, a few at a time. */
export async function readPhotos(files: File[], onProgress: (done: number, total: number) => void): Promise<{ photos: Photo[]; unreadable: number }> {
  const photos: Photo[] = []; let done = 0, bad = 0, next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++]; const p = await readFile(f).catch(() => null);
      if (p) photos.push(p); else bad++;
      onProgress(++done, files.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { photos, unreadable: bad };
}

/* ---------- color ---------- */

const NAMED: [string, string][] = [
  ['Espresso', '3B2A26'], ['Cocoa', '5A3E32'], ['Mocha', '7B5B4A'], ['Clay', 'B07A5C'], ['Terracotta', 'C8643C'], ['Rust', 'A8501F'], ['Brick', '9A3E32'], ['Ember', 'D4532A'],
  ['Caramel', 'B8763A'], ['Honey', 'D99A3A'], ['Marigold', 'E8A822'], ['Tangerine', 'F08A24'], ['Butter', 'F3E3A3'], ['Lemon', 'F2DA4E'], ['Sand', 'D9C3A0'], ['Tan', 'C2A07A'],
  ['Khaki', 'B5A77A'], ['Oat', 'E6DCCB'], ['Linen', 'EFE7DA'], ['Olive', '7A7A3A'], ['Moss', '5F7046'], ['Fern', '6F9B5A'], ['Sage', '9CAF88'], ['Pine', '2F4F3A'],
  ['Forest', '26432F'], ['Mint', 'BDE8C9'], ['Seafoam', '9FD8C4'], ['Teal', '1F7A7A'], ['Lagoon', '2E9CA6'], ['Aqua', '4FC3D6'], ['Ocean', '1F5F8B'], ['Denim', '3F5E8C'],
  ['Steel', '7F93A8'], ['Cornflower', '6E94DC'], ['Sky', '8FC3EA'], ['Mist', 'B5C4C9'], ['Fog', 'C9CED3'], ['Snow', 'F2F3F1'], ['Storm', '4A5568'], ['Slate', '5C6670'],
  ['Midnight', '1B2140'], ['Twilight', '3A3F6B'], ['Indigo', '33337A'], ['Dusk', '6C6A8E'], ['Violet', '6E4BB0'], ['Lilac', 'B9A3D6'], ['Eggplant', '3D2440'], ['Plum', '6B3A62'],
  ['Mauve', 'A77F95'], ['Wine', '6A1F2E'], ['Cherry', 'C22B3A'], ['Rose', 'D0667B'], ['Coral', 'EE7A5E'], ['Peach', 'F2B28A'], ['Blush', 'E8B7B4'], ['Bubblegum', 'F08FB5'],
  ['Stone', '9A948C'], ['Pewter', '8B8E90'], ['Smoke', '77787C'], ['Graphite', '44464C'], ['Charcoal', '33353A'], ['Ink', '17161B'],
];
const hexRgb = (h: string): RGB => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
export const rgbHex = (c: RGB) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const NAMED_RGB = NAMED.map(([n, h]) => [n, hexRgb(h)] as const);
const dist2 = (a: RGB, b: RGB) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return 2 * dr * dr + 4 * dg * dg + 3 * db * db; };

export function hsl(c: RGB): [number, number, number] {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}

function palette(colors: RGB[]): { swatches: Swatch[]; name: string } {
  const k = Math.min(5, colors.length);
  // spread-out starting points, then plain k-means
  const cents: RGB[] = [colors[0]];
  while (cents.length < k) { let best = colors[0], bd = -1; for (const c of colors) { const d = Math.min(...cents.map(m => dist2(c, m))); if (d > bd) { bd = d; best = c; } } cents.push(best); }
  let own = new Array(colors.length).fill(0);
  for (let it = 0; it < 14; it++) {
    own = colors.map(c => { let bi = 0, bd = Infinity; cents.forEach((m, i) => { const d = dist2(c, m); if (d < bd) { bd = d; bi = i; } }); return bi; });
    cents.forEach((_, i) => { let r = 0, g = 0, b = 0, n = 0; colors.forEach((c, j) => { if (own[j] === i) { r += c[0]; g += c[1]; b += c[2]; n++; } }); if (n) cents[i] = [r / n, g / n, b / n]; });
  }
  const used = new Set<string>();
  const swatches = cents.map((rgb, i) => {
    const share = own.filter(o => o === i).length / colors.length;
    const pick = [...NAMED_RGB].sort((a, b) => dist2(rgb, a[1]) - dist2(rgb, b[1])).find(n => !used.has(n[0]))!; used.add(pick[0]);
    return { rgb, hex: rgbHex(rgb), name: pick[0], share };
  }).filter(s => s.share > 0).sort((a, b) => b.share - a.share);
  // a name for the whole set, from its strongest color
  const lead = [...swatches].sort((a, b) => hsl(b.rgb)[1] * b.share ** 0.5 - hsl(a.rgb)[1] * a.share ** 0.5)[0];
  const [h, s] = hsl(lead.rgb); const light = swatches.reduce((a, w) => a + hsl(w.rgb)[2] * w.share, 0), sat = swatches.reduce((a, w) => a + hsl(w.rgb)[1] * w.share, 0);
  const noun = s < 0.12 ? 'Stone' : h < 18 || h >= 345 ? 'Ember' : h < 42 ? 'Clay' : h < 68 ? 'Honey' : h < 160 ? 'Moss' : h < 195 ? 'Tide' : h < 250 ? 'Harbor' : h < 290 ? 'Dusk' : 'Bloom';
  const adj = light < 0.3 ? 'Midnight' : light > 0.68 ? 'Soft' : sat > 0.5 ? 'Loud' : sat < 0.22 ? 'Faded' : light < 0.45 ? 'Deep' : 'Warm';
  return { swatches, name: `${adj} ${noun}` };
}

/* ---------- the numbers ---------- */

const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const dayNum = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/** The true moment a photo was taken, from its wall-clock time and its offset (or its longitude as a guess). */
function instant(p: Photo, lon: number): Date {
  const off = p.offsetMin ?? Math.round(lon / 15) * 60, d = p.date;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - off * 60000);
}

async function nameOf(lat: number, lon: number): Promise<PlaceName | null> {
  // One request. The point is rounded to two decimals (about a mile) first.
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&zoom=10&accept-language=en`, { signal: ac.signal, referrerPolicy: 'no-referrer' });
    if (!r.ok) return null; const a = (await r.json())?.address; if (!a) return null;
    const name = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || a.state; if (!name) return null;
    return { name: String(name), region: String((a.country_code === 'us' ? a.state : a.country) || '') };
  } catch { return null; } finally { clearTimeout(timer); }
}

export type BuildOpts = { placeName?: (lat: number, lon: number) => PlaceName | null; onStep?: (label: string) => void };

export async function buildRecap(all: Photo[], opts: BuildOpts = {}): Promise<Recap> {
  if (!all.length) throw new Error('No photos could be read.');
  // which year is this about
  const byYear = new Map<number, number>(); for (const p of all) byYear.set(p.date.getFullYear(), (byYear.get(p.date.getFullYear()) || 0) + 1);
  const now = new Date().getFullYear();
  const year = byYear.has(now) ? now : [...byYear.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const ps = all.filter(p => p.date.getFullYear() === year).sort((a, b) => +a.date - +b.date);
  const total = ps.length;

  const months = new Array(12).fill(0); const days = new Map<number, Photo[]>();
  for (const p of ps) { months[p.date.getMonth()]++; const k = dayKey(p.date); (days.get(k) || days.set(k, []).get(k)!).push(p); }
  const topMonth = months.indexOf(Math.max(...months));
  const topDayPhotos = [...days.values()].sort((a, b) => b.length - a.length)[0];
  const span = Math.max(1, dayNum(ps[total - 1].date) - dayNum(ps[0].date) + 1);

  // longest run of days in a row
  const nums = [...new Set(ps.map(p => dayNum(p.date)))].sort((a, b) => a - b);
  let bestA = 0, bestB = 0, a = 0;
  for (let i = 1; i <= nums.length; i++) if (i === nums.length || nums[i] !== nums[i - 1] + 1) { if (i - 1 - a > bestB - bestA) { bestA = a; bestB = i - 1; } a = i; }
  const streakPhotos = ps.filter(p => { const n = dayNum(p.date); return n >= nums[bestA] && n <= nums[bestB]; });
  const streak = { len: bestB - bestA + 1, from: streakPhotos[0].date, to: streakPhotos[streakPhotos.length - 1].date };

  // camera
  const cams = new Map<string, number>(); for (const p of ps) if (p.camera) cams.set(p.camera, (cams.get(p.camera) || 0) + 1);
  const camera = [...cams.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];

  // top place: bucket the map into squares about 14 miles wide, take the fullest and its neighbours
  const geo = ps.filter(p => p.lat !== undefined);
  let place: Recap['place'], placePhotos: Photo[] = [];
  if (geo.length >= 3) {
    const cell = (p: Photo) => `${Math.round(p.lat! * 5)},${Math.round(p.lon! * 5)}`;
    const cells = new Map<string, number>(); for (const p of geo) cells.set(cell(p), (cells.get(cell(p)) || 0) + 1);
    const [cy, cx] = [...cells.entries()].sort((x, y) => y[1] - x[1])[0][0].split(',').map(Number);
    placePhotos = geo.filter(p => Math.abs(Math.round(p.lat! * 5) - cy) <= 1 && Math.abs(Math.round(p.lon! * 5) - cx) <= 1);
    const lat = median(placePhotos.map(p => p.lat!)), lon = median(placePhotos.map(p => p.lon!));
    opts.onStep?.('Naming your top place');
    const nm = opts.placeName ? opts.placeName(lat, lon) : await nameOf(lat, lon);
    place = { name: nm?.name || 'One favorite spot', region: nm?.region || '', named: !!nm, count: placePhotos.length, share: placePhotos.length / total, lat, lon };
  }

  // golden hour: sun low in the sky (between 4° under and 6° over the horizon)
  let golden: Recap['golden'], goldenPhotos: Photo[] = [];
  if (geo.length) {
    const mlat = median(geo.map(p => p.lat!)), mlon = median(geo.map(p => p.lon!));
    goldenPhotos = ps.filter(p => {
      if (p.lat === undefined && p.offsetMin === null) return false;
      const la = p.lat ?? mlat, lo = p.lon ?? mlon, alt = SunCalc.getPosition(instant(p, lo), la, lo).altitude * 180 / Math.PI;
      return alt > -4 && alt < 6;
    });
    if (goldenPhotos.length) golden = { count: goldenPhotos.length };
  }

  // night owl: 10 pm to 4 am on the camera's clock
  const late = (d: Date) => (d.getHours() + 2) % 24 + d.getMinutes() / 60;
  const nightPhotos = ps.filter(p => p.date.getHours() >= 22 || p.date.getHours() < 4);
  const night = nightPhotos.length ? { count: nightPhotos.length, latest: [...nightPhotos].sort((x, y) => late(y.date) - late(x.date))[0].date } : undefined;

  const pal = palette(ps.map(p => p.avg));

  // pictures for the cards
  opts.onStep?.('Picking your best shots');
  const sharpest = (list: Photo[], n: number, skip = new Set<Photo>()) => [...list].filter(p => !skip.has(p)).sort((x, y) => y.sharp - x.sharp).slice(0, n);
  const used = new Set<Photo>();
  const take = (list: Photo[], n: number) => { let got = sharpest(list, n, used); if (got.length < n) got = got.concat(sharpest(list, n - got.length, new Set(got))); got.forEach(p => used.add(p)); return got; };
  const fifths = [0, 1, 2, 3, 4].map(i => ps.slice(Math.floor(i * total / 5), Math.max(Math.floor(i * total / 5) + 1, Math.floor((i + 1) * total / 5))));
  const plan: [CardKind, Photo[], number][] = [];
  plan.push(['intro', fifths.flatMap(f => take(f, 1)), 900]);
  plan.push(['total', take(ps, 3), 700]);
  plan.push(['month', take(ps.filter(p => p.date.getMonth() === topMonth), 2), 900]);
  plan.push(['day', take(topDayPhotos, 3), 700]);
  if (place) plan.push(['place', take(placePhotos, 1), 1000]);
  if (streak.len >= 2) plan.push(['streak', take(streakPhotos, 3), 700]);
  if (golden) plan.push(['golden', take(goldenPhotos, 1), 1000]);
  if (night) plan.push(['night', take(nightPhotos, 1), 1000]);
  plan.push(['ends', [ps[0], ps[total - 1]], 800]);
  plan.push(['color', [], 0]);
  const cards: Card[] = [];
  for (const [kind, list, size] of plan) cards.push({ kind, pics: await Promise.all(list.map(p => p.render(size).catch(() => null))) });
  const tiles: (Pic | null)[] = [];
  for (let m = 0; m < 12; m++) { const best = sharpest(ps.filter(p => p.date.getMonth() === m), 1)[0]; tiles.push(best ? await best.render(480).catch(() => null) : null); }
  cards.push({ kind: 'mosaic', pics: tiles });

  return {
    year, total, otherYears: all.length - total, perWeek: total / (span / 7), activeDays: days.size, camera,
    months, topMonth, topDay: { date: topDayPhotos[0].date, count: topDayPhotos.length }, place, streak, golden, night,
    first: ps[0].date, last: ps[total - 1].date, palette: pal.swatches, paletteName: pal.name, cards,
  };
}
