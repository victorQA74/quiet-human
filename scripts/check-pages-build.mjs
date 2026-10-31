import assert from 'node:assert/strict';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED = [
  'index.html', 'favicon.svg', 'THIRD_PARTY_LICENSES.txt',
  'models/hand.glb', 'models/spider.glb', 'models/SOURCES.json', 'models/WEBXR-LICENSE.txt',
];
const ALLOWED_ROOT = new Set(REQUIRED.filter(name => !name.includes('/')));
const ALLOWED_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.txt', '.glb', '.json']);

export async function inspectPagesBuild(directory = 'dist') {
  const root = resolve(directory);
  const files = [];
  async function visit(relative = '') {
    for (const entry of await readdir(resolve(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const stat = await lstat(resolve(root, name));
      assert(!stat.isSymbolicLink(), `Unexpected publication file (symlink): ${name}`);
      assert(!entry.name.startsWith('.'), `Unexpected publication file: ${name}`);
      if (stat.isDirectory()) {
        assert(/^(assets|models)(\/|$)/.test(name), `Unexpected publication file: ${name}`);
        await visit(name);
      } else {
        assert(stat.isFile() && ALLOWED_EXTENSIONS.has(extname(name)) &&
          (ALLOWED_ROOT.has(name) || /^(assets|models)\//.test(name)), `Unexpected publication file: ${name}`);
        files.push(name);
      }
    }
  }
  await visit();
  for (const name of REQUIRED) assert(files.includes(name), `Missing required file: ${name}`);

  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const base = new URL('https://example.invalid/quiet-human/');
  let references = 0;
  for (const [, reference] of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) {
    if (!reference || reference.startsWith('#')) continue;
    const url = new URL(reference, base);
    assert(!reference.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(reference) &&
      url.origin === base.origin && url.pathname.startsWith(base.pathname),
    `Asset paths must be relative to the game: ${reference}`);
    const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
    if (!relative) continue;
    const disk = resolve(root, relative);
    assert(disk.startsWith(`${root}${sep}`) && files.includes(relative), `Missing referenced file: ${reference}`);
    references++;
  }
  assert(references > 0, 'No local assets referenced by index.html');
  return { directory: root, files: files.length, references, subpathSafe: true, modelsAndLicenses: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await inspectPagesBuild(process.argv[2] || 'dist'), null, 2));
}
