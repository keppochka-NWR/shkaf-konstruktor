// Малые корпуса (волна 29.10, правка Макса «убрать ограничения размеров на минимальную ширину и высоту до 100 мм»): корпус, модуль
// и секция — от 100 мм (RULES.minW/minH/minSection, KITCHEN.minWidth). Размер не запрещается из-за наполнения: то, что в малый корпус
// физически не входит, снимается с сообщением менеджеру (сообщение, не ошибка):
//  — цоколь/опоры: внутри корпуса не остаётся проёма (корпус ниже цоколя + дно + крыша + 68);
//  — распашные двери: фасад ниже предела створки (шкафы RULES.doorMinH 360 — правило цеха, кухня 200) — петли не встают;
//  — ящики: проём уже 250 (правило направляющих) — снимаются; не помещаются по высоте — по одному, пока не встанут;
//  — штанга (под ней нужен просвет), пантограф (545–910 × 1100), выдвижной тремпель (глубина 270);
//  — полки: в проёме не встаёт ни одна полка (80 над и под полкой);
//  — перегородки: секции уже 100 мм по корпусу — корпус одной секцией.
// Вызывается: палитра (paletteBuild.assembleModule) и смена ширины/высоты модуля (App modify). Кухни из Базиса, купе, угловой шкаф,
// стол, столешница, сырые модули — не трогаются (у них свои пределы).
import { validate, facadeTop, facadeBottom, innerTop, innerBottom, plinth, boxes, distribute, RULES, type Module, type Section } from "./model";

const clearShelves = (s: Section) => { s.shelves = []; delete s.fixed; delete s.glassShelves; delete s.thickShelves; delete s.shelfLights; delete s.shelfAt; };
const clearRod = (s: Section) => { s.rod = false; delete s.rodAt; delete s.rodLower; delete s.rodClearance; };
const clearDrawers = (s: Section) => { s.drawers = 0; delete s.drawerConfigs; delete s.drawerCap; delete s.drawerGrip; delete s.drawerGap; delete s.externalDrawers; };

/** Модуль, к которому применяется правило малых размеров. */
export function smallSizeApplies(m: Module): boolean {
  return !m.kupe && !m.raw && !m.worktop && !m.corner && !m.casework && !m.desk && !m.bazis && !m.sectionLayout;
}

/** Снять наполнение, которое в корпус этого размера не входит. Меняет m; возвращает сообщения (пусто — ничего не снято). */
export function fitSmallModule(m: Module): string[] {
  if (!smallSizeApplies(m)) return [];
  const notes: string[] = [];
  const t = RULES.panel;
  // 1) цоколь: внутри не остаётся проёма секции (68 = 100 по корпусу − 2 × 16). Опоры кухни не снимаются: нижний кухонный — на опорах
  //    (kitchenErrors), его предел высоты — опоры + 100 (minHeightOf)
  if (!m.feet && plinth(m) > 0 && innerTop(m) - innerBottom(m) < RULES.minSection) {
    m.plinthHeight = 0; notes.push(`Цоколь снят: в корпусе ${m.height} мм над цоколем не остаётся проёма.`);
  }
  // 2) перегородки: секция уже 100 мм по корпусу — одна секция
  if (m.sections.length > 1 && boxes(m).some((b) => b.width < RULES.minSection)) {
    const first = m.sections[0];
    m.sections = [{ ...first, weight: 1 }];
    notes.push(`Перегородки сняты: при ширине ${m.width} мм секция уже ${RULES.minSection + 2 * t} мм по корпусу — корпус одной секцией.`);
  }
  // 3) распашные двери: фасад ниже предела створки — петли не встают
  const doorMin = m.kitchen ? 200 : RULES.doorMinH;
  if (m.doors && facadeTop(m) - facadeBottom(m) < doorMin) {
    m.doors = false;
    notes.push(`Двери сняты: распашной фасад ${Math.round(facadeTop(m) - facadeBottom(m))} мм ниже ${doorMin} мм${m.kitchen ? "" : " (правило цеха)"} — петли не встают.`);
  }
  // 4) наполнение секций — по ошибкам проверки этой секции (тексты validate)
  const moved = new Set<string>();
  for (let round = 0; round < 6; round++) {
    const errs = validate(m);
    let changed = false;
    m.sections.forEach((s, i) => {
      const pre = `Секция ${i + 1}: `, has = (re: RegExp) => errs.some((e) => e.startsWith(pre) && re.test(e.slice(pre.length)));
      const where = m.sections.length > 1 ? ` в секции ${i + 1}` : "";
      if (s.drawers > 0 && has(/^для ящиков нужно/)) { clearDrawers(s); notes.push(`Ящики сняты${where}: ящику нужно от 250 мм внутри (направляющие) и глубина под направляющую.`); changed = true; return; }
      if (s.drawers > 0 && has(/^ящики не помещаются по высоте/)) {
        const n = s.drawers - 1;
        if (n <= 0) { clearDrawers(s); notes.push(`Ящики сняты${where}: по высоте не помещается ни один.`); }
        else { s.drawers = n; if (s.drawerConfigs) s.drawerConfigs = s.drawerConfigs.slice(0, n); if (!validate(m).some((e) => e.startsWith(pre + "ящики не помещаются"))) notes.push(`Ящиков${where} оставлено ${n}: больше по высоте не помещается.`); }
        changed = true; return;
      }
      if (s.pantograph && has(/^пантографу нужен/)) { s.pantograph = false; notes.push(`Пантограф снят${where}: ему нужен проём 545–910 × 1100 мм.`); changed = true; return; }
      if (s.pullouts && has(/^выдвижному тремпелю/)) { delete s.pullouts; notes.push(`Выдвижной тремпель снят${where}: нужна внутренняя глубина от 270 мм.`); changed = true; return; }
      if (s.rod && has(/^под штангой нужно|^измените высоту штанги/)) { clearRod(s); notes.push(`Штанга снята${where}: под ней нужен просвет для одежды.`); changed = true; return; }
      if (s.shelves.length && has(/^между поверхностями полок/)) {
        const b = boxes(m)[i], h = b ? b.top - b.bottom : 0, fits = Math.floor((h - RULES.shelfMinClear) / (RULES.panel + RULES.shelfMinClear));
        // ни одна полка не встаёт — снимаем все; иначе — столько, сколько встаёт, поровну (правило размеров, не положение полок менеджера)
        if (fits <= 0) { clearShelves(s); notes.push(`Полки сняты${where}: в проёме ${Math.round(h)} мм полка не встаёт (по 80 мм над и под ней).`); changed = true; }
        else if (fits < s.shelves.length) { const n = fits; clearShelves(s); s.shelves = distribute(m, s, n); notes.push(`Полок${where} оставлено ${n}: больше в проём ${Math.round(h)} мм не встаёт.`); changed = true; }
        // полки встают, но после смены размера упёрлись в дно/крышу (положение — доля высоты): поровну, число и номера те же
        else if (!moved.has(s.id)) { s.shelves = distribute(m, s, s.shelves.length); moved.add(s.id); notes.push(`Полки${where} расставлены поровну по новой высоте.`); changed = true; }
      }
    });
    if (!changed) break;
  }
  return [...new Set(notes)];
}
