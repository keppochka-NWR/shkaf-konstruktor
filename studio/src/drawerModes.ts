// Ящики секции (fix-drawers, правки Макса 29.10.2026): число ящиков с пересчётом расстановки «по правилу», выкатной ящик на всю
// секцию (антресоль) и переключатель «ящики в накладку / за дверью». Только правки модели — те же для панели справа и меню правой
// кнопки; геометрию строит parts() (model.ts), цены — смета по деталям (направляющие комплектами на ящик — guideKits).
import { boxes, drawerConfig, drawersFillRoof, drawersToRoof, evenDrawerConfigs, hasDrawerCap, isAutoDrawerLayout, rearClear, RULES, type Module, type Section } from "./model";
import { SLIDES, type DrawerConfig } from "./hardware";

const sectionOf = (m: Module, sid: string) => { const s = m.sections.find((x) => x.id === sid); if (!s) throw Error("Выберите секцию."); return s; };

/** Ящики «до крыши» без полки над ними (комод, выкатной ящик антресоли), расставленные по правилу: при смене числа ящиков
 *  они снова делятся на всю высоту проёма. Один ящик (в т.ч. с фасадом на весь проём) — тоже. */
export function roofDrawers(m: Module, s: Section): boolean {
  if (!(s.drawers > 0) || m.kitchen || m.raw || m.corner || m.kupe || s.shelves.length || s.rod || s.pantograph) return false;
  if (s.drawerConfigs?.some((c) => c.mesh || c.tray || c.noFacade)) return false;
  return (s.drawers === 1 || isAutoDrawerLayout(m, s)) && !hasDrawerCap(m, s) && drawersFillRoof(m, s);
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
  const roof = roofDrawers(m, s), auto = isAutoDrawerLayout(m, s);
  const cs = Array.from({ length: s.drawers }, (_, j) => ({ ...drawerConfig(m, s, j) }));
  if (c < s.drawers) {
    s.drawers = c;
    if (!c) { delete s.drawerConfigs; return; }
    s.drawerConfigs = cs.slice(0, c);
    if (roof) s.drawerConfigs = drawersToRoof(m, s);
    else if (auto) relayoutDrawers(m, s);
    return;
  }
  if (!roof) throw Error("Ящики не до крыши: новый ящик ставится поверх стопки.");
  const { y: _y, facadeH: _f, ...last } = cs[cs.length - 1]; void _y; void _f;
  s.drawerConfigs = [...cs, ...Array.from({ length: c - s.drawers }, () => ({ ...last }))];
  s.drawers = c;
  s.drawerConfigs = drawersToRoof(m, s);
}

/** Направляющая, которая встаёт по глубине (за дверью нужно на 19 мм больше места спереди): самая длинная из ряда системы не длиннее доступного. */
function fitLength(m: Module, s: Section, c: DrawerConfig): DrawerConfig {
  if (c.mesh) return c;
  const free = m.depth - rearClear(m) - (m.doors && !s.externalDrawers ? 44 : 25), ls = [...SLIDES[c.slide].lengths].sort((a, b) => b - a);
  return c.length <= free ? c : { ...c, length: ls.find((l) => l <= free) ?? ls[ls.length - 1] };
}

/** «Ящики в накладку / за дверью» (правка 3, 29.10.2026): в накладку — фасады ящиков в плоскости распашных дверей, дверь секции
 *  укорачивается и начинается над ящиками через обычный зазор фасадов (externalDrawerBoundary), петли — по новой высоте двери;
 *  за дверью — как было (вкладные фасады ящиков за дверью, фальши у петель). Расстановка «по правилу» пересчитывается: в накладку —
 *  равные фасады (нижний опускается на цоколь), за дверью — поровну по шагу; стопка ящиков и полка над ними не двигаются. */
export function setDrawersOverlay(m: Module, sid: string, on: boolean): void {
  const s = sectionOf(m, sid);
  const auto = isAutoDrawerLayout(m, s), stack = s.drawers > 0 ? Array.from({ length: s.drawers }, (_, j) => drawerConfig(m, s, j)) : [];
  const top = stack.reduce((a, c) => a + c.height + RULES.drawerStep, 0);
  if (on) { s.externalDrawers = true; delete s.drawerMount; } else delete s.externalDrawers;
  if (!s.drawers) return;
  if (s.drawerConfigs) s.drawerConfigs = s.drawerConfigs.slice(0, s.drawers).map((c) => fitLength(m, s, c));
  if (!auto) return;
  if (on) { relayoutDrawers(m, s); return; }
  // за дверью фасады по шагу — равные шаги на ту же высоту стопки
  const n = s.drawers, pitch = Math.floor((top / n) * 2) / 2;
  s.drawerConfigs = stack.map((c, j) => fitLength(m, s, { ...c, height: (j < n - 1 ? pitch : top - pitch * (n - 1)) - RULES.drawerStep, y: j * pitch }));
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
  delete s.drawerMount; delete s.drawerGrip; delete s.doorSplit; delete s.doorNiche; delete s.removedDoors;
  if (m.doors) s.externalDrawers = true;
  const { y: _y, facadeH: _f, ...base } = drawerConfig(m, { ...s, drawerConfigs: undefined }, 0); void _y; void _f;
  s.drawerConfigs = [fitLength(m, s, base)];
  const h = b.top - b.bottom;
  if (h - RULES.drawerStep < 68) throw Error(`Секция ${Math.round(h)} мм — ящику нужно от ${68 + RULES.drawerStep} мм по высоте.`);
  if (h - (s.drawerGap ?? RULES.drawerFrontGap) > 800) throw Error(`Секция ${Math.round(h)} мм — фасад ящика выше 800 мм не делаем. Для высокой секции — несколько ящиков.`);
  s.drawerConfigs = drawersToRoof(m, s);
}
