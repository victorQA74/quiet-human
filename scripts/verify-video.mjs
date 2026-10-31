// Read-only verification of the already recorded delivery video. Never re-encode here.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { ffmpegPath } from './media-tools.mjs';

const report = JSON.parse(await readFile('artifacts/video-report.json', 'utf8'));
const result = spawnSync(await ffmpegPath(), ['-hide_banner', '-i', report.video], { encoding: 'utf8', windowsHide: true });
if (result.error) throw result.error;
// FFmpeg inspection without an output deliberately exits 1 after reading metadata.
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const duration = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
assert.ok(duration, output);
const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
assert.equal(seconds, 30, 'The delivered video must be 30 seconds');
assert.equal(report.seconds, seconds);
assert.equal((await stat(report.video)).size, report.bytes);
assert.match(output, /Video: vp9/);
assert.match(output, /960x720/);
assert.doesNotMatch(output, /Audio:/);
assert.equal(report.audio, false);
console.log(`PASS: existing ${report.video}, ${seconds}s, 960x720 VP9, ${report.bytes} bytes, no audio track.`);
