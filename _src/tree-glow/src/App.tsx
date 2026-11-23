import { useEffect, useRef, useState } from 'react';
import { Glow, CAP, type Fx } from './effects';
import { buildOn, computeShow, MODES, type Mode, type On } from './showEngine';
import { CAROLS, STYLES, beatPos, ensureAudio, isRunning, recordTrack, startShow, stopShow, type Style } from './audio';
import { bulbsFor, drawPhoto } from './scene';
import { scanFrame } from './lightFinder';
import { startRecording, type Rec } from './record';

type Light = { u: number; v: number; on: boolean };
type Frame = { src: CanvasImageSource; w: number; h: number };
type Clip = { url: string; blob: Blob; ext: string; name: string };
type Screen = 'show' | 'lights';
type WakeLockLike = { release: () => Promise<void> };

const SW = 480; // sample frame size (portrait)
const SH = 640;
const SAMPLE = drawPhoto(1, SW, SH, []);
const CUT: HTMLCanvasElement[] = [drawPhoto(0, SW, SH, []), drawPhoto(1, SW, SH, []), drawPhoto(2, SW, SH, [])];
const SAMPLE_LIGHTS: Light[] = bulbsFor(142, 7).map((b) => ({ u: b.x, v: b.y, on: true }));
const FX_LIST: { k: keyof Fx; label: string }[] = [
  { k: 'frost', label: 'Frost edges' },
  { k: 'bokeh', label: 'Glass bokeh' },
  { k: 'shock', label: 'Shockwave on the drop' },
  { k: 'snow', label: 'Snowfall' },
];

// Tilt target is read by the animation loop; set by the device-motion listener.
let tiltTarget = { x: 0, y: 0 };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// Fits a source of size sw x sh over a cw x ch area, cropping the overflow.
function cover(sw: number, sh: number, cw: number, ch: number) {
  const s = Math.max(cw / sw, ch / sh);
  return { s, ox: (cw - sw * s) / 2, oy: (ch - sh * s) / 2 };
}

// Mutable state read by the animation loop. Kept in a ref so the loop never waits on React.
type Live = {
  stage: HTMLCanvasElement | null;
  sctx: CanvasRenderingContext2D | null;
  gl: HTMLCanvasElement | null;
  glow: Glow | null;
  recCanvas: HTMLCanvasElement | null;
  recorder: Rec | null;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  cw: number;
  ch: number;
  dpr: number;
  mode: Mode;
  fx: Fx;
  cut: boolean;
  frames: Frame[] | null;
  source: 'sample' | 'camera';
  onList: On[];
  tilt: { x: number; y: number };
  shockAge: number;
  phrase: number;
  quarter: number;
  flash: number;
  last: number;
  wake: WakeLockLike | null;
  xy: Float32Array;
  bright: Float32Array;
  col: Float32Array;
};

function sizeAll(s: Live) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  s.cw = cw;
  s.ch = ch;
  s.dpr = dpr;
  if (s.stage) {
    s.stage.width = Math.round(cw * dpr);
    s.stage.height = Math.round(ch * dpr);
  }
  s.glow?.resize(cw, ch);
}

function draw(s: Live, now: number) {
  const sctx = s.sctx;
  if (!sctx || !s.stage) return;
  const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
  s.last = now;
  const t = now / 1000;
  const { cw, ch, dpr } = s;

  s.tilt.x += (tiltTarget.x - s.tilt.x) * 0.08;
  s.tilt.y += (tiltTarget.y - s.tilt.y) * 0.08;

  const running = isRunning();
  const beat = running ? Math.max(0, beatPos()) : 0;
  if (running) {
    const ph = Math.floor(beat / 16);
    if (ph !== s.phrase) {
      s.phrase = ph;
      s.shockAge = 0; // a new phrase: shockwave and a small buzz (iPhone ignores vibrate)
      navigator.vibrate?.(25);
    }
    const q = Math.floor(beat / 4);
    if (q !== s.quarter) {
      s.quarter = q;
      if (s.cut) s.flash = 1;
    }
  } else {
    s.phrase = -1;
    s.quarter = -1;
  }
  if (s.shockAge >= 0) {
    s.shockAge += dt;
    if (s.shockAge > 1.6) s.shockAge = -1;
  }
  s.flash = Math.max(0, s.flash - dt * 3);
  const drop = running && beat % 16 < 4 ? Math.exp(-(beat % 16) * 1.2) : 0;

  // Picture: camera, the cut (tree goes up), or the sample tree.
  let src: CanvasImageSource = SAMPLE;
  let sw = SW;
  let sh = SH;
  let lightsOn = true;
  const v = s.video;
  if (s.source === 'camera' && v && v.readyState >= 2 && v.videoWidth) {
    src = v;
    sw = v.videoWidth;
    sh = v.videoHeight;
  } else if (s.cut) {
    const idx = running ? [0, 1, 2, 2][Math.floor(beat / 4) % 4] : 1;
    if (s.frames) {
      const f = s.frames[idx];
      src = f.src;
      sw = f.w;
      sh = f.h;
      lightsOn = false; // lights are only placed on the sample tree and the camera
    } else {
      src = CUT[idx];
      lightsOn = idx >= 1;
    }
  }

  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.fillStyle = '#2A1E26';
  sctx.fillRect(0, 0, cw, ch);
  const fit = cover(sw, sh, cw, ch);
  sctx.drawImage(src, fit.ox, fit.oy, sw * fit.s, sh * fit.s);
  if (s.flash > 0.01) {
    sctx.fillStyle = `rgba(255,246,226,${(s.flash * 0.55).toFixed(3)})`;
    sctx.fillRect(0, 0, cw, ch);
  }

  // Lights: map each lit light into clip space (-1..1) for the GL layer.
  const list = s.onList;
  const n = lightsOn ? Math.min(list.length, CAP) : 0;
  for (let i = 0; i < n; i++) {
    const o = list[i];
    s.xy[i * 2] = ((fit.ox + o.u * sw * fit.s) / cw) * 2 - 1;
    s.xy[i * 2 + 1] = 1 - ((fit.oy + o.v * sh * fit.s) / ch) * 2;
  }
  computeShow({ on: list, mode: s.mode, live: running, beat, t, drop }, n, s.bright, s.col);

  if (s.glow) {
    s.glow.setLights(n, s.xy, s.bright, s.col);
    s.glow.frame({ time: t, tiltX: s.tilt.x, tiltY: s.tilt.y, shockAge: s.shockAge, fx: s.fx });
  } else {
    // No WebGL: draw plain glowing dots on the 2D canvas instead.
    sctx.globalCompositeOperation = 'lighter';
    const rad = Math.max(8, cw * 0.03);
    for (let i = 0; i < n; i++) {
      const px = ((s.xy[i * 2] + 1) / 2) * cw;
      const py = ((1 - s.xy[i * 2 + 1]) / 2) * ch;
      const b = s.bright[i];
      const r = Math.round(s.col[i * 3] * 255);
      const g = Math.round(s.col[i * 3 + 1] * 255);
      const bl = Math.round(s.col[i * 3 + 2] * 255);
      sctx.fillStyle = `rgba(${r},${g},${bl},${(b * 0.9).toFixed(3)})`;
      sctx.beginPath();
      sctx.arc(px, py, rad * (0.7 + 0.6 * b) * 0.5, 0, Math.PI * 2);
      sctx.fill();
    }
    sctx.globalCompositeOperation = 'source-over';
  }

  // While recording, copy the picture and the GL layer into the clip canvas.
  if (s.recorder && s.recCanvas) {
    const rc = s.recCanvas.getContext('2d');
    if (rc) {
      const rw = s.recCanvas.width;
      const rh = s.recCanvas.height;
      rc.drawImage(s.stage, 0, 0, rw, rh);
      if (s.glow && s.gl) rc.drawImage(s.gl, 0, 0, rw, rh);
    }
  }
}

function fileName(ext: string) {
  return `tree-glow-${Date.now()}.${ext}`;
}

export default function App() {
  const stageRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const L = useRef<Live>({
    stage: null,
    sctx: null,
    gl: null,
    glow: null,
    recCanvas: null,
    recorder: null,
    video: null,
    stream: null,
    cw: 390,
    ch: 844,
    dpr: 1,
    mode: 'chase',
    fx: { frost: true, bokeh: true, shock: true, snow: false },
    cut: false,
    frames: null,
    source: 'sample',
    onList: [],
    tilt: { x: 0, y: 0 },
    shockAge: -1,
    phrase: -1,
    quarter: -1,
    flash: 0,
    last: 0,
    wake: null,
    xy: new Float32Array(CAP * 2),
    bright: new Float32Array(CAP),
    col: new Float32Array(CAP * 3),
  });
  const playingRef = useRef(false);

  const [screen, setScreen] = useState<Screen>('show');
  const [sheet, setSheet] = useState(false);
  const [carolId, setCarolId] = useState('halls');
  const [style, setStyle] = useState<Style>('lofi');
  const [mode, setMode] = useState<Mode>('chase');
  const [fx, setFx] = useState<Fx>({ frost: true, bokeh: true, shock: true, snow: false });
  const [tiltOn, setTiltOn] = useState(false);
  const [cut, setCut] = useState(false);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [source, setSource] = useState<'sample' | 'camera'>('sample');
  const [camDims, setCamDims] = useState({ w: 0, h: 0 });
  const [lights, setLights] = useState<Light[]>(SAMPLE_LIGHTS);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState('Ready when you are');
  const [recLeft, setRecLeft] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [note, setNote] = useState('');
  const [dims, setDims] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  // Start the drawing loop once.
  useEffect(() => {
    const s = L.current;
    s.stage = stageRef.current;
    s.sctx = stageRef.current?.getContext('2d') ?? null;
    s.gl = glRef.current;
    try {
      s.glow = glRef.current ? new Glow(glRef.current) : null;
    } catch {
      s.glow = null; // no WebGL on this device: the 2D fallback is used
    }
    sizeAll(s);
    const onResize = () => {
      sizeAll(s);
      setDims({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    let raf = 0;
    const loop = (now: number) => {
      draw(s, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      s.stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Keep the loop's copy of the settings in step with React state.
  useEffect(() => {
    const s = L.current;
    s.mode = mode;
    s.fx = fx;
    s.cut = cut;
    s.frames = frames;
    s.source = source;
  }, [mode, fx, cut, frames, source]);

  useEffect(() => {
    L.current.onList = buildOn(lights.filter((l) => l.on).map((l) => ({ u: l.u, v: l.v })));
  }, [lights]);

  // Device tilt drives the glass bokeh.
  useEffect(() => {
    if (!tiltOn) {
      tiltTarget = { x: 0, y: 0 };
      return undefined;
    }
    const h = (e: DeviceOrientationEvent) => {
      tiltTarget = {
        x: clamp((e.gamma ?? 0) / 25, -1, 1),
        y: clamp(((e.beta ?? 40) - 40) / 25, -1, 1),
      };
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, [tiltOn]);

  async function keepAwake(on: boolean) {
    const s = L.current;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } };
    try {
      if (on && !s.wake && nav.wakeLock) {
        s.wake = await nav.wakeLock.request('screen');
      } else if (!on && s.wake) {
        const w = s.wake;
        s.wake = null;
        await w.release();
      }
    } catch {
      /* wake lock not supported or refused: the screen may sleep */
    }
  }

  function start() {
    ensureAudio(); // inside a tap, so iPhone allows audio
    const info = startShow(carolId, style);
    playingRef.current = true;
    setPlaying(true);
    const styleName = STYLES.find((x) => x.id === style)?.name ?? '';
    setLabel(`${info.name} · ${styleName} · ${Math.round(info.bpm)} bpm`);
    void keepAwake(true);
  }

  // Changing the carol or style while playing restarts the show on the new tune.
  useEffect(() => {
    if (playingRef.current) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carolId, style]);

  function stop() {
    stopShow();
    playingRef.current = false;
    setPlaying(false);
    setLabel('Stopped');
    void keepAwake(false);
  }

  async function useCamera() {
    const s = L.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      s.stream?.getTracks().forEach((tr) => tr.stop());
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      s.stream = stream;
      s.video = v;
      await v.play();
      setCamDims({ w: v.videoWidth, h: v.videoHeight });
      setSource('camera');
      setNote('Camera on. Tap Find lights to find the bulbs.');
    } catch {
      setNote('The camera is not allowed here. The sample tree still works.');
    }
  }

  function useSample() {
    const s = L.current;
    s.stream?.getTracks().forEach((tr) => tr.stop());
    s.stream = null;
    s.video = null;
    setSource('sample');
    setLights(SAMPLE_LIGHTS);
    setNote('');
  }

  function findLights() {
    const v = videoRef.current;
    if (source !== 'camera' || !v || v.readyState < 2) {
      setNote('Turn on the camera first.');
      return;
    }
    const pts = scanFrame(v, v.videoWidth, v.videoHeight);
    if (pts.length === 0) {
      setNote('No bulbs found. Try a darker room, or tap the lights by hand.');
      return;
    }
    setLights(pts.map((p) => ({ u: p.x, v: p.y, on: true })));
    setNote(`Found ${pts.length} lights. Tap one to switch it off, or tap empty space to add one.`);
  }

  async function pickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const made: Frame[] = [];
      for (const f of Array.from(files).slice(0, 3)) {
        const bm = await createImageBitmap(f);
        made.push({ src: bm, w: bm.width, h: bm.height });
      }
      while (made.length < 3) made.push(made[made.length - 1]); // one photo repeats to fill the cut
      setFrames(made);
      setCut(true);
      setNote('Tree goes up uses your photos. Lights are off for this cut.');
    } catch {
      setNote('Could not read that photo. Try another.');
    }
  }

  function record(sec: number) {
    const s = L.current;
    if (s.recorder || !recRef.current) return;
    const rw = 540;
    const rh = Math.round((rw * s.ch) / s.cw);
    const cv = recRef.current;
    cv.width = rw;
    cv.height = rh;
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    let rec: Rec;
    try {
      rec = startRecording(cv, recordTrack());
    } catch {
      setNote('This browser cannot record clips.');
      return;
    }
    s.recCanvas = cv;
    s.recorder = rec;
    if (!playingRef.current) setNote('Tip: start the show first so the clip has music.');
    let left = sec;
    setRecLeft(left);
    const tick = window.setInterval(() => {
      left -= 1;
      setRecLeft(Math.max(0, left));
    }, 1000);
    window.setTimeout(async () => {
      window.clearInterval(tick);
      const r = s.recorder;
      s.recorder = null;
      setRecLeft(0);
      if (!r) return;
      try {
        const out = await r.stop();
        setClip({ url: URL.createObjectURL(out.blob), blob: out.blob, ext: out.ext, name: fileName(out.ext) });
      } catch {
        setNote('Recording failed on this phone.');
      }
    }, sec * 1000);
  }

  async function shareClip() {
    if (!clip) return;
    const file = new File([clip.blob], clip.name, { type: clip.blob.type || 'video/webm' });
    const nav = navigator as unknown as {
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
      canShare?: (d: { files: File[] }) => boolean;
    };
    if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) {
      setNote('Sharing is not on this phone. Use Save instead.');
      return;
    }
    try {
      await nav.share({ files: [file], title: 'Tree Glow' });
    } catch {
      /* share sheet closed */
    }
  }

  function toggleTilt() {
    if (tiltOn) {
      setTiltOn(false);
      return;
    }
    // iPhone asks for motion access; this must run straight from the tap.
    const DO = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    const ask = DO?.requestPermission ? DO.requestPermission() : Promise.resolve('granted');
    ask
      .then((r) => {
        if (r !== 'granted') {
          setNote('Motion was not allowed. Tilt stays off.');
          return;
        }
        setTiltOn(true);
      })
      .catch(() => setNote('This phone cannot use tilt.'));
  }

  function resetSample() {
    useSample();
    setFrames(null);
    setCut(false);
    setCarolId('halls');
    setNote('Back to the sample tree.');
  }

  function tapLight(e: React.PointerEvent<HTMLDivElement>) {
    const sw = source === 'camera' && camDims.w ? camDims.w : SW;
    const sh = source === 'camera' && camDims.h ? camDims.h : SH;
    const fit = cover(sw, sh, dims.w, dims.h);
    const x = e.clientX;
    const y = e.clientY;
    let best = -1;
    let bestD = 18;
    lights.forEach((l, i) => {
      const d = Math.hypot(fit.ox + l.u * sw * fit.s - x, fit.oy + l.v * sh * fit.s - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      setLights((prev) => prev.map((l, i) => (i === best ? { ...l, on: !l.on } : l)));
    } else {
      const u = (x - fit.ox) / (sw * fit.s);
      const v = (y - fit.oy) / (sh * fit.s);
      setLights((prev) => [...prev, { u, v, on: true }]);
    }
    navigator.vibrate?.(10);
  }

  // Verdict line
  const found = lights.length;
  const verdict =
    found >= 12
      ? `${found} lights found. Ready to glow.`
      : `Only ${found} lights found. Use the Lights screen to add more.`;

  const sw = source === 'camera' && camDims.w ? camDims.w : SW;
  const sh = source === 'camera' && camDims.h ? camDims.h : SH;
  const fitNow = cover(sw, sh, dims.w, dims.h);
  const carol = CAROLS.find((c) => c.id === carolId) ?? CAROLS[0];

  return (
    <div className="app">
      <canvas ref={stageRef} className="stage" />
      <canvas ref={glRef} className="gl" />
      <video ref={videoRef} className="hidden-video" playsInline muted />
      <canvas ref={recRef} className="hidden-canvas" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-video"
        onChange={(e) => {
          void pickPhotos(e.target.files);
          e.target.value = '';
        }}
      />

      {screen === 'lights' && (
        <>
          <div className="hit" onPointerUp={tapLight} />
          <div className="rings">
            {lights.map((l, i) => (
              <span
                key={i}
                className={'ring ' + (l.on ? 'on' : 'off')}
                style={{ left: fitNow.ox + l.u * sw * fitNow.s, top: fitNow.oy + l.v * sh * fitNow.s }}
              />
            ))}
          </div>
        </>
      )}

      <header className="top">
        <div className="brand">Tree Glow</div>
        <div className="seg">
          <button aria-pressed={screen === 'show'} onClick={() => setScreen('show')}>
            Show
          </button>
          <button aria-pressed={screen === 'lights'} onClick={() => setScreen('lights')}>
            Lights
          </button>
        </div>
      </header>

      <div className="verdict glass">
        <span className={'dot' + (playing ? ' live' : '')} />
        {verdict}
      </div>

      {screen === 'show' ? (
        <section className="panel glass">
          <div className="now">{label}</div>
          <div className="chips">
            {MODES.map((m) => (
              <button key={m.id} className={'chip' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)}>
                {m.name}
              </button>
            ))}
          </div>
          <button className={'go' + (playing ? ' stop' : '')} onClick={() => (playing ? stop() : start())}>
            {playing ? 'Stop show' : 'Start show'}
          </button>
          <div className="row">
            <button className="ghost" onClick={() => setSheet(true)}>
              Music &amp; style
            </button>
            <button className="ghost" disabled={recLeft > 0} onClick={() => record(10)}>
              {recLeft > 0 ? `Rec ${recLeft}s` : 'Clip 10 s'}
            </button>
            <button className="ghost" disabled={recLeft > 0} onClick={() => record(15)}>
              Clip 15 s
            </button>
          </div>
          <label className="switch-row">
            <span>Tree goes up</span>
            <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} />
          </label>
          {clip && (
            <div className="clip">
              <video src={clip.url} controls playsInline />
              <div className="row">
                <a className="ghost link" href={clip.url} download={clip.name}>
                  Save
                </a>
                <button className="ghost" onClick={() => void shareClip()}>
                  Share
                </button>
              </div>
            </div>
          )}
          {note && <p className="note">{note}</p>}
        </section>
      ) : (
        <section className="panel glass">
          <p className="hint">Tap a light to switch it off or on. Tap empty space to add one.</p>
          <div className="row">
            {source === 'camera' ? (
              <>
                <button className="ghost" onClick={findLights}>
                  Find lights
                </button>
                <button className="ghost" onClick={useSample}>
                  Back to sample
                </button>
              </>
            ) : (
              <button className="ghost" onClick={() => void useCamera()}>
                Use camera
              </button>
            )}
          </div>
          <button className="go" onClick={() => setScreen('show')}>
            Done
          </button>
          {note && <p className="note">{note}</p>}
        </section>
      )}

      {sheet && (
        <div className="sheet-wrap" onClick={() => setSheet(false)}>
          <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
            <h2>Music &amp; style</h2>
            <div className="list">
              {CAROLS.map((c) => (
                <button key={c.id} className={'opt' + (carolId === c.id ? ' on' : '')} onClick={() => setCarolId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
            <h3>Style</h3>
            <div className="chips">
              {STYLES.map((s) => (
                <button key={s.id} className={'chip' + (style === s.id ? ' on' : '')} onClick={() => setStyle(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
            <h3>Effects</h3>
            {FX_LIST.map((f) => (
              <label className="switch-row" key={f.k}>
                <span>{f.label}</span>
                <input
                  type="checkbox"
                  checked={fx[f.k]}
                  onChange={(e) => setFx({ ...fx, [f.k]: e.target.checked })}
                />
              </label>
            ))}
            <div className="row">
              <button className="ghost" onClick={toggleTilt}>
                {tiltOn ? 'Tilt is on' : 'Turn on tilt'}
              </button>
            </div>
            <h3>Your photos</h3>
            <p className="hint">Pick three photos of a tree for the cut. One photo repeats if you pick fewer.</p>
            <div className="row">
              <button className="ghost" onClick={() => fileRef.current?.click()}>
                Pick photos
              </button>
              {frames && (
                <button className="ghost" onClick={() => setFrames(null)}>
                  Use sample frames
                </button>
              )}
            </div>
            <div className="row">
              <button className="ghost" onClick={resetSample}>
                Reset to sample tree
              </button>
            </div>
            <p className="hint">Now playing: {carol.name}</p>
            <button className="go" onClick={() => setSheet(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
