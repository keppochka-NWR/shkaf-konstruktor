// Превью ручки для окна выбора: та же процедурная модель (handleModels.ts) на кусочке светлого фасада, отрисованная
// одним общим WebGL-рендерером вне сцены (по одной ручке за кадр) → data URL, кэш по id. Фотографий ручек Лемана в репозитории нет.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { handleModel } from "./handleModels";
import { handleSpec, type Handle } from "./handles";

export const PREVIEW_W = 220, PREVIEW_H = 88;
let renderer: THREE.WebGLRenderer | null | undefined;
let env: THREE.Texture | null = null;
const cache = new Map<string, string>();
const waiting = new Map<string, { h: Handle; cbs: ((url: string | null) => void)[] }>();
let scheduled = false;

function ensureRenderer() {
  if (renderer !== undefined) return renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(PREVIEW_W, PREVIEW_H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.04).texture; room.dispose(); pmrem.dispose();
  } catch {
    renderer = null;
  }
  return renderer;
}

/** Отрисовать ручку: модель горизонтально на фасаде, вид спереди-сверху (виден вынос), кадр по габариту ручки. */
function render(h: Handle): string | null {
  const r = ensureRenderer();
  if (!r) return null;
  const spec = handleSpec(h), scene = new THREE.Scene(), edgeLike = spec.shape === "profile" || spec.shape === "edge";
  const model = handleModel(h, env, 16);
  // профили — у верхней кромки фасада (как на ящике): +Y модели (к центру фасада) смотрит вниз
  if (edgeLike) model.rotation.z = Math.PI;
  scene.add(model);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 0.85, metalness: 0 });
  const span = spec.total + 2000, plateH = 2000;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(span, plateH, 16), plateMat);
  plate.position.set(0, edgeLike ? 2 - plateH / 2 : 0, -8);
  scene.add(plate);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.4, 0.8, 1); scene.add(sun);
  // кадр: габарит модели в осях камеры (ортографическая), поле по 14 % от большей стороны
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), centre = box.getCenter(new THREE.Vector3());
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000), dir = new THREE.Vector3(0.28, edgeLike ? 0.62 : 0.5, 1).normalize();
  cam.position.copy(centre).addScaledVector(dir, 1500); cam.up.set(0, 1, 0); cam.lookAt(centre); cam.updateMatrixWorld(true);
  const inv = cam.matrixWorldInverse, p = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    p.set(x, y, z).applyMatrix4(inv); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const pad = 0.14 * Math.max(x1 - x0, (y1 - y0) * 2.5), aspect = PREVIEW_W / PREVIEW_H;
  let w = x1 - x0 + 2 * pad, hh = y1 - y0 + 2 * pad;
  if (w / hh > aspect) hh = w / aspect; else w = hh * aspect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  cam.left = cx - w / 2; cam.right = cx + w / 2; cam.top = cy + hh / 2; cam.bottom = cy - hh / 2; cam.updateProjectionMatrix();
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  plate.geometry.dispose(); plateMat.dispose();
  model.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); });
  return url;
}

/** Готовое превью из кэша (или undefined — ещё не отрисовано). */
export function handlePreviewUrl(h: Handle) {
  return cache.get(h.id);
}

function pump() {
  scheduled = false;
  const next = waiting.entries().next();
  if (next.done) return;
  const [id, job] = next.value;
  waiting.delete(id);
  let url: string | null = null;
  try { url = render(job.h); } catch { url = null; }
  if (url) cache.set(id, url);
  for (const cb of job.cbs) cb(url);
  schedule();
}
function schedule() {
  if (scheduled || !waiting.size) return;
  scheduled = true;
  setTimeout(pump, 0);
}
/** Поставить ручку в очередь отрисовки; cb(null) — WebGL недоступен (остаётся полоска-заглушка). */
export function requestHandlePreview(h: Handle, cb: (url: string | null) => void) {
  const hit = cache.get(h.id);
  if (hit) { cb(hit); return; }
  const job = waiting.get(h.id);
  if (job) job.cbs.push(cb); else waiting.set(h.id, { h, cbs: [cb] });
  schedule();
}
