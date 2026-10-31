export const STORAGE_KEY = 'quiet-human.progress.v1';
export function defaults() {
  return { version: 1, unlocked: 1, best: [null, null, null], settings: { sound: true, reducedMotion: false }, tutorialSeen: false };
}

function validate(data) {
  const p = defaults();
  if (!data || data.version !== 1) return p;
  if (Number.isInteger(data.unlocked) && data.unlocked >= 1 && data.unlocked <= 3) p.unlocked = data.unlocked;
  if (Array.isArray(data.best)) p.best = p.best.map((_, i) => {
    const b = data.best[i];
    return b && Number.isFinite(b.score) && b.score >= 0 && b.score <= 100000 &&
      Number.isInteger(b.stars) && b.stars >= 1 && b.stars <= 3 && Number.isFinite(b.time) && b.time >= 0 && b.time <= 10000
      ? { score: Math.floor(b.score), stars: b.stars, time: b.time } : null;
  });
  for (const key of ['sound', 'reducedMotion']) if (typeof data.settings?.[key] === 'boolean') p.settings[key] = data.settings[key];
  if (typeof data.tutorialSeen === 'boolean') p.tutorialSeen = data.tutorialSeen;
  return p;
}

export function loadProgress(storage) {
  if (!storage) return { progress: defaults(), available: false };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    try { return { progress: validate(raw ? JSON.parse(raw) : null), available: true }; }
    catch { return { progress: defaults(), available: true }; }
  } catch { return { progress: defaults(), available: false }; }
}

export function saveProgress(storage, progress) {
  try { if (!storage) return false; storage.setItem(STORAGE_KEY, JSON.stringify(validate(progress))); return true; }
  catch { return false; }
}

export function recordWin(progress, index, result) {
  if (!Number.isInteger(index) || index < 0 || index > 2) return;
  progress.unlocked = Math.max(progress.unlocked, Math.min(3, index + 2));
  const score = Math.max(0, Math.floor(result.score));
  const previous = progress.best[index];
  if (!previous || score > previous.score) progress.best[index] = { score, stars: result.stars, time: result.elapsed };
}
