import * as T from 'three';

const worldY = new T.Vector3(0, 1, 0);

// Rotate a bone in world space while preserving its skinned bind transform.
function rotateWorld(joint, axis, angle) {
  const parent = joint.parent.getWorldQuaternion(new T.Quaternion());
  const localAxis = axis.clone().applyQuaternion(parent.invert());
  joint.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(localAxis, angle));
  joint.updateWorldMatrix(false, true);
}

export function flattenHand(root, chains) {
  root.updateMatrixWorld(true);
  for (const chain of chains) {
    // The supplied reference pose is gently cupped. Lay each phalanx along
    // the table, preserving the thumb's opposition and fingers' natural splay.
    for (let i = 1; i < chain.length - 1; i++) {
      const a = chain[i].getWorldPosition(new T.Vector3());
      const b = chain[i + 1].getWorldPosition(new T.Vector3());
      const direction = b.sub(a), horizontal = Math.hypot(direction.x, direction.z);
      const axis = new T.Vector3(direction.z, 0, -direction.x).normalize();
      rotateWorld(chain[i], axis, Math.atan2(direction.y, horizontal));
    }
  }
  root.updateMatrixWorld(true);
}

export function fingerAxes(chains) {
  return chains.map(chain => chain.slice(1, -1).map(joint => {
    const q = joint.getWorldQuaternion(new T.Quaternion()).invert();
    const next = chain[chain.indexOf(joint) + 1];
    const direction = next.getWorldPosition(new T.Vector3()).sub(joint.getWorldPosition(new T.Vector3())).normalize();
    // Local flexion axis bends toward the palm, not sideways into its neighbour.
    return new T.Vector3(direction.z, 0, -direction.x).normalize().applyQuaternion(q);
  }));
}

export function alignPalm(root, skin) {
  root.updateMatrixWorld(true);
  // With the palm facing down, find its real lower skin surface at the impact centre.
  const ray = new T.Raycaster(new T.Vector3(0, -10, 0), worldY);
  const hit = ray.intersectObject(skin)[0];
  if (!hit) throw new Error('Не найдена поверхность ладони');
  root.position.y -= hit.point.y;
  root.updateMatrixWorld(true);
}

function hull2D(points) {
  const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = values => {
    const result = [];
    for (const p of values) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    result.pop(); return result;
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

export function makeForearm(skin, material, sleeveMaterial) {
  // Fit the loft to the actual capped wrist vertices, not an unrelated cylinder.
  const positions = skin.geometry.attributes.position, points = [];
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) < 0.064) continue;
    const p = skin.getVertexPosition(i, new T.Vector3()).applyMatrix4(skin.matrixWorld);
    if (!points.some(q => q.distanceToSquared(p) < 1e-8)) points.push(p);
  }
  const ring = hull2D(points);
  if (ring.length < 6) throw new Error('Не найден контур запястья');
  const center = ring.reduce((sum, p) => sum.add(p), new T.Vector3()).multiplyScalar(1 / ring.length);
  const createLoft = (rings, name, mat) => {
    const vertices = [], indices = [];
    for (const [distance, sx, sy, rise] of rings) for (const p of ring) {
      vertices.push(center.x + (p.x - center.x) * sx, center.y + (p.y - center.y) * sy + rise, p.z - distance);
    }
    const n = ring.length;
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + (i + 1) % n, c = a + n, d = b + n;
      indices.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices); g.computeVertexNormals();
    const mesh = new T.Mesh(g, mat); mesh.name = name; return mesh;
  };
  const forearm = createLoft([[ -0.06, 0.99, 0.99, 0 ], [0.4, 1, 1, 0.05], [1.8, 1.16, 1.15, 0.26], [3.8, 1.35, 1.28, 0.52]], 'Forearm', material);
  const sleeve = createLoft([[3.35, 1.43, 1.36, 0.52], [3.5, 1.46, 1.4, 0.54], [6.2, 1.65, 1.6, 0.95]], 'Sleeve', sleeveMaterial);
  return { forearm, sleeve };
}
