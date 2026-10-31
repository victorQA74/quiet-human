import { BOARD } from './levels.js';

export function isWalkable(level, x, z, radius = BOARD.radius) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > BOARD.width / 2 - radius || Math.abs(z) > BOARD.depth / 2 - radius) return false;
  return !level.obstacles.some(o => o.r
    ? Math.hypot(x - o.x, z - o.z) < o.r + radius
    : Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}

export function moveWithCollisions(level, player, dx, dz, radius = BOARD.radius) {
  if (isWalkable(level, player.x + dx, player.z + dz, radius)) {
    player.x += dx; player.z += dz; return;
  }
  if (isWalkable(level, player.x + dx, player.z, radius)) player.x += dx;
  if (isWalkable(level, player.x, player.z + dz, radius)) player.z += dz;
}

function clearLine(level, a, b) {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15);
  for (let i = 1; i <= count; i++) {
    if (!isWalkable(level, a.x + (b.x - a.x) * i / count, a.z + (b.z - a.z) * i / count)) return false;
  }
  return true;
}

// Bounded grid (49×37): A* only runs when the pointer chooses a destination.
export function findPath(level, start, goal) {
  if (!start || !goal || !isWalkable(level, goal.x, goal.z)) return [];
  if (clearLine(level, start, goal)) return [{ x: goal.x, z: goal.z }];
  const size = 0.5, cols = 49, rows = 37;
  const point = id => ({ x: (id % cols) * size - 12, z: Math.floor(id / cols) * size - 9 });
  const idFor = p => Math.round((p.z + 9) / size) * cols + Math.round((p.x + 12) / size);
  const valid = id => id >= 0 && id < cols * rows && isWalkable(level, point(id).x, point(id).z);
  const nearest = p => {
    const id = idFor(p);
    if (valid(id) && clearLine(level, p, point(id))) return id;
    let best = -1, distance = Infinity;
    for (let n = 0; n < cols * rows; n++) {
      if (!valid(n)) continue;
      const q = point(n), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < distance && clearLine(level, p, q)) { best = n; distance = d; }
    }
    return best;
  };
  const first = nearest(start), last = nearest(goal);
  if (first < 0 || last < 0) return [];
  const open = new Set([first]), previous = new Map(), cost = new Map([[first, 0]]);
  const heuristic = id => { const p = point(id), g = point(last); return Math.hypot(p.x - g.x, p.z - g.z); };
  while (open.size) {
    let current = -1, lowest = Infinity;
    for (const id of open) { const f = cost.get(id) + heuristic(id); if (f < lowest) { lowest = f; current = id; } }
    if (current === last) {
      const path = [goal]; let node = last;
      while (node !== first) { path.unshift(point(node)); node = previous.get(node); }
      path.unshift(point(first));
      const compact = []; let from = start;
      while (path.length) {
        let i = path.length - 1;
        while (i > 0 && !clearLine(level, from, path[i])) i--;
        from = path[i]; compact.push(from); path.splice(0, i + 1);
      }
      return compact;
    }
    open.delete(current);
    const cx = current % cols, cz = Math.floor(current / cols);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz, next = nz * cols + nx;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || !valid(next)) continue;
      if (!clearLine(level, point(current), point(next))) continue;
      const value = cost.get(current) + Math.hypot(dx, dz) * size;
      if (value < (cost.get(next) ?? Infinity)) { previous.set(next, current); cost.set(next, value); open.add(next); }
    }
  }
  return [];
}
