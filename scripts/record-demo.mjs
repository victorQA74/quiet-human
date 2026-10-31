import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] || process.env.GAME_URL;
if (!url || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url)) throw new Error('Pass the actual local dev server URL');
const output = join(process.cwd(), 'artifacts');
await mkdir(join(output, 'raw-video'), { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: join(output, 'raw-video'), size: { width: 960, height: 720 } } });
let raw, startOffset = 0, actions = [], error = null;
const created = performance.now();
try {
  const page = await context.newPage(); const video = page.video();
  await page.goto(url); await page.waitForFunction(() => Boolean(window.__gameQA));
  startOffset = Math.max(0, (performance.now() - created) / 1000);
  await page.screenshot({ path: join(output, 'menu-desktop.png') });
  const started = performance.now();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click();
  await page.getByRole('button', { name: 'Я готов', exact: true }).click();
  actions.push('menu → tutorial → real gameplay');
  const initial = await page.evaluate(() => window.__gameQA.snapshot());
  const goals = [...initial.babies, initial.exit]; let target = 0, previousTarget = -1;
  while (performance.now() - started < 34000) {
    const s = await page.evaluate(() => window.__gameQA.snapshot());
    if (s.status === 'won' || s.status === 'lost') { await page.waitForTimeout(500); continue; }
    if (target < goals.length) {
      const goal = goals[target];
      if (previousTarget !== target) {
        const p = await page.evaluate(g => window.__gameQA.project(g), goal);
        await page.keyboard.press('Space'); await page.mouse.click(p.x, p.y); previousTarget = target;
        actions.push(`pointer destination ${target + 1}`);
      }
      if (Math.hypot(s.player.x - goal.x, s.player.z - goal.z) < 0.75) target++;
    }
    if (s.hand.phase === 'warning' && s.silk) await page.keyboard.press('Space');
    await page.waitForTimeout(180);
  }
  await page.screenshot({ path: join(output, 'gameplay-desktop.png') });
  raw = await video.path();
} catch (e) { error = e; }
finally { await context.close(); await browser.close(); }
if (error) throw error;
await writeFile(join(output, 'recording-actions.json'), JSON.stringify({ raw, startOffset, actions }, null, 2));
const { finalizeVideo } = await import('./finalize-video.mjs');
await finalizeVideo(raw, startOffset);
