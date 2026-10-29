// Перенос / копия вырезов на схожие детали (правка Макса 29.10.2026: «добавить возможность переноса вырезов на схожие детали»).
// Схожая деталь — того же вида (полка, боковина, перегородка, дверь, деталь ящика…; левая и правая боковина — один вид) и того же размера
// по всем трём осям (±0,5 мм), в этом корпусе или в других корпусах проекта. Вырез копируется как есть: те же размеры, привязка и
// отступы от тех же краёв детали (под плинтус — у низа спереди, под трубу — так же от заднего края). На каждой детали копия
// проверяется (validate модуля): не встаёт — деталь пропускается с причиной. Всё — одно изменение проекта (одна отмена Ctrl+Z).
// Деталь выреза — по постоянной ссылке (partIds.ts): у полки/ящика — id детали, у остальных — id по роли.
import { shapeBaseParts, validate, type Module, type Part } from "./model";
import { basePolygon, buildCutShape, cutoutWarnings, faceAxes, type Cutout } from "./shapes";
import type { Project } from "./project";
import { bindCutouts, cutHost } from "./partIds";

/** Детали модуля, в которых можно сделать вырез (как окно «Вырезы»: доски корпуса, ЛХДФ, фасады ЛДСП). */
export function cutParts(m: Module): Part[] {
  if (m.raw || m.kupe || m.worktop || m.corner || m.casework) return [];
  try { return shapeBaseParts(m).filter((p) => (p.material === "board" || p.material === "hdf") && !p.external && basePolygon(p) !== null); } catch { return []; }
}
/** Вид детали: id без секции и номеров, левая/правая — одно («side»). `s1:shelf:2` → `shelf`, `left` → `side`, `s1:drawer:0:left` → `drawer:side`. */
export function partKind(p: Pick<Part, "id" | "sectionId" | "role">): string {
  let id = p.id;
  if (p.sectionId && id.startsWith(p.sectionId + ":")) id = id.slice(p.sectionId.length + 1);
  return p.role + "/" + id.replace(/:\d+(?=:|$)/g, "").replace(/\b(left|right)\b/g, "side").replace(/^\d+:?/, "");
}
const sameSize = (a: Part, b: Part) => [0, 1, 2].every((i) => Math.abs(a.size[i] - b.size[i]) <= 0.5);
const plainName = (p: Part) => p.name.replace(/ · фигурная \(вырез\)$/, "");
/** Подпись детали в списке переноса: номер полки / створки и секция — одинаковые «Полка съёмная» различимы. */
function targetName(m: Module, p: Part): string {
  const sec = p.sectionId ? m.sections.findIndex((s) => s.id === p.sectionId) : -1, where = sec >= 0 && m.sections.length > 1 ? `, секция ${sec + 1}` : "";
  const shelf = /:shelf:(\d+)$/.exec(p.id), door = /:door:(\d+)$/.exec(p.id);
  if (shelf) return `Полка ${Number(shelf[1]) + 1} (${plainName(p).toLowerCase()}${where})`;
  if (door) return `Створка ${Number(door[1]) + 1}${where}`;
  return plainName(p) + where;
}

export type CopyTarget = { mid: string; pid: string; name: string; moduleName: string; same: boolean };
/** Схожие детали для детали pid корпуса mid: тот же вид и размер, кроме неё самой. same — в том же корпусе. */
export function similarCutParts(p: Project, mid: string, pid: string): CopyTarget[] {
  const a = p.modules.find((x) => x.id === mid);
  const src = a && cutParts(a.module).find((q) => q.id === pid);
  if (!a || !src) return [];
  const kind = partKind(src), out: CopyTarget[] = [];
  for (const b of [a, ...p.modules.filter((x) => x.id !== mid)])
    for (const q of cutParts(b.module)) if (!(b.id === mid && q.id === pid) && partKind(q) === kind && sameSize(q, src)) out.push({ mid: b.id, pid: q.id, name: targetName(b.module, q), moduleName: b.module.name, same: b.id === mid });
  return out;
}

const sameCut = (x: Cutout, y: Cutout) => x.shape === y.shape && x.w === y.w && x.h === y.h && x.u === y.u && x.v === y.v && x.fromU === y.fromU && x.fromV === y.fromV;
const newId = () => crypto.randomUUID();

export type CopyResult = { project: Project; copied: number; skipped: { name: string; reason: string }[]; warnings: string[]; note: string };
const both = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
/** Отступ по ширине — от края у петель (критик 29.10, ждёт подтверждения Макса): створка с петлями слева → створка с петлями справа —
 *  вырез зеркально, отступ от того же края относительно петель; у остальных деталей — от того же края детали. */
export function mirrorForHinge(src: Pick<Part, "role" | "hinge" | "size" | "thickness" | "shape">, dst: Pick<Part, "role" | "hinge">): boolean {
  const lr = (h?: string) => h === "left" || h === "right";
  return src.role === "door" && dst.role === "door" && lr(src.hinge) && lr(dst.hinge) && src.hinge !== dst.hinge && faceAxes(src).u === 0;
}
/** Вырезы cuts детали pid корпуса mid — на детали targets (копия); move — с исходной детали снять. Одна правка проекта.
 *  Деталь, где такой вырез уже есть, пропускается; копия не встаёт — пропуск с причиной: контур детали с вырезами (buildCutShape) и
 *  новые ошибки модели (validate целиком — чужая ошибка корпуса не прячет ошибку выреза). Предупреждения выреза (петля, ручка,
 *  полкодержатель в зоне выреза) на деталях-получателях — в warnings и в сообщении. */
export function copyCutouts(p: Project, mid: string, pid: string, cuts: readonly Cutout[], targets: readonly { mid: string; pid: string }[], move = false): CopyResult {
  const n = structuredClone(p), skipped: CopyResult["skipped"] = [], warnings: string[] = [];
  let copied = 0;
  const label = (t: { mid: string; pid: string }) => { const a = n.modules.find((x) => x.id === t.mid), q = a && cutParts(a.module).find((x) => x.id === t.pid); return (q ? targetName(a!.module, q) : t.pid) + (a && t.mid !== mid ? ` («${a.module.name}»)` : ""); };
  if (!cuts.length) throw Error("На этой детали нет вырезов — сначала задайте вырез.");
  const srcMod = p.modules.find((x) => x.id === mid)?.module, src = srcMod && cutParts(srcMod).find((q) => q.id === pid);
  for (const t of targets) {
    const a = n.modules.find((x) => x.id === t.mid);
    if (!a) continue;
    const m = a.module, base = cutParts(m).find((q) => q.id === t.pid);
    if (!base) { skipped.push({ name: label(t), reason: "деталь не найдена или вырез в ней не делается" }); continue; }
    const flip = !!src && mirrorForHinge(src, base);
    const placed = cuts.map((c) => { const { ref: _r, ...rest } = c; void _r; return { ...structuredClone(rest), id: newId(), host: t.pid, ...(flip ? { fromU: c.fromU === "min" ? "max" as const : "min" as const } : {}) }; });
    const have = (m.cutouts ?? []).filter((c) => cutHost(m, c) === t.pid);
    const add = placed.filter((c) => !have.some((h) => sameCut(h, c)));
    if (!add.length) { skipped.push({ name: label(t), reason: "такой вырез уже есть" }); continue; }
    const trial = structuredClone(m);
    trial.cutouts = [...(trial.cutouts ?? []), ...add];
    bindCutouts(trial);
    const shapeErr = buildCutShape(base, [...have, ...add]).errors[0];
    const before = new Set(both(() => validate(m, { all: true }), [] as string[])), err = shapeErr ?? both(() => validate(trial, { all: true }), ["модель не собирается"]).find((e) => !before.has(e));
    if (err) { skipped.push({ name: label(t), reason: err.replace(/\.$/, "") }); continue; }
    // новые предупреждения этой детали: только её вырезы — до и после (тексты у одинаковых деталей совпадают)
    const own = (x: Module) => { const k = structuredClone(x); k.cutouts = (x.cutouts ?? []).filter((c) => cutHost(x, c) === t.pid); if (!k.cutouts.length) delete k.cutouts; return new Set(both(() => cutoutWarnings(k, shapeBaseParts(k)), [] as string[])); };
    const was = own(m);
    for (const w of own(trial)) if (!was.has(w)) warnings.push(`${label(t)}: ${w.replace(/^«[^»]*»: /, "")}`);
    a.module = trial;
    copied++;
  }  if (!copied) throw Error("Вырез не перенесён ни на одну деталь. " + skipped.map((s) => `${s.name}: ${s.reason}`).join("; ") + ".");
  if (move) {
    const a = n.modules.find((x) => x.id === mid)!, m = a.module, ids = new Set(cuts.map((c) => c.id));
    const rest = (m.cutouts ?? []).filter((c) => !(ids.has(c.id) && cutHost(m, c) === pid));
    if (rest.length) m.cutouts = rest; else delete m.cutouts;
  }
  const word = copied % 10 === 1 && copied % 100 !== 11 ? "деталь" : copied % 10 >= 2 && copied % 10 <= 4 && (copied % 100 < 12 || copied % 100 > 14) ? "детали" : "деталей";
  const note = `${move ? "Вырезы перенесены" : "Вырезы скопированы"} на ${copied} ${word}.` + (skipped.length ? " Пропущено: " + skipped.map((s) => `${s.name} — ${s.reason}`).join("; ") + "." : "");
  return { project: n, copied, skipped, warnings, note: note + (warnings.length ? " Проверьте: " + warnings.join(" ") : "") };
}
