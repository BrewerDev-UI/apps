import { valOf, zOf, ageMo, pd, addDays, DAYMS, MAX_AGE, MONTH_DAYS } from './growth/lms';
import type { Kid, Meas, Scan, Seat, Hand } from './data';
import { CARTERS_BRAND, insole, sizeFor, usLabel, sizeIdx, shoeNum, SHOE_MAX, type Brand, type Row } from './sizes';

export type Tone = 'now' | 'soon' | 'good';
export const toneOf = (days: number | null): Tone => (days !== null && days <= 30 ? 'now' : days !== null && days <= 90 ? 'soon' : 'good');
export const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / DAYMS);
export const noon = (d = new Date()) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };

export interface Proj { kid: Kid; m: Meas; zh: number; zw: number; at: (d: Date) => { h: number; w: number; age: number }; end: Date }
export function makeProj(kid: Kid, meas: Meas[]): Proj | null {
  const mine = meas.filter(x => x.kid === kid.id).sort((a, b) => a.date.localeCompare(b.date));
  const m = mine[mine.length - 1]; if (!m) return null;
  const a = ageMo(kid.birth, m.date), zh = zOf(kid.sex, 'h', a, m.h), zw = zOf(kid.sex, 'w', a, m.w);
  return { kid, m, zh, zw, end: addDays(pd(kid.birth), MAX_AGE * MONTH_DAYS), at: d => { const age = ageMo(kid.birth, d); return { age, h: valOf(kid.sex, 'h', age, zh), w: valOf(kid.sex, 'w', age, zw) }; } };
}
type V = { h: number; w: number; age: number };
/** First day (from `from`) the test turns true. `from` if already true, null if not before the charts end (about age 6). */
export function firstDay(p: Proj, test: (v: V) => boolean, from: Date): Date | null {
  if (test(p.at(from))) return from;
  const limit = Math.floor((p.end.getTime() - from.getTime()) / DAYMS);
  for (let d = 3; d <= limit; d += 3) if (test(p.at(addDays(from, d)))) { for (let e = d - 2; e <= d; e++) if (test(p.at(addDays(from, e)))) return addDays(from, e); return addDays(from, d); }
  return null;
}

export interface Info { cat: 'clothes' | 'shoes' | 'seat'; label: string; next: string | null; out: Date | null; days: number | null; tone: Tone; progress: number; beyond?: boolean; est?: boolean; reason?: string }

export function clothesInfo(brand: Brand, p: Proj, today: Date): Info {
  const rows = brand.rows, now = p.at(today);
  let i = rows.findIndex(r => now.h <= r.hMax && (r.wMax == null || now.w <= r.wMax)); const beyond = i < 0; if (beyond) i = rows.length - 1;
  const r = rows[i], out = beyond ? today : firstDay(p, v => v.h > r.hMax || (r.wMax != null && v.w > r.wMax), today);
  const days = out ? Math.max(0, daysBetween(today, out)) : null;
  const lo = i > 0 ? rows[i - 1].hMax : r.hMax * 0.88, wlo = i > 0 ? rows[i - 1].wMax : undefined;
  let prog = (now.h - lo) / (r.hMax - lo); if (r.wMax != null && wlo != null) prog = Math.max(prog, (now.w - wlo) / (r.wMax - wlo));
  return { cat: 'clothes', label: r.label, next: rows[i + 1]?.label ?? null, out, days, tone: toneOf(days), progress: Math.max(0.02, Math.min(1, beyond ? 1 : prog)), beyond };
}

const C = (a: number) => (a <= 36 ? 1.5 * a : 54 + (Math.min(a, 72) - 36) + Math.max(0, a - 72) * 0.8); // mm grown by age a: 1.5 mm/mo under 3, 1 mm/mo 3 to 6
export function footFn(kid: Kid, scans: Scan[], p: Proj) {
  const sc = scans.filter(s => s.kid === kid.id).sort((a, b) => a.date.localeCompare(b.date)).pop() ?? null;
  const f = (d: Date) => (sc ? sc.cm + (C(ageMo(kid.birth, d)) - C(ageMo(kid.birth, sc.date))) / 10 : 0.159 * p.at(d).h);
  return { f, scan: sc };
}
export function shoeInfo(kid: Kid, scans: Scan[], p: Proj, today: Date): Info & { foot: number; S: number } {
  const { f, scan } = footFn(kid, scans, p), foot = f(today), S = sizeFor(foot + 1);
  let o: Date | null = null;
  if (foot + 1 > insole(S) + 1e-9) o = today; else for (let d = 3; addDays(today, d) < p.end; d += 3) if (f(addDays(today, d)) + 1 > insole(S)) { o = addDays(today, d); break; }
  const days = o ? Math.max(0, daysBetween(today, o)) : null;
  return { cat: 'shoes', label: usLabel(S), next: S < SHOE_MAX ? usLabel(S + 1) : null, out: o, days, tone: toneOf(days), progress: Math.max(0.02, Math.min(1, (foot + 1 - insole(S - 1)) / (insole(S) - insole(S - 1)))), est: !scan, foot, S };
}

export const SEAT_YEARS = { infant: 6, convertible: 10, booster: 10 } as const;
export const SEAT_NAME = { infant: 'infant seat', convertible: 'convertible seat', booster: 'booster' } as const;
export function seatDates(seat: Seat, p: Proj | null, today: Date) {
  const exp = pd(seat.made); exp.setFullYear(exp.getFullYear() + seat.years);
  const hd = p ? firstDay(p, v => v.h > seat.maxH, today) : null, wd = p ? firstDay(p, v => v.w > seat.maxW, today) : null;
  const cand: [Date, string][] = [[exp, 'expires']]; if (hd) cand.push([hd, 'hits its height limit']); if (wd) cand.push([wd, 'hits its weight limit']);
  cand.sort((a, b) => a[0].getTime() - b[0].getTime());
  return { exp, hd, wd, next: cand[0][0], reason: cand[0][1] };
}
export function seatInfo(seat: Seat, p: Proj | null, today: Date): Info {
  const s = seatDates(seat, p, today), days = Math.max(0, daysBetween(today, s.next)), now = p ? p.at(today) : null;
  const prog = now ? Math.max(now.h / seat.maxH, now.w / seat.maxW) : 0.5;
  return { cat: 'seat', label: SEAT_NAME[seat.type], next: null, out: s.next, days, tone: toneOf(days), progress: Math.max(0.02, Math.min(1, prog)), reason: s.reason };
}

export interface KidSum { kid: Kid; p: Proj | null; items: Info[]; top: Info | null; key: number; age: string; seat: Seat | null; clothes?: Info; shoes?: Info & { foot: number; S: number }; scans: Scan[] }
export function ageText(birth: string, today: Date) {
  const mo = Math.max(0, Math.floor(ageMo(birth, today))); if (mo < 24) return `${mo} mo`;
  const y = Math.floor(mo / 12), r = mo % 12; return r ? `${y} yr ${r} mo` : `${y} yr`;
}
const keyOf = (i: Info) => (i.days ?? 9999) - (i.cat === 'seat' ? 21 : 0); // a seat limit or expiry outranks clothes
export function summarize(kid: Kid, d: { meas: Meas[]; scans: Scan[]; seats: Seat[] }, today: Date): KidSum {
  const p = makeProj(kid, d.meas), seat = d.seats.find(s => s.kid === kid.id) ?? null, items: Info[] = [];
  let clothes: Info | undefined, shoes: (Info & { foot: number; S: number }) | undefined;
  if (p) { clothes = clothesInfo(CARTERS_BRAND, p, today); shoes = shoeInfo(kid, d.scans, p, today); items.push(clothes, shoes); }
  if (seat) items.push(seatInfo(seat, p, today));
  const top = items.length ? items.reduce((a, b) => (keyOf(b) < keyOf(a) ? b : a)) : null;
  return { kid, p, items, top, key: top ? keyOf(top) : 99999, age: ageText(kid.birth, today), seat, clothes, shoes, scans: d.scans.filter(s => s.kid === kid.id) };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(d: Date, today = new Date()) {
  const far = Math.abs(d.getTime() - today.getTime()) > 300 * DAYMS;
  return `${MON[d.getMonth()]} ${d.getDate()}${far || d.getFullYear() !== today.getFullYear() ? `, ${d.getFullYear()}` : ''}`;
}
export function verdict(s: KidSum, i: Info, today: Date): { pre: string; date: string } {
  const n = s.kid.name, thing = i.cat === 'clothes' ? `${i.label} pants` : `size ${i.label} shoes`;
  if (i.cat === 'seat') {
    const t = SEAT_NAME[s.seat!.type];
    return i.days === 0 ? { pre: `${n}'s ${t} is`, date: i.reason === 'expires' ? 'expired' : 'at its limit' } : { pre: `${n}'s ${t} ${i.reason} by`, date: fmtDate(i.out!, today) };
  }
  if (i.out === null) return { pre: `${n} fits ${thing} for a good while`, date: '' };
  if (i.days === 0) return { pre: `${n} has outgrown`, date: thing };
  return { pre: `${n} outgrows ${thing} by`, date: fmtDate(i.out, today) };
}

// ---------- hand-me-downs ----------
export interface Plan { hand: Hand; from: KidSum; to: KidSum | null; skipped: KidSum[]; fitsFrom: Date | null; outAt: Date | null; fitsNow: boolean; passOn: Date | null }
/** When does an item leave its owner, and which younger kid grows into it next. Kids who have already outgrown it are skipped. */
export function planHand(h: Hand, sums: KidSum[], today: Date): Plan | null {
  const from = sums.find(s => s.kid.id === h.kid); if (!from) return null;
  const younger = sums.filter(s => s.kid.birth > from.kid.birth).sort((a, b) => b.kid.birth.localeCompare(a.kid.birth) * -1);
  const span = (s: KidSum) => {
    if (!s.p) return null;
    const p = s.p;
    if (h.cat === 'clothes') {
      const i = sizeIdx(h.size); if (i < 0) return null;
      const row: Row = CARTERS_BRAND.rows[i], prev = i > 0 ? CARTERS_BRAND.rows[i - 1] : null;
      const past = (v: V, r: Row) => v.h > r.hMax || (r.wMax != null && v.w > r.wMax);
      const lo = prev ? firstDay(p, v => past(v, prev), today) : today, hi = firstDay(p, v => past(v, row), today);
      return { lo, hi, nowIn: (!prev || past(p.at(today), prev)) && !past(p.at(today), row) };
    }
    const S = shoeNum(h.size), { f } = footFn(s.kid, s.scans, p), v0 = f(today) + 1;
    let lo: Date | null = v0 > insole(S - 1) ? today : null, hi: Date | null = v0 > insole(S) ? today : null;
    for (let d = 3; !hi && addDays(today, d) < p.end; d += 3) { const x = addDays(today, d), v = f(x) + 1; if (!lo && v > insole(S - 1)) lo = x; if (v > insole(S)) hi = x; }
    return { lo, hi, nowIn: v0 > insole(S - 1) && v0 <= insole(S) };
  };
  const a = span(from), skipped: KidSum[] = [];
  for (const y of younger) {
    const b = span(y); if (!b) continue;
    if (b.hi && b.hi.getTime() <= today.getTime()) { skipped.push(y); continue; } // already too small for this kid: try the next one down
    return { hand: h, from, to: y, skipped, fitsFrom: b.nowIn ? today : b.lo, outAt: b.hi, fitsNow: b.nowIn, passOn: a?.hi ?? null };
  }
  return { hand: h, from, to: null, skipped, fitsFrom: null, outAt: null, fitsNow: false, passOn: a?.hi ?? null };
}
