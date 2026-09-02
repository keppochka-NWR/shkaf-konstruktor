/* Движок правил: валидации, авто-фальши, предупреждения.
   Каждое правило возвращает предупреждения или молча правит проект (авто-правила). */

/* авто-правило: выкатные ящики за распашным фасадом требуют фальш по стороне петель */
function applyDrawerFillers(mod) {
  const hasDrawers = mod.items.some(it => it.type === "drawer" || it.type === "mesh");
  const f = mod.facade;
  let left = 0, right = 0;
  if (hasDrawers && f.system === "hinge") {
    if (f.doors === 1) {
      if (f.side === "left") left = CONST.drawerFiller;
      else right = CONST.drawerFiller;
    } else {
      left = CONST.drawerFiller;
      right = CONST.drawerFiller;
    }
  }
  const changed = mod.fillers.left !== left || mod.fillers.right !== right;
  mod.fillers.left = left;
  mod.fillers.right = right;
  return changed;
}

/* проверка вставки элемента; возвращает { ok, reason, suggestW } */
function canInsert(project, mod, item) {
  const inner = innerBox(project, mod);
  if (item.type === "drawer") {
    const s = SLIDES[item.slide];
    if (inner.w < s.minInnerW) {
      return { ok: false,
        reason: "Секция уже " + s.minInnerW + " мм: направляющие " + s.label + " не встанут.",
        suggestW: s.minInnerW + (mod.w - inner.w) };
    }
    if (inner.w > s.maxInnerW) {
      return { ok: false,
        reason: "Секция шире " + s.maxInnerW + " мм: ящик на " + s.label + " провиснет. Сузьте модуль или добавьте перегородку (следующая версия)." };
    }
  }
  if (item.type === "mesh") {
    const mesh = meshCatalog().find(x => x.id === item.meshId);
    if (!mesh) return { ok: false, reason: "Элемент не найден в каталоге." };
    if (project.depth - 5 < mesh.reqD) {
      return { ok: false, reason: "Глубина шкафа мала: для «" + mesh.label + "» нужно от " + mesh.reqD + " мм." };
    }
    if (inner.w < mesh.reqW) {
      // главное правило Max: предлагаем расширить модуль до требуемой ширины
      return { ok: false,
        reason: "«" + mesh.label + "» требует " + mesh.reqW + " мм внутренней ширины, сейчас " + Math.round(inner.w) + ".",
        suggestW: mesh.reqW + (mod.w - inner.w) };
    }
    if (inner.w > mesh.reqW + 40) {
      return { ok: true,
        note: "Секция шире технички «" + mesh.label + "» на " + Math.round(inner.w - mesh.reqW) + " мм: добавим фальш до требуемой ширины.",
        fillerAdd: Math.round(inner.w - mesh.reqW) };
    }
  }
  if (item.type === "rod") {
    if (inner.h < CONST.rod.minSectionH) {
      return { ok: false, reason: "Под штангу нужно от " + CONST.rod.minSectionH + " мм высоты секции." };
    }
  }
  return { ok: true };
}

/* предупреждения по модулю и проекту (не блокируют, подсвечивают) */
function moduleWarnings(project, mod) {
  const w = [];
  const m = CONST.module;
  const inner = innerBox(project, mod);
  if (mod.w < m.minW || mod.w > m.maxW) w.push("Ширина модуля вне 250-1200 мм.");
  if (mod.h < m.minH || mod.h > m.maxH) w.push("Высота модуля вне 300-2200 мм.");
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
  // пересечения наполнения по высоте
  const spans = mod.items.map(it => {
    const h = it.type === "drawer" ? it.boxH + 20
      : it.type === "mesh" ? ((meshCatalog().find(x => x.id === it.meshId) || {}).h || 150) + 20
      : it.type === "rod" ? 60 : CONST.panel;
    return { it: it, y1: it.y, y2: it.y + h };
  }).sort((a, b) => a.y1 - b.y1);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].y1 < spans[i - 1].y2) { w.push("Наполнение пересекается по высоте."); break; }
  }
  for (const s of spans) {
    if (s.y2 > inner.h) { w.push("Элемент выходит за верх секции."); break; }
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
