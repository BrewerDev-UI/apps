// Your go: the camera, the green skeleton, the mini dancer and the live score.
import { useEffect, useRef, useState } from 'react';
import Dancer from './Dancer';
import { beatPos, now, restartIn } from './beat';
import { Clip } from './clip';
import { loadJudge, see } from './judge';
import { haptic } from './phone';
import { bodyFrom, joints, judge, poseAt, SEGS, type Body, type Move } from './pose';

export type Result = { score: number; counts: number[]; frames: HTMLCanvasElement[]; tip: string; demo: boolean };
type Props = { move: Move; kid: boolean; name: string; demo: boolean; onDone: (r: Result) => void; onCancel: () => void; onDemo: () => void };
const rad = Math.PI / 180;
const BONES: [keyof Body, keyof Body][] = [['lSh', 'rSh'], ['lHip', 'rHip'], ['lSh', 'lHip'], ['rSh', 'rHip'], ...SEGS.map(s => [s[0], s[1]] as [keyof Body, keyof Body])];

export default function Play({ move, kid, name, demo, onDone, onCancel, onDemo }: Props) {
  const cv = useRef<HTMLCanvasElement>(null), video = useRef<HTMLVideoElement>(null);
  const scoreEl = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null), chipsEl = useRef<HTMLDivElement>(null), inEl = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'loading' | 'go' | 'unseen' | 'error'>(demo ? 'go' : 'loading');
  const [err, setErr] = useState<'cam' | 'judge'>('cam'), [tryNo, setTryNo] = useState(0);
  const done = useRef(onDone); done.current = onDone;
  const n = move.poses.length;

  // Keep the screen awake while someone is dancing.
  useEffect(() => {
    let lock: any = null, dead = false;
    (navigator as any).wakeLock?.request('screen').then((l: any) => { if (dead) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    return () => { dead = true; lock?.release().catch(() => {}); };
  }, []);

  // Camera and judge. The picture goes from the camera to this page and nowhere else.
  useEffect(() => {
    if (demo) { setPhase('go'); return; }
    let dead = false, stream: MediaStream | null = null;
    const stop = (s: MediaStream | null) => s?.getTracks().forEach(t => t.stop());
    (async () => {
      const jp = loadJudge(); jp.catch(() => {});
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: false });
        if (dead) { stop(s); return; }
        stream = s; const v = video.current!; v.srcObject = s; await v.play();
      } catch { if (!dead) { setErr('cam'); setPhase('error'); } return; }
      try { await jp; } catch { if (!dead) { setErr('judge'); setPhase('error'); } return; }
      if (!dead) setPhase('go');
    })();
    return () => { dead = true; stop(stream); };
  }, [demo]);

  useEffect(() => {
    if (phase !== 'go') return;
    const c = cv.current!, g = c.getContext('2d')!, dpr = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0; const fit = () => { W = c.clientWidth; H = c.clientHeight; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); };
    fit(); addEventListener('resize', fit);
    const total = n * 2, best: number[] = new Array(n).fill(-1), tips: string[] = new Array(n).fill('');
    const chips = chipsEl.current!.children, clip = new Clip();
    const skill = 0.5 + Math.random() * 0.5, seeds = Array.from({ length: 8 }, () => Math.random() * 6.28);
    let top = -1, seen = 0, raf = 0, dead = false, lastDet = 0, body: Body | null = null, lastIn = 99, lastK = -99, shown = '', tipShown = '';
    for (let i = 0; i < chips.length; i++) { chips[i].textContent = String(i + 1); chips[i].className = 'chip'; }
    restartIn(4);

    const line = (a: keyof Body, b: keyof Body) => { const A = body![a], B = body![b]; if (A.v < 0.45 || B.v < 0.45) return; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); };
    const frame = () => {
      if (dead) return; raf = requestAnimationFrame(frame);
      const bp = beatPos(), t = now();
      if (demo) {
        const q = poseAt(move, bp - 0.12), q2 = { ...q, a: q.a.map((v, i) => v + (1 - skill) * 70 * Math.sin(seeds[i] + t * 0.9)) };
        body = bodyFrom(joints(q2), W / 2, H * 0.83, H * 0.36, i => Math.sin(t * 6 + i * 1.7) * 1.5);
      } else if (t - lastDet > 0.04) { lastDet = t; body = see(video.current!, W, H); }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = video.current;
      if (!demo && v && v.videoWidth) {
        const s = Math.max(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
        g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h); g.restore();
        g.fillStyle = 'rgba(11,15,51,.3)'; g.fillRect(0, 0, W, H);
      } else {
        const bg = g.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.5, H * 0.75); bg.addColorStop(0, '#3A5BFF'); bg.addColorStop(1, '#0B0F33');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(11,15,51,.45)'; g.beginPath(); g.ellipse(W / 2, H * 0.835, W * 0.3, 14, 0, 0, 7); g.fill();
        if (body) { // a soft stand-in body for the practice round
          g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineCap = 'round'; g.lineWidth = 30; BONES.forEach(([a, b]) => line(a, b));
          const hx = (body.lSh.x + body.rSh.x) / 2, hy = (body.lSh.y + body.rSh.y) / 2 - H * 0.07;
          g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(hx, hy, H * 0.042, 0, 7); g.fill();
        }
      }

      const k = Math.floor(bp + 0.2), idx = ((k % n) + n) % n, j = judge(body, move.poses[idx], move.w, kid);
      if (body) {
        g.lineCap = 'round'; g.shadowColor = '#6DBE6A'; g.shadowBlur = 16; g.strokeStyle = '#8BE088'; g.lineWidth = 6;
        BONES.forEach(([a, b], i) => { if (bp >= 0 && i - 4 === j.worst) return; line(a, b); });
        g.shadowBlur = 0;
        if (bp >= 0 && j.worst >= 0) {
          const [a, b, side] = SEGS[j.worst], A = body[a], B = body[b], len = Math.hypot(B.x - A.x, B.y - A.y), ang = move.poses[idx].a[j.worst] * rad;
          const tx = A.x + side * Math.sin(ang) * len, ty = A.y + Math.cos(ang) * len;
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; line(a, b);
          g.strokeStyle = '#FF5C9A'; g.lineWidth = 5; g.setLineDash([9, 9]); g.lineDashOffset = -t * 40; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#FF5C9A'; g.beginPath(); g.arc(tx, ty, 9, 0, 7); g.fill();
        }
        g.fillStyle = '#fff';
        (Object.keys(body) as (keyof Body)[]).forEach(key => { const p = body![key]; if (p.v < 0.45) return; g.beginPath(); g.arc(p.x, p.y, 4.5, 0, 7); g.fill(); });
      }

      // Count-in, then two passes over the move. Each count keeps its best try.
      if (bp < 0) {
        const cnt = Math.ceil(-bp);
        if (cnt !== lastIn && inEl.current) { lastIn = cnt; inEl.current.textContent = String(cnt); inEl.current.className = 'countin pop'; void inEl.current.offsetWidth; inEl.current.classList.add('go'); haptic(8); }
      } else if (lastIn !== 0 && inEl.current) { lastIn = 0; inEl.current.textContent = 'GO'; inEl.current.className = 'countin pop'; void inEl.current.offsetWidth; inEl.current.classList.add('go', 'fade'); haptic([14, 40, 14]); }
      if (k >= 0 && k < total) {
        if (k !== lastK) { lastK = k; for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('on', i === idx); }
        if (bp - k <= 0.4 && j.seen) {
          seen++;
          if (j.score > best[idx]) { best[idx] = j.score; tips[idx] = j.tip; chips[idx].textContent = String(j.score); chips[idx].classList.add('got'); chips[idx].classList.toggle('hot', j.score >= 90); }
          if (j.score > top) { top = j.score; clip.mark(t); }
        }
      }
      const s = bp < 0 ? '' : j.seen ? String(j.score) : '–', tip = bp < 0 ? `Watch the dancer, ${name}` : j.tip;
      if (s !== shown && scoreEl.current) { shown = s; scoreEl.current.textContent = s; }
      if (tip !== tipShown && tipEl.current) { tipShown = tip; tipEl.current.textContent = tip; }
      clip.push(c, t);

      if (bp >= total + 0.4) {
        dead = true; cancelAnimationFrame(raf); clip.end();
        if (seen < 3) { setPhase('unseen'); return; }
        const counts = best.map(x => Math.max(0, x)), score = Math.round(counts.reduce((a, b) => a + b, 0) / n);
        let low = 0; counts.forEach((x, i) => { if (x < counts[low]) low = i; });
        done.current({ score, counts, frames: clip.frames, tip: counts[low] >= 90 ? '' : tips[low], demo });
      }
    };
    frame();
    return () => { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, [phase, tryNo, move, demo, kid, n, name]);

  return (
    <div className="play">
      <video ref={video} playsInline muted className="cam" />
      <canvas ref={cv} className="view" />
      <button className="x" onClick={onCancel} aria-label="Stop"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg></button>
      {phase === 'go' && <>
        <div className="who"><b>{name}</b><span>{move.name}{demo ? ' · practice' : ''}</span></div>
        <div className="minibox"><Dancer mini lift={0} getPose={() => poseAt(move, beatPos())} /></div>
        <div ref={inEl} className="countin" />
        <div className="hud">
          <div ref={tipEl} className="tip" />
          <div className="hudrow">
            <div ref={scoreEl} className="live" />
            <div ref={chipsEl} className={n > 4 ? 'chips many' : 'chips'}>{move.poses.map((_, i) => <i key={i} className="chip">{i + 1}</i>)}</div>
          </div>
        </div>
      </>}
      {phase === 'loading' && <div className="veil"><div className="spin" /><h2>Getting the judge ready</h2><p>About 20 MB the first time, then it's saved. Say yes to the camera. Video stays on this phone.</p><button className="ghost" onClick={onDemo}>Practice without camera</button></div>}
      {phase === 'error' && <div className="veil"><h2>{err === 'cam' ? 'No camera' : 'The judge didn’t load'}</h2><p>{err === 'cam' ? 'Allow the camera for this page, then try again. Or dance a practice round with no camera.' : 'Check your connection and try again. Or dance a practice round with no camera.'}</p><button className="big" onClick={onDemo}>Practice round</button><button className="ghost" onClick={onCancel}>Back</button></div>}
      {phase === 'unseen' && <div className="veil"><h2>I couldn’t see you</h2><p>Prop the phone up, step back until your arms and hips fit on screen, and find some light.</p><button className="big" onClick={() => { setTryNo(x => x + 1); setPhase('go'); }}>Try again</button><button className="ghost" onClick={onCancel}>Back</button></div>}
    </div>
  );
}
