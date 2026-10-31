import { LEVELS } from './levels.js';
import { findPath, moveWithCollisions } from './navigation.js';
import { createHand, distractHand, updateHand } from './hand.js';
import { rescueBaby, updateFollowers, gatherFamily } from './followers.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = v => Number.isFinite(v) ? v : 0;

export function createGame(index = 0) {
  const levelIndex = Number.isInteger(index) && index >= 0 && index < LEVELS.length ? index : 0;
  const level = LEVELS[levelIndex];
  return {
    levelIndex, status: 'menu', elapsed: 0, remaining: level.time,
    player: { ...level.start, angle: 0, health: 3, invincible: 0, hidden: false, moving: false },
    babies: level.babies.map((b, id) => ({ ...b, id, rescued: false, angle: 0, moving: false, order: -1, route: [] })), rescued: 0,
    path: [], silk: 3, silkClock: 0, webs: [], webId: 0,
    hand: createHand(level),
    score: 0, stars: 0, reason: '', events: [], trail: [{ ...level.start }],
  };
}

export function startGame(s) { if (s.status === 'menu' || s.status === 'paused') s.status = 'playing'; }
export function pauseGame(s) { if (s.status === 'playing') s.status = 'paused'; }
export function setDestination(s, target) {
  if (s.status !== 'playing') return false;
  const path = findPath(LEVELS[s.levelIndex], s.player, target);
  if (!path.length) return false;
  s.path = path; return true;
}

export function castWeb(s) {
  if (s.status !== 'playing' || s.silk < 1) return false;
  s.silk--; s.silkClock = 0;
  const target = { x: clamp(s.player.x + Math.sin(s.player.angle) * 2.1, -10.6, 10.6), z: clamp(s.player.z + Math.cos(s.player.angle) * 2.1, -7.6, 7.6) };
  s.webs.push({ ...target, life: 4.2, id: s.webId++ });
  distractHand(s.hand, target);
  s.events.push('web'); return true;
}

function finish(s, won, reason = '') {
  s.status = won ? 'won' : 'lost'; s.reason = reason; s.path = [];
  s.score = won ? Math.round(s.remaining * 12 + s.player.health * 220 + s.rescued * 150) : s.rescued * 150;
  s.stars = won ? (s.player.health === 3 && s.remaining > LEVELS[s.levelIndex].time * 0.35 ? 3 : s.player.health >= 2 ? 2 : 1) : 0;
  if (won) gatherFamily(s, LEVELS[s.levelIndex]);
  s.events.push(won ? 'win' : 'lose');
}

export function stepGame(s, input = {}, delta = 0) {
  if (s.status !== 'playing') return;
  const dt = clamp(finite(delta), 0, 0.05); if (!dt) return;
  s.events = []; s.elapsed += dt; s.remaining = Math.max(0, s.remaining - dt);
  const p = s.player, level = LEVELS[s.levelIndex];
  p.invincible = Math.max(0, p.invincible - dt);
  let dx = finite(input.x), dz = finite(input.z), length = Math.hypot(dx, dz);
  if (length > 0.01) s.path = [];
  else if (s.path.length) {
    while (s.path.length && distance(p, s.path[0]) < 0.12) s.path.shift();
    if (s.path.length) { dx = s.path[0].x - p.x; dz = s.path[0].z - p.z; length = Math.hypot(dx, dz); }
  }
  p.moving = length > 0.01;
  if (p.moving) {
    const speed = s.path.length ? Math.min(4.5 * dt, length) : 4.5 * dt * Math.min(1, length);
    moveWithCollisions(level, p, dx / length * speed, dz / length * speed);
    p.angle = Math.atan2(dx, dz);
    const prev = s.trail[0];
    if (distance(prev, p) > 0.16) { s.trail.unshift({ x: p.x, z: p.z }); if (s.trail.length > 150) s.trail.pop(); }
  }
  p.hidden = level.shelters.some(h => distance(p, h) < h.r);
  for (const baby of s.babies) {
    if (!baby.rescued && distance(p, baby) < 0.82) rescueBaby(s, baby, level);
  }
  updateFollowers(s, level, dt);
  if (s.silk < 3) { s.silkClock += dt; if (s.silkClock >= 8) { s.silk++; s.silkClock = 0; s.events.push('recharge'); } }
  s.webs = s.webs.filter(w => (w.life -= dt) > 0);
  s.events.push(...updateHand(s, level, dt));
  if (p.health <= 0) finish(s, false, 'health');
  if (s.status !== 'playing') return;
  if (s.rescued === s.babies.length && distance(p, level.exit) < 1.25) finish(s, true);
  else if (s.remaining <= 0) finish(s, false, 'time');
}
