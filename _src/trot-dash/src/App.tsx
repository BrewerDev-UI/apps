import { useCallback, useEffect, useRef, useState } from 'react';
import * as audio from './audio';
import { World, type Cam, type Tier } from './world';
import {
  Sim, ghostAt, fmtClock, ordinal,
  BASE_V, COURSE_M, MILE_M, CLOCK_X, HALF_W, FIELD,
  type Ghost, type Weather, type Input,
} from './sim';
import { localWeather } from './weather';
import { composeCard, toBlob, shareBlob, LIVE_URL } from './selfie';

type Screen = 'home' | 'count' | 'race' | 'finish' | 'selfie';
type Mode = 'solo' | 'ghost' | 'pass';

interface BoardRow { bib: number; time: number; place: number }
interface Save {
  best: Ghost | null;
  board: BoardRow[];
  nextBib: number;
  myBib: number;
  muted: boolean;
  tier: number; // -1 = auto
}
interface Result {
  clock: number;
  place: number;
  splits: number[];
  bib: number;
  newBest: boolean;
  delta: number | null; // clock seconds against the old best
  mode: Mode;
}

const KEY = 'trot-dash.v1';
const WX: Weather[] = ['clear', 'rain', 'frost'];
const WX_NAME: Record<Weather, string> = { clear: 'Clear', rain: 'Rain', frost: 'Frost' };
const TIER_NAME = ['Low', 'Med', 'High'];

function loadSave(): Save {
  const base: Save = { best: null, board: [], nextBib: 101, myBib: 100 + Math.floor(Math.random() * 900), muted: false, tier: -1 };
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && typeof j === 'object') return { ...base, ...j };
  } catch { /* first run */ }
  try { localStorage.setItem(KEY, JSON.stringify(base)); } catch { /* private mode */ }
  return base;
}

const autoTier = (): Tier =>
  (window.devicePixelRatio || 1) >= 2 && (navigator.hardwareConcurrency || 4) >= 6 ? 2 : 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* iPhone */ } };

function homeSim(w: Weather): Sim {
  const s = new Sim(w);
  s.obstacles = [];
  s.d = 400; // past the start arch
  return s;
}

function Medal({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.35} viewBox="0 0 100 135" aria-hidden>
      <defs>
        <radialGradient id="mg" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFF2B8" />
          <stop offset=".45" stopColor="#F5B93A" />
          <stop offset="1" stopColor="#B36A12" />
        </radialGradient>
      </defs>
      <polygon points="18,0 40,0 56,52 42,58" fill="#2D5BFF" />
      <polygon points="82,0 60,0 44,52 58,58" fill="#FF74B0" />
      <circle cx="50" cy="88" r="42" fill="url(#mg)" stroke="#8a4c08" strokeWidth="2" />
      <circle cx="50" cy="88" r="33" fill="none" stroke="rgba(120,60,0,.5)" strokeWidth="2.5" />
      <text x="50" y="97" textAnchor="middle" fontFamily="Shrikhand, serif" fontSize="32" fill="#7A3D06">5K</text>
    </svg>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('solo');
  const [count, setCount] = useState(3);
  const [weather, setWeather] = useState<Weather>('clear');
  const [wxLabel, setWxLabel] = useState('');
  const [wxNote, setWxNote] = useState('');
  const [wxBusy, setWxBusy] = useState(false);
  const [tier, setTier] = useState<Tier>(() => (save.tier >= 0 ? (save.tier as Tier) : autoTier()));
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [pies, setPies] = useState(0);
  const [sprinting, setSprinting] = useState(false);
  const [card, setCard] = useState<{ blob: Blob; url: string; photo: boolean } | null>(null);
  const [camState, setCamState] = useState<'off' | 'live' | 'shot' | 'error'>('off');
  const [note, setNote] = useState('');
  const [clearArm, setClearArm] = useState(false);

  const distRef = useRef<HTMLSpanElement>(null);
  const paceRef = useRef<HTMLSpanElement>(null);
  const placeRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ghostDotRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);

  const G = useRef({
    world: null as World | null,
    sim: homeSim('clear'),
    screen: 'home' as Screen,
    mode: 'solo' as Mode,
    ghost: null as Ghost | null,
    weather: 'clear' as Weather,
    tier: 1 as Tier,
    paused: false,
    steer: 0, tiltRaw: 0, tiltOn: false, key: 0,
    dragX: null as number | null,
    hop: false, sprint: false,
    bib: 0, token: 0,
    fpsT: 0, fpsN: 0, hudT: 0, raceT: 0,
    lastPies: 0, lastSprint: false,
    toastId: 0, toastTimer: 0,
    wake: null as { release: () => Promise<void> } | null,
    stream: null as MediaStream | null,
    ptr: null as null | { id: number; x0: number; y0: number; t0: number; sx: number; moved: boolean; swiped: boolean },
  }).current;

  const update = useCallback((patch: Partial<Save>) => {
    setSave((s) => {
      const n = { ...s, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ }
      return n;
    });
  }, []);

  const go = useCallback((s: Screen) => { G.screen = s; setScreen(s); }, [G]);

  const say = useCallback((text: string, ms = 1500) => {
    const id = ++G.toastId;
    setToast({ id, text });
    window.clearTimeout(G.toastTimer);
    G.toastTimer = window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), ms);
  }, [G]);

  const wakeOn = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && !G.wake) G.wake = await wl.request('screen');
    } catch { /* not allowed */ }
  }, [G]);
  const wakeOff = useCallback(() => {
    try { void G.wake?.release(); } catch { /* fine */ }
    G.wake = null;
  }, [G]);

  const makeCard = useCallback(async (r: Result, photo: HTMLVideoElement | null) => {
    const w = G.world;
    const cv = await composeCard({
      bg: (c, W, H) => {
        if (photo && photo.videoWidth) {
          const s = Math.max(W / photo.videoWidth, H / photo.videoHeight);
          const dw = photo.videoWidth * s, dh = photo.videoHeight * s;
          c.save();
          c.translate(W, 0);
          c.scale(-1, 1);
          c.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
          c.restore();
        } else if (w) w.snapshot(c, 0, 0, W, H);
      },
      time: fmtClock(r.clock),
      place: `${ordinal(r.place)} of ${FIELD}`,
      splits: r.splits.slice(0, 3).map((s, i) => `Mile ${i + 1}  ${fmtClock(s)}`).join('   ·   '),
      bib: r.bib,
      weather: wxLabelRef.current || WX_NAME[G.weather],
    });
    const blob = await toBlob(cv);
    if (!blob) return;
    setCard((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { blob, url: URL.createObjectURL(blob), photo: !!photo };
    });
  }, [G]);
  const wxLabelRef = useRef('');
  wxLabelRef.current = wxLabel;

  const finishRace = useCallback(() => {
    const sim = G.sim;
    const s = saveRef.current;
    const time = sim.t;
    const clock = time * CLOCK_X;
    let newBest = false;
    let delta: number | null = null;
    if (G.mode !== 'pass') {
      if (s.best) delta = (time - s.best.time) * CLOCK_X;
      if (!s.best || time < s.best.time) {
        newBest = true;
        update({ best: { time, place: sim.place, samples: sim.rec.slice() } });
      }
    } else {
      const board = [...s.board, { bib: G.bib, time: clock, place: sim.place }]
        .sort((a, b) => a.time - b.time).slice(0, 12);
      update({ board, nextBib: s.nextBib + 1 });
    }
    const r: Result = { clock, place: sim.place, splits: sim.splits.slice(), bib: G.bib, newBest, delta, mode: G.mode };
    setResult(r);
    setCard(null);
    setNote('');
    setClearArm(false);
    go('finish');
    audio.fanfare();
    audio.cheer(3);
    buzz([60, 40, 120]);
    wakeOff();
    window.setTimeout(() => { if (G.screen === 'finish') void makeCard(r, null); }, 1100);
  }, [G, go, makeCard, update, wakeOff]);
  const finishRef = useRef(finishRace);
  finishRef.current = finishRace;
  const sayRef = useRef(say);
  sayRef.current = say;

  // One loop for the whole app.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const world = new World(canvas);
    G.world = world;
    G.tier = tier;
    world.configure(G.tier, G.weather);
    world.setBib(saveRef.current.myBib);
    world.reset();
    world.resize();
    (window as unknown as { __trot?: unknown }).__trot = G;

    const onResize = () => world.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      G.tiltOn = true;
      const g = e.gamma;
      const a = Math.abs(g) < 2 ? 0 : (g - Math.sign(g) * 2) / 18;
      G.tiltRaw = clamp(a, -1, 1);
    };
    window.addEventListener('deviceorientation', onTilt);

    const keys = new Set<string>();
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      if (down) keys.add(e.key); else keys.delete(e.key);
      G.key = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      if (G.key) G.dragX = null;
      if (down && !e.repeat && G.screen === 'race') {
        if (e.key === ' ') G.hop = true;
        if (e.key === 'ArrowUp' || e.key === 'Shift') G.sprint = true;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    const onVis = () => {
      if (document.hidden && (G.screen === 'race' || G.screen === 'count')) {
        if (G.screen === 'count') return;
        G.paused = true;
        setPaused(true);
        audio.pause(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const raw = (now - last) / 1000;
      last = now;
      if (G.paused) return;
      const dt = Math.min(0.05, raw);
      let sim = G.sim;
      const scr = G.screen;

      G.steer += ((G.key || (G.tiltOn ? G.tiltRaw : 0)) - G.steer) * Math.min(1, dt * 10);

      if (scr === 'race' || scr === 'finish' || scr === 'selfie') {
        const inp: Input = scr === 'race'
          ? { steer: G.steer, dragX: G.key ? null : G.dragX, hop: G.hop, sprint: G.sprint }
          : { steer: 0, dragX: null, hop: false, sprint: false };
        G.hop = false; G.sprint = false;
        sim.step(dt, inp);
        for (const ev of sim.events) {
          switch (ev.k) {
            case 'hop': audio.gobble(); buzz(10); break;
            case 'pie': audio.ding(); buzz(15); break;
            case 'sprintReady': sayRef.current('Swipe up to sprint!', 2200); break;
            case 'sprint': audio.rip(); buzz([30, 30, 60]); sayRef.current('Sprint!'); break;
            case 'bump': buzz(25); sayRef.current('Go around!', 1000); break;
            case 'stumble':
              audio.thud(ev.what === 'puddle');
              world.burst(ev.d, ev.x, ev.what);
              buzz(70);
              sayRef.current(ev.what === 'puddle' ? 'Splash!' : 'Leaf pile!', 1100);
              break;
            case 'mile': audio.cheer(); sayRef.current(`Mile ${ev.n} · ${fmtClock(ev.split)}`, 2200); break;
            case 'finish': finishRef.current(); break;
          }
        }
        sim.events.length = 0;
        audio.setDrive(scr === 'race' ? sim.v / BASE_V : 0.25, scr === 'race');
        if (sim.pies !== G.lastPies) { G.lastPies = sim.pies; setPies(sim.pies); }
        const sp = sim.sprintT > 0;
        if (sp !== G.lastSprint) { G.lastSprint = sp; setSprinting(sp); }

        // Step the detail down if the phone can't hold a smooth frame rate.
        if (scr === 'race') {
          G.raceT += raw;
          if (G.raceT > 3 && saveRef.current.tier < 0 && G.tier > 0) {
            G.fpsT += raw; G.fpsN++;
            if (G.fpsT >= 2.5) {
              if (G.fpsN / G.fpsT < 50) {
                G.tier = (G.tier - 1) as Tier;
                world.configure(G.tier, G.weather);
                world.resize();
                setTier(G.tier);
                sayRef.current('Detail lowered to stay smooth', 1800);
                G.raceT = 0;
              }
              G.fpsT = 0; G.fpsN = 0;
            }
          }
        }
      } else if (scr === 'home') {
        sim.step(dt, { steer: 0, dragX: null, hop: false, sprint: false });
        sim.events.length = 0;
        if (sim.d > COURSE_M - 600) { G.sim = sim = homeSim(G.weather); world.reset(); }
      }

      const cam: Cam = scr === 'home' ? 'front' : scr === 'finish' || scr === 'selfie' ? 'side' : 'chase';
      world.frame(sim, dt, cam, scr === 'race' || scr === 'count' ? G.ghost : null);

      G.hudT -= raw;
      if (G.hudT <= 0 && (scr === 'race' || scr === 'count')) {
        G.hudT = 0.1;
        const d = Math.min(COURSE_M, sim.d);
        if (distRef.current) distRef.current.textContent = (d / MILE_M).toFixed(2);
        if (paceRef.current) paceRef.current.textContent = sim.v > 4 ? fmtClock((MILE_M / sim.v) * CLOCK_X) : '--:--';
        if (placeRef.current) placeRef.current.textContent = ordinal(sim.place);
        if (clockRef.current) clockRef.current.textContent = fmtClock(sim.t * CLOCK_X);
        if (barRef.current) barRef.current.style.transform = `scaleX(${d / COURSE_M})`;
        if (G.ghost) {
          const gd = ghostAt(G.ghost, sim.t).d;
          if (ghostDotRef.current) ghostDotRef.current.style.left = `${(Math.min(COURSE_M, gd) / COURSE_M) * 100}%`;
          if (gapRef.current) {
            const gap = Math.round(sim.d - gd);
            gapRef.current.textContent = gap >= 0 ? `Ghost ${gap} m back` : `Ghost ${-gap} m ahead`;
            gapRef.current.dataset.ahead = gap >= 0 ? '1' : '0';
          }
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      document.removeEventListener('visibilitychange', onVis);
      audio.stopMusic();
      world.dispose();
      G.world = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRace = async (m: Mode) => {
    audio.unlock();
    audio.setMuted(saveRef.current.muted);
    try {
      const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') await D.requestPermission();
    } catch { /* drag still works */ }
    const s = saveRef.current;
    const bib = m === 'pass' ? s.nextBib : s.myBib;
    const tok = ++G.token;
    G.sim = new Sim(G.weather);
    G.mode = m;
    G.ghost = m === 'ghost' ? s.best : null;
    G.bib = bib;
    G.dragX = null; G.steer = 0; G.hop = false; G.sprint = false;
    G.raceT = 0; G.fpsT = 0; G.fpsN = 0; G.hudT = 0;
    G.lastPies = 0; G.lastSprint = false;
    G.world?.setBib(bib);
    G.world?.reset();
    setMode(m); setResult(null); setPies(0); setSprinting(false); setToast(null);
    audio.stopMusic();
    audio.setDrive(0, false);
    go('count');
    void wakeOn();
    for (const n of [3, 2, 1]) {
      setCount(n);
      audio.tick(false);
      await sleep(760);
      if (G.token !== tok) return;
    }
    audio.tick(true);
    audio.startMusic();
    buzz(40);
    go('race');
    say(G.tiltOn ? 'Go! Tilt to steer' : 'Go! Drag to steer', 1800);
  };

  const goHome = () => {
    G.token++;
    stopCam();
    audio.stopMusic();
    G.paused = false; setPaused(false);
    audio.pause(false);
    G.sim = homeSim(G.weather);
    G.ghost = null;
    G.world?.setBib(saveRef.current.myBib);
    G.world?.reset();
    wakeOff();
    setToast(null);
    go('home');
  };

  const resume = () => {
    G.paused = false;
    setPaused(false);
    audio.pause(false);
    void wakeOn();
  };
  const pauseNow = () => {
    G.paused = true;
    setPaused(true);
    audio.pause(true);
  };

  const applyWeather = (w: Weather, label: string) => {
    G.weather = w;
    setWeather(w);
    setWxLabel(label);
    G.world?.configure(G.tier, w);
    G.world?.setBib(saveRef.current.myBib);
    G.world?.resize();
    if (G.screen === 'home') { G.sim = homeSim(w); G.world?.reset(); }
  };
  const cycleWeather = () => {
    setWxNote('');
    applyWeather(WX[(WX.indexOf(weather) + 1) % 3], '');
  };
  const useLocal = async () => {
    if (wxBusy) return;
    setWxBusy(true);
    setWxNote('');
    try {
      const w = await localWeather();
      applyWeather(w.kind, w.label);
    } catch (e) {
      setWxNote(e instanceof Error ? e.message : 'Weather failed.');
    }
    setWxBusy(false);
  };
  const cycleTier = () => {
    const next = save.tier >= 2 ? -1 : save.tier + 1;
    update({ tier: next });
    const t = next < 0 ? autoTier() : (next as Tier);
    G.tier = t;
    setTier(t);
    G.world?.configure(t, G.weather);
    G.world?.setBib(saveRef.current.myBib);
    G.world?.resize();
    G.world?.reset();
  };
  const toggleMute = () => {
    const m = !save.muted;
    update({ muted: m });
    audio.unlock();
    audio.setMuted(m);
  };

  // Touch: drag to steer, tap to hop, swipe up to sprint.
  const onDown = (e: React.PointerEvent) => {
    if (G.screen !== 'race') return;
    G.ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), sx: G.sim.x, moved: false, swiped: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = G.ptr;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
    if (!p.swiped && dy < -55 && -dy > Math.abs(dx) * 1.3) {
      p.swiped = true;
      G.sprint = true;
      if (G.sim.pies < 3) say('Collect 3 pie slices first', 1200);
      return;
    }
    if (!p.swiped && Math.abs(dx) > 10) {
      p.moved = true;
      G.dragX = clamp(p.sx + dx * ((2 * HALF_W) / window.innerWidth) * 1.25, -HALF_W, HALF_W);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const p = G.ptr;
    if (!p || p.id !== e.pointerId) return;
    G.ptr = null;
    if (!p.moved && !p.swiped && performance.now() - p.t0 < 400) G.hop = true;
    if (G.tiltOn) G.dragX = null;
  };

  // Selfie
  const stopCam = () => {
    G.stream?.getTracks().forEach((t) => t.stop());
    G.stream = null;
    setCamState('off');
  };
  const openCam = async () => {
    go('selfie');
    setCamState('off');
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
      G.stream = st;
      const v = videoRef.current;
      if (v) { v.srcObject = st; await v.play().catch(() => {}); }
      setCamState('live');
    } catch {
      setCamState('error');
    }
  };
  const snap = async () => {
    if (!result || !videoRef.current) return;
    buzz(20);
    audio.tick(true);
    await makeCard(result, videoRef.current);
    G.stream?.getTracks().forEach((t) => t.stop());
    G.stream = null;
    setCamState('shot');
  };
  const closeSelfie = () => { stopCam(); go('finish'); };
  const share = async () => {
    if (!card || !result) { setNote('Card is still being made. Try again in a second.'); return; }
    const text = `I ran the Trot Dash 5K in ${fmtClock(result.clock)}, ${ordinal(result.place)} of ${FIELD}. Beat my turkey: ${LIVE_URL}`;
    const r = await shareBlob(card.blob, text);
    setNote(r === 'saved' ? 'Sharing is not available here, so the picture was saved.' : '');
  };

  const best = save.best;
  const verdict = best
    ? `Best ${fmtClock(best.time * CLOCK_X)}, ${ordinal(best.place)} of ${FIELD}. Beat it?`
    : 'Sunrise 5K. About 3 minutes.';
  const racing = screen === 'race' || screen === 'count';

  return (
    <div className="app">
      <canvas ref={canvasRef} className="gl" />

      {racing && (
        <div className="touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      )}

      {screen === 'home' && (
        <div className="ui home">
          <header className="hero">
            <h1>Trot Dash</h1>
            <p className="verdict">{verdict}</p>
          </header>
          <div className="spacer" />
          <div className="panel">
            <button className="btn primary" onClick={() => void startRace('solo')}>Run the 5K</button>
            <div className="row">
              <button className="btn" disabled={!best} onClick={() => void startRace('ghost')}>
                {best ? 'Race your ghost' : 'Ghost: run once first'}
              </button>
              <button className="btn" onClick={() => void startRace('pass')}>Pass the phone</button>
            </div>
            <p className="how">Tilt to steer · tap to hop · 3 pies, then swipe up to sprint</p>
            <div className="chips">
              <button className="chip" onClick={cycleWeather}>{wxLabel || WX_NAME[weather]}</button>
              <button className="chip" onClick={() => void useLocal()}>{wxBusy ? 'Checking…' : 'Use local weather'}</button>
              <button className="chip" onClick={cycleTier}>Detail: {save.tier < 0 ? `Auto (${TIER_NAME[tier]})` : TIER_NAME[tier]}</button>
              <button className="chip" onClick={toggleMute}>{save.muted ? 'Sound off' : 'Sound on'}</button>
            </div>
            {wxNote && <p className="warn">{wxNote} Pick the weather by hand.</p>}
            <p className="fine">
              The clock runs 8x, so 3 minutes reads like a real 5K time. Local weather sends a rough location (about 7 miles)
              to Open-Meteo and saves nothing. No tilt? Drag a finger. iPhones don't buzz in web apps.
            </p>
          </div>
        </div>
      )}

      {racing && (
        <div className="ui hud">
          <div className="tiles">
            <div className="tile"><label>DIST</label><b><span ref={distRef}>0.00</span><i> mi</i></b></div>
            <div className="tile"><label>PACE</label><b><span ref={paceRef}>--:--</span><i> /mi</i></b></div>
            <div className="tile place"><label>PLACE</label><b><span ref={placeRef}>{ordinal(FIELD)}</span><i> /{FIELD}</i></b></div>
          </div>
          <div className="track">
            <div className="fill" ref={barRef} />
            {[1, 2, 3].map((n) => <span key={n} className="tick" style={{ left: `${((n * MILE_M) / COURSE_M) * 100}%` }} />)}
            {mode === 'ghost' && <div className="gdot" ref={ghostDotRef} />}
          </div>
          <div className="clockrow">
            <div className="clock" ref={clockRef}>0:00</div>
            {mode === 'ghost' && <div className="gap" ref={gapRef}>Ghost</div>}
            {mode === 'pass' && <div className="gap" data-ahead="1">Bib {save.nextBib}</div>}
          </div>
          <div className="spacer" />
          {toast && <div className="toast" key={toast.id}>{toast.text}</div>}
          {screen === 'count' && <div className="count" key={count}>{count}</div>}
          <div className="bottom">
            <div className={`pies${pies >= 3 ? ' full' : ''}${sprinting ? ' go' : ''}`}>
              {[0, 1, 2].map((i) => <span key={i} className={`pie${i < pies || sprinting ? ' on' : ''}`} />)}
              <em>{sprinting ? 'Sprinting!' : pies >= 3 ? 'Swipe up!' : 'Pie'}</em>
            </div>
            <button className="pausebtn" aria-label="Pause" onClick={pauseNow}>II</button>
          </div>
        </div>
      )}

      {paused && (
        <div className="ui over">
          <div className="panel center">
            <h2>Paused</h2>
            <button className="btn primary" onClick={resume}>Keep running</button>
            <button className="btn" onClick={goHome}>Quit race</button>
          </div>
        </div>
      )}

      {screen === 'finish' && result && (
        <div className="ui finish">
          <div className="spacer" />
          <div className="panel sheet">
            <div className="fin-top">
              <Medal />
              <div>
                <div className="fin-label">
                  {result.mode === 'pass' ? `Bib ${result.bib} finished` : 'Finished!'}
                  {result.newBest && <span className="badge">New best</span>}
                </div>
                <div className="fin-time">{fmtClock(result.clock)}</div>
                <div className="fin-place">{ordinal(result.place)} <i>of {FIELD}</i></div>
              </div>
            </div>
            {result.delta !== null && !result.newBest && (
              <p className="delta">{fmtClock(Math.abs(result.delta))} behind your best</p>
            )}
            {result.delta !== null && result.newBest && (
              <p className="delta good">{fmtClock(Math.abs(result.delta))} faster than your old best</p>
            )}
            <div className="splits">
              {result.splits.map((s, i) => (
                <div key={i}><label>{i < 3 ? `Mile ${i + 1}` : 'Last 0.11'}</label><b>{fmtClock(s)}</b></div>
              ))}
            </div>
            {result.mode === 'pass' && (
              <div className="board">
                {save.board.map((r, i) => (
                  <div key={`${r.bib}-${i}`} className={r.bib === result.bib ? 'me' : ''}>
                    <span>{i + 1}</span><span>Bib {r.bib}</span><span>{ordinal(r.place)}</span><b>{fmtClock(r.time)}</b>
                  </div>
                ))}
              </div>
            )}
            {result.mode === 'pass'
              ? <button className="btn primary" onClick={() => void startRace('pass')}>Pass to next runner</button>
              : <button className="btn primary" onClick={() => void startRace(result.mode)}>Run again</button>}
            <div className="row">
              <button className="btn" onClick={() => void openCam()}>Medal selfie</button>
              <button className="btn" onClick={() => void share()}>Share result</button>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={goHome}>Home</button>
              {result.mode === 'pass' && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    if (!clearArm) { setClearArm(true); return; }
                    update({ board: [], nextBib: 101 });
                    setClearArm(false);
                  }}
                >{clearArm ? 'Tap again to clear' : 'Clear board'}</button>
              )}
            </div>
            {note && <p className="warn">{note}</p>}
          </div>
        </div>
      )}

      {screen === 'selfie' && result && (
        <div className="ui selfie">
          <div className="frame">
            <video ref={videoRef} playsInline muted style={{ display: camState === 'live' ? 'block' : 'none' }} />
            {camState === 'live' && (
              <div className="overlay">
                <div className="ov-medal"><Medal size={64} /></div>
                <div className="ov-bib"><small>TURKEY TROT</small>{result.bib}</div>
                <div className="ov-time">{fmtClock(result.clock)}</div>
              </div>
            )}
            {camState === 'shot' && card && <img src={card.url} alt="Your finish card" />}
            {camState === 'off' && <p className="cam-msg">Starting the camera…</p>}
            {camState === 'error' && (
              <>
                {card && <img src={card.url} alt="Your finish card" />}
                <p className="cam-msg err">No camera, so here is your race card instead.</p>
              </>
            )}
          </div>
          <div className="panel">
            {camState === 'live' && <button className="btn primary" onClick={() => void snap()}>Take the photo</button>}
            {(camState === 'shot' || camState === 'error') && (
              <button className="btn primary" onClick={() => void share()}>Share</button>
            )}
            <div className="row">
              {camState === 'shot' && <button className="btn" onClick={() => void openCam()}>Retake</button>}
              <button className="btn ghost" onClick={closeSelfie}>Back</button>
            </div>
            {note && <p className="warn">{note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
