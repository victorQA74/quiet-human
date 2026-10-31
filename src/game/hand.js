import { BOARD } from './levels.js';

export const HAND = Object.freeze({ descent: 0.24, hold: 0.14, recovery: 1.5, hover: 6.8, bodyContact: 0.54,
  tracking: 0.95, reachSpeed: 18, turnSpeed: 3, aimHeight: 5.7 });
// Contact-local XZ footprint: palm, four fingers and opposing thumb.
// Rotate this same geometry for the warning and the player's circular body.
export const HAND_SHAPES = Object.freeze([
  { x: 0, z: 0, rx: 1.04, rz: 1.26 },
  { x: 0.44, z: 1.79, rx: 0.25, rz: 0.94 },
  { x: -0.07, z: 1.87, rx: 0.25, rz: 1.08 },
  { x: -0.55, z: 1.68, rx: 0.26, rz: 0.94 },
  { x: -0.86, z: 1.29, rx: 0.26, rz: 0.79 },
  { x: 1.14, z: 0.58, rx: 0.59, rz: 0.79 },
]);
const smooth = v => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// A seated human reaches from the far edge of the table: fingers lead, arm trails.
const aimAngle = target => Math.atan2(target.x, target.z + 16);
const aimAt = target => ({ x: target.x, z: target.z, angle: aimAngle(target) });

// Exact distance-to-ellipse boundary (bounded bisection), including body radius.
export function ellipseHitsCircle(x, z, shape, radius = BOARD.radius) {
  const px = Math.abs(x - shape.x), pz = Math.abs(z - shape.z), a = shape.rx, b = shape.rz;
  if ((px / a) ** 2 + (pz / b) ** 2 <= 1) return true;
  let low = 0, high = Math.max(a, b) * Math.hypot(px, pz);
  for (let i = 0; i < 32; i++) {
    const t = (low + high) / 2;
    if ((a * px / (t + a * a)) ** 2 + (b * pz / (t + b * b)) ** 2 > 1) low = t;
    else high = t;
  }
  const qx = a * a * px / (high + a * a), qz = b * b * pz / (high + b * b);
  return Math.hypot(px - qx, pz - qz) <= radius + 1e-7;
}
export function handHits(player, target) {
  const dx = player.x - target.x, dz = player.z - target.z;
  const c = Math.cos(target.angle ?? 0), s = Math.sin(target.angle ?? 0);
  return HAND_SHAPES.some(shape => ellipseHitsCircle(dx * c - dz * s, dx * s + dz * c, shape));
}
export function createHand(level) {
  const pose = { x: 3, y: HAND.hover, z: 0, curl: 0.1, angle: aimAngle({ x: 3, z: 0 }) };
  return { phase: 'search', timer: level.handWait, duration: level.handWait, attention: 0,
    target: aimAt(pose), scan: aimAt(pose), contacted: false, contactY: 0, from: { ...pose }, pose };
}
export function handPhase(h, phase, duration) {
  h.from = { ...h.pose }; h.phase = phase; h.timer = duration; h.duration = duration;
  if (phase === 'warning') { h.contacted = false; h.contactY = 0; }
}
export function sampleHandPose(h) {
  if (h.phase === 'track') return { ...h.pose };
  const elapsed = Math.max(0, h.duration - h.timer);
  const target = h.phase === 'search' ? h.scan : h.target;
  if (h.phase === 'strike') {
    const t = smooth(elapsed / HAND.descent);
    return { x: target.x, z: target.z, angle: target.angle ?? 0,
      y: h.contactY + (h.from.y - h.contactY) * (1 - t), curl: h.from.curl * (1 - t) };
  }
  const duration = h.phase === 'warning' ? Math.min(0.25, h.duration) : h.phase === 'recover' ? HAND.recovery : 0.45;
  const t = smooth(elapsed / duration), warning = h.phase === 'warning';
  const y = warning ? HAND.aimHeight : HAND.hover;
  const lift = warning ? Math.sin(Math.PI * Math.min(1, elapsed / h.duration)) * 0.65 : 0;
  return { x: h.from.x + (target.x - h.from.x) * t, z: h.from.z + (target.z - h.from.z) * t,
    angle: (h.from.angle ?? 0) + angleDelta(h.from.angle ?? 0, target.angle ?? 0) * t,
    y: h.from.y + (y - h.from.y) * t + lift, curl: h.from.curl + ((warning ? 0.08 : 0.16) - h.from.curl) * t };
}
function guideHand(h, dt) {
  const dx = h.target.x - h.pose.x, dz = h.target.z - h.pose.z;
  const length = Math.hypot(dx, dz), step = Math.min(length, HAND.reachSpeed * dt);
  if (length > 0) { h.pose.x += dx / length * step; h.pose.z += dz / length * step; }
  const turn = angleDelta(h.pose.angle, h.target.angle);
  h.pose.angle += Math.sign(turn) * Math.min(Math.abs(turn), HAND.turnSpeed * dt);
  const t = 1 - Math.exp(-6 * dt);
  h.pose.y += (HAND.aimHeight - h.pose.y) * t;
  h.pose.curl += (0.26 - h.pose.curl) * t;
}
export function distractHand(h, target) {
  handPhase(h, 'distracted', 3.8); h.target = aimAt(target); h.attention = 0;
}

export function updateHand(s, level, dt) {
  const h = s.hand, p = s.player, events = [];
  h.scan = aimAt({ x: Math.sin(s.elapsed * level.scanSpeed) * 7, z: Math.cos(s.elapsed * level.scanSpeed * 0.73) * 4.8 });
  const exposed = !p.hidden && Math.hypot(p.x - h.scan.x, p.z - h.scan.z) < 3.3;
  if (h.phase === 'distracted') h.attention = 0;
  else if (h.phase === 'track' && !p.hidden) h.attention = 1;
  else h.attention = Math.max(0, Math.min(1, h.attention + (exposed ? level.attentionRate : p.hidden ? -1.1 : -0.23) * dt));
  h.timer -= dt;
  if (h.phase === 'search') {
    if (!p.hidden && (h.attention >= 1 || h.timer <= 0)) {
      h.target = aimAt(p); h.attention = 1; handPhase(h, 'track', HAND.tracking);
    } else if (p.hidden && h.timer <= 0) { h.timer = 1; h.duration = 1; h.from = { ...h.pose }; }
  } else if (h.phase === 'track') {
    if (p.hidden) {
      handPhase(h, 'search', level.handWait); h.attention = 0;
    } else {
      h.target = aimAt(p);
      if (h.timer <= 0 && Math.hypot(h.pose.x - p.x, h.pose.z - p.z) < 0.55
        && Math.abs(angleDelta(h.pose.angle, h.target.angle)) < 0.055) {
        handPhase(h, 'warning', level.strikeDelay); events.push('warning');
      }
    }
  } else if (h.phase === 'warning' && h.timer <= 0) {
    handPhase(h, 'strike', HAND.descent + HAND.hold);
  } else if (h.phase === 'strike') {
    const overlapsBody = !p.hidden && handHits(p, h.target);
    if (!h.contacted) h.contactY = overlapsBody ? HAND.bodyContact : 0;
    // Test crossing, not equality: no skipped contact at 20/30/60/120 Hz.
    if (!h.contacted && h.timer <= HAND.hold + 1e-9) {
      h.contacted = true; events.push('strike');
      if (overlapsBody && p.invincible <= 0) {
        p.health--; p.invincible = 2; events.push('hurt');
      }
    }
    if (h.timer <= 0) handPhase(h, 'recover', HAND.recovery);
  } else if ((h.phase === 'recover' || h.phase === 'distracted') && h.timer <= 0) {
    handPhase(h, 'search', level.handWait); h.attention = 0;
  }
  if (h.phase === 'track') guideHand(h, dt);
  else h.pose = sampleHandPose(h);
  return events;
}
