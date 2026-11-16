import { BY_ID, lightOn } from './services';
import { COLOR, type Verdict } from './api';

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

/** Draws the verdict as a 1080x1350 picture and opens the share sheet (or downloads it). */
export async function shareCard(v: Verdict, sub: string) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  try { await (document as any).fonts?.ready; } catch { /* use fallback fonts */ }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#F7F5F0'); bg.addColorStop(1, '#E9E5DC'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // paper grain
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(28,28,30,${Math.random() * 0.035})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  const col = COLOR[v.tone], cx = W / 2, cy = 430, r = 250;
  const glow = g.createRadialGradient(cx, cy + 90, r * 0.4, cx, cy + 90, r * 1.45); glow.addColorStop(0, col + '88'); glow.addColorStop(1, col + '00'); g.fillStyle = glow; g.fillRect(0, 0, W, 900);
  const body = g.createRadialGradient(cx - 40, cy - 60, 20, cx, cy, r); body.addColorStop(0, '#ffffff'); body.addColorStop(0.08, col); body.addColorStop(0.7, col); body.addColorStop(1, '#00000055');
  g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  const shade = g.createRadialGradient(cx - 50, cy - 80, r * 0.2, cx, cy, r); shade.addColorStop(0, 'rgba(255,255,255,.35)'); shade.addColorStop(0.6, 'rgba(255,255,255,0)'); shade.addColorStop(1, 'rgba(0,0,0,.38)');
  g.fillStyle = shade; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  const hi = g.createRadialGradient(cx - 85, cy - 120, 0, cx - 85, cy - 120, 110); hi.addColorStop(0, 'rgba(255,255,255,.95)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  // what's inside the orb
  g.save(); g.translate(cx, cy); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const s = v.logo ? BY_ID[v.logo] : null;
  if (v.icon === 'logo' && s?.path) { g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 8; g.scale(9, 9); g.translate(-12, -12); g.fill(new Path2D(s.path)); }
  else if (v.icon === 'logo' && s) { g.font = '800 170px "Inter Tight", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.mark || s.name[0], 0, 8); }
  else if (v.icon === 'wifi') { g.lineWidth = 26; for (const [rad, a] of [[150, 0.72], [95, 0.8]] as const) { g.beginPath(); g.arc(0, 70, rad, -Math.PI / 2 - a, -Math.PI / 2 + a); g.stroke(); } g.beginPath(); g.arc(0, 70, 20, 0, 7); g.fill(); g.beginPath(); g.moveTo(-120, -110); g.lineTo(120, 120); g.stroke(); }
  else { g.lineWidth = 34; g.beginPath(); g.moveTo(-95, 5); g.lineTo(-30, 70); g.lineTo(100, -65); g.stroke(); }
  g.restore();
  g.fillStyle = '#1C1C1E'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '800 112px "Inter Tight", system-ui, sans-serif'; g.fillText(v.title, cx, 860);
  g.font = '500 50px Inter, system-ui, sans-serif'; g.fillStyle = '#3A3A3D';
  wrap(g, v.line, 900).slice(0, 4).forEach((l, i) => g.fillText(l, cx, 950 + i * 66));
  g.fillStyle = '#6B6760'; g.font = '500 36px Inter, system-ui, sans-serif'; g.fillText(sub, cx, 1232);
  g.fillStyle = '#1C1C1E'; g.font = '800 44px "Inter Tight", system-ui, sans-serif'; g.fillText('Down Yet', cx, 1290);
  void lightOn;
  const blob: Blob | null = await new Promise(res => c.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'down-yet.png', { type: 'image/png' });
  const nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: 'Down Yet', text: `${v.title} ${v.line}` }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'down-yet.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
