// The share card: one picture made on the phone, sent through the share sheet.
import { type Balloon, drawBalloon } from './balloons';

const asFile = (blob: Blob, name: string) => new File([blob], name, { type: blob.type });
export function canShare(blob: Blob, name: string) { try { return !!navigator.canShare && navigator.canShare({ files: [asFile(blob, name)] }); } catch { return false; } }
/** Opens the phone's share sheet. 'blocked' means the phone wanted a fresh tap first. */
export async function shareFile(blob: Blob, name: string, title: string, text: string): Promise<'shared' | 'cancelled' | 'blocked' | 'unsupported'> {
  if (!canShare(blob, name)) return 'unsupported';
  try { await navigator.share({ files: [asFile(blob, name)], title, text }); return 'shared'; }
  catch (e: any) { return e?.name === 'AbortError' ? 'cancelled' : 'blocked'; }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export type CardInfo = { balloon: Balloon; blocks: number; total: number; headline: string; windLine: string; best: boolean };

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

export async function shareCard(i: CardInfo): Promise<Blob | null> {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); if (!c) return null;
  try { await document.fonts.ready; } catch { /* fine */ }
  // sky
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8FB5FF'); g.addColorStop(0.75, '#DCE8FF'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(820, 180, 10, 820, 180, 420); sun.addColorStop(0, 'rgba(255,246,232,.95)'); sun.addColorStop(1, 'rgba(255,246,232,0)'); c.fillStyle = sun; c.fillRect(0, 0, W, H);
  // skyline with window grids, far row hazier
  for (const row of [0, 1]) {
    let x = -20; let s = row * 50 + 3;
    while (x < W) {
      const w = 90 + rnd(s++) * 110, h = (row ? 260 : 380) + rnd(s++) * 260, top = 980 - h;
      c.fillStyle = row ? '#B9775B' : '#9FAACB'; c.globalAlpha = row ? 1 : 0.75; c.fillRect(x, top, w, h);
      c.fillStyle = row ? 'rgba(255,236,190,.55)' : 'rgba(255,255,255,.35)';
      for (let yy = top + 22; yy < 960; yy += 30) for (let xx = x + 14; xx < x + w - 16; xx += 24) if (rnd(xx * 3 + yy) > 0.3) c.fillRect(xx, yy, 11, 15);
      c.globalAlpha = 1; x += w + 6;
    }
    if (!row) { const fog = c.createLinearGradient(0, 500, 0, 980); fog.addColorStop(0, 'rgba(220,232,255,0)'); fog.addColorStop(1, 'rgba(220,232,255,.55)'); c.fillStyle = fog; c.fillRect(0, 500, W, 480); }
  }
  c.fillStyle = '#8A8FA6'; c.fillRect(0, 960, W, H - 960);
  // confetti
  const party = ['#FF5FA2', '#5DBA6A', '#D9A92E', '#FFF6E8', '#1F2340'];
  for (let k = 0; k < 90; k++) { c.save(); c.translate(rnd(k) * W, rnd(k + 9) * 820); c.rotate(rnd(k + 3) * 6); c.fillStyle = party[k % 5]; c.fillRect(-9, -5, 18, 10); c.restore(); }
  // ropes
  c.strokeStyle = 'rgba(31,35,64,.55)'; c.lineWidth = 5;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(540 + s * 90, 600); c.quadraticCurveTo(540 + s * 170, 800, 540 + s * 230, 960); c.stroke(); }
  // the balloon
  c.save(); c.translate(540, 430); c.scale(4.3, 4.3); drawBalloon(c, i.balloon, 0.6, 1); c.restore();
  // panel
  c.save(); c.shadowColor = 'rgba(31,35,64,.25)'; c.shadowBlur = 40; c.shadowOffsetY = 14; rr(c, 60, 850, 960, 440, 48); c.fillStyle = '#FFF6E8'; c.fill(); c.restore();
  c.save(); rr(c, 60, 850, 960, 440, 48); c.clip(); c.fillStyle = '#FF5FA2'; c.fillRect(60, 850, 960, 18); c.restore();
  c.fillStyle = '#1F2340'; c.textBaseline = 'alphabetic';
  c.font = '250px "TP Display", sans-serif'; c.textAlign = 'left'; c.fillText(String(i.blocks), 110, 1110);
  const nw = c.measureText(String(i.blocks)).width;
  c.font = '44px "TP Body", sans-serif'; c.fillText(`of ${i.total} blocks`, 130 + nw, 1010);
  c.fillStyle = '#B9775B'; c.font = '50px "TP Body", sans-serif'; c.fillText(i.balloon.name + (i.best ? ' · new best' : ''), 130 + nw, 1080);
  c.fillStyle = '#1F2340'; c.font = '54px "TP Body", sans-serif'; c.fillText(i.headline, 110, 1195);
  c.fillStyle = '#5A5F7A'; c.font = '38px "TP Body", sans-serif'; c.fillText(i.windLine, 110, 1250);
  c.fillStyle = '#FF5FA2'; c.font = '64px "TP Display", sans-serif'; c.textAlign = 'right'; c.fillText('Tilt Parade', 1020, 100);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}
