import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { createGame, startGame, setDestination, stepGame, castWeb } from '../src/game/model.js';

test('entire campaign is navigable in order, including return home, with normal silk commands', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const s = createGame(i); startGame(s);
    for (const goal of [...LEVELS[i].babies, LEVELS[i].exit]) {
      assert.ok(setDestination(s, goal));
      for (let frame = 0; frame < 1200 && s.status === 'playing' && Math.hypot(s.player.x - goal.x, s.player.z - goal.z) > 0.2; frame++) {
        if (s.hand.phase === 'warning' && s.silk > 0) castWeb(s);
        stepGame(s, {}, 1 / 60);
      }
      assert.notEqual(s.status, 'lost', `${i}: ${s.reason}`);
      assert.ok(s.status === 'won' || Math.hypot(s.player.x - goal.x, s.player.z - goal.z) < 0.65, `${i}: stalled at ${JSON.stringify(s.player)}, path ${JSON.stringify(s.path)}`);
    }
    assert.equal(s.status, 'won'); assert.equal(s.rescued, LEVELS[i].babies.length);
  }
});
