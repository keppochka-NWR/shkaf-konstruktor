import { initialModule, section } from "./model";
import {
  bounds,
  modulesOverlap,
  type Project,
  type PlacedModule,
} from "./project";
import { parseRoomProject } from "./roomDocument";
export type FreePanelInput = {
  name: string;
  width: number;
  height: number;
  thickness: number;
  plane: "xy" | "xz" | "yz";
  edge: number;
  decor: string;
  contour?: [number, number][];
};
export function freePanel(input: FreePanelInput): PlacedModule {
  if (
    !input.name.trim() ||
    ![input.width, input.height, input.thickness, input.edge].every(
      Number.isFinite,
    ) ||
    input.width < 50 ||
    input.height < 50 ||
    input.width > 6000 ||
    input.height > 6000 ||
    input.thickness < 3 ||
    input.thickness > 60 ||
    ![0, 0.4, 0.8, 1, 2].includes(input.edge)
  )
    throw Error("Проверьте размеры панели и кромку.");
  const { width: w, height: h, thickness: t } = input;
  const size: [number, number, number] =
    input.plane === "xy"
      ? [w, h, t]
      : input.plane === "xz"
        ? [w, t, h]
        : [t, h, w];
  const contour = input.contour ?? [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  if (
    contour.length < 3 ||
    contour.length > 32 ||
    contour.some(
      (p) =>
        p.length !== 2 ||
        p.some((n) => !Number.isFinite(n)) ||
        p[0] < 0 ||
        p[1] < 0 ||
        p[0] > w ||
        p[1] > h,
    )
  )
    throw Error("Контур должен находиться в габарите панели.");
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.1)
      throw Error("Совпадающие вершины контура.");
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < contour.length; j++) {
      if (i === 0 && j === contour.length - 1) continue;
      const c = contour[j],
        d = contour[(j + 1) % contour.length];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
          Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
          Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
      )
        throw Error("Контур пересекает сам себя.");
    }
  }
  if (Math.abs(area) < 1) throw Error("Нулевая площадь панели.");
  const edges = contour.map(
    (a, i) =>
      [
        input.edge,
        Math.hypot(
          contour[(i + 1) % contour.length][0] - a[0],
          contour[(i + 1) % contour.length][1] - a[1],
        ),
      ] as [number, number],
  );
  return {
    id: crypto.randomUUID(),
    x: 100,
    y: 0,
    z: 100,
    module: {
      ...initialModule(),
      name: input.name,
      width: size[0],
      height: size[1],
      depth: size[2],
      doors: false,
      backType: "none",
      decor: input.decor,
      facadeDecor: input.decor,
      sections: [section()],
      raw: {
        source: "garderyob-free-panel",
        panels: [
          {
            name: input.name,
            kind: "ldsp",
            box: [0, 0, 0, ...size],
            thick: t,
            edges,
            plane: input.plane,
            ...(input.contour
              ? {
                  contour:
                    input.plane === "yz"
                      ? contour.map(([u, v]) => [v, u] as [number, number])
                      : contour,
                }
              : {}),
          },
        ],
        hardware: [],
      },
    },
  };
}
export function addFreePanel(p: Project, input: FreePanelInput): Project {
  return parseRoomProject({
    ...p,
    modules: [...p.modules, placeFreePanel(p, input)],
  });
}

export function placeFreePanel(
  p: Project,
  input: FreePanelInput,
): PlacedModule {
  const a = freePanel(input);
  for (let z = 10; z <= p.room.depth; z += 50)
    for (let x = 10; x <= p.room.width; x += 50) {
      a.x = x;
      a.z = z;
      const b = bounds(a);
      if (
        b.x >= 0 &&
        b.z >= 0 &&
        b.x + b.w <= p.room.width &&
        b.z + b.d <= p.room.depth &&
        b.h <= p.room.height &&
        !p.modules.some((other) => modulesOverlap(a, other))
      )
        return a;
    }
  throw Error(
    "Нет свободного места для панели. Измените размеры или освободите место.",
  );
}
