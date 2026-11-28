// Small IndexedDB wrapper plus the data types. Everything stays on this phone.
import type { Sex } from './growth/lms';
export interface Kid { id: string; name: string; birth: string; sex: Sex; sample?: boolean }
export interface Meas { id: string; kid: string; date: string; h: number; w: number } // cm, kg
export interface Scan { id: string; kid: string; date: string; cm: number }
export type SeatType = 'infant' | 'convertible' | 'booster';
export interface Seat { id: string; kid: string; type: SeatType; model: string; number: string; made: string; years: number; maxH: number; maxW: number } // cm, kg
export interface Hand { id: string; kid: string; cat: 'clothes' | 'shoes'; size: string; qty: number }
export interface Settings { id: 'settings'; len: 'cm' | 'in'; wt: 'kg' | 'lb'; sound: boolean; every: number; day: number; hour: number; min: number; sample: boolean; seeded: boolean }
export const DEFAULT_SETTINGS: Settings = { id: 'settings', len: 'in', wt: 'lb', sound: true, every: 4, day: 0, hour: 19, min: 0, sample: true, seeded: false };
export type StoreName = 'kids' | 'meas' | 'scans' | 'seats' | 'hands' | 'kv';
const NAMES: StoreName[] = ['kids', 'meas', 'scans', 'seats', 'hands', 'kv'];

let dbp: Promise<IDBDatabase | null> | null = null;
const mem: Record<string, Map<string, any>> = {};
const m = (s: string) => (mem[s] ||= new Map());
function open(): Promise<IDBDatabase | null> {
  if (!dbp) dbp = new Promise(res => {
    try {
      const r = indexedDB.open('size-up', 1);
      r.onupgradeneeded = () => { for (const n of NAMES) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
function run<T>(s: StoreName, mode: IDBTransactionMode, f: (st: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return open().then(db => new Promise<T | undefined>(res => {
    if (!db) return res(undefined);
    try { const tx = db.transaction(s, mode); const rq = f(tx.objectStore(s)); tx.oncomplete = () => res(rq ? (rq.result as T) : undefined); tx.onerror = () => res(undefined); tx.onabort = () => res(undefined); } catch { res(undefined); }
  }));
}
export const idb = {
  async all<T>(s: StoreName): Promise<T[]> { const r = await run<T[]>(s, 'readonly', st => st.getAll()); return r ?? [...m(s).values()]; },
  async put(s: StoreName, v: { id: string } & Record<string, any>) { m(s).set(v.id, v); await run(s, 'readwrite', st => st.put(v)); },
  async del(s: StoreName, id: string) { m(s).delete(id); await run(s, 'readwrite', st => st.delete(id)); },
  async clearAll() { for (const n of NAMES) { m(n).clear(); await run(n, 'readwrite', st => st.clear()); } },
};
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
