import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, recordWin, defaults, STORAGE_KEY } from '../src/game/storage.js';

function store() { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; }

test('empty storage returns independent safe defaults', () => {
  const s = store(), a = loadProgress(s), b = loadProgress(s);
  assert.equal(a.progress.unlocked, 1); assert.equal(a.available, true);
  a.progress.settings.sound = false; assert.equal(b.progress.settings.sound, true);
});

test('completed levels unlock next, keep better records, and survive reload', () => {
  const s = store(), p = defaults();
  recordWin(p, 0, { score: 800, stars: 3, elapsed: 25 });
  recordWin(p, 0, { score: 200, stars: 1, elapsed: 60 });
  assert.equal(p.unlocked, 2); assert.equal(p.best[0].score, 800);
  p.settings.sound = false; p.tutorialSeen = true;
  assert.equal(saveProgress(s, p), true);
  const loaded = loadProgress(s).progress;
  assert.equal(loaded.best[0].stars, 3); assert.equal(loaded.settings.sound, false); assert.equal(loaded.tutorialSeen, true);
});

test('malformed JSON, hostile fields, invalid ranges and versions never crash', () => {
  const s = store(); s.setItem(STORAGE_KEY, '{broken'); assert.equal(loadProgress(s).progress.unlocked, 1);
  s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, unlocked: 99, best: [{ score: '<script>', stars: 99 }], settings: { sound: 'false' } }));
  const p = loadProgress(s).progress;
  assert.equal(p.unlocked, 1); assert.equal(p.best[0], null); assert.equal(p.settings.sound, true);
  s.setItem(STORAGE_KEY, JSON.stringify({ version: 123, unlocked: 3 })); assert.equal(loadProgress(s).progress.unlocked, 1);
});

test('denied or full storage degrades without losing the live game', () => {
  const denied = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  const loaded = loadProgress(denied); assert.equal(loaded.available, false); assert.equal(loaded.progress.unlocked, 1);
  assert.equal(saveProgress(denied, loaded.progress), false);
  assert.equal(loadProgress(null).available, false);
});
