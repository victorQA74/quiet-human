import { test, expect } from '@playwright/test';

// Keep software-WebGL raster cost bounded; simulation and game timing stay real.
test.use({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });

async function begin(page) {
  await page.waitForFunction(() => Boolean(window.__gameQA));
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Я готов', exact: true });
  if (await ready.isVisible()) await ready.click();
  await expect(page.locator('#hud')).toBeVisible();
}

test('stationary spider: actual hand contact removes hearts and natural third hit loses', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await begin(page);
  // Observe in the page's RAF: a separate waitForFunction + evaluate can cross
  // the entire 240 ms descent on a slow renderer and read a later contact frame.
  const observed = await page.evaluate(() => new Promise(resolve => {
    const qa = window.__gameQA, first = qa.snapshot(), contacts = [];
    let descending = null, health = first.player.health;
    const frame = () => {
      const s = qa.snapshot();
      if (!descending && s.hand.phase === 'strike' && !s.hand.contacted) descending = s;
      if (s.player.health !== health) {
        contacts.push({ state: s, rendered: qa.characters() }); health = s.player.health;
      }
      if (s.status === 'lost') resolve({ first, descending, contacts, final: s });
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
  expect(observed.descending).not.toBeNull();
  expect(observed.descending.player.health).toBe(3);
  expect(observed.descending.hand.pose.y).toBeGreaterThan(0.5);
  expect(observed.contacts).toHaveLength(3);
  for (const [index, { state: hit, rendered }] of observed.contacts.entries()) {
    expect(hit.player.health).toBe(2 - index); expect(hit.hand.contacted).toBe(true);
    expect(hit.hand.pose.y).toBeGreaterThan(0.3);
    expect(hit.hand.pose.y).toBeLessThan(0.65);
    expect(rendered.handContact[1]).toBeCloseTo(hit.hand.pose.y, 5);
    expect(hit.player.x).toBe(observed.first.player.x); expect(hit.player.z).toBe(observed.first.player.z);
  }
  expect(observed.final.reason).toBe('health');
  await expect(page.locator('#hearts')).toContainText('♡');
  await expect(page.getByRole('heading', { name: 'Нас заметили…', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/updated-hand-loss.png' });
  expect(errors).toEqual([]);
});

test('local model failure blocks simulation and retry loads real characters', async ({ page }) => {
  await page.route('**/models/hand.glb', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить персонажей' })).toBeVisible();
  await expect(page.locator('#start')).toBeDisabled();
  expect(await page.evaluate(() => Boolean(window.__gameQA))).toBe(false);
  await page.unroute('**/models/hand.glb');
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await begin(page);
  const s = await page.evaluate(() => window.__gameQA.snapshot());
  expect(s.elapsed).toBeLessThan(2); expect(s.babies).toHaveLength(6);
});

test('rescue moves a real baby in simulation, pauses with the family and resets on restart', async ({ page }) => {
  await page.goto('/'); await begin(page);
  const initial = await page.evaluate(() => window.__gameQA.snapshot());
  const screen = await page.evaluate(p => window.__gameQA.project(p), initial.babies[0]);
  await page.mouse.click(screen.x, screen.y);
  await page.waitForFunction(() => window.__gameQA.snapshot().rescued === 1);
  const target = { x: -9.6, z: -1.5 };
  const next = await page.evaluate(p => window.__gameQA.project(p), target);
  await page.mouse.click(next.x, next.y);
  await page.waitForFunction(() => window.__gameQA.snapshot().babies[0].z < 0);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  const paused = await page.evaluate(() => window.__gameQA.snapshot()); await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__gameQA.snapshot())).babies).toEqual(paused.babies);
  await page.screenshot({ path: 'artifacts/updated-family.png' });
  await page.getByRole('button', { name: 'Заново', exact: true }).click();
  const fresh = await page.evaluate(() => window.__gameQA.snapshot());
  expect(fresh.rescued).toBe(0); expect(fresh.babies[0].x).toBe(initial.babies[0].x);
});
