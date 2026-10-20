// Процедурные 3D-модели ручек (three.js, без файлов): форма по типу, размеры из каталога (handleSpec), материал по покрытию.
// Система координат модели, мм: X — вдоль ручки (межосевое по центру), Y — поперёк в плоскости фасада (+Y — к центру фасада,
// важно для торцевых и профилей у края), Z — наружу от лица фасада (Z = 0 — лицо фасада).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { HANDLE_FINISHES, handleSpec, type Handle, type HandleSpec } from "./handles";

/** Цилиндр вдоль Z от z0 до z1 в точке (x, y). */
function post(r: number, z0: number, z1: number, x: number, y = 0, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}
/** Сечение в плоскости (Y, Z), выдавленное вдоль X на длину L, по центру. */
function extrudeSection(points: [number, number][], L: number) {
  const shape = new THREE.Shape(points.map(([y, z]) => new THREE.Vector2(y, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 4 });
  // (x, y, z) выдавливания → (Y, Z, X) модели: циклическая перестановка осей, нормали остаются наружу
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.translate(-L / 2, 0, 0);
  return g;
}

export function handleGeometries(spec: HandleSpec, facadeT = 16): THREE.BufferGeometry[] {
  const { shape, cc, total, projection: P, section: s, width: w } = spec;
  if (shape === "knob") {
    // Кнопка-грибок: ножка Ø10 и шляпка с закруглённым верхом
    const R = w / 2, pts = [[0, 0], [6, 0], [5, 1.5], [s / 2, 7], [s / 2 + 1, P * 0.42], [R - 3, P * 0.62], [R, P * 0.74], [R - 0.6, P * 0.88], [R - 3.5, P * 0.97], [0, P]].map(([r, h]) => new THREE.Vector2(r, h));
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateX(Math.PI / 2);
    return [g];
  }
  if (shape === "rail") {
    // Рейлинг: труба Ø s со скруглёнными концами на двух стойках с розетками, межосевое cc
    const zc = P - s / 2, legR = s * 0.4;
    const bar = new THREE.CapsuleGeometry(s / 2, total - s, 10, 28);
    bar.rotateZ(-Math.PI / 2);
    bar.translate(0, 0, zc);
    return [bar, ...[-1, 1].flatMap((k) => [post(legR, 0, zc, (k * cc) / 2), post(s * 0.62, 0, 1.6, (k * cc) / 2, 0, 28)])];
  }
  if (shape === "bracket") {
    // Скоба: штанга со скруглёнными кромками (у HEXA — шестигранная) на двух ножках, межосевое cc
    const zc = P - s / 2, legR = s * 0.42;
    let bar: THREE.BufferGeometry;
    if (spec.facets) {
      bar = new THREE.CylinderGeometry(s / 2, s / 2, total, spec.facets);
      bar.rotateZ(-Math.PI / 2);
      bar.translate(0, 0, zc);
    } else {
      bar = new RoundedBoxGeometry(total, w, s, 3, Math.min(w, s) * 0.42);
      bar.translate(0, 0, zc);
    }
    return [bar, ...[-1, 1].map((k) => post(legR, 0, zc, (k * cc) / 2, 0, spec.facets ?? 20))];
  }
  const t = s; // толщина стенки профиля
  if (shape === "edge") {
    // Торцевая Г-образная: полка на торце фасада (Y = −2 — кромка, модель стоит в 2 мм от края) и губка над лицом фасада к центру
    const e = -2;
    return [extrudeSection([[e - t, -facadeT], [e, -facadeT], [e, P - t], [w - t, P - t], [w - t, P - 5], [w, P - 5], [w, P], [e - t, P]], total)];
  }
  // Накладной профиль (П-образный, открыт к центру фасада): основание на лице, стенка у края, губка с пазом под пальцы
  const e = -2;
  return [extrudeSection([[e, 0], [e + w, 0], [e + w, t], [e + t, t], [e + t, P - t], [e + w - 4, P - t], [e + w - 4, P - t - 4], [e + w - 4 + t, P - t - 4], [e + w - 4 + t, P], [e, P]], total)];
}

const cache = new Map<string, THREE.BufferGeometry[]>();
/** Геометрии ручки с кэшем по форме и размерам (экземпляры делят геометрию: userData.sharedGeometry). */
export function cachedHandleGeometries(h: Handle, facadeT = 16) {
  const spec = handleSpec(h), key = JSON.stringify([spec.shape, spec.cc, spec.total, spec.projection, spec.section, spec.width, spec.facets ?? 0, spec.shape === "edge" ? facadeT : 0]);
  let g = cache.get(key);
  if (!g) { g = handleGeometries(spec, facadeT); cache.set(key, g); }
  return g;
}
export function handleMaterial(h: Handle, envMap?: THREE.Texture | null) {
  const f = HANDLE_FINISHES[handleSpec(h).finish];
  return new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness, envMap: envMap ?? null, envMapIntensity: 1 });
}
/** Модель ручки: группа мешей в мм в системе координат выше. */
export function handleModel(h: Handle, envMap?: THREE.Texture | null, facadeT = 16) {
  const g = new THREE.Group(), mat = handleMaterial(h, envMap);
  for (const geo of cachedHandleGeometries(h, facadeT)) { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; g.add(mesh); }
  g.userData.spec = handleSpec(h);
  return g;
}
