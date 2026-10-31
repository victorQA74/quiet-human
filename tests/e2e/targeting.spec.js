import { test, expect } from '@playwright/test';

// Keep software-WebGL raster cost bounded without changing simulation speed.
test.use({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });

test('human guides the hand to a moving spider, locks a rotated warning and lets the spider dodge', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Я готов', exact: true });
  if (await ready.isVisible()) await ready.click();
  await expect(page.locator('#family')).toHaveText('0 / 6');
  // Install before acquisition. Separate RPCs between track and capture used to
  // miss the entire short phase on a software renderer, just like strike descent.
  const capture = page.evaluate(() => new Promise(resolve => {
    const samples = [], start = performance.now();
    const frame = () => {
      const state = window.__gameQA.snapshot(), rendered = window.__gameQA.characters();
      samples.push({ state, rendered, label: document.getElementById('danger-label').textContent });
      if (state.hand.phase === 'recover' || state.status === 'lost' || performance.now() - start > 100000) resolve(samples);
      else requestAnimationFrame(frame);
    };
    frame();
  }));
  // The left lane is clear. Start moving just before the human acquires us and
  // keep going through the locked warning: no teleports or state mutation.
  await page.waitForFunction(() => window.__gameQA.snapshot().elapsed >= 6.7);
  await page.keyboard.down('KeyW');
  let samples;
  try { samples = await capture; }
  finally { await page.keyboard.up('KeyW'); }
  const tracking = samples.filter(s => s.state.hand.phase === 'track');
  expect(tracking.length).toBeGreaterThan(2);
  expect(tracking[0].state.player.z - tracking.at(-1).state.player.z).toBeGreaterThan(0.5);
  for (const { state: s, rendered: r, label } of tracking) {
    expect(s.player.health).toBe(3);
    expect(label).toContain('целится');
    expect(s.hand.target.x).toBeCloseTo(s.player.x, 5);
    expect(s.hand.target.z).toBeCloseTo(s.player.z, 5);
    expect(r.aimVisible).toBe(true); expect(r.warningVisible).toBe(false);
    expect(r.handAngle).toBeCloseTo(s.hand.pose.angle, 5);
    expect(r.handContact[0]).toBeCloseTo(s.hand.pose.x, 5);
    expect(r.handContact[2]).toBeCloseTo(s.hand.pose.z, 5);
  }
  const locked = samples.find(s => s.state.hand.phase === 'warning');
  expect(locked).toBeDefined();
  const attack = samples.filter(s => ['warning', 'strike', 'recover'].includes(s.state.hand.phase));
  for (const { state: s, rendered: r } of attack) {
    expect(s.hand.target).toEqual(locked.state.hand.target);
    expect(r.warningAngle).toBeCloseTo(s.hand.target.angle, 5);
    if (s.hand.phase !== 'recover') expect(r.warningVisible).toBe(true);
  }
  expect(attack.at(-1).state.hand.phase).toBe('recover');
  expect(attack.at(-1).state.player.health).toBe(3);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.screenshot({ path: 'artifacts/targeted-hand-dodge.png' });
  expect(errors).toEqual([]);
});
