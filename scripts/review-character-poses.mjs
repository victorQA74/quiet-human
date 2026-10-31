// Capture reproducible visual QA evidence from the existing local model viewer.
// This does not change game state, release files or the viewer's implementation.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2];
if (!base || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(base)) {
  throw new Error('Pass the actual local dev server URL');
}
const url = new URL('artifacts/characters-review.html', `${base.replace(/\/$/, '')}/`).href;
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const issues = [], requests = [], captures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => issues.push(error.message));
  page.on('requestfailed', request => issues.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('request', request => requests.push(request.url()));
  await page.goto(url);
  await expect(page.locator('#mode')).toHaveText('Каракурт · восемь членистых лап');
  await mkdir('artifacts', { recursive: true });
  async function capture(name, expected, controls) {
    for (const control of controls) await page.getByRole('button', { name: control, exact: true }).click();
    await expect(page.locator('#mode')).toHaveText(expected);
    await expect(page.getByLabel('Осмотр трёхмерных моделей')).toBeVisible();
    // Wait for rendering, not an arbitrary wall-clock delay after changing pose.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const path = `artifacts/character-pose-${name}.png`;
    await page.screenshot({ path });
    captures.push({ pose: name, path, label: expected });
  }
  await capture('hand-open', 'Анатомическая кисть · 25 суставов', ['Кисть крупно']);
  await capture('hand-bent', 'Анатомическая кисть · 25 суставов', ['Согнуть пальцы']);
  await capture('contact-side', 'Контакт: ладонь на спине · 0.54', ['Контакт сбоку']);
  await capture('family', 'Семья: взрослый и пять паучат', ['Пять паучат']);
  const externalRequests = requests.filter(request => new URL(request).origin !== new URL(url).origin);
  const report = {
    url, viewport: '1100x800', captures, issues, externalRequests,
    scope: 'Pose controls, visible canvas, screenshots and resource errors only. Naturalness requires image review; finger deformation is tested separately in tests/characters.test.js.',
  };
  await writeFile('artifacts/character-poses-report.json', JSON.stringify(report, null, 2));
  expect(issues).toEqual([]);
  expect(externalRequests).toEqual([]);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
