import * as T from 'three';
import { batchOpaque } from './batching.js';

const sphere = new T.SphereGeometry(1, 16, 12);
const cylinder = new T.CylinderGeometry(1, 1, 1, 10);
const box = new T.BoxGeometry(1, 1, 1);
const materials = new Map();
export function material(color, roughness = 0.6, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
export function mesh(geometry, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new T.Mesh(geometry, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const block = (parent, color, x, y, z, w, h, d) => mesh(box, material(color), parent, x, y, z, w, h, d);
export function labelTexture(text, color = '#e9e2d2', background = '#516761') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = color; ctx.font = 'bold 48px Georgia'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 125);
  ctx.globalAlpha = 0.5; ctx.fillRect(130, 160, 252, 2); ctx.font = '16px sans-serif'; ctx.fillText('FIELD NOTES  /  2026', 256, 204);
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace; return texture;
}

export function makeProp(o) {
  const g = new T.Group(); g.position.set(o.x, 0, o.z);
  if (o.type === 'book') {
    block(g, '#e5d7b9', 0, 0.39, 0, o.w * 0.96, 0.56, o.d * 0.96);
    block(g, o.color, 0, 0.08, 0, o.w, 0.16, o.d);
    const cover = block(g, o.color, 0, 0.76, 0, o.w, 0.18, o.d);
    const top = new T.Mesh(new T.PlaneGeometry(o.w * 0.94, o.d * 0.94), new T.MeshStandardMaterial({ map: labelTexture('NOCTURNE', '#e9dfcf', o.color), roughness: 0.8 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.855; g.add(top);
    block(g, o.color, -o.w / 2 + 0.07, 0.43, 0, 0.18, 0.68, o.d);
    block(g, '#302a33', o.w / 2 - 0.4, 0.88, 0, 0.09, 0.04, o.d);
    for (let i = 0; i < 5; i++) block(g, '#c2b59f', 0, 0.2 + i * 0.095, o.d / 2 - 0.01, o.w * 0.95, 0.012, 0.02);
    cover.receiveShadow = true;
  } else if (o.type === 'cup') {
    const r = o.r;
    mesh(new T.CylinderGeometry(r, r * 0.83, 1.8, 40, 1, true), material('#e2e6d9', 0.28), g, 0, 0.98);
    mesh(new T.TorusGeometry(r, 0.075, 8, 40), material('#f2eddf'), g, 0, 1.88).rotation.x = Math.PI / 2;
    mesh(new T.CylinderGeometry(r * 0.94, r * 0.94, 0.05, 40), material('#382820', 0.18), g, 0, 1.74);
    const handle = mesh(new T.TorusGeometry(0.56, 0.16, 8, 24), material('#e2e6d9', 0.28), g, r + 0.15, 1.1);
    handle.scale.set(0.8, 1, 1);
    mesh(new T.CylinderGeometry(r * 1.35, r * 1.3, 0.08, 40), material('#748477'), g, 0, 0.05);
    mesh(new T.TorusGeometry(r * 0.66, 0.025, 6, 32), material('#b68d66'), g, 0, 1.775).rotation.x = Math.PI / 2;
  } else {
    mesh(new T.CylinderGeometry(o.r, o.r * 0.72, 1.4, 24), material('#bd795d'), g, 0, 0.7);
    mesh(new T.CylinderGeometry(o.r * 0.92, o.r * 0.92, 0.05, 24), material('#3b302b'), g, 0, 1.41);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const leaf = mesh(sphere, material(i % 2 ? '#698d72' : '#91a281'), g, Math.cos(a) * 0.6, 2.1 + (i % 3) * 0.4, Math.sin(a) * 0.6, 0.3, 1.05, 0.16);
      leaf.rotation.z = Math.cos(a) * 0.65; leaf.rotation.x = Math.sin(a) * 0.6;
    }
  }
  batchOpaque(g); return g;
}

export function makeShelter(h) {
  const g = new T.Group(); g.position.set(h.x, 0, h.z);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute([
    -1.45, 0.5, -1.15, 0, 1.65, -1.15, -1.45, 0.5, 1.15,
    0, 1.65, -1.15, 0, 1.65, 1.15, -1.45, 0.5, 1.15,
    0, 1.65, -1.15, 1.45, 0.5, -1.15, 0, 1.65, 1.15,
    1.45, 0.5, -1.15, 1.45, 0.5, 1.15, 0, 1.65, 1.15,
  ], 3)); geo.computeVertexNormals();
  const paper = material('#c2d7b9').clone(); paper.side = T.DoubleSide;
  mesh(geo, paper, g);
  const ring = new T.Mesh(new T.RingGeometry(0.95, 1.06, 40), new T.MeshBasicMaterial({ color: '#b9e7bb', transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; g.add(ring);
  return g;
}


export function makeNest(exit) {
  const g = new T.Group(); g.position.set(exit.x, 0.06, exit.z);
  const mat = new T.LineBasicMaterial({ color: '#ccebc6', transparent: true, opacity: 0.65 });
  const points = [];
  for (let r = 0.25; r <= 1.45; r += 0.23) for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, b = (i + 1) * Math.PI / 6;
    points.push(new T.Vector3(Math.cos(a) * r, 0.03, Math.sin(a) * r), new T.Vector3(Math.cos(b) * r, 0.03, Math.sin(b) * r));
  }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; points.push(new T.Vector3(), new T.Vector3(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5)); }
  g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points), mat));
  const light = new T.PointLight('#bdddb8', 4, 4); light.position.y = 1; g.add(light);
  return g;
}

export function woodTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#bd9675'; ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 420; i++) {
    const y = i * 2.7; ctx.strokeStyle = `rgba(88,57,45,${0.025 + (i % 5) * 0.008})`; ctx.lineWidth = 0.6 + (i % 3) * 0.45;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(260, y + Math.sin(i) * 16, 740, y - Math.cos(i) * 12, 1024, y + 6); ctx.stroke();
  }
  for (let i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(68,43,35,0.09)'; ctx.fillRect(0, i * 180, 1024, 2); }
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
