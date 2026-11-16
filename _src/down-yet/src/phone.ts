// Things the phone can do: sound that ignores the silent switch, haptics, notifications, keeping the screen awake.

let ctx: AudioContext | null = null;
let hush: HTMLAudioElement | null = null;

function silentWav(): string {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

/** Call from a tap. Makes later chimes play, even with the iPhone ring switch on silent. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    const as: any = (navigator as any).audioSession; if (as) { try { as.type = 'playback'; } catch { /* older iOS */ } }
    if (!ctx) ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!hush) { hush = new Audio(silentWav()); hush.loop = true; hush.setAttribute('playsinline', ''); hush.volume = 0.01; }
    hush.play().catch(() => {});
  } catch { /* no audio */ }
}
export function restAudio() { try { hush?.pause(); } catch { /* fine */ } }

/** Three soft bell notes. Rising = back up, falling = went down. */
export function chime(up = true) {
  if (!ctx) return; if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const notes = up ? [659.25, 880, 1318.5] : [880, 659.25, 440]; const t0 = ctx.currentTime + 0.03;
  notes.forEach((f, i) => {
    const t = t0 + i * 0.17, g = ctx!.createGain(); g.connect(ctx!.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    for (const [mult, type, vol] of [[1, 'sine', 1], [2, 'sine', 0.25], [3.01, 'triangle', 0.08]] as const) {
      const o = ctx!.createOscillator(), og = ctx!.createGain(); o.type = type; o.frequency.value = f * mult; og.gain.value = vol; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.15);
    }
  });
}

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

export const canNotify = () => 'Notification' in window;
export const notifyState = (): string => canNotify() ? Notification.permission : 'unsupported';
export async function askNotify(): Promise<string> {
  if (!canNotify()) return 'unsupported';
  if (Notification.permission === 'default') { try { return await Notification.requestPermission(); } catch { return 'denied'; } }
  return Notification.permission;
}
export async function notify(title: string, body: string) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const opts: any = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'down-yet', renotify: true };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.showNotification(title, opts); return; } } catch { /* fall through */ }
  try { new Notification(title, opts); } catch { /* not allowed here */ }
}

let lock: any = null, want = false;
export async function keepAwake(on: boolean) {
  want = on;
  try {
    if (on && !lock && (navigator as any).wakeLock && document.visibilityState === 'visible') { lock = await (navigator as any).wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (want && document.visibilityState === 'visible') keepAwake(true); });
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
