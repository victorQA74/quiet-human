import { findPath, moveWithCollisions, isWalkable } from './navigation.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function rescueBaby(s, baby, level) {
  const leader = (s.rescued > 0 ? s.babies.find(b => b.order === s.rescued - 1) : null) ?? s.player;
  baby.rescued = true; baby.order = s.rescued++; baby.leaderId = leader.id ?? null;
  baby.route = findPath(level, baby, leader); baby.lastLeader = { x: leader.x, z: leader.z };
  s.events.push('rescue');
}
function pathLength(baby) {
  let length = 0, from = baby;
  for (const point of baby.route) { length += distance(from, point); from = point; }
  return length;
}
export function updateFollowers(s, level, dt) {
  const ordered = s.babies.filter(b => b.rescued).sort((a, b) => a.order - b.order);
  for (const baby of ordered) {
    const leader = baby.leaderId === null ? s.player : s.babies[baby.leaderId];
    baby.moving = false;
    if (distance(leader, baby.lastLeader) > 0.045) {
      baby.route.push({ x: leader.x, z: leader.z }); baby.lastLeader = { x: leader.x, z: leader.z };
    }
    const gap = baby.order === 0 ? 0.8 : 0.58;
    let budget = Math.min(5.3 * dt, Math.max(0, pathLength(baby) - gap));
    // Follow the recorded polyline, never a direct line through a book corner.
    while (baby.route.length && budget > 0.001) {
      const target = baby.route[0], length = distance(baby, target);
      if (length < 0.015) { baby.route.shift(); continue; }
      const step = Math.min(budget, length), dx = (target.x - baby.x) / length * step, dz = (target.z - baby.z) / length * step;
      // Keep siblings separated even where a route loops back onto itself.
      const blocked = ordered.some(other => other.order < baby.order && distance({ x: baby.x + dx, z: baby.z + dz }, other) < 0.34);
      if (blocked) break;
      const old = { x: baby.x, z: baby.z };
      moveWithCollisions(level, baby, dx, dz, 0.18);
      const moved = distance(old, baby);
      if (moved < 0.0001) break;
      baby.angle = Math.atan2(baby.x - old.x, baby.z - old.z); baby.moving = true; budget -= moved;
      if (distance(baby, target) < 0.015) baby.route.shift();
    }
  }
}

export function gatherFamily(s, level) {
  // A presentation pose on winning, after traversal has been validated by the model.
  const spots = [];
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI * 2 / 20;
    const point = { x: level.exit.x + Math.sin(angle) * 0.92, z: level.exit.z + Math.cos(angle) * 0.92 };
    if (isWalkable(level, point.x, point.z, 0.18)) spots.push(point);
  }
  const placed = [];
  for (const baby of s.babies) {
    const angle = baby.order * Math.PI * 2 / s.babies.length;
    const ideal = { x: level.exit.x + Math.sin(angle) * 0.92, z: level.exit.z + Math.cos(angle) * 0.92 };
    const candidates = [ideal, ...spots].filter(p => isWalkable(level, p.x, p.z, 0.18)
      && placed.every(other => distance(p, other) > 0.4));
    candidates.sort((a, b) => distance(a, ideal) - distance(b, ideal));
    const point = candidates[0];
    if (point) { Object.assign(baby, point); placed.push(point); }
    baby.angle = Math.atan2(s.player.x - baby.x, s.player.z - baby.z); baby.moving = false; baby.route = [];
  }
}
