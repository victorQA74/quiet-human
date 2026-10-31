import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.argv[2];
if (!url || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url)) throw new Error('Pass actual dev server URL');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__gameQA));
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Я готов', exact: true });
  if (await ready.isVisible()) await ready.click();
  const report = await page.evaluate(() => new Promise(resolve => {
    const qa = window.__gameQA, frames = [], initial = qa.snapshot();
    let phase = '', health = initial.player.health;
    const started = performance.now();
    const observe = () => {
      const s = qa.snapshot();
      if (s.hand.phase !== phase || s.player.health !== health) {
        frames.push({ elapsed: s.elapsed, phase: s.hand.phase, timer: s.hand.timer,
          health: s.player.health, contacted: s.hand.contacted, pose: s.hand.pose,
          rendered: qa.characters(), metrics: qa.metrics() });
        phase = s.hand.phase; health = s.player.health;
      }
      if (s.status === 'lost' || performance.now() - started > 150000) {
        resolve({ initial: { player: initial.player }, frames, status: s.status,
          reason: s.reason, elapsed: s.elapsed, realSeconds: (performance.now() - started) / 1000 });
      } else requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  }));
  report.errors = errors;
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/hand-diagnosis.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'artifacts/updated-hand-loss.png' });
} finally { await browser.close(); }
