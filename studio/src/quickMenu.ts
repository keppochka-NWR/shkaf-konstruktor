// Быстрые действия кругового меню корпуса (запрос Макса 19.10.2026: «большую часть добавлять через правую кнопку: подсветка в полках,
// подсветка в стойках, тип задней стенки ХДФ/ЛДСП/ХДФ в паз, навесы антресоли, тип открывания, правка ящиков»).
// Только те же правки модели, что делает панель справа (select «Задняя стенка», «Основание», «Подсветка», «Очистить наполнение»,
// шаблоны наполнения) — без своих механизмов. Кухни, сырые модули Базиса, двери-купе, столы и угловые шкафы — без этих пунктов:
// у кухонь правила Базиса, у остальных своё устройство.
import { ArrowUpToLine, Eraser, Footprints, Layers, Lightbulb, Link2, PanelBottom, PanelLeft, Rows2, Rows3, Shirt, Archive, Square, Trash } from "lucide-react";
import type { RadialItem } from "./RadialMenu";
import { boxes, distribute, drawerCapTop, facadeBottom, facadeTop, plinth, RULES, type Module, type Section } from "./model";

export type QuickMenuOps = {
  /** Правка этого корпуса (modifyAt) — как селекты и галочки панели. */
  modify: (update: (n: Module) => void) => void;
  /** «Антресоль» — addUpperModule, как кнопка панели. */
  addUpper: () => void;
  /** Убрать антресоль над корпусом; undefined — антресоли нет. */
  removeUpper?: () => void;
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
  delete s.pantograph; delete s.rodAt; delete s.drawerConfigs; delete s.glassShelves; delete s.fixed; delete s.pullouts; delete s.shelfLight;
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

export function lightItem(m: Module, sid: string, ops: QuickMenuOps): RadialItem {
  const s = m.sections.find((x) => x.id === sid) ?? m.sections[0];
  return { id: "q-light", label: "Подсветка", icon: Lightbulb, active: !!m.standLight || m.sections.some((x) => x.shelfLight), hint: "В стойках или в полках секции", children: [
    { id: "q-light-stand", label: m.standLight ? "Убрать в стойках" : "В стойках", icon: Lightbulb, active: !!m.standLight, hint: "LED-профиль в стойках на всю высоту",
      run: () => ops.modify((n) => { if (n.standLight) delete n.standLight; else n.standLight = true; }) },
    { id: "q-light-shelves", label: s.shelfLight ? "Убрать в полках" : "В полках", icon: Lightbulb, active: !!s.shelfLight, disabled: !s.shelves.length && !s.shelfLight,
      hint: s.shelves.length ? "LED-профиль в передней кромке полок секции; цену уточнит конструктор" : "В секции нет полок",
      run: () => ops.modify((n) => { const x = n.sections.find((q) => q.id === s.id)!; if (x.shelfLight) delete x.shelfLight; else x.shelfLight = true; }) },
  ] };
}

/** Высота нижнего ряда при включении «Разделить фасады по высоте» — та же формула, что галочка панели (половина высоты фасадов секции). */
export function defaultDoorSplit(m: Module, s: Section) {
  return Math.round((facadeTop(m) - (s.externalDrawers && s.drawers ? drawerCapTop(m, s) + (s.doorGap ?? RULES.faceGap) : facadeBottom(m))) / 2);
}

/** Ф3b (Покрытие.md, «деление двери по высоте» — 72 изделия): вкл/выкл деления фасадов секции, как галочка панели. */
export function doorSplitItem(m: Module, sid: string, ops: QuickMenuOps): RadialItem {
  const s = m.sections.find((x) => x.id === sid) ?? m.sections[0];
  const on = s.doorSplit !== undefined;
  return { id: "q-door-split", label: on ? "Не делить дверь" : "Разделить по высоте", icon: Rows2, active: on, disabled: !m.doors,
    hint: !m.doors ? "У корпуса нет распашных фасадов" : on ? `Сейчас нижний ряд ${s.doorSplit} мм. Снять деление — одна дверь на секцию` : "Два фасада друг над другом; высота нижнего ряда — половина, число — в панели",
    run: () => ops.modify((n) => { const a = n.sections.find((x) => x.id === s.id)!; if (a.doorSplit !== undefined) delete a.doorSplit; else a.doorSplit = defaultDoorSplit(n, a); delete a.removedDoors; }) };
}

/**
 * Ф3b (петли вкладные — 32 изделия, полунакладные — 20): монтаж фасадов, как select «Монтаж фасадов» панели.
 * В модели монтаж задаётся на весь корпус (doorMount), не на одну дверь; полунакладного монтажа в модели нет — пункт неактивен.
 */
export function doorMountItem(m: Module, ops: QuickMenuOps): RadialItem {
  const cur = m.doorMount ?? "overlay";
  return { id: "q-door-mount", label: "Тип петли", icon: Link2, disabled: !m.doors, hint: (m.doors ? "Монтаж фасадов всего корпуса. Сейчас: " + (cur === "inset" ? "вкладные" : "накладные") : "У корпуса нет распашных фасадов"), children: [
    { id: "q-mount-overlay", label: "Накладная", icon: Link2, active: cur === "overlay", hint: "Фасад закрывает торцы боковин — как по умолчанию", run: () => ops.modify((n) => { delete n.doorMount; }) },
    { id: "q-mount-half", label: "Полунакладная", icon: Link2, disabled: true, hint: "Нет в студии: полунакладной монтаж пока не задаётся (общая стойка двух дверей)" },
    { id: "q-mount-inset", label: "Вкладная", icon: Link2, active: cur === "inset", hint: "Фасад внутри проёма корпуса, петли вкладные", run: () => ops.modify((n) => { n.doorMount = "inset"; }) },
  ] };
}

/** Ф3b (фальшпанели/доборы/планки — 33 изделия): те же поля панели — боковые фальшпанели до потолка, планка под крышей, ширина фальша к стене. */
export function fillersItem(m: Module, ops: QuickMenuOps): RadialItem {
  const sideItem = (side: "left" | "right"): RadialItem => {
    const sp = m.sidePanels?.[side], name = side === "left" ? "слева" : "справа";
    return { id: "q-side-" + side, label: (sp ? "Убрать фальшпанель " : "Фальшпанель ") + name, icon: PanelLeft, active: !!sp,
      hint: sp ? `Сейчас ${sp.height} × ${sp.depth} мм. Размеры — в панели` : "Боковая фальшпанель до потолка: высота от 2400, глубина корпуса + 18",
      run: () => ops.modify((n) => { const next = { ...n.sidePanels }; if (next[side]) delete next[side]; else next[side] = { height: Math.max(n.height, 2400), depth: n.depth + 18 }; if (Object.keys(next).length) n.sidePanels = next; else delete n.sidePanels; }) };
  };
  const strip: RadialItem = { id: "q-top-strip", label: "Планка под крышей", icon: ArrowUpToLine, active: !!m.topStrip, hint: m.topStrip ? `Сейчас ${m.topStrip} мм, в цвет фасадов` : "Нет", children: [0, 40, 60, 80, 100, 120].map((v) => ({
    id: "q-top-strip-" + v, label: v ? `${v} мм` : "Нет", icon: ArrowUpToLine, active: (m.topStrip ?? 0) === v, hint: v ? `Планка ${v} мм в цвет фасадов` : "Без планки под крышей",
    run: () => ops.modify((n) => { if (v) n.topStrip = v; else delete n.topStrip; }) })) };
  const wall = (["left", "right"] as const).filter((side) => m.wallFiller?.[side]).map((side): RadialItem => {
    const w = m.wallFiller![side]!;
    return { id: "q-wall-" + side, label: `К стене ${side === "left" ? "слева" : "справа"}`, icon: PanelLeft, active: true, hint: `Фальш торцом к стене, ширина ${w.width} мм`, children: [RULES.wallFillerMin, 80, 100, 120, RULES.wallFillerMax].map((v) => ({
      id: `q-wall-${side}-${v}`, label: `${v} мм`, icon: PanelLeft, active: w.width === v, hint: `Планка ${v} мм торцом`,
      run: () => ops.modify((n) => { n.wallFiller = { ...n.wallFiller, [side]: { kind: "edge", width: v } }; }) })) };
  });
  return { id: "q-fillers", label: "Фальши", icon: PanelLeft, active: !!(m.sidePanels || m.topStrip || m.wallFiller),
    hint: "Фальшпанели, планка под крышей" + (m.wallFiller ? ", фальш к стене" : ". Фальш к стене добавляется сам, когда корпус у стены"), children: [sideItem("left"), sideItem("right"), strip, ...wall] };
}

/** Пункты для меню фасада/двери (тот же модуль): деление по высоте и тип петли. */
export function doorQuickItems(m: Module, sid: string, ops: QuickMenuOps): RadialItem[] {
  if (!quickMenuApplies(m) || !m.doors) return [];
  return [doorSplitItem(m, sid, ops), doorMountItem(m, ops)];
}

/** Быстрые пункты меню корпуса по порядку кольца. */
export function quickItems(m: Module, sid: string, ops: QuickMenuOps): RadialItem[] {
  if (!quickMenuApplies(m)) return [];
  return [sectionFillItem(m, sid, ops), backItem(m, ops), baseItem(m, ops), fillersItem(m, ops), lightItem(m, sid, ops)];
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
