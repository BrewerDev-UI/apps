// Draws the finish card: photo or race scene, medal, bib, time, place and splits.

export const LIVE_URL = 'https://brewerdev-ui.github.io/apps/trot-dash/';

export interface CardOpts {
  bg: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  time: string;
  place: string;
  splits: string;
  bib: number;
  weather: string;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function drawMedal(c: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  // ribbon
  c.save();
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + s * R * 0.15, cy - R * 0.7);
    c.lineTo(cx + s * R * 0.95, cy - R * 2.5);
    c.lineTo(cx + s * R * 0.4, cy - R * 2.5);
    c.lineTo(cx - s * R * 0.35, cy - R * 0.8);
    c.closePath();
    c.fillStyle = s < 0 ? '#2D5BFF' : '#FF74B0';
    c.fill();
  }
  c.shadowColor = 'rgba(0,0,0,.45)';
  c.shadowBlur = R * 0.25;
  c.shadowOffsetY = R * 0.08;
  const g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#FFF2B8');
  g.addColorStop(0.45, '#F5B93A');
  g.addColorStop(1, '#B36A12');
  c.beginPath();
  c.arc(cx, cy, R, 0, 6.2832);
  c.fillStyle = g;
  c.fill();
  c.shadowColor = 'transparent';
  c.lineWidth = R * 0.07;
  c.strokeStyle = 'rgba(120,60,0,.55)';
  c.beginPath();
  c.arc(cx, cy, R * 0.8, 0, 6.2832);
  c.stroke();
  c.fillStyle = '#7A3D06';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `${R * 0.78}px Shrikhand, serif`;
  c.fillText('5K', cx, cy - R * 0.06);
  c.font = `700 ${R * 0.19}px Outfit, sans-serif`;
  c.fillText('FINISHER', cx, cy + R * 0.5);
  c.restore();
}

export async function composeCard(o: CardOpts): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load('80px Shrikhand'),
      document.fonts.load('700 40px Outfit'),
      document.fonts.load('500 40px Outfit'),
    ]);
  } catch { /* draw with what we have */ }
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#161340';
  c.fillRect(0, 0, W, H);
  try { o.bg(c, W, H); } catch { /* keep the plain backdrop */ }

  // top and bottom shade so the words read on any photo
  let g = c.createLinearGradient(0, 0, 0, 330);
  g.addColorStop(0, 'rgba(22,19,64,.85)');
  g.addColorStop(1, 'rgba(22,19,64,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, 330);
  g = c.createLinearGradient(0, H - 640, 0, H);
  g.addColorStop(0, 'rgba(22,19,64,0)');
  g.addColorStop(0.55, 'rgba(22,19,64,.82)');
  g.addColorStop(1, 'rgba(22,19,64,.96)');
  c.fillStyle = g; c.fillRect(0, H - 640, W, 640);

  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff';
  c.font = '96px Shrikhand, serif';
  c.fillText('Trot Dash', 60, 130);
  c.font = '700 34px Outfit, sans-serif';
  c.fillStyle = '#FFD9A8';
  c.fillText('SUNRISE TURKEY TROT 5K', 64, 182);
  if (o.weather) {
    c.textAlign = 'right';
    c.font = '500 34px Outfit, sans-serif';
    c.fillStyle = '#fff';
    c.fillText(o.weather, W - 60, 120);
  }

  drawMedal(c, W - 200, H - 690, 120);

  // bib
  c.save();
  c.translate(210, H - 640);
  c.rotate(-0.06);
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  rr(c, -150, -95, 300, 190, 16);
  c.fillStyle = '#FFFDF6'; c.fill();
  c.shadowColor = 'transparent';
  rr(c, -150, -95, 300, 46, 16);
  c.fillStyle = '#FF6A1F'; c.fill();
  c.fillRect(-150, -70, 300, 21);
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.font = '700 26px Outfit, sans-serif';
  c.fillText('TURKEY TROT', 0, -60);
  c.fillStyle = '#161340';
  c.font = '700 112px Outfit, sans-serif';
  c.fillText(String(o.bib), 0, 62);
  c.fillStyle = '#9a9ab0';
  for (const [x, y] of [[-132, -30], [132, -30], [-132, 78], [132, 78]]) {
    c.beginPath(); c.arc(x, y, 6, 0, 6.2832); c.fill();
  }
  c.restore();

  c.textAlign = 'left';
  c.fillStyle = '#fff';
  c.font = '250px Shrikhand, serif';
  c.fillText(o.time, 54, H - 250);
  c.font = '700 62px Outfit, sans-serif';
  c.fillStyle = '#FF6A1F';
  c.fillText(o.place, 62, H - 160);
  c.font = '500 34px Outfit, sans-serif';
  c.fillStyle = '#E9E4FF';
  c.fillText(o.splits, 62, H - 100);
  c.fillStyle = 'rgba(255,255,255,.6)';
  c.font = '500 26px Outfit, sans-serif';
  c.fillText('brewerdev-ui.github.io/apps/trot-dash', 62, H - 48);
  return cv;
}

export const toBlob = (cv: HTMLCanvasElement) =>
  new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/jpeg', 0.9));

/** Call inside a tap. Returns what happened. */
export async function shareBlob(blob: Blob, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], 'trot-dash.jpg', { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: 'Trot Dash 5K' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trot-dash.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}
