// СГЕНЕРИРОВАНО studio/scripts/build-facade-sheets.ts из studio/src/sheetCount.ts. Не править вручную.
"use strict";
var FacadeSheetCount = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/sheetCount.ts
  var sheetCount_exports = {};
  __export(sheetCount_exports, {
    SHEET_KERF: () => SHEET_KERF,
    SHEET_MARGIN: () => SHEET_MARGIN,
    classicSheets: () => classicSheets,
    fitsSheetPiece: () => fitsSheetPiece
  });

  // src/packing.ts
  var contains = (a, b) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
  function packRectangles(input, width, height, gap, order, fit) {
    if (![width, height, gap].every(Number.isFinite) || width <= 0 || height <= 0 || gap < 0) throw Error("Неверный формат листа.");
    if (new Set(input.map((r) => r.id)).size !== input.length) throw Error("Повторяются детали.");
    for (const r of input) if (![r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0 || (r.w > width || r.h > height) && !(r.rot && r.h <= width && r.w <= height)) throw Error("Деталь не помещается в лист.");
    const sorted = [...input].sort((a, b) => (order === "area" ? b.w * b.h - a.w * a.h : order === "height" ? b.h - a.h : b.w - a.w) || b.w * b.h - a.w * a.h || a.id.localeCompare(b.id));
    const bins = [];
    for (const r of sorted) {
      const variants = [];
      if (r.w <= width && r.h <= height) variants.push([r.w, r.h]);
      if (r.rot && r.w !== r.h && r.h <= width && r.w <= height) variants.push([r.h, r.w]);
      let best;
      for (const [vw, vh] of variants) {
        const rw = vw + gap, rh = vh + gap;
        for (const bin2 of bins) for (const f of bin2.free) {
          if (f.w < rw || f.h < rh) continue;
          const short = Math.min(f.w - rw, f.h - rh), area = f.w * f.h - rw * rh, score = fit === "short" ? short : area, secondary = fit === "short" ? area : short;
          if (!best || score < best.score || score === best.score && secondary < best.secondary) best = { bin: bin2, box: f, score, secondary, w: vw, h: vh };
        }
      }
      if (!best) {
        const bin2 = { items: [], free: [{ x: 0, y: 0, w: width + gap, h: height + gap }] };
        bins.push(bin2);
        const [vw, vh] = variants[0];
        best = { bin: bin2, box: bin2.free[0], score: 0, secondary: 0, w: vw, h: vh };
      }
      const { bin, box } = best, used = { x: box.x, y: box.y, w: best.w + gap, h: best.h + gap };
      bin.items.push({ id: r.id, w: best.w, h: best.h, x: used.x, y: used.y });
      const next = [];
      for (const f of bin.free) {
        if (used.x >= f.x + f.w || used.x + used.w <= f.x || used.y >= f.y + f.h || used.y + used.h <= f.y) {
          next.push(f);
          continue;
        }
        if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
        if (used.x + used.w < f.x + f.w) next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
        if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
        if (used.y + used.h < f.y + f.h) next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
      }
      bin.free = next.filter((f, i) => f.w > 0 && f.h > 0 && !next.some((other, j) => j !== i && contains(other, f) && (!contains(f, other) || j < i)));
    }
    return bins.map((b) => b.items);
  }

  // src/sheetCount.ts
  var SHEET_MARGIN = 10;
  var SHEET_KERF = 4;
  function fitsSheetPiece(d, width, height) {
    const long = height - 2 * SHEET_MARGIN, short = width - 2 * SHEET_MARGIN;
    if (![d.h, d.w].every((n) => Number.isFinite(n) && n > 0)) return false;
    return d.h <= long && d.w <= short || d.rot && d.w <= long && d.h <= short;
  }
  function baseline(pieces, width, height, gap) {
    const M = SHEET_MARGIN, result = [];
    for (const d of [...pieces].sort((a, b) => b.h * b.w - a.h * a.w)) {
      if (d.w > width - 2 * M || d.h > height - 2 * M) continue;
      let best;
      for (const s2 of result) s2.free.forEach((f2, i2) => {
        if (f2.w >= d.w && f2.h >= d.h) {
          const score = f2.w * f2.h - d.w * d.h;
          if (!best || score < best.score) best = { s: s2, i: i2, score };
        }
      });
      if (!best) {
        const s2 = { items: [], free: [{ x: M, y: M, w: width - 2 * M, h: height - 2 * M }] };
        result.push(s2);
        best = { s: s2, i: 0, score: 0 };
      }
      const { s, i } = best, f = s.free.splice(i, 1)[0];
      s.items.push(d.id);
      const rw = f.w - d.w - gap, bh = f.h - d.h - gap;
      if (rw > 0) s.free.push({ x: f.x + d.w + gap, y: f.y, w: rw, h: d.h });
      if (bh > 0) s.free.push({ x: f.x, y: f.y + d.h + gap, w: f.w, h: bh });
    }
    return result.map((s) => s.items);
  }
  function classicSheets(pieces, width, height, gap = SHEET_KERF) {
    const fit = pieces.filter((d) => fitsSheetPiece(d, width, height)), unplaced = pieces.filter((d) => !fitsSheetPiece(d, width, height)).map((d) => d.id);
    if (!fit.length) return { sheets: [], unplaced };
    const base = baseline(fit, width, height, gap);
    let best = base.reduce((n, s) => n + s.length, 0) === fit.length ? { ids: base, footprint: Infinity } : null;
    const M = SHEET_MARGIN;
    for (const g of gap < 10 ? [gap, 10] : [gap]) for (const order of ["area", "height", "width"]) for (const rule of ["short", "area"]) {
      const packed = packRectangles(fit.map((d) => ({ id: d.id, w: d.w, h: d.h, rot: d.rot })), width - 2 * M, height - 2 * M, g, order, rule);
      if (best && packed.length > best.ids.length) continue;
      const footprint = Math.max(...packed.at(-1).map((p) => p.y + M + p.h));
      if (!best || packed.length < best.ids.length || footprint < best.footprint) best = { ids: packed.map((s) => s.map((p) => p.id)), footprint };
    }
    return { sheets: best.ids, unplaced };
  }
  return __toCommonJS(sheetCount_exports);
})();
if(typeof module==="object"&&module.exports)module.exports=FacadeSheetCount;
