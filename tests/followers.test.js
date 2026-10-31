import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { createGame, startGame, stepGame, setDestination, castWeb, pauseGame } from '../src/game/model.js';
import { isWalkable } from '../src/game/navigation.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function advance(s, goal, limit = 1200) {
  assert.equal(setDestination(s, goal), true);
  for (let n = 0; n < limit && distance(s.player, goal) > 0.12 && s.status === 'playing'; n++) {
    if (['warning', 'strike'].includes(s.hand.phase) && s.silk > 0) castWeb(s);
    stepGame(s, {}, 1 / 60);
    const following = s.babies.filter(b => b.rescued);
    for (const b of following) {
      assert.ok(isWalkable(LEVELS[s.levelIndex], b.x, b.z, 0.18), `baby ${b.id} entered an obstacle`);
      assert.ok(Number.isFinite(b.angle));
    }
  }
  assert.ok(s.status === 'won' || distance(s.player, goal) < 0.3, 'reach goal or enter the 1.25-unit exit zone');
}

test('all chapters rescue exactly 6/7/8 babies into a moving, collision-safe family, including the exit', () => {
  for (let index = 0; index < 3; index++) {
    const s = createGame(index); startGame(s); const level = LEVELS[index];
    assert.equal(s.babies.length, [6, 7, 8][index]);
    for (const home of level.babies) {
      advance(s, home);
      const rescued = s.rescued;
      for (let n = 0; n < 5; n++) stepGame(s, {}, 1 / 60);
      assert.equal(s.rescued, rescued, 'cannot rescue one baby twice');
    }
    assert.equal(s.rescued, s.babies.length);
    const before = s.babies.map(b => ({ x: b.x, z: b.z }));
    advance(s, level.exit); assert.equal(s.status, 'won');
    assert.ok(s.babies.some((b, i) => distance(b, before[i]) > 1), 'followers live in the model, not only in the renderer');
    for (const baby of s.babies) assert.ok(distance(baby, level.exit) < 1.2, 'entire family is visible by the nest');
    for (let i = 0; i < s.babies.length; i++) for (let j = 0; j < i; j++) assert.ok(distance(s.babies[i], s.babies[j]) > 0.35);
    const fresh = createGame(index);
    assert.equal(fresh.rescued, 0);
    assert.deepEqual(fresh.babies.map(b => ({ x: b.x, z: b.z })), level.babies);
  }
});

test('an eight-baby chain stays mobile before victory through a reversal and a book detour', () => {
  const s = createGame(2); startGame(s); const level = LEVELS[2];
  for (const home of [...level.babies].reverse()) advance(s, home);
  assert.equal(s.rescued, 8);
  assert.deepEqual(s.babies.map(b => b.order).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const baby of s.babies) {
    assert.equal(baby.leaderId, baby.order === 0 ? null : s.babies.find(b => b.order === baby.order - 1).id);
  }
  const before = s.babies.map(b => ({ x: b.x, z: b.z }));
  for (const point of [{ x: -9.6, z: 4.5 }, { x: -9.6, z: -6.6 }, { x: 0, z: -6.6 }]) advance(s, point);
  assert.equal(s.status, 'playing', 'gatherFamily must not conceal a stuck tail');
  for (const baby of s.babies) assert.ok(distance(baby, before[baby.id]) > 1, `baby ${baby.id} stopped following`);
});

test('following positions freeze on pause and settle with spacing when the parent stops', () => {
  const s = createGame(); startGame(s);
  advance(s, LEVELS[0].babies[0]); advance(s, { x: -9.6, z: -1.5 });
  pauseGame(s); const positions = structuredClone(s.babies);
  for (let i = 0; i < 20; i++) stepGame(s, { x: 1 }, 0.05);
  assert.deepEqual(s.babies, positions);
  startGame(s);
  for (let i = 0; i < 100; i++) stepGame(s, {}, 1 / 60);
  const baby = s.babies.find(b => b.rescued);
  assert.ok(distance(baby, s.player) > 0.45 && distance(baby, s.player) < 1.1);
  assert.equal(baby.moving, false);
});
