import { readFile, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeHandCharacter, makeSpiderCharacter } from '../src/view/characters.js';

async function load(name) {
  const b = await readFile(`public/models/${name}.glb`);
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
const models = { hand: makeHandCharacter(await load('hand')), spider: makeSpiderCharacter(await load('spider')) };
const report = {};
for (const [name, model] of Object.entries(models)) {
  model.group.updateMatrixWorld(true);
  const meshes = [];
  model.group.traverse(o => {
    if (!o.isMesh) return;
    meshes.push({ name: o.name, vertices: o.geometry.attributes.position.count, triangles: (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3, bounds: new T.Box3().setFromObject(o, true) });
  });
  const rays = [[0, 0], [0, -0.25], [0, 0.25], [-0.25, 0], [0.25, 0]].map(([x, z]) => {
    const ray = new T.Raycaster(new T.Vector3(x, -5, z), new T.Vector3(0, 1, 0));
    return { x, z, hits: ray.intersectObject(model.group, true).map(h => ({ point: h.point.toArray(), mesh: h.object.name })) };
  });
  report[name] = { bounds: new T.Box3().setFromObject(model.group, true), meshes, undersideRays: rays,
    joints: model.joints.map(j => ({ name: j.name, position: j.getWorldPosition(new T.Vector3()).toArray() })) };
}
await writeFile('artifacts/character-measurements.json', JSON.stringify(report, null, 2));
console.log('Saved current geometry measurements to artifacts/character-measurements.json');
