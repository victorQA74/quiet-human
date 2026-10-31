import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, castWeb, pauseGame } from '../src/game/model.js';

const tick = (s, dt = 1 / 60, input = {}) => stepGame(s, input, dt);
const playing = (level = 0) => { const s = createGame(level); startGame(s); return s; };
function until(s, condition, limit = 40, dt = 1 / 60) {
  for (let t = 0; t < limit && !condition(); t += dt) tick(s, dt);
  assert.ok(condition(), `timed out in ${s.hand.phase}, elapsed=${s.elapsed}`);
}

test('natural stationary player is hit once per visible contact and loses after three attacks in every chapter', () => {
  for (let level = 0; level < 3; level++) {
    const s = playing(level); let contacts = 0;
    for (let n = 0; n < 6000 && s.status === 'playing'; n++) {
      const health = s.player.health; tick(s);
      if (s.player.health !== health) {
        contacts++;
        assert.equal(s.player.health, health - 1);
        assert.equal(s.hand.phase, 'strike');
        assert.equal(s.hand.contacted, true, 'damage is owned by the contact event');
        assert.ok(s.hand.pose.y > 0.3 && s.hand.pose.y < 0.65, 'palm touches the back, not the table through the body');
        assert.equal(s.hand.pose.x, s.hand.target.x);
        assert.equal(s.hand.pose.z, s.hand.target.z);
      }
    }
    assert.equal(contacts, 3); assert.equal(s.status, 'lost'); assert.equal(s.reason, 'health');
  }
});

test('strike descent has no damage before contact; pause freezes its pose; one contact cannot double-hit', () => {
  const s = playing(); until(s, () => s.hand.phase === 'strike');
  assert.equal(s.player.health, 3, 'beginning of descent is not contact');
  assert.ok(s.hand.pose.y > 1);
  pauseGame(s); const before = structuredClone(s); tick(s, 0.05); assert.deepEqual(s, before);
  startGame(s); until(s, () => s.player.health === 2);
  for (let n = 0; n < 30; n++) tick(s);
  assert.equal(s.player.health, 2);
});

test('warning is locked to target: leaving the footprint prevents a hit', () => {
  const s = playing(); until(s, () => s.hand.phase === 'warning');
  const target = { ...s.hand.target };
  for (let n = 0; n < 50; n++) tick(s, 1 / 60, { x: 1 });
  assert.deepEqual(s.hand.target, target);
  until(s, () => s.hand.phase === 'recover'); assert.equal(s.player.health, 3);
});

test('silk during warning or descent cancels contact, not an already delivered hit', () => {
  for (const phase of ['warning', 'strike']) {
    const s = playing(); until(s, () => s.hand.phase === phase);
    assert.equal(castWeb(s), true);
    for (let n = 0; n < 180; n++) tick(s);
    assert.equal(s.player.health, 3); assert.equal(s.hand.phase, 'distracted');
  }
});

test('a hit stops the palm on the spider body; a miss reaches the table without damage', () => {
  const hit = playing(); until(hit, () => hit.player.health === 2);
  assert.ok(hit.hand.pose.y > 0.3 && hit.hand.pose.y < 0.65, 'palm must not pass through the back');
  assert.equal(hit.hand.pose.curl, 0);
  const miss = playing(); until(miss, () => miss.hand.phase === 'warning');
  for (let n = 0; n < 50; n++) tick(miss, 1 / 60, { x: 1 });
  until(miss, () => miss.hand.contacted);
  assert.equal(miss.player.health, 3); assert.ok(Math.abs(miss.hand.pose.y) < 1e-6);
  const before = hit.hand.pose.curl;
  until(hit, () => hit.hand.phase === 'recover');
  assert.equal(hit.hand.pose.curl, before, 'recovery starts without a finger-pose snap');
});

test('different simulation step sizes cannot skip or duplicate the contact', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
    const s = playing(); until(s, () => s.hand.phase === 'recover', 20, dt);
    assert.equal(s.player.health, 2);
    assert.equal(s.hand.contacted, true);
  }
});
