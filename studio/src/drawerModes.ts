// Ящики секции (fix-drawers, правки Макса 29.10.2026): число ящиков с пересчётом расстановки «по правилу», выкатной ящик на всю
// секцию (антресоль) и переключатель «ящики в накладку / за дверью». Только правки модели — те же для панели справа и меню правой
// кнопки; геометрию строит parts() (model.ts), цены — смета по деталям (направляющие комплектами на ящик — guideKits).
import { aluDrawerFronts, boxes, doorBands, drawerConfig, drawerOffsets, drawersFillRoof, drawersFlushBlock, drawerStackHeight, drawersToRoof, evenDrawerConfigs, facadeBottom, facadeTop, fb, fe, hasDrawerCap, isAutoDrawerLayout, nicheDrawers, parts, rearClear, RULES, type Module, type Section } from "./model";
import { SLIDES, type DrawerConfig } from "./hardware";
import { rescaleDoorRows } from "./doorRows";
import { alignDrawersToRow } from "./drawerRowAlign";
import { drawersUnderMansard } from "./mansardFit";
import { fitDrawerIds } from "./partIds";

const sectionOf = (m: Module, sid: string) => { const s = m.sections.find((x) => x.id === sid); if (!s) throw Error("Выберите секцию."); return s; };

/** Ящики «до крыши» без полки над ними (комод, выкатной ящик антресоли), расставленные по правилу: при смене числа ящиков
 *  они снова делятся на всю высоту проёма. Один ящик (в т.ч. с фасадом на весь проём) — тоже. */
export function roofDrawers(m: Module, s: Section): boolean {
  return (s.drawers === 1 || isAutoDrawerLayout(m, s)) && roofColumn(m, s);
}
/** Ящики закрывают проём до крыши без полки над ними — по правилу или с высотой фасада/короба, заданной полем (круг 2 критика 29.10).
 *  Число ящиков у такой секции («+/−», поле «Ящиков в секции», удаление ящика) — снова поровну на весь проём: иначе «−» оставлял
 *  щель/открытую нишу сверху (800×1000: 2 ящика, фасад 452,5 полем, «−» → фасад 30…482,5 и ниша 515 мм), а «+» отказывал
 *  «Ящики не до крыши». Зазор между фасадами (setDrawerGap) пересчитывает только расстановку по правилу (roofDrawers). */
export function roofColumn(m: Module, s: Section): boolean {
  if (!(s.drawers > 0) || m.kitchen || m.raw || m.corner || m.kupe || s.shelves.length || s.rod || s.pantograph) return false;
  if (s.drawerConfigs?.some((c) => c.mesh || c.tray || c.noFacade)) return false;
  return !hasDrawerCap(m, s) && drawersFillRoof(m, s);
}

/** Пересчитать ящики секции на равные накладные фасады (расстановка «по правилу» или по кнопке «Фасады поровну»). */
export function relayoutDrawers(m: Module, s: Section): void {
  const e = evenDrawerConfigs(m, s, true);
  if (e) s.drawerConfigs = e;
}

/** Число ящиков секции (счётчик «Ящики» панели, поле «Ящиков в секции», меню). Комод и ящики до крыши — снова поровну на весь
 *  проём; ящики по правилу — равные фасады; заданные вручную — как раньше (лишние сверху убираются). Добавление в секцию, где ящики
 *  не до крыши, — через insertItem (новый ящик поверх стопки), здесь — ошибка. */
export function setDrawerCount(m: Module, sid: string, count: number): void {
  const s = sectionOf(m, sid), c = Math.max(0, Math.min(RULES.maxDrawers, Math.round(count)));
  if (c === s.drawers) return;
  const roof = roofColumn(m, s), auto = isAutoDrawerLayout(m, s);
  const cs = Array.from({ length: s.drawers }, (_, j) => ({ ...drawerConfig(m, s, j) }));
  // критик 29.10 (блокер 3): ящики до крыши — снова РАВНЫЕ фасады на всю высоту проёма (drawersToRoof → roofEvenLayout); не встают
  // равными (фасад выше 800, нижнему коробу мало места) — ошибка с причиной, секция не меняется (раньше: щель без фасада сверху)
  if (c < s.drawers) {
    if (!c) { s.drawers = 0; delete s.drawerConfigs; fitDrawerIds(s); return; }
    const t: Section = { ...s, drawers: c, drawerConfigs: cs.slice(0, c) };
    if (roof) t.drawerConfigs = drawersToRoof(m, t);
    else if (auto) relayoutDrawers(m, t);
    settle(m, s, c, t.drawerConfigs);
    return;
  }
  if (!roof) throw Error("Ящики не до крыши: новый ящик ставится поверх стопки.");
  const { y: _y, facadeH: _f, ...last } = cs[cs.length - 1]; void _y; void _f;
  const t: Section = { ...s, drawers: c, drawerConfigs: [...cs, ...Array.from({ length: c - s.drawers }, () => ({ ...last }))] };
  t.drawerConfigs = drawersToRoof(m, t);
  settle(m, s, c, t.drawerConfigs);
}
/** Новое число ящиков секции; у мансардного шкафа (круг 3 критика 29.10) — ящики под скос (короба ниже, фасады те же) или отказ с
 *  причиной, секция прежняя: «+/−» после «Опустить полки под скос» больше не уводят ящики снова в крышу. */
function settle(m: Module, s: Section, c: number, configs: Section["drawerConfigs"]): void {
  const was = { drawers: s.drawers, drawerConfigs: s.drawerConfigs, drawerIds: s.drawerIds };
  s.drawers = c; s.drawerConfigs = configs; fitDrawerIds(s); // id ящиков (partIds.ts): «−» снимает верхний — его id уходит, «+» — новый
  if (!m.mansard) return;
  try { drawersUnderMansard(m, s); } catch (e) { s.drawers = was.drawers; s.drawerConfigs = was.drawerConfigs; if (was.drawerIds) s.drawerIds = was.drawerIds; throw e; }
}

/** Зазор между фасадами ящиков, как он виден (по деталям): у равных фасадов до крыши с фасадами выше короба — шаг фасада (3 мм),
 *  иначе — настройка секции. Поле панели показывает его, а не умолчание (критик 29.10). */
export function drawerFaceGap(m: Module, s: Section): number {
  const set = s.drawerGap ?? (m.doors && !s.externalDrawers ? RULES.drawerFrontGap : RULES.faceGap);
  if (s.drawers < 2) return set;
  try {
    const f = parts(m).filter((p) => p.sectionId === s.id && /:drawer:\d+:facade$/.test(p.id)).map((p) => [p.position[1] - p.size[1] / 2, p.position[1] + p.size[1] / 2]).sort((a, b) => a[0] - b[0]);
    const gaps = f.slice(1).map((x, i) => Math.round((x[0] - f[i][1]) * 10) / 10);
    return gaps.length && gaps.every((g) => Math.abs(g - gaps[0]) < 0.06) && gaps[0] > 0 ? gaps[0] : set;
  } catch { return set; }
}
/** «Зазор между фасадами ящиков»: задать зазор секции; ящики до крыши по правилу — снова равные фасады с этим зазором. */
export function setDrawerGap(m: Module, sid: string, gap: number): void {
  const s = sectionOf(m, sid), roof = roofDrawers(m, s);
  const t: Section = { ...s, drawerGap: gap };
  if (roof) t.drawerConfigs = drawersToRoof(m, t);
  s.drawerGap = gap; if (roof) s.drawerConfigs = t.drawerConfigs;
  if (roof && m.mansard) drawersUnderMansard(m, s);
}

/** Направляющая, которая встаёт по глубине (за дверью нужно на 19 мм больше места спереди): самая длинная из ряда системы не длиннее доступного. */
function fitLength(m: Module, s: Section, c: DrawerConfig): DrawerConfig {
  if (c.mesh) return c;
  const free = m.depth - rearClear(m) - (m.doors && !s.externalDrawers ? 44 : 25), ls = [...SLIDES[c.slide].lengths].sort((a, b) => b - a);
  return c.length <= free ? c : { ...c, length: ls.find((l) => l <= free) ?? ls[ls.length - 1] };
}

/** «Фасад ящика вровень с распашными фасадами» (Макс 01.11; правка 3, 29.10.2026 «ящики в накладку»): фасады ящиков в плоскости распашных дверей,
 *  дверь секции укорачивается и начинается над ящиками через обычный зазор фасадов (externalDrawerBoundary), петли — по новой высоте двери;
 *  за дверью — как было (вкладные фасады ящиков за дверью, фальши у петель). Расстановка «по правилу» пересчитывается: вровень —
 *  равные фасады (нижний опускается на цоколь), за дверью — поровну по шагу; стопка ящиков и полка над ними не двигаются.
 *  Макс 01.11 «не могу сделать вровень»: у вкладных дверей и у рамки ALU прежняя галочка плоскость не совпадала — вкладная дверь: фасад ящика
 *  тоже вкладной; рамка: фасад ящика в той же рамке (20 мм), иначе лицо на 4 мм глубже; ряды секции — в той же пропорции на новую высоту двери. */
export function setDrawersOverlay(m: Module, sid: string, on: boolean): void {
  overlay(m, sid, on);
  // Макс 01.11: вровень — верх ящиков ещё и на ряду соседней секции (drawerRowAlign.ts); снято — привязки нет
  const s = sectionOf(m, sid);
  // критик 01.11: рамка, поставленная ради плоскости, снимается, когда на ящиках её больше не видно (иначе держала запрет на групповой цвет ящиков)
  if (!on) { delete s.drawersToRow; if (m.alu && m.aluDrawers && !aluDrawerFronts(m).length) delete m.aluDrawers; }
  else if (s.externalDrawers) { s.drawersToRow = true; alignDrawersToRow(m, s); }
}
/** Ниже ящиков, поднятых от дна, встаёт своя дверь: низ двери — по монтажу (вкладная — внутри проёма), верх — через зазор под фасадом ящика. */
const doorFloor = (m: Module, b: { bottom: number }) => m.doorMount === "inset" ? b.bottom + fe(m) : facadeBottom(m);
const doorBelowFits = (m: Module, s: Section, b: { bottom: number }, low: number) => b.bottom + low - doorFloor(m, b) - (s.doorGap ?? fb(m)) >= RULES.doorRowMinH;
/** Ряды вокруг поднятых ящиков (проём заказа 7442203): дверь снизу и дверь сверху, зазоры как между фасадами. Посадка фасада — как у двери. */
function fitNiche(m: Module, s: Section, b: { bottom: number }, low: number) {
  const g = s.doorGap ?? fb(m);
  s.doorSplit = b.bottom + low - doorFloor(m, b) - g / 2; s.doorNiche = drawerStackHeight(s) - low + g;
  delete s.externalDrawers; delete s.drawersToRow; delete s.removedDoors;
  if (m.doorMount === "inset") s.drawerMount = "inset"; else delete s.drawerMount;
  if (m.alu && m.doorMount !== "inset") m.aluDrawers = true;
}
const raisedOpen = (low: number) => `Ящики подняты на ${Math.round(low)} мм: снизу двери не встать (нужен ряд от ${RULES.doorRowMinH} мм), а при вкладных дверях фасад ящика вниз не тянется — зона под ящиками останется открытой. Опустите ящики на дно или поднимите выше.`;
function overlay(m: Module, sid: string, on: boolean): void {
  const s = sectionOf(m, sid);
  if (on) { const why = drawersFlushBlock(m, s); if (why) throw Error(why); }
  const auto = isAutoDrawerLayout(m, s), stack = s.drawers > 0 ? Array.from({ length: s.drawers }, (_, j) => drawerConfig(m, s, j)) : [];
  const top = stack.reduce((a, c) => a + c.height + RULES.drawerStep, 0);
  const whole = doorBands(m, { ...s, doorSplit: undefined, doorRows: undefined })[0], wasDoor = whole[1] - whole[0];
  // Макс 01.11: ящики подняты от дна на высоту двери — снизу своя дверь, над ящиками своя (тот же механизм, что проём заказа 7442203), иначе нижний
  // фасад растягивался бы до пола на всю высоту под ящиками. Ниже ряда doorRowMinH двери снизу не встать — фасад тянется к цоколю, как было.
  const low = s.drawers > 0 ? Math.min(...drawerOffsets(s)) : 0, b = boxes(m).find((x) => x.id === sid)!;
  // критик 01.11: и при уже разделённой секции (нижний фасад тянулся на 744 мм), и при вкладных дверях; вкладным нечем закрыть низ — отказ с причиной
  if (on && low > 0.5 && doorBelowFits(m, s, b, low)) {
    if (!nicheDrawers(m, s)) delete s.doorRows;
    fitNiche(m, s, b, low);
    if (s.drawerConfigs) s.drawerConfigs = s.drawerConfigs.slice(0, s.drawers).map((c) => fitLength(m, s, c));
    return;
  }
  if (on && low > 0.5 && m.doorMount === "inset") throw Error(raisedOpen(low));
  // снять, когда ящики стоят между рядами (проём): дверь снова одна на секцию, ящики за ней
  if (!on && nicheDrawers(m, s)) { delete s.doorSplit; delete s.doorNiche; delete s.doorRows; delete s.removedDoors; }
  if (on) { s.externalDrawers = true; if (m.doorMount === "inset") s.drawerMount = "inset"; else delete s.drawerMount; if (m.alu && m.doorMount !== "inset") m.aluDrawers = true; }
  else { delete s.externalDrawers; if (m.doorMount === "inset") delete s.drawerMount; }
  rescaleDoorRows(m, s, wasDoor);
  if (!s.drawers) return;
  if (s.drawerConfigs) s.drawerConfigs = s.drawerConfigs.slice(0, s.drawers).map((c) => fitLength(m, s, c));
  if (!auto) return;
  if (on) { relayoutDrawers(m, s); return; }
  // за дверью фасады по шагу — равные шаги на ту же высоту стопки
  const n = s.drawers, pitch = Math.floor((top / n) * 2) / 2;
  s.drawerConfigs = stack.map((c, j) => fitLength(m, s, { ...c, height: (j < n - 1 ? pitch : top - pitch * (n - 1)) - RULES.drawerStep, y: j * pitch }));
}

/** «Монтаж фасадов» корпуса (панель и меню «Тип петли»): ящики вровень остаются вровень — фасад ящика уходит в проём вместе с дверью (Макс 01.11). */
export function setDoorMount(m: Module, mount: "overlay" | "inset"): void {
  if (mount === "inset") m.doorMount = "inset"; else delete m.doorMount;
  for (const s of m.sections) {
    if (!(s.drawers > 0) || !(s.externalDrawers || nicheDrawers(m, s))) continue;
    const b = boxes(m).find((x) => x.id === s.id)!, low = Math.min(...drawerOffsets(s));
    // критик 01.11: ящики между рядами — ряды заново под новый монтаж (иначе дверь 98…662 наезжала на фасад 596…774 без ошибки); поднятые снаружи — так же
    if (nicheDrawers(m, s) || (low > 0.5 && doorBelowFits(m, s, b, low))) { if (!nicheDrawers(m, s)) delete s.doorRows; fitNiche(m, s, b, low); continue; }
    if (low > 0.5 && mount === "inset") throw Error(raisedOpen(low));
    if (mount === "inset") s.drawerMount = "inset"; else { delete s.drawerMount; if (m.alu) m.aluDrawers = true; }
  }
}

/** «Выкатной ящик на всю секцию» (правка 2, 29.10.2026; антресоль): наполнение секции убирается, один ящик на всю высоту проёма —
 *  короб под высоту секции (до 300), фасад накладной на всю секцию вместо двери (у корпуса с дверями — «ящики в накладку», двери
 *  в секции нет), направляющие — самые длинные по глубине корпуса. В смете — комплект направляющих, короб и фасад ящика. */
export function fullSectionDrawer(m: Module, sid: string): void {
  const s = sectionOf(m, sid), b = boxes(m).find((x) => x.id === sid)!;
  if (m.kitchen || m.raw || m.kupe || m.corner || m.desk || m.worktop || m.casework) throw Error("Выкатной ящик на всю секцию ставится в шкафы и антресоли студии.");
  // как «Очистить наполнение» (clearSection): полки, штанга, пантограф, тремпели, отметки полок
  s.shelves = []; s.rod = false;
  for (const k of ["pantograph", "rodAt", "rodLower", "pullouts", "glassShelves", "thickShelves", "fixed", "shelfLight", "shelfLights", "shelfDepth"] as const) delete s[k];
  s.drawers = 1; s.drawerCap = false;
  delete s.drawerMount; delete s.drawerGrip; delete s.doorSplit; delete s.doorNiche; delete s.doorRows; delete s.removedDoors; delete s.drawersToRow;
  if (m.doors) s.externalDrawers = true;
  const { y: _y, facadeH: _f, ...base } = drawerConfig(m, { ...s, drawerConfigs: undefined }, 0); void _y; void _f;
  s.drawerConfigs = [fitLength(m, s, base)];
  const h = b.top - b.bottom, face = fullDrawerFacadeH(m, sid);
  if (h - RULES.drawerStep < 68) throw Error(`Секция ${Math.round(h)} мм — ящику нужно от ${68 + RULES.drawerStep} мм по высоте.`);
  // критик 29.10 (п.7): правило «фасад ящика не выше 800» — по высоте ФАСАДА (на всю секцию: от низа до верха фасадов), а не проёма
  if (face > 800) throw Error(`Фасад ящика на всю секцию выйдет ${Math.round(face)} мм — выше 800 мм не делаем. Для высокой секции — несколько ящиков.`);
  s.drawerConfigs = drawersToRoof(m, s);
}
/** Высота фасада «выкатного ящика на всю секцию»: накладной фасад от низа фасадов (на цоколе — 30 мм от пола) до верха фасадов. */
export function fullDrawerFacadeH(m: Module, sid: string): number {
  const b = boxes(m).find((x) => x.id === sid);
  return b ? facadeTop(m) - Math.min(facadeBottom(m), b.bottom) : Infinity;
}
