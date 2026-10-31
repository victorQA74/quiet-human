import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { flattenHand, fingerAxes, alignPalm, makeForearm } from './hand-fit.js';

function prepare(source) {
  const root = clone(source.scene), joints = [];
  let drawObjects = 0;
  root.traverse(o => {
    if (o.isBone) joints.push(o);
    if (o.isMesh) {
      drawObjects++; o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false;
    }
  });
  return { root, joints, drawObjects };
}
const rotation = (axis, angle) => new T.Quaternion().setFromAxisAngle(axis, angle);
const X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);

export function makeHandCharacter(source) {
  const { root, joints, drawObjects } = prepare(source), group = new T.Group(), pivot = new T.Group();
  group.add(pivot); pivot.add(root);
  // WebXR joints arrive as siblings in model space. Reparent without changing bind pose.
  root.updateMatrixWorld(true);
  const names = new Map(joints.map(j => [j.name, j])), chains = [];
  for (const finger of ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) {
    const suffixes = finger === 'thumb' ? ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'] : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
    const chain = suffixes.map(suffix => names.get(`${finger}-${suffix}`));
    if (chain.some(j => !j)) throw new Error('Неполный скелет кисти');
    for (let i = 1; i < chain.length; i++) chain[i - 1].attach(chain[i]);
    chains.push(chain);
  }
  // Native +Z = little finger, -Y = fingertips, -X = palm side.
  const basis = new T.Matrix4().set(0, 0, 1, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 1);
  root.quaternion.setFromRotationMatrix(basis);
  // Roll the right-hand asset so its palm faces the table, not the overhead camera.
  // World Z is the wrist-to-fingertip axis: rolling preserves the attack direction.
  root.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(Z, Math.PI));
  root.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(X, 0.12)); root.scale.setScalar(20);
  const center = new T.Vector3(0.035, 0.014, 0.009).applyQuaternion(root.quaternion).multiplyScalar(20);
  root.position.set(-center.x, 0, -center.z);
  const skinMat = new T.MeshStandardMaterial({ color: '#be8b73', roughness: 0.62 });
  root.traverse(o => { if (o.isMesh) o.material = skinMat; });
  flattenHand(root, chains);
  const skin = root.getObjectByProperty('isSkinnedMesh', true);
  alignPalm(root, skin);
  group.updateMatrixWorld(true);
  const contact = new T.Object3D(); contact.name = 'PalmContact'; group.add(contact);
  const rest = new Map(joints.map(j => [j, j.quaternion.clone()]));
  const axes = fingerAxes(chains), flex = new T.Quaternion();
  const sleeveMat = new T.MeshStandardMaterial({ color: '#45606a', roughness: 0.88 });
  const { forearm, sleeve } = makeForearm(skin, skinMat, sleeveMat);
  pivot.add(forearm, sleeve);
  const animate = pose => {
    group.rotation.y = pose.angle ?? 0;
    for (const j of joints) j.quaternion.copy(rest.get(j));
    const curl = Math.max(0, Math.min(0.4, pose.curl ?? 0));
    chains.forEach((chain, finger) => {
      for (let i = 1; i < chain.length - 1; i++) {
        flex.setFromAxisAngle(axes[finger][i - 1], curl * (finger === 0 ? 0.45 : i === 1 ? 1 : 0.65));
        chain[i].quaternion.multiply(flex);
      }
    });
    // Wrist tilt vanishes at contact, keeping palm anchor on the target.
    pivot.rotation.x = Math.min(0.12, (pose.y ?? 0) * 0.015);
  };
  animate({ curl: 0, y: 0 });
  return { group, contact, joints, animate, drawObjects: drawObjects + 2 };
}

export function makeSpiderCharacter(source, baby = false) {
  const { root, joints, drawObjects } = prepare(source), group = new T.Group(); group.add(root);
  const legs = joints.filter(j => /^leg_\d+$/.test(j.name));
  const knees = joints.filter(j => /^knee_\d+$/.test(j.name));
  if (legs.length !== 8 || knees.length !== 8) throw new Error('Неполный скелет паука');
  if (baby) root.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color.set(o.material.name.includes('coral') ? '#c48b57' : '#b7c6a6');
    o.material.roughness = 0.6;
  });
  const rest = new Map([...legs, ...knees].map(j => [j, j.quaternion.clone()]));
  group.scale.setScalar(baby ? 0.43 : 0.95);
  const animate = (time, moving, reduced = false) => {
    const active = moving && !reduced;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i], knee = knees.find(j => j.name === `knee_${leg.name.split('_')[1]}`);
      const side = leg.position.x < 0 ? -1 : 1;
      const phase = time * (baby ? 19 : 16) + i * Math.PI * 0.86 + (side > 0 ? Math.PI : 0);
      leg.quaternion.copy(rest.get(leg)).multiply(rotation(Y, active ? Math.cos(phase) * 0.15 : 0));
      knee.quaternion.copy(rest.get(knee)).multiply(rotation(X, active ? Math.max(0, Math.sin(phase)) * 0.14 * side : 0));
    }
    root.position.y = active ? Math.sin(time * 32) * 0.007 : 0;
  };
  animate(0, false);
  return { group, legs, joints, animate, drawObjects };
}
