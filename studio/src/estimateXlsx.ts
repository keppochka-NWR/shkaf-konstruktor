// «Красивая смета в Excel» (менеджеры 22.10.2026, п. 8): настоящий .xlsx вместо CSV — три листа:
// «Смета» — позиции по группам (материалы / работа цеха / фурнитура / двери купе / после финального расчёта) с подытогами формулами SUM;
// «Детали» — деталировка (как «Деталировка CSV», только с номером заказа — правило T3 18.10.2026);
// «Кратко для клиента» — изделия, цена по изделиям и итог, БЕЗ закупочных цен и коэффициентов.
// Публичная сборка: estimate() уже отдаёт клиентские строки (clientPrices.ts) — в «Смете» только розница, без себестоимости,
// коэффициентов и источников закупки; страж цен (price-guard.ts) смотрит собранный JS — новых закупочных чисел здесь нет.
import { estimate, engineNote, lineGroup, isKupeLine, type PriceLine } from "./pricing";
import { details, detailGrooves, orderNumber, quoteBreakdown, splitRows } from "./exports";
import { describeModule } from "./quoteDescribe";
import { pendingTotalLabel } from "./pendingPrices";
import { CLIENT_SOURCE_IN_SHEET } from "./clientPrices";
import { PUBLIC_BUILD } from "./buildMode";
import { modulePrices } from "./itemPrices";
import type { Project } from "./project";
import { XS, str, num, fml, empty, ref, workbookFiles, workbookZip, type XCell, type XSheet, type XStyle } from "./xlsx";

type Estimate = ReturnType<typeof estimate>;
export type XGroup = "material" | "work" | "hardware" | "kupe" | "pending";
export const XGROUPS: { id: XGroup; label: string }[] = [
  { id: "material", label: "Материалы" },
  { id: "work", label: "Работа цеха" },
  { id: "hardware", label: "Фурнитура" },
  { id: "kupe", label: "Двери купе" },
  { id: "pending", label: "После финального расчёта конструктором" },
];
/** Группа строки для Excel: «после финального расчёта» и двери купе — свои группы; работа цеха (листы, узкие детали, склейка) —
 *  отдельно от материалов; остальное — как в разбивке сметы (lineGroup). */
export function xlsxGroup(l: Pick<PriceLine, "id" | "pending">): XGroup {
  if (l.pending) return "pending";
  if (isKupeLine(l.id)) return "kupe";
  if (/^(work$|work-hdf$|small$|falsh-glue$)/.test(l.id)) return "work";
  if (l.id.startsWith("client:")) return "material";
  return lineGroup(l.id) === "material" ? "material" : "hardware";
}
const stamp = (d: Date) => d.toLocaleDateString("ru-RU");
const title = (p: Project) => p.offer?.customer?.trim() || "Проект мебели";
function status(l: PriceLine, manager: boolean): string {
  if (l.pending) return "После финального расчёта";
  if (l.unitPrice === null) return l.source === CLIENT_SOURCE_IN_SHEET ? "Входит в цену за лист" : "Уточнить цену";
  return manager && l.retail ? "Розница, поверх коэффициента" : "Учтено";
}
const row = (cells: XCell[], width: number, s: XStyle = XS.cell) => [...cells, ...Array.from({ length: Math.max(0, width - cells.length) }, () => empty(s))];

/** Лист «Смета». manager — менеджерская версия (закупка, коэффициент, источники); иначе только клиентские цены. */
export function estimateSheet(p: Project, e: Estimate, manager = !PUBLIC_BUILD, created = new Date()): XSheet {
  const W = manager ? 9 : 7, rows: XCell[][] = [], merges: string[] = [];
  const full = (r: number) => merges.push(`A${r + 1}:${ref(W - 1, r)}`);
  rows.push(row([str("Смета проекта · " + title(p), XS.title)], W, XS.text)); full(0);
  rows.push(row([str(`${stamp(created)} · ${manager ? "закупочные цены цеха × коэффициент " + String(e.markup).replace(".", ",") + "; розничные позиции — поверх коэффициента" : "цены салона, предварительный расчёт"}`, XS.subtitle)], W, XS.text)); full(1);
  rows.push([]);
  rows.push(["№", "Позиция", "Кол-во", "Ед.", "Цена, ₽", "Сумма, ₽", ...(manager ? ["Цена", "Статус", "Источник"] : ["Статус"])].map((h) => str(h, XS.header)));
  const buy: string[] = [], retail: string[] = [];
  let n = 0;
  for (const g of XGROUPS) {
    const lines = e.lines.filter((l) => xlsxGroup(l) === g.id);
    if (!lines.length) continue;
    rows.push(row([str(g.label, XS.group)], W, XS.group)); full(rows.length - 1);
    const first = rows.length;
    for (const l of lines) {
      const r = rows.length, priced = l.unitPrice !== null;
      rows.push([num(++n, XS.numCenter), str(l.label), num(l.quantity, XS.num), str(l.unit), priced ? num(l.unitPrice!, XS.price) : empty(XS.price), priced ? fml(`C${r + 1}*E${r + 1}`, l.quantity * l.unitPrice!) : empty(XS.money),
        ...(manager ? [str(l.retail ? "розница" : "закупка"), str(status(l, true)), str(l.source)] : [str(status(l, false))])]);
    }
    const last = rows.length - 1, range = (c: string) => `${c}${first + 1}:${c}${last + 1}`;
    const sumOf = (pred: (l: PriceLine) => boolean) => lines.filter((l) => l.unitPrice !== null && pred(l)).reduce((s, l) => s + l.quantity * l.unitPrice!, 0);
    if (g.id === "pending") { rows.push(row([empty(XS.note), str(pendingTotalLabel(lines.length) + " — в итог не входят", XS.note)], W, XS.text)); continue; }
    const subtotal = (label: string, f: string, v: number, into: string[]) => { const r = rows.length; rows.push(row([empty(XS.subLabel), str(label, XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), fml(f, v, XS.subMoney)], W, XS.subLabel)); into.push(`F${r + 1}`); };
    if (manager) {
      if (lines.some((l) => !l.retail)) subtotal(`Итого «${g.label}» · закупка`, `SUMIFS(${range("F")},${range("G")},"закупка")`, sumOf((l) => !l.retail), buy);
      if (lines.some((l) => l.retail)) subtotal(`Итого «${g.label}» · розница`, `SUMIFS(${range("F")},${range("G")},"розница")`, sumOf((l) => !!l.retail), retail);
    } else subtotal(`Итого «${g.label}»`, `SUM(${range("F")})`, sumOf(() => true), buy);
  }
  rows.push([]);
  const total = (label: string, cell: XCell, note = "") => { rows.push(row([empty(XS.totalLabel), str(label, XS.totalLabel), empty(XS.totalLabel), empty(XS.totalLabel), empty(XS.totalLabel), cell, ...(note ? [str(note, XS.note)] : [])], W, XS.text)); };
  const plain = (label: string, cell: XCell, note = "") => { rows.push(row([empty(XS.text), str(label, XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), cell, ...(note ? [str(note, XS.note)] : [])], W, XS.text)); };
  const sumCells = (cells: string[], v: number) => fml(cells.length ? cells.join("+") : "0", v, XS.subMoney);
  if (manager) {
    plain("Себестоимость (закупка)", sumCells(buy, e.lines.filter((l) => !l.retail && l.unitPrice !== null).reduce((s, l) => s + l.quantity * l.unitPrice!, 0)));
    plain("Коэффициент", num(e.markup, XS.subNum));
    if (e.vernissageOnTop) plain("Фасады Вернисаж клиенту (закупка × " + String(e.vernissageMarkup).replace(".", ",") + ")", num(e.vernissageOnTop, XS.subMoney), "свой коэффициент вместо общего");
    if (retail.length) plain("Розничные позиции поверх коэффициента", sumCells(retail, e.retailExtras));
    plain("Цена по коэффициенту", e.byMarkup === null ? str("не менее " + e.byMarkupKnown.toLocaleString("ru-RU") + " ₽", XS.subLabel) : num(e.byMarkup, XS.subMoney), e.model === "markup" ? "выбрана" : "для сравнения");
    plain(`Цена за лист: ${e.ldspSheets} × ${e.sheetPrice.toLocaleString("ru-RU")} ₽`, num(e.bySheet, XS.subMoney), e.model === "sheet" ? "выбрана" : "для сравнения");
  } else plain("Итого по позициям", sumCells(buy, e.knownCost));
  total("Расчётная цена", e.retail === null ? str(e.notice ?? (e.unplaced ? "Смета не завершена: не помещается в лист" : "Стоимость уточнит менеджер"), XS.totalLabel) : num(e.retail, XS.totalMoney), e.retail === null ? "" : (!manager && e.retail !== e.knownCost && Math.abs(e.retail - e.knownCost) < 100 ? "итог округлён до 100 ₽; " : "") + "предварительно, без доставки и монтажа");
  const split = e.retail === null ? null : quoteBreakdown(String(e.retail), e);
  if (split) { rows.push([]); for (const [k, v] of splitRows(split)) plain("Разбивка: " + k, num(v, XS.subMoney)); }
  rows.push([]);
  const notes = [e.pending.length ? pendingTotalLabel(e.pending.length) + " — в итог не входят." : "", e.missing.length ? "Позиций без цены: " + e.missing.length + "." : "", "Доставка, монтаж и неописанный крепёж не включены.", manager ? engineNote(e) + "." : ""].filter(Boolean);
  for (const t of notes) { rows.push(row([empty(XS.text), str(t, XS.note)], 2, XS.text)); merges.push(`B${rows.length}:${ref(W - 1, rows.length - 1)}`); }
  return { name: "Смета", rows, merges, freeze: 4, landscape: manager, cols: manager ? [5, 46, 9, 7, 12, 13, 10, 18, 46] : [5, 56, 10, 8, 13, 14, 22] };
}

/** Лист «Детали»: деталировка (коды как на картах и бирках). Без номера заказа — только пометка (правило T3). */
export function detailsSheet(p: Project): XSheet {
  const W = 13, rows: XCell[][] = [], order = orderNumber(p);
  rows.push(row([str("Деталировка · " + title(p), XS.title)], W, XS.text));
  rows.push(row([str(order ? "Заказ " + order + " · коды деталей совпадают с картами листов и бирками" : "Номер заказа не указан", XS.subtitle)], W, XS.text));
  rows.push([]);
  rows.push(["Код", "Модуль", "Деталь", "Материал", "Длина", "Ширина", "Толщина", "Кромка 1 · торец ширины", "Кромка 2 · торец ширины", "Кромка 3 · торец длины", "Кромка 4 · торец длины", "Пазование", "Площадь, м²"].map((h) => str(h, XS.header)));
  if (!order) rows.push(row([str("Укажите номер заказа — без него производственные документы (деталировка) не выгружаются.", XS.note)], 1, XS.text));
  else {
    const ds = details(p), first = rows.length;
    for (const d of ds) { const r = rows.length; rows.push([str(d.code), str(d.moduleName), str(d.name), str(d.material === "hdf" ? "ЛХДФ" : d.decor), num(d.length), num(d.width), num(d.thickness, XS.numCenter), ...d.edge.map((v) => num(v, XS.numCenter)), str(detailGrooves(p, d.moduleId, d.id)), fml(`ROUND(E${r + 1}*F${r + 1}/1000000,3)`, Math.round(d.length * d.width / 1e3) / 1e3, XS.area)]); }
    const r = rows.length;
    rows.push(row([str("Всего деталей: " + ds.length, XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), empty(XS.subLabel), str("Площадь", XS.subLabel), fml(ds.length ? `SUM(M${first + 1}:M${r})` : "0", ds.reduce((s, d) => s + Math.round(d.length * d.width / 1e3) / 1e3, 0), XS.subNum)], W, XS.subLabel));
  }
  return { name: "Детали", rows, freeze: 4, landscape: true, merges: ["A1:M1", "A2:M2", ...(order ? [] : ["A5:M5"])], cols: [7, 24, 26, 22, 8, 8, 8, 10, 10, 10, 10, 30, 10] };
}

/** Лист «Кратко для клиента»: изделия простыми словами, цена по изделиям (если включено и считается) и итог. Только розница. */
export function clientSheet(p: Project, e: Estimate, created = new Date()): XSheet {
  const items = p.offer?.itemPrices === false ? null : modulePrices(p, e.retail);
  const W = items ? 6 : 5, rows: XCell[][] = [];
  rows.push(row([str("Стоимость проекта · " + title(p), XS.title)], W, XS.text));
  rows.push(row([str(stamp(created) + " · предварительный расчёт", XS.subtitle)], W, XS.text));
  rows.push([]);
  rows.push(["№", "Изделие", "Размеры, мм", "Материалы", "Наполнение", ...(items ? ["Цена, ₽"] : [])].map((h) => str(h, XS.header)));
  const first = rows.length;
  p.modules.forEach((a, i) => { const d = describeModule(a.module); rows.push([num(i + 1, XS.numCenter), str(d.kind + (d.kind !== a.module.name ? "\n" + a.module.name : "")), str(d.size), str(d.materials.join("\n")), str(d.filling.length ? d.filling.join("\n") : "—"), ...(items ? [num(items[i], XS.money)] : [])]); });
  const last = rows.length;
  const split = e.retail === null ? null : quoteBreakdown(String(e.retail), e);
  const line = (label: string, cell: XCell, style: XStyle = XS.subLabel) => rows.push(row([empty(XS.text), str(label, style), ...Array.from({ length: W - 3 }, () => empty(style)), cell], W, XS.text));
  if (split) for (const [k, v] of splitRows(split)) line(k, num(v, XS.subMoney));
  if (e.retail === null) line("Итого", str("Стоимость уточнит менеджер", XS.totalLabel), XS.totalLabel);
  else line("Итого", items ? fml(`SUM(F${first + 1}:F${last})`, items.reduce((s, v) => s + v, 0), XS.totalMoney) : num(e.retail, XS.totalMoney), XS.totalLabel);
  rows.push([]);
  const notes = [e.pending.length ? pendingTotalLabel(e.pending.length) + " — в итог не входят." : "", items ? "Цена изделия — его доля в общей стоимости: листы материала раскраиваются на весь заказ." : "", "Предварительная стоимость без доставки и монтажа. Размеры уточняются после замера."].filter(Boolean);
  for (const t of notes) rows.push([empty(XS.text), str(t, XS.note)]);
  const merges = [`A1:${ref(W - 1, 0)}`, `A2:${ref(W - 1, 1)}`, ...notes.map((_, k) => `B${rows.length - notes.length + k + 1}:${ref(W - 1, rows.length - notes.length + k)}`)];
  return { name: "Кратко для клиента", rows, merges, freeze: 4, cols: items ? [5, 30, 18, 44, 30, 14] : [5, 30, 18, 46, 34] };
}

/** Все XML-файлы книги сметы (для теста без распаковки). */
export function estimateWorkbookFiles(p: Project, e = estimate(p), created = new Date()): Record<string, string> {
  return workbookFiles([estimateSheet(p, e, !PUBLIC_BUILD, created), detailsSheet(p), clientSheet(p, e, created)], "Смета проекта · " + title(p));
}
export async function estimateXLSX(p: Project, e = estimate(p)): Promise<Uint8Array> { return workbookZip(estimateWorkbookFiles(p, e)); }
export const ESTIMATE_XLSX_NAME = "Смета проекта.xlsx";
