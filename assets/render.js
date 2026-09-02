/* SVG-рендер: вид спереди. Координаты в мм, Y от пола (инвертируется при отрисовке). */

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs, children) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  (children || []).forEach(c => node.appendChild(c));
  return node;
}

function texPattern(decorName, defs, used) {
  const id = "tex_" + decorName.replace(/[^a-zа-яё0-9]/gi, "_");
  if (used.has(id)) return id;
  used.add(id);
  const d = LAMARTY.find(x => x.n === decorName);
  const p = el("pattern", { id: id, patternUnits: "userSpaceOnUse", width: 240, height: 480 });
  if (d && d.tex) {
    const img = el("image", { href: encodeURI(d.tex), width: 240, height: 480,
                              preserveAspectRatio: "xMidYMid slice" });
    p.appendChild(img);
  } else {
    p.appendChild(el("rect", { width: 240, height: 480, fill: "#e8e2d6" }));
  }
  defs.appendChild(p);
  return id;
}

function renderProject(svg, project, sel, opts) {
  opts = opts || {};
  svg.innerHTML = "";
  const roomW = project.room.w, roomH = project.room.h;
  const pad = 260;
  svg.setAttribute("viewBox", (-pad) + " " + (-pad * 0.6) + " " +
    (roomW + 2 * pad) + " " + (roomH + pad * 1.4));

  const defs = el("defs", {});
  svg.appendChild(defs);
  const used = new Set();
  const Y = (mm) => roomH - mm;   // мм от пола -> svg

  /* стена и пол */
  svg.appendChild(el("rect", { x: 0, y: 0, width: roomW, height: roomH,
    fill: "var(--wall, #f1ede4)", stroke: "#b9b2a4", "stroke-width": 3 }));
  svg.appendChild(el("line", { x1: -pad * 0.7, y1: roomH, x2: roomW + pad * 0.7, y2: roomH,
    stroke: "#8d8578", "stroke-width": 5 }));
  dim(svg, 0, roomW, -pad * 0.35, "стена " + roomW, true);
  dimV(svg, 0, roomH, roomW + pad * 0.4, roomH + " до потолка");

  /* модули по рядам */
  const startX = CONST.room.sideGap;
  for (const mod of project.modules) {
    const x = startX + moduleX(project, mod);
    const y0 = moduleY(project, mod);
    drawModule(svg, defs, used, project, mod, x, y0, Y, sel, opts);
  }

  /* размерные цепочки рядов */
  chainDims(svg, project, "base", startX, roomH + 90);
  if (project.modules.some(m => m.kind === "upper"))
    chainDims(svg, project, "upper", startX, Y(project.upperY) + 80);
}

function drawModule(svg, defs, used, project, mod, x, y0, Y, sel, opts) {
  const t = CONST.panel;
  const g = el("g", { "data-mod": mod.id, cursor: "pointer" });
  const inner = innerBox(project, mod);
  const selected = sel && sel.modId === mod.id;
  const bodyTex = texPattern(project.bodyDecor, defs, used);

  /* корпус: рамка из боковин/крыши/дна */
  const frame = [
    [x, y0, t, mod.h], [x + mod.w - t, y0, t, mod.h],                       // боковины
    [x + t, y0 + mod.h - t, mod.w - 2 * t, t],                              // крыша
    [x + t, y0 + (mod.kind === "base" ? CONST.plinthH : 0), mod.w - 2 * t, t], // дно
  ];
  if (mod.kind === "base") frame.push([x + t, y0, mod.w - 2 * t, CONST.plinthH]); // цоколь
  if (mod.fillers.left) frame.push([x + t, y0 + inner.y0, mod.fillers.left, inner.h]);
  if (mod.fillers.right)
    frame.push([x + mod.w - t - mod.fillers.right, y0 + inner.y0, mod.fillers.right, inner.h]);

  /* фон секции */
  g.appendChild(el("rect", { x: x + t, y: Y(y0 + mod.h - t), width: mod.w - 2 * t,
    height: mod.h - 2 * t, fill: "#faf7f0" }));

  for (const [fx, fy, fw, fh] of frame) {
    g.appendChild(el("rect", { x: fx, y: Y(fy + fh), width: fw, height: fh,
      fill: "url(#" + bodyTex + ")", stroke: "#6f6759", "stroke-width": 1.5 }));
  }

  /* наполнение */
  for (const it of mod.items) {
    drawItem(g, project, mod, it, x, y0, inner, Y, sel);
  }

  /* фасады */
  if (opts.showFacades && mod.facade.system === "hinge") {
    drawFacades(g, defs, used, project, mod, x, y0, Y, sel);
  }

  /* рамка выделения и предупреждения */
  const warns = moduleWarnings(project, mod);
  g.appendChild(el("rect", { x: x, y: Y(y0 + mod.h), width: mod.w, height: mod.h,
    fill: "none",
    stroke: selected ? "var(--accent, #235b4e)" : (warns.length ? "#b04a3a" : "transparent"),
    "stroke-width": selected ? 6 : 4, "stroke-dasharray": warns.length && !selected ? "12 8" : "" }));
  if (warns.length) {
    const badge = el("g", {});
    badge.appendChild(el("circle", { cx: x + mod.w - 24, cy: Y(y0 + mod.h) + 24, r: 18,
      fill: "#b04a3a" }));
    badge.appendChild(text(x + mod.w - 24, Y(y0 + mod.h) + 32, "!", 26, "#fff", "middle"));
    g.appendChild(badge);
  }
  svg.appendChild(g);
}

function drawItem(g, project, mod, it, x, y0, inner, Y, sel) {
  const t = CONST.panel;
  const ix = x + inner.x0;
  const iy = y0 + inner.y0;
  const selected = sel && sel.itemId === it.id;
  const stroke = selected ? "var(--accent, #235b4e)" : "#7a7263";
  const sw = selected ? 5 : 2;
  const wrap = el("g", { "data-mod": mod.id, "data-item": it.id, cursor: "grab" });

  if (it.type === "shelf_fixed" || it.type === "shelf_adj") {
    wrap.appendChild(el("rect", { x: ix, y: Y(iy + it.y + t), width: inner.w, height: t,
      fill: it.type === "shelf_fixed" ? "#cabfa8" : "#ddd3bd", stroke: stroke, "stroke-width": sw }));
    if (it.type === "shelf_adj") {
      wrap.appendChild(text(ix + 8, Y(iy + it.y) - 6, "съёмн.", 26, "#9a917f"));
    }
  }
  if (it.type === "rod") {
    wrap.appendChild(el("rect", { x: ix + 10, y: Y(iy + it.y + 15), width: inner.w - 20,
      height: 15, rx: 7, fill: "#b9b2a4", stroke: stroke, "stroke-width": sw }));
  }
  if (it.type === "drawer") {
    const s = SLIDES[it.slide];
    wrap.appendChild(el("rect", { x: ix + s.sideDeduct, y: Y(iy + it.y + it.boxH),
      width: inner.w - 2 * s.sideDeduct, height: it.boxH,
      fill: "#e7dfcd", stroke: stroke, "stroke-width": sw }));
    wrap.appendChild(el("line", { x1: ix + s.sideDeduct + 14, y1: Y(iy + it.y + it.boxH / 2),
      x2: ix + inner.w - s.sideDeduct - 14, y2: Y(iy + it.y + it.boxH / 2),
      stroke: "#9a917f", "stroke-width": 4 }));
    wrap.appendChild(text(ix + inner.w / 2, Y(iy + it.y + it.boxH / 2) + 34,
      s.label, 26, "#8b8271", "middle"));
  }
  if (it.type === "mesh") {
    const mesh = meshCatalog().find(m => m.id === it.meshId) || { h: 150, label: "сетка" };
    const mh = mesh.h;
    const box = el("g", {});
    box.appendChild(el("rect", { x: ix + 6, y: Y(iy + it.y + mh), width: inner.w - 12,
      height: mh, fill: "none", stroke: stroke, "stroke-width": sw }));
    for (let k = 1; k < 6; k++) {
      box.appendChild(el("line", { x1: ix + 6 + (inner.w - 12) * k / 6, y1: Y(iy + it.y + mh),
        x2: ix + 6 + (inner.w - 12) * k / 6, y2: Y(iy + it.y), stroke: "#b3aa96", "stroke-width": 2 }));
    }
    box.appendChild(text(ix + inner.w / 2, Y(iy + it.y + mh) - 8, mesh.label, 26, "#8b8271", "middle"));
    wrap.appendChild(box);
  }
  /* размер y от дна секции для выбранного */
  if (selected) {
    dimV(g.ownerSVGElement || g, 0, 0, 0, ""); // noop, размеры рисует editor
  }
  g.appendChild(wrap);
}

function drawFacades(g, defs, used, project, mod, x, y0, Y, sel) {
  const faces = facadeSizes(project, mod);
  const decor = facadeDecorOf(project, mod);
  const tex = texPattern(decor, defs, used);
  const plinth = mod.kind === "base" ? CONST.plinthH : 0;
  let fx = x + 2;
  faces.forEach((f, idx) => {
    const fy = y0 + plinth + 2;
    const selectedF = sel && sel.modId === mod.id && sel.face === idx;
    const fg = el("g", { "data-mod": mod.id, "data-face": idx, cursor: "pointer" });
    fg.appendChild(el("rect", { x: fx, y: Y(fy + f.h), width: f.w, height: f.h,
      fill: "url(#" + tex + ")", "fill-opacity": 0.92,
      stroke: selectedF ? "var(--accent, #235b4e)" : "#5d564a",
      "stroke-width": selectedF ? 6 : 2 }));
    /* петли */
    const hinges = hingesFor(f.h);
    const hingeX = f.side === "left" ? fx + 14 : fx + f.w - 14;
    hinges.positions.forEach(p => {
      fg.appendChild(el("circle", { cx: hingeX, cy: Y(fy + f.h - p), r: 14,
        fill: "#4d463b" }));
    });
    /* ручка или push */
    if (mod.facade.opening === "handle") {
      const hx = f.side === "left" ? fx + f.w - 30 : fx + 30;
      fg.appendChild(el("rect", { x: hx - 6, y: Y(fy + f.h / 2 + 80), width: 12, height: 160,
        rx: 6, fill: "#3c362e" }));
    } else {
      fg.appendChild(text(fx + f.w / 2, Y(fy + f.h / 2), "push", 30, "#5d564a", "middle"));
    }
    g.appendChild(fg);
    fx += f.w + CONST.facade.gap;
  });
}

/* размерные линии */
function text(x, y, s, size, fill, anchor) {
  const t = el("text", { x: x, y: y, "font-size": size || 30, fill: fill || "#5c5647",
    "font-family": "Manrope, sans-serif", "text-anchor": anchor || "start" });
  t.textContent = s;
  return t;
}

function dim(svg, x1, x2, y, label, noArrows) {
  const g = el("g", { class: "dim" });
  g.appendChild(el("line", { x1: x1, y1: y, x2: x2, y2: y, stroke: "#9a917f", "stroke-width": 2 }));
  [x1, x2].forEach(x => g.appendChild(el("line", { x1: x, y1: y - 14, x2: x, y2: y + 14,
    stroke: "#9a917f", "stroke-width": 2 })));
  g.appendChild(text((x1 + x2) / 2, y - 12, label, 34, "#5c5647", "middle"));
  svg.appendChild(g);
}

function dimV(svg, y1mm, y2mm, x, label) {
  if (!svg.getAttribute) return;
  const vb = (svg.getAttribute("viewBox") || "0 0 0 0").split(" ").map(Number);
  const roomH = vb[3] - 260 * 1.4 + vb[1] + 260 * 0.6; // не критично: используется для стены
  const g = el("g", { class: "dim" });
  const Y1 = arguments.length >= 5 ? y1mm : y1mm;
  g.appendChild(el("line", { x1: x, y1: 0, x2: x, y2: y2mm, stroke: "#9a917f", "stroke-width": 2 }));
  g.appendChild(text(x + 14, y2mm / 2, label, 34, "#5c5647"));
  svg.appendChild(g);
}

function chainDims(svg, project, kind, startX, y) {
  let x = startX;
  const mods = project.modules.filter(m => m.kind === kind);
  if (!mods.length) return;
  for (const m of mods) {
    dim(svg, x, x + m.w, y, String(m.w));
    x += m.w;
  }
  if (mods.length > 1) dim(svg, startX, x, y + 70, "итого " + (x - startX));
}
