// Сборка проекта студии из эталона кухни Базиса (общая для import.ts и тестов): модуль, прошедший сверку (PASS), — параметрический;
// остальные — «сырые» (детали Базиса как есть). Расстановка и повороты — из эталона (p_world = origin + Ry(yaw)·p_mod). Объекты ряда
// (столешница, цоколь, стеновые панели, профили) — отдельный сырой объект «Ряд».
// Правило Макса: в кухню из Базиса студия не добавляет того, чего нет в Базисе. Поэтому:
//  — все модули с признаком bazis (автофальши шкафов, мелочёвка и заглушки в смете к ним не применяются);
//  — декор панелей — из Базиса (ЛДСП Lamarty «Черный», МДФ IDM…), а не «Белый/Слэйт» на всю кухню;
//  — фурнитура, которую смета не считает отдельно (Firmax, Indigo, РАФИКС, сушка, профили ряда, штанга…), — строками «как в Базисе»;
//  — названия петель и полкодержателей — из Базиса;
//  — цоколь (роль эталона plinth) — «Цоколь · <имя Базиса>»; «Ряд» — по rowPanelsOf (столешница — только настоящая столешница Базиса,
//    стеновая панель — изделие поставщика, стены и макеты техники — обстановка, не изделие);
//  — пометки: проект source 'bazis', сырые модули source 'bazis-kitchen' (смета без заглушек конфирмата и т. п.).
import { initialModule, id, validate, section, type Module } from "../../src/model";
import { newProject, projectErrors, type PlacedModule, type Project } from "../../src/project";
import { compareModule, honestPass, type RefModule } from "./compare";
import { normalizeRefHardware, confirmatName } from "./refHardware";
import { moduleFromEtalon } from "./fromEtalon";
import { rawCounts, bazisItems, bazisNames, type RawSpec } from "../../src/rawModule";
import { panelExtras, plinthName, rowPanelsOf, rowTitle, type EtPanel } from "./rowWorktop";
import { catalog } from "../../src/catalog";

export const SHOW = new Set(["опора", "клипса", "навес", "заглушка", "петля", "подъёмник", "газлифт", "направляющая", "ящик-система", "ручка", "сушка", "карго", "профиль"]);
const r1 = (v: number) => Math.round(v * 10) / 10;
/** Декор по умолчанию — только если в Базисе у детали нет материала. */
export const LOOK = { decor: "Белый", facadeDecor: "Слэйт" };

/** Декор Базиса → декор студии: «Lamarty Белый ГЛАДКИЙ» → «Белый» (гладкий = базовое тиснение), «Lamarty Черный» → «Черный»
 *  (как в каталоге Lamarty); чего нет в каталоге — название Базиса как есть («IDM ETERNO Libra», «Фасадный мат-л 1»). */
export function bazisDecor(decor: string | undefined): string | undefined {
  const d = (decor ?? "").trim();
  if (!d) return undefined;
  const base = d.replace(/^Lamarty\s+/i, "").replace(/\s+гладкий$/i, "").trim();
  const hit = catalog.find((c) => c.n.toLowerCase() === base.toLowerCase());
  return hit ? hit.n : base;
}
const most = (xs: (string | undefined)[]) => { const c = new Map<string, number>(); for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
type EtPanelRef = RefModule["panels"][number] & { decor?: string; mat?: string; role?: string };
/** Декор корпуса и фасадов модуля по Базису: самый частый у плит корпуса / у фасадов. */
export function moduleLook(ref: RefModule): { decor: string; facadeDecor: string } {
  const ps = ref.panels as EtPanelRef[], D = ref.size[2];
  const front = (p: EtPanelRef) => p.role === "facade" || /фасадн/i.test(p.mat ?? "") || (p.axis === "z" && p.kind !== "hdf" && p.box[2] >= D - 40);
  const body = most(ps.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && !front(p)).map((p) => bazisDecor(p.decor)));
  const face = most(ps.filter((p) => p.kind !== "hdf" && p.kind !== "glass" && front(p)).map((p) => bazisDecor(p.decor)));
  return { decor: body ?? LOOK.decor, facadeDecor: face ?? LOOK.facadeDecor };
}

export function rawFromRef(ref: RefModule, meshes?: Set<string>): RawSpec {
  // «Евровинт 6х50» из «прочего» эталона — конфирмат (счётчик), в смете — под своим именем (confirmatName; n3-wall)
  const D = ref.size[2], counts = rawCounts(normalizeRefHardware(ref.hardware)), names = bazisNames(ref.hardware), cn = confirmatName(ref.hardware);
  return {
    // цоколь внутри модуля (роль эталона plinth: пенал, тумба) — под своим именем «Цоколь · …», размеры Базиса
    panels: ref.panels.map((p) => { const dec = bazisDecor((p as EtPanelRef).decor); return { name: (p as EtPanelRef).role === "plinth" ? plinthName(p.name) : p.name, kind: p.kind, box: p.box.map(r1) as RawSpec["panels"][number]["box"], ...(p.axis === "z" && p.kind !== "hdf" && p.box[2] >= D - 40 ? { facade: true } : {}), ...(dec && p.kind !== "hdf" && p.kind !== "glass" ? { decor: dec } : {}), ...panelExtras(p as unknown as EtPanel) }; }),
    hardware: ref.hardware.filter((h) => SHOW.has(h.category)).map((h) => { if (h.mesh) meshes?.add(h.mesh); return { name: h.name, category: h.category, mesh: h.mesh ?? null, pos: h.pos.map(r1) as [number, number, number], quat: (h.quat ?? [1, 0, 0, 0]) as [number, number, number, number] }; }),
    counts,
    // Axis PRO — комплектом на ящик (counts.drawers); всё остальное — по названию Базиса
    items: bazisItems(normalizeRefHardware(ref.hardware), (h) => !!counts.drawers && /axis\s*pro/i.test(h.name)),
    ...(Object.keys(names).length ? { names } : {}),
    ...(cn ? { confirmatName: cn } : {}),
    source: "bazis-kitchen", // смета: только то, что есть в Базисе (без заглушек конфирмата и т.п.)
  };
}
/** Параметрический модуль из Базиса: признак, названия петель/полкодержателей и фурнитура, которую параметрика не строит. */
export function markBazis(m: Module, ref: RefModule): Module {
  const sys = new Set((m.kdrawers ?? []).map((k) => k.system ?? "axis-pro")), axis = sys.has("axis-pro"), firmax = sys.has("firmax-ldsp");
  // ящики, которые строит параметрика (n3-runners: Indigo, MODERN SLIDE, СТАРТ, Versalite), считаются комплектом/парой своей строкой сметы
  const runner = (n: string) => (sys.has("indigo") && /indigo/i.test(n)) || (sys.has("modern-slide") && /modern slide/i.test(n)) || (sys.has("start-sc") && /старт|start/i.test(n)) || (sys.has("versalite-h45") && /versalite/i.test(n));
  const items = bazisItems(normalizeRefHardware(ref.hardware), (h) => (!!axis && /axis\s*pro/i.test(h.name)) || (!!firmax && /firmax/i.test(h.name)) || runner(h.name) || (!!m.kitchenLift && /PD-G-N02/i.test(h.name)) || (!!m.gola && /gola/i.test(h.name))
    // заглушка навеса — строкой «Заглушка для мебельного навеса ABS» на каждый навес сцены (pricing.ts), не второй раз по Базису
    || (/заглушк/i.test(h.name) && /навес/i.test(h.name))
    // рафиксы жёстких полок строит параметрика (kitchen.rafix, n3-tall) — строкой по деталям сцены, не второй раз по Базису
    || (!!m.kitchen?.rafix && /рафикс/i.test(h.name)));
  const names = bazisNames(ref.hardware);
  return { ...m, bazis: true, ...(items.length ? { bazisItems: items } : {}), ...(Object.keys(names).length ? { bazisNames: names } : {}) };
}
export function place(ref: RefModule, m: Module): PlacedModule {
  const o0 = (ref as unknown as { world: { origin: number[] } }).world.origin, yaw = (ref as unknown as { world: { yaw: number } }).world.yaw;
  // параметрический модуль с накладным ХДФ: у студии боковины с z = 0 (ХДФ на −3), у Базиса начало — по ХДФ: сдвиг на 3 вдоль оси модуля
  const s = !m.raw && m.backType === "nailed" ? 3 : 0, a = ((yaw || 0) * Math.PI) / 180;
  const [ox, oy, oz] = [o0[0] + s * Math.sin(a), o0[1], o0[2] + s * Math.cos(a)];
  const w = m.width, d = m.depth;
  const [x, z] = yaw === 90 ? [ox, oz - w] : yaw === 180 ? [ox - w, oz - d] : yaw === 270 ? [ox - d, oz] : [ox, oz];
  return { id: id(), x: r1(x), y: r1(oy), z: r1(z), rotation: (yaw || 0) as PlacedModule["rotation"], module: m };
}

type Etalon = { modules: RefModule[]; row?: Record<string, unknown> };
/** Проект студии из эталона кухни. */
export function buildKitchen(e: Etalon, meshes?: Set<string>): { project: Project; parametric: number; raw: number; rowPanels: number; notes: string[] } {
  const placed: PlacedModule[] = [], notes: string[] = [];
  let parametric = 0, raw = 0;
  for (const ref of e.modules) {
    let m: Module | undefined;
    const look = moduleLook(ref);
    try {
      const r = moduleFromEtalon(ref, look);
      // параметрический — только при честном PASS: сверка + нет ошибок + нет «не поддержано» (n3-wall)
      if (honestPass(compareModule(ref, r.module), validate(r.module), r.unsupported)) { m = markBazis(r.module, ref); parametric++; }
    } catch { /* нераспознанный — сырой */ }
    if (!m) {
      m = { ...initialModule(), name: ref.name, width: r1(ref.size[0]), height: r1(ref.size[1]), depth: r1(ref.size[2]), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0, bazis: true, raw: rawFromRef(ref, meshes) };
      raw++;
    }
    placed.push(place(ref, m));
  }
  // ряд: столешница, цоколь, стеновые панели, профили и прочее вне модулей — один сырой объект в мировых координатах
  // (rowPanelsOf: фигурная столешница — прямоугольники по контуру Базиса; столешница — только настоящая столешница Базиса; цоколь —
  // «Цоколь · …»; стеновая панель — изделие поставщика (wall), не лист ЛДСП; фасад посудомойки (ПМ) в «прочем» — фасад; стены «Бетон»,
  // макеты «Пластик» и «Хром» — обстановка, не изделие)
  const row = (e.row ?? {}) as Record<string, EtPanel[]>;
  const rowPanels = rowPanelsOf(e.row);
  // профили ряда (Gola, крепления) без габарита — не детали, а фурнитура Базиса: в смету по названию и длине
  const rowHw = (["profiles", "other"] as const).flatMap((g) => (row[g] ?? []) as unknown as { name: string; category?: string; box?: number[]; length?: number; mat?: string | null }[]).filter((p) => !Array.isArray(p.box))
    .map((p) => ({ name: p.name, category: p.category ?? "профиль", mat: p.mat ?? null, ...(Number.isFinite(p.length) ? { length: p.length } : {}) }));
  const rowItems = bazisItems(rowHw);
  if (rowPanels.length || rowItems.length) {
    const ps = rowPanels.length ? rowPanels : [];
    const o = ps.length ? [0, 1, 2].map((i) => Math.min(...ps.map((p) => p.box[i]))) : [0, 0, 0], M = ps.length ? [3, 4, 5].map((i) => Math.max(...ps.map((p) => p.box[i]))) : [10, 10, 10];
    const look = { decor: most(ps.filter((p) => p.kind === "ldsp").map((p) => bazisDecor((p as unknown as EtPanelRef).decor))) ?? LOOK.decor, facadeDecor: LOOK.facadeDecor };
    const m: Module = { ...initialModule(), name: rowTitle(ps), width: r1(M[0] - o[0]), height: r1(M[1] - o[1]), depth: r1(M[2] - o[2]), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0, bazis: true,
      raw: { panels: ps.map((p) => { const dec = bazisDecor((p as unknown as EtPanelRef).decor); return { name: p.name, kind: p.kind ?? "ldsp", box: p.box.map((v, i) => r1(v - o[i % 3])) as RawSpec["panels"][number]["box"], ...(dec && p.kind !== "hdf" && p.kind !== "glass" ? { decor: dec } : {}), ...panelExtras(p), ...(p.front ? { facade: true } : {}), ...(p.wall ? { wall: true } : {}) }; }),
        hardware: [], counts: rawCounts(normalizeRefHardware(rowHw)), items: rowItems, ...(Object.keys(bazisNames(rowHw)).length ? { names: bazisNames(rowHw) } : {}), row: true, source: "bazis-kitchen" } };
    placed.push({ id: id(), x: r1(o[0]), y: r1(o[1]), z: r1(o[2]), rotation: 0, module: m });
  }
  // помещение по габариту кухни
  const ext = placed.map((a) => { const rot = a.rotation === 90 || a.rotation === 270; return { x1: a.x + (rot ? a.module.depth : a.module.width), z1: a.z + (rot ? a.module.width : a.module.depth), y1: (a.y ?? 0) + a.module.height }; });
  const dy = -Math.min(0, Math.min(...placed.map((a) => a.y ?? 0)));
  const minX = Math.min(...placed.map((a) => a.x)), minZ = Math.min(...placed.map((a) => a.z));
  const minY = Math.min(...placed.map((a) => a.y ?? 0));
  for (const a of placed) { a.x = r1(a.x - Math.min(0, minX) + (minX < 0 ? 5 : 0)); a.z = r1(a.z - Math.min(0, minZ) + (minZ < 0 ? 5 : 0)); a.y = r1((a.y ?? 0) - Math.min(0, minY)); }
  if (minY < 0) notes.push(`низ кухни в Базисе на ${r1(minY)} — поднято до пола`);
  const p = newProject({ ...initialModule(), sections: [section()] });
  p.source = "bazis"; // кухня из Базиса: студия не добавляет фальши и строки сметы сверх Базиса
  p.room = { ...p.room, width: Math.ceil(Math.max(...ext.map((x) => x.x1)) - Math.min(0, minX) + 400), depth: Math.ceil(Math.max(...ext.map((x) => x.z1)) - Math.min(0, minZ) + 400), height: Math.max(2700, Math.ceil(Math.max(...ext.map((x) => x.y1)) + dy + 60)), openings: [] };
  p.modules = placed;
  const errs = projectErrors(p);
  if (errs.length) notes.push("ошибки проекта: " + errs.slice(0, 2).join(" | "));
  return { project: p, parametric, raw, rowPanels: rowPanels.length, notes };
}
