import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { createGame, startGame, stepGame, castWeb, pauseGame } from '../src/game/model.js';
import { handHits, HAND_SHAPES } from '../src/game/hand.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const playing = () => { const s = createGame(); startGame(s); return s; };
function until(s, condition, input = {}, seconds = 18) {
  for (let n = 0; n < seconds * 60 && !condition(); n++) stepGame(s, input, 1 / 60);
  assert.ok(condition(), `timed out in ${s.hand.phase}`);
}

test('human first acquires the spider, then guides a continuous hand pose to a moving target', () => {
  const s = playing();
  until(s, () => s.hand.phase !== 'search');
  assert.equal(s.hand.phase, 'track', 'search must not jump straight to a locked strike');
  const first = structuredClone(s.hand);
  let previous = { ...s.hand.pose };
  for (let n = 0; n < 30; n++) {
    stepGame(s, { x: 1, z: -0.4 }, 1 / 60);
    assert.equal(s.hand.phase, 'track');
    assert.ok(distance(s.hand.pose, previous) < 0.6, 'reach is continuous, not a teleport');
    assert.ok(Math.abs(s.hand.pose.angle - previous.angle) < 0.08, 'forearm turns with bounded speed');
    previous = { ...s.hand.pose };
  }
  assert.ok(distance(first.target, s.hand.target) > 1, 'aim follows the moving spider');
  assert.ok(distance(s.hand.target, s.player) < 1e-6);
  assert.ok(distance(s.hand.pose, s.hand.target) < distance(first.pose, first.target), 'human closes the reach');
  assert.equal(s.player.health, 3);
  pauseGame(s); const paused = structuredClone(s); stepGame(s, { x: 1 }, 0.05); assert.deepEqual(s, paused);
  startGame(s);
  until(s, () => s.hand.phase === 'warning');
  const locked = { ...s.hand.target };
  assert.ok(distance(s.hand.pose, locked) < 0.75, 'warning only starts once the hand is aimed');
  assert.ok(Math.abs(s.hand.pose.angle - locked.angle) < 0.06);
  for (let n = 0; n < 55; n++) stepGame(s, { z: -1 }, 1 / 60);
  assert.deepEqual(s.hand.target, locked, 'red warning is locked and dodgeable');
  until(s, () => s.hand.phase === 'recover');
  assert.equal(s.player.health, 3);
});

test('guiding respects hiding and silk, including silk during tracking', () => {
  const hidden = playing(); until(hidden, () => hidden.hand.phase !== 'search');
  assert.equal(hidden.hand.phase, 'track');
  Object.assign(hidden.player, LEVELS[0].shelters[0]);
  stepGame(hidden, {}, 1 / 60);
  assert.equal(hidden.hand.phase, 'search', 'human loses the spider when it hides');
  for (let n = 0; n < 600; n++) stepGame(hidden, {}, 1 / 60);
  assert.equal(hidden.player.health, 3); assert.equal(hidden.hand.phase, 'search');

  const silk = playing(); until(silk, () => silk.hand.phase !== 'search');
  assert.equal(silk.hand.phase, 'track');
  assert.equal(castWeb(silk), true);
  assert.equal(silk.hand.phase, 'distracted');
  for (let n = 0; n < 180; n++) stepGame(silk, {}, 1 / 60);
  assert.equal(silk.player.health, 3); assert.equal(silk.hand.attention, 0);
  assert.ok(distance(silk.hand.pose, silk.webs[0]) < 0.01, 'human reaches toward the decoy instead');
});

test('silk after contact redirects the hand without healing or causing a second hit', () => {
  const s = playing(); until(s, () => s.hand.contacted);
  assert.equal(s.player.health, 2); assert.equal(castWeb(s), true);
  for (let n = 0; n < 180; n++) stepGame(s, {}, 1 / 60);
  assert.equal(s.player.health, 2); assert.equal(s.hand.phase, 'distracted');
  until(s, () => s.hand.phase === 'search');
  assert.equal(s.hand.attention, 0);
});

test('rotated aiming uses the same local palm and finger footprint for hits', () => {
  const target = { x: 4, z: -2, angle: Math.PI / 2 };
  const world = (x, z) => ({ x: target.x + x * Math.cos(target.angle) + z * Math.sin(target.angle),
    z: target.z - x * Math.sin(target.angle) + z * Math.cos(target.angle) });
  for (const shape of HAND_SHAPES) assert.ok(handHits(world(shape.x, shape.z), target));
  assert.equal(handHits(world(-2, -2), target), false);
  assert.equal(handHits({ x: target.x + 0.24, z: target.z + 2.5 }, target), false,
    'unrotated fingers are no longer a ghost collision region');
});
