/* SVG-рендер: виды спереди / сбоку / сверху.
   Координаты в мм, Y от пола (инвертируется при отрисовке).
   Размеры с data-dim кликабельны - editor.js открывает инлайн-ввод. */

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs, children) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  (children || []).forEach(c => node.appendChild(c));
  return node;
}

/* растянуть viewBox под пропорции контейнера: холст заполняется целиком,
   лишнее пространство закрывают "бесконечные" фоны стены и пола */
function fitViewBox(svg) {
  const raw = (svg.getAttribute("viewBox") || "").split(" ").map(Number);
  if (raw.length !== 4 || !svg.clientWidth || !svg.clientHeight) return;
  const ar = svg.clientWidth / svg.clientHeight;
  const vbAr = raw[2] / raw[3];
  if (ar > vbAr) {
    const nw = raw[3] * ar;
    raw[0] -= (nw - raw[2]) / 2;
    raw[2] = nw;
  } else {
    const nh = raw[2] / ar;
    raw[1] -= (nh - raw[3]) / 2;
    raw[3] = nh;
  }
  svg.setAttribute("viewBox", raw.join(" "));
}

/* ---------- defs: текстуры, градиенты, тени ---------- */

function buildDefs(svg) {
  const defs = el("defs", {});
  // хром штанги
  const chrome = el("linearGradient", { id: "gradChrome", x1: 0, y1: 0, x2: 0, y2: 1 });
  [["0%", "#9aa0a6"], ["30%", "#e8ebee"], ["48%", "#ffffff"], ["62%", "#cfd4d8"], ["100%", "#7c8288"]]
    .forEach(([o, c]) => chrome.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(chrome);
  // металл сетки
  const mesh = el("linearGradient", { id: "gradMesh", x1: 0, y1: 0, x2: 0, y2: 1 });
  [["0%", "#b7bcc1"], ["50%", "#e4e7ea"], ["100%", "#9aa0a6"]]
    .forEach(([o, c]) => mesh.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(mesh);
  // объём панели (поверх текстуры)
  const sheenV = el("linearGradient", { id: "sheenV", x1: 0, y1: 0, x2: 1, y2: 0 });
  [["0%", "rgba(255,255,255,.28)"], ["8%", "rgba(255,255,255,.05)"], ["92%", "rgba(0,0,0,.03)"], ["100%", "rgba(0,0,0,.16)"]]
    .forEach(([o, c]) => sheenV.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(sheenV);
  const sheenH = el("linearGradient", { id: "sheenH", x1: 0, y1: 0, x2: 0, y2: 1 });
  [["0%", "rgba(255,255,255,.3)"], ["12%", "rgba(255,255,255,.05)"], ["88%", "rgba(0,0,0,.04)"], ["100%", "rgba(0,0,0,.18)"]]
    .forEach(([o, c]) => sheenH.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(sheenH);
  // глубина секции
  const inset = el("linearGradient", { id: "insetTop", x1: 0, y1: 0, x2: 0, y2: 1 });
  [["0%", "rgba(0,0,0,.22)"], ["100%", "rgba(0,0,0,0)"]]
    .forEach(([o, c]) => inset.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(inset);
  // стена
  const wall = el("linearGradient", { id: "gradWall", x1: 0, y1: 0, x2: 0, y2: 1 });
  [["0%", "#efe9dc"], ["70%", "#e9e2d2"], ["100%", "#e2dac8"]]
    .forEach(([o, c]) => wall.appendChild(el("stop", { offset: o, "stop-color": c })));
  defs.appendChild(wall);
  // тени
  const sh = el("filter", { id: "shadowSoft", x: "-30%", y: "-30%", width: "160%", height: "160%" });
  sh.appendChild(el("feDropShadow", { dx: 0, dy: 8, stdDeviation: 14, "flood-color": "#2a251c", "flood-opacity": ".28" }));
  defs.appendChild(sh);
  const shSm = el("filter", { id: "shadowSm", x: "-40%", y: "-40%", width: "180%", height: "180%" });
  shSm.appendChild(el("feDropShadow", { dx: 0, dy: 3, stdDeviation: 5, "flood-color": "#2a251c", "flood-opacity": ".3" }));
  defs.appendChild(shSm);
  svg.appendChild(defs);
  return defs;
}

function texPattern(decorName, defs, used) {
  const id = "tex_" + String(decorName).replace(/[^a-zа-яё0-9]/gi, "_");
  if (used.has(id)) return id;
  used.add(id);
  const d = LAMARTY.find(x => x.n === decorName);
  const p = el("pattern", { id: id, patternUnits: "userSpaceOnUse", width: 240, height: 480 });
  if (d && d.tex) {
    p.appendChild(el("image", { href: encodeURI(d.tex), width: 240, height: 480,
                                preserveAspectRatio: "xMidYMid slice" }));
  } else {
    p.appendChild(el("rect", { width: 240, height: 480, fill: "#e8e2d6" }));
  }
  defs.appendChild(p);
  return id;
}

/* панель ЛДСП: текстура + объём + контур */
function panelRect(g, x, y, w, h, texId, opts) {
  opts = opts || {};
  g.appendChild(el("rect", { x: x, y: y, width: w, height: h,
    fill: "url(#" + texId + ")", stroke: "#5d5647", "stroke-width": opts.sw || 1.2, rx: opts.rx || 0 }));
  g.appendChild(el("rect", { x: x, y: y, width: w, height: h, rx: opts.rx || 0,
    fill: "url(#" + (w >= h ? "sheenH" : "sheenV") + ")", "pointer-events": "none" }));
}

function text(x, y, s, size, fill, anchor, weight) {
  const t = el("text", { x: x, y: y, "font-size": size || 30, fill: fill || "#5c5647",
    "font-family": "Manrope, sans-serif", "text-anchor": anchor || "start",
    "font-weight": weight || 500 });
  t.textContent = s;
  return t;
}

/* размер с подложкой; dim = строка data-dim для кликабельного редактирования */
function dimLabel(g, x, y, label, dim, size) {
  size = size || 32;
  const wEst = String(label).length * size * 0.6 + 18;
  const grp = el("g", { class: "dim-label" + (dim ? " dim-edit" : ""), cursor: dim ? "pointer" : "default" });
  if (dim) grp.setAttribute("data-dim", dim);
  grp.appendChild(el("rect", { x: x - wEst / 2, y: y - size + 4, width: wEst, height: size + 10,
    rx: 7, fill: "rgba(252,250,244,.94)", stroke: dim ? "#b59a6a" : "#d8d0bf", "stroke-width": 1.2 }));
  grp.appendChild(text(x, y, label, size, dim ? "#7a5d2e" : "#5c5647", "middle", 600));
  g.appendChild(grp);
}

function dimH(g, x1, x2, y, label, dim) {
  const grp = el("g", { class: "dim" });
  grp.appendChild(el("line", { x1: x1, y1: y, x2: x2, y2: y, stroke: "#a89f8c", "stroke-width": 1.6 }));
  [x1, x2].forEach(x => grp.appendChild(el("line", { x1: x, y1: y - 12, x2: x, y2: y + 12,
    stroke: "#a89f8c", "stroke-width": 1.6 })));
  g.appendChild(grp);
  dimLabel(g, (x1 + x2) / 2, y - 14, label, dim);
}

function dimV(g, x, y1, y2, label, dim) {
  const grp = el("g", { class: "dim" });
  grp.appendChild(el("line", { x1: x, y1: y1, x2: x, y2: y2, stroke: "#a89f8c", "stroke-width": 1.6 }));
  [y1, y2].forEach(y => grp.appendChild(el("line", { x1: x - 12, y1: y, x2: x + 12, y2: y,
    stroke: "#a89f8c", "stroke-width": 1.6 })));
  g.appendChild(grp);
  dimLabel(g, x, (y1 + y2) / 2, label, dim);
}

/* ---------- вид спереди ---------- */

function renderProject(svg, project, sel, opts) {
  opts = opts || {};
  svg.innerHTML = "";
  const mode = opts.view || "front";
  if (mode === "side") return renderSide(svg, project, sel, opts);
  if (mode === "top") return renderTop(svg, project, sel, opts);

  const roomW = project.room.w, roomH = project.room.h;
  const pad = 280;
  svg.setAttribute("viewBox", (-pad) + " " + (-pad * 0.55) + " " +
    (roomW + 2 * pad) + " " + (roomH + pad * 1.5));

  const defs = buildDefs(svg);
  const used = new Set();
  const Y = (mm) => roomH - mm;

  /* комната: фоны огромные, чтобы холст был заполнен при любом окне */
  const BIG = 40000;
  svg.appendChild(el("rect", { x: -BIG, y: -BIG, width: roomW + 2 * BIG, height: roomH + BIG,
    fill: "url(#gradWall)" }));
  // пол дощатый
  const floor = el("g", {});
  floor.appendChild(el("rect", { x: -BIG, y: roomH, width: roomW + 2 * BIG, height: BIG,
    fill: "#cbb896" }));
  for (let fx = -pad * 4; fx < roomW + pad * 4; fx += 190) {
    floor.appendChild(el("line", { x1: fx, y1: roomH, x2: fx - 60, y2: roomH + pad * 2,
      stroke: "#b9a37c", "stroke-width": 2 }));
  }
  for (let k = 1; k <= 8; k++) {
    floor.appendChild(el("line", { x1: -BIG, y1: roomH + k * 60, x2: roomW + BIG, y2: roomH + k * 60,
      stroke: "#bfa982", "stroke-width": 1.4 }));
  }
  svg.appendChild(floor);
  svg.appendChild(el("line", { x1: -BIG, y1: roomH, x2: roomW + BIG, y2: roomH,
    stroke: "#8d8271", "stroke-width": 4 }));
  // границы стены
  svg.appendChild(el("line", { x1: 0, y1: Y(roomH), x2: 0, y2: Y(0), stroke: "#b3a smoke", "stroke-width": 0 }));
  [0, roomW].forEach(wx => svg.appendChild(el("line", { x1: wx, y1: -pad * 0.4, x2: wx, y2: roomH,
    stroke: "#c9c0ab", "stroke-width": 3, "stroke-dasharray": "16 12" })));

  dimH(svg, 0, roomW, -pad * 0.28, "стена " + roomW, "roomW");
  dimV(svg, roomW + pad * 0.55, 0, roomH, roomH, "roomH");

  const startX = CONST.room.sideGap;

  /* тень под нижним рядом */
  const baseW = rowWidth(project, "base");
  if (baseW > 0) {
    svg.appendChild(el("ellipse", { cx: startX + baseW / 2, cy: roomH + 26, rx: baseW / 2 + 40, ry: 34,
      fill: "rgba(42,37,28,.18)" }));
  }

  for (const mod of project.modules) {
    drawModuleFront(svg, defs, used, project, mod, startX + moduleX(project, mod),
      moduleY(project, mod), Y, sel, opts);
  }

  chainDims(svg, project, "base", startX, roomH + 120);
  if (project.modules.some(m => m.kind === "upper")) {
    chainDims(svg, project, "upper", startX, Y(project.upperY) + 84);
    dimV(svg, -pad * 0.5, Y(project.upperY), Y(0), project.upperY, "upperY");
  }
  fitViewBox(svg);
}

function drawModuleFront(svg, defs, used, project, mod, x, y0, Y, sel, opts) {
  const t = CONST.panel;
  const inner = innerBox(project, mod);
  const plinth = plinthOf(project, mod);
  const selected = sel && sel.modId === mod.id;
  const bodyTex = texPattern(project.bodyDecor, defs, used);
  const g = el("g", { "data-mod": mod.id, cursor: "pointer" });

  /* фон секции с глубиной */
  g.appendChild(el("rect", { x: x + t, y: Y(y0 + mod.h - t), width: mod.w - 2 * t,
    height: mod.h - 2 * t - plinth + t, fill: "#f6f1e6" }));
  g.appendChild(el("rect", { x: x + t, y: Y(y0 + mod.h - t), width: mod.w - 2 * t, height: 90,
    fill: "url(#insetTop)", "pointer-events": "none" }));

  /* корпус */
  panelRect(g, x, Y(y0 + mod.h), t, mod.h, bodyTex);
  panelRect(g, x + mod.w - t, Y(y0 + mod.h), t, mod.h, bodyTex);
  panelRect(g, x + t, Y(y0 + mod.h), mod.w - 2 * t, t, bodyTex);
  panelRect(g, x + t, Y(y0 + plinth + t), mod.w - 2 * t, t, bodyTex);
  if (plinth) {
    panelRect(g, x + t, Y(y0 + plinth), mod.w - 2 * t, plinth, bodyTex);
    g.appendChild(el("rect", { x: x + t, y: Y(y0 + plinth), width: mod.w - 2 * t, height: plinth,
      fill: "rgba(0,0,0,.12)", "pointer-events": "none" }));
  }

  /* подсветка врезная в стойках: полосы свечения вдоль внутренних граней */
  if (mod.standLight) {
    [x + t, x + mod.w - t - 6].forEach(function (lx) {
      g.appendChild(el("rect", { x: lx + (lx === x + t ? 0 : 0), y: Y(y0 + inner.y0 + inner.h),
        width: 6, height: inner.h, fill: "#ffd977", opacity: .95 }));
      g.appendChild(el("rect", { x: lx - 14, y: Y(y0 + inner.y0 + inner.h),
        width: 34, height: inner.h, fill: "#ffe9ad", opacity: .28 }));
    });
  }

  /* фальш-панели (зонные) */
  const fillers = fillerPanels(project, mod);
  for (const f of fillers) {
    let fx;
    if (f.side === "left") fx = x + t;
    else if (f.side === "right") fx = x + mod.w - t - f.w;
    else {
      // проставка: на расстоянии reqW от левого фальша/боковины
      const sides = hingeSidesOf(mod);
      const leftOff = sides.indexOf("left") >= 0 ? CONST.drawerFiller : 0;
      fx = x + t + leftOff + slideInnerW(project, mod, mod.items.find(i => i.id === f.item));
    }
    panelRect(g, fx, Y(y0 + inner.y0 + f.y2), f.w, f.y2 - f.y1, texPattern(project.bodyDecor, defs, used));
  }

  /* наполнение */
  for (const it of mod.items) {
    drawItemFront(g, defs, used, project, mod, it, x, y0, inner, Y, sel);
  }

  /* фасады */
  if (opts.showFacades && mod.facade.system === "hinge") {
    drawFacadesFront(g, defs, used, project, mod, x, y0, Y, sel);
  }

  /* выделение / предупреждения */
  const warns = moduleWarnings(project, mod);
  g.appendChild(el("rect", { x: x - 3, y: Y(y0 + mod.h) - 3, width: mod.w + 6, height: mod.h + 6,
    fill: "none", rx: 4,
    stroke: selected ? "#235b4e" : (warns.length ? "#b04a3a" : "transparent"),
    "stroke-width": selected ? 7 : 5,
    "stroke-dasharray": warns.length && !selected ? "14 10" : "" }));
  if (warns.length) {
    g.appendChild(el("circle", { cx: x + mod.w - 26, cy: Y(y0 + mod.h) + 28, r: 20, fill: "#b04a3a",
      filter: "url(#shadowSm)" }));
    g.appendChild(text(x + mod.w - 26, Y(y0 + mod.h) + 38, "!", 30, "#fff", "middle", 700));
  }

  /* размеры выбранного: высота + y наполнения */
  if (selected) {
    dimV(svg, x + mod.w + 66, Y(y0 + mod.h), Y(y0), mod.h, "modH|" + mod.id);
    mod.items.forEach(it => {
      const yAbs = y0 + inner.y0 + it.y;
      const gg = el("g", { class: "dim" });
      gg.appendChild(el("line", { x1: x - 54, y1: Y(yAbs), x2: x + 6, y2: Y(yAbs),
        stroke: "#b07c3f", "stroke-width": 2, "stroke-dasharray": "10 7" }));
      svg.appendChild(gg);
      dimLabel(svg, x - 96, Y(yAbs) + 10, Math.round(it.y), "itemY|" + mod.id + "|" + it.id, 28);
    });
  }
  svg.appendChild(g);
}

function drawItemFront(g, defs, used, project, mod, it, x, y0, inner, Y, sel) {
  const t = CONST.panel;
  const sides = hingeSidesOf(mod);
  const leftOff = sides.indexOf("left") >= 0 && (it.type === "drawers" || it.type === "mesh")
    ? CONST.drawerFiller : 0;
  const zoneW = (it.type === "drawers" || it.type === "mesh")
    ? slideInnerW(project, mod, it) : inner.w;
  const ix = x + t + leftOff;
  const iy = y0 + inner.y0;
  const selected = sel && sel.itemId === it.id;
  const wrap = el("g", { "data-mod": mod.id, "data-item": it.id, cursor: "grab" });
  const bodyTex = texPattern(project.bodyDecor, defs, used);
  const hl = selected ? "#235b4e" : "transparent";

  if (it.type === "shelf_fixed" || it.type === "shelf_adj") {
    // тень под полкой
    wrap.appendChild(el("rect", { x: x + t, y: Y(iy + it.y), width: inner.w, height: 26,
      fill: "rgba(0,0,0,.10)" }));
    panelRect(wrap, x + t, Y(iy + it.y + t), inner.w, t, bodyTex);
    if (it.type === "shelf_adj") {
      [x + t + 10, x + t + inner.w - 16].forEach(px =>
        wrap.appendChild(el("circle", { cx: px + 3, cy: Y(iy + it.y) + 10, r: 5, fill: "#8d8271" })));
    }
    wrap.appendChild(el("rect", { x: x + t, y: Y(iy + it.y + t) - 3, width: inner.w, height: t + 6,
      fill: "none", stroke: hl, "stroke-width": 4 }));
  }

  if (it.type === "rod") {
    const rodY = iy + it.y;
    // держатели
    [x + t + 2, x + t + inner.w - 20].forEach(px => {
      wrap.appendChild(el("rect", { x: px, y: Y(rodY + 34), width: 18, height: 44, rx: 4,
        fill: "url(#gradMesh)", stroke: "#7c8288", "stroke-width": 1 }));
    });
    // труба D25 с хромом и бликом
    wrap.appendChild(el("rect", { x: x + t + 12, y: Y(rodY + 25), width: inner.w - 24, height: 25,
      rx: 12.5, fill: "url(#gradChrome)", stroke: "#6f757b", "stroke-width": 1, filter: "url(#shadowSm)" }));
    wrap.appendChild(el("rect", { x: x + t + 26, y: Y(rodY + 21), width: inner.w - 52, height: 6,
      rx: 3, fill: "rgba(255,255,255,.85)" }));
    // вешалки-намёк (три дуги)
    for (let k = 0; k < 3; k++) {
      const hx = x + t + inner.w * (0.25 + k * 0.25);
      wrap.appendChild(el("path", {
        d: "M " + (hx - 26) + " " + (Y(rodY) + 60) + " Q " + hx + " " + (Y(rodY) + 6) + " " + (hx + 26) + " " + (Y(rodY) + 60),
        fill: "none", stroke: "#a89f8c", "stroke-width": 3, opacity: .6 }));
    }
    wrap.appendChild(el("rect", { x: x + t, y: Y(rodY + 30), width: inner.w, height: 40,
      fill: "none", stroke: hl, "stroke-width": 4 }));
  }

  if (it.type === "drawers") {
    const s = SLIDES[it.slide];
    const boxW = zoneW - 2 * s.sideDeduct;
    for (let i = 0; i < it.count; i++) {
      const by = iy + it.y + i * (it.boxH + CONST.drawerStep);
      // направляющие
      [ix + 2, ix + zoneW - 10].forEach(px =>
        wrap.appendChild(el("rect", { x: px, y: Y(by + it.boxH * 0.55), width: 8, height: 10,
          fill: "url(#gradMesh)" })));
      // корпус ящика
      wrap.appendChild(el("rect", { x: ix + s.sideDeduct, y: Y(by + it.boxH), width: boxW,
        height: it.boxH, rx: 3, fill: "#efe7d4", stroke: "#8d8271", "stroke-width": 1.4,
        filter: "url(#shadowSm)" }));
      wrap.appendChild(el("rect", { x: ix + s.sideDeduct, y: Y(by + it.boxH), width: boxW,
        height: it.boxH, rx: 3, fill: "url(#sheenH)", "pointer-events": "none" }));
      // передняя кромка
      wrap.appendChild(el("rect", { x: ix + s.sideDeduct, y: Y(by + it.boxH), width: boxW, height: 8,
        rx: 3, fill: "rgba(255,255,255,.5)" }));
    }
    const zh = it.count * (it.boxH + CONST.drawerStep);
    wrap.appendChild(el("rect", { x: ix - 2, y: Y(iy + it.y + zh) , width: zoneW + 4, height: zh,
      fill: "none", stroke: hl, "stroke-width": 4 }));
    dimLabel(wrap, ix + zoneW / 2, Y(iy + it.y + zh) + 34,
      it.count + " × " + s.label, null, 26);
  }

  if (it.type === "mesh") {
    const mesh = meshCatalog().find(m => m.id === it.meshId) || { h: 150, label: "сетка" };
    const mh = mesh.h;
    const my = iy + it.y;
    wrap.appendChild(el("rect", { x: ix + 4, y: Y(my + mh), width: zoneW - 8, height: mh, rx: 5,
      fill: "none", stroke: "url(#gradMesh)", "stroke-width": 7, filter: "url(#shadowSm)" }));
    for (let k = 1; k < 8; k++) {
      wrap.appendChild(el("line", { x1: ix + 8 + (zoneW - 16) * k / 8, y1: Y(my + mh) + 6,
        x2: ix + 8 + (zoneW - 16) * k / 8, y2: Y(my) - 6, stroke: "url(#gradMesh)", "stroke-width": 3.5 }));
    }
    wrap.appendChild(el("line", { x1: ix + 6, y1: Y(my + mh / 2), x2: ix + zoneW - 6, y2: Y(my + mh / 2),
      stroke: "url(#gradMesh)", "stroke-width": 3.5 }));
    dimLabel(wrap, ix + zoneW / 2, Y(my + mh) - 12, mesh.label, null, 25);
    wrap.appendChild(el("rect", { x: ix, y: Y(my + mh) - 4, width: zoneW, height: mh + 8,
      fill: "none", stroke: hl, "stroke-width": 4 }));
  }

  g.appendChild(wrap);
}

function drawFacadesFront(g, defs, used, project, mod, x, y0, Y, sel) {
  const faces = facadeSizes(project, mod);
  const decor = facadeDecorOf(project, mod);
  const tex = texPattern(decor, defs, used);
  const plinth = plinthOf(project, mod);
  const per = CONST.facade.perimeter;
  let fx = x + per;
  faces.forEach((f, idx) => {
    const fy = y0 + plinth + per;
    const selectedF = sel && sel.modId === mod.id && sel.face === idx;
    const fg = el("g", { "data-mod": mod.id, "data-face": idx, cursor: "pointer" });
    fg.appendChild(el("rect", { x: fx, y: Y(fy + f.h), width: f.w, height: f.h, rx: 2,
      fill: "url(#" + tex + ")", stroke: selectedF ? "#235b4e" : "#4d463b",
      "stroke-width": selectedF ? 6 : 1.6, filter: "url(#shadowSoft)" }));
    fg.appendChild(el("rect", { x: fx, y: Y(fy + f.h), width: f.w, height: f.h, rx: 2,
      fill: "url(#sheenV)", "pointer-events": "none" }));
    /* петли */
    const hinges = hingesFor(f.h, f.w);
    const hingeX = f.side === "left" ? fx + 22 : fx + f.w - 22;
    hinges.positions.forEach(p => {
      fg.appendChild(el("circle", { cx: hingeX, cy: Y(fy + f.h - p), r: 17, fill: "#e8e6df",
        stroke: "#4d463b", "stroke-width": 2 }));
      fg.appendChild(el("circle", { cx: hingeX, cy: Y(fy + f.h - p), r: 7, fill: "#4d463b" }));
    });
    /* ручка / push */
    if (mod.facade.opening === "handle") {
      const handle = handlesCatalog().find(h => h.id === mod.facade.handleId);
      const len = Math.min((handle && handle.len) || 160, f.h * 0.6);
      const hx = f.side === "left" ? fx + f.w - 34 : fx + 34;
      fg.appendChild(el("rect", { x: hx - 7, y: Y(fy + f.h / 2 + len / 2), width: 14, height: len,
        rx: 7, fill: "url(#gradChrome)", stroke: "#5d564a", "stroke-width": 1, filter: "url(#shadowSm)" }));
    } else {
      const px = f.side === "left" ? fx + f.w - 40 : fx + 40;
      fg.appendChild(el("circle", { cx: px, cy: Y(fy + f.h / 2), r: 10, fill: "none",
        stroke: "#5d564a", "stroke-width": 2, "stroke-dasharray": "5 4" }));
    }
    g.appendChild(fg);
    fx += f.w + CONST.facade.gap;
  });
}

function chainDims(svg, project, kind, startX, y) {
  let x = startX;
  const mods = project.modules.filter(m => m.kind === kind);
  if (!mods.length) return;
  for (const m of mods) {
    dimH(svg, x, x + m.w, y, m.w, "modW|" + m.id);
    x += m.w;
  }
  if (mods.length > 1) dimH(svg, startX, x, y + 86, "итого " + (x - startX));
}

/* ---------- вид сбоку ---------- */

function renderSide(svg, project, sel, opts) {
  const mod = project.modules.find(m => m.id === (sel && sel.modId)) || project.modules[0];
  const defs = buildDefs(svg);
  const used = new Set();
  if (!mod) { svg.setAttribute("viewBox", "0 0 100 100"); return; }
  const D = modDepth(project, mod);
  const H = mod.h;
  const plinth = plinthOf(project, mod);
  const t = CONST.panel;
  const pad = 240;
  svg.setAttribute("viewBox", (-pad) + " " + (-pad * 0.5) + " " + (D + 2 * pad) + " " + (H + pad * 1.3));
  const Y = (mm) => H - mm;
  const bodyTex = texPattern(project.bodyDecor, defs, used);

  const BIG = 40000;
  svg.appendChild(el("rect", { x: -BIG, y: -BIG, width: D + 2 * BIG, height: H + BIG,
    fill: "url(#gradWall)" }));
  svg.appendChild(el("rect", { x: -BIG, y: H, width: D + 2 * BIG, height: BIG, fill: "#cbb896" }));
  svg.appendChild(el("line", { x1: -BIG, y1: H, x2: D + BIG, y2: H, stroke: "#8d8271", "stroke-width": 4 }));

  const g = el("g", { "data-mod": mod.id });
  // боковина: контур с текстурой по периметру, внутренность светлая (разрез)
  panelRect(g, 0, Y(H), D, H, bodyTex, { sw: 2 });
  g.appendChild(el("rect", { x: 10, y: Y(H) + 10, width: D - 20, height: H - 20,
    fill: "#f6f1e6", stroke: "#cfc6b2", "stroke-width": 1 }));

  // задняя стенка (у стены, x=0 - зад)
  g.appendChild(el("rect", { x: 0, y: Y(H - 2), width: project.back === "ldsp" ? t : 8, height: H - 4,
    fill: "#d9d2c0", stroke: "#8d8271", "stroke-width": 1 }));

  // цоколь с утоплением от переда
  if (plinth) {
    panelRect(g, D - CONST.plinthIndent - t, Y(plinth), t, plinth, bodyTex);
    dimH(svg, D - CONST.plinthIndent - t, D, H + 46, CONST.plinthIndent + t, null);
  }
  // дно и крыша
  panelRect(g, project.back === "ldsp" ? t : 8, Y(plinth + t), D - (project.back === "ldsp" ? t : 8), t, bodyTex);
  panelRect(g, project.back === "ldsp" ? t : 8, Y(H), D - (project.back === "ldsp" ? t : 8) - 0, t, bodyTex);

  const inner = innerBox(project, mod);
  for (const it of mod.items) {
    const yAbs = plinth + t + it.y;
    if (it.type === "shelf_fixed" || it.type === "shelf_adj") {
      panelRect(g, 8, Y(yAbs + t), D - CONST.shelfDepthMinus - 8, t, bodyTex);
    }
    if (it.type === "rod") {
      const cx = D - 72;
      g.appendChild(el("circle", { cx: cx, cy: Y(yAbs + 12), r: 13, fill: "url(#gradChrome)",
        stroke: "#6f757b", "stroke-width": 2 }));
      g.appendChild(el("circle", { cx: cx, cy: Y(yAbs + 12), r: 30, fill: "none",
        stroke: "#a89f8c", "stroke-width": 1.6, "stroke-dasharray": "6 5" }));
      dimLabel(g, cx, Y(yAbs + 12) - 44, "штанга D25", null, 22);
    }
    if (it.type === "drawers") {
      const len = slideLengthFor(project, mod, it);
      for (let i = 0; i < it.count; i++) {
        const by = yAbs + i * (it.boxH + CONST.drawerStep);
        g.appendChild(el("rect", { x: D - len - 20, y: Y(by + it.boxH), width: len, height: it.boxH,
          rx: 3, fill: "#efe7d4", stroke: "#8d8271", "stroke-width": 1.2 }));
        g.appendChild(el("line", { x1: D - len - 20, y1: Y(by) - 4, x2: D - 20, y2: Y(by) - 4,
          stroke: "#9aa0a6", "stroke-width": 3 }));
      }
    }
    if (it.type === "mesh") {
      const mesh = meshCatalog().find(m => m.id === it.meshId) || { h: 150, reqD: 430 };
      g.appendChild(el("rect", { x: D - mesh.reqD - 20, y: Y(yAbs + mesh.h), width: mesh.reqD,
        height: mesh.h, rx: 4, fill: "none", stroke: "url(#gradMesh)", "stroke-width": 5 }));
    }
  }

  // фасад накладной спереди
  if (mod.facade.system === "hinge") {
    const tex = texPattern(facadeDecorOf(project, mod), defs, used);
    panelRect(g, D, Y(H - 2), t, H - plinth - 4, tex);
  }
  svg.appendChild(g);

  dimH(svg, 0, D, -60, D, "modD|" + mod.id);
  dimV(svg, D + 90 + (mod.facade.system === "hinge" ? t : 0), Y(H), Y(0), H, "modH|" + mod.id);
  if (plinth) dimV(svg, -70, Y(plinth), Y(0), plinth, "plinth");
  dimLabel(svg, D / 2, Y(H) - 60, (mod.kind === "base" ? "Нижний" : "Верхний") + " · вид сбоку", null, 30);
  fitViewBox(svg);
}

/* ---------- вид сверху ---------- */

function renderTop(svg, project, sel, opts) {
  const defs = buildDefs(svg);
  const used = new Set();
  const roomW = project.room.w;
  const maxD = Math.max(project.depth, ...project.modules.map(m => modDepth(project, m)), 400);
  const pad = 260;
  svg.setAttribute("viewBox", (-pad) + " " + (-pad * 0.7) + " " + (roomW + 2 * pad) + " " + (maxD + pad * 1.6));
  const bodyTex = texPattern(project.bodyDecor, defs, used);
  const t = CONST.panel;

  // стена сверху
  const BIG = 40000;
  svg.appendChild(el("rect", { x: -BIG, y: -BIG, width: roomW + 2 * BIG, height: BIG,
    fill: "#b7ab93" }));
  svg.appendChild(el("line", { x1: -BIG, y1: 0, x2: roomW + BIG, y2: 0, stroke: "#8d8271", "stroke-width": 5 }));
  svg.appendChild(el("rect", { x: -BIG, y: 0, width: roomW + 2 * BIG, height: maxD + BIG,
    fill: "#e6ddc9" }));
  dimH(svg, 0, roomW, maxD + 150, "стена " + roomW, "roomW");

  const startX = CONST.room.sideGap;
  const rows = [["base", 1], ["upper", 0.45]];
  for (const [kind, opacity] of rows) {
    for (const mod of project.modules.filter(m => m.kind === kind)) {
      const x = startX + moduleX(project, mod);
      const D = modDepth(project, mod);
      const selected = sel && sel.modId === mod.id;
      const g = el("g", { "data-mod": mod.id, cursor: "pointer", opacity: opacity });
      // корпус сверху: боковины по бокам, зад у стены
      g.appendChild(el("rect", { x: x, y: 0, width: mod.w, height: D, fill: "#f4efe2",
        stroke: "#8d8271", "stroke-width": 1.5, filter: kind === "base" ? "url(#shadowSm)" : "" }));
      panelRect(g, x, 0, t, D, bodyTex);
      panelRect(g, x + mod.w - t, 0, t, D, bodyTex);
      g.appendChild(el("rect", { x: x + t, y: 0, width: mod.w - 2 * t, height: 8, fill: "#d9d2c0" }));
      // фасад полосой спереди
      if (mod.facade.system === "hinge") {
        const tex = texPattern(facadeDecorOf(project, mod), defs, used);
        panelRect(g, x + 2, D, mod.w - 4, t, tex);
        if (mod.facade.doors === 2) {
          g.appendChild(el("line", { x1: x + mod.w / 2, y1: D, x2: x + mod.w / 2, y2: D + t,
            stroke: "#4d463b", "stroke-width": 2 }));
        }
      }
      g.appendChild(el("rect", { x: x - 2, y: -2, width: mod.w + 4, height: D + t + 4, fill: "none",
        stroke: selected ? "#235b4e" : "transparent", "stroke-width": 6 }));
      svg.appendChild(g);
      if (kind === "base") {
        dimH(svg, x, x + mod.w, D + 74, mod.w, "modW|" + mod.id);
        dimV(svg, x + mod.w - 40, 0, D, D, "modD|" + mod.id);
      }
    }
  }
  dimLabel(svg, roomW / 2, -pad * 0.32, "Вид сверху · верхний ряд полупрозрачным", null, 30);
  fitViewBox(svg);
}
