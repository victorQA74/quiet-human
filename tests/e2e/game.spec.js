import { test, expect } from '@playwright/test';

async function begin(page) {
  await page.waitForFunction(() => Boolean(window.__gameQA));
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Я готов', exact: true });
  if (await ready.isVisible()) await ready.click();
  await expect(page.locator('#hud')).toBeVisible();
}

async function moveTo(page, point) {
  const screen = await page.evaluate(p => window.__gameQA.project(p), point);
  await page.mouse.click(screen.x, screen.y);
  await page.waitForFunction(p => {
    const s = window.__gameQA.snapshot();
    return Math.hypot(s.player.x - p.x, s.player.z - p.z) < 0.7 || s.status === 'lost' || s.status === 'won';
  }, point, { timeout: 25000 });
  const status = await page.evaluate(() => window.__gameQA.snapshot().status);
  expect(status).not.toBe('lost');
}

test.describe('touch-capable campaign and eight-baby viewport', () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

test('real 3D gameplay: all three levels via pointer input, results and persistence', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'ТИШЕ. ЧЕЛОВЕК!' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await begin(page);
  for (let level = 0; level < 3; level++) {
    const s = await page.evaluate(() => window.__gameQA.snapshot());
    for (const baby of s.babies) { await page.keyboard.press('Space'); await moveTo(page, baby); }
    const family = await page.evaluate(() => ({ state: window.__gameQA.snapshot(), models: window.__gameQA.characters() }));
    expect(family.state.rescued).toBe([6, 7, 8][level]);
    expect(family.models.babyPositions).toHaveLength([6, 7, 8][level]);
    for (const [i, b] of family.state.babies.entries()) {
      expect(family.models.babyPositions[i][0]).toBeCloseTo(b.x, 5);
      expect(family.models.babyPositions[i][2]).toBeCloseTo(b.z, 5);
    }
    if (level === 2) {
      await page.screenshot({ path: 'artifacts/updated-eight-babies.png' });
      await page.keyboard.press('Space');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('button', { name: 'Джойстик движения' })).toBeVisible();
      await expect(page.locator('#family')).toHaveText('8 / 8');
      const mobileFamily = await page.evaluate(() => {
        const state = window.__gameQA.snapshot();
        return { points: state.babies.map(b => window.__gameQA.project(b)),
          noOverflow: document.documentElement.scrollWidth <= innerWidth };
      });
      expect(mobileFamily.noOverflow).toBe(true);
      for (const point of mobileFamily.points) {
        expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(390);
        expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(844);
      }
      await page.screenshot({ path: 'artifacts/updated-eight-babies-mobile.png' });
      await page.setViewportSize({ width: 800, height: 600 });
    }
    await page.keyboard.press('Space'); await moveTo(page, s.exit);
    await expect(page.getByRole('heading', { name: level === 2 ? 'Семья в сборе!' : 'Малыши дома!' })).toBeVisible();
    if (level < 2) await page.getByRole('button', { name: 'Следующая глава', exact: true }).click();
  }
  await page.reload();
  await expect(page.getByRole('button', { name: /03.*Последний свет/ })).toBeEnabled();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('quiet-human.progress.v1')));
  expect(data.best.every(Boolean)).toBe(true); expect(data.unlocked).toBe(3);
  expect(errors).toEqual([]);
});
});

test('keyboard, web, pause, camera and restart use real controls', async ({ page }) => {
  await page.goto('/'); await begin(page);
  const before = await page.evaluate(() => window.__gameQA.snapshot());
  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(p => {
      const s = window.__gameQA.snapshot();
      return Math.hypot(s.player.x - p.x, s.player.z - p.z) > 0.6;
    }, before.player, { timeout: 15000 });
  } finally { await page.keyboard.up('KeyD'); }
  const moved = await page.evaluate(() => window.__gameQA.snapshot());
  expect(Math.hypot(moved.player.x - before.player.x, moved.player.z - before.player.z)).toBeGreaterThan(0.5);
  await page.keyboard.press('Space');
  expect((await page.evaluate(() => window.__gameQA.snapshot())).silk).toBe(2);
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'Можно выдохнуть' })).toBeVisible();
  const paused = await page.evaluate(() => window.__gameQA.snapshot()); await page.waitForTimeout(350);
  expect((await page.evaluate(() => window.__gameQA.snapshot())).elapsed).toBe(paused.elapsed);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyC');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('button', { name: 'Заново', exact: true }).click();
  expect((await page.evaluate(() => window.__gameQA.snapshot())).rescued).toBe(0);
});

test('mobile joystick, web and responsive layout', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); await page.goto('/'); await begin(page);
  const joystick = page.getByRole('button', { name: 'Джойстик движения' });
  await expect(joystick).toBeVisible();
  const box = await joystick.boundingBox(); const before = await page.evaluate(() => window.__gameQA.snapshot());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await page.waitForTimeout(450); await page.mouse.up();
  const after = await page.evaluate(() => window.__gameQA.snapshot());
  expect(Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z)).toBeGreaterThan(0.5);
  await page.getByRole('button', { name: 'Паутина', exact: true }).click();
  expect((await page.evaluate(() => window.__gameQA.snapshot())).silk).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile-game.png' });
  await context.close();
});

test('corrupt storage remains playable and sound toggle persists', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('quiet-human.progress.v1', '{bad'));
  await page.reload(); await page.waitForFunction(() => Boolean(window.__gameQA));
  await page.getByRole('button', { name: 'Звук', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Звук', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.reload(); await page.waitForFunction(() => Boolean(window.__gameQA));
  await expect(page.getByRole('button', { name: 'Звук', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await begin(page); await expect(page.locator('#hud')).toBeVisible();
});

test('denied storage reports limitation without preventing play', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.goto('/'); await expect(page.locator('#storage-warning')).toBeVisible();
  await begin(page); await expect(page.locator('#hud')).toBeVisible();
});
