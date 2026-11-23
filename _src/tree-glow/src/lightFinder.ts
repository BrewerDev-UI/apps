// Finds bright bulbs in a camera frame. Runs on the phone; nothing is sent anywhere.
export type Pt = { x: number; y: number }; // 0..1 across the source frame

const W = 160; // analysis width in pixels

export function scanFrame(src: CanvasImageSource, srcW: number, srcH: number): Pt[] {
  const H = Math.max(1, Math.round((W * srcH) / srcW));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [];
  g.drawImage(src, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const n = W * H;
  const br = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    br[i] = v;
    hist[Math.min(255, Math.round(v))]++;
  }
  // Keep the brightest ~8% of pixels as candidates, never below 150 (a dim room stays dim).
  let acc = 0;
  let T = 255;
  const cap = n * 0.08;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > cap) {
      T = v + 1;
      break;
    }
  }
  T = Math.max(150, Math.min(250, T));

  // Group touching bright pixels into blobs (8-connected).
  const lab = new Int32Array(n).fill(-1);
  const blobs: { sx: number; sy: number; area: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (br[i] < T || lab[i] >= 0) continue;
    const id = blobs.length;
    let sx = 0;
    let sy = 0;
    let area = 0;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % W;
      const y = (p - x) / W;
      sx += x;
      sy += y;
      area++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (br[q] >= T && lab[q] < 0) {
            lab[q] = id;
            stack.push(q);
          }
        }
      }
    }
    blobs.push({ sx, sy, area });
  }

  // A bulb is a small blob. Big blobs are lamps, sky or glare; drop them.
  // Blobs closer than ~2.5 px are the same bulb; merge them.
  const out: Pt[] = [];
  const mergeDist = 2.5;
  for (const b of blobs) {
    if (b.area < 1 || b.area > 40) continue;
    const cx = b.sx / b.area;
    const cy = b.sy / b.area;
    if (out.some((p) => Math.hypot(p.x * W - cx, p.y * H - cy) < mergeDist)) continue;
    out.push({ x: (cx + 0.5) / W, y: (cy + 0.5) / H });
  }
  return out;
}
