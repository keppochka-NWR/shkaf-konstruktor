// Плавный переход между видами (запрос Макса 30.10.2026: «давай сделаем плавный переход» — W/A/S/D/E, вкладки видов):
// камера облетает цель по сфере (азимут кратчайшим путём, наклон — линейно), рамка кадра меняется по экспоненте (масштаб без
// рывка), цель кадра — линейно. Ортогональный и перспективный кадры сравниваются по высоте кадра H у цели: перспектива
// на расстоянии H / (2·tg(fov/2)) видит у цели то же, что орто с высотой H, поэтому смена камеры в начале/конце незаметна.
import * as THREE from "three";
import { openEase } from "./editActions";

export const VIEW_MS = 320;
/** Состояние кадра: цель T, направление от цели на камеру d (единичное), высота кадра у цели H, мм. */
export type CamState = { T: THREE.Vector3; d: THREE.Vector3; H: number };

/** Кадр на доле e ∈ [0;1] (уже сглаженной). */
export function tweenState(a: CamState, b: CamState, e: number): CamState {
  const sa = new THREE.Spherical().setFromVector3(a.d), sb = new THREE.Spherical().setFromVector3(b.d);
  let dt = sb.theta - sa.theta;
  dt = Math.atan2(Math.sin(dt), Math.cos(dt)); // кратчайший путь по азимуту (слева → справа — через фасад или спину, но не через потолок)
  const s = new THREE.Spherical(1, sa.phi + (sb.phi - sa.phi) * e, sa.theta + dt * e);
  return { T: a.T.clone().lerp(b.T, e), d: new THREE.Vector3().setFromSpherical(s).normalize(), H: a.H * Math.pow(b.H / a.H, e) };
}
/** Доля перехода по времени (мс с начала) — сглаженная, 1 в конце. */
export const tweenProgress = (ms: number) => openEase(ms / VIEW_MS);
/** Переход нужен: вид сменился, не показ клиенту, пользователь не просит меньше движения. */
export function wantsViewTween(prevView: string | undefined, view: string, presentation: boolean): boolean {
  if (prevView === undefined || prevView === view || presentation) return false;
  try { return !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { return true; }
}
