import * as THREE from 'three';

/** ALLEGRO 150/200: catalogue envelope W95/145 x H540 x D457 mm.
 * Wire pattern, radii and slide internals are simplified, not a drilling template.
 * Local origin is the middle of the assembly, +Z faces the facade. */
export function allegroModel(width: number, right: boolean): THREE.Group {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc7cdd1, metalness: .65, roughness: .28 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x62686c, roughness: .65 });
  function bar(a: number[], b: number[], r = 2) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), v = q.clone().sub(p);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 12), chrome);
    mesh.position.copy(p.add(q).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); g.add(mesh);
  }
  function box(size: number[], at: number[], mat = chrome) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), mat);
    m.position.set(...at as [number, number, number]); g.add(m);
  }
  const x0 = -width / 2 + 2, x1 = width / 2 - 20, z0 = -228.5 + 2, z1 = 216.5;
  // Reinforced front/rear uprights, closed at the top.
  for (const z of [z0, z1]) {
    bar([x0, -270, z], [x0, 268, z]); bar([x1, -270, z], [x1, 268, z]); bar([x0, 268, z], [x1, 268, z]);
  }
  for (const y of [-224, 176]) {
    for (const h of [0, 44, 88]) {
      bar([x0,y+h,z0],[x0,y+h,z1]); bar([x1,y+h,z0],[x1,y+h,z1]);
      bar([x0,y+h,z0],[x1,y+h,z0]); bar([x0,y+h,z1],[x1,y+h,z1]);
    }
    for (let z = z0 + 10; z < z1; z += 16) bar([x0,y,z],[x1,y,z],1.15);
    for (let x = x0 + 10; x < x1; x += 13) bar([x,y,z0],[x,y,z1],1.15);
    box([18, 28, 457], [width/2-9, y-24, 0]);
    box([10, 12, 125], [width/2-9, y-24, -140], plastic);
    // Facade bracket. Mounting-hole pattern intentionally omitted until verified.
    box([Math.min(72,width), 36, 3], [0,y+44,227]);
  }
  for (const z of [-135, -20, 95]) {
    bar([x0,-222,z],[x0,-170,z]); bar([x0,-170,z],[x1,-170,z]); bar([x1,-170,z],[x1,-222,z]);
  }
  // Left hand is a mirrored physical configuration, not a different envelope.
  if (!right) g.scale.x = -1;
  g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
