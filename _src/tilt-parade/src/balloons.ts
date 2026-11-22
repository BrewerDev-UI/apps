// Five original parade balloons, drawn in code. Each has its own weight (how high it rides) and drift (how much wind it catches).

type C = CanvasRenderingContext2D;
export type Balloon = {
  id: string; name: string; unlock: number; weight: number; drift: number; r: number;
  blurb: string; color: string; draw: (c: C, t: number) => void;
};

const INK = '#1F2340';
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

/** One inflated lobe: shaded like a lit vinyl balloon, with a soft highlight and gore seams. */
function blob(c: C, x: number, y: number, rx: number, ry: number, rot: number, col: string, seams = true, glow = 0.55) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, ry / rx);
  const g = c.createRadialGradient(-rx * 0.35, -rx * 0.42, rx * 0.08, 0, 0, rx * 1.04);
  g.addColorStop(0, mix(col, '#FFFFFF', 0.5)); g.addColorStop(0.42, col); g.addColorStop(0.86, mix(col, INK, 0.3)); g.addColorStop(1, mix(col, INK, 0.5));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill();
  if (seams && rx > 13) {
    c.strokeStyle = 'rgba(31,35,64,.13)'; c.lineWidth = Math.max(0.8, rx * 0.022);
    c.beginPath(); c.ellipse(0, 0, rx * 0.42, rx * 0.985, 0, -1.5, 1.5); c.stroke();
    c.beginPath(); c.ellipse(0, 0, rx * 0.42, rx * 0.985, 0, 1.64, 4.64); c.stroke();
    c.beginPath(); c.ellipse(0, 0, rx * 0.985, rx * 0.3, 0, 0.1, 3.04); c.stroke();
  }
  if (glow > 0) {
    const h = c.createRadialGradient(-rx * 0.4, -rx * 0.46, 0, -rx * 0.4, -rx * 0.46, rx * 0.42);
    h.addColorStop(0, `rgba(255,255,255,${glow})`); h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h; c.beginPath(); c.arc(-rx * 0.4, -rx * 0.46, rx * 0.42, 0, 7); c.fill();
    // light bouncing up off the street
    const b = c.createRadialGradient(rx * 0.2, rx * 0.8, 0, rx * 0.2, rx * 0.8, rx * 0.5);
    b.addColorStop(0, 'rgba(255,246,232,.2)'); b.addColorStop(1, 'rgba(255,246,232,0)');
    c.fillStyle = b; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill();
  }
  c.restore();
}
function eye(c: C, x: number, y: number, r: number, look = 0, iris = INK) {
  c.fillStyle = '#FFFDF8'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(31,35,64,.25)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = iris; c.beginPath(); c.arc(x + look, y + r * 0.12, r * 0.56, 0, 7); c.fill();
  if (iris !== INK) { c.fillStyle = INK; c.beginPath(); c.arc(x + look, y + r * 0.12, r * 0.3, 0, 7); c.fill(); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x + look - r * 0.2, y - r * 0.14, r * 0.17, 0, 7); c.fill();
}
function tri(c: C, pts: number[], col: string) {
  const g = c.createLinearGradient(pts[0], pts[1] - 8, pts[0], pts[1] + 14);
  g.addColorStop(0, mix(col, '#FFFFFF', 0.35)); g.addColorStop(1, mix(col, INK, 0.25));
  c.fillStyle = g; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill();
}

function turkey(c: C, t: number) {
  const fan = ['#D9A92E', '#FF5FA2', '#5DBA6A', '#B9775B', '#5DBA6A', '#FF5FA2', '#D9A92E'];
  fan.forEach((col, i) => { const a = -1.05 + i * 0.35 + Math.sin(t * 1.3 + i) * 0.015; blob(c, Math.sin(a) * 52, -8 - Math.cos(a) * 46, 15, 36, a, col, true, 0.4); });
  blob(c, -47, 14, 17, 30, 0.35, '#8C5433'); blob(c, 47, 14, 17, 30, -0.35, '#8C5433');
  blob(c, 0, 14, 55, 50, 0, '#A8643C');
  blob(c, 0, 26, 33, 29, 0, '#D9B48A', false, 0.3);
  blob(c, -17, 62, 11, 7, 0, '#D9A92E', false); blob(c, 17, 62, 11, 7, 0, '#D9A92E', false);
  blob(c, 0, -40, 27, 26, 0, '#A8643C');
  blob(c, 5, -22, 6, 11, 0.1, '#FF5FA2', false);
  tri(c, [-9, -37, 9, -37, 0, -24], '#D9A92E');
  eye(c, -11, -46, 7.5, Math.sin(t * 0.7) * 1.4); eye(c, 11, -46, 7.5, Math.sin(t * 0.7) * 1.4);
  // captain's hat
  blob(c, 0, -63, 31, 6.5, 0, INK, false, 0.25);
  blob(c, 0, -72, 21, 13, 0, '#2B3160', false, 0.35);
  c.fillStyle = '#D9A92E'; c.fillRect(-19, -68.5, 38, 3.4);
  blob(c, 0, -74, 5, 5, 0, '#D9A92E', false);
}
function pup(c: C, t: number) {
  blob(c, 40, 34, 9, 19, -0.9 + Math.sin(t * 3) * 0.12, '#EFE6DA');
  blob(c, -36, 46, 14, 11, 0, '#FFF6E8'); blob(c, 36, 46, 14, 11, 0, '#FFF6E8');
  blob(c, 0, 24, 46, 40, 0, '#F7F1E8');
  c.fillStyle = '#8FB5FF'; c.beginPath(); c.roundRect(-17, 12, 34, 22, 6); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.roundRect(-14, 14, 28, 6, 3); c.fill();
  blob(c, -8, 27, 4, 4, 0, '#FF5FA2', false); blob(c, 2, 27, 4, 4, 0, '#5DBA6A', false); blob(c, 11, 27, 3, 3, 0, '#D9A92E', false);
  blob(c, -29, -30, 13, 25, 0.35, '#B9775B'); blob(c, 29, -30, 13, 25, -0.35, '#B9775B');
  blob(c, 0, -34, 32, 30, 0, '#F2C89B');
  blob(c, 0, -24, 16, 12, 0, '#FFF6E8', false, 0.3);
  blob(c, 0, -29, 5.5, 4, 0, INK, false, 0.5);
  c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.arc(-4, -24, 4, 0.2, 2.6); c.stroke(); c.beginPath(); c.arc(4, -24, 4, 0.5, 2.9); c.stroke();
  eye(c, -12, -40, 6.5, Math.sin(t * 0.8) * 1.2); eye(c, 12, -40, 6.5, Math.sin(t * 0.8) * 1.2);
  // helmet bubble
  const g = c.createRadialGradient(-16, -52, 4, 0, -34, 46);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.35, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(143,181,255,.3)');
  c.fillStyle = g; c.beginPath(); c.arc(0, -34, 45, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.beginPath(); c.arc(0, -34, 37, 3.5, 4.3); c.stroke();
  blob(c, 0, 5, 30, 7, 0, '#FF5FA2', false, 0.3);
}
function pie(c: C, t: number) {
  const f = 1 + Math.sin(t * 9) * 0.08;
  blob(c, 0, 66, 11 * f, 17 * f, 0, '#D9A92E', false, 0.7); blob(c, 0, 62, 6, 10 * f, 0, '#FFF6E8', false, 0);
  blob(c, -33, 36, 13, 26, 0.5, '#B9775B'); blob(c, 33, 36, 13, 26, -0.5, '#B9775B');
  blob(c, 0, 8, 36, 56, 0, '#E2A85A');
  for (let i = -2; i <= 2; i++) blob(c, i * 13, 50 - Math.abs(i) * 2.5, 10, 9, 0, '#FFFDF8', false, 0.5);
  blob(c, 0, -40, 27, 25, 0, '#FF5FA2');
  for (let i = -2; i <= 2; i++) blob(c, i * 13.5, -22 + Math.abs(i) * 1.5, 8.5, 7.5, 0, '#EDBE7A', false, 0.45);
  c.fillStyle = INK; c.beginPath(); c.arc(0, 6, 15.5, 0, 7); c.fill();
  const g = c.createRadialGradient(-5, 1, 1, 0, 6, 13); g.addColorStop(0, '#DCE8FF'); g.addColorStop(1, '#8FB5FF');
  c.fillStyle = g; c.beginPath(); c.arc(0, 6, 12, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 6, 8, 3.6, 4.6); c.stroke();
  c.strokeStyle = 'rgba(120,70,30,.5)'; c.lineWidth = 2; c.lineCap = 'round';
  [-9, 0, 9].forEach(x => { c.beginPath(); c.moveTo(x, -50); c.quadraticCurveTo(x + 3, -45, x, -40); c.stroke(); });
}
function owl(c: C, t: number) {
  blob(c, -46, 10, 16, 40, 0.22, '#D5DCEA'); blob(c, 46, 10, 16, 40, -0.22, '#D5DCEA');
  blob(c, 0, 6, 51, 60, 0, '#FBFCFF');
  c.strokeStyle = 'rgba(31,35,64,.28)'; c.lineWidth = 2; c.lineCap = 'round';
  for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) { if (Math.abs(i) + r > 3) continue; c.beginPath(); c.arc(i * 14 + (r % 2) * 7, 24 + r * 12, 4, 0.3, 2.8); c.stroke(); }
  tri(c, [-34, -44, -22, -60, -16, -42], '#D5DCEA'); tri(c, [34, -44, 22, -60, 16, -42], '#D5DCEA');
  blob(c, -18, -22, 19, 19, 0, '#FFF6E8', false, 0.2); blob(c, 18, -22, 19, 19, 0, '#FFF6E8', false, 0.2);
  const look = Math.sin(t * 0.6) * 2;
  eye(c, -18, -22, 11.5, look, '#D9A92E'); eye(c, 18, -22, 11.5, look, '#D9A92E');
  tri(c, [-5, -12, 5, -12, 0, -1], '#D9A92E');
  blob(c, 0, 6, 40, 7.5, 0, '#FF5FA2', false, 0.3); blob(c, 22, 18, 6.5, 14, -0.2, '#FF5FA2', false, 0.3);
  blob(c, -15, 66, 10, 6, 0, '#D9A92E', false); blob(c, 15, 66, 10, 6, 0, '#D9A92E', false);
}
function sneaker(c: C, _t: number) {
  blob(c, 0, 42, 68, 15, 0, '#FFF6E8');
  blob(c, -36, -22, 26, 34, 0.12, '#FF5FA2');
  blob(c, -4, 14, 60, 33, 0.05, '#FF5FA2');
  blob(c, 42, 24, 25, 20, 0, '#FFF6E8');
  blob(c, -40, -50, 22, 9, 0.1, '#FFF6E8', false, 0.4);
  c.strokeStyle = '#5DBA6A'; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-42, 26); c.quadraticCurveTo(-24, 10, -30, -8); c.stroke();
  c.beginPath(); c.moveTo(-28, 30); c.quadraticCurveTo(-10, 14, -16, -2); c.stroke();
  c.strokeStyle = '#FFFDF8'; c.lineWidth = 3.4;
  for (let i = 0; i < 4; i++) { const x = -6 + i * 9, y = -10 + i * 7; c.beginPath(); c.moveTo(x - 8, y + 5); c.lineTo(x + 7, y - 4); c.stroke(); }
  c.fillStyle = '#D9A92E'; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9.5; c.lineTo(-50 + Math.cos(a) * r, 2 + Math.sin(a) * r); }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(31,35,64,.18)'; c.lineWidth = 1.5;
  for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * 11, 46); c.lineTo(i * 11 + 2, 54); c.stroke(); }
}

export const BALLOONS: Balloon[] = [
  { id: 'turkey', name: 'Turkey Captain', unlock: 0, weight: 1, drift: 1, r: 60, blurb: 'Steady all-rounder', color: '#A8643C', draw: turkey },
  { id: 'pup', name: 'Space Pup', unlock: 8, weight: 0.82, drift: 1.18, r: 56, blurb: 'Light, rides high, catches wind', color: '#8FB5FF', draw: pup },
  { id: 'pie', name: 'Pie Rocket', unlock: 16, weight: 1.22, drift: 0.8, r: 56, blurb: 'Heavy, rides low, shrugs off gusts', color: '#E2A85A', draw: pie },
  { id: 'owl', name: 'Snow Owl', unlock: 26, weight: 0.95, drift: 1.32, r: 61, blurb: 'Wide wings, big drift', color: '#C8D2E8', draw: owl },
  { id: 'sneaker', name: 'Sneaker', unlock: 43, weight: 1.12, drift: 1.1, r: 64, blurb: 'Long and lopsided, for show-offs', color: '#FF5FA2', draw: sneaker },
];
export const balloonById = (id: string) => BALLOONS.find(b => b.id === id) || BALLOONS[0];

/** Draw a balloon centered at 0,0. air 1 = full; lower sags and wrinkles. */
export function drawBalloon(c: C, b: Balloon, t: number, air = 1) {
  const sag = 1 - Math.max(0, Math.min(1, air));
  c.save(); c.scale(1 + sag * 0.07, 1 - sag * 0.2); c.translate(0, sag * 10);
  b.draw(c, t);
  c.restore();
}
