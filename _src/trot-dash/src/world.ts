// The town, the turkey and the camera. Everything is built from simple shapes in code.
import * as THREE from 'three';
import { BASE_V, COURSE_M, HALF_W, MILE_M, WU, ghostAt, hash, rivalDist, rivalX } from './sim';
import type { Ghost, Sim, Weather } from './sim';

export type Tier = 0 | 1 | 2;
export type Cam = 'front' | 'chase' | 'side';

const TIERS = [
  { pr: 1, leaves: 70, runners: 8, precip: 140, far: 105 },
  { pr: 1.5, leaves: 170, runners: 12, precip: 300, far: 135 },
  { pr: 2, leaves: 320, runners: 16, precip: 560, far: 165 },
];

const LOOK = {
  clear: { top: '#2D5BFF', mid: '#FF74B0', low: '#FFB08C', road: '#DDB3A0', grass: '#7AA868', sun: true, near: 34 },
  rain: { top: '#262F6E', mid: '#8A5C93', low: '#B48AA0', road: '#B8988E', grass: '#5E8959', sun: false, near: 18 },
  frost: { top: '#4E73FF', mid: '#FF9CC8', low: '#FFD0D6', road: '#E7D2CB', grass: '#B5D2B8', sun: true, near: 26 },
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const ICO = new THREE.IcosahedronGeometry(1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 7);
const ROOF = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
const DISC = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
const ROUND = new THREE.CircleGeometry(1, 28);
const QUAD = new THREE.PlaneGeometry(1, 1);
const WEDGE = new THREE.CylinderGeometry(1, 1, 1, 5, 1, false, 0, Math.PI / 2.3);
const SHARED = new Set<THREE.BufferGeometry>([BOX, ICO, CYL, CONE, ROOF, DISC, ROUND, QUAD, WEDGE]);

type V3 = [number, number, number];
const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const flat = (c: number, o = 1) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, s: V3, p: V3) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(p[0], p[1], p[2]);
  parent.add(m);
  return m;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadow(parent: THREE.Object3D, w: number, len: number) {
  const m = add(parent, DISC, flat(0x161340, 0.26), [w, 1, len], [-len * 0.16, 0.03, len * 0.9]);
  m.rotation.y = -0.17;
  return m;
}

interface Bird {
  g: THREE.Group;
  inner: THREE.Group;
  legs: THREE.Group[];
  wings: THREE.Mesh[];
  tail: THREE.Group;
}

function makeBird(bib: THREE.Texture | null, ghost: THREE.Material | null): Bird {
  const M = (c: number) => ghost ?? lam(c);
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  add(inner, ICO, M(0x7b4a2b), [0.56, 0.52, 0.72], [0, 1.0, 0]);
  add(inner, ICO, M(0x9a6238), [0.42, 0.4, 0.4], [0, 0.97, -0.42]);
  add(inner, CYL, M(0x8a5631), [0.1, 0.52, 0.1], [0, 1.5, -0.5]).rotation.x = -0.25;
  add(inner, ICO, M(0x8fb7d9), [0.2, 0.2, 0.22], [0, 1.83, -0.6]);
  add(inner, CONE, M(0xffb23a), [0.07, 0.24, 0.07], [0, 1.8, -0.9]).rotation.x = -Math.PI / 2;
  add(inner, ICO, M(0xe0322b), [0.06, 0.15, 0.06], [0, 1.62, -0.78]);
  if (!ghost) {
    const eye = flat(0x161340);
    add(inner, ICO, eye, [0.045, 0.045, 0.045], [0.13, 1.88, -0.72]);
    add(inner, ICO, eye, [0.045, 0.045, 0.045], [-0.13, 1.88, -0.72]);
    add(inner, CYL, lam(0xffffff), [0.21, 0.07, 0.23], [0, 1.95, -0.6]);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 1.08, 0.5);
  tail.rotation.x = 0.32;
  inner.add(tail);
  const cols = [0xff6a1f, 0xf4d9b0, 0x9a4a1f];
  for (let i = 0; i < 9; i++) {
    const pv = new THREE.Group();
    pv.rotation.z = ((i - 4) / 4) * 1.22;
    tail.add(pv);
    add(pv, BOX, M(cols[i % 3]), [0.21, 1.0, 0.05], [0, 0.55, 0]);
    add(pv, BOX, M(i % 3 === 1 ? 0xff6a1f : 0xf4d9b0), [0.22, 0.2, 0.06], [0, 1.02, 0]);
  }
  if (bib && !ghost) {
    const bm = new THREE.MeshBasicMaterial({ map: bib });
    add(tail, QUAD, bm, [0.7, 0.52, 1], [0, 0.5, 0.07]);
    add(inner, QUAD, bm, [0.5, 0.37, 1], [0, 0.98, -0.84]).rotation.y = Math.PI;
  }
  const wings = [-1, 1].map((s) => add(inner, ICO, M(0x6a3f24), [0.12, 0.32, 0.44], [s * 0.56, 1.02, 0.02]));
  const legs = [-1, 1].map((s) => {
    const pv = new THREE.Group();
    pv.position.set(s * 0.2, 0.62, 0);
    inner.add(pv);
    add(pv, CYL, M(0xffa23a), [0.05, 0.6, 0.05], [0, -0.3, 0]);
    add(pv, BOX, M(0x2d5bff), [0.17, 0.11, 0.32], [0, -0.57, -0.07]);
    return pv;
  });
  g.scale.setScalar(1.15);
  return { g, inner, legs, wings, tail };
}

const SHIRTS = [0x2d5bff, 0xff74b0, 0xff6a1f, 0x7aa868, 0xf2c14e, 0xf4f1ea];
const SKINS = [0xf1c9a5, 0xd9a078, 0xa86f4a, 0x7a4b2e, 0xe8b48c];

interface Runner {
  g: THREE.Group;
  legs: THREE.Group[];
  arms: THREE.Group[];
  shirt: THREE.MeshLambertMaterial;
  skin: THREE.MeshLambertMaterial;
  costumes: THREE.Group[];
  rival: number;
}

function makeRunner(): Runner {
  const g = new THREE.Group();
  const shirt = lam(0xffffff);
  const skin = lam(0xf1c9a5);
  const shorts = lam(0x161340);
  add(g, BOX, shirt, [0.6, 0.72, 0.34], [0, 1.32, 0]);
  add(g, BOX, shorts, [0.62, 0.26, 0.36], [0, 0.92, 0]);
  add(g, ICO, skin, [0.21, 0.23, 0.21], [0, 1.94, 0]);
  add(g, BOX, lam(0xffffff), [0.32, 0.24, 0.02], [0, 1.36, 0.18]);
  const legs = [-1, 1].map((s) => {
    const pv = new THREE.Group();
    pv.position.set(s * 0.16, 0.86, 0);
    g.add(pv);
    add(pv, BOX, skin, [0.19, 0.8, 0.19], [0, -0.4, 0]);
    add(pv, BOX, lam(0xffffff), [0.2, 0.12, 0.34], [0, -0.8, -0.06]);
    return pv;
  });
  const arms = [-1, 1].map((s) => {
    const pv = new THREE.Group();
    pv.position.set(s * 0.39, 1.62, 0);
    g.add(pv);
    add(pv, BOX, skin, [0.14, 0.6, 0.14], [0, -0.28, 0]);
    return pv;
  });
  const cg = () => {
    const c = new THREE.Group();
    c.visible = false;
    g.add(c);
    return c;
  };
  const pilgrim = cg();
  add(pilgrim, CYL, lam(0x1c1a2e), [0.19, 0.32, 0.19], [0, 2.3, 0]);
  add(pilgrim, CYL, lam(0x1c1a2e), [0.36, 0.04, 0.36], [0, 2.15, 0]);
  add(pilgrim, BOX, lam(0xf2c14e), [0.14, 0.1, 0.02], [0, 2.22, 0.19]);
  const pumpkin = cg();
  add(pumpkin, ICO, lam(0xff7a1f), [0.56, 0.5, 0.5], [0, 1.3, 0]);
  add(pumpkin, CYL, lam(0x5e8959), [0.05, 0.16, 0.05], [0, 2.22, 0]);
  const pie = cg();
  add(pie, CYL, lam(0xd9a45b), [0.37, 0.14, 0.37], [0, 2.2, 0]);
  add(pie, CYL, lam(0xe2701f), [0.31, 0.05, 0.31], [0, 2.28, 0]);
  add(pie, ICO, lam(0xffffff), [0.11, 0.09, 0.11], [0, 2.35, 0]);
  const corn = cg();
  add(corn, CONE, lam(0xf2c14e), [0.2, 0.66, 0.2], [0, 2.45, 0]);
  add(corn, CONE, lam(0x7aa868), [0.13, 0.42, 0.06], [0.17, 2.3, 0]).rotation.z = -0.5;
  add(corn, CONE, lam(0x7aa868), [0.13, 0.42, 0.06], [-0.17, 2.3, 0]).rotation.z = 0.5;
  const tutu = cg();
  add(tutu, CONE, lam(0xff74b0), [0.66, 0.3, 0.66], [0, 0.98, 0]);
  add(tutu, CYL, lam(0xff74b0), [0.23, 0.05, 0.23], [0, 2.12, 0]);
  const beanie = cg();
  add(beanie, ICO, lam(0xff6a1f), [0.24, 0.2, 0.24], [0, 2.06, 0]);
  add(beanie, ICO, lam(0xffffff), [0.09, 0.09, 0.09], [0, 2.3, 0]);
  shadow(g, 0.4, 2.3);
  return { g, legs, arms, shirt, skin, costumes: [pilgrim, pumpkin, pie, corn, tutu, beanie], rival: -1 };
}

interface Strip {
  items: THREE.Object3D[];
  slots: number[];
  spacing: number;
  place: (o: THREE.Object3D, slot: number) => void;
}

const HOUSE = [0xf4e4c9, 0xc8553d, 0x4b4a9c, 0x4f9a94, 0xf2c14e, 0xe9a3b8, 0xfaf5ee];
const ROOFS = [0x582959, 0x161340, 0x8b3a2b, 0x3a3566];
const TREES = [0xff6a1f, 0xe9a21f, 0xc8402b, 0xf2c14e, 0x7aa868, 0xff8a3a];

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 1, 0.3, 520);
  private tier: Tier = 1;
  private weather: Weather = 'clear';
  private far = 135;
  private T = 0;
  private gait = 0;
  private fov = 72;
  private baseFov = 72;
  private camPos = new THREE.Vector3(0, 2, -6);
  private camAim = new THREE.Vector3(0, 1.3, 0);
  private bibNo = 15;
  private bibTex!: THREE.CanvasTexture;
  private bird!: Bird;
  private birdShadow!: THREE.Mesh;
  private ghostBird!: Bird;
  private runners: Runner[] = [];
  private strips: Strip[] = [];
  private bobbers: THREE.Object3D[] = [];
  private road!: THREE.Mesh;
  private grass!: THREE.Mesh;
  private roadTex!: THREE.Texture;
  private grassTex!: THREE.Texture;
  private sun: THREE.Object3D | null = null;
  private light!: THREE.DirectionalLight;
  private puddles: THREE.Object3D[] = [];
  private piles: THREE.Object3D[] = [];
  private pies: THREE.Group[] = [];
  private obsPtr = 0;
  private ring!: THREE.Mesh;
  private ringT = 9;
  private leaves!: THREE.Points;
  private leafV = new Float32Array(0);
  private leafPh = new Float32Array(0);
  private leafB = new Uint8Array(0);
  private precip: THREE.Object3D | null = null;
  private pBase = new Float32Array(0);

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.configure(1, 'clear');
  }

  setBib(n: number) {
    this.bibNo = n;
    this.drawBib();
  }

  private drawBib() {
    const cv = this.bibTex.image as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fffdf7';
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = '#FF6A1F';
    c.fillRect(0, 0, 256, 46);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 26px Outfit, sans-serif';
    c.fillText('TROT DASH 5K', 128, 25);
    c.fillStyle = '#161340';
    c.font = '700 124px Outfit, sans-serif';
    c.fillText(String(this.bibNo), 128, 124);
    this.bibTex.needsUpdate = true;
  }

  /** Rebuilds the whole scene for a detail level and a kind of weather. */
  configure(tier: Tier, weather: Weather) {
    this.tier = tier;
    this.weather = weather;
    const cfg = TIERS[tier];
    const look = LOOK[weather];
    this.far = cfg.far;
    this.clear();
    const sc = this.scene;

    const sky = canvasTex(4, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, look.top);
      g.addColorStop(0.33, look.mid);
      g.addColorStop(0.47, look.low);
      g.addColorStop(1, look.low);
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 256);
    });
    sc.background = sky;
    sc.fog = new THREE.Fog(new THREE.Color(look.low), look.near, cfg.far);

    sc.add(new THREE.HemisphereLight(0xffdcec, 0x7d6a94, weather === 'rain' ? 1.9 : 2.3));
    this.light = new THREE.DirectionalLight(weather === 'rain' ? 0xc9c2e0 : 0xffc890, weather === 'rain' ? 0.9 : 2.4);
    sc.add(this.light, this.light.target);

    // Ground
    const speck = (c: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[], seed: number) => {
      for (let i = 0; i < n; i++) {
        c.fillStyle = cols[i % cols.length];
        const s = 1 + hash(seed + i * 3) * 3;
        c.fillRect(hash(seed + i * 3 + 1) * w, hash(seed + i * 3 + 2) * h, s, s);
      }
    };
    this.roadTex = canvasTex(128, 256, (c) => {
      c.fillStyle = look.road;
      c.fillRect(0, 0, 128, 256);
      speck(c, 128, 256, 260, ['rgba(22,19,64,0.10)', 'rgba(255,255,255,0.16)'], 10);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(61, 10, 6, 110);
      c.fillRect(3, 0, 3, 256);
      c.fillRect(122, 0, 3, 256);
      if (weather === 'frost') speck(c, 128, 256, 240, ['rgba(255,255,255,0.75)'], 500);
    });
    this.grassTex = canvasTex(128, 128, (c) => {
      c.fillStyle = look.grass;
      c.fillRect(0, 0, 128, 128);
      speck(c, 128, 128, 220, ['rgba(22,19,64,0.10)', 'rgba(255,224,130,0.25)', 'rgba(255,106,31,0.35)'], 900);
      if (weather === 'frost') speck(c, 128, 128, 300, ['rgba(255,255,255,0.8)'], 1500);
    });
    const L = 420;
    for (const t of [this.roadTex, this.grassTex]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
    }
    this.roadTex.repeat.set(1, L / 16);
    this.grassTex.repeat.set(300 / 12, L / 12);
    this.grass = add(sc, QUAD, new THREE.MeshLambertMaterial({ map: this.grassTex }), [300, L, 1], [0, -0.03, 0]);
    this.grass.rotation.x = -Math.PI / 2;
    const curb = add(sc, QUAD, lam(0xa9857b), [HALF_W * 2 + 1.5, L, 1], [0, -0.015, 0]);
    curb.rotation.x = -Math.PI / 2;
    this.grass.add(curb);
    curb.rotation.x = 0;
    curb.scale.set((HALF_W * 2 + 1.5) / 300, 1, 1);
    curb.position.set(0, 0, 0.015);
    this.road = add(sc, QUAD, new THREE.MeshLambertMaterial({ map: this.roadTex }), [HALF_W * 2, L, 1], [0, 0, 0]);
    this.road.rotation.x = -Math.PI / 2;

    // Sun
    this.sun = null;
    if (look.sun) {
      const s = new THREE.Group();
      const core = new THREE.MeshBasicMaterial({ color: 0xfff0b8, fog: false });
      add(s, ROUND, core, [15, 15, 1], [0, 0, 0]);
      const glowTex = canvasTex(128, 128, (c) => {
        const g = c.createRadialGradient(64, 64, 6, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,226,150,0.9)');
        g.addColorStop(0.4, 'rgba(255,150,120,0.35)');
        g.addColorStop(1, 'rgba(255,116,176,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
      });
      const glow = new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      add(s, QUAD, glow, [120, 120, 1], [0, 0, -1]);
      sc.add(s);
      this.sun = s;
    }

    // Arches and lines
    const arch = (z: number, text: string, bg: string) => {
      const g = new THREE.Group();
      const tex = canvasTex(512, 96, (c) => {
        c.fillStyle = bg;
        c.fillRect(0, 0, 512, 96);
        c.fillStyle = '#fff';
        c.font = '700 64px Outfit, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, 256, 52);
      });
      add(g, BOX, new THREE.MeshBasicMaterial({ map: tex }), [HALF_W * 2 + 1.8, 1.4, 0.3], [0, 5.3, 0]);
      const post = lam(0x161340);
      add(g, CYL, post, [0.2, 6, 0.2], [HALF_W + 0.6, 3, 0]);
      add(g, CYL, post, [0.2, 6, 0.2], [-HALF_W - 0.6, 3, 0]);
      const check = canvasTex(128, 16, (c) => {
        for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
          c.fillStyle = (i + j) % 2 ? '#161340' : '#ffffff';
          c.fillRect(i * 8, j * 8, 8, 8);
        }
      });
      check.magFilter = THREE.NearestFilter;
      add(g, QUAD, new THREE.MeshBasicMaterial({ map: check }), [HALF_W * 2, 1.05, 1], [0, 0.02, 0]).rotation.x = -Math.PI / 2;
      g.position.z = z;
      sc.add(g);
    };
    arch(0, 'START', '#2D5BFF');
    for (let n = 1; n <= 3; n++) arch(-n * MILE_M * WU, `MILE ${n}`, '#FF6A1F');
    arch(-COURSE_M * WU, 'FINISH', '#FF74B0');

    // Scenery strips
    this.strips = [];
    this.bobbers = [];
    const win = flat(0xffe6a0);
    win.side = THREE.DoubleSide;
    const door = lam(0x582959);
    door.side = THREE.DoubleSide;
    const trunk = lam(0x6a4630);
    const pole = lam(0x3a3566);
    const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false });
    const keys = [0, MILE_M * WU, MILE_M * 2 * WU, MILE_M * 3 * WU, COURSE_M * WU];
    for (const side of [-1, 1]) {
      const sd = side > 0 ? 7 : 3;
      const h = (slot: number, k: number) => hash(slot * 31 + sd + k * 1009);
      this.strip(9, 3, () => {
        const g = new THREE.Group();
        const bm = lam(0xffffff);
        const rm = lam(0xffffff);
        const body = add(g, BOX, bm, [1, 1, 1], [0, 0, 0]);
        const roof = add(g, ROOF, rm, [1, 1, 1], [0, 0, 0]);
        const w1 = add(g, QUAD, win, [1.1, 1.3, 1], [0, 0, 0]);
        const w2 = add(g, QUAD, win, [1.1, 1.3, 1], [0, 0, 0]);
        const dr = add(g, QUAD, door, [1.1, 2.1, 1], [0, 0, 0]);
        for (const q of [w1, w2, dr]) q.rotation.y = -side * Math.PI / 2;
        g.userData = { body, roof, w1, w2, dr, bm, rm };
        return g;
      }, (o, slot) => {
        const u = o.userData;
        const w = 5 + h(slot, 1) * 3;
        const ht = 4 + h(slot, 2) * 4.6;
        o.position.set(side * (HALF_W + 4.8 + w / 2 + h(slot, 3) * 2.6), 0, -(slot + 0.5) * 9);
        u.body.scale.set(w, ht, 6.6);
        u.body.position.y = ht / 2;
        u.bm.color.setHex(HOUSE[Math.floor(h(slot, 4) * HOUSE.length)]);
        u.roof.scale.set(w * 0.8, 2.9, 6.6 * 0.8);
        u.roof.position.y = ht + 1.45;
        u.rm.color.setHex(ROOFS[Math.floor(h(slot, 5) * ROOFS.length)]);
        const fx = -side * (w / 2 + 0.04);
        u.w1.position.set(fx, ht * 0.6, -1.7);
        u.w2.position.set(fx, ht * 0.6, 1.7);
        u.w1.visible = h(slot, 6) > 0.25;
        u.w2.visible = h(slot, 7) > 0.4;
        u.dr.position.set(fx, 1.05, 0);
      });
      this.strip(7, 2, () => {
        const g = new THREE.Group();
        const fm = lam(0xffffff);
        add(g, CYL, trunk, [0.17, 1.7, 0.17], [0, 0.85, 0]);
        add(g, ICO, fm, [1.25, 1.35, 1.25], [0, 2.7, 0]);
        add(g, ICO, fm, [0.8, 0.85, 0.8], [0.5, 3.5, 0.2]);
        shadow(g, 1.0, 4.2);
        g.userData = { fm };
        return g;
      }, (o, slot) => {
        o.visible = h(slot, 11) > 0.22;
        const s = 0.8 + h(slot, 12) * 0.6;
        o.scale.setScalar(s);
        o.position.set(side * (HALF_W + 2.1 + h(slot, 13) * 1.4), 0, -(slot + 0.3 + h(slot, 14) * 0.4) * 7);
        o.userData.fm.color.setHex(weather === 'frost' && h(slot, 16) > 0.6 ? 0xf3ece6 : TREES[Math.floor(h(slot, 15) * TREES.length)]);
      });
      this.strip(22, 2, () => {
        const g = new THREE.Group();
        add(g, CYL, pole, [0.07, 3.6, 0.07], [0, 1.8, 0]);
        add(g, ICO, lampGlow, [0.24, 0.24, 0.24], [0, 3.7, 0]);
        return g;
      }, (o, slot) => {
        o.position.set(side * (HALF_W + 0.95), 0, -(slot + (side > 0 ? 0.25 : 0.75)) * 22);
      });
      this.strip(1.5, 2, () => {
        const g = new THREE.Group();
        const sm = lam(0xffffff);
        add(g, BOX, sm, [0.46, 0.95, 0.3], [0, 0.78, 0]);
        add(g, ICO, lam(SKINS[this.bobbers.length % SKINS.length]), [0.18, 0.2, 0.18], [0, 1.48, 0]);
        add(g, BOX, sm, [0.12, 0.5, 0.12], [0.3, 1.5, 0]);
        g.userData = { sm, ph: 0 };
        this.bobbers.push(g);
        return g;
      }, (o, slot) => {
        const z = (slot + 0.5) * 1.5;
        let near = false;
        for (const k of keys) if (Math.abs(z - k) < 24) near = true;
        o.visible = h(slot, 21) < (near ? 0.8 : 0.1);
        o.position.set(side * (HALF_W + 0.75 + h(slot, 22) * 0.9), 0, -z);
        o.userData.sm.color.setHex(SHIRTS[Math.floor(h(slot, 23) * SHIRTS.length)]);
        o.userData.ph = h(slot, 24) * 6.28;
      });
    }

    // Things on the road
    this.puddles = [];
    this.piles = [];
    this.pies = [];
    const water = flat(0x9db2ff, 0.82);
    const shine = flat(0xffd0e2, 0.75);
    const pileA = lam(0xff7a1f);
    const pileB = lam(0xd9432b);
    const pileC = lam(0xf2c14e);
    const crust = lam(0xd9a45b);
    crust.side = THREE.DoubleSide;
    const fill = lam(0xe86a1c);
    fill.side = THREE.DoubleSide;
    const halo = flat(0xffd75e, 0.45);
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Group();
      add(p, DISC, water, [1.25, 1, 0.95], [0, 0.02, 0]);
      add(p, DISC, shine, [0.6, 1, 0.3], [0.25, 0.025, -0.25]);
      p.visible = false;
      sc.add(p);
      this.puddles.push(p);
      const l = new THREE.Group();
      add(l, ICO, pileA, [1, 0.5, 1], [0, 0.2, 0]);
      add(l, ICO, pileB, [0.55, 0.36, 0.55], [0.45, 0.22, 0.3]);
      add(l, ICO, pileC, [0.5, 0.3, 0.5], [-0.45, 0.2, 0.25]);
      l.visible = false;
      sc.add(l);
      this.piles.push(l);
    }
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      const spin = new THREE.Group();
      add(spin, WEDGE, crust, [0.62, 0.24, 0.62], [-0.2, 0, -0.25]);
      add(spin, WEDGE, fill, [0.54, 0.26, 0.54], [-0.18, 0.01, -0.22]);
      add(spin, ICO, lam(0xffffff), [0.13, 0.1, 0.13], [0.02, 0.17, 0.02]);
      p.add(spin);
      add(p, DISC, halo, [0.75, 1, 0.75], [0, 0.03, 0]);
      p.userData = { spin };
      p.visible = false;
      sc.add(p);
      this.pies.push(p);
    }
    const ringM = flat(0xdfe8ff, 0.8);
    ringM.side = THREE.DoubleSide;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2), ringM);
    this.ring.visible = false;
    sc.add(this.ring);

    // Runners
    this.bibTex = canvasTex(256, 192, () => {});
    this.drawBib();
    this.bird = makeBird(this.bibTex, null);
    sc.add(this.bird.g);
    this.birdShadow = shadow(sc, 0.55, 2.7);
    const gm = new THREE.MeshBasicMaterial({ color: 0xd6e2ff, transparent: true, opacity: 0.36, depthWrite: false });
    this.ghostBird = makeBird(null, gm);
    this.ghostBird.g.visible = false;
    sc.add(this.ghostBird.g);
    this.runners = [];
    for (let i = 0; i < cfg.runners; i++) {
      const r = makeRunner();
      r.g.visible = false;
      sc.add(r.g);
      this.runners.push(r);
    }

    this.makeLeaves(cfg.leaves);
    this.makePrecip(weather === 'clear' ? 0 : cfg.precip);
    this.obsPtr = 0;
    this.resize();
  }

  private strip(spacing: number, extra: number, make: () => THREE.Object3D, place: (o: THREE.Object3D, slot: number) => void) {
    const n = Math.ceil((this.far + 22) / spacing) + extra;
    const items: THREE.Object3D[] = [];
    for (let i = 0; i < n; i++) {
      const o = make();
      this.scene.add(o);
      items.push(o);
    }
    this.strips.push({ items, slots: new Array(n).fill(NaN), spacing, place });
  }

  private clear() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !SHARED.has(m.geometry)) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        const map = (mat as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        mat.dispose();
      }
    });
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    this.scene.clear();
  }

  private makeLeaves(n: number) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.leafV = new Float32Array(n);
    this.leafPh = new Float32Array(n);
    this.leafB = new Uint8Array(n);
    const cs = [new THREE.Color(0xff6a1f), new THREE.Color(0xf2c14e), new THREE.Color(0xd9432b), new THREE.Color(0xa85a2a)];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 13;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = -Math.random() * 80;
      this.leafPh[i] = Math.random();
      this.leafV[i] = -(0.5 + this.leafPh[i]);
      const c = cs[i % 4];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = canvasTex(32, 32, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(16, 16, 14, 8, 0.6, 0, 6.3);
      c.fill();
    });
    const mat = new THREE.PointsMaterial({ size: 0.34, map: tex, vertexColors: true, transparent: true, alphaTest: 0.4 });
    this.leaves = new THREE.Points(geo, mat);
    this.leaves.frustumCulled = false;
    this.scene.add(this.leaves);
  }

  private makePrecip(n: number) {
    this.precip = null;
    if (!n) return;
    this.pBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.pBase[i * 3] = (Math.random() * 2 - 1) * 11;
      this.pBase[i * 3 + 1] = Math.random() * 11;
      this.pBase[i * 3 + 2] = Math.random() * 46;
    }
    const geo = new THREE.BufferGeometry();
    if (this.weather === 'rain') {
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      this.precip = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.55 }));
    } else {
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const tex = canvasTex(16, 16, (c) => {
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(8, 8, 7, 0, 6.3);
        c.fill();
      });
      this.precip = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.13, map: tex, color: 0xffffff, transparent: true, alphaTest: 0.3 }));
    }
    this.precip.frustumCulled = false;
    this.scene.add(this.precip);
  }

  /** Start of a new race. */
  reset() {
    this.obsPtr = 0;
    this.ringT = 9;
    for (const r of this.runners) r.rival = -1;
  }

  /** Leaves fly up, or a puddle ripples. */
  burst(d: number, x: number, what: 'puddle' | 'leaves') {
    const z = -d * WU;
    if (what === 'puddle') {
      this.ring.position.set(x, 0.06, z);
      this.ringT = 0;
    }
    const pos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = Math.min(what === 'leaves' ? 26 : 8, this.leafV.length);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * this.leafV.length);
      pos.setXYZ(i, x + (Math.random() - 0.5) * 1.4, 0.3, z - Math.random() * 2.5);
      this.leafV[i] = 3.5 + Math.random() * 4;
      this.leafB[i] = 1;
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[this.tier].pr));
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.baseFov = w < h ? 74 : 56;
    this.cam.updateProjectionMatrix();
  }

  /** Draws the current view into a 2D canvas, cropped to fill the box. */
  snapshot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    this.renderer.render(this.scene, this.cam);
    const el = this.renderer.domElement;
    const s = Math.max(w / el.width, h / el.height);
    const sw = w / s;
    const sh = h / s;
    ctx.drawImage(el, (el.width - sw) / 2, (el.height - sh) / 2, sw, sh, x, y, w, h);
  }

  private animBird(b: Bird, phase: number, y: number, vx: number, stumble: number, sprint: boolean) {
    const sw = Math.sin(phase);
    b.legs[0].rotation.x = sw * 0.95;
    b.legs[1].rotation.x = -sw * 0.95;
    b.inner.position.y = Math.abs(Math.cos(phase)) * 0.07;
    b.inner.rotation.z = -vx * 0.03;
    b.inner.rotation.y = -vx * 0.045;
    b.inner.rotation.x = -0.5 * stumble - (sprint ? 0.16 : 0);
    b.tail.rotation.z = Math.sin(phase * 0.5) * 0.05;
    const flap = y > 0.05 ? 0.5 + Math.sin(this.T * 30) * 0.7 : Math.sin(phase) * 0.08;
    b.wings[0].rotation.z = -flap;
    b.wings[1].rotation.z = flap;
  }

  frame(sim: Sim, dt: number, cam: Cam, ghost: Ghost | null) {
    this.T += dt;
    const T = this.T;
    const pz = -sim.d * WU;
    const dist = sim.d * WU;
    const speed = sim.v / BASE_V;
    const lookBack = cam === 'front';

    // Scenery
    for (const s of this.strips) {
      const n = s.items.length;
      const back = lookBack ? n - Math.ceil(10 / s.spacing) - 1 : Math.ceil(16 / s.spacing);
      const base = Math.floor(dist / s.spacing) - back;
      for (let k = 0; k < n; k++) {
        const slot = base + k;
        const i = ((slot % n) + n) % n;
        if (s.slots[i] !== slot) {
          s.slots[i] = slot;
          s.place(s.items[i], slot);
        }
      }
    }
    for (const b of this.bobbers) if (b.visible) b.position.y = Math.abs(Math.sin(T * 5 + b.userData.ph)) * 0.22;

    // Road items
    const obs = sim.obstacles;
    while (this.obsPtr < obs.length && obs[this.obsPtr].d < sim.d - 26) this.obsPtr++;
    let ip = 0, il = 0, ie = 0;
    const farM = (this.far / WU) * 0.92;
    for (let i = this.obsPtr; i < obs.length && obs[i].d < sim.d + farM; i++) {
      const o = obs[i];
      const z = -o.d * WU;
      if (o.kind === 'pie') {
        if (o.hit || ie >= this.pies.length) continue;
        const p = this.pies[ie++];
        p.visible = true;
        p.position.set(o.x, 0, z);
        const spin = p.userData.spin as THREE.Group;
        spin.rotation.y = T * 2.6;
        spin.position.y = 1.05 + Math.sin(T * 3 + i) * 0.12;
      } else if (o.kind === 'puddle') {
        if (ip >= this.puddles.length) continue;
        const p = this.puddles[ip++];
        p.visible = true;
        p.position.set(o.x, 0, z);
        p.scale.setScalar(o.r);
      } else {
        if (il >= this.piles.length) continue;
        const p = this.piles[il++];
        p.visible = true;
        p.position.set(o.x, 0, z);
        p.scale.set(o.r, o.hit ? 0.3 : 1, o.r);
      }
    }
    for (; ip < this.puddles.length; ip++) this.puddles[ip].visible = false;
    for (; il < this.piles.length; il++) this.piles[il].visible = false;
    for (; ie < this.pies.length; ie++) this.pies[ie].visible = false;
    if (this.ringT < 0.6) {
      this.ringT += dt;
      const k = this.ringT / 0.6;
      this.ring.visible = true;
      this.ring.scale.setScalar(0.5 + k * 2.4);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    } else this.ring.visible = false;

    // Other runners
    let slot = 0;
    for (let i = 0; i < sim.rivals.length && slot < this.runners.length; i++) {
      const rv = sim.rivals[i];
      const dz = (rivalDist(rv, sim.t) - sim.d) * WU;
      if (dz < -13 || dz > this.far * 0.85) continue;
      const r = this.runners[slot++];
      if (r.rival !== i) {
        r.rival = i;
        r.costumes.forEach((c, k) => (c.visible = k === rv.costume));
        r.shirt.color.setHex(SHIRTS[rv.shirt]);
        r.skin.color.setHex(SKINS[i % SKINS.length]);
      }
      const ph = T * (7 + rv.v * 0.22) + rv.phase;
      const sw = Math.sin(ph);
      r.g.visible = true;
      r.g.position.set(rivalX(rv, sim.t), Math.abs(Math.cos(ph)) * 0.06, pz - dz);
      r.legs[0].rotation.x = sw * 0.9;
      r.legs[1].rotation.x = -sw * 0.9;
      r.arms[0].rotation.x = -sw * 0.9;
      r.arms[1].rotation.x = sw * 0.9;
    }
    for (; slot < this.runners.length; slot++) {
      this.runners[slot].g.visible = false;
      this.runners[slot].rival = -1;
    }

    // Turkey
    this.gait += dt * (cam === 'front' || sim.t === 0 ? 8 : 5 + speed * 9);
    const stumble = Math.max(0, Math.min(1, sim.stumbleT / 0.6));
    this.bird.g.position.set(sim.x, sim.y, pz);
    this.animBird(this.bird, this.gait, sim.y, sim.vx, stumble, sim.sprintT > 0);
    this.birdShadow.position.set(sim.x - 0.45 - sim.y * 0.3, 0.03, pz + 2.5 + sim.y * 1.2);
    const gb = this.ghostBird;
    if (ghost && cam === 'chase') {
      const g = ghostAt(ghost, sim.t);
      gb.g.visible = true;
      gb.g.position.set(g.x, 0, -g.d * WU);
      this.animBird(gb, this.gait + 1.3, 0, 0, 0, false);
    } else gb.g.visible = false;

    // Camera, eased
    let px: number, py: number, pzc: number, ax: number, ay: number, az: number, rate: number;
    if (cam === 'chase') {
      px = sim.x * 0.72; py = 3.5 + sim.y * 0.22; pzc = pz + 5.6;
      ax = sim.x * 0.86; ay = 1.7; az = pz - 9; rate = 6;
    } else if (cam === 'front') {
      const a = Math.sin(T * 0.28) * 0.55;
      // aim low so the turkey sits above the buttons
      px = sim.x + Math.sin(a) * 7.2; py = 2.4; pzc = pz - Math.cos(a) * 7.2;
      ax = sim.x; ay = -0.7; az = pz; rate = 3;
    } else {
      px = sim.x + 6.6; py = 2.5; pzc = pz - 4.2;
      ax = sim.x; ay = -1.5; az = pz - 0.6; rate = 2.2;
    }
    const k = 1 - Math.exp(-dt * rate);
    const ka = 1 - Math.exp(-dt * rate * 1.6);
    if (Math.abs(this.camPos.z - pzc) > 90) {
      this.camPos.set(px, py, pzc);
      this.camAim.set(ax, ay, az);
    }
    this.camPos.x += (px - this.camPos.x) * k;
    this.camPos.y += (py - this.camPos.y) * k;
    this.camPos.z += (pzc - this.camPos.z) * k;
    this.camAim.x += (ax - this.camAim.x) * ka;
    this.camAim.y += (ay - this.camAim.y) * ka;
    this.camAim.z += (az - this.camAim.z) * ka;
    const wantFov = this.baseFov + (sim.sprintT > 0 && !sim.finished ? 11 : 0) - stumble * 4;
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-dt * 3));
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camAim);
    const cz = this.camPos.z;

    // Ground follows the turkey; the texture slides so it looks fixed to the world.
    this.road.position.z = pz - 120;
    this.grass.position.z = pz - 120;
    const rz = dist + 120;
    this.roadTex.offset.y = (rz / 16) % 1;
    this.grassTex.offset.y = (rz / 12) % 1;
    if (this.sun) this.sun.position.set(34, 15, pz - 330);
    this.light.position.set(30, 22, pz - 90);
    this.light.target.position.set(0, 0, pz);

    // Leaves
    const pos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const front = cz + 5;
    for (let i = 0; i < this.leafV.length; i++) {
      const j = i * 3;
      const ph = this.leafPh[i];
      if (this.leafB[i]) {
        this.leafV[i] -= 12 * dt;
        arr[j] += (ph - 0.5) * 5 * dt;
      }
      arr[j] += Math.sin(T * 1.4 + ph * 40) * 0.9 * dt - 0.35 * dt;
      arr[j + 1] += this.leafV[i] * dt;
      if (arr[j + 1] < 0.04) {
        arr[j + 1] = 7 + ph * 3;
        this.leafB[i] = 0;
        this.leafV[i] = -(0.5 + ph);
      }
      let rel = front - arr[j + 2];
      if (rel < 0 || rel > 80) {
        rel = ((rel % 80) + 80) % 80;
        arr[j + 2] = front - rel;
        arr[j] = (hash(i + Math.floor(T * 7)) * 2 - 1) * 13;
      }
    }
    pos.needsUpdate = true;

    // Rain or frost
    if (this.precip) {
      const pp = (this.precip as unknown as THREE.Points).geometry.getAttribute('position') as THREE.BufferAttribute;
      const pa = pp.array as Float32Array;
      const rain = this.weather === 'rain';
      const n = this.pBase.length / 3;
      const b = this.pBase;
      const fall = rain ? 24 : 1.3;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        b[j + 1] -= fall * dt;
        if (b[j + 1] < 0) b[j + 1] += 11;
        const x = this.camPos.x + b[j] + (rain ? 0 : Math.sin(T + i) * 0.4);
        const z = cz + 3 - ((b[j + 2] + dist) % 46);
        if (rain) {
          pa.set([x, b[j + 1], z, x - 0.12, b[j + 1] + 0.8, z], i * 6);
        } else {
          pa.set([x, b[j + 1], z], j);
        }
      }
      pp.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.clear();
    this.renderer.dispose();
  }
}
