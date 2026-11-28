// Draws the PNG icons with no dependencies (a tiny rasteriser + zlib).
import { deflateSync } from 'node:zlib'; import { writeFileSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
function png(S, draw) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; for (let x = 0; x < S; x++) { const [r, g, b] = draw(x / S, y / S); const i = y * (S * 4 + 1) + 1 + x * 4; raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(S, 0); ih.writeUInt32BE(S, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const rr = (u, v, x, y, w, h, r) => { const dx = Math.max(x - u, u - (x + w), 0), dy = Math.max(y - v, v - (y + h), 0); const cx = Math.min(Math.max(u, x + r), x + w - r), cy = Math.min(Math.max(v, y + r), y + h - r); return u >= x && u <= x + w && v >= y && v <= y + h && Math.hypot(u - cx, v - cy) <= r + 1e-9 || (u >= x + r && u <= x + w - r && v >= y && v <= y + h) || (v >= y + r && v <= y + h - r && u >= x && u <= x + w); };
const tri = (u, v) => { const t = (v - 0.19) / 0.19; if (t < 0 || t > 1) return false; return Math.abs(u - 0.5) <= 0.109 + 0.0 + (t < 1 ? 0.109 * (1 - 0) * 0 : 0) + t * 0.0 && false; };
const draw = (u, v) => {
  const cel = [0xC9, 0xC7, 0x7E], ink = [0x2F, 0x33, 0x20], cloud = [0xF0, 0xEE, 0xE9], mix = (a, b, t) => a.map((x, i) => Math.round(x * (1 - t) + b[i] * t));
  // arrow head (triangle) and stem
  const head = v >= 0.19 && v <= 0.33 && Math.abs(u - 0.5) <= (v - 0.19) / 0.14 * 0.11, stem = v > 0.33 && v <= 0.43 && Math.abs(u - 0.5) <= 0.039;
  if (head || stem) return cloud;
  if (rr(u, v, 0.34, 0.45, 0.32, 0.055, 0.027)) return ink;
  if (rr(u, v, 0.265, 0.57, 0.47, 0.055, 0.027)) return mix(cel, ink, 0.6);
  if (rr(u, v, 0.19, 0.69, 0.62, 0.055, 0.027)) return mix(cel, ink, 0.35);
  return cel;
};
for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) writeFileSync(new URL('./public/' + n, import.meta.url), png(s, draw));
console.log('icons ok');
