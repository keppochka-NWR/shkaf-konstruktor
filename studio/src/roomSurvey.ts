import type { Room } from "./project";
export type SurveyAxis = "width" | "height" | "depth";
export type Surface = "back" | "left" | "right" | "front" | "floor" | "ceiling";
export type Reading = {
  status?: "measured" | "reported" | "unverified";
  source?: string;
  date?: string;
  id: string;
  axis: SurveyAxis;
  x: number;
  y: number;
  z: number;
  value: number;
  note: string;
};
/** A measured grid. Offsets positive into the room, relative to a named laser datum. */
export type SurfaceGrid = {
  datum: string;
  u: number[];
  v: number[];
  offsets: number[][];
  measured?: boolean[][];
};
export type Survey = {
  readings: Reading[];
  surfaces: Partial<Record<Surface, SurfaceGrid>>;
  notes: string;
};
export const SURFACE_NAMES: Record<Surface, string> = {
  back: "Задняя стена",
  left: "Левая стена",
  right: "Правая стена",
  front: "Передняя стена",
  floor: "Пол",
  ceiling: "Потолок",
};
const finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
export function validateSurvey(s: Survey): void {
  if (
    !s ||
    !Array.isArray(s.readings) ||
    s.readings.length > 100 ||
    !s.surfaces ||
    typeof s.notes !== "string" ||
    s.notes.length > 4000
  )
    throw Error("Некорректная карточка замера.");
  const ids = new Set<string>();
  for (const r of s.readings)
    if (
      (r.status !== undefined &&
        !["measured", "reported", "unverified"].includes(r.status)) ||
      (r.source !== undefined &&
        (typeof r.source !== "string" || r.source.length > 300)) ||
      (r.date !== undefined &&
        (typeof r.date !== "string" ||
          (r.date !== "" && !Number.isFinite(Date.parse(r.date)))))
    )
      throw Error("Проверьте источник, дату и статус замера.");
  for (const r of s.readings) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      !["width", "height", "depth"].includes(r.axis) ||
      ![r.x, r.y, r.z, r.value].every(finite) ||
      r.value < 1 ||
      r.value > 30000 ||
      [r.x, r.y, r.z].some((v) => v < 0 || v > 30000) ||
      typeof r.note !== "string"
    )
      throw Error("Проверьте координаты и значение замера.");
    ids.add(r.id);
  }
  for (const [key, g] of Object.entries(s.surfaces)) {
    if (
      !(key in SURFACE_NAMES) ||
      !g ||
      typeof g.datum !== "string" ||
      !g.datum.trim() ||
      g.datum.length > 200
    )
      throw Error("Укажите лазерную базу поверхности.");
    for (const axis of [g.u, g.v])
      if (
        !Array.isArray(axis) ||
        axis.length < 2 ||
        axis.length > 20 ||
        axis.some(
          (n, i) =>
            !finite(n) || n < 0 || n > 30000 || (i > 0 && n <= axis[i - 1]),
        )
      )
        throw Error(
          "Координаты сетки должны возрастать, минимум 2 на каждую ось.",
        );
    if (
      g.measured !== undefined &&
      (!Array.isArray(g.measured) ||
        g.measured.length !== g.v.length ||
        g.measured.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== g.u.length ||
            row.some((v) => typeof v !== "boolean"),
        ))
    )
      throw Error("Некорректные отметки измеренных точек.");
    if (
      !Array.isArray(g.offsets) ||
      g.offsets.length !== g.v.length ||
      g.offsets.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== g.u.length ||
          row.some((n) => !finite(n) || Math.abs(n) > 1000),
      )
    )
      throw Error(
        "Отступы сетки: от −1000 до 1000 мм, значение в каждой точке.",
      );
  }
}
export function parseSurvey(raw: unknown): Survey {
  validateSurvey(raw as Survey);
  return structuredClone(raw as Survey);
}
export function surfaceSize(r: Room, s: Surface) {
  return {
    u:
      s === "floor" || s === "ceiling" || s === "back" || s === "front"
        ? r.width
        : r.depth,
    v: s === "floor" || s === "ceiling" ? r.depth : r.height,
  };
}
export function initialGrid(r: Room, s: Surface): SurfaceGrid {
  const size = surfaceSize(r, s);
  return {
    datum: "Лазерная база " + SURFACE_NAMES[s],
    u: [0, size.u],
    v: [0, size.v],
    offsets: [
      [0, 0],
      [0, 0],
    ],
    measured: [
      [false, false],
      [false, false],
    ],
  };
}
/** Bilinear interpolation through the measured grid; clamped outside, explicitly flagged. */
export function surfaceOffset(
  g: SurfaceGrid | undefined,
  u: number,
  v: number,
): { value: number; outside: boolean } {
  if (!g) return { value: 0, outside: true };
  const outside =
    u < g.u[0] || u > g.u.at(-1)! || v < g.v[0] || v > g.v.at(-1)!;
  const interval = (a: number[], n: number) =>
    Math.max(
      0,
      Math.min(
        a.length - 2,
        a.findIndex((x) => x > n) - 1 < 0
          ? n <= a[0]
            ? 0
            : a.length - 2
          : a.findIndex((x) => x > n) - 1,
      ),
    );
  const i = interval(g.u, u),
    j = interval(g.v, v),
    t = Math.max(0, Math.min(1, (u - g.u[i]) / (g.u[i + 1] - g.u[i]))),
    q = Math.max(0, Math.min(1, (v - g.v[j]) / (g.v[j + 1] - g.v[j])));
  const missing =
    g.measured &&
    [
      g.measured[j][i],
      g.measured[j][i + 1],
      g.measured[j + 1][i],
      g.measured[j + 1][i + 1],
    ].some((v) => !v);
  return {
    value:
      (g.offsets[j][i] * (1 - t) + g.offsets[j][i + 1] * t) * (1 - q) +
      (g.offsets[j + 1][i] * (1 - t) + g.offsets[j + 1][i + 1] * t) * q,
    outside: outside || !!missing,
  };
}
export function surfacePoint(r: Room, s: Surface, u: number, v: number) {
  const o = surfaceOffset(r.survey?.surfaces[s], u, v).value;
  switch (s) {
    case "back":
      return { x: u, y: v, z: o };
    case "front":
      return { x: u, y: v, z: r.depth - o };
    case "left":
      return { x: o, y: v, z: u };
    case "right":
      return { x: r.width - o, y: v, z: u };
    case "floor":
      return { x: u, y: o, z: v };
    case "ceiling":
      return { x: u, y: r.height - o, z: v };
  }
}
export function surveyNotes(r: Room): string[] {
  const s = r.survey;
  if (!s) return [];
  const out: string[] = [];
  for (const axis of ["width", "height", "depth"] as const) {
    const list = s.readings.filter(
      (x) => x.axis === axis && (!x.status || x.status === "measured"),
    );
    if (list.length < 3)
      out.push(
        `${{ width: "Ширина", height: "Высота", depth: "Глубина" }[axis]}: ${list.length} замеров, нужно минимум 3 с координатами.`,
      );
  }
  for (let i = 0; i < s.readings.length; i++)
    for (const b of s.readings.slice(i + 1)) {
      const a = s.readings[i];
      if (
        a.axis === b.axis &&
        a.x === b.x &&
        a.y === b.y &&
        a.z === b.z &&
        Math.abs(a.value - b.value) > 0.1
      )
        out.push(
          `Противоречие замеров в одной точке: ${a.value} и ${b.value} мм, расхождение ${Math.abs(a.value - b.value).toFixed(1)} мм.`,
        );
    }
  if (!Object.keys(s.surfaces).length && s.readings.length)
    out.push(
      "Размеры между стенами не определяют наклон каждой стены. Внесите отступы от лазерной базы.",
    );
  for (const [key, g] of Object.entries(s.surfaces)) {
    const size = surfaceSize(r, key as Surface);
    if (g.measured?.some((row) => row.some((v) => !v)))
      out.push(
        `${SURFACE_NAMES[key as Surface]}: есть незаполненные точки. Нулевые значения заготовки не считаются замером.`,
      );
    if (
      g.u[0] > 0 ||
      g.v[0] > 0 ||
      g.u.at(-1)! < size.u ||
      g.v.at(-1)! < size.v
    )
      out.push(
        `${SURFACE_NAMES[key as Surface]}: часть поверхности вне измеренной сетки; используется крайнее значение.`,
      );
  }
  if (Object.keys(s.surfaces).length)
    out.push(
      "Поверхности интерполированы между точками. Неизмеренные выступы не исключены.",
    );
  return out;
}
