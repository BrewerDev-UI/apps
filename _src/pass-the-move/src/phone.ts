// Things the phone can do: sound that ignores the silent switch, and haptics.

let ctx: AudioContext | null = null;
let hush: HTMLAudioElement | null = null;

function silentWav(): string {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

/** Call from a tap. Makes the music play, even with the iPhone ring switch on silent. */
export function unlockAudio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
    const as: any = (navigator as any).audioSession; if (as) { try { as.type = 'playback'; } catch { /* older iOS */ } }
    if (!ctx) ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!hush) { hush = new Audio(silentWav()); hush.loop = true; hush.setAttribute('playsinline', ''); hush.volume = 0.01; }
    hush.play().catch(() => {});
  } catch { /* no audio */ }
  return ctx;
}
export function restAudio() { try { hush?.pause(); } catch { /* fine */ } }
export const audioCtx = () => ctx;

let sw: HTMLLabelElement | null = null;
/** Vibrate where the browser allows it. iPhone has no vibrate, so tick the system switch haptic instead. */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    if (!sw) {
      sw = document.createElement('label'); sw.setAttribute('aria-hidden', 'true'); sw.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; sw.appendChild(i); document.body.appendChild(sw);
    }
    const n = Array.isArray(pattern) ? Math.min(3, Math.ceil(pattern.length / 2)) : 1;
    for (let k = 0; k < n; k++) setTimeout(() => sw!.click(), k * 130);
  } catch { /* no haptics */ }
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
