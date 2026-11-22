// Wind from Open-Meteo. Parade forecast for Midtown, and live wind near the player.

export const LIMIT_S = 23, LIMIT_G = 34; // NYC rule: giant balloons stay down above 23 mph sustained or 34 mph gusts
export type Wind = { sustained: number; gust: number; dir: number; source: 'live' | 'parade' | 'sample'; label: string };
export type Forecast = { sustained: number; gust: number; dir: number; hours: { h: number; s: number; g: number }[]; at: number; date: string; past: boolean };
export type Verdict = { tone: 'yes' | 'edge' | 'no' | 'wait'; word: string; line: string };

const API = 'https://api.open-meteo.com/v1/forecast';
const KEY = 'tilt-parade:forecast';

/** Thanksgiving: the fourth Thursday of November. Uses this year's until two weeks after it. */
export function paradeDate(now = new Date()): Date {
  const of = (y: number) => { const d = new Date(y, 10, 1); const first = 1 + ((4 - d.getDay() + 7) % 7); return new Date(y, 10, first + 21, 9); };
  const d = of(now.getFullYear());
  return now.getTime() > d.getTime() + 14 * 864e5 ? of(now.getFullYear() + 1) : d;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const niceDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

async function get(url: string): Promise<any> {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('weather ' + r.status); return await r.json(); } finally { clearTimeout(to); }
}

export function cachedForecast(): Forecast | null {
  try { const f = JSON.parse(localStorage.getItem(KEY) || 'null') as Forecast | null; return f && f.date === iso(paradeDate()) ? f : null; } catch { return null; }
}
/** How many days until the forecast reaches parade morning (it looks 16 days ahead). 0 = it's in range. */
export function daysUntilForecast(now = new Date()): number {
  return Math.max(0, Math.ceil((paradeDate(now).getTime() - now.getTime()) / 864e5) - 15);
}

export async function paradeForecast(): Promise<Forecast> {
  const d = paradeDate(), day = iso(d);
  if (daysUntilForecast() > 0) throw new Error('too-early');
  const j = await get(`${API}?latitude=40.7549&longitude=-73.984&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph&timezone=America%2FNew_York&start_date=${day}&end_date=${day}`);
  const H = j.hourly, hours: Forecast['hours'] = []; let dx = 0, dy = 0;
  (H.time as string[]).forEach((t, i) => {
    const h = +t.slice(11, 13); if (h < 9 || h > 12 || H.wind_speed_10m[i] == null) return;
    hours.push({ h, s: H.wind_speed_10m[i], g: H.wind_gusts_10m[i] ?? H.wind_speed_10m[i] });
    const a = (H.wind_direction_10m[i] || 0) * Math.PI / 180; dx += Math.sin(a); dy += Math.cos(a);
  });
  if (!hours.length) throw new Error('no-hours');
  const f: Forecast = {
    sustained: Math.max(...hours.map(h => h.s)), gust: Math.max(...hours.map(h => h.g)),
    dir: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, hours, at: Date.now(), date: day, past: Date.now() > d.getTime() + 3 * 36e5,
  };
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* private mode */ }
  return f;
}

export function verdict(f: Forecast | null): Verdict {
  if (!f) {
    const n = daysUntilForecast();
    return n > 0 ? { tone: 'wait', word: 'Too early', line: `forecast opens in ${n} day${n === 1 ? '' : 's'}` } : { tone: 'wait', word: 'Checking…', line: 'reading the Midtown forecast' };
  }
  const g = Math.round(f.gust), s = Math.round(f.sustained);
  const over = f.sustained > LIMIT_S || f.gust > LIMIT_G;
  const near = f.sustained > LIMIT_S * 0.85 || f.gust > LIMIT_G * 0.85;
  const why = f.gust > LIMIT_G || f.gust / LIMIT_G >= f.sustained / LIMIT_S ? `gusts ${g} mph` : `wind ${s} mph`;
  if (f.past) return over ? { tone: 'no', word: 'Too windy', line: `${why} that morning` } : { tone: 'yes', word: 'They flew', line: `${why} that morning` };
  if (over) return { tone: 'no', word: 'Likely NO', line: why };
  if (near) return { tone: 'edge', word: 'On the edge', line: why };
  return { tone: 'yes', word: 'Likely YES', line: why };
}

export const SAMPLE: Wind = { sustained: 9, gust: 17, dir: 290, source: 'sample', label: 'Practice breeze' };
export const windFromForecast = (f: Forecast): Wind => ({ sustained: f.sustained, gust: f.gust, dir: f.dir, source: 'parade', label: 'Parade Day forecast' });

/** Live wind where the player is. The spot is rounded to about 7 miles before it's sent to the weather service. */
export function liveWind(): Promise<Wind> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('no-geo')); return; }
    navigator.geolocation.getCurrentPosition(async p => {
      try {
        const la = p.coords.latitude.toFixed(1), lo = p.coords.longitude.toFixed(1);
        const j = await get(`${API}?latitude=${la}&longitude=${lo}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph`);
        const c = j.current; res({ sustained: c.wind_speed_10m, gust: Math.max(c.wind_gusts_10m ?? 0, c.wind_speed_10m), dir: c.wind_direction_10m || 0, source: 'live', label: 'Live wind near you' });
      } catch (e) { rej(e as Error); }
    }, e => rej(new Error(e.code === 1 ? 'geo-denied' : 'geo-failed')), { maximumAge: 6e5, timeout: 10000 });
  });
}
