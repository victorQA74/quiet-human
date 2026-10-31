import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log(m.type(), m.text()); });
  page.setDefaultTimeout(20000);
  console.log('Navigating');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  console.log('DOM ready');
  await page.waitForFunction(() => Boolean(window.__gameQA));
  console.log('Game ready', await page.evaluate(() => window.__gameQA.metrics()));
  await page.getByRole('button', { name: 'Начать вылазку', exact: true }).click(); console.log('Start clicked');
  await page.getByRole('button', { name: 'Я готов', exact: true }).click(); console.log('Ready clicked');
  await page.waitForTimeout(1200);
  console.log('Metrics', await page.evaluate(() => window.__gameQA.metrics()));
  console.log('State', await page.evaluate(() => ({ status: window.__gameQA.snapshot().status, elapsed: window.__gameQA.snapshot().elapsed })));
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/probe-desktop.png' }); console.log('Screenshot saved');
} finally { await browser.close(); console.log('Browser closed'); }
