/* Движок правил: валидации вставки и предупреждения.
   Фальши больше не хранятся - вычисляются в model.js (fillerPanels). */

function canInsert(project, mod, item) {
  const inner = innerBox(project, mod);
  const sides = hingeSidesOf(mod);
  const availW = inner.w - sides.length * CONST.drawerFiller;

  if (item.type === "drawers") {
    const s = SLIDES[item.slide];
    if (availW < s.minInnerW) {
      return { ok: false,
        reason: "Для направляющих " + s.label + " нужно " + s.minInnerW +
          " мм внутренней ширины" + (sides.length ? " (с учётом фальшей под фасадом)" : "") +
          ", сейчас " + Math.round(availW) + ".",
        suggestW: s.minInnerW + (mod.w - availW) };
    }
    if (availW > s.maxInnerW) {
      return { ok: false,
        reason: "Секция шире " + s.maxInnerW + " мм: ящик на " + s.label +
          " провиснет. Сузьте модуль или добавьте перегородку (следующая версия)." };
    }
    const zoneH = item.count * (item.boxH + CONST.drawerStep);
    if (zoneH > inner.h) {
      return { ok: false,
        reason: "Секция ящиков " + Math.round(zoneH) + " мм выше проёма " +
          Math.round(inner.h) + ". Уменьшите количество или высоту ящиков." };
    }
  }

  if (item.type === "mesh") {
    const mesh = meshCatalog().find(x => x.id === item.meshId);
    if (!mesh) return { ok: false, reason: "Элемент не найден в каталоге." };
    if (modDepth(project, mod) - 5 < mesh.reqD) {
      return { ok: false,
        reason: "Глубина модуля мала: для «" + mesh.label + "» нужно от " + mesh.reqD + " мм." };
    }
    if (availW < mesh.reqW) {
      return { ok: false,
        reason: "«" + mesh.label + "» требует " + mesh.reqW + " мм внутренней ширины, доступно " +
          Math.round(availW) + ".",
        suggestW: mesh.reqW + (mod.w - availW) };
    }
    if (availW > mesh.reqW + 4) {
      return { ok: true,
        note: "Секция шире технички «" + mesh.label + "» на " + Math.round(availW - mesh.reqW) +
          " мм: добавится фальш-проставка до требуемой ширины." };
    }
  }

  if (item.type === "rod") {
    if (inner.h < CONST.rod.minSectionH) {
      return { ok: false, reason: "Под штангу нужно от " + CONST.rod.minSectionH + " мм высоты секции." };
    }
  }
  return { ok: true };
}

function moduleWarnings(project, mod) {
  const w = [];
  const m = CONST.module;
  const inner = innerBox(project, mod);
  if (mod.w < m.minW || mod.w > m.maxW) w.push("Ширина модуля вне " + m.minW + "-" + m.maxW + " мм.");
  if (mod.h < m.minH || mod.h > m.maxH) w.push("Высота модуля вне " + m.minH + "-" + m.maxH + " мм.");
  const d = modDepth(project, mod);
  if (d < m.minD || d > m.maxD) w.push("Глубина модуля вне " + m.minD + "-" + m.maxD + " мм.");

  if (mod.facade.system === "hinge") {
    for (const f of facadeSizes(project, mod)) {
      if (f.w > CONST.facade.maxHingeW)
        w.push("Фасад " + Math.round(f.w) + " мм шире " + CONST.facade.maxHingeW + ": тяжёлый, петли перегружены.");
      if (f.w < CONST.facade.minW)
        w.push("Фасад уже " + CONST.facade.minW + " мм: неудобное открывание.");
    }
  }
  const adj = mod.items.filter(i => i.type === "shelf_adj");
  if (adj.length && inner.w > CONST.shelfMaxSpan)
    w.push("Пролёт съёмной полки " + Math.round(inner.w) + " мм: провиснет, нужна жёсткая или перегородка.");

  const spans = mod.items.map(it => {
    const z = itemZone(it);
    return { it: it, y1: z.y1, y2: z.y2 };
  }).sort((a, b) => a.y1 - b.y1);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].y1 < spans[i - 1].y2 - 1) { w.push("Наполнение пересекается по высоте."); break; }
  }
  for (const s of spans) {
    if (s.y2 > inner.h + 1) { w.push("Элемент выходит за верх секции."); break; }
  }
  return w;
}

function projectWarnings(project) {
  const w = [];
  const baseW = rowWidth(project, "base");
  const upperW = rowWidth(project, "upper");
  const fitW = project.room.w - 2 * CONST.room.sideGap;
  if (baseW > fitW) w.push("Нижний ряд " + baseW + " мм шире стены с зазорами (" + fitW + ").");
  if (upperW > fitW) w.push("Верхний ряд шире стены с зазорами.");
  const maxBaseH = project.modules.filter(m => m.kind === "base")
    .reduce((s, m) => Math.max(s, m.h), 0);
  if (maxBaseH > project.room.h - CONST.room.topGap)
    w.push("Модули выше потолка минус зазор " + CONST.room.topGap + " мм: шкаф не занести.");
  const upTop = project.modules.filter(m => m.kind === "upper")
    .reduce((s, m) => Math.max(s, project.upperY + m.h), 0);
  if (upTop > project.room.h - CONST.room.topGap)
    w.push("Верхний ряд упирается в потолок: опустите ряд или уменьшите высоту.");
  return w;
}
