import { BY_ID, type Service } from './services';

export type Level = 'good' | 'slow' | 'down' | 'maint' | 'unknown' | 'link';
export type Update = { status: string; body: string; at: string };
export type Incident = { id: string; name: string; status: string; impact: string; created: string; resolved: string | null; link?: string; updates: Update[]; parts: string[] };
export type Status = { level: Level; desc: string; incidents: Incident[]; at: number };
export type Past = { name: string; impact: string; created: string; mins: number | null };
export type Hist = { at: number; days: Level[]; typical: number | null; n: number; recent: Past[] };
export type Conn = { level: 'good' | 'slow' | 'down'; online: boolean; ok: number; ms: number | null; type: string; at: number };
export type Part = { name: string; status: string };

export const COLOR: Record<string, string> = { good: '#2FBF71', slow: '#F5A524', down: '#F04438', maint: '#F5A524', unknown: '#A8A296', link: '#A8A296', check: '#B4AEA2' };
export const rank = (l: Level) => ({ down: 4, slow: 3, maint: 2, unknown: 1, good: 0, link: -1 }[l]);
const impactLevel = (i: string): Level => i === 'critical' || i === 'major' ? 'down' : i === 'minor' ? 'slow' : i === 'maintenance' ? 'maint' : 'good';

async function getJSON(url: string, ms = 10000): Promise<any> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(t); }
}

const toIncident = (i: any): Incident => ({
  id: i.id, name: String(i.name || 'Incident').trim(), status: i.status, impact: i.impact || 'none', created: i.created_at, resolved: i.resolved_at || null, link: i.shortlink,
  updates: (i.incident_updates || []).map((u: any) => ({ status: u.status, body: String(u.body || '').trim(), at: u.display_at || u.created_at })),
  parts: (i.components || []).map((c: any) => String(c.name)).filter(Boolean),
});

/** Light check: overall indicator plus anything still open. */
export async function fetchStatus(s: Service): Promise<Status> {
  const base = `https://${s.host}/api/v2`;
  const [a, b] = await Promise.all([getJSON(`${base}/status.json`), getJSON(`${base}/incidents/unresolved.json`).catch(() => ({ incidents: [] }))]);
  const incidents: Incident[] = (b.incidents || []).map(toIncident);
  let level = impactLevel(a.status?.indicator === 'none' ? 'none' : a.status?.indicator || 'none');
  // The company's own headline wins. Open incidents only decide when the headline says nothing.
  if (level === 'good') for (const i of incidents) { const l = impactLevel(i.impact); if (rank(l) > rank(level)) level = l; }
  return { level, desc: a.status?.description || 'No description', incidents, at: Date.now() };
}

/** Recent incidents: 7-day strip, typical fix time, last few incidents. */
export async function fetchHist(s: Service): Promise<Hist> {
  const j = await getJSON(`https://${s.host}/api/v2/incidents.json`, 15000);
  const list: Incident[] = (j.incidents || []).map(toIncident).filter((i: Incident) => i.impact !== 'none');
  const now = Date.now(); const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const days: Level[] = [];
  for (let k = 6; k >= 0; k--) {
    const start = d0.getTime() - k * 864e5, end = start + 864e5; let lv: Level = 'good';
    for (const i of list) {
      const a = Date.parse(i.created), b = i.resolved ? Date.parse(i.resolved) : now;
      if (a < end && b >= start) { const l = impactLevel(i.impact); if (rank(l) > rank(lv)) lv = l; }
    }
    days.push(lv);
  }
  const real = list.filter(i => i.impact !== 'maintenance');
  const mins = real.filter(i => i.resolved).map(i => (Date.parse(i.resolved!) - Date.parse(i.created)) / 6e4).filter(m => m > 0).slice(0, 25).sort((x, y) => x - y);
  const typical = mins.length ? Math.round(mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) : null;
  const recent = real.slice(0, 5).map(i => ({ name: i.name, impact: i.impact, created: i.created, mins: i.resolved ? Math.round((Date.parse(i.resolved) - Date.parse(i.created)) / 6e4) : null }));
  return { at: now, days, typical, n: mins.length, recent };
}

/** Parts of the service that are not working normally right now. */
export async function fetchParts(s: Service): Promise<Part[]> {
  const j = await getJSON(`https://${s.host}/api/v2/summary.json`, 15000);
  return (j.components || []).filter((c: any) => c.status && c.status !== 'operational' && !c.group).slice(0, 8).map((c: any) => ({ name: c.name, status: c.status }));
}

const CDNS = ['https://www.gstatic.com/generate_204', 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css', 'https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.min.css'];

/** Is my own connection the problem? Times small fetches to three big networks. */
export async function testConn(): Promise<Conn> {
  const nc: any = (navigator as any).connection; const type: string = nc?.type && nc.type !== 'unknown' ? nc.type : nc?.effectiveType || '';
  if (!navigator.onLine) return { level: 'down', online: false, ok: 0, ms: null, type, at: Date.now() };
  const res = await Promise.all(CDNS.map(async u => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000); const t0 = performance.now();
    try { await fetch(`${u}?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: c.signal }); return performance.now() - t0; }
    catch { return null; } finally { clearTimeout(t); }
  }));
  const good = res.filter((x): x is number => x != null).sort((a, b) => a - b);
  const ms = good.length ? Math.round(good[Math.floor((good.length - 1) / 2)]) : null;
  const level = good.length === 0 ? 'down' : good.length === 1 || (ms ?? 0) > 1500 ? 'slow' : 'good';
  return { level, online: true, ok: good.length, ms, type, at: Date.now() };
}

export function sampleOutage(): Status {
  const t = (m: number) => new Date(Date.now() - m * 6e4).toISOString();
  return { level: 'down', desc: 'Partial System Outage', at: Date.now(), incidents: [{
    id: 'sample', name: 'Messages failing to send', status: 'identified', impact: 'major', created: t(23), resolved: null, parts: ['sending messages'],
    updates: [
      { status: 'identified', body: 'We found the cause: a database cluster is overloaded. We are moving traffic away from it now.', at: t(9) },
      { status: 'investigating', body: 'Some people cannot send messages or see them arrive late. We are looking into it.', at: t(23) },
    ] }] };
}

export type Verdict = { tone: 'good' | 'slow' | 'down' | 'check'; title: string; line: string; icon: 'check' | 'wifi' | 'logo' | 'dots'; logo?: string; you: boolean; trouble: string[] };
const list = (a: string[]) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const tone = (l: Level) => l === 'down' ? 'down' : 'slow';

export function whatsWrong(id: string, x: Status): string {
  const name = BY_ID[id].name, inc = x.incidents[0];
  if (inc?.parts.length) return `${name} is having trouble with ${list(inc.parts.slice(0, 2))}.`;
  if (inc) return `${name} reports: ${inc.name.replace(/\.$/, '')}.`;
  return `${name} reports ${x.desc.toLowerCase().replace(/\.$/, '')}.`;
}

export function verdict(conn: Conn | null, st: Record<string, Status>, stack: string[], focus: string | null): Verdict {
  const trouble = stack.filter(id => st[id] && (st[id].level === 'down' || st[id].level === 'slow')).sort((a, b) => rank(st[b].level) - rank(st[a].level));
  if (!conn) return { tone: 'check', title: 'Checking', line: 'Testing your connection and the official status pages.', icon: 'dots', you: false, trouble };
  if (conn.level === 'down') return { tone: 'down', title: "It's you.", line: conn.online ? 'Your Wi-Fi or data is connected but nothing is getting through.' : 'Your phone is offline. No Wi-Fi or data.', icon: 'wifi', you: true, trouble: [] };
  const slow = conn.level === 'slow';
  const f = focus && BY_ID[focus] ? BY_ID[focus] : null;
  if (f) {
    const x = st[f.id];
    if (!f.host) return { tone: slow ? 'slow' : 'check', title: "Can't tell from here.", line: `${f.name} has no live feed. Open its official status page. Your connection is ${slow ? 'slow' : 'good'}.`, icon: 'logo', logo: f.id, you: false, trouble };
    if (x && trouble.includes(f.id)) return { tone: tone(x.level), title: slow ? "It's not just you." : "It's not you.", line: whatsWrong(f.id, x), icon: 'logo', logo: f.id, you: false, trouble };
    if (x?.level === 'maint') return { tone: 'slow', title: "It's not you.", line: `${f.name} is doing planned maintenance.`, icon: 'logo', logo: f.id, you: false, trouble };
    if (!x || x.level === 'unknown') return { tone: 'check', title: "Can't tell yet.", line: `${f.name}'s status page did not answer. Your connection is ${slow ? 'slow' : 'good'}.`, icon: 'logo', logo: f.id, you: false, trouble };
    if (slow) return { tone: 'slow', title: 'It might be you.', line: `${f.name} reports no problems, but your connection is slow.`, icon: 'logo', logo: f.id, you: true, trouble };
    return { tone: 'good', title: `${f.name} is up.`, line: 'No problems reported, and your connection is good.', icon: 'logo', logo: f.id, you: false, trouble };
  }
  if (trouble.length === 1) return { tone: tone(st[trouble[0]].level), title: slow ? "It's not just you." : "It's not you.", line: whatsWrong(trouble[0], st[trouble[0]]), icon: 'logo', logo: trouble[0], you: false, trouble };
  if (trouble.length > 1) {
    const names = trouble.map(id => BY_ID[id].name);
    const shown = names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : list(names);
    return { tone: trouble.some(id => st[id].level === 'down') ? 'down' : 'slow', title: slow ? "It's not just you." : "It's not you.", line: `${shown} are having trouble.`, icon: 'logo', logo: trouble[0], you: false, trouble };
  }
  if (slow) return { tone: 'slow', title: 'It might be you.', line: conn.ok < 3 ? 'Your connection is patchy. Some checks did not get through.' : `Your connection is slow (${fmtMs(conn.ms)}). Nothing in your stack reports trouble.`, icon: 'wifi', you: true, trouble };
  const live = stack.filter(id => st[id] && st[id].level === 'good').length;
  if (!live) return { tone: 'check', title: 'Checking', line: 'Your connection is good. Reading the status pages.', icon: 'dots', you: false, trouble };
  return { tone: 'good', title: 'All clear.', line: `Your connection is good and ${live} services report normal.`, icon: 'check', you: false, trouble };
}

export const fmtMs = (ms: number | null) => ms == null ? 'no reply' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
export function ago(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return 'just now'; if (s < 60) return `${s} sec ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export function dur(mins: number): string {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  if (mins < 1440) { const h = Math.floor(mins / 60), m = Math.round(mins % 60); return m ? `${h} hr ${m} min` : `${h} hr`; }
  const d = Math.floor(mins / 1440), h = Math.round((mins % 1440) / 60); return h ? `${d} d ${h} hr` : `${d} d`;
}
export const PLAIN: Record<string, string> = {
  investigating: 'Looking for the cause', identified: 'Cause found, fixing it', monitoring: 'Fix is in, watching it', resolved: 'Fixed', postmortem: 'Write-up posted',
  scheduled: 'Planned', in_progress: 'Work under way', verifying: 'Checking the work', completed: 'Done',
  degraded_performance: 'Slow or glitchy', partial_outage: 'Broken for some', major_outage: 'Broken for most', under_maintenance: 'Planned work',
};
export const LEVEL_WORD: Record<Level, string> = { good: 'Working', slow: 'Some trouble', down: 'Outage', maint: 'Planned maintenance', unknown: 'No answer', link: 'No live feed' };

export async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
