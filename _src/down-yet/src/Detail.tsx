import { useEffect, useState } from 'react';
import { BY_ID, GLOSSARY } from './services';
import { COLOR, LEVEL_WORD, PLAIN, ago, dur, fetchParts, type Hist, type Part, type Status } from './api';
import { Icon, Logo, Strip, inkOn } from './ui';

type Props = { id: string; status?: Status; hist?: Hist; watching: boolean; sample: boolean; onWatch: () => void; onClose: () => void; onRemove: () => void };

export default function Detail({ id, status, hist, watching, sample, onWatch, onClose, onRemove }: Props) {
  const s = BY_ID[id]; const fg = inkOn(s.hex);
  const level = s.host ? status?.level ?? 'unknown' : 'link';
  const bad = level === 'down' || level === 'slow';
  const [parts, setParts] = useState<Part[] | null>(null);
  useEffect(() => { let on = true; if (s.host && bad && !sample) fetchParts(s).then(p => on && setParts(p)).catch(() => {}); return () => { on = false; }; }, [id, bad, sample]);
  const inc = status?.incidents ?? [];
  const clear = hist ? hist.days.filter(d => d === 'good').length : 0;
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="detail">
      <header className="d-head" style={{ background: `#${s.hex}`, color: fg }}>
        <button className="d-back" onClick={onClose} aria-label="Back" style={{ color: fg }}>{Icon.back()}</button>
        <div className="d-id">
          <span className="d-logo"><Logo id={id} size={54} color={fg} /></span>
          <div><h2>{s.name}</h2><p>{s.kind}</p></div>
        </div>
        <div className="d-pill"><i style={{ background: COLOR[level] }} /><b>{LEVEL_WORD[level]}</b>{s.host && status && <span>{sample ? 'Sample' : status.desc}</span>}</div>
      </header>

      <div className="d-body">
        {s.host ? (
          <button className={`big-btn${watching ? ' on' : ''}`} onClick={onWatch}>
            {Icon.bell()}<span>{watching ? 'Watching. Tap to stop' : bad ? "Ping me when it's back" : 'Tell me if it goes down'}</span>
          </button>
        ) : (
          <a className="big-btn" href={s.url} target="_blank" rel="noopener noreferrer">{Icon.out(18)}<span>Open official status</span></a>
        )}
        <p className="hint">{s.host ? 'Checks every 60 sec while Down Yet is open. Sound, buzz and a notification.' : `${s.name} does not publish a live feed apps can read, so the official page is the source.`}</p>

        {s.host && <section>
          <h3>Happening now</h3>
          {inc.length === 0 && <div className="card quiet"><i className="dot" style={{ background: COLOR[level === 'unknown' ? 'unknown' : 'good'] }} />{level === 'unknown' ? 'The status page did not answer. Try again soon.' : 'Nothing open. No incidents reported.'}</div>}
          {inc.map(i => (
            <div className="card" key={i.id}>
              <div className="inc-name">{i.name}</div>
              <div className="inc-meta num">Started {ago(Date.parse(i.created))}{hist?.typical ? ` · typical fix ${dur(hist.typical)}` : ''}</div>
              {i.parts.length > 0 && <div className="parts">{i.parts.slice(0, 6).map(p => <span key={p}>{p}</span>)}</div>}
              <ol className="timeline">
                {i.updates.slice(0, 6).map((u, k) => (
                  <li key={k} className={k === 0 ? 'latest' : ''}>
                    <div className="tl-top"><b>{PLAIN[u.status] ?? u.status}</b><span className="num">{ago(Date.parse(u.at))}</span></div>
                    <p>{u.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {parts && parts.length > 0 && <div className="card"><div className="inc-meta">Parts not working normally</div>
            {parts.map(p => <div className="row" key={p.name}><span>{p.name}</span><em>{PLAIN[p.status] ?? p.status}</em></div>)}</div>}
        </section>}

        {s.host && <section>
          <h3>Last 7 days</h3>
          <div className="card two">
            <div><Strip days={hist?.days} big /><div className="inc-meta">{hist ? `${clear} of 7 days with no incidents` : 'Loading history'}</div></div>
            <div className="stat"><b className="num">{hist?.typical ? dur(hist.typical) : hist ? 'n/a' : '…'}</b><span>typical fix time{hist?.n ? `, from ${hist.n} incidents` : ''}</span></div>
          </div>
        </section>}

        <section>
          <h3>Meanwhile</h3>
          <div className="card">
            {s.tips.map(t => <div className="tip" key={t}><span>{Icon.check(16)}</span>{t}</div>)}
            {s.ripple && <div className="ripple"><b>Knock-on effect</b>{s.ripple}</div>}
          </div>
        </section>

        {hist && hist.recent.length > 0 && <section>
          <h3>Recent incidents</h3>
          <div className="card">
            {hist.recent.map((r, k) => <div className="row past" key={k}><i className="dot" style={{ background: COLOR[r.impact === 'minor' ? 'slow' : 'down'] }} /><span>{r.name}</span><em className="num">{date(r.created)} · {r.mins ? dur(r.mins) : 'open'}</em></div>)}
          </div>
        </section>}

        <section>
          <details className="card gloss">
            <summary>What the status words mean</summary>
            {GLOSSARY.map(([w, m]) => <div className="row def" key={w}><b>{w}</b><span>{m}</span></div>)}
          </details>
        </section>

        <div className="d-foot">
          {s.host && <a href={s.url} target="_blank" rel="noopener noreferrer">Open official status {Icon.out(14)}</a>}
          <button onClick={onRemove}>Remove from my stack</button>
        </div>
      </div>
    </div>
  );
}
