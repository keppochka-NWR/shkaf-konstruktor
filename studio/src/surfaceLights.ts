import { RULES, type Module, type Part } from './model';
import { cutHost, refFor } from './partIds';

/** A line belongs to a physical panel, not to the cabinet bounding box. */
export type SurfaceLight = { id: string; host: string; ref?: string; face: -1 | 1; along: 0 | 1 | 2; offset: number; start: number; end: number };
export const SURFACE_LIGHT_PREFIX = 'surface-led:';
export function lightHosts(ps: Part[]) {
  return ps.filter(p => ['body', 'shelf', 'back'].includes(p.role) && !p.rotY && !p.rotZ && !p.quat && !p.faceContour && !p.planContour && !p.taper && !p.rearNotch && !p.topNotches && Math.min(...p.size) <= 40 && p.size.filter(v => v > 40).length === 2);
}
export function panelAxes(p: Part) {
  const normal = p.size.indexOf(Math.min(...p.size)) as 0 | 1 | 2;
  const axes = ([0, 1, 2] as const).filter(a => a !== normal);
  return { normal, axes };
}
export function faceLabel(normal: number, sign: number) {
  return normal === 1 ? (sign < 0 ? 'Снизу' : 'Сверху') : normal === 0 ? (sign < 0 ? 'Слева' : 'Справа') : (sign < 0 ? 'Сзади' : 'Спереди');
}
export const axisLabel = (a: number) => ['По ширине', 'По высоте', 'По глубине'][a];
export const offsetLabel = (a: number) => ['От левой кромки', 'От нижней кромки', 'От передней кромки'][a];
export function newSurfaceLight(p: Part, id: string, m?: Module): SurfaceLight {
  const { normal, axes } = panelAxes(p), along = axes.includes(0) ? 0 : axes.includes(1) ? 1 : 2;
  const ref = m ? refFor(m, p.id) : undefined;
  return { id, host: p.id, ...(ref ? {ref} : {}), face: normal === 1 ? -1 : 1, along, offset: 20, start: 20, end: 20 };
}
export function surfaceLightParts(m: Module, ps: Part[]): { parts: Part[]; warnings: string[] } {
  const hosts = lightHosts(ps), out: Part[] = [], warnings: string[] = [];
  const type = m.lightType ?? 'inset';
  const [w, t] = type === 'surface' ? [RULES.lightSurfaceW, RULES.lightSurfaceT] : type === 'tape' ? [RULES.lightTapeW, RULES.lightTapeT] : [RULES.lightProfileW, RULES.lightProfileT];
  for (const line of m.surfaceLights ?? []) {
    const host = hosts.find(p => p.id === cutHost(m, line));
    if (!host) { warnings.push('Деталь для линии подсветки отсутствует или её форма не поддерживается. Выберите другую деталь.'); continue; }
    const { normal, axes } = panelAxes(host), across = axes.find(a => a !== line.along)!;
    const len = host.size[line.along] - line.start - line.end;
    if (!axes.includes(line.along) || len <= 0 || line.offset + w > host.size[across]) {
      warnings.push(`Подсветка «${host.name}» не помещается: проверьте отступы и направление.`); continue;
    }
    const position = [...host.position] as [number, number, number], size = [0, 0, 0] as [number, number, number];
    size[normal] = t; size[line.along] = len; size[across] = w;
    // Inset profiles finish flush; other profiles stand outside the mounting face.
    position[normal] += line.face * (host.size[normal] / 2 + (type === 'inset' ? -t / 2 + 0.2 : t / 2));
    const dir = line.along === 2 ? -1 : 1;
    position[line.along] += dir * (line.start - line.end) / 2;
    position[across] += (across === 2 ? -1 : 1) * (-host.size[across] / 2 + line.offset + w / 2);
    out.push({ id: SURFACE_LIGHT_PREFIX + line.id, name: `Подсветка ${host.name} · ${faceLabel(normal, line.face).toLowerCase()}`, role: 'light', material: 'metal', size, position, length: len, width: w, thickness: t, decor: '', grain: 'length', grainAxis: line.along, edge: [0, 0, 0, 0] });
  }
  return { parts: out, warnings };
}
export function parseSurfaceLights(value: unknown): SurfaceLight[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw Error('Неверный список линий подсветки.');
  const ids = new Set<string>();
  return value.map(v => {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id || ids.has(v.id) || typeof v.host !== 'string' || ![-1, 1].includes(v.face) || ![0, 1, 2].includes(v.along) || !['offset', 'start', 'end'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 10000)) throw Error('Неверные параметры линии подсветки.');
    ids.add(v.id);
    return { id: v.id, host: v.host, ...(typeof v.ref === 'string' ? {ref:v.ref} : {}), face: v.face, along: v.along, offset: v.offset, start: v.start, end: v.end };
  });
}
