// The clay dancer, drawn with three.js (MIT). A capsule mannequin placed joint by joint from the pose maths.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { joints, type Pose } from './pose';

const rad = Math.PI / 180;
function clayTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!; g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { const v = 96 + Math.random() * 64, r = 1 + Math.random() * 5; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, r, r * (0.4 + Math.random()), Math.random() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}
function fadeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!, r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, '#fff'); r.addColorStop(0.55, '#888'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export default function Dancer({ getPose, mini = false, lift = 0.1 }: { getPose: () => Pose; mini?: boolean; lift?: number }) {
  const host = useRef<HTMLDivElement>(null), get = useRef(getPose); get.current = getPose;
  useEffect(() => {
    const el = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { el.classList.add('nogl'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !mini; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const bump = clayTexture();
    const clay = new THREE.MeshPhysicalMaterial({ color: 0xb9805f, roughness: 0.82, metalness: 0, bumpMap: bump, bumpScale: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0xffd2b0), sheenRoughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1233, roughness: 0.4 });
    const band = new THREE.MeshPhysicalMaterial({ color: 0xff6b2c, roughness: 0.7, bumpMap: bump, bumpScale: 0.6 });
    const body = new THREE.Group(); scene.add(body);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material = clay) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; body.add(m); return m; };
    const cap = (r: number, len: number) => add(new THREE.CapsuleGeometry(r, len, 6, 16));
    const ball = (r: number, mat?: THREE.Material) => add(new THREE.SphereGeometry(r, 24, 18), mat);
    const P = {
      torso: cap(0.15, 0.34), pelvis: ball(0.155), chest: ball(0.17), neck: cap(0.05, 0.08), head: ball(0.14),
      lUA: cap(0.06, 0.28), lFA: cap(0.052, 0.26), rUA: cap(0.06, 0.28), rFA: cap(0.052, 0.26),
      lTh: cap(0.08, 0.43), lSn: cap(0.066, 0.42), rTh: cap(0.08, 0.43), rSn: cap(0.066, 0.42),
      lSh: ball(0.075), rSh: ball(0.075), lHand: ball(0.066), rHand: ball(0.066), lFoot: ball(0.08), rFoot: ball(0.08),
      eyeL: ball(0.016, dark), eyeR: ball(0.016, dark), band: add(new THREE.TorusGeometry(0.133, 0.02, 10, 40), band),
    };
    P.pelvis.scale.set(1.22, 0.8, 0.9); P.chest.scale.set(1.3, 0.95, 0.85); P.head.scale.set(1, 1.08, 1);
    P.lFoot.scale.set(0.95, 0.6, 1.7); P.rFoot.scale.set(0.95, 0.6, 1.7);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0x2a3fd0, roughness: 0.9, transparent: true, alphaMap: fadeTexture(), depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x1a1040, 1.1));
    const spot = new THREE.SpotLight(0xfff0dc, 5.5, 0, 0.42, 0.75, 0); spot.position.set(0.9, 5, 3.2); spot.target.position.set(0, 0.5, 0); spot.castShadow = !mini;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.radius = 5; scene.add(spot, spot.target);
    const rimA = new THREE.DirectionalLight(0xff5c9a, 3.4); rimA.position.set(-2.6, 2, -3); scene.add(rimA);
    const rimB = new THREE.DirectionalLight(0xff6b2c, 2.6); rimB.position.set(2.8, 1.4, -2.6); scene.add(rimB);

    const UP = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const place = (m: THREE.Mesh, A: number[], B: number[]) => { a.fromArray(A); b.fromArray(B); m.position.copy(a).add(b).multiplyScalar(0.5); d.copy(b).sub(a).normalize(); m.quaternion.setFromUnitVectors(UP, d); };
    const cross = (ang: number) => Math.max(0, -Math.sin(ang * rad)) * 0.15;

    let az = 0, elv = 0.1, drag = false, lx = 0, ly = 0, idle = 0, dist = 6, raf = 0, dead = false;
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      const k = 2 * Math.tan(15 * rad); dist = Math.max(2.5 / k, (mini ? 1.75 : 1.85) / (cam.aspect * k));
    };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    const cv = renderer.domElement;
    const down = (e: PointerEvent) => { drag = true; lx = e.clientX; ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } };
    const move = (e: PointerEvent) => { if (!drag) return; az = Math.max(-1.3, Math.min(1.3, az - (e.clientX - lx) * 0.009)); elv = Math.max(-0.05, Math.min(0.7, elv + (e.clientY - ly) * 0.006)); lx = e.clientX; ly = e.clientY; idle = performance.now(); };
    const up = () => { drag = false; idle = performance.now(); };
    if (!mini) { cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); }

    const frame = () => {
      if (dead) return; raf = requestAnimationFrame(frame);
      const q = get.current(), J = joints(q), t = performance.now() / 1000;
      // Arms that cross the body come forward a little so they don't sink into the chest.
      const z = (v: number[], dz: number) => [v[0], v[1], v[2] + dz];
      const lEl = z(J.lEl, 0.03 + cross(q.a[0])), lWr = z(J.lWr, 0.05 + cross(q.a[0]) + cross(q.a[1])), rEl = z(J.rEl, 0.03 + cross(q.a[2])), rWr = z(J.rWr, 0.05 + cross(q.a[2]) + cross(q.a[3]));
      place(P.torso, J.hipC, J.shC); place(P.neck, J.shC, J.head); P.torso.scale.set(1.12, 1, 0.84);
      P.pelvis.position.fromArray(J.hipC); P.chest.position.fromArray(J.shC).lerp(a.fromArray(J.hipC), 0.22); P.chest.rotation.set(0, q.t * rad, -q.l * rad);
      place(P.lUA, J.lSh, lEl); place(P.lFA, lEl, lWr); place(P.rUA, J.rSh, rEl); place(P.rFA, rEl, rWr);
      place(P.lTh, J.lHip, J.lKn); place(P.lSn, J.lKn, J.lAn); place(P.rTh, J.rHip, J.rKn); place(P.rSn, J.rKn, J.rAn);
      P.lSh.position.fromArray(J.lSh); P.rSh.position.fromArray(J.rSh);
      const hand = (m: THREE.Mesh, E: number[], W: number[]) => { a.fromArray(E); b.fromArray(W); m.position.copy(b).add(d.copy(b).sub(a).normalize().multiplyScalar(0.05)); };
      hand(P.lHand, lEl, lWr); hand(P.rHand, rEl, rWr);
      P.lFoot.position.set(J.lAn[0] - 0.01, J.lAn[1] - 0.03, 0.06); P.rFoot.position.set(J.rAn[0] + 0.01, J.rAn[1] - 0.03, 0.06);
      const hx = J.head[0], hy = J.head[1], tilt = -q.l * rad * 1.2, turn = q.t * rad * 0.6;
      P.head.position.set(hx, hy, 0.01); P.head.rotation.set(0, turn, tilt);
      P.band.position.set(hx - Math.sin(tilt) * 0.05, hy + 0.05, 0.01); P.band.rotation.set(Math.PI / 2 - 0.12, tilt, 0);
      P.eyeL.position.set(hx - 0.05 + Math.sin(turn) * 0.1, hy + 0.005, 0.135); P.eyeR.position.set(hx + 0.05 + Math.sin(turn) * 0.1, hy + 0.005, 0.135);
      if (!mini && !drag && performance.now() - idle > 2200) { az += (Math.sin(t * 0.45) * 0.22 - az) * 0.025; elv += (0.1 - elv) * 0.03; }
      const viewH = 2 * dist * Math.tan(15 * rad), ty = 0.92 - lift * viewH;
      cam.position.set(Math.sin(az) * Math.cos(elv) * dist, ty + Math.sin(elv) * dist, Math.cos(az) * Math.cos(elv) * dist); cam.lookAt(0, ty, 0);
      renderer.render(scene, cam);
    };
    frame();
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); bump.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* fine */ } cv.remove(); };
  }, [mini, lift]);
  return <div ref={host} className={mini ? 'dancer mini' : 'dancer'} />;
}
