import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeHandCharacter, makeSpiderCharacter } from '../src/view/characters.js';
import { batchOpaque } from '../src/view/batching.js';
import { handHits, HAND_SHAPES, ellipseHitsCircle } from '../src/game/hand.js';

async function load(name) {
  const buffer = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

test('hand collision includes fingers and body edge but not empty space outside the footprint', () => {
  assert.ok(handHits({ x: 0, z: 0 }, { x: 0, z: 0 }));
  assert.ok(handHits({ x: 0.24, z: 2.5 }, { x: 0, z: 0 }), 'finger can hit outside the old circle');
  assert.ok(handHits({ x: 1.55, z: 0.9 }, { x: 0, z: 0 }), 'thumb reaches the mirrored side');
  assert.equal(handHits({ x: -1.55, z: 0.9 }, { x: 0, z: 0 }), false, 'old thumb side is no longer dangerous');
  assert.ok(handHits({ x: 1.3, z: 0 }, { x: 0, z: 0 }), 'body radius participates');
  assert.equal(handHits({ x: 2, z: 0 }, { x: 0, z: 0 }), false);
  assert.equal(handHits({ x: 0, z: -2 }, { x: 0, z: 0 }), false);
  assert.equal(HAND_SHAPES.length, 6);
});

test('batching never destroys animated skinning or its parent hierarchy', () => {
  const root = new T.Group(), bone = new T.Bone(), skin = new T.SkinnedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const skeleton = new T.Skeleton([bone]); skin.add(bone); skin.bind(skeleton); root.add(skin);
  batchOpaque(root);
  assert.equal(skin.parent, root); assert.equal(skin.skeleton.bones[0], bone);
  assert.equal(root.children.filter(o => o.isSkinnedMesh).length, 1);
});

test('local hand is skinned, anatomically posed and contact-centred; independent copies preserve source', async () => {
  const source = await load('hand'), a = makeHandCharacter(source), b = makeHandCharacter(source);
  const skins = []; a.group.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  assert.ok(skins.length); assert.ok(a.joints.length >= 20);
  a.animate({ curl: 0, y: 0 }); a.group.updateMatrixWorld(true);
  const palm = a.contact.getWorldPosition(new T.Vector3()); assert.ok(palm.length() < 1e-5);
  assert.equal(a.joints[0] === b.joints[0], false);
  const before = b.joints.map(o => o.quaternion.toArray());
  a.animate({ curl: 0.3, y: 6 });
  assert.deepEqual(b.joints.map(o => o.quaternion.toArray()), before);
  assert.ok(a.drawObjects <= 5);
});

test('palm faces the table while fingertips still point into the danger area', async () => {
  const hand = makeHandCharacter(await load('hand'));
  hand.animate({ curl: 0, y: 0 }); hand.group.updateMatrixWorld(true);
  const skin = hand.group.getObjectByProperty('isSkinnedMesh', true);
  // The WebXR right-hand asset's palm normal is native -X (the crease side).
  // It must face -Y in the world: dorsal skin is what the overhead camera sees.
  const palmNormal = new T.Vector3(-1, 0, 0).transformDirection(skin.matrixWorld);
  assert.ok(palmNormal.y < -0.9, 'palm must face the spider/table, not the camera');
  const tips = hand.joints.filter(j => j.name.endsWith('-tip'));
  assert.ok(tips.every(tip => tip.getWorldPosition(new T.Vector3()).z > 0.8), 'fingers still lead the strike');
  assert.ok(hand.joints.find(j => j.name === 'thumb-tip').getWorldPosition(new T.Vector3()).x > 0.8,
    'thumb matches the mirrored warning footprint');
});

test('finger curl bends all fingertips toward the palm, deforms skin and resets without drift', async () => {
  const hand = makeHandCharacter(await load('hand'));
  const skin = hand.group.getObjectByProperty('isSkinnedMesh', true);
  const tips = hand.joints.filter(j => j.name.endsWith('-tip'));
  assert.equal(tips.length, 5);
  const snapshot = () => {
    hand.group.updateMatrixWorld(true);
    return {
      tips: tips.map(j => j.getWorldPosition(new T.Vector3())),
      vertices: Array.from({ length: skin.geometry.attributes.position.count }, (_, i) =>
        skin.getVertexPosition(i, new T.Vector3()).applyMatrix4(skin.matrixWorld)),
      palm: hand.contact.getWorldPosition(new T.Vector3()),
    };
  };
  hand.animate({ curl: 0, y: 0 });
  const open = snapshot();
  hand.animate({ curl: 0.35, y: 0 });
  const bent = snapshot();
  for (const [i, tip] of tips.entries()) {
    assert.ok(bent.tips[i].y < open.tips[i].y - 0.02, `${tip.name} must bend toward the palm`);
  }
  assert.ok(bent.vertices.some((p, i) => p.distanceTo(open.vertices[i]) > 0.1), 'visible skin must follow the skeleton');
  assert.ok(bent.palm.distanceTo(open.palm) < 1e-6, 'curl must not move the palm contact');
  hand.animate({ curl: 0.35, y: 0 });
  const repeated = snapshot();
  assert.ok(repeated.vertices.every((p, i) => p.distanceTo(bent.vertices[i]) < 1e-6), 'posing must not accumulate rotations');
  hand.animate({ curl: 0, y: 0 });
  const reset = snapshot();
  assert.ok(reset.vertices.every((p, i) => p.distanceTo(open.vertices[i]) < 1e-6), 'opening must restore the skin');
});

test('palm anchor measures actual skin, and forearm stays above the contact plane', async () => {
  const hand = makeHandCharacter(await load('hand')); hand.animate({ curl: 0, y: 0 });
  hand.group.updateMatrixWorld(true);
  const skin = hand.group.getObjectByProperty('isSkinnedMesh', true);
  const ray = new T.Raycaster(new T.Vector3(0, -5, 0), new T.Vector3(0, 1, 0));
  const hits = ray.intersectObject(skin);
  assert.ok(hits.length, 'palm has a real underside at the target');
  assert.ok(Math.abs(hits[0].point.y) < 0.025, 'anchor is skin, not a dummy at arbitrary origin');
  const forearm = hand.group.getObjectByName('Forearm');
  assert.ok(forearm, 'wrist-fitted forearm');
  assert.ok(new T.Box3().setFromObject(forearm, true).min.y >= -0.025, 'forearm must not enter the table');
});

test('danger footprint follows the actual resting fingertips, including the thumb', async () => {
  const hand = makeHandCharacter(await load('hand')); hand.animate({ curl: 0, y: 0 });
  hand.group.updateMatrixWorld(true);
  for (const tip of hand.joints.filter(j => j.name.endsWith('-tip'))) {
    const p = tip.getWorldPosition(new T.Vector3());
    assert.ok(HAND_SHAPES.some(shape => ellipseHitsCircle(p.x, p.z, shape, 0.16)), `warning omits ${tip.name}`);
  }
});

test('aimed hand turns its forearm and fingers while preserving the downward palm and contact anchor', async () => {
  const hand = makeHandCharacter(await load('hand'));
  hand.group.position.set(3, 0.54, -2);
  const angle = Math.PI / 2;
  hand.animate({ curl: 0, y: 0, angle }); hand.group.updateMatrixWorld(true);
  assert.ok(hand.contact.getWorldPosition(new T.Vector3()).distanceTo(hand.group.position) < 1e-6);
  const tip = hand.joints.find(j => j.name === 'middle-finger-tip').getWorldPosition(new T.Vector3());
  assert.ok(tip.x > 4.5 && Math.abs(tip.z + 2) < 0.5, 'fingers turn toward the aimed target');
  const skin = hand.group.getObjectByProperty('isSkinnedMesh', true);
  assert.ok(new T.Vector3(-1, 0, 0).transformDirection(skin.matrixWorld).y < -0.9);
  assert.ok(handHits({ x: tip.x, z: tip.z }, { x: 3, z: -2, angle }), 'rotated warning covers rendered fingers');
  const arm = hand.group.getObjectByName('Forearm');
  const center = new T.Box3().setFromObject(arm, true).getCenter(new T.Vector3());
  assert.ok(center.x < 3, 'forearm follows the wrist, not its old world direction');
});

test('spider has articulated eight legs, independent baby pose and bounded draw calls', async () => {
  const source = await load('spider'), adult = makeSpiderCharacter(source), baby = makeSpiderCharacter(source, true);
  assert.equal(adult.legs.length, 8); assert.equal(baby.legs.length, 8);
  const before = baby.legs.map(o => o.quaternion.toArray());
  adult.animate(1, true); assert.deepEqual(baby.legs.map(o => o.quaternion.toArray()), before);
  assert.ok(adult.drawObjects <= 4); assert.ok(baby.drawObjects <= 4);
  const box = new T.Box3().setFromObject(adult.group);
  assert.ok(box.min.y > -0.08); assert.ok(box.max.y < 1.2);
  assert.ok(box.max.x - box.min.x < 2);
});
