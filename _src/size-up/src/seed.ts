// Sample mode: three made-up kids, dates relative to today. No real names.
import { idb, uid, type Kid, type Meas, type Seat, type Hand, type Scan } from './data';
import { addDays, iso, valOf, ageMo, pd, type Sex } from './growth/lms';

const T = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const birthAgo = (mo: number, today: Date) => iso(addDays(today, -Math.round(mo * 30.4375)));

export async function seedSample(today = T()) {
  const spec: { name: string; sex: Sex; mo: number; zh: number; zw: number }[] = [
    { name: 'Milo', sex: 'boy', mo: 9.2, zh: 1.0, zw: 0.7 },
    { name: 'Juniper', sex: 'girl', mo: 30, zh: 0.9, zw: 0.4 },
    { name: 'Theo', sex: 'boy', mo: 57, zh: 0.6, zw: 0.3 },
  ];
  const kids: Kid[] = [], meas: Meas[] = [], seats: Seat[] = [], hands: Hand[] = [], scans: Scan[] = [];
  for (const s of spec) {
    const kid: Kid = { id: uid(), name: s.name, birth: birthAgo(s.mo, today), sex: s.sex, sample: true }; kids.push(kid);
    for (const back of [0, 36, 78, 130]) {
      const d = addDays(today, -back - (back ? 2 : 4)), a = ageMo(kid.birth, d); if (a < 0.3) continue;
      meas.push({ id: uid(), kid: kid.id, date: iso(d), h: +valOf(s.sex, 'h', a, s.zh).toFixed(1), w: +valOf(s.sex, 'w', a, s.zw).toFixed(2) });
    }
  }
  const made = (yrsAgo: number) => iso(addDays(today, -Math.round(yrsAgo * 365)));
  seats.push({ id: uid(), kid: kids[0].id, type: 'infant', model: 'Sample Infant Seat', number: 'SIS-100', made: made(0.7), years: 6, maxH: 76, maxW: 15.9 });
  seats.push({ id: uid(), kid: kids[1].id, type: 'convertible', model: 'Sample Convertible', number: 'SCV-200', made: made(2.4), years: 10, maxH: 120, maxW: 29.5 });
  seats.push({ id: uid(), kid: kids[2].id, type: 'booster', model: 'Sample Booster', number: 'SBO-300', made: made(3.5), years: 10, maxH: 145, maxW: 49.9 });
  hands.push({ id: uid(), kid: kids[1].id, cat: 'clothes', size: '2T', qty: 6 }, { id: uid(), kid: kids[2].id, cat: 'clothes', size: '5T', qty: 4 }, { id: uid(), kid: kids[2].id, cat: 'shoes', size: '10', qty: 1 });
  for (const k of kids) await idb.put('kids', k);
  for (const x of meas) await idb.put('meas', x);
  for (const x of seats) await idb.put('seats', x);
  for (const x of hands) await idb.put('hands', x);
  for (const x of scans) await idb.put('scans', x);
  void pd;
}
export async function clearSample() {
  for (const s of ['kids', 'meas', 'scans', 'seats', 'hands'] as const) {
    if (s === 'kids') { for (const k of await idb.all<Kid>('kids')) if (k.sample) await idb.del('kids', k.id); continue; }
    const ids = new Set((await idb.all<Kid>('kids')).map(k => k.id));
    for (const r of await idb.all<any>(s)) if (!ids.has(r.kid)) await idb.del(s, r.id);
  }
}
