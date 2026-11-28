// Car seat label reading: lazy Tesseract plus plain regex. Manual entry is the main path; this just pre-fills.
export interface Parsed { model?: string; number?: string; made?: string; maxWlb?: number; maxHin?: number; years?: number }
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let tp: Promise<any> | null = null;
function loadTess(): Promise<any> {
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  return (tp ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = TESS; s.crossOrigin = 'anonymous'; s.onload = () => res((window as any).Tesseract); s.onerror = () => { tp = null; rej(new Error('no ocr')); }; document.head.appendChild(s); }));
}
export async function readLabel(blob: Blob, ms = 45000): Promise<string | null> {
  try {
    const T = await loadTess();
    return await Promise.race([T.recognize(blob, 'eng').then((r: any) => String(r.data.text || '')), new Promise<null>(r => setTimeout(() => r(null), ms))]);
  } catch { return null; }
}
const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const p2 = (n: number) => String(n).padStart(2, '0');
export function parseLabel(text: string): Parsed {
  const t = text.replace(/[|]/g, 'I'), out: Parsed = {};
  const model = t.match(/model\s*(?:name)?\s*(?:no\.?|number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\- ]{2,28})/i); if (model) out.model = model[1].trim();
  const num = t.match(/(?:model|part)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-]{3,18})/i) || t.match(/\b([A-Z]{2,4}-?\d{3,6}[A-Z0-9]{0,4})\b/); if (num) out.number = num[1];
  const dom = t.match(/(?:date\s*of\s*manufacture|manufactured|manufacture\s*date|date)\s*[:.\-]?\s*([A-Za-z0-9 ,\/.\-]{6,22})/i);
  const src = dom ? dom[1] : t;
  let m: RegExpMatchArray | null;
  if ((m = src.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/))) out.made = `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  else if ((m = src.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})\b/))) out.made = `${m[3]}-${p2(+m[1])}-${p2(+m[2])}`;
  else if ((m = src.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})?,?\s*(20\d{2})\b/i))) out.made = `${m[3]}-${p2(MON[m[1].toLowerCase()])}-${p2(+(m[2] || 1))}`;
  else if ((m = src.match(/\b(20\d{2})[-\/.](\d{1,2})\b/))) out.made = `${m[1]}-${p2(+m[2])}-01`;
  const w = t.match(/(\d{1,3}(?:\.\d)?)\s*(?:-|to|–)\s*(\d{1,3}(?:\.\d)?)\s*(?:lb|lbs|pounds)/i) || t.match(/up\s*to\s*(\d{1,3}(?:\.\d)?)\s*(?:lb|lbs)/i);
  if (w) out.maxWlb = +(w[2] ?? w[1]);
  const h = t.match(/(\d{2,3}(?:\.\d)?)\s*(?:-|to|–)\s*(\d{2,3}(?:\.\d)?)\s*(?:in|inch|inches|")/i) || t.match(/(?:up\s*to|under)\s*(\d{2,3}(?:\.\d)?)\s*(?:in|inch|inches|")/i);
  if (h) out.maxHin = +(h[2] ?? h[1]);
  const y = t.match(/(?:expires?|use\s*(?:by|for|until)|useful\s*life)[^0-9]{0,24}(\d{1,2})\s*(?:years|yrs|year)/i) || t.match(/(\d{1,2})\s*years?\s*(?:from|after)\s*(?:the\s*)?date/i);
  if (y) out.years = +y[1];
  return out;
}
export const NHTSA = 'https://www.nhtsa.gov/recalls';
/** Checked Nov 2026: api.nhtsa.gov has no working open child-seat recall endpoint (product queries ignore the seat type or need a key), so we link to the official recall search. */
export const nhtsaLink = (_model: string) => NHTSA;
