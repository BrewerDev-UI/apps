// Sharing the best-moment clip. Everything is made on the phone.
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
export const ext = (b: Blob) => (b.type.includes('mp4') ? 'mp4' : b.type.includes('webm') ? 'webm' : 'png');

/** Records `seconds` of whatever `draw` paints. Falls back to one still picture if the phone can't record. */
export function recordClip(W: number, H: number, seconds: number, draw: (g: CanvasRenderingContext2D, t: number) => void, audio: MediaStream | null): Promise<Blob | null> {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!, type = mime();
  const still = () => new Promise<Blob | null>(res => { draw(g, seconds / 2); canvas.toBlob(b => res(b), 'image/png'); });
  if (!type) return still();
  return new Promise<Blob | null>(resolve => {
    draw(g, 0);
    let rec: MediaRecorder, raf = 0;
    const stream: MediaStream = (canvas as any).captureStream(30), chunks: Blob[] = [];
    try { audio?.getAudioTracks().forEach(t => stream.addTrack(t.clone())); } catch { /* a silent clip is fine */ }
    try { rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 }); } catch { still().then(resolve); return; }
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); if (chunks.length) resolve(new Blob(chunks, { type: type.split(';')[0] })); else still().then(resolve); };
    rec.onerror = () => { try { rec.stop(); } catch { still().then(resolve); } };
    rec.start(500);
    const t0 = performance.now();
    const frame = () => { const e = (performance.now() - t0) / 1000; if (e >= seconds) { try { rec.stop(); } catch { still().then(resolve); } return; } draw(g, e); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
  });
}
