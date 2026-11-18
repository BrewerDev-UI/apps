// Turning cards into things you can share: a 1080x1920 picture, or the whole story as a short video.
import type { Card, Recap } from './analyze';
import { drawCard } from './draw';

export function cardImage(R: Recap, card: Card): Promise<Blob | null> {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  drawCard(c.getContext('2d')!, 1080, 1920, R, card, 99, {});
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.92));
}

const asFile = (blob: Blob, name: string) => new File([blob], name, { type: blob.type });
export function canShare(blob: Blob, name: string) { try { return !!navigator.canShare && navigator.canShare({ files: [asFile(blob, name)] }); } catch { return false; } }
/** Opens the phone's share sheet. 'blocked' means the phone wanted a fresh tap first. */
export async function shareFile(blob: Blob, name: string, title: string): Promise<'shared' | 'cancelled' | 'blocked' | 'unsupported'> {
  if (!canShare(blob, name)) return 'unsupported';
  try { await navigator.share({ files: [asFile(blob, name)], title }); return 'shared'; }
  catch (e: any) { return e?.name === 'AbortError' ? 'cancelled' : 'blocked'; }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
function mime() { const MR = (window as any).MediaRecorder; if (!MR || !('captureStream' in HTMLCanvasElement.prototype)) return ''; return MIMES.find(t => { try { return MR.isTypeSupported(t); } catch { return false; } }) || ''; }
export const videoSupported = () => !!mime();
export const videoExt = (b: Blob) => (b.type.includes('mp4') ? 'mp4' : 'webm');

const PER = 3.3, LAST = 4.6, SLIDE = 0.45;
/** Plays the story into a hidden 720x1280 canvas and records it. Takes about as long as the video is. */
export function recordStory(R: Recap, audio: MediaStream | null, onProgress: (p: number) => void) {
  const W = 720, H = 1280, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!, n = R.cards.length, total = (n - 1) * PER + LAST, type = mime();
  let stop = false, raf = 0, rec: MediaRecorder | null = null;
  const done = new Promise<Blob | null>(resolve => {
    if (!type) { resolve(null); return; }
    drawCard(g, W, H, R, R.cards[0], 0, {});
    const stream: MediaStream = (canvas as any).captureStream(30);
    try { audio?.getAudioTracks().forEach(t => stream.addTrack(t)); } catch { /* silent video is fine */ }
    const chunks: Blob[] = [];
    try { rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 }); } catch { resolve(null); return; }
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { cancelAnimationFrame(raf); stream.getVideoTracks().forEach(t => t.stop()); resolve(stop || !chunks.length ? null : new Blob(chunks, { type: type.split(';')[0] })); };
    rec.onerror = () => { stop = true; try { rec!.stop(); } catch { resolve(null); } };
    rec.start(500);
    const t0 = performance.now();
    const frame = () => {
      const e = (performance.now() - t0) / 1000; if (stop) return;
      if (e >= total) { try { rec!.stop(); } catch { resolve(null); } return; }
      const i = Math.min(n - 1, Math.floor(e / PER)), t = e - i * PER;
      if (i > 0 && t < SLIDE) {
        const x = t / SLIDE, p = 1 - (1 + 7 * x) * Math.exp(-7 * x);
        g.save(); g.translate(-W * 0.3 * p, 0); drawCard(g, W, H, R, R.cards[i - 1], PER, {}); g.restore();
        g.fillStyle = `rgba(0,0,0,${0.45 * p})`; g.fillRect(0, 0, W, H);
        g.save(); g.translate(W * (1 - p), 0); drawCard(g, W, H, R, R.cards[i], t, {}); g.restore();
      } else drawCard(g, W, H, R, R.cards[i], t, {});
      onProgress(e / total); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  return { canvas, done, seconds: total, cancel() { stop = true; cancelAnimationFrame(raf); try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* already stopped */ } } };
}
