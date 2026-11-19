import { useEffect, useMemo, useRef, useState } from 'react';
import Dancer from './Dancer';
import Play, { type Result } from './Play';
import { beat, beatPos, blip, musicStream, setGroove, startBeat, sting, STYLE_COUNT } from './beat';
import { haptic, unlockAudio } from './phone';
import { bpmFor, MOVES, movesFor, poseAt, verdict, type Move } from './pose';
import { download, ext, recordClip, shareFile } from './share';

type Player = { name: string; total: number; turns: number; best: number };
type Saved = { players: Player[]; who: number; round: number; went: number; moveId: string; kid: boolean; sound: boolean };
const KEY = 'pass-the-move-v1';
const fresh = (name: string): Player => ({ name, total: 0, turns: 0, best: 0 });
const pick = (kid: boolean, not?: string): Move => { const list = movesFor(kid).filter(m => m.id !== not); return list[Math.floor(Math.random() * list.length)] || MOVES[0]; };
function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.players) && s.players.length) return { ...s, who: Math.min(s.who || 0, s.players.length - 1) };
  } catch { /* start fresh */ }
  return { players: [fresh('Sam'), fresh('Jo')], who: 0, round: 1, went: 0, moveId: pick(false).id, kid: false, sound: true };
}
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const I = {
  shuffle: 'M3 7h3.5c5 0 5.5 10 10.5 10H21M3 17h3.5c1.6 0 2.7-1 3.7-2.4M21 7h-4c-1.500 0-2.600.9-3.600 2.200M18 4l3 3-3 3M18 14l3 3-3 3',
  people: 'M16 19v-1.500a3.500 3.500 0 0 0-3.500-3.500h-5A3.500 3.500 0 0 0 4 17.500V19M10 10.500a3.200 3.200 0 1 0 0-6.400 3.200 3.200 0 0 0 0 6.400zM20 19v-1.500a3.500 3.500 0 0 0-2.600-3.400M15.500 4.300a3.200 3.200 0 0 1 0 6.100',
  cup: 'M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1.500A3 3 0 0 0 7 10.500M17 6h3v1.500a3 3 0 0 1-3 3M12 14v4M8.500 20h7',
  sound: 'M4 9.500v5h3.500L12 18.500v-13L7.500 9.500H4zM15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11',
  mute: 'M4 9.500v5h3.500L12 18.500v-13L7.500 9.500H4zM16 9.500l5 5M21 9.500l-5 5',
};

/** The saved three seconds, looping. */
function Loop({ frames }: { frames: HTMLCanvasElement[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; let raf = 0;
    const f = () => { raf = requestAnimationFrame(f); const fr = frames[Math.floor(performance.now() / 100) % frames.length]; if (fr) g.drawImage(fr, 0, 0, c.width, c.height); };
    f(); return () => cancelAnimationFrame(raf);
  }, [frames]);
  return <canvas ref={ref} width={288} height={512} className="loop" />;
}
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now(); let raf = 0;
    const f = () => { const k = Math.min(1, (performance.now() - t0) / 1100), e = 1 - Math.pow(1 - k, 3); setV(Math.round(to * e)); if (k < 1) raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}
const CONFETTI = ['#FF6B2C', '#FF5C9A', '#6DBE6A', '#fff', '#3A5BFF'];
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.7, dur: 1.9 + Math.random() * 1.6, rot: Math.random() * 360, c: CONFETTI[i % CONFETTI.length], w: 6 + Math.random() * 7 })), []);
  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.c, width: b.w, height: b.w * 1.6, animationDelay: b.delay + 's', animationDuration: b.dur + 's', transform: `rotate(${b.rot}deg)` }} />)}</div>;
}

export default function App() {
  const first = useMemo(load, []);
  const [players, setPlayers] = useState(first.players), [who, setWho] = useState(first.who), [round, setRound] = useState(first.round), [went, setWent] = useState(first.went);
  const [move, setMove] = useState<Move>(() => MOVES.find(m => m.id === first.moveId) || pick(first.kid));
  const [kid, setKid] = useState(first.kid), [sound, setSound] = useState(first.sound);
  const [screen, setScreen] = useState<'show' | 'play' | 'scores'>('show'), [demo, setDemo] = useState(false), [playKey, setPlayKey] = useState(0);
  const [result, setResult] = useState<(Result & { name: string; move: string }) | null>(null);
  const [sheet, setSheet] = useState(false), [toast, setToast] = useState(''), [audioOn, setAudioOn] = useState(false);
  const [clip, setClip] = useState<Blob | 'making' | null>(null);
  const dots = useRef<HTMLDivElement>(null), toastT = useRef(0), motionAsked = useRef(false);
  const me = players[who] || players[0], next = players[(who + 1) % players.length];
  const say = (t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 2400); };

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ players, who, round, went, moveId: move.id, kid, sound })); } catch { /* private mode */ } }, [players, who, round, went, move, kid, sound]);
  useEffect(() => { beat.sound = sound; }, [sound]);
  useEffect(() => { setGroove(bpmFor(move, kid), Math.floor(Math.random() * STYLE_COUNT)); }, [move, kid]);

  // Sound has to start inside a tap on a phone.
  useEffect(() => {
    const go = () => { if (unlockAudio()) { startBeat(); setAudioOn(true); } };
    addEventListener('pointerdown', go); return () => removeEventListener('pointerdown', go);
  }, []);

  // Count dots follow the beat without re-drawing the screen.
  useEffect(() => {
    if (screen !== 'show') return; let raf = 0, last = -1;
    const f = () => { raf = requestAnimationFrame(f); const n = move.poses.length, k = ((Math.floor(beatPos() + 0.08) % n) + n) % n; if (k === last || !dots.current) return; last = k; const el = dots.current.children; for (let i = 0; i < el.length; i++) el[i].classList.toggle('on', i === k); };
    f(); return () => cancelAnimationFrame(raf);
  }, [screen, move]);

  const shuffle = (quiet = false) => {
    if (went > 0) { if (!quiet) say('Same move for everyone this round'); return; }
    setMove(m => pick(kid, m.id)); haptic(18); blip(true);
  };
  const shuffleRef = useRef(shuffle); shuffleRef.current = shuffle;
  // Shake for a new move.
  useEffect(() => {
    if (screen !== 'show') return; let lastHit = 0, px = 0, py = 0, pz = 0, have = false;
    const on = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null || a.z == null) return;
      const d = Math.abs(a.x - px) + Math.abs(a.y - py) + Math.abs(a.z - pz); px = a.x; py = a.y; pz = a.z;
      if (!have) { have = true; return; }
      if (d > 32 && performance.now() - lastHit > 1300) { lastHit = performance.now(); shuffleRef.current(true); }
    };
    addEventListener('devicemotion', on); return () => removeEventListener('devicemotion', on);
  }, [screen]);
  const askMotion = () => { // iPhones only allow shake after a yes, asked from a tap
    if (motionAsked.current) return; motionAsked.current = true;
    const DM = (window as any).DeviceMotionEvent; if (DM?.requestPermission) DM.requestPermission().catch(() => {});
  };

  const start = (practice: boolean) => { setDemo(practice); setPlayKey(k => k + 1); setClip(null); setScreen('play'); haptic(14); };
  const finish = (r: Result) => {
    setResult({ ...r, name: me.name, move: move.name }); setScreen('scores'); sting(r.score); haptic(r.score >= 90 ? [20, 50, 20, 50, 60] : 22);
    if (!r.demo) setPlayers(ps => ps.map((p, i) => (i === who ? { ...p, total: p.total + r.score, turns: p.turns + 1, best: Math.max(p.best, r.score) } : p)));
  };
  const pass = () => {
    const was = result; setResult(null); setClip(null); setScreen('show'); haptic(14);
    if (!was || was.demo) return;
    setWho((who + 1) % players.length);
    if (went + 1 >= players.length) { setWent(0); setRound(r => r + 1); setMove(m => pick(kid, m.id)); } else setWent(went + 1);
  };

  const makeClip = async () => {
    if (!result || clip === 'making') return; setClip('making');
    const fr = result.frames, W = 576, H = 1024;
    const blob = await recordClip(W, H, 3, (g, t) => {
      const f = fr[Math.min(fr.length - 1, Math.floor(t * 10))]; g.fillStyle = '#0B0F33'; g.fillRect(0, 0, W, H); if (f) g.drawImage(f, 0, 0, W, H);
      const sh = g.createLinearGradient(0, H - 300, 0, H); sh.addColorStop(0, 'rgba(11,15,51,0)'); sh.addColorStop(1, 'rgba(11,15,51,.92)'); g.fillStyle = sh; g.fillRect(0, H - 300, W, 300);
      g.textBaseline = 'alphabetic'; g.fillStyle = '#FF6B2C'; g.font = '800 120px "PM Display", sans-serif'; g.textAlign = 'right'; g.fillText(String(result.score), W - 36, H - 48);
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 40px "PM Display", sans-serif'; g.fillText(result.name.toUpperCase().slice(0, 12), 36, H - 104);
      g.font = '500 28px "PM Body", sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(result.move, 36, H - 60); g.fillText('Pass the Move', 36, 64);
    }, musicStream());
    setClip(blob); if (!blob) say('Couldn’t make the clip');
  };
  const sendClip = async () => {
    if (!clip || clip === 'making') return; const name = `pass-the-move.${ext(clip)}`;
    const r = await shareFile(clip, name, 'Pass the Move');
    if (r === 'unsupported' || r === 'blocked') { download(clip, name); say('Saved to your downloads'); }
  };

  const ranks = useMemo(() => players.map((p, i) => ({ ...p, i })).sort((a, b) => b.total - a.total || b.best - a.best), [players]);
  const leader = ranks[0], anyScore = ranks.some(p => p.turns > 0);
  const rename = (i: number, name: string) => setPlayers(ps => ps.map((p, k) => (k === i ? { ...p, name: name.slice(0, 12) } : p)));
  const closeSheet = () => { setPlayers(ps => ps.map((p, i) => (p.name.trim() ? { ...p, name: p.name.trim() } : { ...p, name: `Player ${i + 1}` }))); setSheet(false); };
  const drop = (i: number) => { if (players.length <= 1) return; setPlayers(ps => ps.filter((_, k) => k !== i)); setWho(w => (i < w ? w - 1 : Math.min(w, players.length - 2))); setWent(0); };
  const resetAll = () => { setPlayers(ps => ps.map(p => fresh(p.name))); setWho(0); setRound(1); setWent(0); setMove(m => pick(kid, m.id)); say('Scores cleared'); };
  const toggleKid = () => { const k = !kid; setKid(k); if (k && (move.hard !== 1 || move.combo)) setMove(pick(true)); };

  return (
    <div className="app">
      {screen === 'show' && (
        <main className="screen show" key={'show' + move.id + who}>
          <div className="glow" />
          <Dancer key={move.id} getPose={() => poseAt(move, beatPos())} lift={0.06} />
          <header className="bar">
            <span className="round">Round {round}{kid ? ' · Kid mode' : ''}</span>
            <span className="tools">
              <button onClick={() => { setSound(s => !s); haptic(8); }} aria-label={sound ? 'Sound off' : 'Sound on'}><Icon d={sound ? I.sound : I.mute} /></button>
              <button onClick={() => setScreen('scores')} aria-label="Scores"><Icon d={I.cup} /></button>
              <button onClick={() => setSheet(true)} aria-label="Players"><Icon d={I.people} /></button>
            </span>
          </header>
          <h1 className="up"><span>{me.name},</span> you’re up</h1>
          {!audioOn && sound && <div className="pill">Tap for sound</div>}
          <section className="foot">
            <div className="moveline">
              <div><h2>{move.name}</h2><p>{move.cue}</p></div>
              <button className="round-btn" onClick={() => { askMotion(); shuffle(); }} aria-label="New move"><Icon d={I.shuffle} /></button>
            </div>
            <div ref={dots} className="dots">{move.poses.map((_, i) => <i key={i}>{i + 1}</i>)}</div>
            <button className="big" onClick={() => start(false)}>Your go</button>
            <button className="link" onClick={() => start(true)}>No camera? Try a practice round</button>
          </section>
        </main>
      )}

      {screen === 'play' && <Play key={playKey} move={move} kid={kid} name={me.name} demo={demo} onDone={finish} onCancel={() => { setScreen('show'); setGroove(bpmFor(move, kid), beat.style); }} onDemo={() => start(true)} />}

      {screen === 'scores' && (
        <main className="screen scores" key="scores">
          {result ? <>
            {result.score >= 90 && <Confetti />}
            <header className="shead"><span>{result.name} · {result.move}{result.demo ? ' · practice' : ''}</span></header>
            <div className="scorebox">
              <div className="num"><CountUp to={result.score} /></div>
              <div className="sside">
                <h1>{verdict(result.score)}</h1>
                <div className="chips">{result.counts.map((c, i) => <i key={i} className={c >= 90 ? 'chip got hot' : 'chip got'}>{c}</i>)}</div>
                {result.tip && <p className="fix">Next time: {result.tip.toLowerCase()}</p>}
              </div>
            </div>
            {result.frames.length > 0 && (
              <section className="moment">
                <Loop frames={result.frames} />
                <div>
                  <h3>Best moment</h3>
                  <p>3 seconds, kept on this phone.</p>
                  {clip && clip !== 'making'
                    ? <button className="mid" onClick={sendClip}>{clip.type.startsWith('video') ? 'Share clip' : 'Share picture'}</button>
                    : <button className="mid" onClick={makeClip} disabled={clip === 'making'}>{clip === 'making' ? 'Making…' : 'Make a clip'}</button>}
                </div>
              </section>
            )}
          </> : <header className="shead"><span>Scoreboard · Round {round}</span></header>}
          <section className="board">
            <h3>{anyScore ? <><b>{leader.name}</b> leads with {leader.total}</> : 'No scores yet'}</h3>
            <ol>{ranks.map((p, k) => (
              <li key={p.i} className={p.i === who && result && !result.demo ? 'me' : ''}>
                <em>{k + 1}</em><span>{p.name}</span><small>{p.turns ? `best ${p.best}` : 'not yet'}</small><b>{p.total}</b>
              </li>))}</ol>
          </section>
          <div className="spacer" />
          {result
            ? <button className="big" onClick={pass}>{result.demo ? 'Back to the move' : players.length > 1 ? `Pass to ${next.name} →` : 'Go again →'}</button>
            : <button className="big" onClick={() => setScreen('show')}>Back to the move</button>}
        </main>
      )}

      {sheet && (
        <div className="scrim" onClick={closeSheet}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h2>Who’s playing</h2>
            <ul>{players.map((p, i) => (
              <li key={i}>
                <input value={p.name} maxLength={12} onChange={e => rename(i, e.target.value)} aria-label={`Player ${i + 1}`} enterKeyHint="done" />
                {players.length > 1 && <button onClick={() => drop(i)} aria-label={`Remove ${p.name}`}>×</button>}
              </li>))}</ul>
            {players.length < 8 && <button className="add" onClick={() => setPlayers(ps => [...ps, fresh(`Player ${ps.length + 1}`)])}>+ Add a player</button>}
            <label className="switch"><span><b>Kid mode</b><small>Easy moves, slower beat, kinder scores</small></span><input type="checkbox" checked={kid} onChange={toggleKid} /><i /></label>
            <div className="row2"><button className="ghost" onClick={resetAll}>Clear scores</button><button className="mid" onClick={closeSheet}>Done</button></div>
            <p className="fine">The camera picture is judged on this phone and never sent anywhere. Shake the phone for a new move.</p>
          </div>
        </div>
      )}
      {toast && <div className="toast" key={toast}>{toast}</div>}
    </div>
  );
}
