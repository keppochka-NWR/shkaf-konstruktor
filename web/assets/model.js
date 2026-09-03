/* Модель проекта и деталировка. Вся геометрия в миллиметрах.

   v2: цоколь редактируется (project.plinthH), у модуля своя глубина (mod.depth,
   null = общая), ящики добавляются секциями (type "drawers", count штук),
   фальши не хранятся - вычисляются: панель 16 мм торцом на стойку по стороне
   петель, ТОЛЬКО в зоне выкатного элемента (правило Max).
*/

let _seq = 1;
function uid() { return "m" + (_seq++) + "_" + Date.now().toString(36); }

function newProject() {
  return {
    v: 2,
    name: "Шкаф",
    room: { w: 3000, h: 2500 },
    depth: 600,
    plinthH: CONST.plinthH,
    back: "lhdf",
    bodyDecor: "Белый",
    facadeDecor: "Белый",
    upperY: 2000,
    markup: CONST.pricing.markup,
    modules: [],
  };
}

function newModule(kind) {
  const m = CONST.module;
  return {
    id: uid(),
    kind: kind,                          // base | upper
    w: m.defaultW,
    h: kind === "base" ? m.defaultBaseH : m.defaultUpperH,
    depth: null,                         // null = глубина проекта
    standLight: false,                   // подсветка врезная в обеих стойках
    items: [],
    facade: {
      system: "none",                    // none | hinge | coupe(следующий этап)
      doors: 2,
      side: "left",
      opening: "handle",
      handleId: null,
      decor: null,
    },
  };
}

function newItem(type, opts) {
  opts = opts || {};
  const base = { id: uid(), type: type, y: 300 };
  if (type === "drawers") {
    base.count = 3;
    base.boxH = 150;
    base.slide = "ball";
    base.y = 0;
  }
  if (type === "mesh") {
    base.meshId = opts.meshId || (meshCatalog()[0] || {}).id;
    base.y = 0;
  }
  return base;
}

/* миграция старых проектов */
function migrateProject(p) {
  if (!p) return p;
  if (p.plinthH == null) p.plinthH = CONST.plinthH;
  if (p.markup == null) p.markup = CONST.pricing.markup;
  if (p.edgeBody === undefined) p.edgeBody = "";
  for (const m of p.modules || []) {
    if (m.depth === undefined) m.depth = null;
    if (m.standLight === undefined) m.standLight = false;
    delete m.fillers;
    for (const it of m.items || []) {
      if (it.type === "drawer") { it.type = "drawers"; it.count = 1; }
      if (it.type === "drawers" && it.count == null) it.count = 1;
    }
  }
  p.v = 2;
  return p;
}

/* ---------- геометрия ---------- */

function modDepth(project, mod) { return mod.depth || project.depth; }
function plinthOf(project, mod) { return mod.kind === "base" ? (project.plinthH || CONST.plinthH) : 0; }

function moduleX(project, mod) {
  let x = 0;
  for (const m of project.modules) {
    if (m.kind !== mod.kind) continue;
    if (m.id === mod.id) return x;
    x += m.w;
  }
  return x;
}

function rowWidth(project, kind) {
  return project.modules.filter(m => m.kind === kind).reduce((s, m) => s + m.w, 0);
}

function moduleY(project, mod) {
  return mod.kind === "base" ? 0 : project.upperY;
}

/* внутренний проём секции (без учёта фальшей - они зонные) */
function innerBox(project, mod) {
  const t = CONST.panel;
  const plinth = plinthOf(project, mod);
  return {
    w: mod.w - 2 * t,
    h: mod.h - plinth - 2 * t,
    d: modDepth(project, mod) - (project.back === "ldsp" ? CONST.panel : 0),
    x0: t,
    y0: plinth + t,
  };
}

/* стороны, где стоят петли распашного фасада */
function hingeSidesOf(mod) {
  const f = mod.facade;
  if (f.system !== "hinge") return [];
  return f.doors === 2 ? ["left", "right"] : [f.side];
}

/* вертикальная зона выкатного элемента */
function itemZone(item) {
  if (item.type === "drawers") {
    return { y1: item.y, y2: item.y + item.count * (item.boxH + CONST.drawerStep) };
  }
  if (item.type === "mesh") {
    const mesh = meshCatalog().find(x => x.id === item.meshId) || { h: 150 };
    return { y1: item.y, y2: item.y + mesh.h + 40 };
  }
  const h = item.type === "rod" ? 60 : CONST.panel;
  return { y1: item.y, y2: item.y + h };
}

/* фальш-панели модуля: по стороне петель, только в зонах выкатных элементов */
function fillerPanels(project, mod) {
  const sides = hingeSidesOf(mod);
  if (!sides.length) return [];
  const out = [];
  for (const it of mod.items) {
    if (it.type !== "drawers" && it.type !== "mesh") continue;
    const z = itemZone(it);
    for (const side of sides) {
      out.push({ side: side, y1: z.y1, y2: z.y2, w: CONST.drawerFiller, item: it.id });
    }
    // сетка: если после фальшей осталось шире технички - проставка до требуемой ширины
    if (it.type === "mesh") {
      const mesh = meshCatalog().find(x => x.id === it.meshId);
      if (mesh) {
        const inner = innerBox(project, mod);
        const avail = inner.w - sides.length * CONST.drawerFiller;
        const extra = avail - mesh.reqW;
        if (extra > 4) {
          out.push({ side: "spacer", y1: z.y1, y2: z.y2, w: CONST.panel,
                     offset: extra, item: it.id, note: "проставка до " + mesh.reqW });
        }
      }
    }
  }
  return out;
}

/* внутренняя ширина для выкатного элемента (с учётом его фальшей) */
function slideInnerW(project, mod, item) {
  const inner = innerBox(project, mod);
  const sides = hingeSidesOf(mod);
  let w = inner.w - sides.length * CONST.drawerFiller;
  if (item && item.type === "mesh") {
    const mesh = meshCatalog().find(x => x.id === item.meshId);
    if (mesh && w > mesh.reqW) w = mesh.reqW;
  }
  return w;
}

function facadeDecorOf(project, mod) {
  return mod.facade.decor || project.facadeDecor;
}

function bodyEdgeLabel(project) {
  // кромка каркаса: пусто = в цвет корпуса
  return project.edgeBody ? "0,4 " + project.edgeBody : "0,4 перед";
}

function hingesFor(facadeH, facadeW) {
  let n = CONST.hingeCountByHeight[CONST.hingeCountByHeight.length - 1].n;
  for (const rule of CONST.hingeCountByHeight) {
    if (facadeH <= rule.maxH) { n = rule.n; break; }
  }
  if (facadeW && facadeW > CONST.hingeWideW) n += 1;   // широкий фасад тяжелее
  const off = CONST.hingeOffset;
  const pos = [];
  for (let i = 0; i < n; i++) {
    pos.push(n === 1 ? facadeH / 2 : off + (facadeH - 2 * off) * i / (n - 1));
  }
  const weight = facadeW ? facadeH * facadeW / 1e6 * CONST.facadeKgPerM2 : null;
  return { n: n, positions: pos, weight: weight };
}

function facadeSizes(project, mod) {
  if (mod.facade.system !== "hinge") return [];
  const g = CONST.facade.gap;
  const per = CONST.facade.perimeter;
  const plinth = plinthOf(project, mod);
  const fh = mod.h - plinth - 2 * per;
  if (mod.facade.doors === 1) {
    return [{ w: mod.w - 2 * per, h: fh, side: mod.facade.side }];
  }
  const fw = (mod.w - 2 * per - g) / 2;
  return [
    { w: Math.floor(fw), h: fh, side: "left" },
    { w: Math.ceil(fw), h: fh, side: "right" },
  ];
}

/* ---------- деталировка ---------- */

function moduleSpec(project, mod, index) {
  const t = CONST.panel;
  const D = modDepth(project, mod);
  const inner = innerBox(project, mod);
  const plinth = plinthOf(project, mod);
  const name = (mod.kind === "base" ? "Нижний " : "Верхний ") + (index + 1);
  const panels = [];
  const hw = [];
  const add = (part, w, h, qty, edge, material) =>
    panels.push({ mod: name, part: part, w: Math.round(w), h: Math.round(h),
                  qty: qty || 1, edge: edge || "", material: material || "" });

  const be = bodyEdgeLabel(project);
  add("Боковина", mod.h, D, 2, be);
  add("Дно", mod.w - 2 * t, D, 1, be);
  add("Крыша", mod.w - 2 * t, D, 1, be);
  if (plinth) add("Цоколь", mod.w - 2 * t, plinth, 1, be);

  const fillers = fillerPanels(project, mod);
  fillers.forEach(f => {
    add(f.side === "spacer" ? "Фальш-проставка" : "Фальш-панель",
        Math.round(f.y2 - f.y1), D - CONST.shelfDepthMinus, 1, bodyEdgeLabel(project));
  });

  if (project.back === "lhdf") {
    add("Задняя стенка", mod.w - 4, mod.h - 4, 1, "", "ЛХДФ 3");
  } else {
    add("Задняя ЛДСП", mod.w - 2 * t, mod.h - 2 * t, 1, "");
  }

  for (const it of mod.items) {
    if (it.type === "shelf_fixed") {
      add("Полка жёсткая", inner.w, D - CONST.shelfDepthMinus, 1, bodyEdgeLabel(project));
      hw.push({ name: "Конфирматы полки", qty: 4, price: 3 });
    }
    if (it.type === "shelf_adj") {
      add("Полка съёмная", inner.w - 2 * CONST.shelfGap, D - CONST.shelfDepthMinus, 1, bodyEdgeLabel(project));
      hw.push({ name: "Полкодержатель Boyard p521", qty: 4, price: 3 });
    }
    if (it.type === "rod") {
      hw.push({ name: RODS.round.label + " " + Math.round(inner.w) + " мм", qty: 1,
                price: Math.round(RODS.round.pricePerM * inner.w / 1000) });
      hw.push({ name: "Штангодержатель", qty: 2, price: RODS.round.holder });
    }
    if (it.type === "drawers") {
      const s = SLIDES[it.slide];
      const zoneW = slideInnerW(project, mod, it);
      const boxW = zoneW - 2 * s.sideDeduct;
      const len = slideLengthFor(project, mod, it);
      const n = it.count;
      if (it.slide !== "metabox") {
        add("Ящик боковина", len, it.boxH, 2 * n, "верх 0,4");
        add("Ящик перед/зад", boxW - 2 * t, it.boxH, 2 * n, "верх 0,4");
      } else {
        add("Ящик перед/зад (метабокс)", boxW, it.boxH, 2 * n, "верх 0,4");
      }
      add("Ящик дно", boxW - 2, len - 2, n, "", "ЛХДФ 3");
      hw.push({ name: "Направляющие " + s.label + " " + len, qty: n,
                price: s.price[len] || null });
    }
    if (it.type === "mesh") {
      const mesh = meshCatalog().find(x => x.id === it.meshId);
      if (mesh) hw.push({ name: mesh.label + (mesh.art ? " (арт. " + mesh.art + ")" : ""),
                          qty: 1, price: mesh.price });
    }
  }

  if (mod.standLight) {
    hw.push({ name: "Подсветка врезная в стойках, " +
      (2 * inner.h / 1000).toFixed(1) + " пог.м (прайс 3000/м)", qty: 1, price: null });
  }

  const faces = facadeSizes(project, mod);
  faces.forEach(f => {
    add("Фасад", f.h, f.w, 1, "2 мм периметр");
    const hinges = hingesFor(f.h, f.w);
    const hingeType = mod.facade.opening === "push" ? HINGES.gtv_free : HINGES.gtv_soft;
    hw.push({ name: "Петля " + hingeType.label, qty: hinges.n, price: hingeType.price });
    if (mod.facade.opening === "push") {
      hw.push({ name: PUSH_LATCH.label, qty: 1, price: PUSH_LATCH.price });
    } else if (mod.facade.handleId) {
      const h = handlesCatalog().find(x => x.id === mod.facade.handleId);
      if (h) hw.push({ name: "Ручка " + h.label + (h.art ? " (арт. " + h.art + ")" : ""),
                       qty: 1, price: h.price });
    }
  });

  return { panels: panels, hardware: hw };
}

function slideLengthFor(project, mod, item) {
  const s = SLIDES[item.slide];
  const usable = modDepth(project, mod) - (project.back === "ldsp" ? CONST.panel : 5) - 20;
  let best = s.lengths[0];
  for (const L of s.lengths) if (L <= usable) best = L;
  return best;
}

function specification(project) {
  const panels = [], hardware = [];
  project.modules.forEach((mod, i) => {
    const s = moduleSpec(project, mod, i);
    panels.push.apply(panels, s.panels);
    hardware.push.apply(hardware, s.hardware);
  });
  const grouped = {};
  for (const h of hardware) {
    if (!grouped[h.name]) grouped[h.name] = { name: h.name, qty: 0, price: h.price };
    grouped[h.name].qty += h.qty;
  }
  const ldspArea = panels.filter(p => !p.material)
    .reduce((s, p) => s + p.w * p.h * p.qty / 1e6, 0);
  const hwList = Object.values(grouped);
  const hwCost = hwList.reduce((s, h) => s + (h.price ? h.price * h.qty : 0), 0);
  return { panels: panels, hardware: hwList, ldspArea: ldspArea, hwCost: hwCost };
}

/* подсветка: только в стойках (решение Max), погонные метры розничного прайса */
function lightMeters(project) {
  let stands = 0;
  for (const mod of project.modules) {
    if (mod.standLight) stands += 2 * innerBox(project, mod).h / 1000;  // обе стойки
  }
  return { stands: stands };
}

/* кромка: погонные метры по типам (для цены) */
function edgeMeters(panels) {
  let face = 0, tech = 0;
  for (const p of panels) {
    if (p.material) continue;
    const perim = 2 * (p.w + p.h) / 1000 * p.qty;
    if (p.edge.indexOf("2 мм") >= 0) face += perim;
    else if (p.edge) tech += (p.w / 1000) * p.qty;   // кромка одного торца
  }
  return { face: face, tech: tech };
}

/* ---------- сериализация ---------- */

const STORAGE_KEY = "wardrobeProject";
const LIBRARY_KEY = "wardrobeLibrary";

function saveProject(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
}
function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateProject(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}

/* библиотека проектов менеджера: несколько клиентов в одном браузере */
function libraryList() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"); }
  catch (e) { return []; }
}
function librarySave(project) {
  const lib = libraryList();
  const entry = {
    id: project.libId || uid(),
    name: project.name || "Шкаф",
    updated: new Date().toLocaleString("ru-RU"),
    data: JSON.stringify(project),
  };
  project.libId = entry.id;
  const idx = lib.findIndex(x => x.id === entry.id);
  if (idx >= 0) lib[idx] = entry; else lib.unshift(entry);
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib.slice(0, 30))); } catch (e) {}
  return entry.id;
}
function libraryLoad(id) {
  const e = libraryList().find(x => x.id === id);
  return e ? migrateProject(JSON.parse(e.data)) : null;
}
function libraryDelete(id) {
  const lib = libraryList().filter(x => x.id !== id);
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); } catch (e) {}
}
