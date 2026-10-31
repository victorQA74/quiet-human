import { stat, writeFile, copyFile } from 'node:fs/promises';
import { ffmpegPath, runMedia } from './media-tools.mjs';

export async function finalizeVideo(input, offset = 0) {
  const binary = await ffmpegPath(), target = 'artifacts/quiet-human-30s.webm';
  const encoded = 'artifacts/quiet-human-encoded.webm';
  await runMedia(binary, ['-y', '-ss', String(offset), '-i', input, '-t', '30', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-threads', '4', '-b:v', '900k', '-an', encoded]);
  const output = await runMedia(binary, ['-i', encoded, '-c', 'copy', '-f', 'webm', '-y', 'artifacts/video-validation.webm']);
  const duration = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!duration) throw new Error('Missing video duration');
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  if (seconds < 29.8 || seconds > 30.2) throw new Error(`Invalid duration: ${seconds}`);
  await copyFile(encoded, target);
  const report = { video: target, seconds, bytes: (await stat(target)).size, viewport: '960x720', audio: false, source: 'Real Chromium recording. Only normal mouse/keyboard; no game state mutation.' };
  await writeFile('artifacts/video-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); return report;
}

if (process.argv[1]?.endsWith('finalize-video.mjs')) await finalizeVideo(process.argv[2], Number(process.argv[3] || 0));
