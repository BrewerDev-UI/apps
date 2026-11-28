// Share card (a small picture) and the calendar reminder file.
import type { Settings } from './data';
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const p2 = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;

/** A repeating "measure the kids" event on the chosen weekday and time, every N weeks. */
export function makeIcs(s: Pick<Settings, 'every' | 'day' | 'hour' | 'min'>, now = new Date()): string {
  const first = new Date(now); first.setHours(s.hour, s.min, 0, 0); first.setDate(first.getDate() + ((s.day - first.getDay() + 7) % 7)); if (first <= now) first.setDate(first.getDate() + 7);
  const end = new Date(first.getTime() + 15 * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Size Up//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:size-up-${stamp(first)}@size-up`, `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(first)}`, `DTEND:${stamp(end)}`, `RRULE:FREQ=WEEKLY;INTERVAL=${s.every};BYDAY=${DAYS[s.day]}`, 'SUMMARY:Measure the kids (Size Up)', 'DESCRIPTION:Height and weight, then open Size Up.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Measure the kids', 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function downloadIcs(s: Pick<Settings, 'every' | 'day' | 'hour' | 'min'>) { save(new Blob([makeIcs(s)], { type: 'text/calendar' }), 'size-up-reminder.ics'); }

/** Draws a 1080x1350 card and opens the share sheet, or downloads it. */
export async function shareCard(line: string, sub: string, color: string) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#F5F3EE'); g.addColorStop(1, '#E7E4DA'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = '#C9C77E'; x.fillRect(0, 0, 1080, 26);
  x.fillStyle = color; x.beginPath(); x.arc(150, 250, 28, 0, 7); x.fill();
  x.fillStyle = '#2F3320'; x.font = '800 44px "Bricolage Grotesque", Georgia, serif'; x.fillText('Size Up', 200, 266);
  const words = line.split(' '); let ln = '', y = 560; x.font = '800 104px "Bricolage Grotesque", Georgia, serif';
  for (const w of words) { const t = ln ? ln + ' ' + w : w; if (x.measureText(t).width > 880 && ln) { x.fillText(ln, 100, y); ln = w; y += 120; } else ln = t; }
  x.fillText(ln, 100, y);
  x.fillStyle = '#5C6045'; x.font = '500 40px Inter, system-ui, sans-serif'; x.fillText(sub, 100, y + 100);
  x.fillStyle = '#8A8E70'; x.font = '500 30px Inter, system-ui, sans-serif'; x.fillText('Estimates from growth charts, not a fitting.', 100, 1250);
  const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), 'image/png')), file = new File([blob], 'size-up.png', { type: 'image/png' }), nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: 'Size Up', text: line }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
  save(blob, 'size-up.png');
}
