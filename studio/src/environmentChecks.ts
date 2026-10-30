import { bounds, localToRoom, moduleFootprint, type Project, type Opening } from "./project";
import { fixtureBox } from "./fixtures";
import { edgeZone, openingEdge } from "./roomEdges";
import { edgePoint, inwardNormal } from "./roomOutline";
import { convexOverlap } from "./roomGeometry";
import {
  surfaceOffset,
  surveyNotes,
  SURFACE_NAMES,
  type Surface,
} from "./roomSurvey";
type Pt = { x: number; z: number };
/** Analytic sector intersection: tests corners, radial segments and circle/edge intersections. */
export function sectorHitsPolygon(
  poly: Pt[],
  radius: number,
  angle: number,
): boolean {
  if (radius <= 0 || angle <= 0) return false;
  const end = (angle * Math.PI) / 180,
    eps = 1e-7;
  const inside = (p: Pt) => {
    const a = Math.atan2(p.z, p.x);
    return Math.hypot(p.x, p.z) <= radius + eps && a >= -eps && a <= end + eps;
  };
  if (poly.some(inside)) return true;
  let contains = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.z > 0 !== b.z > 0 && 0 < ((b.x - a.x) * -a.z) / (b.z - a.z) + a.x)
      contains = !contains;
  }
  if (contains) return true;
  const cross = (a: Pt, b: Pt) => a.x * b.z - a.z * b.x;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      v = { x: b.x - a.x, z: b.z - a.z },
      A = v.x * v.x + v.z * v.z;
    for (const theta of [0, end]) {
      const ray = { x: radius * Math.cos(theta), z: radius * Math.sin(theta) },
        den = cross(v, ray);
      if (Math.abs(den) > eps) {
        const t = -cross(a, ray) / den,
          q = -cross(a, v) / den;
        if (t >= 0 && t <= 1 && q >= 0 && q <= 1) return true;
      }
    }
    const B = 2 * (a.x * v.x + a.z * v.z),
      C = a.x * a.x + a.z * a.z - radius * radius,
      disc = B * B - 4 * A * C;
    if (A > eps && disc >= 0)
      for (const t of [
        (-B - Math.sqrt(disc)) / (2 * A),
        (-B + Math.sqrt(disc)) / (2 * A),
      ])
        if (t >= 0 && t <= 1 && inside({ x: a.x + t * v.x, z: a.z + t * v.z }))
          return true;
  }
  return false;
}
export function openingSweepPoint(o: Opening, r: Project["room"], p: Pt): Pt {
  // контур (задача Макса 30.10.2026): створка — на своей стене контура; ось вдоль — по хорде проёма, внутрь — её нормаль.
  // «Справа» — конец, куда растёт отступ (roomEdges.itemAlong): у проёма со своей стеной контура — её конец (начало стены слева, если
  // смотреть из комнаты), у старого проёма без edge — конец с большим старым отступом (dir). Правка контура и выгрузка в Базис
  // переводят петлю и подоконник так, чтобы они остались на месте (roomEdges.keepHanded, критик 30.10)
  if (r.outline) {
    const e = openingEdge(r, o), end = (o.hinge === "right") !== (e.dir < 0), a = edgePoint(r.outline, e.edge, e.offset), b = edgePoint(r.outline, e.edge, e.offset + o.width);
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1, t = { x: (b.x - a.x) / l, z: (b.z - a.z) / l }, n = inwardNormal(a, b), h = end ? b : a, d = { x: p.x - h.x, z: p.z - h.z };
    return { x: (d.x * t.x + d.z * t.z) * (end ? -1 : 1), z: (d.x * n.x + d.z * n.z) * (o.direction === "out" ? -1 : 1) };
  }
  const along = o.wall === "back" || o.wall === "front" ? p.x : p.z;
  const inward =
    o.wall === "back"
      ? p.z
      : o.wall === "front"
        ? r.depth - p.z
        : o.wall === "left"
          ? p.x
          : r.width - p.x;
  const right = o.hinge === "right",
    hinge = o.offset + (right ? o.width : 0);
  return {
    x: (along - hinge) * (right ? -1 : 1),
    z: inward * (o.direction === "out" ? -1 : 1),
  };
}
export function environmentChecks(p: Project) {
  const result: {
    moduleId: string;
    openingId?: string;
    fixtureId?: string;
    kind: string;
    message: string;
  }[] = [];
  const r = p.room;
  for (const a of p.modules) {
    const b = bounds(a);
    for (const [side, g] of Object.entries(r.survey?.surfaces ?? {})) {
      const key = side as Surface,
        axis = key === "floor" || key === "ceiling";
      const u0 = axis || key === "back" || key === "front" ? b.x : b.z,
        u1 = u0 + (axis || key === "back" || key === "front" ? b.w : b.d),
        v0 = axis ? b.z : b.y,
        v1 = v0 + (axis ? b.d : b.h);
      const us = [u0, u1, ...g.u.filter((u) => u > u0 && u < u1)],
        vs = [v0, v1, ...g.v.filter((v) => v > v0 && v < v1)];
      const values = us.flatMap((u) => vs.map((v) => surfaceOffset(g, u, v)));
      const nearest =
        key === "left"
          ? b.x
          : key === "right"
            ? r.width - b.x - b.w
            : key === "back"
              ? b.z
              : key === "front"
                ? r.depth - b.z - b.d
                : key === "floor"
                  ? b.y
                  : r.height - b.y - b.h;
      const intrusion = Math.max(...values.map((x) => x.value)) - nearest;
      if (intrusion > 0.1)
        result.push({
          moduleId: a.id,
          kind: "survey-" + key,
          message: `«${a.module.name}»: ${SURFACE_NAMES[key]} входит в габарит мебели до ${intrusion.toFixed(1)} мм. Проверьте сечение${values.some((x) => x.outside) ? " и недостающие точки замера" : ""}. Проверка по габариту.`,
        });
    }
    for (const o of r.openings ?? []) {
      if (b.y >= o.sill + o.height || b.y + b.h <= o.sill) continue;
      const poly = [
        [0, 0],
        [a.module.width, 0],
        [a.module.width, a.module.depth],
        [0, a.module.depth],
      ].map(([u, v]) => openingSweepPoint(o, r, localToRoom(a, u, v)));
      if (
        sectorHitsPolygon(
          poly,
          o.width + (o.handleProjection ?? 60),
          o.swingAngle ?? 90,
        )
      )
        result.push({
          moduleId: a.id,
          openingId: o.id,
          kind: "opening-sweep",
          message: `«${a.module.name}»: попадает в зону полного открывания ${o.type === "door" ? "двери" : "окна"}. Проверка одной поворотной створки с запасом под ручку; уточните конструкцию проёма.`,
        });
    }
    for (const f of r.fixtures ?? []) {
      if (!(f.serviceClearance && f.serviceClearance > 0)) continue;
      // контур: зона доступа — от стены контура на выступ + зазор доступа (повёрнутый четырёхугольник)
      if (r.outline) {
        const e = openingEdge(r, f), gap = f.wallGap ?? 0, zone = edgeZone(r.outline, e.edge, e.offset, e.offset + f.width, gap, gap + Math.max(0, f.depth) + f.serviceClearance);
        // след корпуса повёрнутый (критик 30.10: габарит по осям у корпуса под 45° задевал зону с запасом)
        if (b.y < f.fromFloor + f.height && b.y + b.h > f.fromFloor && convexOverlap(moduleFootprint(a), zone, 0))
          result.push({ moduleId: a.id, fixtureId: f.id, kind: "service-zone", message: `«${a.module.name}»: занимает заданную зону доступа к «${f.name ?? f.type}» (${f.serviceClearance} мм).` });
        continue;
      }
      const box = fixtureBox(r, f),
        c = f.serviceClearance;
      const zone =
        f.wall === "back"
          ? { ...box, d: box.d + c }
          : f.wall === "front"
            ? { ...box, z: box.z - c, d: box.d + c }
            : f.wall === "left"
              ? { ...box, w: box.w + c }
              : { ...box, x: box.x - c, w: box.w + c };
      if (
        b.x < zone.x + zone.w &&
        b.x + b.w > zone.x &&
        b.z < zone.z + zone.d &&
        b.z + b.d > zone.z &&
        b.y < zone.y + zone.h &&
        b.y + b.h > zone.y
      )
        result.push({
          moduleId: a.id,
          fixtureId: f.id,
          kind: "service-zone",
          message: `«${a.module.name}»: занимает заданную зону доступа к «${f.name ?? f.type}» (${c} мм).`,
        });
    }
  }
  if (p.modules.length)
    for (const message of surveyNotes(r))
      result.push({ moduleId: p.modules[0].id, kind: "survey-note", message });
  return result;
}
