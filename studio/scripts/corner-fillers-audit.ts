// Аудит стыка угловых фальш-панелей (волна 29.10, правка 1): сценарии сборки функциями студии (как мышью: палитра, «Поставить к стене»,
// «За угол», угловая кухня Г/П, угловой шкаф), затем в координатах комнаты — фальш-детали всех модулей, их пересечения с деталями
// соседей и вид сверху (SVG) каждого угла.
// npx tsx scripts/corner-fillers-audit.ts [папка вывода]   — печатает отчёт; в папку пишет SVG планов (если задана)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts, initialModule, type Part, type Module } from "../src/model";
import { newProject, applyAutoFillers, localToRoom, type Project, type PlacedModule } from "../src/project";
import { createModule } from "../src/paletteBuild";
import { placeToWall, cornerTurns, continueAroundCorner } from "../src/wallPlacement";
import { placeKitchenCorner } from "../src/kitchenCornerRow";
import { estimate } from "../src/pricing";

export const FILLER = /^(corner-filler|wall-filler|face-filler|side-panel)/;
export type RoomBox = { rot?: boolean; mid: string; mname: string; id: string; name: string; role: Part["role"]; x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };

/** Детали модуля в координатах комнаты (габарит по осям; детали с поворотом rotY — по габариту повёрнутого короба). */
export function roomBoxes(a: PlacedModule): RoomBox[] {
  const out: RoomBox[] = [];
  for (const p of parts(a.module)) {
    if (p.role === "fastener" || p.material === "metal" && p.role !== "door") continue;
    const [sx, sy, sz] = p.size, [px, py, pz] = p.position;
    const ry = ((p.rotY ?? 0) * Math.PI) / 180, hx = Math.abs(Math.cos(ry)) * sx / 2 + Math.abs(Math.sin(ry)) * sz / 2, hz = Math.abs(Math.sin(ry)) * sx / 2 + Math.abs(Math.cos(ry)) * sz / 2;
    const c = [localToRoom(a, px - hx, pz - hz), localToRoom(a, px + hx, pz + hz)];
    out.push({ rot: !!p.rotY, mid: a.id, mname: a.module.name, id: p.id, name: p.name, role: p.role, x0: Math.min(c[0].x, c[1].x), x1: Math.max(c[0].x, c[1].x), z0: Math.min(c[0].z, c[1].z), z1: Math.max(c[0].z, c[1].z), y0: (a.y ?? 0) + py - sy / 2, y1: (a.y ?? 0) + py + sy / 2 });
  }
  return out;
}
const pen = (a: RoomBox, b: RoomBox) => Math.min(a.x1 - b.x0, b.x1 - a.x0, a.z1 - b.z0, b.z1 - a.z0, a.y1 - b.y0, b.y1 - a.y0);

export type CornerReport = { fillers: RoomBox[]; overlaps: { a: string; b: string; depth: number }[]; doorsBlocked: { door: string; by: string; depth: number }[] };
/** Пересечения фальшей с деталями соседних модулей и фасадов с телами соседей (фасад упирается в соседа). */
export function cornerReport(p: Project): CornerReport {
  const all = p.modules.flatMap(roomBoxes), fillers = all.filter((b) => FILLER.test(b.id) || b.id.includes(":filler:"));
  const overlaps: CornerReport["overlaps"] = [], doorsBlocked: CornerReport["doorsBlocked"] = [];
  const tag = (b: RoomBox) => `${b.mname}/${b.id}`;
  for (const f of fillers) for (const o of all) {
    if (o.mid === f.mid && !(FILLER.test(o.id) && o.id !== f.id)) continue;
    if (o === f || (FILLER.test(o.id) && tag(o) < tag(f))) continue;
    const d = pen(f, o);
    if (d > 0.1) overlaps.push({ a: tag(f), b: tag(o), depth: Math.round(d * 10) / 10 });
  }
  // створка не открывается: перед её лицом (50 мм по нормали фасада) — деталь другого модуля
  const normal = (mid: string) => { const r = (((p.modules.find((a) => a.id === mid)!.rotation ?? 0) % 360) + 360) % 360; return r === 0 ? [0, 1] : r === 90 ? [1, 0] : r === 180 ? [0, -1] : [-1, 0]; };
  for (const d of all.filter((b) => b.role === "door")) {
    const [nx, nz] = normal(d.mid), zone = { ...d, x0: nx > 0 ? d.x1 : nx < 0 ? d.x0 - 50 : d.x0 + 1, x1: nx > 0 ? d.x1 + 50 : nx < 0 ? d.x0 : d.x1 - 1, z0: nz > 0 ? d.z1 : nz < 0 ? d.z0 - 50 : d.z0 + 1, z1: nz > 0 ? d.z1 + 50 : nz < 0 ? d.z0 : d.z1 - 1 };
    for (const o of all) {
      if (o.mid === d.mid || o.role === "handle" || o.rot || d.rot) continue; // диагональные детали (угловой шкаф) — габарит не годится
      const v = pen(zone, o);
      if (v > 0.1) { doorsBlocked.push({ door: tag(d), by: tag(o), depth: Math.round(v * 10) / 10 }); break; }
    }
  }
  return { fillers, overlaps, doorsBlocked };
}

/** Вид сверху углового участка: корпуса — серым, фасады — синим, фальши — красным. */
export function planSVG(p: Project, region: { x0: number; z0: number; x1: number; z1: number }, title: string, y?: number): string {
  const S = 800 / Math.max(region.x1 - region.x0, region.z1 - region.z0), W = (region.x1 - region.x0) * S, H = (region.z1 - region.z0) * S;
  const rects = p.modules.flatMap(roomBoxes).filter((b) => (y === undefined || (b.y0 <= y && b.y1 >= y)) && b.x1 > region.x0 && b.x0 < region.x1 && b.z1 > region.z0 && b.z0 < region.z1 && b.role !== "handle" && b.role !== "hinge")
    .sort((a, b) => (FILLER.test(a.id) ? 1 : 0) - (FILLER.test(b.id) ? 1 : 0));
  const col = (b: RoomBox) => FILLER.test(b.id) || b.id.includes(":filler:") ? "#d62728" : b.role === "door" || b.id.endsWith(":facade") ? "#1f77b4" : b.role === "drawer" ? "#2ca02c" : "#888";
  const body = rects.map((b) => `<rect x="${((b.x0 - region.x0) * S).toFixed(1)}" y="${((b.z0 - region.z0) * S).toFixed(1)}" width="${Math.max(0.6, (b.x1 - b.x0) * S).toFixed(1)}" height="${Math.max(0.6, (b.z1 - b.z0) * S).toFixed(1)}" fill="${col(b)}" fill-opacity="${FILLER.test(b.id) ? 0.75 : 0.35}" stroke="${col(b)}" stroke-width="0.6"><title>${b.mname} · ${b.name} (${b.id})</title></rect>`).join("");
  const grid: string[] = [];
  for (let v = Math.ceil(region.x0 / 100) * 100; v <= region.x1; v += 100) grid.push(`<line x1="${(v - region.x0) * S}" y1="0" x2="${(v - region.x0) * S}" y2="${H}" stroke="#eee"/>`);
  for (let v = Math.ceil(region.z0 / 100) * 100; v <= region.z1; v += 100) grid.push(`<line x1="0" y1="${(v - region.z0) * S}" x2="${W}" y2="${(v - region.z0) * S}" stroke="#eee"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 20}" height="${H + 50}" viewBox="-10 -40 ${W + 20} ${H + 50}" font-family="sans-serif"><rect x="-10" y="-40" width="${W + 20}" height="${H + 50}" fill="#fff"/><text x="0" y="-22" font-size="15">${title}</text><text x="0" y="-6" font-size="11" fill="#666">сетка 100 мм · серый — корпус, синий — фасады, красный — фальши · стены: верх (задняя), лево/право</text>${grid.join("")}<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#000" stroke-width="2"/>${body}</svg>`;
}

const wardrobe = (w = 1000) => createModule("wardrobe", w, 2200, 600, initialModule());
const turnTo = (p: Project, mid: string, wall: "left" | "right" | "back") => cornerTurns(p, mid).find((t) => t.wall === wall);

/** Сценарии угла — функциями, как менеджер мышью. */
export function scenarios(): { name: string; project: Project; region: { x0: number; z0: number; x1: number; z1: number }; y?: number }[] {
  const out: ReturnType<typeof scenarios> = [];
  // 1) Шкаф у задней стены от угла, второй — «За угол» на левую стену
  {
    let p = newProject(wardrobe()); p.room = { ...p.room, width: 4000, depth: 3000 };
    p = placeToWall(p, p.modules[0].id, "back", "from-start");
    const t = turnTo(p, p.modules[0].id, "left")!;
    p = continueAroundCorner(p, t, { module: wardrobe() }).project;
    out.push({ name: "1-шкаф-задняя-за-угол-левая", project: applyAutoFillers(p), region: { x0: 0, z0: 0, x1: 1100, z1: 1100 } });
  }
  // 2) Наоборот: шкаф у левой стены от угла, второй — «За угол» на заднюю
  {
    let p = newProject(wardrobe()); p.room = { ...p.room, width: 4000, depth: 3000 };
    p = placeToWall(p, p.modules[0].id, "left", "from-start");
    const t = turnTo(p, p.modules[0].id, "back")!;
    p = continueAroundCorner(p, t, { module: wardrobe() }).project;
    out.push({ name: "2-шкаф-левая-за-угол-задняя", project: applyAutoFillers(p), region: { x0: 0, z0: 0, x1: 1100, z1: 1100 } });
  }
  // 3) Шкафы вдоль двух стен: два у задней, «За угол» на правую
  {
    let p = newProject(wardrobe()); p.room = { ...p.room, width: 3000, depth: 3000 };
    p = placeToWall(p, p.modules[0].id, "back", "from-end");
    p = { ...p, modules: [...p.modules, { id: "w2", x: 0, y: 0, z: 0, rotation: 0, module: wardrobe(800) }] };
    p = placeToWall(p, "w2", "back", "from-end");
    const last = p.modules.reduce((a, b) => (a.x > b.x ? a : b));
    const t = turnTo(p, last.id, "right")!;
    p = continueAroundCorner(p, t, { module: wardrobe(800) }).project;
    out.push({ name: "3-шкафы-вдоль-двух-стен-правый-угол", project: applyAutoFillers(p), region: { x0: 1900, z0: 0, x1: 3000, z1: 1100 } });
  }
  // 4) Угловой шкаф (палитра «Угловой шкаф») в углу + прямой шкаф «За угол» на левую стену
  {
    let p = newProject(createModule("corner", 1050, 2000, 450, initialModule())); p.room = { ...p.room, width: 4000, depth: 3000 };
    p = placeToWall(p, p.modules[0].id, "back", "from-start");
    const t = turnTo(p, p.modules[0].id, "left");
    if (t) p = continueAroundCorner(p, t, { module: wardrobe() }).project;
    const t2 = turnTo(p, p.modules[0].id, "back");
    void t2;
    out.push({ name: "4-угловой-шкаф", project: applyAutoFillers(p), region: { x0: 0, z0: 0, x1: 1300, z1: 1300 } });
  }
  // 8) Крыло упирается и в переднюю стену: у одного корпуса угловая планка и фальш к стене с другой стороны
  {
    let p = newProject(wardrobe()); p.room = { ...p.room, width: 4000, depth: 1660 };
    p = placeToWall(p, p.modules[0].id, "back", "from-start");
    const t = turnTo(p, p.modules[0].id, "left")!;
    p = continueAroundCorner(p, t, { module: wardrobe() }).project;
    out.push({ name: "8-крыло-до-передней-стены", project: applyAutoFillers(p), region: { x0: 0, z0: 0, x1: 1700, z1: 1700 } });
  }
  // 5) Угловая кухня Г (левое крыло) и П
  {
    const p0 = newProject(wardrobe()); p0.room = { width: 3000, depth: 2600, height: 2700, openings: [] }; p0.modules = [];
    const g = placeKitchenCorner(p0, initialModule(), { back: 2400, side: 1800, wing: "left" }).project;
    out.push({ name: "5-кухня-Г-нижние", project: applyAutoFillers(g), region: { x0: 0, z0: 0, x1: 1200, z1: 1200 }, y: 400 });
    out.push({ name: "6-кухня-Г-навесные", project: applyAutoFillers(g), region: { x0: 0, z0: 0, x1: 1200, z1: 1200 }, y: 1800 });
    const u = placeKitchenCorner(p0, initialModule(), { left: 1800, back: 3000, right: 1800, u: true }).project;
    out.push({ name: "7-кухня-П-правый-угол", project: applyAutoFillers(u), region: { x0: 1800, z0: 0, x1: 3000, z1: 1200 }, y: 400 });
  }
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("corner-fillers-audit.ts")) {
  const dir = process.argv[2];
  if (dir) mkdirSync(dir, { recursive: true });
  for (const s of scenarios()) {
    const r = cornerReport(s.project);
    console.log(`\n=== ${s.name} ===`);
    for (const a of s.project.modules) console.log(`  ${a.module.name}: x=${Math.round(a.x)} z=${Math.round(a.z)} rot=${a.rotation ?? 0} w=${a.module.width} corner=${a.module.cornerFiller ?? "-"}/${a.module.cornerKind ?? "-"} wall=${JSON.stringify(a.module.wallFiller ?? {})}`);
    for (const f of r.fillers) console.log(`  фальш ${f.mname}/${f.id}: x ${f.x0.toFixed(0)}–${f.x1.toFixed(0)}, z ${f.z0.toFixed(0)}–${f.z1.toFixed(0)}, y ${f.y0.toFixed(0)}–${f.y1.toFixed(0)}`);
    for (const o of r.overlaps) console.log(`  ПЕРЕСЕЧЕНИЕ ${o.a} × ${o.b}: ${o.depth} мм`);
    for (const o of r.doorsBlocked.slice(0, 6)) console.log(`  ФАСАД В СОСЕДЕ ${o.door} × ${o.by}: ${o.depth} мм`);
    if (r.doorsBlocked.length > 6) console.log(`  … ещё ${r.doorsBlocked.length - 6}`);
    const e = estimate(s.project);
    console.log(`  смета: ${Math.round(e.retail ?? 0)} ₽; фальш-деталей: ${r.fillers.length} (${r.fillers.map((f) => `${Math.round(Math.max(f.x1 - f.x0, f.z1 - f.z0))}`).join(", ")})`);
    if (dir) writeFileSync(join(dir, s.name + ".svg"), planSVG(s.project, s.region, s.name, s.y));
  }
}
