// Foot finder. Own canvas code: find the letter sheet, flatten it, find the foot, measure heel to toe.
// A LiteRT.js model (loaded lazily from a CDN) can help find the foot; if it can't load, a plain threshold does the job.
export const PAPER_W = 215.9, PAPER_H = 279.4; // US letter, mm
export type Pt = { x: number; y: number };
export interface Gray { w: number; h: number; d: Uint8ClampedArray }
export interface ScanResult { corners: Pt[]; heel: Pt; toe: Pt; lenMm: number; method: 'ai' | 'threshold'; ok: boolean }

export function toGray(img: ImageData): Gray {
  const { width: w, height: h, data } = img, d = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return { w, h, d };
}
export function blur(g: Gray, r = 2): Gray {
  const { w, h, d } = g, t = new Float32Array(w * h), o = new Uint8ClampedArray(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += d[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / n; s += d[y * w + Math.min(w - 1, x + r + 1)] - d[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / n; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  return { w, h, d: o };
}
export function otsu(d: ArrayLike<number>, mask?: Uint8Array): number {
  const hist = new Float64Array(256); let tot = 0;
  for (let i = 0; i < d.length; i++) if (!mask || mask[i]) { hist[d[i] | 0]++; tot++; }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wb = 0, sb = 0, best = 0, th = 127;
  for (let t = 0; t < 256; t++) { wb += hist[t]; if (!wb) continue; const wf = tot - wb; if (!wf) break; sb += t * hist[t]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) * (mb - mf); if (v > best) { best = v; th = t; } }
  return th;
}
/** Biggest connected blob of 1s (4-neighbour). */
export function biggest(mask: Uint8Array, w: number, h: number): { m: Uint8Array; n: number } {
  const lab = new Int32Array(w * h), st = new Int32Array(w * h); let best = 0, bl = 0, L = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || lab[i]) continue; L++; let sp = 0, c = 0; st[sp++] = i; lab[i] = L;
    while (sp) {
      const p = st[--sp]; c++; const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = L; st[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = L; st[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !lab[p - w]) { lab[p - w] = L; st[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !lab[p + w]) { lab[p + w] = L; st[sp++] = p + w; }
    }
    if (c > best) { best = c; bl = L; }
  }
  const m = new Uint8Array(w * h); if (bl) for (let i = 0; i < m.length; i++) if (lab[i] === bl) m[i] = 1;
  return { m, n: best };
}
/** Four corners of the biggest bright shape (the paper): extreme points along both diagonals. Order TL, TR, BR, BL. */
export function findQuad(g: Gray): Pt[] | null {
  const b = blur(g, 2), th = otsu(b.d), mask = new Uint8Array(g.w * g.h);
  for (let i = 0; i < mask.length; i++) mask[i] = b.d[i] > th ? 1 : 0;
  const { m, n } = biggest(mask, g.w, g.h); if (n < g.w * g.h * 0.06) return null;
  let tl = { v: 1e9, x: 0, y: 0 }, br = { v: -1e9, x: 0, y: 0 }, tr = { v: -1e9, x: 0, y: 0 }, bl = { v: 1e9, x: 0, y: 0 };
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!m[y * g.w + x]) continue; const s = x + y, e = x - y;
    if (s < tl.v) tl = { v: s, x, y }; if (s > br.v) br = { v: s, x, y }; if (e > tr.v) tr = { v: e, x, y }; if (e < bl.v) bl = { v: e, x, y };
  }
  return [tl, tr, br, bl].map(p => ({ x: p.x, y: p.y }));
}
/** Projective map sending the 4 source points to the 4 destination points (3x3, row major). */
export function homography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) { const { x, y } = src[i], { x: u, y: v } = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]); }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return [...Array.from({ length: 8 }, (_, i) => A[i][8] / A[i][i]), 1];
}
export const apply = (H: number[], p: Pt): Pt => { const w = H[6] * p.x + H[7] * p.y + H[8]; return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w }; };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const PX = 2; // flattened sheet pixels per mm
export function rectSize(c: Pt[]) { const land = dist(c[0], c[1]) > dist(c[1], c[2]); return { land, w: Math.round((land ? PAPER_H : PAPER_W) * PX), h: Math.round((land ? PAPER_W : PAPER_H) * PX) }; }
const rectPts = (r: { w: number; h: number }): Pt[] => [{ x: 0, y: 0 }, { x: r.w, y: 0 }, { x: r.w, y: r.h }, { x: 0, y: r.h }];
/** Millimetres between two image points, measured on the flattened sheet. */
export function lengthMm(corners: Pt[], heel: Pt, toe: Pt): number {
  const r = rectSize(corners), H = homography(corners, rectPts(r));
  return dist(apply(H, heel), apply(H, toe)) / PX;
}

/** Find heel and toe on the flattened sheet. `ai` is an optional image-space mask (1 = person). */
function footInSheet(g: Gray, corners: Pt[], ai: Uint8Array | null): { heel: Pt; toe: Pt; method: 'ai' | 'threshold'; ok: boolean } {
  const r = rectSize(corners), { w, h } = r, Hinv = homography(rectPts(r), corners);
  const flat = new Uint8Array(w * h), pm = new Uint8Array(w * h), inset = 14 * PX;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = apply(Hinv, { x, y }), ix = Math.round(p.x), iy = Math.round(p.y), inside = ix >= 0 && iy >= 0 && ix < g.w && iy < g.h;
    flat[y * w + x] = inside ? g.d[iy * g.w + ix] : 255; if (ai && inside) pm[y * w + x] = ai[iy * g.w + ix];
  }
  const inner = new Uint8Array(w * h); for (let y = inset; y < h - inset; y++) for (let x = inset; x < w - inset; x++) inner[y * w + x] = 1;
  const fl = blur({ w, h, d: new Uint8ClampedArray(flat) }, 2).d; let method: 'ai' | 'threshold' = 'threshold';
  let mask = new Uint8Array(w * h);
  if (ai) { let c = 0; for (let i = 0; i < pm.length; i++) if (pm[i] && inner[i]) { mask[i] = 1; c++; } if (c > w * h * 0.02 && c < w * h * 0.5) method = 'ai'; else mask = new Uint8Array(w * h); }
  if (method === 'threshold') {
    const th = otsu(fl, inner), vals: number[] = []; for (let i = 0; i < fl.length; i += 7) if (inner[i]) vals.push(fl[i]); vals.sort((a, b) => a - b);
    const paper = vals[Math.floor(vals.length * 0.85)] || 230, cut = Math.min(th, paper * 0.82);
    for (let i = 0; i < mask.length; i++) mask[i] = inner[i] && fl[i] < cut ? 1 : 0;
  }
  const { m, n } = biggest(mask, w, h);
  if (n < 200) return { heel: apply(Hinv, { x: w / 2, y: h * 0.75 }), toe: apply(Hinv, { x: w / 2, y: h * 0.25 }), method, ok: false };
  let cx = 0, cy = 0; for (let i = 0; i < m.length; i++) if (m[i]) { cx += i % w; cy += (i / w) | 0; } cx /= n; cy /= n;
  let sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < m.length; i++) if (m[i]) { const dx = (i % w) - cx, dy = ((i / w) | 0) - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(ang), ay = Math.sin(ang);
  let lo = 1e9, hi = -1e9; for (let i = 0; i < m.length; i++) if (m[i]) { const t = ((i % w) - cx) * ax + (((i / w) | 0) - cy) * ay; if (t < lo) lo = t; if (t > hi) hi = t; }
  const e0 = { x: cx + ax * lo, y: cy + ay * lo }, e1 = { x: cx + ax * hi, y: cy + ay * hi };
  // the heel rests on a short edge of the sheet: it is the end closer to one
  const edge = (p: Pt) => (r.land ? Math.min(p.x, w - p.x) : Math.min(p.y, h - p.y));
  let [heelF, toeF] = edge(e0) <= edge(e1) ? [e0, e1] : [e1, e0];
  // the mask stops 14 mm short of the sheet edge, so a heel against the edge is clipped: slide it out to the edge
  if (edge(heelF) <= inset + 6) {
    const dx = heelF.x - toeF.x, dy = heelF.y - toeF.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    const comp = r.land ? ux : uy, pos = r.land ? heelF.x : heelF.y, size = r.land ? w : h, target = pos < size / 2 ? 0 : size;
    if (Math.abs(comp) > 0.5) { const s = (target - pos) / comp; if (s > 0 && s < inset + 12) heelF = { x: heelF.x + ux * s, y: heelF.y + uy * s }; }
  }
  return { heel: apply(Hinv, heelF), toe: apply(Hinv, toeF), method, ok: true };
}

const LITERT = 'https://cdn.jsdelivr.net/npm/@litertjs/core@2.6.0';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';
let noAI = false; export const setNoAI = (v: boolean) => { noAI = v; };
/** Optional LiteRT.js person mask (WebGPU, then WASM). Null if it is missing, slow or fails; the threshold takes over. */
export async function aiMask(canvas: HTMLCanvasElement, ms = 9000): Promise<Uint8Array | null> {
  if (noAI) return null;
  const job = (async () => {
    const lib: any = await import(/* @vite-ignore */ `${LITERT}/+esm`);
    await lib.loadLiteRt(`${LITERT}/wasm/`);
    let model: any; try { model = await lib.loadAndCompile(MODEL, { accelerator: 'webgpu' }); } catch { model = await lib.loadAndCompile(MODEL, { accelerator: 'wasm' }); }
    const S = 257, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(canvas, 0, 0, S, S);
    const px = x.getImageData(0, 0, S, S).data, f = new Float32Array(S * S * 3);
    for (let i = 0, j = 0; i < S * S; i++) { f[j++] = (px[i * 4] - 127.5) / 127.5; f[j++] = (px[i * 4 + 1] - 127.5) / 127.5; f[j++] = (px[i * 4 + 2] - 127.5) / 127.5; }
    const out = await model.run(new lib.Tensor(f, [1, S, S, 3])), t: any = Array.isArray(out) ? out[0] : Object.values(out)[0];
    const arr = t.moveTo ? await t.moveTo('wasm') : t, data: Float32Array = arr.toTypedArray ? arr.toTypedArray() : arr, cls = data.length / (S * S);
    const small = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) { let b = 0, bv = -1e9; for (let k = 0; k < cls; k++) { const v = data[i * cls + k]; if (v > bv) { bv = v; b = k; } } small[i] = b === 15 ? 1 : 0; }
    const W = canvas.width, Hh = canvas.height, o = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let xx = 0; xx < W; xx++) o[y * W + xx] = small[Math.min(S - 1, ((y * S) / Hh) | 0) * S + Math.min(S - 1, ((xx * S) / W) | 0)];
    return o;
  })();
  try { return await Promise.race([job, new Promise<null>(r => setTimeout(() => r(null), ms))]); } catch { return null; }
}

export async function loadCanvas(src: Blob | HTMLImageElement | HTMLCanvasElement, max = 1024): Promise<HTMLCanvasElement> {
  let bmp: CanvasImageSource, w: number, h: number;
  if (src instanceof Blob) {
    try { bmp = await createImageBitmap(src, { imageOrientation: 'from-image' } as any); }
    catch { const u = URL.createObjectURL(src); bmp = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; }); }
    w = (bmp as any).width; h = (bmp as any).height;
  } else { bmp = src; w = (src as any).naturalWidth || (src as any).width; h = (src as any).naturalHeight || (src as any).height; }
  const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height); return c;
}
export async function scanFoot(canvas: HTMLCanvasElement): Promise<ScanResult | null> {
  const g = toGray(canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height));
  const corners = findQuad(g); if (!corners) return null;
  const ai = await aiMask(canvas), f = footInSheet(g, corners, ai), len = f.ok ? lengthMm(corners, f.heel, f.toe) : 0;
  return { corners, heel: f.heel, toe: f.toe, lenMm: len, method: f.method, ok: f.ok };
}
