import * as THREE from "three";
import type { MeshItem } from "./mesh";

// Процедурные 3D-модели сетчатых элементов Лемана Про: проволочные корзины, брючницы, обувницы.
// Размеры берутся из габарита детали (рама изделия), проволока Ø5 хром, рама Ø8.
const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.95, roughness: 0.22 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.8, roughness: 0.35 });

function rod(len: number, r: number, mat = chrome) {
  const g = new THREE.CylinderGeometry(r, r, len, 10);
  return new THREE.Mesh(g, mat);
}
/** Стержень вдоль оси X/Y/Z с центром в точке. */
function bar(axis: "x" | "y" | "z", len: number, x: number, y: number, z: number, r = 2.5, mat = chrome) {
  const m = rod(len, r, mat);
  if (axis === "x") m.rotation.z = Math.PI / 2;
  else if (axis === "z") m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
/** Прямоугольная рама из стержней в плоскости XZ на высоте y. */
function frame(w: number, d: number, y: number, r = 4, mat = chrome) {
  const g = new THREE.Group();
  g.add(bar("x", w, 0, y, -d / 2, r, mat), bar("x", w, 0, y, d / 2, r, mat), bar("z", d, -w / 2, y, 0, r, mat), bar("z", d, w / 2, y, 0, r, mat));
  return g;
}
/** Направляющие по бокам (тёмные) и монтажные уголки. */
function rails(w: number, d: number, y: number) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const railMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 18, d * 0.9), dark);
    railMesh.position.set(s * (w / 2 + 5), y, 0);
    g.add(railMesh);
  }
  return g;
}

export function basketModel(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const y0 = -h / 2 + 6, y1 = h / 2 - 4, step = 32;
  g.add(frame(w, d, y1), frame(w, d, y0));
  // вертикальные прутки по периметру
  for (let x = -w / 2 + step; x < w / 2 - step / 2; x += step) for (const s of [-1, 1]) g.add(bar("y", y1 - y0, x, (y0 + y1) / 2, s * d / 2));
  for (let z = -d / 2 + step; z < d / 2 - step / 2; z += step) for (const s of [-1, 1]) g.add(bar("y", y1 - y0, s * w / 2, (y0 + y1) / 2, z));
  // дно — сетка
  for (let x = -w / 2 + step; x < w / 2 - step / 2; x += step) g.add(bar("z", d, x, y0, 0, 2));
  for (let z = -d / 2 + 60; z < d / 2 - 30; z += 60) g.add(bar("x", w, 0, y0, z, 2));
  g.add(rails(w, d, y0 + 20));
  return g;
}

export function trousersModel(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const y = h / 2 - 8;
  g.add(frame(w, d, y, 5));
  // вешалки-держатели брюк вдоль ширины
  const n = Math.max(4, Math.floor(w / 55));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    g.add(bar("z", d - 30, x, y - 6, 0, 3));
  }
  // передняя планка
  g.add(bar("x", w, 0, y - 12, d / 2 - 8, 3, dark));
  g.add(rails(w, d, y - 4));
  return g;
}

export function shoesModel(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const tilt = -0.28; // наклонная сетчатая полка
  const shelf = new THREE.Group();
  const step = 30;
  shelf.add(frame(w, d, 0, 4));
  for (let x = -w / 2 + step; x < w / 2 - step / 2; x += step) shelf.add(bar("z", d, x, 0, 0, 2));
  shelf.add(bar("x", w, 0, 12, -d / 2 + 6, 3)); // задний упор
  shelf.rotation.x = tilt;
  shelf.position.y = -h / 2 + h * 0.55;
  g.add(shelf);
  g.add(rails(w, d, -h / 2 + 20));
  return g;
}

export function meshModel(item: MeshItem | undefined, size: [number, number, number]): THREE.Group {
  const [w, h, d] = size;
  const group = item?.kind === "trousers" ? trousersModel(w, h, d) : item?.kind === "shoes" ? shoesModel(w, h, d) : basketModel(w, h, d);
  group.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}
