// Быстрые действия кругового меню корпуса (запрос Макса 19.10.2026: «большую часть добавлять через правую кнопку: подсветка в полках,
// подсветка в стойках, тип задней стенки ХДФ/ЛДСП/ХДФ в паз, навесы антресоли, тип открывания, правка ящиков»).
// Только те же правки модели, что делает панель справа (select «Задняя стенка», «Основание», «Подсветка», «Очистить наполнение»,
// шаблоны наполнения) — без своих механизмов. Кухни, сырые модули Базиса, двери-купе, столы и угловые шкафы — без этих пунктов:
// у кухонь правила Базиса, у остальных своё устройство.
import { ArrowUpToLine, Eraser, Footprints, Layers, Lightbulb, MousePointerClick, PanelBottom, Rows3, Shirt, Archive, Square, Trash } from "lucide-react";
import type { RadialItem } from "./RadialMenu";
import { boxes, distribute, plinth, RULES, type Module, type Section } from "./model";
import { anyLight, clearLights, hasShelf, hasStand, setSectionShelves, setStands } from "./lights";

export type QuickMenuOps = {
  /** Правка этого корпуса (modifyAt) — как селекты и галочки панели. */
  modify: (update: (n: Module) => void) => void;
  /** «Антресоль» — addUpperModule, как кнопка панели. */
  addUpper: () => void;
  /** Убрать антресоль над корпусом; undefined — антресоли нет. */
  removeUpper?: () => void;
  /** «Подсветка › Режим выбора деталей…»: включить режим кликов по деталям этого корпуса; undefined — режима нет. */
  lightMode?: () => void;
};

/** Есть ли у модуля быстрые пункты (шкафы и стеллажи студии). */
export function quickMenuApplies(m: Module) {
  return !m.kitchen && !m.raw && !m.kupe && !m.desk && !m.worktop && !m.corner && !m.casework;
}

const BACKS: { id: NonNullable<Module["backType"]>; label: string; hint: string }[] = [
  { id: "nailed", label: "ХДФ накладной", hint: "ЛХДФ 3 мм набивная — как по умолчанию" },
  { id: "groove", label: "ХДФ в паз", hint: "ЛХДФ 3 мм в паз боковин, отступ 16 мм" },
  { id: "board", label: "ЛДСП", hint: "ЛДСП 16 в цвет корпуса, вкладная" },
  { id: "none", label: "Без задника", hint: "Жёсткость и крепёж проверяет технолог" },
];

export function backItem(m: Module, ops: QuickMenuOps): RadialItem {
  const cur = m.backType ?? "nailed";
  return { id: "q-back", label: "Задняя стенка", icon: Square, hint: "Сейчас: " + BACKS.find((b) => b.id === cur)!.label, children: BACKS.map((b) => ({
    id: "q-back-" + b.id, label: b.label, icon: Square, active: cur === b.id, hint: b.hint,
    run: () => ops.modify((n) => { if (b.id === "nailed") delete n.backType; else n.backType = b.id; }) })) };
}

/** Шаблоны наполнения одной секции: те же расчёты, что шаблоны панели (distribute), но только для выбранной секции. */
export type SectionTemplate = "clear" | "shelves3" | "shelves5" | "rod-shelf" | "drawers-rod" | "drawers-shelves";
export function applySectionTemplate(n: Module, sid: string, kind: SectionTemplate) {
  const s = n.sections.find((x) => x.id === sid);
  if (!s) throw Error("Выберите секцию.");
  // «Очистить наполнение» панели (clearSection): полки, ящики, штанга, пантограф, отметки полок
  s.shelves = []; s.drawers = 0; s.rod = false;
  delete s.pantograph; delete s.rodAt; delete s.drawerConfigs; delete s.glassShelves; delete s.fixed; delete s.pullouts; delete s.shelfLight; delete s.shelfLights;
  if (kind === "shelves3" || kind === "shelves5") s.shelves = distribute(n, s, kind === "shelves3" ? 3 : 5);
  if (kind === "rod-shelf") { s.rod = true; s.shelves = distribute(n, s, 1); }
  if (kind === "drawers-rod") { s.drawers = 2; s.rod = true; s.shelves = distribute(n, s, 1); }
  if (kind === "drawers-shelves") { s.drawers = 3; s.shelves = distribute(n, s, 2); }
}

export function sectionFillItem(m: Module, sid: string, ops: QuickMenuOps): RadialItem {
  const t = (kind: SectionTemplate, label: string, icon: RadialItem["icon"], hint: string): RadialItem =>
    ({ id: "q-tpl-" + kind, label, icon, hint, danger: kind === "clear", run: () => ops.modify((n) => applySectionTemplate(n, sid, kind)) });
  const idx = Math.max(0, m.sections.findIndex((s) => s.id === sid));
  return { id: "q-section", label: "Наполнение", icon: Layers, hint: `Секция ${idx + 1}: заменить наполнение одним нажатием`, children: [
    t("shelves3", "Полки 3", Rows3, "Три полки поровну по высоте"),
    t("shelves5", "Полки 5", Rows3, "Пять полок поровну по высоте"),
    t("rod-shelf", "Штанга + полка", Shirt, "Полка сверху и штанга под ней"),
    t("drawers-rod", "Ящики 2 + штанга", Archive, "Два ящика внизу, над ними штанга"),
    t("drawers-shelves", "Ящики 3 + полки", Archive, "Три ящика внизу и две полки"),
    t("clear", "Очистить", Eraser, "Пустая секция. Вернуть — Ctrl+Z"),
  ] };
}

export function baseItem(m: Module, ops: QuickMenuOps): RadialItem {
  const p = m.feet ? null : plinth(m), feet = m.feet?.height;
  const plinthItem = (h: number): RadialItem => ({ id: "q-plinth-" + h, label: `Цоколь ${h}`, icon: PanelBottom, active: p === h, hint: `Цоколь ${h} мм от пола`, run: () => ops.modify((n) => { delete n.feet; n.plinthHeight = h; }) });
  const feetItem = (h: number, label: string): RadialItem => ({ id: "q-feet-" + h, label, icon: Footprints, active: feet === h, hint: h === 18 ? "Ножки M6×18 под боковинами" : `Регулируемые ножки ${h} мм`, run: () => ops.modify((n) => { n.feet = { height: h }; }) });
  return { id: "q-base", label: "Цоколь / ножки", icon: PanelBottom, hint: m.feet ? `Сейчас ножки ${feet} мм` : `Сейчас цоколь ${p} мм`, disabled: plinth(m) === 0 && !m.feet, children: [
    plinthItem(60), plinthItem(80), plinthItem(100), plinthItem(120), feetItem(18, "Ножки 18"), feetItem(100, "Ножки 100"),
  ] };
}

export function upperItem(ops: QuickMenuOps): RadialItem {
  return { id: "upper", label: "Антресоль", icon: ArrowUpToLine, hint: ops.removeUpper ? "Антресоль уже стоит" : "Корпус сверху той же ширины", children: [
    { id: "q-upper-add", label: "Добавить", icon: ArrowUpToLine, disabled: !!ops.removeUpper, hint: ops.removeUpper ? "Над корпусом уже есть антресоль" : "Корпус сверху той же ширины", run: ops.addUpper },
    { id: "q-upper-remove", label: "Убрать", icon: Trash, danger: true, disabled: !ops.removeUpper, hint: "Убрать антресоль над корпусом. Вернуть — Ctrl+Z", run: ops.removeUpper },
  ] };
}

/** Цена подсветки клиенту в подсказке пункта (решение Макса 20.10.2026): «4 000 ₽ за пог. м». */
const rubPerM = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽ за пог. м";

/** Подсветка по деталям (запрос Макса 20.10.2026): стойки секции по выбору, все полки секции, режим кликов по деталям, снять всё. */
export function lightItem(m: Module, sid: string, ops: QuickMenuOps): RadialItem {
  const s = m.sections.find((x) => x.id === sid) ?? m.sections[0], idx = m.sections.indexOf(s) + 1;
  const left = hasStand(m, s.id, "left"), right = hasStand(m, s.id, "right");
  const shelvesLit = s.shelves.length > 0 && s.shelves.every((_, j) => hasShelf(m, s.id, j));
  const stand = (which: "left" | "right" | "both", label: string, on: boolean): RadialItem => ({
    id: "q-light-" + which, label, icon: Lightbulb, active: on,
    hint: (on ? "Убрать: " : "") + (which === "both" ? "обе стойки" : which === "left" ? "левая стойка" : "правая стойка") + ` секции ${idx}, LED на всю высоту; ` + rubPerM(RULES.lightRetailPerM),
    run: () => ops.modify((n) => setStands(n, s.id, which, !on)) });
  return { id: "q-light", label: "Подсветка", icon: Lightbulb, active: anyLight(m), hint: "Стойки, полки или любые детали кликом", children: [
    stand("left", "Левая стойка", left),
    stand("right", "Правая стойка", right),
    stand("both", "Обе стойки", left && right),
    { id: "q-light-shelves", label: "Все полки секции", icon: Lightbulb, active: shelvesLit, disabled: !s.shelves.length,
      hint: s.shelves.length ? (shelvesLit ? "Убрать подсветку полок секции " + idx : "LED в передней кромке полок секции " + idx) + "; " + rubPerM(RULES.shelfLightRetailPerM) : "В секции нет полок",
      run: () => ops.modify((n) => setSectionShelves(n, s.id, !shelvesLit)) },
    { id: "q-light-mode", label: "Режим выбора деталей…", icon: MousePointerClick, disabled: !ops.lightMode, hint: "Кликайте стойки, полки, перегородки и крышу — подсветка ставится и снимается сразу",
      run: ops.lightMode },
    { id: "q-light-clear", label: "Убрать всю подсветку", icon: Trash, danger: true, disabled: !anyLight(m), hint: "Снять подсветку со всех деталей корпуса. Вернуть — Ctrl+Z",
      run: () => ops.modify((n) => clearLights(n)) },
  ] };
}

/** Быстрые пункты меню корпуса по порядку кольца. */
export function quickItems(m: Module, sid: string, ops: QuickMenuOps): RadialItem[] {
  if (!quickMenuApplies(m)) return [];
  return [sectionFillItem(m, sid, ops), backItem(m, ops), baseItem(m, ops), lightItem(m, sid, ops)];
}

/** Шаг полкодержателя: полка из меню встаёт на высоту клика, привязанную к шагу 32 мм от дна секции. */
export const SHELF_STEP = 32;
/**
 * Высота (в координатах корпуса), куда меню ставит элемент.
 * Полка — высота клика с привязкой к шагу 32 от дна секции.
 * Штанга — под ближайшей полкой (или крышей) над точкой клика, на RULES.rodTopOffset (70 мм, как штанга по умолчанию в parts()).
 */
export function menuDropY(m: Module, sid: string, kind: string, clickY: number): number {
  const b = boxes(m).find((x) => x.id === sid);
  if (!b) return clickY;
  const span = b.top - b.bottom;
  if (kind === "shelf") return b.bottom + Math.min(span, Math.max(0, Math.round((clickY - b.bottom) / SHELF_STEP) * SHELF_STEP));
  if (kind === "rod") {
    const s = m.sections.find((x) => x.id === sid) as Section;
    const above = s.shelves.map((f) => b.bottom + f * span).filter((y) => y > clickY);
    const ceiling = above.length ? Math.min(...above) : b.top;
    return ceiling - RULES.rodTopOffset;
  }
  return clickY;
}
