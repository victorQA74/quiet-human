import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { batchOpaque } from '../src/view/batching.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeSpiderCharacter, makeHandCharacter } from '../src/view/characters.js';

test('batching preserves transformed positions and colours in one mesh', () => {
  const g = new T.Group();
  for (let i = 0; i < 10; i++) { const m = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ color: i % 2 ? '#ff0000' : '#00ff00' })); m.position.x = i * 2; g.add(m); }
  batchOpaque(g);
  assert.equal(g.children.length, 1); assert.ok(g.children[0].geometry.getAttribute('color'));
  g.children[0].geometry.computeBoundingBox(); assert.equal(g.children[0].geometry.boundingBox.max.x, 18.5);
});

test('real skinned characters preserve animation within the mobile draw budget', async () => {
  const load = async name => {
    const b = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  };
  const spider = makeSpiderCharacter(await load('spider')); spider.animate(1, true);
  const hand = makeHandCharacter(await load('hand')); hand.animate({ curl: 0.1, y: 5 });
  assert.equal(spider.legs.length, 8); assert.ok(hand.joints.length >= 20);
  assert.ok(spider.drawObjects <= 4); assert.ok(hand.drawObjects <= 5);
});
