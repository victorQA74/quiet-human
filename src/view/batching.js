import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake opaque, untextured parts in root-local space. Shared source assets stay intact.
export function batchOpaque(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), parts = [], sources = [];
  root.traverse(o => {
    // Skinning and animated descendants must retain geometry attributes and hierarchy.
    let animated = false;
    for (let p = o; p && p !== root; p = p.parent) if (p.isSkinnedMesh || p.isBone || p.userData.animated) animated = true;
    if (!o.isMesh || animated || o.isInstancedMesh || o.morphTargetInfluences || Array.isArray(o.material) || o.material.map || o.material.transparent) return;
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), color = o.material.color;
    for (let i = 0; i < count; i++) { colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b; }
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); parts.push(geometry); sources.push(o);
  });
  if (!parts.length) return root;
  const combined = mergeGeometries(parts);
  if (!combined) throw new Error('Incompatible procedural geometry');
  const merged = new T.Mesh(combined, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  merged.castShadow = sources.some(o => o.castShadow); merged.receiveShadow = true;
  for (const source of sources) source.removeFromParent();
  for (const geometry of parts) geometry.dispose();
  root.add(merged); return root;
}
