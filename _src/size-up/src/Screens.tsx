import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { idb, uid, DEFAULT_SETTINGS, type Hand, type Kid, type SeatType, type Seat } from './data';
import { BANDS, MAX_AGE, addDays, ageMo, iso, pd, valOf } from './growth/lms';
import { SEAT_NAME, SEAT_YEARS, clothesInfo, fmtDate, makeProj, planHand, seatDates, seatInfo, summarize, toneOf, verdict, type Info } from './model';
import { CLOTHES, HAND_SHOES, HAND_SIZES, euOf, picks, sizeFor, usLabel } from './sizes';
import { lengthMm, loadCanvas, scanFoot, type Pt } from './cv/foot';
import { NHTSA, parseLabel, readLabel } from './seat';
import { downloadIcs } from './share';
import { chime, click, haptic } from './phone';
import { clearSample, seedSample } from './seed';
import { fmtLen, fmtWt, lenUnit, nudge, wtUnit, type Store } from './store';
import { Ic, Num, Page, Seg, Stepper, Wordmark } from './ui';

interface P { st: Store; kid: string }
const TONE_COL = { now: '#B8613F', soon: '#C99A2E', good: '#7F8B3E' } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const noonNow = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };

// ---------------------------------------------------------------- measure
export function MeasureScreen({ st, kid }: P) {
  const k = st.kids.find(x => x.id === kid)!;
  const mine = st.meas.filter(m => m.kid === kid).sort((a, b) => a.date.localeCompare(b.date)), last = mine[mine.length - 1];
  const age = ageMo(k.birth, st.today);
  const [h, setH] = useState(last?.h ?? +valOf(k.sex, 'h', age, 0).toFixed(1));
  const [w, setW] = useState(last?.w ?? +valOf(k.sex, 'w', age, 0).toFixed(2));
  const lu = lenUnit(st.set), wu = wtUnit(st.set), todayIso = iso(st.today);
  const hypo = [...st.meas.filter(m => !(m.kid === kid && m.date === todayIso)), { id: 'draft', kid, date: todayIso, h, w }];
  const s = summarize(k, { meas: hypo, scans: st.scans, seats: st.seats }, st.today), top = s.top, v = top ? verdict(s, top, st.today) : null;
  const save = async () => {
    const same = mine.find(m => m.date === todayIso);
    await idb.put('meas', { id: same?.id ?? uid(), kid, date: todayIso, h: +h.toFixed(1), w: +w.toFixed(2) });
    await st.reload(); if (st.set.sound) chime(true); haptic([10, 40, 10]); st.toast('Saved'); st.pop();
  };
  return (
    <Page title={`Measure ${k.name}`} sub={last ? `Last: ${fmtLen(lu, last.h)}, ${fmtWt(wu, last.w)} on ${fmtDate(pd(last.date), st.today)}` : 'First measurement'} onBack={st.pop}>
      <Stepper label="Height" unit={lu.name} value={h} show={lu.show} d={lu.d} testId="h" onChange={d => setH(x => nudge(lu, x, d, 30, 160))} />
      <Stepper label="Weight" unit={wu.name} value={w} show={wu.show} d={wu.d} testId="w" onChange={d => setW(x => nudge(wu, x, d, 2, 70))} />
      <div className={`preview ${top ? `t-${top.tone}` : ''}`} data-t="preview">
        <span className="lab">If you save this</span>
        <p>{v ? `${v.pre} ${v.date}`.trim() : 'Saving gives a first estimate.'}</p>
      </div>
      <button className="btn primary" data-t="save" onClick={save} style={{ margin: 0 }}>Save measurement</button>
    </Page>
  );
}

// ---------------------------------------------------------------- foot scan
type ScanPts = { c: Pt[]; heel: Pt; toe: Pt };
export function ScanScreen({ st, kid }: P) {
  const k = st.kids.find(x => x.id === kid)!;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null), [img, setImg] = useState('');
  const [pts, setPts] = useState<ScanPts | null>(null), [meta, setMeta] = useState<{ ok: boolean; method: string }>({ ok: false, method: '' });
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [kk, setKk] = useState(1);
  const svg = useRef<SVGSVGElement>(null), drag = useRef<string | null>(null), file = useRef<HTMLInputElement>(null);
  const sound = st.set.sound;

  const run = useCallback(async (src: Blob | HTMLCanvasElement) => {
    setBusy(true); setStatus('Looking for the paper and the foot...');
    const c = await loadCanvas(src, 1024); setCanvas(c); setImg(c.toDataURL('image/jpeg', 0.88));
    let r = null; try { r = await scanFoot(c); } catch { r = null; }
    const W = c.width, H = c.height;
    const dflt: ScanPts = { c: [{ x: W * 0.15, y: H * 0.08 }, { x: W * 0.85, y: H * 0.08 }, { x: W * 0.85, y: H * 0.92 }, { x: W * 0.15, y: H * 0.92 }], heel: { x: W * 0.5, y: H * 0.75 }, toe: { x: W * 0.5, y: H * 0.3 } };
    if (r && r.ok) { setPts({ c: r.corners, heel: r.heel, toe: r.toe }); setMeta({ ok: true, method: r.method }); setStatus('Locked on. Nudge the dots if anything looks off.'); if (sound) click(); haptic([12, 30, 12]); }
    else { setPts(r ? { ...dflt, c: r.corners } : dflt); setMeta({ ok: false, method: 'manual' }); setStatus(r ? 'Could not find the foot. Drag the heel and toe dots into place.' : 'Could not find the paper. Drag the dots onto the corners.'); }
    setBusy(false);
  }, [sound]);

  useEffect(() => { const su = (window as any).__su, f = su?.feed; if (f) { su.feed = null; void run(f); } }, [run]);
  useLayoutEffect(() => {
    const f = () => { if (svg.current && canvas) setKk(canvas.width / Math.max(1, svg.current.clientWidth)); };
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [canvas, img]);

  const mm = pts ? lengthMm(pts.c, pts.heel, pts.toe) : 0, cm = mm / 10, S = sizeFor(cm + 1);
  useEffect(() => { const su = (window as any).__su; if (su && pts) su.lastScan = { done: true, cm, mm, ok: meta.ok, method: meta.method, S: usLabel(S) }; }, [pts, meta, cm, mm, S]);

  const toSvg = (e: React.PointerEvent): Pt => {
    const s = svg.current!, p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(s.getScreenCTM()!.inverse());
    return { x: clamp(q.x, 0, canvas!.width), y: clamp(q.y, 0, canvas!.height) };
  };
  const down = (id: string) => (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = id; e.preventDefault(); };
  const move = (e: React.PointerEvent) => {
    const id = drag.current; if (!id || !pts) return; const q = toSvg(e);
    setPts(p => (p ? (id === 'heel' ? { ...p, heel: q } : id === 'toe' ? { ...p, toe: q } : { ...p, c: p.c.map((pt, i) => (i === +id.slice(1) ? q : pt)) }) : p));
  };
  const up = () => { if (drag.current) { drag.current = null; if (sound) click(); haptic(8); } };
  const save = async () => {
    await idb.put('scans', { id: uid(), kid, date: iso(st.today), cm: +cm.toFixed(1) });
    await st.reload(); if (sound) chime(true); haptic([10, 40, 10]); st.toast(`Saved ${cm.toFixed(1)} cm`); st.pop();
  };
  const W = canvas?.width ?? 1, H = canvas?.height ?? 1, r = 11 * kk, hr = 27 * kk;
  const handles: { id: string; p: Pt; col: string; label?: string }[] = pts ? [...pts.c.map((p, i) => ({ id: `c${i}`, p, col: '#C9C77E' })), { id: 'heel', p: pts.heel, col: '#B8613F', label: 'heel' }, { id: 'toe', p: pts.toe, col: '#E5B238', label: 'toe' }] : [];
  const valid = !!pts && cm > 8 && cm < 30;
  return (
    <Page title={`Scan ${k.name}'s foot`} sub="US letter paper only (8.5 x 11 in)" onBack={st.pop}>
      {!img && (
        <div className="card">
          <h4>Set it up</h4>
          <ol className="how">
            <li>Put a sheet of letter paper on a dark floor.</li>
            <li>Stand the bare foot on it with the heel against a short edge.</li>
            <li>Hold the phone straight overhead so the whole sheet shows.</li>
          </ol>
        </div>
      )}
      <input ref={file} type="file" accept="image/*" capture="environment" hidden data-t="scan-file" onChange={e => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = ''; }} />
      {!img && <button className="btn primary" data-t="scan-pick" style={{ margin: 0 }} onClick={() => file.current?.click()}><Ic n="camera" />Take or choose a photo</button>}
      {img && canvas && (
        <div className="scan-wrap" data-t="scan-box">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} data-t="scan-svg" onPointerMove={move} onPointerUp={up}>
            <image href={img} width={W} height={H} />
            {pts && <polygon points={pts.c.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(201,199,126,.14)" stroke="#C9C77E" strokeWidth={2.5 * kk} />}
            {pts && <line x1={pts.heel.x} y1={pts.heel.y} x2={pts.toe.x} y2={pts.toe.y} stroke="#fff" strokeWidth={2 * kk} strokeDasharray={`${6 * kk} ${5 * kk}`} />}
            {handles.map(h => (
              <g key={h.id}>
                <circle cx={h.p.x} cy={h.p.y} r={r} fill={h.col} stroke="#fff" strokeWidth={3 * kk} pointerEvents="none" />
                {h.label && <text x={h.p.x} y={h.p.y - r - 7 * kk} textAnchor="middle" fontSize={14 * kk} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,.6)" strokeWidth={3 * kk} paintOrder="stroke" pointerEvents="none">{h.label}</text>}
                <circle className="hit" data-t={`h-${h.id}`} cx={h.p.x} cy={h.p.y} r={hr} fill="transparent" onPointerDown={down(h.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
              </g>
            ))}
          </svg>
        </div>
      )}
      <div className="status" data-t="scan-status" role="status">{busy ? 'Working...' : status}</div>
      {pts && (
        <div className="card" data-t="scan-result">
          <span className="lab">Heel to toe</span>
          <div className="result"><Num v={cm} d={1} className="big" /><small>cm</small><small>({(cm / 2.54).toFixed(1)} in)</small></div>
          <p className="note" style={{ marginTop: 10 }}>US size <b data-t="scan-us">{usLabel(S)}</b> · EU <b>{euOf(S)}</b> with 1 cm of room to grow.{meta.method === 'ai' ? ' Foot found with the on-device model.' : ''}</p>
        </div>
      )}
      {pts && <button className="btn primary" data-t="scan-save" disabled={!valid} style={{ margin: 0 }} onClick={save}>Save to {k.name}</button>}
      {img && <button className="btn ghost" onClick={() => file.current?.click()}><Ic n="camera" />Try another photo</button>}
      <p className="note">Photo stays on this phone. It is only used to measure, then dropped.</p>
    </Page>
  );
}

// ---------------------------------------------------------------- car seat
const SEAT_DEF: Record<SeatType, { maxH: number; maxW: number }> = { infant: { maxH: 81, maxW: 15.9 }, convertible: { maxH: 122, maxW: 29.5 }, booster: { maxH: 145, maxW: 49.9 } };
export function SeatScreen({ st, kid }: P) {
  const k = st.kids.find(x => x.id === kid)!, ex = st.seats.find(s => s.kid === kid);
  const [type, setType] = useState<SeatType>(ex?.type ?? 'convertible');
  const [model, setModel] = useState(ex?.model ?? ''), [number, setNumber] = useState(ex?.number ?? '');
  const [made, setMade] = useState(ex?.made ?? iso(addDays(st.today, -365)));
  const [years, setYears] = useState(ex?.years ?? SEAT_YEARS.convertible);
  const [maxH, setMaxH] = useState(ex?.maxH ?? SEAT_DEF.convertible.maxH), [maxW, setMaxW] = useState(ex?.maxW ?? SEAT_DEF.convertible.maxW);
  const [status, setStatus] = useState(''), file = useRef<HTMLInputElement>(null);
  const lu = lenUnit(st.set, 1, 0.5), wu = wtUnit(st.set, 0.5, 1);
  const pick = (t: SeatType) => { setType(t); setYears(SEAT_YEARS[t]); setMaxH(SEAT_DEF[t].maxH); setMaxW(SEAT_DEF[t].maxW); };
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(made) && !isNaN(pd(made).getTime());
  const draft: Seat = { id: ex?.id ?? uid(), kid, type, model: model.trim() || SEAT_NAME[type], number: number.trim(), made, years, maxH, maxW };
  const proj = makeProj(k, st.meas), d = ok ? seatDates(draft, proj, st.today) : null, info = ok ? seatInfo(draft, proj, st.today) : null;
  const nowV = proj?.at(st.today), atNext = proj && d ? proj.at(d.next) : null;
  const read = async (f: File) => {
    setStatus('Reading the label...'); const text = await readLabel(f);
    if (!text) { setStatus('Could not read it. Type the details in below.'); return; }
    const p = parseLabel(text); if (p.model) setModel(p.model); if (p.number) setNumber(p.number); if (p.made) setMade(p.made); if (p.years && p.years >= 3 && p.years <= 15) setYears(p.years);
    if (p.maxHin && p.maxHin >= 25 && p.maxHin <= 70) setMaxH(+(p.maxHin * 2.54).toFixed(1)); if (p.maxWlb && p.maxWlb >= 8 && p.maxWlb <= 150) setMaxW(+(p.maxWlb / 2.20462).toFixed(1));
    setStatus('Filled in what I could read. Check each box.');
  };
  const save = async () => { await idb.put('seats', draft); await st.reload(); haptic([10, 40, 10]); st.toast('Seat saved'); st.pop(); };
  const bar = (label: string, cur: number, lim: number, proj2: number | null, fmt: (v: number) => string, when: Date | null, id: string, tone: string) => (
    <div className="lim" data-t={id} style={{ ['--tone' as any]: tone }}>
      <div className="lim-t"><span>{label}</span><span className="num">{fmt(cur)} of {fmt(lim)}</span></div>
      <div className="bar"><i className="proj-f" style={{ width: `${clamp((proj2 ?? cur) / lim, 0.02, 1) * 100}%` }} /><i className="now-f" style={{ width: `${clamp(cur / lim, 0.02, 1) * 100}%` }} /></div>
      <p className="note">{when ? `Reaches ${fmt(lim)} around ${fmtDate(when, st.today)}.` : 'Fits past age 6.'}</p>
    </div>
  );
  const tone = info ? TONE_COL[info.tone] : '#7F8B3E';
  return (
    <Page title={`${k.name}'s car seat`} sub="Manual entry is the sure way. A label photo can fill it in." onBack={st.pop}>
      <div className="card">
        <Seg id="seat-type" value={type} onChange={pick} opts={[['infant', 'Infant'], ['convertible', 'Convertible'], ['booster', 'Booster']]} />
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => file.current?.click()}><Ic n="camera" />Read the label photo</button>
        <div className="status" style={{ marginTop: 8 }} role="status">{status}</div>
        <div className="field"><span className="lab">Model</span><input className="in" data-t="seat-model" value={model} placeholder={SEAT_NAME[type]} maxLength={40} onChange={e => setModel(e.target.value)} /></div>
        <div className="two">
          <div className="field"><span className="lab">Model number</span><input className="in" data-t="seat-number" value={number} maxLength={24} onChange={e => setNumber(e.target.value)} /></div>
          <div className="field"><span className="lab">Made on</span><input className="in" type="date" data-t="seat-made" value={made} onChange={e => setMade(e.target.value)} /></div>
        </div>
      </div>
      <Stepper label="Seat lasts" unit="years" value={years} show={v => v} d={0} testId="years" onChange={dir => setYears(y => clamp(y + dir, 1, 15))} />
      <Stepper label="Max height" unit={lu.name} value={maxH} show={lu.show} d={lu.d === 2 ? 1 : lu.d} testId="maxh" onChange={dir => setMaxH(x => nudge(lu, x, dir, 40, 200))} />
      <Stepper label="Max weight" unit={wu.name} value={maxW} show={wu.show} d={1} testId="maxw" onChange={dir => setMaxW(x => nudge(wu, x, dir, 3, 120))} />
      {d && info && nowV && (
        <div className="card" data-t="seat-out">
          <h4>Limits</h4>
          {bar('Height', nowV.h, maxH, atNext?.h ?? null, v => fmtLen(lu, v), d.hd, 'seat-bar-h', TONE_COL[toneOf(d.hd ? Math.ceil((d.hd.getTime() - st.today.getTime()) / 864e5) : null)])}
          {bar('Weight', nowV.w, maxW, atNext?.w ?? null, v => fmtWt(wu, v), d.wd, 'seat-bar-w', TONE_COL[toneOf(d.wd ? Math.ceil((d.wd.getTime() - st.today.getTime()) / 864e5) : null)])}
          <div className="lim"><div className="lim-t"><span>Expiry</span></div><p className="note" data-t="seat-exp" style={{ fontSize: 15, color: 'var(--ink)' }}>Expires {fmtDate(d.exp, st.today)} ({years} years after it was made)</p></div>
        </div>
      )}
      {d && info && (
        <div className={`preview t-${info.tone}`} data-t="seat-next" style={{ ['--tone' as any]: tone }}>
          <span className="lab">Next seat by</span>
          <p>{fmtDate(d.next, st.today)}</p>
          <small className="note" style={{ display: "block", marginTop: 6 }}>First of the height limit, the weight limit and the expiry: this seat {d.reason}.</small>
        </div>
      )}
      <a className="link-b" data-t="nhtsa" href={NHTSA} target="_blank" rel="noopener noreferrer"><Ic n="ext" />Check on NHTSA</a>
      <p className="note">Opens the official recall search. Pick Car Seats, then search by brand and model number.</p>
      <button className="btn primary" data-t="seat-save" disabled={!ok} style={{ margin: 0 }} onClick={save}>Save seat</button>
    </Page>
  );
}

// ---------------------------------------------------------------- growth chart
function Growth({ k, st }: { k: Kid; st: Store }) {
  const [kind, setKind] = useState<'h' | 'w'>('h');
  const p = makeProj(k, st.meas), lu = lenUnit(st.set), wu = wtUnit(st.set), u = kind === 'h' ? lu : wu;
  const cur = ageMo(k.birth, st.today), x1 = Math.min(MAX_AGE, cur + 24), x0 = Math.max(0, x1 - 40);
  const W = 340, H = 210, L = 38, R = 30, T = 12, B = 26, n = 48;
  const ages = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  const band = (z: number) => ages.map(a => u.show(valOf(k.sex, kind, a, z)));
  const lines = BANDS.map(([name, z]) => ({ name, z, v: band(z) }));
  const mine = st.meas.filter(m => m.kid === k.id).sort((a, b) => a.date.localeCompare(b.date));
  const pv = mine.map(m => ({ a: ageMo(k.birth, m.date), v: u.show(kind === 'h' ? m.h : m.w) })).filter(q => q.a >= x0 - 0.5);
  const all = [...lines[0].v, ...lines[4].v, ...pv.map(q => q.v)], lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.06;
  const X = (a: number) => L + ((a - x0) / (x1 - x0)) * (W - L - R), Y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const path = (v: number[]) => v.map((y, i) => `${i ? 'L' : 'M'}${X(ages[i]).toFixed(1)},${Y(y).toFixed(1)}`).join('');
  const fill = path(lines[1].v) + [...lines[3].v].map((y, i) => [y, i] as const).reverse().map(([y, i]) => `L${X(ages[i]).toFixed(1)},${Y(y).toFixed(1)}`).join('') + 'Z';
  const z = p ? (kind === 'h' ? p.zh : p.zw) : 0, lastM = mine[mine.length - 1];
  const projPts = p && lastM ? ages.filter(a => a >= ageMo(k.birth, lastM.date)).map(a => `${X(a).toFixed(1)},${Y(u.show(valOf(k.sex, kind, a, z))).toFixed(1)}`) : [];
  const ticks: number[] = []; for (let m = Math.ceil(x0 / 6) * 6; m <= x1; m += 6) ticks.push(m);
  const yt = [0, 1, 2].map(i => lo + ((hi - lo) * i) / 2);
  return (
    <div className="card" data-t="growth">
      <h4>Growth</h4>
      <Seg id="chart-kind" value={kind} onChange={setKind} opts={[['h', 'Height'], ['w', 'Weight']]} />
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Growth curve" style={{ marginTop: 10 }}>
        <path d={fill} fill="var(--accent)" opacity=".28" />
        {lines.map(l => <path key={l.name} d={path(l.v)} fill="none" stroke={l.name === 'P50' ? 'var(--ink2)' : 'var(--ink3)'} strokeWidth={l.name === 'P50' ? 1.8 : 1} opacity={l.name === 'P50' ? 1 : 0.7} />)}
        {lines.map(l => <text key={l.name} x={W - R + 4} y={Y(l.v[n]) + 3}>{l.name}</text>)}
        {ticks.map(m => <text key={m} x={X(m)} y={H - 8} textAnchor="middle">{m < 24 ? `${m}m` : `${+(m / 12).toFixed(1)}y`}</text>)}
        {yt.map((v, i) => <text key={i} x={L - 5} y={Y(v) + 3} textAnchor="end">{v.toFixed(kind === 'h' ? 0 : 1)}</text>)}
        <line x1={X(cur)} x2={X(cur)} y1={T} y2={H - B} stroke="var(--ink3)" strokeDasharray="3 4" opacity=".7" />
        {projPts.length > 1 && <polyline points={projPts.join(' ')} fill="none" stroke="var(--now)" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" data-t="proj" />}
        {pv.length > 1 && <polyline points={pv.map(q => `${X(q.a).toFixed(1)},${Y(q.v).toFixed(1)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2" />}
        {pv.map((q, i) => <circle key={i} cx={X(q.a)} cy={Y(q.v)} r={i === pv.length - 1 ? 5.5 : 4} fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.6" />)}
      </svg>
      <p className="note">Lines are the 3rd, 15th, 50th, 85th and 97th percentiles (WHO to age 2, CDC after). Dashed is where {k.name} heads if the curve holds. Values in {u.name}.</p>
    </div>
  );
}

// ---------------------------------------------------------------- kid detail
export function KidScreen({ st, kid }: P) {
  const k = st.kids.find(x => x.id === kid); if (!k) return null;
  const s = st.sums.find(x => x.kid.id === kid)!, p = s.p;
  const [cat, setCat] = useState<'clothes' | 'shoes'>('clothes'), [size, setSize] = useState('2T'), [qty, setQty] = useState(1);
  const mine = st.hands.filter(h => h.kid === kid), plans = mine.map(h => planHand(h, st.sums, st.today)).filter(Boolean) as NonNullable<ReturnType<typeof planHand>>[];
  const incoming = st.hands.filter(h => h.kid !== kid).map(h => planHand(h, st.sums, st.today)).filter(x => x && x.to?.kid.id === kid) as NonNullable<ReturnType<typeof planHand>>[];
  const brand = p ? CLOTHES.map(b => ({ b, i: clothesInfo(b, p, st.today) })) : [];
  const sizes: Record<string, string> = {}; for (const x of brand) sizes[x.b.id === 'oldnavy' ? 'oldnavy' : x.b.id === 'catjack' ? 'catjack' : x.b.id] = x.i.next ?? x.i.label;
  const shoeNext = s.shoes ? s.shoes.next ?? s.shoes.label : '';
  const shop = p ? [...picks('clothes', sizes, ''), ...picks('shoes', sizes, shoeNext)] : [];
  const add = async () => { await idb.put('hands', { id: uid(), kid, cat, size, qty } as Hand); await st.reload(); haptic(10); st.toast('Added'); };
  const del = async (id: string) => { await idb.del('hands', id); await st.reload(); };
  const line = (i: Info) => {
    const v = verdict(s, i, st.today); return `${v.pre} ${v.date}`.trim();
  };
  const planText = (pl: NonNullable<ReturnType<typeof planHand>>, owner: boolean) => {
    const skip = pl.skipped.length ? `Too small for ${pl.skipped.map(x => x.kid.name).join(' and ')}. ` : '';
    if (!pl.to) return owner ? (skip ? `${skip}No one else to hand it to.` : 'No younger kid to hand it to yet.') : '';
    const bits = skip + (pl.fitsNow ? `Fits ${pl.to.kid.name} now` : pl.fitsFrom ? `Fits ${pl.to.kid.name} from ${fmtDate(pl.fitsFrom, st.today)}` : `Does not fit ${pl.to.kid.name} before age 6`);
    return bits + (pl.outAt ? `, outgrown by ${fmtDate(pl.outAt, st.today)}` : '') + '.';
  };
  return (
    <Page title={k.name} sub={`${s.age} old`} onBack={st.pop}>
      <div className="two">
        <button className="btn ghost sm" style={{ width: '100%' }} data-t="k-measure" onClick={() => st.push({ t: 'measure', kid })}><Ic n="ruler" />Measure</button>
        <button className="btn ghost sm" style={{ width: '100%' }} data-t="k-scan" onClick={() => st.push({ t: 'scan', kid })}><Ic n="foot" />Scan foot</button>
      </div>
      <button className="btn ghost sm" style={{ width: '100%' }} data-t="k-seat" onClick={() => st.push({ t: 'seat', kid })}><Ic n="seat" />{s.seat ? 'Car seat' : 'Add car seat'}</button>
      {s.items.length > 0 && (
        <div className="card" data-t="items">
          <h4>Next sizes</h4>
          {s.items.map(i => (
            <div key={i.cat} className={`t-${i.tone}`} style={{ marginBottom: 14 }}>
              <div className="irow"><b>{i.cat === 'seat' ? line(i) : i.cat === 'clothes' ? `${i.label} clothes${i.next ? ` → ${i.next}` : ''}` : `Shoes size ${i.label}${i.next ? ` → ${i.next}` : ''}`}</b><span>{i.days === null ? "Good" : i.days === 0 ? "Now" : i.days > 400 ? `${(i.days / 365).toFixed(1)}y` : `${i.days}d`}</span></div>
              <div className="prog"><i style={{ width: `${i.progress * 100}%` }} /></div>
              {i.cat !== 'seat' && <p className="note" style={{ marginTop: 6 }}>{line(i)}{i.est ? ' (shoe size estimated from height; scan a foot to firm it up)' : ''}</p>}
            </div>
          ))}
        </div>
      )}
      <Growth k={k} st={st} />
      {brand.length > 0 && (
        <div className="card" data-t="brands">
          <h4>Size-out dates by brand</h4>
          {brand.map(({ b, i }) => (
            <div className="brand-row" key={b.id}><Wordmark b={{ brand: b.name, color: b.color, ink: b.ink, family: b.family }} /><div className="r">{i.label}{i.next ? ` → ${i.next}` : ''}<small>{i.out ? (i.days === 0 ? 'outgrown now' : `out by ${fmtDate(i.out, st.today)}`) : 'a good while'}</small></div></div>
          ))}
        </div>
      )}
      <div className="card" data-t="hand">
        <h4>Hand-me-downs</h4>
        {plans.map(pl => (
          <div className="hand" key={pl.hand.id}><div className="t"><b>{pl.hand.qty} × {pl.hand.size} {pl.hand.cat === 'shoes' ? 'shoes' : 'clothes'}</b>{planText(pl, true)}</div><button className="del" aria-label="Remove" onClick={() => del(pl.hand.id)}><Ic n="trash" /></button></div>
        ))}
        {incoming.map(pl => (
          <div className="hand" key={pl.hand.id}><div className="t"><b>From {pl.from.kid.name}: {pl.hand.qty} × {pl.hand.size}</b>{planText(pl, false)}</div></div>
        ))}
        {!plans.length && !incoming.length && <p className="note">Nothing saved. Add what {k.name} is done with and see when the next kid can use it.</p>}
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <Seg id="hand-cat" value={cat} onChange={c => { setCat(c); setSize(c === 'clothes' ? '2T' : '5'); }} opts={[['clothes', 'Clothes'], ['shoes', 'Shoes']]} />
          <select className="in" data-t="hand-size" value={size} onChange={e => setSize(e.target.value)} aria-label="Size">{(cat === 'clothes' ? HAND_SIZES : HAND_SHOES).map(x => <option key={x}>{x}</option>)}</select>
          <Stepper label="How many" unit="items" value={qty} show={v => v} d={0} testId="qty" onChange={d => setQty(q => clamp(q + d, 1, 40))} />
          <button className="btn ghost" data-t="hand-add" onClick={add}><Ic n="plus" />Add item</button>
        </div>
      </div>
      {shop.length > 0 && (
        <div className="card" data-t="shop">
          <h4>Shop picks for the next size</h4>
          <div className="picks">{shop.map((x, i) => <a key={i} className="pick" href={x.url} target="_blank" rel="noopener noreferrer"><Wordmark b={x} /><span>{x.label}</span><Ic n="ext" /></a>)}</div>
          <p className="note" style={{ marginTop: 10 }}>Links open each store's own search. No prices here.</p>
        </div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- settings
function KidEdit({ k, st }: { k: Kid; st: Store }) {
  const [name, setName] = useState(k.name), [birth, setBirth] = useState(k.birth), [sure, setSure] = useState(false);
  const put = async (p: Partial<Kid>) => { await idb.put('kids', { ...k, name, birth, ...p, sample: k.sample && !p.name && !p.birth ? k.sample : k.sample }); await st.reload(); };
  const remove = async () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 3000); return; }
    await idb.del('kids', k.id);
    for (const s of ['meas', 'scans', 'seats', 'hands'] as const) for (const r of await idb.all<any>(s)) if (r.kid === k.id) await idb.del(s, r.id);
    await st.reload();
  };
  return (
    <div className="card" data-t={`edit-${k.name}`}>
      <div className="two">
        <div className="field"><span className="lab">Name or nickname</span><input className="in" value={name} maxLength={14} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && put({ name: name.trim() })} /></div>
        <div className="field"><span className="lab">Birthday</span><input className="in" type="date" value={birth} onChange={e => setBirth(e.target.value)} onBlur={() => birth && put({ birth })} /></div>
      </div>
      <div style={{ marginTop: 12 }}><Seg id={`sex-${k.id}`} value={k.sex} onChange={sex => put({ sex })} opts={[['girl', 'Girl'], ['boy', 'Boy']]} /></div>
      <p className="note" style={{ marginTop: 8 }}>Sex picks the growth chart. Names never leave this phone.</p>
      <button className="btn danger" style={{ marginTop: 12 }} onClick={remove}><Ic n="trash" />{sure ? 'Tap again to remove' : `Remove ${k.name}`}</button>
    </div>
  );
}
export function SettingsScreen({ st }: { st: Store }) {
  const s = st.set, [sure, setSure] = useState(false);
  let theme = 'auto'; try { theme = localStorage.getItem('su-theme') || 'auto'; } catch { /* blocked */ }
  const setTheme = async (v: string) => { try { if (v === 'auto') localStorage.removeItem('su-theme'); else localStorage.setItem('su-theme', v); } catch { /* blocked */ } await st.reload(); };
  const hhmm = `${String(s.hour).padStart(2, '0')}:${String(s.min).padStart(2, '0')}`;
  const toggleSample = async () => {
    const on = !s.sample; await st.save({ sample: on });
    if (on) { if (!(await idb.all<Kid>('kids')).some(x => x.sample)) await seedSample(noonNow()); } else await clearSample();
    await st.reload();
  };
  const clearAll = async () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 3500); return; }
    await idb.clearAll(); await idb.put('kv', { ...DEFAULT_SETTINGS, sample: false, seeded: true }); await st.reload(); setSure(false); st.toast('Data cleared');
  };
  const addKid = async () => { await idb.put('kids', { id: uid(), name: 'Kid', birth: iso(addDays(st.today, -365)), sex: 'girl' } as Kid); await st.reload(); };
  const Toggle = ({ on, onClick, id }: { on: boolean; onClick: () => void; id: string }) => <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} data-t={id} onClick={() => { haptic(8); onClick(); }}><i /></button>;
  return (
    <Page title="Settings" sub="Everything stays on this phone" onBack={st.pop}>
      <div className="card">
        <h4>Re-measure reminder</h4>
        <Stepper label="Every" unit={s.every === 1 ? 'week' : 'weeks'} value={s.every} show={v => v} d={0} testId="every" onChange={d => st.save({ every: clamp(s.every + d, 1, 8) })} />
        <div style={{ marginTop: 12 }}><Seg id="rem-day" value={s.day} onChange={v => st.save({ day: v })} opts={[[0, 'Su'], [1, 'Mo'], [2, 'Tu'], [3, 'We'], [4, 'Th'], [5, 'Fr'], [6, 'Sa']]} /></div>
        <div className="field" style={{ marginTop: 12 }}><span className="lab">Time</span><input className="in" type="time" data-t="rem-time" value={hhmm} onChange={e => { const [a, b] = e.target.value.split(':').map(Number); if (!isNaN(a)) void st.save({ hour: a, min: b || 0 }); }} /></div>
        <button className="btn ghost" data-t="ics" style={{ marginTop: 12 }} onClick={() => { downloadIcs(s); st.toast('Calendar file ready'); }}><Ic n="cal" />Add to calendar</button>
        <p className="note" style={{ marginTop: 8 }}>Makes a repeating event called "Measure the kids (Size Up)".</p>
      </div>
      <div className="card">
        <h4>Units and sound</h4>
        <div className="field"><span className="lab">Length</span><Seg id="u-len" value={s.len} onChange={v => st.save({ len: v })} opts={[['in', 'inches'], ['cm', 'cm']]} /></div>
        <div className="field"><span className="lab">Weight</span><Seg id="u-wt" value={s.wt} onChange={v => st.save({ wt: v })} opts={[['lb', 'pounds'], ['kg', 'kg']]} /></div>
        <div className="field"><span className="lab">Look</span><Seg id="u-theme" value={theme} onChange={setTheme} opts={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} /></div>
        <div className="row" style={{ marginTop: 6 }}><span>Sounds and haptics</span><Toggle id="t-sound" on={s.sound} onClick={() => st.save({ sound: !s.sound })} /></div>
      </div>
      <h4 style={{ margin: '6px 4px 0', font: '800 17px var(--disp)' }}>Kids</h4>
      {st.kids.map(k => <KidEdit key={k.id + k.name + k.birth} k={k} st={st} />)}
      <button className="btn ghost" data-t="add-kid" onClick={addKid}><Ic n="plus" />Add a kid</button>
      <div className="card">
        <div className="row"><div><b>Sample kids</b><p className="note">Three made-up kids so you can look around.</p></div><Toggle id="t-sample" on={s.sample} onClick={toggleSample} /></div>
        <button className="btn danger" data-t="clear" style={{ marginTop: 10 }} onClick={clearAll}><Ic n="trash" />{sure ? 'Tap again: erase everything' : 'Clear data'}</button>
      </div>
      <p className="note">Sizes and dates are estimates from growth charts and each brand's published size ranges. They are not a fitting and not medical advice. Car seat limits and expiry come from the label on your seat, so check it. Nothing here is sent anywhere.</p>
      <motion.div />
    </Page>
  );
}
