import { createGame, startGame, stepGame, setDestination, castWeb } from '../src/game/model.js';
import { LEVELS } from '../src/game/levels.js';
const s = createGame(); startGame(s);
for (const goal of [LEVELS[0].babies[0], { x: -9.6, z: -1.5 }]) {
  setDestination(s, goal);
  for (let n = 0; n < 1000 && Math.hypot(s.player.x - goal.x, s.player.z - goal.z) > 0.12 && s.status === 'playing'; n++) {
    if (s.hand.phase === 'warning' && s.silk) castWeb(s);
    stepGame(s, {}, 1/60);
  }
}
for (let n = 0; n < 100; n++) stepGame(s, {}, 1/60);
console.log(JSON.stringify({player:s.player, baby:s.babies[0], distance:Math.hypot(s.player.x-s.babies[0].x,s.player.z-s.babies[0].z)}, null, 2));
