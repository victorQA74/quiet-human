import * as T from 'three';
import { LEVELS } from '../game/levels.js';
import { block, mesh, material, makeProp, makeShelter, makeNest, woodTexture } from './objects.js';
import { makeSpiderCharacter, makeHandCharacter } from './characters.js';
import { HAND_SHAPES } from '../game/hand.js';

export class GameScene {
  constructor(canvas, assets) {
    this.canvas = canvas; this.assets = assets;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 650 ? 1.25 : 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.35;
    this.scene = new T.Scene(); this.scene.background = new T.Color('#201e29');
    this.scene.fog = new T.Fog('#201e29', 40, 85);
    this.camera = new T.OrthographicCamera(-16, 16, 10, -10, 0.1, 120);
    this.yaw = -0.12; this.menu = true; this.target = new T.Vector3();
    this.raycaster = new T.Raycaster(); this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.scene.add(new T.HemisphereLight('#c3d2ef', '#725345', 2.1));
    const key = new T.DirectionalLight('#ffdfaf', 3.1); key.position.set(5, 17, 3); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, far: 50 });
    key.shadow.normalBias = 0.035; key.shadow.bias = -0.0003; this.scene.add(key);
    const rim = new T.DirectionalLight('#8da3ef', 1.8); rim.position.set(-12, 9, -12); this.scene.add(rim);
    const ground = new T.Mesh(new T.PlaneGeometry(180, 180), material('#282630')); ground.rotation.x = -Math.PI / 2; ground.position.y = -2.15; ground.receiveShadow = true; this.scene.add(ground);
    const top = new T.Mesh(new T.BoxGeometry(24, 0.65, 18), new T.MeshStandardMaterial({ map: woodTexture(), roughness: 0.86 }));
    top.position.y = -0.35; top.receiveShadow = true; top.castShadow = true; this.scene.add(top);
    block(this.scene, '#8a644f', 0, -0.8, 0, 23.85, 0.35, 17.85);
    for (const x of [-10.5, 10.5]) for (const z of [-7.5, 7.5]) block(this.scene, '#4c4140', x, -1.5, z, 0.4, 2.2, 0.4);
    this.makeLamp(); this.makeAtmosphere();
    this.player = makeSpiderCharacter(assets.spider); this.scene.add(this.player.group);
    this.handCharacter = makeHandCharacter(assets.hand); this.hand = this.handCharacter.group; this.scene.add(this.hand);
    this.warning = new T.Group();
    for (const shape of HAND_SHAPES) {
      const region = this.disc('#ef6659', 1, 0.14); region.position.set(shape.x, 0, shape.z); region.scale.set(shape.rx, 1, shape.rz); this.warning.add(region);
    }
    this.scene.add(this.warning);
    this.scan = this.disc('#f1c37d', 3.3, 0.07); this.scene.add(this.scan);
    this.aim = this.disc('#f1bc79', 0.72, 0.1);
    const arrow = new T.Line(new T.BufferGeometry().setFromPoints([
      new T.Vector3(-0.28, 0.06, -1.12), new T.Vector3(0, 0.06, -0.84), new T.Vector3(0.28, 0.06, -1.12),
    ]), new T.LineBasicMaterial({ color: '#f1bc79', transparent: true, opacity: 0.85 }));
    this.aim.add(arrow); this.scene.add(this.aim);
    this.clickMarker = this.disc('#dcefc0', 0.3, 0.35); this.scene.add(this.clickMarker); this.clickMarker.visible = false;
    this.webGroup = new T.Group(); this.scene.add(this.webGroup); this.webs = new Map();
    this.levelGroup = new T.Group(); this.scene.add(this.levelGroup); this.babyModels = []; this.levelCache = new Map();
    this.resize();
    this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize);
  }

  makeLamp() {
    const lamp = new T.Group(); lamp.position.set(13.9, -2, -5);
    mesh(new T.CylinderGeometry(1.8, 2, 0.35, 32), material('#526063', 0.35, 0.4), lamp, 0, 0.2);
    mesh(new T.CylinderGeometry(0.13, 0.13, 13, 12), material('#526063', 0.35, 0.4), lamp, 0, 6.6);
    block(lamp, '#526063', -1.5, 13, 0, 3.2, 0.18, 0.18);
    mesh(new T.ConeGeometry(1.7, 1.4, 32, 1, true), material('#6e8d85', 0.4), lamp, -3, 12.5);
    const bulb = new T.Mesh(new T.SphereGeometry(0.4, 12, 8), new T.MeshBasicMaterial({ color: '#ffdeb0' })); bulb.position.set(-3, 12.1, 0); lamp.add(bulb);
    this.scene.add(lamp);
    const light = new T.PointLight('#ffd6a0', 55, 25, 2); light.position.set(10.8, 10, -5); this.scene.add(light);
  }

  makeAtmosphere() {
    // A single points draw call for dust; no unbounded particle creation.
    const points = [];
    for (let i = 0; i < 70; i++) points.push(Math.sin(i * 8.7) * 17, 1 + (i % 11) * 0.6, Math.cos(i * 3.1) * 13);
    this.dust = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(points, 3)), new T.PointsMaterial({ color: '#f4deba', size: 0.035, transparent: true, opacity: 0.4, depthWrite: false }));
    this.scene.add(this.dust);
  }

  disc(color, radius, opacity = 0.18) {
    const g = new T.Group();
    const fill = new T.Mesh(new T.CircleGeometry(radius, 64), new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide }));
    const ring = new T.Mesh(new T.RingGeometry(radius - 0.045, radius, 64), new T.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(opacity * 3, 0.9), depthWrite: false, side: T.DoubleSide }));
    fill.rotation.x = ring.rotation.x = -Math.PI / 2; fill.position.y = 0.04; ring.position.y = 0.045;
    g.add(fill, ring); return g;
  }

  setLevel(index) {
    for (const web of this.webs.values()) { this.webGroup.remove(web); web.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    this.webs.clear();
    if (this.levelIndex === index) return;
    this.scene.remove(this.levelGroup);
    this.renderer.shadowMap.needsUpdate = true;
    if (this.levelCache.has(index)) {
      const cached = this.levelCache.get(index);
      this.levelGroup = cached.group; this.babyModels = cached.babies; this.nest = cached.nest;
      this.scene.add(this.levelGroup); this.levelIndex = index; return;
    }
    this.levelGroup = new T.Group(); this.scene.add(this.levelGroup);
    const level = LEVELS[index]; this.babyModels = [];
    for (const o of level.obstacles) this.levelGroup.add(makeProp(o));
    for (const h of level.shelters) this.levelGroup.add(makeShelter(h));
    this.nest = makeNest(level.exit); this.levelGroup.add(this.nest);
    for (const b of level.babies) {
      const baby = makeSpiderCharacter(this.assets.spider, true); baby.group.position.set(b.x, 0.025, b.z); this.levelGroup.add(baby.group);
      const halo = this.disc('#d2e8aa', 0.55, 0.12); halo.position.set(b.x, 0.02, b.z); this.levelGroup.add(halo);
      this.babyModels.push({ ...baby, halo, angle: 0 });
    }
    this.levelIndex = index;
    this.levelCache.set(index, { group: this.levelGroup, babies: this.babyModels, nest: this.nest });
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.width = w; this.height = h;
    this.updateCamera();
  }

  updateCamera() {
    const aspect = this.width / this.height;
    const span = Math.max(20.5, 31 / aspect);
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2;
    const shift = this.menu && this.width > 750 ? -5.2 : 0;
    this.target.set(shift, 0, this.width < 650 ? 0.4 : -0.4);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * 25, 29, this.target.z + Math.cos(this.yaw) * 25);
    this.camera.lookAt(this.target); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  lowerResolution() {
    const ratio = this.renderer.getPixelRatio();
    if (ratio > 0.55) { this.renderer.setPixelRatio(Math.max(0.55, ratio * 0.78)); this.resize(); }
  }

  rotate(amount) { this.yaw += amount; this.updateCamera(); }
  resetCamera() { this.yaw = -0.12; this.updateCamera(); }
  screen(point, y = 0.1) {
    const v = new T.Vector3(point.x, y, point.z).project(this.camera);
    return { x: (v.x + 1) * this.width / 2, y: (-v.y + 1) * this.height / 2 };
  }
  world(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new T.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const p = new T.Vector3(); return this.raycaster.ray.intersectPlane(this.plane, p) ? { x: p.x, z: p.z } : null;
  }

  render(s, time, reduced = false) {
    if (this.levelIndex !== s.levelIndex) this.setLevel(s.levelIndex);
    const menu = s.status === 'menu';
    if (this.menu !== menu) { this.menu = menu; this.updateCamera(); }
    const p = s.player;
    this.player.group.position.set(menu ? 1.5 : p.x, 0.015, menu ? 5.6 : p.z);
    this.player.group.scale.setScalar(menu ? 1.65 : 0.95); this.player.group.rotation.y = menu ? -0.5 : p.angle;
    this.player.group.visible = p.invincible <= 0 || Math.floor(time * 12) % 2 === 0;
    this.player.animate(s.elapsed, p.moving && s.status === 'playing', reduced);
    this.babyModels.forEach((b, i) => {
      const data = s.babies[i];
      b.group.position.set(data.x, 0.015, data.z);
      b.group.rotation.y = data.rescued ? data.angle : reduced ? 0 : Math.sin(s.elapsed * 1.5 + i) * 0.12;
      b.halo.visible = !data.rescued;
      b.animate(s.elapsed + i, data.moving && s.status === 'playing', reduced);
    });
    const h = s.hand;
    this.hand.position.set(h.pose.x, h.pose.y, h.pose.z);
    this.handCharacter.animate(h.pose);
    this.warning.visible = ['warning', 'strike'].includes(h.phase) && !menu;
    this.warning.position.set(h.target.x, 0, h.target.z); this.warning.rotation.y = h.target.angle ?? 0;
    this.aim.visible = h.phase === 'track' && !menu;
    this.aim.position.set(h.target.x, 0, h.target.z); this.aim.rotation.y = h.target.angle ?? 0;
    // Pulse opacity only: changing its scale would misrepresent the collision footprint.
    this.warning.traverse(o => { if (o.isMesh) o.material.opacity = (o.geometry.type === 'RingGeometry' ? 0.7 : 0.14) * (reduced ? 1 : 0.85 + Math.sin(s.elapsed * 15) * 0.15); });
    this.scan.visible = h.phase === 'search' && !menu; this.scan.position.set(h.scan.x, 0, h.scan.z);
    this.clickMarker.visible = s.path.length > 0; if (s.path.length) { const end = s.path.at(-1); this.clickMarker.position.set(end.x, 0, end.z); }
    const active = new Set(s.webs.map(w => w.id));
    for (const [id, web] of this.webs) if (!active.has(id)) { this.webGroup.remove(web); web.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.webs.delete(id); }
    for (const w of s.webs) {
      if (!this.webs.has(w.id)) { const g = this.disc('#e8edd5', 1, 0.35); g.position.set(w.x, 0.05, w.z); this.webGroup.add(g); this.webs.set(w.id, g); }
      this.webs.get(w.id).scale.setScalar(Math.min(1, w.life * 0.7));
    }
    this.nest.children[0].material.opacity = s.rescued === s.babies.length ? 1 : 0.45;
    if (!reduced) this.dust.rotation.y = time * 0.012;
    this.renderer.render(this.scene, this.camera);
  }
}
