// Частичная перегородка (решение Макса 23.10.2026): перегородка между секциями не во всю высоту — «от … до …» (мм от пола) или
// «от полки N до полки M». Модель — Section.divider у секции справа от перегородки (model.ts: dividerSpan, throughShelf, dividerErrors).
// Здесь — команды панели и меню правой кнопки: задать/снять, по полкам, перевесить фасады с частичной перегородки на боковины.
import { boxes, doorCount, doorMaxWidth, parts, dividerSpan, RULES, type Module, type Section } from "./model";
import { setDoorHinge } from "./facadeEditing";

export type DividerBound = "floor" | "roof" | { section: number; shelf: number };

/** Перегородка слева от секции i: во всю высоту или от/до (мм от пола). */
export function dividerInfo(m: Module, i: number): { partial: boolean; from: number; to: number; bottom: number; top: number } | undefined {
  if (i < 1 || i >= m.sections.length) return undefined;
  const b = boxes(m)[i], sp = dividerSpan(m, i);
  return { partial: !!sp, from: sp?.from ?? b.bottom, to: sp?.to ?? b.top, bottom: b.bottom, top: b.top };
}

/** Убрать полку j секции: номера жёстких, стеклянных и подсвеченных полок сдвигаются, как при удалении полки. */
function dropShelf(s: Section, j: number) {
  s.shelves.splice(j, 1);
  for (const key of ["fixed", "glassShelves", "shelfLights"] as const) {
    const v = s[key];
    if (!v) continue;
    const next = v.filter((x) => x !== j).map((x) => (x > j ? x - 1 : x));
    if (next.length) s[key] = next; else delete s[key];
  }
  if (s.lightSpec) {
    const next: NonNullable<Section["lightSpec"]> = {};
    for (const [k, v] of Object.entries(s.lightSpec)) { const r = /^shelf:(\d+)$/.exec(k); if (!r) next[k] = v; else if (Number(r[1]) !== j) next[`shelf:${Number(r[1]) > j ? Number(r[1]) - 1 : Number(r[1])}`] = v; }
    if (Object.keys(next).length) s.lightSpec = next; else delete s.lightSpec;
  }
}

/** Задать частичную перегородку слева от секции sid: from/to — нижний и верхний торцы перегородки, мм от пола; null — во всю высоту.
 *  Ниже дна / выше крыши — «от дна» / «до крыши». Одностворчатые фасады соседних секций, висящие на этой перегородке, перевешиваются
 *  на боковину: на частичной перегородке петлям нет места по всей высоте фасада. */
export function setPartialDivider(m: Module, sid: string, span: { from: number; to: number } | null): string[] {
  const i = m.sections.findIndex((s) => s.id === sid);
  if (i < 1) throw Error("Частичную перегородку задают у секции справа от неё: у первой секции перегородки слева нет.");
  const s = m.sections[i];
  if (!span) { delete s.divider; return []; }
  if (!Number.isFinite(span.from) || !Number.isFinite(span.to) || span.to <= span.from) throw Error("Укажите высоту перегородки: «от» меньше «до».");
  const b = boxes(m)[i], r = (v: number) => Math.round(v * 10) / 10;
  const from = span.from <= b.bottom + 0.5 ? b.bottom : r(span.from), to = span.to >= b.top - 0.5 ? b.top : r(span.to);
  if (from <= b.bottom + 0.5 && to >= b.top - 0.5) { delete s.divider; return []; }
  s.divider = { from, to };
  if (!m.doors) return [];
  const notes: string[] = [];
  for (const [k, side] of [[i - 1, "right"], [i, "left"]] as const) {
    const sec = m.sections[k];
    if (sec.doorSplit !== undefined) continue;
    // критик релиза 24.10: две створки у частичной перегородки — одна из них висела бы на ней; если одна створка проходит
    // по ширине, секция сама переходит на одну створку на боковине (с сообщением), иначе — отказ проверки с выполнимым советом
    if (doorCount(m, sec) === 2) { if (oneLeafFits(m, k) && oneLeafAtDivider(m, sec.id)) notes.push(`Секция ${k + 1}: одна створка, петли ${side === "left" ? "справа" : "слева"} на боковине — две створки у частичной перегородки не ставятся.`); continue; }
    if (doorCount(m, sec) !== 1) continue;
    const door = parts(m).find((p) => p.id === `${sec.id}:door:0`);
    if (door?.hinge === side) setDoorHinge(m, door.id, side === "left" ? "right" : "left");
  }
  return notes;
}

/** Одна створка секции k не шире предела распашного фасада (иначе одна створка — ошибка «Фасад шире …»). */
export function oneLeafFits(m: Module, k: number): boolean {
  const b = boxes(m)[k];
  return !!b && b.width + RULES.panel <= doorMaxWidth(m);
}

/** «Одна створка в секции» у частичной перегородки: одна створка, петли на стороне без частичной перегородки (на боковине
 *  или на перегородке во всю высоту). Возвращает true, если секция у частичной перегородки и створку поставили. */
export function oneLeafAtDivider(m: Module, sid: string): boolean {
  const k = m.sections.findIndex((s) => s.id === sid), sec = m.sections[k];
  if (!sec || !m.doors) return false;
  const bb = boxes(m), left = !!dividerSpan(m, k, bb), right = !!dividerSpan(m, k + 1, bb);
  if (!left && !right) return false;
  sec.doorLeaves = 1;
  delete sec.removedDoors;
  if (sec.doorHinges) { sec.doorHinges = sec.doorHinges.map((h, j) => (j % 2 === 0 && (h === "left" || h === "right") ? null : h)); if (!sec.doorHinges.some((h) => h !== null)) delete sec.doorHinges; }
  if (left && right) return true; // перегородки с обеих сторон — петли проверит validate
  const door = parts(m).find((p) => p.id === `${sec.id}:door:0`), away = left ? "right" : "left";
  if (door && door.hinge !== away) setDoorHinge(m, door.id, away);
  return true;
}

/** Сообщение о том, что студия сама поменяла створки у частичной перегородки (после применённого изменения). */
export function announceDividerNotes(notes: string[]): void {
  if (notes.length && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio-note", { detail: { title: "Створки у частичной перегородки", text: notes.join(" ") } }));
}

/** Перетаскивание конца частичной перегородки (горизонтали-опоры под/над ней) по высоте на delta мм; ошибки — как у полей «от/до». */
export function moveDividerEnd(m: Module, sid: string, edge: "under" | "over", delta: number): string[] {
  const s = m.sections.find((x) => x.id === sid);
  if (!s?.divider) throw Error("Перегородка во всю высоту: сначала сделайте её частичной.");
  const { from, to } = s.divider;
  return setPartialDivider(m, sid, edge === "under" ? { from: from + delta, to } : { from, to: to + delta });
}

/** «От полки N до полки M»: границы — горизонтали, на которые опирается перегородка (дно, крыша или полка секции слева/справа).
 *  Выбранные полки становятся опорами перегородки (сквозными горизонталями): из секций они убираются, чтобы не было двух деталей. */
export function setDividerByShelves(m: Module, sid: string, lower: DividerBound, upper: DividerBound): string[] {
  const i = m.sections.findIndex((s) => s.id === sid);
  if (i < 1) throw Error("Частичную перегородку задают у секции справа от неё: у первой секции перегородки слева нет.");
  const bb = boxes(m), t = RULES.panel;
  const yOf = (q: DividerBound) => {
    if (q === "floor") return bb[i].bottom;
    if (q === "roof") return bb[i].top;
    const sec = m.sections[q.section], b = bb[q.section], f = sec?.shelves[q.shelf];
    if (!sec || f === undefined || (q.section !== i && q.section !== i - 1)) throw Error("Выберите полку одной из двух секций у перегородки.");
    return b.bottom + f * (b.top - b.bottom);
  };
  const y0 = yOf(lower), y1 = yOf(upper);
  if (y1 <= y0) throw Error("Нижняя граница перегородки должна быть ниже верхней.");
  const from = lower === "floor" ? y0 : y0 + t / 2, to = upper === "roof" ? y1 : y1 - t / 2;
  // выбранные полки (и такие же на той же высоте в соседней секции пары) — теперь опоры перегородки
  for (const y of [lower === "floor" ? undefined : y0, upper === "roof" ? undefined : y1]) {
    if (y === undefined) continue;
    for (const k of [i - 1, i]) {
      const sec = m.sections[k], b = bb[k], h = b.top - b.bottom;
      const j = sec.shelves.findIndex((f) => Math.abs(b.bottom + f * h - y) < 1);
      if (j >= 0) dropShelf(sec, j);
    }
  }
  return setPartialDivider(m, sid, { from, to });
}

/** Подписи границ для выбора «от полки / до полки»: дно, полки обеих секций по высоте, крыша. */
export function dividerBounds(m: Module, i: number): { key: string; label: string; y: number; bound: DividerBound }[] {
  if (i < 1 || i >= m.sections.length) return [];
  const bb = boxes(m), out: { key: string; label: string; y: number; bound: DividerBound }[] = [{ key: "floor", label: `Дно · ${Math.round(bb[i].bottom)} мм`, y: bb[i].bottom, bound: "floor" }];
  const seen: number[] = [];
  for (const k of [i - 1, i]) {
    const b = bb[k], h = b.top - b.bottom;
    m.sections[k].shelves.forEach((f, j) => {
      const y = b.bottom + f * h;
      if (seen.some((v) => Math.abs(v - y) < 1)) return;
      seen.push(y);
      out.push({ key: `${k}:${j}`, label: `Полка ${j + 1} секции ${k + 1} · ${Math.round(y)} мм`, y, bound: { section: k, shelf: j } });
    });
  }
  out.push({ key: "roof", label: `Крыша · ${Math.round(bb[i].top)} мм`, y: bb[i].top, bound: "roof" });
  return out.sort((a, z) => a.y - z.y);
}
