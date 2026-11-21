import type { Module, Part } from './model';
import { cutHost } from './partIds';
import { faceLabel, lightHosts, newSurfaceLight, panelAxes, SURFACE_LIGHT_PREFIX } from './surfaceLights';
import type { LightOrient } from './lights';

/** The hit normal is in panel-local coordinates. Never pick a panel hidden behind the hit. */
export function pickSurfaceLight(m: Module, ps: Part[], pid: string, hitNormal: readonly number[], orient: LightOrient, id: string) {
  const existing = pid.startsWith(SURFACE_LIGHT_PREFIX) ? m.surfaceLights?.find(l => SURFACE_LIGHT_PREFIX + l.id === pid) : undefined;
  const host = lightHosts(ps).find(p => p.id === (existing ? cutHost(m, existing) : pid));
  if (!host) return { changed: false, note: 'Выберите пласть прямоугольной боковины, дна, крыши, полки или задней стенки.' };
  const { normal, axes } = panelAxes(host);
  if (!existing && (!Number.isFinite(hitNormal[normal]) || Math.abs(hitNormal[normal]) < 0.9))
    return { changed: false, note: 'Нажмите на широкую пласть детали, а не на торец.' };
  const face = existing?.face ?? (hitNormal[normal] < 0 ? -1 : 1);
  const same = existing ?? m.surfaceLights?.find(l => cutHost(m, l) === host.id && l.face === face);
  if (same) {
    m.surfaceLights = m.surfaceLights!.filter(l => l.id !== same.id);
    return { changed: true, note: `Убрана: ${host.name} · ${faceLabel(normal, face).toLowerCase()}` };
  }
  const line = newSurfaceLight(host, id, m);
  if (orient === 'vertical' && !axes.includes(1)) return { changed: false, note: 'На этой пласти выберите «Горизонталь» или «По детали».' };
  line.along = orient === 'vertical' || (orient === 'both' && axes.includes(1)) ? 1 : axes.includes(0) ? 0 : 2;
  line.face = face;
  m.surfaceLights = [...(m.surfaceLights ?? []), line];
  return { changed: true, note: `${host.name} · ${faceLabel(normal, face).toLowerCase()}. Отступы — в «Список…».` };
}
