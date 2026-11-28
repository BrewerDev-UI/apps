import { WHO, CDC, type Row } from './tables';

export type Sex = 'boy' | 'girl';
export type Kind = 'h' | 'w';
export const MAX_AGE = 73; // last month the CDC tables cover here
export const DAYMS = 864e5;
export const MONTH_DAYS = 30.4375;

function interp(rows: Row[], a: number): [number, number, number] {
  if (a <= rows[0][0]) return [rows[0][1], rows[0][2], rows[0][3]];
  const last = rows[rows.length - 1];
  if (a >= last[0]) return [last[1], last[2], last[3]];
  let i = 1; while (rows[i][0] < a) i++;
  const p = rows[i - 1], q = rows[i], f = (a - p[0]) / (q[0] - p[0]);
  return [p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] + (q[3] - p[3]) * f];
}

/** L, M, S at an age in months. WHO to 24 months, CDC after. The CDC median is eased onto the WHO one between 24 and 36 months so the curve has no jump. */
export function lms(sex: Sex, kind: Kind, age: number): [number, number, number] {
  const a = Math.max(0, Math.min(MAX_AGE, age));
  if (a <= 24) return interp(WHO[sex][kind], a);
  const c = interp(CDC[sex][kind], a);
  if (a < 36) {
    const w24 = interp(WHO[sex][kind], 24)[1], c24 = interp(CDC[sex][kind], 24)[1];
    c[1] = c[1] * (1 + (w24 / c24 - 1) * ((36 - a) / 12));
  }
  return c;
}
export function zOf(sex: Sex, kind: Kind, age: number, v: number): number {
  const [L, M, S] = lms(sex, kind, age);
  return Math.abs(L) < 1e-6 ? Math.log(v / M) / S : (Math.pow(v / M, L) - 1) / (L * S);
}
export function valOf(sex: Sex, kind: Kind, age: number, z: number): number {
  const [L, M, S] = lms(sex, kind, age);
  return Math.abs(L) < 1e-6 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}
export const BANDS = [['P3', -1.8808], ['P15', -1.0364], ['P50', 0], ['P85', 1.0364], ['P97', 1.8808]] as const;

export const pd = (s: string) => new Date(s + 'T12:00:00');
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ageMo = (birth: string, d: Date | string) => ((typeof d === 'string' ? pd(d) : d).getTime() - pd(birth).getTime()) / DAYMS / MONTH_DAYS;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAYMS);
