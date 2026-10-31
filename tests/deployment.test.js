import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectPagesBuild } from '../scripts/check-pages-build.mjs';

async function fixture(t, changes = {}) {
  const root = await mkdtemp(join(tmpdir(), 'quiet-human-pages-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./assets/game.css"><script type="module" src="./assets/game.js"></script>',
    'assets/game.css': 'body { margin: 0; }',
    'assets/game.js': 'console.log("game");',
    'favicon.svg': '<svg/>',
    'models/hand.glb': 'hand',
    'models/spider.glb': 'spider',
    'models/SOURCES.json': '{}',
    'models/WEBXR-LICENSE.txt': 'MIT',
    'THIRD_PARTY_LICENSES.txt': 'CC BY 3.0',
    ...changes,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    await mkdir(join(root, name, '..'), { recursive: true });
    await writeFile(join(root, name), content);
  }
  return root;
}

test('Pages build includes local models and licenses and resolves below a repository path', async t => {
  const root = await fixture(t);
  const report = await inspectPagesBuild(root);
  assert.equal(report.files, 9);
  assert.equal(report.subpathSafe, true);
});

test('Pages build rejects missing HTML and character resources', async t => {
  for (const name of ['index.html', 'models/hand.glb', 'models/spider.glb', 'models/WEBXR-LICENSE.txt', 'THIRD_PARTY_LICENSES.txt']) {
    const root = await fixture(t, { [name]: null });
    await assert.rejects(inspectPagesBuild(root), /Missing required file/);
  }
});

test('Pages build rejects root-relative asset paths that break project sites', async t => {
  const root = await fixture(t, { 'index.html': '<script src="/assets/game.js"></script>' });
  await assert.rejects(inspectPagesBuild(root), /relative to the game/);
});

test('Pages build rejects external and localhost dependencies', async t => {
  for (const url of ['http://127.0.0.1:5173/game.js', 'https://cdn.example/game.js', '//cdn.example/game.css']) {
    const root = await fixture(t, { 'index.html': `<script src="${url}"></script>` });
    await assert.rejects(inspectPagesBuild(root), /relative to the game/);
  }
});

test('Pages build detects a missing referenced bundle', async t => {
  const root = await fixture(t, { 'assets/game.js': null });
  await assert.rejects(inspectPagesBuild(root), /Missing referenced file/);
});

test('Pages build refuses source maps, credentials and development files', async t => {
  for (const name of ['.env', 'assets/game.js.map', 'package.json', '.git/config']) {
    const root = await fixture(t, { [name]: 'must not publish' });
    await assert.rejects(inspectPagesBuild(root), /Unexpected publication file/);
  }
});
