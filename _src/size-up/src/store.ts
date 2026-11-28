import type { Kid, Meas, Scan, Seat, Hand, Settings } from './data';
import type { KidSum } from './model';

export interface Store {
  kids: Kid[]; meas: Meas[]; scans: Scan[]; seats: Seat[]; hands: Hand[]; set: Settings; today: Date; sums: KidSum[];
  reload: () => Promise<void>; save: (s: Partial<Settings>) => Promise<void>; toast: (t: string) => void; push: (r: Route) => void; pop: () => void;
}
export type Route = { t: 'measure'; kid: string } | { t: 'scan'; kid: string } | { t: 'seat'; kid: string } | { t: 'kid'; kid: string } | { t: 'settings' };

/** A display unit: converts the stored metric value to what is shown and back, with a step. */
export interface Unit { name: string; show: (v: number) => number; from: (v: number) => number; step: number; d: number }
export const lenUnit = (s: Settings, cmStep = 0.5, inStep = 0.25): Unit => (s.len === 'in'
  ? { name: 'in', show: v => v / 2.54, from: v => v * 2.54, step: inStep, d: 2 }
  : { name: 'cm', show: v => v, from: v => v, step: cmStep, d: 1 });
export const wtUnit = (s: Settings, kgStep = 0.1, lbStep = 0.2): Unit => (s.wt === 'lb'
  ? { name: 'lb', show: v => v * 2.20462, from: v => v / 2.20462, step: lbStep, d: 1 }
  : { name: 'kg', show: v => v, from: v => v, step: kgStep, d: 2 });
export const nudge = (u: Unit, metric: number, dir: 1 | -1, lo: number, hi: number) => Math.min(hi, Math.max(lo, u.from(+(u.show(metric) + dir * u.step).toFixed(3))));
export const fmtLen = (u: Unit, cm: number) => `${u.show(cm).toFixed(u.name === 'in' ? 1 : 0)} ${u.name}`;
export const fmtWt = (u: Unit, kg: number) => `${u.show(kg).toFixed(1)} ${u.name}`;
