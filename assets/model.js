/* Модель проекта и деталировка.
   Вся геометрия в миллиметрах. Проект сериализуется в JSON как есть.

   project
   ├─ room: стена (w × h) и рекомендуемые зазоры
   ├─ depth, back, bodyDecor, facadeDecor: общие настройки шкафа
   └─ modules[]: kind base|upper, size, items[] (наполнение), facade
      купе заложен как facade.system = "hinge" | "coupe" (редактор купе - следующий этап)
*/

let _seq = 1;
function uid() { return "m" + (_seq++) + "_" + Date.now().toString(36); }

function newProject() {
  return {
    v: 1,
    name: "Шкаф",
    room: { w: 3000, h: 2500 },
    depth: 600,
    back: "lhdf",
    bodyDecor: "Белый",
    facadeDecor: "Белый",
    upperY: 2000,            // высота низа верхнего ряда от пола
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
    items: [],                           // наполнение
    fillers: { left: 0, right: 0 },      // фальш-планки, мм (0 = нет)
    facade: {
      system: "none",                    // none | hinge | coupe(поздний этап)
      doors: 2,                          // 1 | 2
      side: "left",                      // сторона петель при 1 двери
      opening: "handle",                 // handle | push
      handleId: null,
      decor: null,                       // null = как project.facadeDecor
    },
  };
}

function newItem(type) {
  const base = { id: uid(), type: type, y: 300 };
  if (type === "drawer") {
    base.boxH = 150;
    base.slide = "ball";
    base.y = 100;
  }
  if (type === "mesh") base.meshId = "basket450";
  return base;
}

/* ---------- геометрия ---------- */

function moduleX(project, mod) {
  // позиция модуля в своём ряду: сумма ширин предыдущих
  let x = 0;
  for (const m of project.modules) {
    if (m.kind !== mod.kind) continue;
    if (m.id === mod.id) return x;
    x += m.w;
  }
  return x;
}

function rowWidth(project, kind) {
  return project.modules.filter(m => m.kind === kind)
    .reduce((s, m) => s + m.w, 0);
}

function moduleY(project, mod) {
  // низ модуля от пола
  return mod.kind === "base" ? 0 : project.upperY;
}

/* внутренний проём секции с учётом фальшей */
function innerBox(project, mod) {
  const t = CONST.panel;
  const plinth = mod.kind === "base" ? CONST.plinthH : 0;
  return {
    w: mod.w - 2 * t - mod.fillers.left - mod.fillers.right,
    h: mod.h - plinth - 2 * t,
    d: project.depth - (project.back === "ldsp" ? CONST.panel : 0),
    x0: t + mod.fillers.left,            // от левого края модуля
    y0: plinth + t,                      // от низа модуля
  };
}

function facadeDecorOf(project, mod) {
  return mod.facade.decor || project.facadeDecor;
}

/* количество и позиции петель по высоте фасада */
function hingesFor(facadeH) {
  let n = CONST.hingeCountByHeight[CONST.hingeCountByHeight.length - 1].n;
  for (const rule of CONST.hingeCountByHeight) {
    if (facadeH <= rule.maxH) { n = rule.n; break; }
  }
  const off = CONST.hingeOffset;
  const pos = [];
  for (let i = 0; i < n; i++) {
    pos.push(n === 1 ? facadeH / 2 : off + (facadeH - 2 * off) * i / (n - 1));
  }
  return { n: n, positions: pos };
}

/* размеры фасадов модуля (накладные) */
function facadeSizes(project, mod) {
  if (mod.facade.system !== "hinge") return [];
  const g = CONST.facade.gap;
  const plinth = mod.kind === "base" ? CONST.plinthH : 0;
  const fh = mod.h - plinth - 2 * 2;
  if (mod.facade.doors === 1) {
    return [{ w: mod.w - 4, h: fh, side: mod.facade.side }];
  }
  const fw = (mod.w - 4 - g) / 2;
  return [
    { w: Math.floor(fw), h: fh, side: "left" },
    { w: Math.ceil(fw), h: fh, side: "right" },
  ];
}

/* ---------- деталировка ---------- */

function moduleSpec(project, mod, index) {
  const t = CONST.panel;
  const D = project.depth;
  const inner = innerBox(project, mod);
  const name = (mod.kind === "base" ? "Нижний " : "Верхний ") + (index + 1);
  const panels = [];
  const hw = [];
  const add = (part, w, h, qty, edge) =>
    panels.push({ mod: name, part: part, w: Math.round(w), h: Math.round(h),
                  qty: qty || 1, edge: edge || "" });

  add("Боковина", mod.h, D, 2, "0,4 перед");
  add("Дно", mod.w - 2 * t, D, 1, "0,4 перед");
  add("Крыша", mod.w - 2 * t, D, 1, "0,4 перед");
  if (mod.kind === "base") add("Цоколь", mod.w - 2 * t, CONST.plinthH, 1, "0,4 перед");
  if (mod.fillers.left) add("Фальш левый", inner.h, mod.fillers.left, 1, "1 длинная");
  if (mod.fillers.right) add("Фальш правый", inner.h, mod.fillers.right, 1, "1 длинная");

  if (project.back === "lhdf") {
    panels.push({ mod: name, part: "Задняя ЛХДФ", w: mod.w - 4, h: mod.h - 4, qty: 1,
                  edge: "", material: "ЛХДФ 3" });
  } else {
    add("Задняя ЛДСП", mod.w - 2 * t, mod.h - 2 * t, 1, "");
  }

  for (const it of mod.items) {
    if (it.type === "shelf_fixed") {
      add("Полка жёсткая", inner.w, D - CONST.shelfDepthMinus, 1, "0,4 перед");
      hw.push({ name: "Конфирматы полки", qty: 4, price: 3 });
    }
    if (it.type === "shelf_adj") {
      add("Полка съёмная", inner.w - 2 * CONST.shelfGap, D - CONST.shelfDepthMinus, 1, "0,4 перед");
      hw.push({ name: "Полкодержатель Boyard p521", qty: 4, price: 3 });
    }
    if (it.type === "rod") {
      hw.push({ name: RODS.round.label + " " + Math.round(inner.w) + " мм", qty: 1,
                price: Math.round(RODS.round.pricePerM * inner.w / 1000) });
      hw.push({ name: "Штангодержатель", qty: 2, price: RODS.round.holder });
    }
    if (it.type === "drawer") {
      const s = SLIDES[it.slide];
      const boxW = inner.w - 2 * s.sideDeduct;
      const len = slideLengthFor(project, it);
      if (it.slide !== "metabox") {
        add("Ящик боковина", len, it.boxH, 2, "верх");
        add("Ящик перед/зад", boxW - 2 * t, it.boxH, 2, "верх");
      } else {
        add("Ящик перед/зад (метабокс)", boxW, it.boxH, 2, "верх");
      }
      panels.push({ mod: name, part: "Ящик дно ЛХДФ", w: boxW - 2, h: len - 2, qty: 1,
                    edge: "", material: "ЛХДФ 3" });
      hw.push({ name: "Направляющие " + s.label + " " + len, qty: 1,
                price: s.price[len] || null });
    }
    if (it.type === "mesh") {
      const mesh = meshCatalog().find(x => x.id === it.meshId);
      if (mesh) hw.push({ name: mesh.label, qty: 1, price: mesh.price });
    }
  }

  // фасады и петли
  const faces = facadeSizes(project, mod);
  faces.forEach(f => {
    add("Фасад", f.h, f.w, 1, "2 мм периметр");
    const hinges = hingesFor(f.h);
    const hingeType = mod.facade.opening === "push" ? HINGES.gtv_free : HINGES.gtv_soft;
    hw.push({ name: "Петля " + hingeType.label, qty: hinges.n, price: hingeType.price });
    if (mod.facade.opening === "push") {
      hw.push({ name: PUSH_LATCH.label, qty: 1, price: PUSH_LATCH.price });
    } else if (mod.facade.handleId) {
      const h = handlesCatalog().find(x => x.id === mod.facade.handleId);
      if (h) hw.push({ name: "Ручка " + h.label, qty: 1, price: h.price });
    }
  });

  return { panels: panels, hardware: hw };
}

function slideLengthFor(project, item) {
  const s = SLIDES[item.slide];
  const usable = project.depth - (project.back === "ldsp" ? CONST.panel : 5) - 20;
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
  // сгруппировать фурнитуру по имени
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

/* ---------- сериализация ---------- */

const STORAGE_KEY = "wardrobeProject";
function saveProject(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
}
function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
