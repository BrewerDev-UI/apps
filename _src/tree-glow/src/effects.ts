// Light layer and full-screen effects, drawn with three.js (WebGL).
// Shaders are small, written for this app: frost edges, glass bokeh, a shock ring, and snow.
import * as THREE from 'three';

export type Fx = { frost: boolean; bokeh: boolean; shock: boolean; snow: boolean };
export type FrameState = { time: number; tiltX: number; tiltY: number; shockAge: number; fx: Fx };

export const CAP = 600; // most lights drawn at once

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Output is premultiplied colour, so layers stack with "over".
const BG_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uTilt;
uniform float uFrost;
uniform float uBokeh;
uniform float uSnow;
uniform float uShock;
uniform float uShockAge;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 over(vec4 d, vec4 s) { return s + d * (1.0 - s.a); }

void main() {
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec4 col = vec4(0.0);

  if (uFrost > 0.5) {
    float e = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
    float edge = smoothstep(0.55, 1.0, e);
    float crys = smoothstep(0.6, 0.95, hash(floor(gl_FragCoord.xy / (7.0 * uDpr))));
    float a = edge * (0.10 + 0.22 * crys);
    col = over(col, vec4(vec3(0.93, 0.96, 0.94) * a, a));
  }

  if (uBokeh > 0.5) {
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      float h1 = hash(vec2(fi, 1.7));
      float h2 = hash(vec2(fi, 3.1));
      float h3 = hash(vec2(fi, 5.3));
      vec2 c = (vec2(h1, h2) - 0.5) * vec2(asp, 1.0) * 0.9;
      c += uTilt * (0.02 + 0.04 * h3);
      c.y += sin(uTime * 0.25 + fi * 1.3) * 0.02;
      float r = 0.06 + 0.07 * h3;
      float a = (1.0 - smoothstep(r * 0.6, r, length(p - c))) * 0.14;
      vec3 bc = mix(vec3(1.0, 0.78, 0.42), vec3(0.6, 0.8, 1.0), h2);
      col = over(col, vec4(bc * a, a));
    }
  }

  if (uSnow > 0.5) {
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float s = mix(22.0, 13.0, fl) * uDpr;
      float spd = mix(28.0, 55.0, fl) * uDpr;
      vec2 q = vec2(gl_FragCoord.x, gl_FragCoord.y + uTime * spd);
      vec2 cid = floor(q / s);
      vec2 f = fract(q / s);
      float h1 = hash(cid + fl * 17.0);
      float h2 = hash(cid + 31.0 + fl * 17.0);
      vec2 c = vec2(0.15 + 0.7 * h1, 0.15 + 0.7 * h2);
      float r = mix(0.10, 0.07, fl);
      float d = length((f - c) * s);
      float a = (1.0 - smoothstep(r * s * 0.4, r * s, d)) * (0.5 + 0.25 * fl);
      col = over(col, vec4(vec3(0.96, 0.98, 1.0) * a, a));
    }
  }

  if (uShock > 0.5) {
    float rr = uShockAge * 0.75;
    float d = abs(length(p) - rr);
    float a = (1.0 - smoothstep(0.0, 0.035, d)) * max(0.0, 1.0 - uShockAge * 0.6) * 0.55;
    col = over(col, vec4(vec3(1.0, 0.85, 0.55) * a, a));
  }

  gl_FragColor = col;
}`;

const PT_VERT = `
attribute float aBright;
attribute vec3 aCol;
uniform float uPx;
varying float vB;
varying vec3 vC;
void main() {
  vB = aBright;
  vC = aCol;
  gl_Position = vec4(position.xy, 0.0, 1.0);
  gl_PointSize = uPx * (0.7 + 0.6 * aBright);
}`;

const PT_FRAG = `
precision highp float;
varying float vB;
varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = length(d);
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.35, r);
  float halo = exp(-r * r * 4.5);
  float a = clamp((halo * 0.5 + core) * vB, 0.0, 1.0);
  vec3 c = mix(vC, vec3(1.0), core * 0.55);
  gl_FragColor = vec4(c * a, a);
}`;

export class Glow {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private bgMat: THREE.ShaderMaterial;
  private ptMat: THREE.ShaderMaterial;
  private geo = new THREE.BufferGeometry();
  private pos = new Float32Array(CAP * 3);
  private bright = new Float32Array(CAP);
  private col = new Float32Array(CAP * 3);
  private posAttr: THREE.BufferAttribute;
  private brAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.r = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    this.r.setClearColor(0x000000, 0);

    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BG_FRAG,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uFrost: { value: 0 },
        uBokeh: { value: 0 },
        uSnow: { value: 0 },
        uShock: { value: 0 },
        uShockAge: { value: 0 },
      },
    });

    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.brAttr = new THREE.BufferAttribute(this.bright, 1).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('aBright', this.brAttr);
    this.geo.setAttribute('aCol', this.colAttr);
    this.geo.setDrawRange(0, 0);

    this.ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT,
      fragmentShader: PT_FRAG,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: { uPx: { value: 16 } },
    });

    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = 0;
    const pts = new THREE.Points(this.geo, this.ptMat);
    pts.frustumCulled = false;
    pts.renderOrder = 1;
    this.scene.add(bg, pts);
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.r.setPixelRatio(this.dpr);
    this.r.setSize(cssW, cssH, false);
    (this.bgMat.uniforms.uRes.value as THREE.Vector2).set(cssW * this.dpr, cssH * this.dpr);
    this.bgMat.uniforms.uDpr.value = this.dpr;
    this.ptMat.uniforms.uPx.value = Math.max(8, cssW * 0.03) * this.dpr;
  }

  // xy holds clip-space x,y pairs (-1..1). bright and col are per light.
  setLights(n: number, xy: Float32Array, bright: Float32Array, col: Float32Array) {
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = xy[i * 2];
      this.pos[i * 3 + 1] = xy[i * 2 + 1];
      this.pos[i * 3 + 2] = 0;
      this.bright[i] = bright[i];
      this.col[i * 3] = col[i * 3];
      this.col[i * 3 + 1] = col[i * 3 + 1];
      this.col[i * 3 + 2] = col[i * 3 + 2];
    }
    this.posAttr.needsUpdate = true;
    this.brAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }

  frame(s: FrameState) {
    const u = this.bgMat.uniforms;
    u.uTime.value = s.time;
    (u.uTilt.value as THREE.Vector2).set(s.tiltX, s.tiltY);
    u.uFrost.value = s.fx.frost ? 1 : 0;
    u.uBokeh.value = s.fx.bokeh ? 1 : 0;
    u.uSnow.value = s.fx.snow ? 1 : 0;
    u.uShock.value = s.fx.shock && s.shockAge >= 0 ? 1 : 0;
    u.uShockAge.value = s.shockAge;
    this.r.render(this.scene, this.cam);
  }
}
