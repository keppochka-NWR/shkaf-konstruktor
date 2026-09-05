export const RULES = {
  panel: 16,
  back: 3,
  plinth: 80,
  plinthInset: 50,
  shelfDepthMinus: 25,
  shelfGap: 1,
  minW: 250,
  maxW: 1200,
  minH: 400,
  maxH: 2200,
  minD: 250,
  maxD: 700,
  minSection: 180,
  maxSections: 4,
  maxShelves: 10,
  maxDrawers: 5,
  drawerH: 140,
  drawerStep: 40,
  drawerSideGap: 13,
  drawerFrontGap: 3,
  rodDiameter: 25,
  rodTopOffset: 70,
  rodMinClear: 900,
  shelfMinClear: 80,
  sheetW: 2750,
  sheetH: 1830,
  hdfW: 2800,
  hdfH: 2070,
  // Conservative preview envelope from G code/RULES.md; production release requires confirmation.
  sheetMargin: 10,
  faceGap: 2,
  doorMax: 600,
  drawerFiller: 16,
} as const;
export type Section = {
  id: string;
  weight: number;
  shelves: number[];
  drawers: number;
  rod: boolean;
};
export type Module = {
  version: 1;
  name: string;
  width: number;
  height: number;
  depth: number;
  decor: string;
  facadeDecor: string;
  doors: boolean;
  sections: Section[];
};
export type Part = {
  id: string;
  name: string;
  sectionId?: string;
  size: [number, number, number];
  position: [number, number, number];
  length: number;
  width: number;
  thickness: number;
  material: "board" | "hdf" | "metal";
  decor: string;
  role: "body" | "shelf" | "drawer" | "door" | "rod";
  grain: "length";
  edge: [number, number, number, number];
};
export type SectionBox = {
  id: string;
  x: number;
  width: number;
  bottom: number;
  top: number;
};
export const id = () => crypto.randomUUID();
export const section = (): Section => ({
  id: id(),
  weight: 1,
  shelves: [],
  drawers: 0,
  rod: false,
});
export function initialModule(): Module {
  return {
    version: 1,
    name: "Шкаф в прихожую",
    width: 1000,
    height: 2000,
    depth: 600,
    decor: "Дуб Вотан",
    facadeDecor: "Белый",
    doors: false,
    sections: [
      { ...section(), shelves: [0.26, 0.51, 0.76] },
      { ...section(), shelves: [0.86], drawers: 2, rod: true },
    ],
  };
}
export function boxes(m: Module): SectionBox[] {
  const t = RULES.panel;
  const available = m.width - t * (m.sections.length + 1);
  const total = m.sections.reduce((s, x) => s + x.weight, 0);
  let x = t;
  return m.sections.map((s, i) => {
    const width =
      i === m.sections.length - 1
        ? m.width - t - x
        : Math.round(((available * s.weight) / total) * 10) / 10;
    const b = {
      id: s.id,
      x,
      width,
      bottom: RULES.plinth + t,
      top: m.height - t,
    };
    x += width + t;
    return b;
  });
}
export function parts(m: Module): Part[] {
  const out: Part[] = [];
  const t = RULES.panel;
  const d = m.depth;
  const bottom = RULES.plinth;
  function add(
    key: string,
    name: string,
    size: Part["size"],
    pos: Part["position"],
    length: number,
    width: number,
    thickness: number,
    role: Part["role"] = "body",
    sid?: string,
    material: Part["material"] = "board",
  ) {
    out.push({
      id: key,
      name,
      sectionId: sid,
      size,
      position: pos,
      length,
      width,
      thickness,
      role,
      material,
      decor: role === "door" ? m.facadeDecor : m.decor,
      grain: "length",
      edge: material === "board" ? [0.4, 0.4, 2, 0.4] : [0, 0, 0, 0],
    });
  }
  add(
    "left",
    "Боковина левая",
    [t, m.height, d],
    [t / 2, m.height / 2, d / 2],
    m.height,
    d,
    t,
  );
  add(
    "right",
    "Боковина правая",
    [t, m.height, d],
    [m.width - t / 2, m.height / 2, d / 2],
    m.height,
    d,
    t,
  );
  add(
    "bottom",
    "Дно",
    [m.width - 2 * t, t, d],
    [m.width / 2, bottom + t / 2, d / 2],
    m.width - 2 * t,
    d,
    t,
  );
  add(
    "top",
    "Крыша",
    [m.width - 2 * t, t, d],
    [m.width / 2, m.height - t / 2, d / 2],
    m.width - 2 * t,
    d,
    t,
  );
  add(
    "plinth",
    "Цоколь",
    [m.width - 2 * t, bottom, t],
    [m.width / 2, bottom / 2, d - RULES.plinthInset - t / 2],
    m.width - 2 * t,
    bottom,
    t,
  );
  add(
    "back",
    "Задняя стенка",
    [m.width - 4, m.height - 4, RULES.back],
    [m.width / 2, m.height / 2, -RULES.back / 2],
    m.height - 4,
    m.width - 4,
    RULES.back,
    "body",
    undefined,
    "hdf",
  );
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      sd = d - RULES.shelfDepthMinus;
    if (i > 0)
      add(
        `${s.id}:divider`,
        "Перегородка",
        [t, h, sd],
        [b.x - t / 2, b.bottom + h / 2, sd / 2],
        h,
        sd,
        t,
        "body",
        s.id,
      );
    s.shelves.forEach((f, j) =>
      add(
        `${s.id}:shelf:${j}`,
        "Полка съёмная",
        [b.width - 2 * RULES.shelfGap, t, sd],
        [b.x + b.width / 2, b.bottom + f * h, sd / 2],
        b.width - 2 * RULES.shelfGap,
        sd,
        t,
        "shelf",
        s.id,
      ),
    );
    const filler = m.doors && s.drawers > 0 ? RULES.drawerFiller : 0;
    if (filler)
      add(
        `${s.id}:filler`,
        "Фальш-панель",
        [filler, s.drawers * (RULES.drawerH + RULES.drawerStep), sd],
        [
          b.x + filler / 2,
          b.bottom + (s.drawers * (RULES.drawerH + RULES.drawerStep)) / 2,
          sd / 2,
        ],
        s.drawers * (RULES.drawerH + RULES.drawerStep),
        sd,
        t,
        "body",
        s.id,
      );
    const boxW = b.width - filler - 2 * RULES.drawerSideGap,
      boxD = Math.floor((d - 25) / 50) * 50;
    for (let j = 0; j < s.drawers; j++) {
      const y =
        b.bottom +
        j * (RULES.drawerH + RULES.drawerStep) +
        RULES.drawerStep / 2;
      const bx = b.x + filler + RULES.drawerSideGap;
      const z = d - boxD - 20;
      add(
        `${s.id}:drawer:${j}:left`,
        "Ящик · боковина",
        [t, RULES.drawerH, boxD],
        [bx + t / 2, y + RULES.drawerH / 2, z + boxD / 2],
        boxD,
        RULES.drawerH,
        t,
        "drawer",
        s.id,
      );
      add(
        `${s.id}:drawer:${j}:right`,
        "Ящик · боковина",
        [t, RULES.drawerH, boxD],
        [bx + boxW - t / 2, y + RULES.drawerH / 2, z + boxD / 2],
        boxD,
        RULES.drawerH,
        t,
        "drawer",
        s.id,
      );
      for (const end of ["front", "back"])
        add(
          `${s.id}:drawer:${j}:${end}`,
          end === "front" ? "Ящик · передняя стенка" : "Ящик · задняя стенка",
          [boxW - 2 * t, RULES.drawerH, t],
          [
            bx + boxW / 2,
            y + RULES.drawerH / 2,
            end === "front" ? z + boxD - t / 2 : z + t / 2,
          ],
          boxW - 2 * t,
          RULES.drawerH,
          t,
          "drawer",
          s.id,
        );
      add(
        `${s.id}:drawer:${j}:bottom`,
        "Дно ящика",
        [boxW - 2, RULES.back, boxD - 2],
        [bx + boxW / 2, y - RULES.back / 2, z + boxD / 2],
        boxW - 2,
        boxD - 2,
        RULES.back,
        "drawer",
        s.id,
        "hdf",
      );
    }
    if (s.rod) {
      const topShelf = s.shelves.length
        ? Math.min(...s.shelves.map((f) => b.bottom + f * h))
        : b.top;
      const ry = topShelf - RULES.rodTopOffset;
      add(
        `${s.id}:rod`,
        "Штанга",
        [b.width, RULES.rodDiameter, RULES.rodDiameter],
        [b.x + b.width / 2, ry, d / 2],
        b.width,
        RULES.rodDiameter,
        RULES.rodDiameter,
        "rod",
        s.id,
        "metal",
      );
    }
    if (m.doors) {
      const left = i === 0 ? RULES.faceGap : b.x - t / 2 + RULES.faceGap / 2;
      const right =
        i === m.sections.length - 1
          ? m.width - RULES.faceGap
          : b.x + b.width + t / 2 - RULES.faceGap / 2;
      add(
        `${s.id}:door`,
        "Фасад",
        [right - left, m.height - bottom - 4, t],
        [(right + left) / 2, (m.height + bottom) / 2, d + t / 2 + 2],
        m.height - bottom - 4,
        right - left,
        t,
        "door",
        s.id,
      );
    }
  });
  return out;
}
export function validate(m: Module): string[] {
  const errors: string[] = [];
  for (const [key, label, min, max] of [
    ["width", "Ширина", RULES.minW, RULES.maxW],
    ["height", "Высота", RULES.minH, RULES.maxH],
    ["depth", "Глубина", RULES.minD, RULES.maxD],
  ] as const) {
    const n = m[key];
    if (!Number.isFinite(n) || n < min || n > max)
      errors.push(`${label}: допустимо от ${min} до ${max} мм.`);
  }
  if (errors.length) return errors;
  if (m.sections.length < 1 || m.sections.length > RULES.maxSections)
    return [...errors, "Допустимо от 1 до 4 секций."];
  if (m.sections.some((s) => !Number.isFinite(s.weight) || s.weight <= 0))
    return [...errors, "Ширина секции должна быть положительной."];
  if (new Set(m.sections.map((s) => s.id)).size !== m.sections.length)
    errors.push("Идентификаторы секций повторяются.");
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      prefix = `Секция ${i + 1}: `;
    if (b.width < RULES.minSection)
      errors.push(
        prefix +
          `нужно не менее ${RULES.minSection} мм внутри. Уберите перегородку или увеличьте ширину.`,
      );
    if (
      s.shelves.length > RULES.maxShelves ||
      !Number.isInteger(s.drawers) ||
      s.drawers < 0 ||
      s.drawers > RULES.maxDrawers
    )
      errors.push(prefix + "слишком много элементов.");
    const shelfY = s.shelves.map((f) => f * h).sort((a, b) => a - b);
    const drawerTop = s.drawers * (RULES.drawerH + RULES.drawerStep);
    if (drawerTop > h - RULES.shelfMinClear)
      errors.push(
        prefix +
          "ящики не помещаются по высоте. Уберите один ящик или увеличьте высоту.",
      );
    shelfY.forEach((y, j) => {
      if (
        !Number.isFinite(y) ||
        y < RULES.shelfMinClear ||
        y > h - RULES.shelfMinClear ||
        y < drawerTop + RULES.shelfMinClear ||
        (j > 0 && y - shelfY[j - 1] < RULES.shelfMinClear)
      )
        errors.push(
          prefix +
            "полки слишком близко друг к другу, ящикам или краям. Измените их положение.",
        );
    });
    if (
      s.drawers > 0 &&
      (b.width - (m.doors ? RULES.drawerFiller : 0) < 250 || dTooSmall(m))
    )
      errors.push(
        prefix +
          "для ящиков нужно от 250 мм внутри и глубина корпуса от 300 мм.",
      );
    if (
      s.rod &&
      (shelfY[0] ?? h) - RULES.rodTopOffset - drawerTop < RULES.rodMinClear
    )
      errors.push(
        prefix +
          "под штангой нужно 900 мм до ящиков или дна. Поднимите нижнюю полку или уберите наполнение.",
      );
  });
  for (const p of parts(m)) {
    if (p.material === "metal") continue;
    const sw = p.material === "hdf" ? RULES.hdfW : RULES.sheetW,
      sh = p.material === "hdf" ? RULES.hdfH : RULES.sheetH;
    if (
      !p.size.every((n) => Number.isFinite(n) && n > 0) ||
      p.length > sw - 2 * RULES.sheetMargin ||
      p.width > sh - 2 * RULES.sheetMargin
    )
      errors.push(
        `«${p.name}» не помещается в полезное поле листа или имеет неверный размер.`,
      );
    if (p.role === "door" && p.width > RULES.doorMax)
      errors.push(
        "Фасад шире 600 мм. Разделите модуль на секции или уберите фасады.",
      );
  }
  return [...new Set(errors)];
}
function dTooSmall(m: Module) {
  return m.depth < 300;
}
export function distribute(m: Module, s: Section, count: number): number[] {
  const h = m.height - RULES.plinth - 2 * RULES.panel,
    base = s.drawers * (RULES.drawerH + RULES.drawerStep);
  if (s.rod)
    return count === 0
      ? []
      : Array.from(
          { length: count },
          (_, i) =>
            (base +
              RULES.rodMinClear +
              RULES.rodTopOffset +
              ((h - base - RULES.rodMinClear - RULES.rodTopOffset) * (i + 1)) /
                (count + 1)) /
            h,
        );
  return Array.from(
    { length: count },
    (_, i) => (base + ((h - base) * (i + 1)) / (count + 1)) / h,
  );
}
export function splitSection(m: Module, sid: string): Module {
  const next = structuredClone(m),
    i = next.sections.findIndex((s) => s.id === sid),
    s = next.sections[i];
  if (!s) return next;
  next.sections.splice(
    i,
    1,
    { ...s, weight: s.weight / 2 },
    { ...section(), weight: s.weight / 2 },
  );
  return next;
}
export function parseModule(input: unknown): Module {
  if (!input || typeof input !== "object")
    throw new Error("Файл не содержит модуль.");
  const x = input as Record<string, unknown>;
  if (
    x.version !== 1 ||
    typeof x.name !== "string" ||
    x.name.length > 80 ||
    typeof x.decor !== "string" ||
    typeof x.facadeDecor !== "string" ||
    typeof x.doors !== "boolean" ||
    !Array.isArray(x.sections) ||
    x.sections.length > 4
  )
    throw new Error("Нужен файл модуля из 3D-редактора (.json).");
  for (const s of x.sections) {
    if (
      !s ||
      typeof s.id !== "string" ||
      typeof s.weight !== "number" ||
      !Array.isArray(s.shelves) ||
      s.shelves.length > 10 ||
      !s.shelves.every((v: unknown) => typeof v === "number") ||
      typeof s.drawers !== "number" ||
      typeof s.rod !== "boolean"
    )
      throw new Error("Некорректные данные секции.");
  }
  const m: Module = {
    version: 1,
    name: x.name,
    width: x.width as number,
    height: x.height as number,
    depth: x.depth as number,
    decor: x.decor,
    facadeDecor: x.facadeDecor,
    doors: x.doors,
    sections: x.sections.map((s) => ({
      id: s.id,
      weight: s.weight,
      shelves: [...s.shelves],
      drawers: s.drawers,
      rod: s.rod,
    })),
  };
  const errors = validate(m);
  if (errors.length) throw new Error(errors[0]);
  return m;
}
