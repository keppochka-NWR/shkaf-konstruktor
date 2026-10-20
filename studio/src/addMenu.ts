// Пункт «Добавить» кругового меню корпуса (хотелка Макса 18.10.2026: «в «Добавить» каркаса сразу подсветку и вещи, которые
// отличают нас от серийной мебели»). Только то, что студия уже строит и считает: те же операции, что кнопки панели «Наполнение»
// (dropFilling / modifySection), без новой фурнитуры и цен. У каждого пункта — короткая подсказка «чем лучше серийной».
// Пунктов больше семи — поэтому две группы: «В секцию ›» (наполнение; «Наполнение» не влезало в центр кольца — перенос «Наполнени/е») и «Улучшения ›».
import { Archive, ArrowDownToLine, Columns2, Footprints, Layers, Lightbulb, Lock, MousePointerClick, PanelTop, Plus, Rows3, Shirt, ShoppingBasket, Sparkles } from "lucide-react";
import type { RadialItem } from "./RadialMenu";
import { RULES, type Module } from "./model";
import { WORKTOP_CHOICES, setWorktopMaterial, worktopLabel } from "./kitchen";
import { allStandsLit, setAllStands } from "./lights";
import type { FillKind } from "./operations";
import { MESH, MESH_KIND_LABEL, type MeshItem } from "./mesh";

export type AddMenuOps = {
  /** Как кнопки панели: dropFilling(kind, корпус, секция, высота клика, meshId); glass — полка сразу стеклянная. */
  drop: (kind: FillKind, opt?: { meshId?: string; glass?: boolean }) => void;
  /** Правка этого корпуса (modifyAt) — как галочки и чипы панели. */
  modify: (update: (n: Module) => void) => void;
  /** «Разделить секцию» панели (splitSection). */
  split: () => void;
  /** Кухня: наполнение кухонного модуля — в панели справа. */
  openKitchen: () => void;
};

const MESH_ICON: Record<MeshItem["kind"], RadialItem["icon"]> = { basket: ShoppingBasket, trousers: Shirt, shoes: Footprints };
// Шесть пунктов «Наполнения» по кольцу: 0 Полку, 1 Перегородку, 2 Сетку, 3 Ящик, 4 Вешалки, 5 Стекло — длинные подписи не соседствуют.
const RAW_HINT = "Модуль из Базиса как есть — наполнение правится в Базисе";

/** Столешница (задача Макса 19.10.2026): вместо неактивного «Добавить» — «Материал столешницы ›»: компакт 12, акрил 12, кварц 20,
 *  ЛДСП постформинг 38, акрил 40 с подклейкой. Толщина и высота модуля — по материалу (setWorktopMaterial), вырезы сохраняются. */
export function worktopMaterialItem(mod: Module, modify: AddMenuOps["modify"]): RadialItem {
  const w = mod.worktop!;
  return { id: "worktop-material", label: "Материал столешницы", icon: Layers, hint: `Сейчас: ${worktopLabel(w)} ${w.thickness} мм`, children: WORKTOP_CHOICES.map((c) => ({
    id: "worktop-" + c.id, label: c.label, icon: Layers, active: w.material === c.material && w.thickness === c.thickness, hint: c.hint,
    run: () => modify((n) => setWorktopMaterial(n, c.material, c.thickness)) })) };
}

export function addMenuItem(mod: Module, sid: string, ops: AddMenuOps): RadialItem {
  const base = { id: "fill", label: "Добавить", icon: Plus };
  if (mod.kitchen) return { ...base, hint: "Кухонные ящики, полки и Gola — в панели справа", run: ops.openKitchen };
  // Сырой модуль Базиса, двери-купе, стол, столешница: наполнение секции туда не ставится (dropFilling откажет) — пункт неактивен.
  if (mod.raw || mod.kupe || mod.desk || mod.worktop)
    return { ...base, disabled: true, hint: mod.raw ? RAW_HINT : "Наполнение секции у этого объекта не ставится" };
  const sec = mod.sections.find((s) => s.id === sid) ?? mod.sections[0], corner = !!mod.corner;
  const section = (n: Module) => n.sections.find((s) => s.id === sec.id)!;
  const fill = (kind: FillKind, label: string, icon: RadialItem["icon"], hint: string, opt?: { glass?: boolean; disabled?: boolean }): RadialItem =>
    ({ id: "add-" + kind + (opt?.glass ? "-glass" : ""), label, icon, hint, disabled: opt?.disabled, run: () => ops.drop(kind, opt?.glass ? { glass: true } : undefined) });
  const rodOff = corner && (mod.corner!.level === "upper" || mod.sections.indexOf(sec) !== 2);
  const meshKinds = (["basket", "trousers", "shoes"] as const).map((kind): RadialItem => ({
    id: "mesh-" + kind, label: MESH_KIND_LABEL[kind], icon: MESH_ICON[kind], hint: kind === "basket" ? "Сетка на своих направляющих — всё на виду" : kind === "trousers" ? "Выдвижная брючница: брюки не мнутся, всё на виду" : "Выдвижная обувница: обувь не на полу шкафа",
    children: MESH.filter((i) => i.kind === kind).map((i) => ({ id: "add-mesh-" + i.id, label: i.label, icon: MESH_ICON[kind], hint: `Нужен проём ${i.reqW}×${i.reqD} мм внутри · Лемана Про, арт. ${i.art}`, run: () => ops.drop("mesh", { meshId: i.id }) })),
  }));
  const pullouts = sec.pullouts ?? 0;
  const filling: RadialItem[] = [
    // Шесть пунктов (кольцо из восьми с длинными подписями налезало): вешалки — своим подменю; длинная подпись — справа сверху.
    fill("shelf", "Полку", Rows3, "На высоте клика, а не по сетке серийного шкафа"),
    { id: "add-split", label: "Перегородку", icon: Columns2, disabled: corner || mod.sections.length >= RULES.maxSections, hint: "Делит секцию — шкаф под ваши вещи, а не типовой", run: ops.split },
    { id: "mesh", label: "Сетку", icon: ShoppingBasket, disabled: corner, hint: "Корзины, брючницы, обувницы — в серийке их нет", children: meshKinds },
    fill("drawer", "Ящик", Archive, "Под вашу высоту; направляющие с доводчиком или push"),
    { id: "hangers", label: "Вешалки", icon: Shirt, disabled: rodOff && corner, hint: "Штанга, пантограф, тремпель — на удобной высоте", children: [
    fill("rod", "Штангу", Shirt, "На нужной вам высоте — под пальто или рубашки", { disabled: rodOff }),
    sec.pantograph
      ? { id: "add-pantograph", label: "Пантограф", icon: ArrowDownToLine, active: true, hint: "Уже стоит — нажмите, чтобы снять", run: () => ops.modify((n) => { const s = section(n); s.pantograph = false; s.rod = false; }) }
      : fill("pantograph", "Пантограф", ArrowDownToLine, "Штанга опускается к вам — верх до потолка в деле", { disabled: corner }),
    { id: "pullouts", label: "Тремпель", icon: Shirt, active: pullouts > 0, disabled: corner, hint: "Вешалка выезжает вперёд — неглубокий шкаф без потерь", children: [0, 1, 2, 3].map((k) => ({
      id: "pullouts-" + k, label: k ? k + " шт" : "Без тремпеля", icon: Shirt, active: pullouts === k, hint: k ? `Тремпелей в ряд по ширине секции: ${k}` : "Убрать выдвижные тремпели", run: () => ops.modify((n) => { const s = section(n); if (k) s.pullouts = k; else delete s.pullouts; }) })) },
    ] },
    fill("shelf", "Стекло", PanelTop, "Стеклянная полка 6 мм — витрина; цену уточнит менеджер", { glass: true, disabled: corner }),
  ];
  const upgrades: RadialItem[] = [
    { id: "add-light", label: allStandsLit(mod) ? "Убрать подсветку" : "Подсветку", icon: Lightbulb, active: allStandsLit(mod), hint: allStandsLit(mod) ? "Снять LED-подсветку в стойках" : "LED в стойках на всю высоту — у серийки света нет", run: () => ops.modify((n) => setAllStands(n, !allStandsLit(n))) },
    { id: "add-push", label: mod.doorOpen === "push" ? "С ручками" : "Открывание нажатием", icon: MousePointerClick, active: mod.doorOpen === "push", disabled: !mod.doors, hint: mod.doorOpen === "push" ? "Вернуть ручки на распашные фасады" : "Push-to-open: фасады без ручек, открываются касанием", run: () => ops.modify((n) => { if (n.doorOpen === "push") delete n.doorOpen; else n.doorOpen = "push"; }) },
    { id: "add-hidden-fastening", label: mod.fastening === "eccentric" ? "Евровинты" : "Скрытый крепёж", icon: Lock, active: mod.fastening === "eccentric", hint: mod.fastening === "eccentric" ? "Вернуть видимый крепёж — конфирматы" : "Эксцентрики вместо евровинтов: снаружи нет шляпок", run: () => ops.modify((n) => { if (n.fastening === "eccentric") delete n.fastening; else n.fastening = "eccentric"; }) },
  ];
  return { ...base, hint: "Наполнение секции и улучшения корпуса", children: [
    { id: "fill-items", label: "В секцию", icon: Rows3, hint: "Наполнение: полки, ящики, вешалки, сетки, перегородка", children: filling },
    { id: "fill-upgrades", label: "Улучшения", icon: Sparkles, hint: "Подсветка, открывание нажатием, скрытый крепёж", children: upgrades },
  ] };
}
