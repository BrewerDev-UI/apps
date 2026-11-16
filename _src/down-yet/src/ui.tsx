import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BY_ID, lightOn } from './services';
import { COLOR, ago, type Level } from './api';

export const inkOn = (hex: string) => lightOn(hex) ? '#fff' : '#1C1C1E';

export function Logo({ id, size, color }: { id: string; size: number; color: string }) {
  const s = BY_ID[id];
  if (s.path) return <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true"><path d={s.path} /></svg>;
  return <span className="mark" style={{ fontSize: size * 0.62, color, width: size, height: size }} aria-hidden="true">{s.mark}</span>;
}

/** Small glossy brand tile with the logo, used in lists and chips. */
export function Badge({ id, size = 40 }: { id: string; size?: number }) {
  const s = BY_ID[id];
  return <span className="badge" style={{ background: `#${s.hex}`, width: size, height: size, borderRadius: size * 0.3 }}><Logo id={id} size={size * 0.52} color={inkOn(s.hex)} /></span>;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  check: (n = 24) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke} strokeWidth={2.8}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  wifiOff: (n = 24) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke}><path d="M2.5 9a14 14 0 0 1 4.6-2.9M10.6 5.1A14 14 0 0 1 21.5 9M6 12.6a9 9 0 0 1 3.2-2M13.7 10.2A9 9 0 0 1 18 12.6M9.3 16a4.4 4.4 0 0 1 5.4 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /><path d="M4 3l16 18" /></svg>,
  wifi: (n = 24) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke}><path d="M2.5 9a14 14 0 0 1 19 0M6 12.6a9 9 0 0 1 12 0M9.3 16a4.4 4.4 0 0 1 5.4 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>,
  share: (n = 20) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke}><path d="M12 15V3.5M7.5 7.5L12 3l4.5 4.5M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" /></svg>,
  back: (n = 22) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke} strokeWidth={2.6}><path d="M14.5 5l-7 7 7 7" /></svg>,
  bell: (n = 20) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21a2.2 2.2 0 0 0 4 0" /></svg>,
  out: (n = 16) => <svg viewBox="0 0 24 24" width={n} height={n} {...stroke}><path d="M9 6h9v9M18 6L7 17" /></svg>,
  orb: (n = 22) => <svg viewBox="0 0 24 24" width={n} height={n}><circle cx="12" cy="12" r="8.5" fill="currentColor" /><circle cx="9.3" cy="9" r="2.4" fill="#fff" opacity=".55" /></svg>,
  grid: (n = 22) => <svg viewBox="0 0 24 24" width={n} height={n} fill="currentColor"><rect x="3.5" y="3.5" width="7" height="7" rx="2.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2.2" /></svg>,
};

export function Orb({ tone, busy, onTap, children, small }: { tone: string; busy?: boolean; onTap?: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button className={`orb-wrap${small ? ' small' : ''}`} onClick={onTap} aria-label="Check again">
      <span className="orb-shadow" style={{ ['--c' as any]: COLOR[tone] }} />
      <span className={`orb${busy ? ' busy' : ''}`} style={{ ['--c' as any]: COLOR[tone] }}>
        <span className="orb-in">{children}</span>
        <span className="orb-gloss" />
      </span>
      {busy && <span className="orb-ring" />}
    </button>
  );
}

/** Seven bars, oldest to today. */
export function Strip({ days, big, onDark }: { days?: Level[]; big?: boolean; onDark?: boolean }) {
  const d0 = new Date();
  return (
    <span className={`strip${big ? ' big' : ''}${onDark ? ' on-dark' : ''}`} aria-label="Last 7 days">
      {Array.from({ length: 7 }, (_, i) => {
        const lv = days?.[i]; const day = new Date(d0.getTime() - (6 - i) * 864e5);
        return <span key={i} className="strip-col"><i className={lv ? '' : 'empty'} style={lv ? { background: COLOR[lv === 'maint' ? 'slow' : lv], opacity: lv === 'maint' ? 0.55 : 1 } : undefined} />{big && <b>{'SMTWTFS'[day.getDay()]}</b>}</span>;
      })}
    </span>
  );
}

/** "8 sec ago" that updates in place. */
export function Ago({ t }: { t: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);
  return <span className="num">{t ? ago(t) : 'not yet'}</span>;
}
export function Countdown({ to }: { to: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);
  return <span className="num">{Math.max(0, Math.ceil((to - Date.now()) / 1000))} sec</span>;
}

/** Scrolling screen with pull to refresh. */
export function Screen({ active, onRefresh, children, className = '' }: { active: boolean; onRefresh?: () => void; children: ReactNode; className?: string }) {
  const [pull, setPull] = useState(0); const y0 = useRef<number | null>(null); const el = useRef<HTMLDivElement>(null);
  return (
    <div ref={el} className={`screen ${className}${active ? ' active' : ''}`} aria-hidden={!active}
      onTouchStart={e => { y0.current = onRefresh && el.current!.scrollTop <= 0 ? e.touches[0].clientY : null; }}
      onTouchMove={e => { if (y0.current == null) return; const dy = e.touches[0].clientY - y0.current; setPull(dy > 0 && el.current!.scrollTop <= 0 ? Math.min(96, dy * 0.5) : 0); }}
      onTouchEnd={() => { if (pull > 60) onRefresh?.(); setPull(0); y0.current = null; }}>
      <div className="pull" style={{ opacity: Math.min(1, pull / 60), transform: `translate(-50%, ${pull - 40}px) scale(${0.6 + Math.min(1, pull / 60) * 0.4})` }}>{pull > 60 ? 'Let go to check' : 'Pull to check'}</div>
      {children}
    </div>
  );
}
