// Brand size charts. All approximate: built from each brand's published height and weight ranges, rounded. Not a fitting.
export interface Row { label: string; hMax: number; wMax?: number } // hMax cm, wMax kg
export interface Brand { id: string; name: string; short: string; color: string; ink: string; family: string; rows: Row[]; kind: 'clothes' | 'shoes' }
const R = (a: [string, number, number?][]): Row[] => a.map(([label, hMax, wMax]) => ({ label, hMax, wMax }));

const CARTERS = R([['NB', 55, 3.8], ['3M', 61, 5.9], ['6M', 67, 7.8], ['9M', 72, 9.3], ['12M', 78, 10.7], ['18M', 82, 11.8], ['24M', 86, 12.7], ['2T', 91, 14.0], ['3T', 97, 15.6], ['4T', 103, 17.2], ['5T', 109, 19.3], ['6', 116, 22], ['7', 122, 25], ['8', 128, 28]]);
const OLDNAVY = R([['NB', 56, 4], ['3M', 62, 6.1], ['6M', 68, 8], ['9M', 73, 9.6], ['12M', 79, 11], ['18M', 83, 12.2], ['24M', 87, 13.2], ['2T', 92, 14.4], ['3T', 98, 16], ['4T', 104, 17.8], ['5T', 110, 20], ['6', 117, 23], ['7', 123, 26], ['8', 129, 29]]);
const CATJACK = R([['NB', 55, 3.6], ['3M', 62, 5.9], ['6M', 68, 7.7], ['9M', 73, 9.5], ['12M', 78, 10.9], ['18M', 83, 12.2], ['24M', 87, 13.2], ['2T', 91, 14.5], ['3T', 97, 16], ['4T', 103, 17.8], ['5T', 108, 19.5], ['S 6', 117, 22.5], ['M 7/8', 128, 29], ['L 10/12', 142, 40]]);
const HM = R([50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122, 128, 134].map(n => [String(n), n + 3] as [string, number]));

export const CLOTHES: Brand[] = [
  { id: 'carters', name: "Carter's", short: 'Carters', color: '#1D6FB8', ink: '#fff', family: 'Georgia, serif', rows: CARTERS, kind: 'clothes' },
  { id: 'oldnavy', name: 'Old Navy', short: 'Old Navy', color: '#0A2A5E', ink: '#fff', family: 'Inter, sans-serif', rows: OLDNAVY, kind: 'clothes' },
  { id: 'catjack', name: 'Cat & Jack', short: 'Cat & Jack', color: '#CC0000', ink: '#fff', family: 'Inter, sans-serif', rows: CATJACK, kind: 'clothes' },
  { id: 'hm', name: 'H&M', short: 'H&M', color: '#E50010', ink: '#fff', family: 'Georgia, serif', rows: HM, kind: 'clothes' },
];
export const CARTERS_BRAND = CLOTHES[0];

// Shoes. Insole length (cm) of a US size S: S 4 to 13 are toddler/little kid sizes 4 to 13, S 14 to 20 are youth 1Y to 7Y.
// Anchors from common Brannock-style charts: toddler 4 = 12.1 cm, kid 13 = 19.7 cm (a third of an inch a size), 1Y = 20.3 cm, then about 0.7 cm a size to 7Y = 24.5 cm.
export const SHOE_MIN = 4, SHOE_MAX = 20;
export const insole = (S: number) => (S <= 13 ? 12.1 + (S - 4) * (7.6 / 9) : 20.3 + (S - 14) * 0.7);
/** Smallest size whose insole is at least `cm` long (foot plus room). Kept inside toddler 4 to 7Y. */
export const sizeFor = (cm: number) => { let S = SHOE_MIN; while (S < SHOE_MAX && insole(S) < cm - 1e-9) S++; return S; };
export const usLabel = (S: number) => (S <= 13 ? `${S}` : `${S - 13}Y`);
export const euOf = (S: number) => Math.round(insole(S) * 1.5 + 1.5);
export const STRIDE = { id: 'striderite', name: 'Stride Rite', color: '#00539F', ink: '#fff', family: 'Georgia, serif' };

export const HAND_SIZES = CARTERS.map(r => r.label);
export const HAND_SHOES = Array.from({ length: SHOE_MAX - SHOE_MIN + 1 }, (_, i) => usLabel(SHOE_MIN + i));
export const sizeIdx = (label: string) => CARTERS.findIndex(r => r.label === label);
export const shoeNum = (label: string) => (label.endsWith('Y') ? 13 + parseFloat(label) : parseFloat(label));

const q = encodeURIComponent;
export interface Pick { brand: string; color: string; ink: string; family: string; label: string; url: string }
/** Links go to each store's own search. No prices, no logos: text in the brand's colour. */
export function picks(cat: 'clothes' | 'shoes', s: Record<string, string>, shoeUS: string): Pick[] {
  const out: Pick[] = [];
  if (cat === 'clothes') {
    const mk = (b: Brand, label: string, url: string) => out.push({ brand: b.name, color: b.color, ink: b.ink, family: b.family, label, url });
    for (const t of ['pants', 'pajamas', 'long sleeve tops']) mk(CLOTHES[0], `${s.carters} ${t}`, `https://www.carters.com/search?q=${q(`${s.carters} ${t}`)}`);
    for (const t of ['jeans', 'hoodie']) mk(CLOTHES[1], `${s.oldnavy} ${t}`, `https://oldnavy.gap.com/browse/search.do?searchText=${q(`${s.oldnavy} ${t}`)}`);
    for (const t of ['leggings', 'jacket', 'sweatshirt']) mk(CLOTHES[2], `${s.catjack} ${t}`, `https://www.target.com/s?searchTerm=${q(`cat & jack ${s.catjack} ${t}`)}`);
    for (const t of ['joggers', 'sweater']) mk(CLOTHES[3], `${s.hm} ${t}`, `https://www2.hm.com/en_us/search-results.html?q=${q(`${s.hm} ${t}`)}`);
  } else {
    for (const t of ['sneakers', 'boots', 'sandals']) out.push({ brand: STRIDE.name, color: STRIDE.color, ink: STRIDE.ink, family: STRIDE.family, label: `size ${shoeUS} ${t}`, url: `https://www.striderite.com/search?q=${q(`${t} ${shoeUS}`)}` });
    out.push({ brand: 'Cat & Jack', color: '#CC0000', ink: '#fff', family: 'Inter, sans-serif', label: `size ${shoeUS} shoes`, url: `https://www.target.com/s?searchTerm=${q(`cat & jack shoes size ${shoeUS}`)}` });
  }
  return out;
}
