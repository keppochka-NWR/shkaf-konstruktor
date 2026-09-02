/* Раскрой: гильотинная укладка полосами (FFDH) с учётом пропила.
   Детали НЕ вращаются - текстура вдоль длинной стороны листа (правило цеха).
   Деталь кладётся так, как записана в спецификации: w вдоль листа, h поперёк. */

function nestParts(parts, sheetW, sheetH, kerf) {
  // parts: [{w,h,label}], каждая деталь отдельным прямоугольником
  const sorted = parts.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  const sheets = [];

  function newSheet() {
    const s = { strips: [], usedH: 0, placed: [] };
    sheets.push(s);
    return s;
  }

  for (const p of sorted) {
    if (p.w > sheetW || p.h > sheetH) { p.oversize = true; continue; }
    let placed = false;
    for (const sheet of sheets) {
      // в существующую полосу
      for (const strip of sheet.strips) {
        if (p.h <= strip.h && strip.x + p.w <= sheetW) {
          sheet.placed.push({ x: strip.x, y: strip.y, w: p.w, h: p.h, label: p.label });
          strip.x += p.w + kerf;
          placed = true;
          break;
        }
      }
      if (placed) break;
      // новая полоса на листе
      if (sheet.usedH + p.h <= sheetH) {
        const strip = { y: sheet.usedH, h: p.h, x: p.w + kerf };
        sheet.strips.push(strip);
        sheet.placed.push({ x: 0, y: strip.y, w: p.w, h: p.h, label: p.label });
        sheet.usedH += p.h + kerf;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet = newSheet();
      const strip = { y: 0, h: p.h, x: p.w + kerf };
      sheet.strips.push(strip);
      sheet.placed.push({ x: 0, y: 0, w: p.w, h: p.h, label: p.label });
      sheet.usedH = p.h + kerf;
    }
  }

  const partArea = parts.filter(p => !p.oversize).reduce((s, p) => s + p.w * p.h, 0);
  const sheetArea = sheets.length * sheetW * sheetH;
  return {
    sheets: sheets,
    count: sheets.length,
    kim: sheetArea ? partArea / sheetArea : 0,
    oversize: parts.filter(p => p.oversize),
  };
}

/* раскладка всей спецификации по материалам:
   корпусные детали - декор корпуса; фасады - по декору фасадов; ХДФ отдельно */
function cuttingPlan(project) {
  const spec = specification(project);
  const groups = {};   // key -> {label, sheetW, sheetH, price, parts[]}

  function groupFor(key, label, sheetW, sheetH, price) {
    if (!groups[key]) groups[key] = { key, label, sheetW, sheetH, price, parts: [] };
    return groups[key];
  }

  const facadeDecors = {};
  project.modules.forEach(m => { facadeDecors[m.id] = facadeDecorOf(project, m); });

  let modIdx = 0;
  const modFacade = {};
  project.modules.forEach((m, i) => {
    modFacade[(m.kind === "base" ? "Нижний " : "Верхний ") + (i + 1)] = facadeDecorOf(project, m);
  });

  for (const p of spec.panels) {
    const many = [];
    for (let q = 0; q < p.qty; q++) many.push({ w: p.w, h: p.h, label: p.part });
    if (p.material === "ЛХДФ 3") {
      groupFor("hdf", "ЛХДФ 3 мм", CONST.sheet.hdf.w, CONST.sheet.hdf.h,
        CONST.pricing.hdfSheet).parts.push(...many);
    } else if (p.part === "Фасад") {
      const decor = modFacade[p.mod] || project.facadeDecor;
      groupFor("f_" + decor, "ЛДСП 16 · фасады · " + decor, CONST.sheet.w, CONST.sheet.h,
        CONST.pricing.ldspSheet[decor] || CONST.pricing.defaultSheet).parts.push(...many);
    } else {
      const decor = project.bodyDecor;
      groupFor("b_" + decor, "ЛДСП 16 · корпус · " + decor, CONST.sheet.w, CONST.sheet.h,
        CONST.pricing.ldspSheet[decor] || CONST.pricing.defaultSheet).parts.push(...many);
    }
  }

  const out = [];
  for (const key in groups) {
    const g = groups[key];
    const nest = nestParts(g.parts, g.sheetW, g.sheetH, CONST.sheet.kerf);
    out.push({ label: g.label, sheetW: g.sheetW, sheetH: g.sheetH, price: g.price,
               parts: g.parts.length, result: nest });
  }
  return out;
}
