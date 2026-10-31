import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { createGame, startGame, pauseGame, stepGame, castWeb, setDestination } from '../src/game/model.js';
import { isWalkable, findPath } from '../src/game/navigation.js';

function playing(index = 0) { const s = createGame(index); startGame(s); return s; }
function run(s, seconds, input = {}) { for (let t = 0; t < seconds; t += 1 / 60) stepGame(s, input, 1 / 60); }

test('three distinct, complete levels have reachable babies and exit', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) {
    assert.ok(level.babies.length >= 3);
    for (const target of [...level.babies, level.exit]) {
      const path = findPath(level, level.start, target);
      assert.ok(path.length, `${level.name}: target ${JSON.stringify(target)} is unreachable`);
      assert.ok(path.every(p => isWalkable(level, p.x, p.z)));
    }
  }
});

test('game starts in menu and cannot move or consume time until started', () => {
  const s = createGame(0); const x = s.player.x;
  run(s, 1, { x: 1, z: 0 });
  assert.equal(s.player.x, x); assert.equal(s.elapsed, 0);
  startGame(s); run(s, 1, { x: 1 });
  assert.ok(s.player.x > x); assert.ok(s.elapsed > 0);
});

test('movement is normalized, bounded and cannot cross a solid book', () => {
  const a = playing(), b = playing();
  run(a, 0.4, { x: 1 }); run(b, 0.4, { x: 1, z: -1 });
  const dist = s => Math.hypot(s.player.x - LEVELS[0].start.x, s.player.z - LEVELS[0].start.z);
  assert.ok(Math.abs(dist(a) - dist(b)) < 0.05);
  const s = playing(); s.player.x = -7; s.player.z = -1;
  run(s, 2, { x: 1 });
  assert.ok(s.player.x < -6.3, 'must stop before book');
  assert.ok(isWalkable(LEVELS[0], s.player.x, s.player.z));
  const edge = playing(); run(edge, 2, { x: -1, z: 1 });
  assert.ok(Math.abs(edge.player.x) <= 11.66 && Math.abs(edge.player.z) <= 8.66);
});

test('pause freezes time, movement, hand and recharge', () => {
  const s = playing(); pauseGame(s);
  const before = structuredClone(s); run(s, 2, { x: 1 });
  assert.deepEqual(s, before);
  startGame(s); run(s, 0.1); assert.ok(s.elapsed > 0);
});

test('shelter reduces attention and prevents a warned strike from hurting player', () => {
  const s = playing(), h = LEVELS[0].shelters[0];
  Object.assign(s.player, h); s.hand.attention = 0.8;
  Object.assign(s.hand, { phase: 'warning', timer: 0.01, target: { ...h } });
  run(s, 0.6);
  assert.equal(s.hand.contacted, true, 'test must reach the actual contact frame');
  assert.equal(s.player.hidden, true); assert.equal(s.player.health, 3);
  assert.ok(s.hand.attention < 0.8);
});

test('warning precedes strike; hit is single and recovery allows escape', () => {
  const s = playing();
  Object.assign(s.hand, { phase: 'warning', timer: 0.2, target: { x: s.player.x, z: s.player.z } });
  run(s, 0.1); assert.equal(s.player.health, 3);
  run(s, 0.2); assert.equal(s.player.health, 3, 'hand is still descending');
  run(s, 0.2); assert.equal(s.player.health, 2);
  run(s, 0.3); assert.equal(s.player.health, 2);
});

test('web distracts warning, has finite charges, recharges, and ignores invalid states', () => {
  const menu = createGame(0); assert.equal(castWeb(menu), false);
  const s = playing(); s.hand.phase = 'warning';
  assert.equal(castWeb(s), true); assert.equal(s.silk, 2); assert.equal(s.hand.phase, 'distracted');
  castWeb(s); castWeb(s); assert.equal(s.silk, 0); assert.equal(castWeb(s), false);
  run(s, 8.2); assert.ok(s.silk >= 1); assert.ok(s.silk <= 3);
});

test('babies are rescued once, incomplete exit cannot win, complete exit wins', () => {
  const s = playing(), level = LEVELS[0];
  Object.assign(s.player, level.exit); run(s, 0.1); assert.equal(s.status, 'playing');
  for (const baby of level.babies) { Object.assign(s.player, baby); run(s, 0.02); }
  assert.equal(s.rescued, level.babies.length);
  run(s, 0.1); assert.equal(s.rescued, level.babies.length);
  Object.assign(s.player, level.exit); run(s, 0.02);
  assert.equal(s.status, 'won'); assert.ok(s.score > 0); assert.ok(s.stars >= 1 && s.stars <= 3);
});

test('timeout and zero health lose with readable reason; restart is independent', () => {
  const s = playing(); s.remaining = 0.01; run(s, 0.1);
  assert.equal(s.status, 'lost'); assert.equal(s.reason, 'time');
  const hurt = playing(); hurt.player.health = 1;
  Object.assign(hurt.hand, { phase: 'warning', timer: 0.01, target: { x: hurt.player.x, z: hurt.player.z } });
  run(hurt, 0.4); assert.equal(hurt.status, 'lost'); assert.equal(hurt.reason, 'health');
  const fresh = playing(); assert.equal(fresh.player.health, 3); assert.equal(fresh.rescued, 0);
});

test('click navigation reaches targets around obstacles with actual model updates', () => {
  const s = playing(); const target = LEVELS[0].babies[0];
  assert.equal(setDestination(s, target), true);
  run(s, 4);
  assert.ok(Math.hypot(s.player.x - target.x, s.player.z - target.z) < 0.65);
  assert.ok(s.rescued >= 1);
});

test('invalid level and input are contained without NaN or out-of-bounds state', () => {
  const s = playing(999); assert.equal(s.levelIndex, 0);
  assert.equal(setDestination(s, { x: NaN, z: Infinity }), false);
  assert.equal(setDestination(s, { x: 99, z: 99 }), false);
  stepGame(s, { x: NaN, z: Infinity }, NaN);
  assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.elapsed));
});
