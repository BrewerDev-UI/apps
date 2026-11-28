import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_SETTINGS, idb, type Hand, type Kid, type Meas, type Scan, type Seat, type Settings } from './data';
import { seedSample } from './seed';
import { CARTERS_BRAND, usLabel } from './sizes';
import { daysBetween, fmtDate, noon, summarize, verdict, type Info, type KidSum } from './model';
import { iso, pd, valOf } from './growth/lms';
import { unlockAudio } from './phone';
import { setNoAI } from './cv/foot';
import { makeIcs, shareCard } from './share';
import type { Route, Store } from './store';
import { Ic, Num } from './ui';
import { KidScreen, MeasureScreen, ScanScreen, SeatScreen, SettingsScreen } from './Screens';

const TONE_WORD = { now: 'Now', soon: 'Soon', good: 'Good' } as const;
const TONE_VAR = { now: 'var(--now)', soon: 'var(--soon)', good: 'var(--good)' } as const;

function ladder(s: KidSum, i: Info): { labels: string[]; cur: number } {
  if (i.cat === 'clothes') {
    const rows = CARTERS_BRAND.rows.map(r => r.label), idx = Math.max(0, rows.indexOf(i.label)), start = Math.max(0, Math.min(idx - 2, rows.length - 6));
    return { labels: rows.slice(start, start + 6), cur: idx - start };
  }
  if (i.cat === 'shoes') {
    const S = s.shoes!.S, from = Math.max(4, S - 2), labels: string[] = [];
    for (let k = from; k < from + 6; k++) labels.push(usLabel(k));
    return { labels, cur: S - from };
  }
  return { labels: ['Infant', 'Convert.', 'Booster'], cur: ['infant', 'convertible', 'booster'].indexOf(s.seat!.type) };
}
function shareLine(s: KidSum, i: Info, today: Date): { line: string; sub: string } {
  const n = s.kid.name;
  if (i.cat === 'seat') { const v = verdict(s, i, today); return { line: `${v.pre} ${v.date}`.trim(), sub: `${n} is ${s.age} old` }; }
  const what = i.cat === 'clothes' ? i.label : `size ${i.label} shoes`;
  return i.out ? { line: `${n} is in ${what} now; next size by ${fmtDate(i.out, today)}`, sub: `${n} is ${s.age} old` } : { line: `${n} fits ${what} for a good while`, sub: `${n} is ${s.age} old` };
}

function Hero({ s, i, today, onOpen, many }: { s: KidSum; i: Info; today: Date; onOpen: () => void; many: boolean }) {
  const v = verdict(s, i, today), L = ladder(s, i);
  const share = (e: React.MouseEvent) => { e.stopPropagation(); const x = shareLine(s, i, today); void shareCard(x.line, x.sub, TONE_VAR[i.tone] === 'var(--now)' ? '#B8613F' : i.tone === 'soon' ? '#C99A2E' : '#7F8B3E'); };
  return (
    <motion.div key={s.kid.id + i.cat} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
      <div className={`hero t-${i.tone}`} role="button" tabIndex={0} data-t="hero" onClick={onOpen} onKeyDown={e => e.key === 'Enter' && onOpen()}>
        <div className="hero-top"><span className="tone" data-t="hero-tone">{TONE_WORD[i.tone]}{many ? ' · tie' : ''}</span></div>
        <button className="mini-b hero-share" aria-label="Share" data-t="share" onClick={share}><Ic n="share" /></button>
        <p className="hero-pre" data-t="hero-pre">{v.pre}</p>
        <h1 className="hero-date" data-t="hero-date">{v.date || 'a good while'}</h1>
        <div className="hero-days">{i.days === null ? 'Nothing to do yet' : i.days === 0 ? 'Right now' : <>In <Num v={i.days} d={0} /> days</>}{i.est ? ' · estimated from height' : ''}</div>
        <div className="ladder" aria-hidden="true">
          {L.labels.map((l, k) => (
            <div key={l + k} className={`rung ${k < L.cur ? 'past' : k === L.cur ? 'cur' : k === L.cur + 1 ? 'next' : ''}`}><i style={{ height: 22 + k * 11 }} /><span>{l}</span></div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function KidCard({ s, onOpen, onSeat }: { s: KidSum; onOpen: () => void; onSeat: () => void }) {
  const cell = (cat: string, i?: Info, big?: string) => {
    if (!i) return <div className="pill none" onClick={e => { e.stopPropagation(); if (cat === 'Seat') onSeat(); else onOpen(); }}><small>{cat}</small><b>{cat === 'Seat' ? 'Add' : '—'}</b><em>{cat === 'Seat' ? 'car seat' : 'measure first'}</em></div>;
    return <div className={`pill t-${i.tone}`} data-tone={i.tone}><small>{cat}</small><b>{big ?? i.label}</b><em>{TONE_WORD[i.tone]}{i.out && i.days !== 0 ? ` · ${fmtDate(i.out)}` : ''}</em></div>;
  };
  return (
    <button className="kid" data-t={`kid-${s.kid.name}`} onClick={onOpen}>
      <div className="kid-h"><div className="avatar">{s.kid.name.slice(0, 1).toUpperCase()}</div><div><div className="kid-n">{s.kid.name}</div><div className="kid-a">{s.age} old</div></div></div>
      <div className="pills">
        {cell('Clothes', s.clothes)}
        {cell('Shoes', s.shoes, s.shoes ? s.shoes.label : undefined)}
        {cell('Seat', s.items.find(x => x.cat === 'seat'), s.seat ? { infant: 'Infant', convertible: 'Conv.', booster: 'Booster' }[s.seat.type] : undefined)}
      </div>
    </button>
  );
}

export default function App() {
  const [data, setData] = useState<{ kids: Kid[]; meas: Meas[]; scans: Scan[]; seats: Seat[]; hands: Hand[]; set: Settings } | null>(null);
  const [today, setToday] = useState(() => noon());
  const [stack, setStack] = useState<Route[]>([]);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState('');
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState('');
  const msgT = useRef<any>(null);

  const reload = useCallback(async () => {
    const kv = await idb.all<Settings>('kv');
    let set = kv.find(x => x.id === 'settings') ?? DEFAULT_SETTINGS;
    if (!set.seeded) { if (set.sample) await seedSample(noon()); set = { ...set, seeded: true }; await idb.put('kv', set); }
    const [kids, meas, scans, seats, hands] = await Promise.all([idb.all<Kid>('kids'), idb.all<Meas>('meas'), idb.all<Scan>('scans'), idb.all<Seat>('seats'), idb.all<Hand>('hands')]);
    kids.sort((a, b) => a.birth.localeCompare(b.birth)); // oldest first
    setData({ kids, meas, scans, seats, hands, set });
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const un = () => unlockAudio(); window.addEventListener('pointerdown', un, { once: true });
    const vis = () => { if (!document.hidden) setToday(t => (iso(t) === iso(new Date()) ? t : noon())); }; document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pointerdown', un); document.removeEventListener('visibilitychange', vis); };
  }, []);
  try { const th = localStorage.getItem('su-theme'); if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; } catch { /* storage blocked */ }

  const sums = useMemo(() => (data ? data.kids.map(k => summarize(k, data, today)) : []), [data, today]);
  const ranked = useMemo(() => sums.filter(s => s.top).sort((a, b) => a.key - b.key), [sums]);
  const ties = useMemo(() => ranked.filter(s => s.key === ranked[0].key), [ranked]);
  useEffect(() => { if (ties.length < 2) return; const t = setInterval(() => setTick(x => x + 1), 4500); return () => clearInterval(t); }, [ties.length]);
  const heroS = ties.length ? ties[tick % ties.length] : null;

  const toast = useCallback((t: string) => { setMsg(t); clearTimeout(msgT.current); msgT.current = setTimeout(() => setMsg(''), 1400); }, []);
  const save = useCallback(async (p: Partial<Settings>) => { if (!data) return; await idb.put('kv', { ...data.set, ...p }); await reload(); }, [data, reload]);
  const push = useCallback((r: Route) => setStack(s => [...s, r]), []);
  const pop = useCallback(() => setStack(s => s.slice(0, -1)), []);
  const st: Store | null = data ? { ...data, today, sums, reload, save, toast, push, pop } : null;

  const latest = useRef({ st, stack, heroS });
  latest.current = { st, stack, heroS };
  useEffect(() => {
    const w = window as any;
    w.__su = {
      lastScan: null as any, feed: null as any,
      state: () => { const L = latest.current; return { today: iso(today), hero: L.heroS?.kid.name ?? null, stack: L.stack.map(r => r.t), set: L.st?.set, kids: (L.st?.sums ?? []).map(s => ({ name: s.kid.name, age: s.age, top: s.top && { cat: s.top.cat, tone: s.top.tone, days: s.top.days }, items: s.items.map(i => ({ cat: i.cat, label: i.label, tone: i.tone, days: i.days, out: i.out ? iso(i.out) : null })) })) }; },
      setToday: (d: string) => setToday(pd(d)), valOf,
      setNoAI,
      ics: () => makeIcs(latest.current.st?.set ?? DEFAULT_SETTINGS, new Date()),
      feedScan: (c: HTMLCanvasElement, kid?: string) => { w.__su.feed = c; w.__su.lastScan = null; const k = kid ?? latest.current.st?.kids[0]?.id; if (k) setStack([{ t: 'scan', kid: k }]); },
      go: (r: Route) => setStack([r]),
    };
  }, [today]);

  if (!st) return <div className="app"><div className="top"><div className="logo"><i />Size Up</div></div></div>;

  const lastMeas = st.meas.map(m => m.date).sort().pop();
  const since = lastMeas ? Math.max(0, daysBetween(pd(lastMeas), today)) : null;
  const due = since !== null && since > st.set.every * 7;
  const openSheet = () => { setPick(heroS?.kid.id ?? st.kids[0]?.id ?? ''); setSheet(true); };
  const go = (t: 'measure' | 'scan' | 'seat') => { if (!pick) return; setSheet(false); push({ t, kid: pick }); };

  const render = (r: Route, i: number) => {
    const kid = 'kid' in r ? r.kid : '';
    const common = { st, kid, key: i + r.t };
    switch (r.t) {
      case 'measure': return <MeasureScreen {...common} />;
      case 'scan': return <ScanScreen {...common} />;
      case 'seat': return <SeatScreen {...common} />;
      case 'kid': return <KidScreen {...common} />;
      default: return <SettingsScreen st={st} key={i + r.t} />;
    }
  };

  return (
    <div className="app">
      <div className="top"><div className="logo"><i />Size Up</div><button className="icon-b" aria-label="Settings" data-t="settings" onClick={() => push({ t: 'settings' })}><Ic n="gear" /></button></div>
      <div className="chips">
        {since === null ? <span className="chip" data-t="chip">No measurements yet</span> : due ? <span className="chip warn" data-t="chip">Time to re-measure · <b>{since}</b> days</span> : <span className="chip" data-t="chip">{since === 0 ? 'Measured today' : <>Measured <b>{since}</b> {since === 1 ? 'day' : 'days'} ago</>}</span>}
        {ties.length > 1 && <span className="chip">{ties.length} kids tied</span>}
      </div>

      {heroS && heroS.top ? (
        <AnimatePresence mode="wait" initial={false}><Hero key={heroS.kid.id} s={heroS} i={heroS.top} today={today} many={ties.length > 1} onOpen={() => push({ t: 'kid', kid: heroS.kid.id })} /></AnimatePresence>
      ) : (
        <div className="card empty" data-t="hero"><h3>{st.kids.length ? 'Add a measurement' : 'Add a kid'}</h3><p>{st.kids.length ? 'One height and weight is enough to start.' : 'Then measure to see who needs the next size first.'}</p></div>
      )}

      <button className="btn primary" data-t="primary" onClick={() => (st.kids.length ? openSheet() : push({ t: 'settings' }))}><Ic n="ruler" />{st.kids.length ? 'Measure or scan' : 'Add a kid'}</button>

      <div className="kids">{sums.map(s => <KidCard key={s.kid.id} s={s} onOpen={() => push({ t: 'kid', kid: s.kid.id })} onSeat={() => push({ t: 'seat', kid: s.kid.id })} />)}</div>
      <p className="foot">Sizes are estimates from growth charts, not a fitting. Everything stays on this phone.</p>

      <AnimatePresence>{stack.map((r, i) => render(r, i))}</AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div className="sheet-bd" key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)} />
            <motion.div className="sheet" key="sh" data-t="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }}>
              <div className="grab" /><h3>Who and what?</h3>
              <div className="kidpick">{st.kids.map(k => <button key={k.id} className={pick === k.id ? 'on' : ''} data-t={`pick-${k.name}`} onClick={() => setPick(k.id)}>{k.name}</button>)}</div>
              <div className="opts">
                <button className="opt" data-t="opt-measure" onClick={() => go('measure')}><Ic n="ruler" /><div><b>Measure</b><span>Height and weight</span></div></button>
                <button className="opt" data-t="opt-scan" onClick={() => go('scan')}><Ic n="foot" /><div><b>Scan foot</b><span>Photo of a bare foot on letter paper</span></div></button>
                <button className="opt" data-t="opt-seat" onClick={() => go('seat')}><Ic n="seat" /><div><b>Car seat</b><span>Limits, expiry and when to swap</span></div></button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>{msg && <motion.div className="toast" key={msg} role="status" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>{msg}</motion.div>}</AnimatePresence>
    </div>
  );
}

