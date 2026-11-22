import { useEffect, useMemo, useRef, useState } from 'react';
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Card } from '@astryxdesign/core/Card';
import { Switch } from '@astryxdesign/core/Switch';
import { BALLOONS, balloonById } from './balloons';
import { Game, BLOCKS, START_ST, END_ST, ord, type Hud, type Result, type Fx } from './game';
import { type Forecast, type Wind, LIMIT_S, LIMIT_G, SAMPLE, cachedForecast, paradeForecast, verdict, windFromForecast, liveWind, niceDate, paradeDate } from './wind';
import { Drumline } from './drum';
import { unlockAudio, restAudio, haptic, isIOS } from './phone';
import { shareCard, shareFile, download } from './share';

type Screen = 'home' | 'play' | 'result';
type WindMode = 'parade' | 'live' | 'sample';
type Save = { best: number; pick: string; sound: boolean; vibe: boolean; tilt: boolean };
const KEY = 'tilt-parade-save';
const load = (): Save => { try { return { best: 0, pick: 'turkey', sound: true, vibe: true, tilt: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: 0, pick: 'turkey', sound: true, vibe: true, tilt: true }; } };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hourName = (h: number) => (h === 12 ? 'noon' : `${h} AM`);
const MODES: Record<WindMode, string> = { parade: 'Parade Day', live: 'Live wind', sample: 'Practice' };

export default function App() {
  const cv = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const drum = useMemo(() => new Drumline(), []);
  const [save, setSave] = useState<Save>(load);
  const [screen, setScreen] = useState<Screen>('home');
  const [fc, setFc] = useState<Forecast | null>(cachedForecast);
  const [fcFail, setFcFail] = useState(false);
  const [mode, setMode] = useState<WindMode>('parade');
  const [live, setLive] = useState<Wind | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [res, setRes] = useState<{ r: Result; prevBest: number } | null>(null);
  const [card, setCard] = useState<Blob | null>(null);
  const [sheet, setSheet] = useState(false);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState('');
  const [down, setDown] = useState(0);
  const [tiltOn, setTiltOn] = useState(false);
  const [shown, setShown] = useState(save.pick);
  const picked = useRef(false);
  const lock = useRef<any>(null);
  const saveRef = useRef(save); saveRef.current = save;

  const unlocked = BALLOONS.filter(b => save.best >= b.unlock);
  const balloon = balloonById(screen === 'home' ? shown : save.pick);
  const v = verdict(fc);
  const wind: Wind = mode === 'parade' && fc ? windFromForecast(fc) : mode === 'live' && live ? live : SAMPLE;
  const put = (p: Partial<Save>) => setSave(s => { const n = { ...s, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } return n; });
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast(x => (x === t ? '' : x)), 2600); };
  const buzz = (p: number | number[]) => { if (saveRef.current.vibe) haptic(p); };

  // the forecast for parade morning
  useEffect(() => { paradeForecast().then(f => { setFc(f); setFcFail(false); }).catch(() => setFcFail(true)); }, []);

  // one game for the whole app; the home screen is the same scene, idling
  useEffect(() => {
    const g = new Game(cv.current!, balloonById(save.pick), wind); game.current = g; (window as any).__tp = g;
    let lastHud = 0;
    g.onHud = h => { const n = performance.now(); if (n - lastHud > 66) { lastHud = n; setHud(h); } };
    const onR = () => g.resize(); addEventListener('resize', onR);
    return () => { removeEventListener('resize', onR); g.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { game.current?.setWind(wind); }, [wind.sustained, wind.gust, wind.dir, wind.source]);
  useEffect(() => { game.current?.setBalloon(balloon); }, [balloon.id]);

  // the hero cycles through the unlocked balloons until one is picked
  useEffect(() => {
    if (screen !== 'home' || unlocked.length < 2) return;
    const id = window.setInterval(() => { if (!picked.current && !sheet) setShown(s => { const i = unlocked.findIndex(b => b.id === s); return unlocked[(i + 1) % unlocked.length].id; }); }, 5200);
    return () => clearInterval(id);
  }, [screen, unlocked.length, sheet]);

  // sounds and buzzes from the game
  useEffect(() => {
    const g = game.current; if (!g) return;
    g.onFx = (k: Fx) => {
      if (k === 'block') { drum.bpm = 100 + (hud?.blocks ?? 0) * 1.5; return; }
      if (k === 'slip') { drum.fx('hit'); buzz([40, 40, 40]); say('Rope slipped! Ease off that side'); return; }
      drum.fx(k);
      if (k === 'hit') buzz(70); else if (k === 'gust') buzz([15, 30, 15]); else if (k === 'pull') buzz(8); else if (k === 'finish') buzz([30, 50, 30, 50, 80]);
    };
    g.onEndRaw = r => endRun(r);
  });

  // tilt
  useEffect(() => {
    if (screen !== 'play' || !save.tilt) return;
    const on = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return; setTiltOn(true);
      const land = (window.screen.orientation?.angle ?? 0) % 180 !== 0 ? (e.beta ?? 0) : e.gamma;
      game.current?.setSteer(clamp(land / 24, -1, 1));
    };
    addEventListener('deviceorientation', on);
    return () => removeEventListener('deviceorientation', on);
  }, [screen, save.tilt]);

  // pause when the phone sleeps or the app is hidden
  useEffect(() => {
    const vis = () => {
      if (document.hidden && game.current?.mode === 'play') pause(true);
      if (!document.hidden && screen === 'play') wake();
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  });

  async function wake() { try { lock.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* not offered */ } }
  function sleep() { try { lock.current?.release(); } catch { /* gone */ } lock.current = null; }
  function pause(p: boolean) {
    const g = game.current; if (!g) return; g.paused = p; setPaused(p);
    if (p) drum.stop(); else { drum.on = saveRef.current.sound; drum.start(unlockAudio()); }
  }

  async function fly() {
    const ctx = unlockAudio();
    const DOE = (window as any).DeviceOrientationEvent;
    if (save.tilt && DOE && typeof DOE.requestPermission === 'function') { try { const p = await DOE.requestPermission(); if (p !== 'granted') say('Tilt is off. Drag to steer.'); } catch { /* drag works */ } }
    wake(); drum.on = save.sound; drum.bpm = 100; drum.start(ctx);
    setTiltOn(false); setRes(null); setCard(null); setPaused(false);
    const g = game.current!; g.setBalloon(balloonById(save.pick)); g.start(); setScreen('play');
  }
  function endRun(r: Result) {
    drum.stop(); restAudio(); sleep();
    const prevBest = saveRef.current.best;
    if (r.blocks > prevBest) put({ best: r.blocks });
    setRes({ r, prevBest }); setScreen('result');
    const b = balloonById(saveRef.current.pick);
    shareCard({ balloon: b, blocks: r.blocks, total: BLOCKS, headline: headline(r), windLine: windLine(wind), best: r.blocks > prevBest }).then(setCard).catch(() => setCard(null));
  }
  function home() { sleep(); drum.stop(); restAudio(); setPaused(false); game.current?.idle(); setShown(save.pick); setScreen('home'); }
  async function share() {
    if (!card || !res) return;
    const name = `tilt-parade-${res.r.blocks}-blocks.png`;
    const how = await shareFile(card, name, 'Tilt Parade', `I steered ${balloonById(save.pick).name} ${res.r.blocks} of ${BLOCKS} blocks down the avenue.`);
    if (how === 'unsupported') { download(card, name); say('Saved the picture'); }
    else if (how === 'blocked') say('Tap Share once more');
  }
  async function pickMode(m: string) {
    const w = m as WindMode;
    if (w === 'live') {
      say('Finding the wind near you…');
      try { setLive(await liveWind()); setMode('live'); say('Live wind loaded'); }
      catch (e: any) { say(e?.message === 'geo-denied' ? 'Location is off. Using the practice breeze.' : 'Could not get live wind'); }
      return;
    }
    if (w === 'parade' && !fc) say('No forecast yet. Using the practice breeze.');
    setMode(w);
  }
  function pickBalloon(id: string) { picked.current = true; setShown(id); put({ pick: id }); }

  // drag to steer, for phones without tilt
  function drag(e: React.PointerEvent) {
    if (tiltOn && save.tilt) return;
    if (e.type === 'pointerdown' || e.buttons) game.current?.setSteer(clamp((e.clientX / innerWidth) * 2.6 - 1.3, -1, 1));
  }
  function pull(side: number) {
    const ok = game.current?.pull(side); setDown(side);
    window.setTimeout(() => setDown(d => (d === side ? 0 : d)), 160);
    if (!ok && hud?.slip === side) buzz(20);
  }

  const r = res?.r, newOnes = r && res ? BALLOONS.filter(b => b.unlock > res.prevBest && b.unlock <= r.blocks) : [];
  const nextUnlock = BALLOONS.find(b => b.unlock > save.best);
  const warn = hud?.warn ?? 0;

  return (
    <div className="app">
      <canvas ref={cv} className="stage" />

      {/* HOME */}
      <div className={`layer ${screen === 'home' ? '' : 'off'}`} aria-hidden={screen !== 'home'}>
        <div className="top">
          <div className="brand">Tilt Parade</div>
          <button className="round" aria-label="Settings" onClick={() => setSheet(true)}>⚙</button>
        </div>
        <div className="verdict" aria-live="polite">
          <div className="ask">Will they fly? · {niceDate(paradeDate())}</div>
          <div className={`word ${v.tone}`}>{v.word}</div>
          <div className="why">{fcFail && !fc ? 'forecast not reachable right now' : v.line}</div>
          {fc && <div className="hours">{fc.hours.map(h => {
            const over = h.s > LIMIT_S || h.g > LIMIT_G;
            return <div key={h.h} className={`hour ${over ? 'over' : 'ok'}`}>{hourName(h.h)}<b>{Math.round(h.g)}</b>gust</div>;
          })}</div>}
          <div className="note">Grounded over {LIMIT_S} mph wind or {LIMIT_G} mph gusts · Midtown, 9 AM to noon</div>
        </div>
        <div className="hero-tap" onClick={() => { const i = unlocked.findIndex(b => b.id === shown); pickBalloon(unlocked[(i + 1) % unlocked.length].id); }} />
        <div className="pickrow">
          <DropdownMenu presentation="popover" placement="above" alignment="start" menuWidth={260}
            renderTrigger={p => <button {...p} className="pill" aria-label="Wind">💨 <i>{MODES[mode]}</i></button>}>
            <DropdownMenuRadioGroup label="Wind for the run" value={mode} onChange={pickMode}>
              <DropdownMenuRadioItem value="parade" label="Parade Day" description={fc ? `NYC forecast, gusts ${Math.round(fc.gust)} mph` : 'NYC forecast not ready'} />
              <DropdownMenuRadioItem value="live" label="Live wind" description="The wind where you are now" />
              <DropdownMenuRadioItem value="sample" label="Practice breeze" description="Gusts 17 mph, good for learning" />
            </DropdownMenuRadioGroup>
          </DropdownMenu>
          <DropdownMenu presentation="popover" placement="above" alignment="end" menuWidth={270}
            renderTrigger={p => <button {...p} className="pill" aria-label="Balloon">🎈 <i>{balloonById(save.pick).name}</i></button>}>
            <DropdownMenuRadioGroup label="Balloon" value={save.pick} onChange={pickBalloon}>
              {BALLOONS.map(b => <DropdownMenuRadioItem key={b.id} value={b.id} label={b.name} isDisabled={save.best < b.unlock}
                description={save.best < b.unlock ? (b.unlock >= BLOCKS ? 'Finish the route to unlock' : `Reach ${b.unlock} blocks to unlock`) : b.blurb} />)}
            </DropdownMenuRadioGroup>
          </DropdownMenu>
        </div>
        <button className="go" onClick={fly}>Fly the route</button>
        <div className="foot">{save.best ? `Best ${save.best} of ${BLOCKS} blocks${save.best >= BLOCKS ? ' · made it to 34th St' : ` · to ${ord(START_ST - save.best)} St`}` : `${ord(START_ST)} St to ${ord(END_ST)} St · ${BLOCKS} blocks`}</div>
      </div>

      {/* PLAY */}
      <div className={`layer ${screen === 'play' ? '' : 'off'}`} aria-hidden={screen !== 'play'}>
        <div className="hud">
          <div className="sign"><small>NOW AT</small>{ord(hud?.street ?? START_ST)} St</div>
          <button className="round" aria-label="Pause" onClick={() => pause(true)}>❚❚</button>
          <div className="score">{hud?.blocks ?? 0}<small>of {BLOCKS} blocks</small></div>
        </div>
        <div className="meters">
          <div className={`meter ${(hud?.air ?? 1) < 0.35 ? 'hot' : ''}`}><span><span>Air</span><span>{Math.round((hud?.air ?? 1) * 100)}%</span></span><div className="bar"><div style={{ transform: `scaleX(${hud?.air ?? 1})` }} /></div></div>
          <div className={`meter ${(hud?.tension ?? 0) > 0.85 ? 'hot' : ''}`}><span><span>Rope tension</span><span>{(hud?.tension ?? 0) > 0.85 ? 'Too tight' : (hud?.tension ?? 0) > 0.55 ? 'Tight' : 'OK'}</span></span><div className="bar tension"><div style={{ transform: `scaleX(${clamp(hud?.tension ?? 0, 0, 1)})` }} /></div></div>
        </div>
        <div className="route"><div style={{ transform: `scaleX(${hud?.progress ?? 0})` }} /></div>
        <div className={`gust ${warn ? 'on' : ''}`}>{warn ? `Gust coming ${warn > 0 ? '→' : '←'} ${Math.round(Math.abs(warn))} mph` : ' '}</div>
        <div className="steer" onPointerDown={drag} onPointerMove={drag} />
        {(hud?.blocks ?? 0) < 2 && <div className="hint">{tiltOn && save.tilt ? 'Tilt to walk the crew. ' : 'Drag to walk the crew. '}Tap a side to pull its rope.</div>}
        <div className="pulls">
          <button className={`pull left ${down === -1 ? 'down' : ''} ${hud?.slip === -1 ? 'slip' : ''}`} onPointerDown={() => pull(-1)}><span><b>⟵</b>Pull</span></button>
          <button className={`pull right ${down === 1 ? 'down' : ''} ${hud?.slip === 1 ? 'slip' : ''}`} onPointerDown={() => pull(1)}><span><b>⟶</b>Pull</span></button>
        </div>
        {paused && <div className="paused"><div>
          <h2>Paused</h2>
          <button className="go" onClick={() => { wake(); pause(false); }}>Keep going</button>
          <button className="ghost" onClick={home}>Back home</button>
        </div></div>}
      </div>

      {/* RESULT */}
      <div className={`layer result ${screen === 'result' ? '' : 'off'}`} aria-hidden={screen !== 'result'}>
        {r && <div className="cardwrap" key={r.secs + '-' + r.blocks}>
          <Card padding={4} elevation={3 as any}>
            <div className="r-head">{balloonById(save.pick).name} · {MODES[mode]}</div>
            <div className="r-num">{r.blocks}<span className="r-of">of {BLOCKS} blocks</span></div>
            <div className="r-line">{headline(r)}</div>
            {res && r.blocks > res.prevBest && <div className="r-new">New best{newOnes.length ? ` · unlocked ${newOnes.map(b => b.name).join(' and ')}` : ''}</div>}
            {!(res && r.blocks > res.prevBest) && nextUnlock && <div className="fine" style={{ marginTop: 8 }}>{nextUnlock.unlock >= BLOCKS ? `Finish the route to unlock ${nextUnlock.name}` : `Reach ${nextUnlock.unlock} blocks to unlock ${nextUnlock.name}`}</div>}
            <div className="r-stats">
              <div><b>{r.air}%</b>air left</div>
              <div><b>{r.hits}</b>lamppost{r.hits === 1 ? '' : 's'}</div>
              <div><b>{Math.round(wind.gust)}</b>mph gusts</div>
            </div>
            <div className="r-btns">
              <button className="ghost" onClick={share} disabled={!card}>Share</button>
              <button className="go" onClick={fly}>Fly again</button>
            </div>
            <button className="ghost" style={{ width: '100%', marginTop: 10, border: 0, height: 44 }} onClick={home}>Home</button>
          </Card>
        </div>}
      </div>

      <BottomSheet isOpen={sheet} onOpenChange={setSheet} label="Settings" height="hug" padding={4}>
        <div className="sheet">
          <h3>Settings</h3>
          <Switch label="Drumline" description="Plays even with the silent switch on" value={save.sound} onChange={c => put({ sound: c })} />
          <Switch label="Vibration" description={isIOS() ? 'iPhone browsers can’t vibrate, so this does nothing there' : 'Buzz on gusts, pulls and hits'} value={save.vibe} onChange={c => put({ vibe: c })} />
          <Switch label="Tilt to steer" description="Off means drag on the screen instead" value={save.tilt} onChange={c => put({ tilt: c })} />
          <div className="best">Best run: {save.best} of {BLOCKS} blocks · {unlocked.length} of {BALLOONS.length} balloons</div>
          <p className="fine">The verdict uses the Open-Meteo forecast for Midtown on parade morning. The real call is made by the city and the parade on the day. Live wind rounds your spot to about 7 miles before asking for the weather. All balloons are made up for this game. Menus, card and sheet from Astryx by Meta, MIT license. Weather by Open-Meteo.</p>
        </div>
      </BottomSheet>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function headline(r: Result) {
  if (r.finished) return 'Made it to 34th St!';
  if (r.blocks === 0) return 'Grounded at the start';
  return `Out of air at ${ord(r.street)} St`;
}
function windLine(w: Wind) { return `${w.label}: ${Math.round(w.sustained)} mph, gusts ${Math.round(w.gust)} mph`; }
