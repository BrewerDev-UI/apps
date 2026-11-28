import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion } from 'motion/react';
import { haptic } from './phone';

export const Ic = ({ n }: { n: string }) => {
  const p: Record<string, ReactNode> = {
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />, back: <path d="M15 5l-7 7 7 7" />, plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />,
    ruler: <><rect x="2" y="8" width="20" height="8" rx="2" /><path d="M6 8v4M10 8v3M14 8v4M18 8v3" /></>,
    foot: <path d="M8 3c2 0 3 2 3 4 0 3-1 4-1 7 0 3 1 5 3 6-4 1-8 0-8-4 0-5 0-13 3-13z M15 6a1 1 0 100 .01 M18 8a1 1 0 100 .01 M19 11a1 1 0 100 .01" />,
    seat: <path d="M7 4c1 0 2 1 2 2l1 8h8v4H7c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />, share: <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />, cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="14" r="3.5" /></>, ext: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />, trash: <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />,
  };
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{p[n]}</svg>;
};

/** A number that rolls to its new value. Mono, tabular, same width so nothing jumps. */
export function Num({ v, d = 1, className = '' }: { v: number; d?: number; className?: string }) {
  const [shown, setShown] = useState(v), from = useRef(v);
  useEffect(() => { const a = animate(from.current, v, { duration: 0.35, ease: 'easeOut', onUpdate: x => { from.current = x; setShown(x); } }); return () => a.stop(); }, [v]);
  return <span className={`num ${className}`}>{shown.toFixed(d)}</span>;
}

/** Big plus and minus. Hold to repeat. */
export function Stepper({ label, unit, value, show, onChange, d = 1, testId }: { label: string; unit: string; value: number; show: (v: number) => number; onChange: (dir: 1 | -1) => void; d?: number; testId: string }) {
  const t = useRef<any>(null), iv = useRef<any>(null), cb = useRef(onChange); cb.current = onChange;
  const stop = () => { clearTimeout(t.current); clearInterval(iv.current); };
  const start = (dir: 1 | -1) => { haptic(6); cb.current(dir); t.current = setTimeout(() => { iv.current = setInterval(() => cb.current(dir), 85); }, 420); };
  useEffect(() => stop, []);
  const B = (dir: 1 | -1) => (
    <button className="step-b" aria-label={`${dir > 0 ? 'More' : 'Less'} ${label}`} data-t={`${testId}-${dir > 0 ? 'up' : 'down'}`} onPointerDown={e => { e.preventDefault(); start(dir); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={e => e.preventDefault()}>
      <Ic n={dir > 0 ? 'plus' : 'minus'} />
    </button>
  );
  return (
    <div className="stepper">
      <span className="lab">{label}</span>
      <div className="step-row">{B(-1)}<div className="step-val" data-t={`${testId}-val`}><Num v={show(value)} d={d} className="big" /><small>{unit}</small></div>{B(1)}</div>
    </div>
  );
}

export function Seg<T extends string | number>({ opts, value, onChange, id }: { opts: [T, string][]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div className="seg" role="group" data-t={id}>
      {opts.map(([v, l]) => (
        <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => { haptic(6); onChange(v); }} aria-pressed={value === v}>
          {value === v && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}

export function Page({ title, sub, onBack, children, right }: { title: string; sub?: string; onBack: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <motion.section className="page" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 36 }} data-t="page">
      <header className="page-h">
        <button className="icon-b" onClick={onBack} aria-label="Close" data-t="close"><Ic n="back" /></button>
        <div className="page-t"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
        {right}
      </header>
      <div className="page-body">{children}</div>
    </motion.section>
  );
}

export const Wordmark = ({ b }: { b: { brand: string; color: string; ink: string; family: string } }) => (
  <span className="wm" style={{ background: b.color, color: b.ink, fontFamily: b.family }}>{b.brand}</span>
);
