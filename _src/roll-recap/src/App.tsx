import { useCallback, useEffect, useRef, useState } from 'react';
import { buildRecap, readPhotos, type Recap } from './analyze';
import { cardBg, drawCard, lightCard } from './draw';
import { duck, musicStream, setMuted, startMusic, stopMusic } from './music';
import { audioCtx, haptic, isIOS, restAudio, unlockAudio } from './phone';
import { samplePhotos, samplePlace, sceneCanvas } from './sample';
import { cardImage, download, recordStory, shareFile, videoExt, videoSupported } from './share';

const YEAR = new Date().getFullYear();
const DUR = 6.5, SLIDE = 0.55;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const theme = (c: string) => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c);

type Stage = { at: 'home'; error?: string } | { at: 'reading'; done: number; total: number; step?: string } | { at: 'story'; recap: Recap; note?: string };

export default function App() {
  const [stage, setStage] = useState<Stage>({ at: 'home' });
  const file = useRef<HTMLInputElement>(null);

  const run = useCallback(async (files: File[] | null) => {
    try {
      let photos, unreadable = 0;
      if (files) {
        setStage({ at: 'reading', done: 0, total: files.length });
        ({ photos, unreadable } = await readPhotos(files, (done, total) => setStage({ at: 'reading', done, total })));
      } else {
        photos = samplePhotos(YEAR); const total = photos.length;
        for (let k = 0; k <= 12; k++) { setStage({ at: 'reading', done: Math.round(total * k / 12), total }); await wait(60); }
      }
      const total = photos.length + unreadable;
      const recap = await buildRecap(photos, { placeName: files ? undefined : samplePlace, onStep: step => setStage({ at: 'reading', done: total, total, step }) });
      await Promise.all(['800 40px "RR Display"', '600 20px "RR Body"', '600 20px "RR Mono"'].map(f => document.fonts.load(f).catch(() => {})));
      const bits = [recap.otherYears ? `${recap.otherYears} from other years left out` : '', unreadable ? `${unreadable} couldn’t be read` : ''].filter(Boolean);
      setStage({ at: 'story', recap, note: bits.join(' · ') || undefined });
    } catch (e: any) {
      setStage({ at: 'home', error: e?.message === 'No photos could be read.' ? 'None of those could be read as photos. Try picking again.' : 'Something went wrong reading those. Try again with fewer photos.' });
    }
  }, []);

  useEffect(() => { if (stage.at !== 'story') theme('#141217'); }, [stage.at]);

  if (stage.at === 'story') return <Story recap={stage.recap} note={stage.note} onClose={() => { stopMusic(); restAudio(); setStage({ at: 'home' }); }} />;
  if (stage.at === 'reading') return <Reading done={stage.done} total={stage.total} step={stage.step} />;
  return (
    <main className="home">
      <div className="tag">ROLL RECAP</div>
      <Fan />
      <h1><span>Your</span><b>{YEAR}</b><span className="lime">in photos</span></h1>
      {stage.error && <p className="err">{stage.error}</p>}
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) run(f); }} />
      <button className="go" onClick={() => { unlockAudio(); haptic(10); file.current?.click(); }}>Pick photos</button>
      <button className="ghost" onClick={() => { unlockAudio(); haptic(10); run(null); }}>Try sample photos</button>
      <p className="fine">Pick a few hundred from this year. Your photos never leave this phone. To name your top place, one rounded map point (about a mile wide) is sent to OpenStreetMap.</p>
    </main>
  );
}

function Fan() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    (['forest', 'sunset', 'ocean'] as const).forEach((s, i) => { const c = refs.current[i]; if (!c) return; c.width = 300; c.height = 380; c.getContext('2d')!.drawImage(sceneCanvas(s, i + 3, 300, 380), 0, 0); });
  }, []);
  return <div className="fan" aria-hidden="true">{[0, 1, 2].map(i => <canvas key={i} ref={el => { refs.current[i] = el; }} className={`p${i}`} />)}</div>;
}

function Reading({ done, total, step }: { done: number; total: number; step?: string }) {
  return (
    <main className="reading">
      <div className="tag">ROLL RECAP</div>
      <div className="count">{done.toLocaleString('en-US')}</div>
      <div className="of">{step || `of ${total.toLocaleString('en-US')} photos read`}</div>
      <div className="track"><i style={{ transform: `scaleX(${total ? done / total : 0})` }} /></div>
      <p className="fine">All of this happens on your phone.</p>
    </main>
  );
}

type Sheet = { kind: 'image' | 'video'; blob: Blob; url: string; name: string } | { kind: 'recording' } | { kind: 'msg'; text: string };

function Story({ recap, note, onClose }: { recap: Recap; note?: string; onClose: () => void }) {
  const n = recap.cards.length, last = n - 1;
  const canvas = useRef<HTMLCanvasElement>(null), bars = useRef<(HTMLElement | null)[]>([]), recBox = useRef<HTMLDivElement>(null), recBar = useRef<HTMLElement>(null);
  const S = useRef({ i: 0, t: 0, prev: -1, prevT: 0, tr: 1, dir: 1, held: false, last: 0 });
  const [idx, setIdx] = useState(0), [muted, setMute] = useState(false), [sheet, setSheet] = useState<Sheet | null>(null), [toast, setToast] = useState(note || ''), [busy, setBusy] = useState(false);
  const sheetRef = useRef<Sheet | null>(null); sheetRef.current = sheet;
  const mosaicBlob = useRef<Blob | null>(null), recorder = useRef<ReturnType<typeof recordStory> | null>(null);
  const card = recap.cards[idx], light = lightCard(card);

  const go = useCallback((dir: number) => {
    const s = S.current, to = s.i + dir; if (to < 0 || to >= n) { if (to < 0) s.t = 0; return; }
    s.prev = s.i; s.prevT = s.t; s.i = to; s.t = 0; s.tr = 0; s.dir = dir; setIdx(to); haptic(8);
  }, [n]);

  // the drawing loop
  useEffect(() => {
    const cv = canvas.current!, g = cv.getContext('2d')!; let raf = 0;
    const size = () => { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(window.innerWidth * d); cv.height = Math.round(window.innerHeight * d); };
    size(); window.addEventListener('resize', size);
    const frame = (now: number) => {
      const s = S.current, dt = Math.min(0.05, (now - (s.last || now)) / 1000); s.last = now;
      const stopped = s.held || !!sheetRef.current || document.hidden;
      if (!stopped) { s.t += dt; if (s.t > DUR && s.i < last && s.tr >= 1) go(1); }
      if (s.tr < 1) s.tr = Math.min(1, s.tr + dt / SLIDE);
      const W = cv.width, H = cv.height, cur = recap.cards[s.i], o = { bar: s.i === last, hint: s.i === 0 };
      if (s.tr < 1 && s.prev >= 0) {
        const x = s.tr * 1.25, p = Math.min(1, 1 - (1 + 7 * x) * Math.exp(-7 * x) + s.tr * 0.002);
        g.save(); g.translate(-s.dir * W * 0.28 * p, 0); drawCard(g, W, H, recap, recap.cards[s.prev], s.prevT, { bar: s.prev === last, hint: s.prev === 0 }); g.restore();
        g.fillStyle = `rgba(0,0,0,${0.5 * p})`; g.fillRect(0, 0, W, H);
        g.save(); g.translate(s.dir * W * (1 - p), 0); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 60; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.shadowColor = 'transparent'; drawCard(g, W, H, recap, cur, s.t, o); g.restore();
      } else drawCard(g, W, H, recap, cur, s.t, o);
      bars.current.forEach((b, j) => { if (b) b.style.transform = `scaleX(${j < s.i ? 1 : j > s.i ? 0 : s.i === last ? 1 : Math.min(1, s.t / DUR)})`; });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [recap, go, last]);

  // music: start with the story, rest when the phone is put away
  useEffect(() => {
    startMusic();
    const vis = () => { const c = audioCtx(); if (!c) return; if (document.hidden) c.suspend().catch(() => {}); else c.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); recorder.current?.cancel(); };
  }, []);
  useEffect(() => { duck(!!sheet && sheet.kind !== 'recording'); }, [sheet]);
  useEffect(() => { theme(cardBg(card)); }, [card]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  // have the mosaic picture ready so Share can open straight from the tap
  useEffect(() => { if (idx === last && !mosaicBlob.current) { const t = setTimeout(() => cardImage(recap, recap.cards[last]).then(b => { mosaicBlob.current = b; }), 1600); return () => clearTimeout(t); } }, [idx, last, recap]);

  // tap left or right, hold to pause
  const press = useRef({ at: 0, x: 0, timer: 0 });
  const down = (e: React.PointerEvent) => {
    unlockAudio(); press.current.at = performance.now(); press.current.x = e.clientX;
    press.current.timer = window.setTimeout(() => { S.current.held = true; duck(true); }, 220);
  };
  const up = (e: React.PointerEvent) => {
    clearTimeout(press.current.timer); const s = S.current;
    if (s.held) { s.held = false; duck(false); return; }
    if (performance.now() - press.current.at > 600) return;
    go(e.clientX < window.innerWidth * 0.3 ? -1 : 1);
  };
  const cancel = () => { clearTimeout(press.current.timer); if (S.current.held) { S.current.held = false; duck(false); } };

  const closeSheet = () => { setSheet(s => { if (s && 'url' in s) URL.revokeObjectURL(s.url); return null; }); };
  const show = (kind: 'image' | 'video', blob: Blob, name: string) => setSheet({ kind, blob, name, url: URL.createObjectURL(blob) });
  const picName = (i: number) => `roll-recap-${recap.year}-${recap.cards[i].kind}.jpg`;

  async function sharePic(i: number, ready?: Blob | null) {
    haptic(10); setBusy(true);
    const blob = ready || await cardImage(recap, recap.cards[i]); setBusy(false);
    if (!blob) { setSheet({ kind: 'msg', text: 'That picture couldn’t be made. Try again.' }); return; }
    const r = await shareFile(blob, picName(i), `My ${recap.year} in photos`);
    if (r === 'blocked' || r === 'unsupported') show('image', blob, picName(i));
  }
  async function savePic() {
    haptic(10); const blob = mosaicBlob.current || await cardImage(recap, recap.cards[last]); if (!blob) return;
    if (isIOS()) show('image', blob, picName(last)); else { download(blob, picName(last)); setToast('Saved to your downloads'); }
  }
  async function makeVideo() {
    haptic(10); unlockAudio(); startMusic();
    if (!videoSupported()) { setSheet({ kind: 'msg', text: 'This browser can’t record video. You can still share any card as a picture.' }); return; }
    setSheet({ kind: 'recording' }); await wait(50);
    const r = recordStory(recap, musicStream(), p => { if (recBar.current) recBar.current.style.transform = `scaleX(${p})`; });
    recorder.current = r; recBox.current?.appendChild(r.canvas);
    const blob = await r.done; recorder.current = null;
    if (!blob) { if (sheetRef.current?.kind === 'recording') setSheet({ kind: 'msg', text: 'The video didn’t record on this phone. You can still share any card as a picture.' }); return; }
    haptic([12, 60, 12]); show('video', blob, `roll-recap-${recap.year}.${videoExt(blob)}`);
  }
  const stopVideo = () => { recorder.current?.cancel(); recorder.current = null; setSheet(null); };

  return (
    <main className={`story ${light ? 'on-light' : 'on-dark'}`}>
      <canvas ref={canvas} className="stage" onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={e => e.preventDefault()} />
      <div className="top">
        <div className="bars">{recap.cards.map((_, j) => <span key={j}><i ref={el => { bars.current[j] = el; }} /></span>)}</div>
        <div className="row">
          <button aria-label="Close" onClick={onClose}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          <span className="grow" />
          <button aria-label={muted ? 'Turn music on' : 'Turn music off'} onClick={() => { unlockAudio(); startMusic(); setMuted(!muted); setMute(!muted); }}>
            {muted ? <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6" /></svg> : <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /></svg>}
          </button>
          {idx !== last && <button aria-label="Share this card" disabled={busy} onClick={() => sharePic(idx)}><svg viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg></button>}
        </div>
      </div>
      {idx === last && (
        <div className="dock">
          <button onClick={savePic}>Save</button>
          <button className="main" onClick={() => sharePic(last, mosaicBlob.current)}>Share</button>
          <button onClick={makeVideo}>Video</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {sheet && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget && sheet.kind !== 'recording') closeSheet(); }}>
          <div className="sheet">
            {sheet.kind === 'recording' && <>
              <h2>Making your video</h2>
              <div className="rec" ref={recBox} />
              <div className="track"><i ref={recBar} /></div>
              <p>It records as it plays, about {Math.round((n - 1) * 3.3 + 4.6)} seconds. Keep this screen open.</p>
              <button onClick={stopVideo}>Cancel</button>
            </>}
            {sheet.kind === 'msg' && <><h2>Heads up</h2><p>{sheet.text}</p><button className="main" onClick={closeSheet}>OK</button></>}
            {(sheet.kind === 'image' || sheet.kind === 'video') && <>
              <h2>{sheet.kind === 'video' ? 'Video ready' : 'Your card'}</h2>
              {sheet.kind === 'image' ? <img src={sheet.url} alt="Your recap card" /> : <video src={sheet.url} controls playsInline loop />}
              {sheet.kind === 'image' && isIOS() && <p>Press and hold the picture to save it to Photos.</p>}
              <div className="pair">
                <button className="main" onClick={async () => { const r = await shareFile(sheet.blob, sheet.name, `My ${recap.year} in photos`); if (r === 'unsupported' || r === 'blocked') { download(sheet.blob, sheet.name); setToast('Saved to your downloads'); } }}>Share</button>
                <button onClick={() => { download(sheet.blob, sheet.name); setToast('Saved'); }}>Save</button>
              </div>
              <button className="plain" onClick={closeSheet}>Done</button>
            </>}
          </div>
        </div>
      )}
    </main>
  );
}
