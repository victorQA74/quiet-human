import { dirname, join } from 'node:path';
import { readdir, access } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

export async function ffmpegPath() {
  if (process.env.FFMPEG_PATH) { await access(process.env.FFMPEG_PATH); return process.env.FFMPEG_PATH; }
  const root = dirname(dirname(dirname(chromium.executablePath())));
  const folders = (await readdir(root)).filter(n => n.startsWith('ffmpeg-')).sort().reverse();
  for (const folder of folders) {
    const path = join(root, folder, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux');
    try { await access(path); return path; } catch { /* try installed version */ }
  }
  throw new Error('Bundled FFmpeg not found. Run: npx playwright install ffmpeg');
}

export function runMedia(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`FFmpeg exited ${code}: ${output.slice(-4000)}`)));
  });
}

if (process.argv.includes('--inspect')) {
  const binary = await ffmpegPath(); console.log('Using Playwright media encoder:', binary);
  console.log((await runMedia(binary, ['-version'])).split('\n').slice(0, 3).join('\n'));
}
