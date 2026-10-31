import './style.css';
import './ui-layout.css';
import { LEVELS } from './game/levels.js';
import { createGame, startGame, pauseGame, stepGame, castWeb, setDestination } from './game/model.js';
import { loadProgress, saveProgress, recordWin } from './game/storage.js';
import { GameScene } from './view/scene.js';
import { GameInput } from './input.js';
import { GameAudio } from './audio.js';
import { GameUI } from './ui.js';
import { loadCharacterAssets } from './view/assets.js';
import './loading.css';

async function boot() {
const loading = document.getElementById('asset-loading'), retry = document.getElementById('asset-retry');
const title = document.getElementById('asset-title'), detail = document.getElementById('asset-detail');
const startButton = document.getElementById('start'); startButton.disabled = true; retry.hidden = true;
loading.hidden = false; title.textContent = 'Готовим маленький мир…'; detail.textContent = 'Загружаем пауков и руку. Таймер ещё не идёт.';
let assets;
try {
  assets = await loadCharacterAssets(value => { detail.textContent = `Персонажи: ${Math.round(value * 100)}%. Таймер ещё не идёт.`; });
} catch (error) {
  title.textContent = 'Не удалось загрузить персонажей'; detail.textContent = 'Проверь соединение с игрой и повтори загрузку. Прогресс не изменён.';
  retry.hidden = false; retry.onclick = () => { void boot(); };
  return;
}
loading.hidden = true; startButton.disabled = false;
let storage = null;
try { storage = window.localStorage; } catch { /* The session remains playable without persistence. */ }
const loaded = loadProgress(storage), progress = loaded.progress;
let available = loaded.available, selected = 0, state = createGame(), helpReturn = 'start', finished = false;
const audio = new GameAudio(); audio.enabled = progress.settings.sound;
const canvas = document.getElementById('world');
let scene;
try { scene = new GameScene(canvas, assets); }
catch (error) {
  document.getElementById('fatal').hidden = false; document.getElementById('menu').hidden = true;
  console.error('3D initialization failed:', error);
}

if (scene) {
  const persist = () => { available = saveProgress(storage, progress); ui.settings(progress, available); };
  const begin = (index = selected) => {
    selected = index; state = createGame(index); startGame(state); finished = false;
    input.clear(); scene.resetCamera(); scene.setLevel(index); ui.game(); ui.setupLabels(state); audio.unlock(); audio.setPlaying(true);
  };
  const showMenu = () => {
    state = createGame(selected); finished = false; input.clear(); audio.setPlaying(false); ui.menu(progress, selected);
  };
  const pause = () => {
    if (ui.modal && state.status === 'menu') return;
    if (state.status === 'playing') { pauseGame(state); input.clear(); audio.setPlaying(false); ui.paused(); }
    else if (state.status === 'paused') { startGame(state); ui.game(); audio.setPlaying(true); }
  };
  const web = () => {
    if (castWeb(state)) { audio.play('web'); state.events = []; }
    else if (state.status === 'playing') ui.toast('Паутина восстанавливается. Ещё немного.');
  };
  const ui = new GameUI({
    start: () => { audio.unlock(); if (!progress.tutorialSeen) { helpReturn = 'start'; ui.tutorial(); } else begin(); },
    ready: () => { progress.tutorialSeen = true; persist(); if (helpReturn === 'menu') ui.menu(progress, selected); else begin(); },
    help: () => { helpReturn = 'menu'; ui.tutorial(); },
    select: i => { if (i < progress.unlocked) { selected = i; state = createGame(i); ui.menu(progress, i); } },
    sound: () => { progress.settings.sound = !progress.settings.sound; audio.setEnabled(progress.settings.sound); if (state.status === 'playing') audio.setPlaying(true); persist(); },
    motion: () => { progress.settings.reducedMotion = !progress.settings.reducedMotion; persist(); },
    pause, resume: pause, web, camera: () => scene.resetCamera(),
    restart: () => begin(state.levelIndex), menu: showMenu,
    next: () => { if (state.status === 'won' && state.levelIndex < 2) begin(state.levelIndex + 1); },
  });
  const input = new GameInput(canvas, scene, {
    web, pause,
    blur: () => { if (state.status === 'playing') pause(); },
    destination: p => { if (state.status === 'playing' && !setDestination(state, p)) ui.toast('Туда не пролезть. Выбери свободное место на столе.'); },
  });
  ui.menu(progress, selected); ui.settings(progress, available); scene.setLevel(0);
  let last = performance.now(), accumulator = 0, frameCount = 0, frameTotal = 0;
  let lastRender = -Infinity, lastStatus = '', qualityTime = 0, qualityFrames = 0;
  const fixed = 1 / 60;
  function frame(now) {
    const delta = Math.min((now - last) / 1000, 0.15); last = now;
    frameTotal += delta; frameCount++; accumulator = Math.min(accumulator + delta, fixed * 5);
    const intent = input.sample();
    while (accumulator >= fixed) {
      stepGame(state, intent, fixed); accumulator -= fixed;
      for (const event of state.events) {
        audio.play(event);
        if (event === 'rescue') ui.toast(state.rescued === state.babies.length ? 'Все малыши с тобой. Домой!' : 'Ещё один малыш в безопасности ♥');
      }
      state.events = [];
    }
    if (['won', 'lost'].includes(state.status) && !finished) {
      finished = true; input.clear(); audio.setPlaying(false);
      if (state.status === 'won') { recordWin(progress, state.levelIndex, state); persist(); }
      ui.result(state);
    }
    const interval = ui.modal ? 250 : state.status === 'menu' ? 50 : 0;
    if (now - lastRender >= interval || lastStatus !== state.status) {
      scene.render(state, now / 1000, progress.settings.reducedMotion); lastRender = now;
      qualityTime += delta; qualityFrames++;
      if (qualityTime > 1.5 && state.status === 'playing') {
        if (qualityFrames / qualityTime < 28) scene.lowerResolution();
        qualityTime = 0; qualityFrames = 0;
      }
    }
    lastStatus = state.status; ui.update(state, scene);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (state.status === 'playing') pause(); ui.toast('3D-контекст потерян. Перезагрузи страницу — рекорды сохранены.'); });
  // Inspection only: no test teleport, victory shortcut, or state mutation API.
  if (import.meta.env.DEV) Object.defineProperty(window, '__gameQA', { value: Object.freeze({
    snapshot: () => structuredClone({ ...state, exit: LEVELS[state.levelIndex].exit, shelters: LEVELS[state.levelIndex].shelters }),
    project: p => scene.screen(p, 0),
    metrics: () => ({ fps: frameCount / Math.max(0.01, frameTotal), calls: scene.renderer.info.render.calls, triangles: scene.renderer.info.render.triangles, geometries: scene.renderer.info.memory.geometries, textures: scene.renderer.info.memory.textures }),
    characters: () => {
      scene.scene.updateMatrixWorld(true);
      return { handContact: scene.handCharacter.contact.getWorldPosition(scene.target.clone()).toArray(),
        handPose: structuredClone(state.hand.pose), handAngle: scene.hand.rotation.y,
        warningAngle: scene.warning.rotation.y, warningVisible: scene.warning.visible, aimVisible: scene.aim.visible,
        handJoints: scene.handCharacter.joints.length, spiderLegs: scene.player.legs.length,
        babyPositions: scene.babyModels.map(b => b.group.position.toArray()) };
    },
  }) });
}
}
void boot();
