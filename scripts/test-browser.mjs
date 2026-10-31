import { spawnSync } from 'node:child_process';
const [url, ...args] = process.argv.slice(2);
if (!url || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url)) throw new Error('Pass the actual local dev server URL');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], {
  env: { ...process.env, GAME_URL: url }, stdio: 'inherit', timeout: 600000,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
