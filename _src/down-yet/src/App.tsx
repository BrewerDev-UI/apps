import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BY_ID, DEFAULT_STACK, SERVICES } from './services';
import { COLOR, LEVEL_WORD, ago, fetchHist, fetchStatus, fmtMs, pool, rank, sampleOutage, testConn, verdict, whatsWrong, type Conn, type Hist, type Level, type Status } from './api';
import { askNotify, chime, haptic, isIOS, isStandalone, keepAwake, notify, notifyState, restAudio, unlockAudio } from './phone';
import { shareCard } from './share';
import { Ago, Badge, Countdown, Icon, Logo, Orb, Screen, Strip, inkOn } from './ui';
import Detail from './Detail';

const KEY = 'down-yet-v1';
type Saved = { stack: string[]; watch: string[]; focus: string | null; hist: Record<string, Hist>; st: Record<string, Status>; at: number };
function load(): Saved {
  const d: Saved = { stack: DEFAULT_STACK, watch: [], focus: null, hist: {}, st: {}, at: 0 };
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Array.isArray(j.stack)) return { ...d, ...j, stack: j.stack.filter((id: string) => BY_ID[id]), watch: (j.watch || []).filter((id: string) => id === 'me' || BY_ID[id]) }; } catch { /* first run */ }
  return d;
}
const isBad = (l?: Level) => l === 'down' || l === 'slow';
const YOU_DOWN = ['Check that Airplane Mode is off.', 'Turn Wi-Fi off and back on.', 'Switch Wi-Fi off and try cellular data.', 'Unplug the router for 30 seconds, then plug it back in.', 'Still nothing? Your internet provider may be down. Check their outage page on cellular.'];
const YOU_SLOW = ['Move closer to the router.', 'Switch between Wi-Fi and cellular and check again.', 'Pause big downloads and streams on other devices.', 'Unplug the router for 30 seconds, then plug it back in.'];

export default function App() {
  const init = useMemo(load, []);
  const [stack, setStack] = useState(init.stack);
  const [watch, setWatch] = useState(init.watch);
  const [focus, setFocus] = useState(init.focus);
  const [hist, setHist] = useState(init.hist);
  const [st, setSt] = useState(init.st);
  const [conn, setConn] = useState<Conn | null>(null);
  const [at, setAt] = useState(init.at);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'verdict' | 'stack'>('verdict');
  const [open, setOpen] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [edit, setEdit] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; up: boolean } | null>(null);
  const [nextPoll, setNextPoll] = useState(0);
  const ref = useRef({ stack, watch, st, conn, busy: false }); Object.assign(ref.current, { stack, watch, st, conn });
  const loading = useRef(new Set<string>());

  const ping = useCallback((title: string, body: string, up: boolean) => {
    chime(up); haptic(up ? [90, 60, 90, 60, 220] : [320, 120, 320]); notify(title, body);
    setToast({ title, body, up }); setTimeout(() => setToast(t => t && t.title === title ? null : t), 7000);
  }, []);

  const sweep = useCallback(async (only?: string[]) => {
    if (!only) { if (ref.current.busy) return; ref.current.busy = true; setBusy(true); }
    const before = ref.current.conn; const c = await testConn(); setConn(c);
    if (ref.current.watch.includes('me') && before?.level === 'down' && c.level !== 'down') { ping('You are back online', 'Your connection is working again.', true); setWatch(w => w.filter(x => x !== 'me')); }
    if (c.level !== 'down') {
      const ids = (only ?? ref.current.stack).filter(id => BY_ID[id]?.host);
      await pool(ids, 6, async id => {
        const was = ref.current.st[id]; let s: Status;
        try { s = await fetchStatus(BY_ID[id]); } catch { if (was) return; s = { level: 'unknown', desc: 'Status page did not answer', incidents: [], at: Date.now() }; }
        if (ref.current.watch.includes(id) && was && s.level !== 'unknown') {
          if (isBad(was.level) && !isBad(s.level)) { ping(`${BY_ID[id].name} is back`, 'Its status page says things are working again.', true); setWatch(w => w.filter(x => x !== id)); }
          else if (!isBad(was.level) && isBad(s.level)) ping(`${BY_ID[id].name} is having trouble`, whatsWrong(id, s), false);
        }
        setSt(p => ({ ...p, [id]: s }));
      });
    }
    setAt(Date.now());
    if (!only) { ref.current.busy = false; setBusy(false); }
  }, [ping]);

  // first check, then keep fresh while the app is on screen
  useEffect(() => {
    sweep();
    const i = setInterval(() => { if (document.visibilityState === 'visible') sweep(); }, 120000);
    const again = () => sweep(); const vis = () => { if (document.visibilityState === 'visible') sweep(); };
    window.addEventListener('online', again); window.addEventListener('offline', again); document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(i); window.removeEventListener('online', again); window.removeEventListener('offline', again); document.removeEventListener('visibilitychange', vis); };
  }, [sweep]);

  // "ping me": check watched services every 60 sec
  const watching = watch.length > 0;
  useEffect(() => {
    if (!watching) { keepAwake(false); restAudio(); return; }
    keepAwake(true); setNextPoll(Date.now() + 60000);
    const i = setInterval(() => { setNextPoll(Date.now() + 60000); sweep(ref.current.watch.filter(x => x !== 'me')); }, 60000);
    return () => clearInterval(i);
  }, [watching, sweep]);

  // 7-day history, fetched gently and kept for 6 hours
  useEffect(() => {
    if (!at || conn?.level === 'down') return;
    const need = stack.filter(id => BY_ID[id]?.host && !loading.current.has(id) && (!hist[id] || Date.now() - hist[id].at > 6 * 36e5));
    need.forEach(id => loading.current.add(id));
    pool(need, 2, async id => { try { const h = await fetchHist(BY_ID[id]); setHist(p => ({ ...p, [id]: h })); } catch { /* try next time */ } finally { loading.current.delete(id); } });
  }, [at, stack]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ stack, watch, focus, hist, st, at } satisfies Saved)); } catch { /* storage full or blocked */ } }, [stack, watch, focus, hist, st, at]);

  const demoId = stack.includes('discord') ? 'discord' : stack.find(id => BY_ID[id].host) ?? 'discord';
  const sample = useMemo(sampleOutage, [demo]);
  const view = demo ? { ...st, [demoId]: sample } : st;
  const v = verdict(demo && conn?.level === 'down' ? { ...conn, level: 'good' } : conn, view, stack, focus);
  const sorted = useMemo(() => [...stack].sort((a, b) => rank(BY_ID[b].host ? view[b]?.level ?? 'good' : 'link') - rank(BY_ID[a].host ? view[a]?.level ?? 'good' : 'link')), [stack, view]);
  const counts = { bad: stack.filter(id => isBad(view[id]?.level)).length, fine: stack.filter(id => view[id]?.level === 'good').length, link: stack.filter(id => !BY_ID[id].host).length };

  const toggleWatch = (id: string) => {
    unlockAudio(); haptic(14);
    if (watch.includes(id)) { setWatch(w => w.filter(x => x !== id)); return; }
    askNotify(); setWatch(w => [...w, id]);
  };
  const endDemo = () => {
    setDemo(false);
    if (watch.includes(demoId)) { ping(`${BY_ID[demoId].name} is back`, 'Sample over. This is what a real ping looks and sounds like.', true); setWatch(w => w.filter(x => x !== demoId)); }
  };
  const recheck = () => { unlockAudio(); haptic(10); sweep(); };
  const steps = conn?.level === 'down' ? YOU_DOWN : conn?.level === 'slow' && v.you ? YOU_SLOW : null;
  const names = watch.map(id => id === 'me' ? 'your connection' : BY_ID[id].name);

  return (
    <div className="app">
      <Screen active={tab === 'verdict'} onRefresh={recheck} className="verdict">
        <header className="top">
          <div className="brand"><span className="brand-dot" style={{ background: COLOR[v.tone] }} />Down Yet</div>
          <button className="chip tap" onClick={() => { haptic(10); shareCard(v, `Checked ${new Date(at || Date.now()).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`); }} aria-label="Share this verdict">{Icon.share(18)}Share</button>
        </header>

        <Orb tone={v.tone} busy={busy} onTap={recheck}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={v.icon + (v.logo ?? '')} className="orb-icon" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
              {v.icon === 'logo' && v.logo ? <Logo id={v.logo} size={92} color="#fff" /> : v.icon === 'wifi' ? Icon.wifiOff(96) : v.icon === 'check' ? Icon.check(104) : <span className="dots"><i /><i /><i /></span>}
            </motion.span>
          </AnimatePresence>
        </Orb>

        <div className="say">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={v.title + v.line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <h1>{v.title}</h1><p>{v.line}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="chips">
          <span className="chip"><i className="dot" style={{ background: COLOR[busy ? 'check' : v.tone] }} />{busy ? 'Checking now' : <>Checked <Ago t={at} /></>}</span>
          <span className="chip">{conn?.level === 'down' ? Icon.wifiOff(16) : Icon.wifi(16)}<span className="num">{!conn ? 'Testing' : conn.level === 'down' ? 'No connection' : `${conn.level === 'good' ? 'Good' : 'Slow'} · ${fmtMs(conn.ms)}`}</span>
            <span className="trio">{[0, 1, 2].map(i => <i key={i} style={{ background: conn && i < conn.ok ? COLOR.good : conn ? COLOR.down : COLOR.check }} />)}</span></span>
        </div>

        {demo && <button className="banner" onClick={endDemo}><b>Sample outage.</b> Not real. Tap to end it{watch.includes(demoId) ? ' and hear the ping' : ''}.</button>}

        {steps && <section className="card fix">
          <h3>{conn?.level === 'down' ? 'Try this, in order' : 'To speed things up'}</h3>
          <ol>{steps.map(s => <li key={s}>{s}</li>)}</ol>
          {conn?.level === 'down' && <button className={`big-btn${watch.includes('me') ? ' on' : ''}`} onClick={() => toggleWatch('me')}>{Icon.bell()}<span>{watch.includes('me') ? 'Watching. Tap to stop' : "Ping me when I'm back online"}</span></button>}
        </section>}

        {v.trouble.length > 0 && <section>
          <h3>Having trouble now</h3>
          {v.trouble.map(id => { const x = view[id], inc = x.incidents[0]; return (
            <div className="card t-card" key={id}>
              <button className="t-main" onClick={() => setOpen(id)}>
                <Badge id={id} size={46} />
                <span className="t-text"><b>{BY_ID[id].name}<i className="dot" style={{ background: COLOR[x.level] }} /></b>
                  <span>{inc ? inc.name : x.desc}</span>
                  <em className="num">{inc ? `Started ${ago(Date.parse(inc.created))}` : LEVEL_WORD[x.level]}{hist[id]?.typical ? ` · usually fixed in about ${fmtDur(hist[id].typical!)}` : ''}</em></span>
              </button>
              <button className={`pill-btn${watch.includes(id) ? ' on' : ''}`} onClick={() => toggleWatch(id)}>{Icon.bell(17)}{watch.includes(id) ? 'Watching' : "Ping me when it's back"}</button>
            </div>); })}
        </section>}

        {watching && <section className="card watch">
          <div className="w-top"><span className="pulse" /><div><b>Watching {names.length > 2 ? `${names.length} things` : names.join(' and ')}</b><span>Next check in <Countdown to={nextPoll} />. Keep Down Yet open.</span></div></div>
          <div className="w-btns">
            <button onClick={() => { unlockAudio(); ping('Test ping', 'This is how Down Yet will get your attention.', true); }}>Test ping</button>
            <button onClick={() => { haptic(10); setWatch([]); }}>Stop watching</button>
          </div>
          <p className="hint">{notifyState() === 'granted' ? 'Notifications are on.' : isIOS() && !isStandalone() ? 'For notifications on iPhone, add Down Yet to your Home Screen (Share, then Add to Home Screen).' : notifyState() === 'denied' ? 'Notifications are blocked, so you will get the sound and buzz only.' : 'Sound and buzz are ready.'} The screen stays awake while watching.</p>
        </section>}

        <section>
          <h3>Is one thing down?</h3>
          <div className="ask">
            {stack.map(id => <button key={id} className={focus === id ? 'on' : ''} onClick={() => { haptic(8); setFocus(f => f === id ? null : id); }} aria-label={BY_ID[id].name}><Badge id={id} size={50} /><span>{BY_ID[id].name}</span></button>)}
          </div>
        </section>

        <footer className="foot">
          {!demo && <button onClick={() => { unlockAudio(); haptic(10); setFocus(null); setDemo(true); }}>See a sample outage</button>}
          <p>Reads each company's official status page and times three big networks from your phone. Tap the orb to check again.</p>
        </footer>
      </Screen>

      <Screen active={tab === 'stack'} onRefresh={recheck} className="stack">
        <header className="top">
          <h1 className="h-big">My stack</h1>
          <button className="chip tap" onClick={() => { haptic(10); setEdit(true); }}>Edit</button>
        </header>
        <div className="chips left">
          <span className="chip"><i className="dot" style={{ background: COLOR.good }} /><span className="num">{counts.fine} working</span></span>
          {counts.bad > 0 && <span className="chip"><i className="dot" style={{ background: COLOR.down }} /><span className="num">{counts.bad} trouble</span></span>}
          {counts.link > 0 && <span className="chip"><i className="dot" style={{ background: COLOR.link }} /><span className="num">{counts.link} link only</span></span>}
        </div>
        <motion.div className="grid" layout>
          {sorted.map(id => { const s = BY_ID[id], lv: Level = s.host ? view[id]?.level ?? 'unknown' : 'link', fg = inkOn(s.hex); return (
            <motion.button layout="position" transition={{ type: 'spring', stiffness: 300, damping: 30 }} key={id} className={`tile${isBad(lv) ? ' bad' : ''}`} style={{ background: `#${s.hex}`, color: fg, ['--ring' as any]: COLOR[lv] }} onClick={() => { haptic(8); setOpen(id); }}>
              <i className="t-dot" style={{ background: COLOR[lv] }} />
              <Logo id={id} size={34} color={fg} />
              <b>{s.name}</b>
              {s.host ? <Strip days={hist[id]?.days} onDark={fg === '#fff'} /> : <em>Open page</em>}
              {watch.includes(id) && <span className="t-bell">{Icon.bell(13)}</span>}
            </motion.button>); })}
          <button className="tile add" onClick={() => setEdit(true)}><span>+</span><b>Add</b></button>
        </motion.div>
        <p className="legend">Bars show the last 7 days, today on the right. Checked <Ago t={at} />.</p>
      </Screen>

      <nav className="tabs">
        {(['verdict', 'stack'] as const).map(t => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => { haptic(8); setTab(t); }}>
            {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span className="tab-in" style={t === 'verdict' ? { color: tab === t ? COLOR[v.tone] : undefined } : undefined}>{t === 'verdict' ? Icon.orb() : Icon.grid()}</span>
            <span className="tab-in">{t === 'verdict' ? 'Verdict' : 'My stack'}</span>
            {t === 'stack' && counts.bad > 0 && <i className="tab-badge num">{counts.bad}</i>}
          </button>))}
      </nav>

      <AnimatePresence>
        {open && <motion.div key="detail" className="over" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
          <Detail id={open} status={view[open]} hist={hist[open]} watching={watch.includes(open)} sample={demo && open === demoId} onWatch={() => toggleWatch(open)} onClose={() => setOpen(null)}
            onRemove={() => { setStack(s => s.filter(x => x !== open)); setWatch(w => w.filter(x => x !== open)); if (focus === open) setFocus(null); setOpen(null); }} />
        </motion.div>}
        {edit && <motion.div key="shade" className="shade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEdit(false)} />}
        {edit && <motion.div key="sheet" className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 36 }}>
          <div className="sheet-top"><h2>Edit my stack</h2><button className="chip tap" onClick={() => setEdit(false)}>Done</button></div>
          <div className="sheet-list">
            {SERVICES.map(s => { const on = stack.includes(s.id); return (
              <button key={s.id} className="s-row" onClick={() => { haptic(8); setStack(p => on ? p.filter(x => x !== s.id) : [...p, s.id]); if (on) setWatch(w => w.filter(x => x !== s.id)); }}>
                <Badge id={s.id} size={40} /><span><b>{s.name}</b><em>{s.kind}{s.host ? '' : ' · link only'}</em></span><i className={`tick${on ? ' on' : ''}`}>{on && Icon.check(16)}</i>
              </button>); })}
          </div>
        </motion.div>}
        {toast && <motion.button key="toast" className="toast" style={{ ['--c' as any]: toast.up ? COLOR.good : COLOR.down }} initial={{ y: -120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -120, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} onClick={() => setToast(null)}>
          <span className="toast-orb" /><span><b>{toast.title}</b><em>{toast.body}</em></span>
        </motion.button>}
      </AnimatePresence>
    </div>
  );
}

function fmtDur(m: number) { return m < 60 ? `${Math.max(1, Math.round(m))} min` : m < 1440 ? `${Math.round(m / 6) / 10} hr` : `${Math.round(m / 144) / 10} days`; }
