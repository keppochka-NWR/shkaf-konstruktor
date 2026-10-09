import test from 'node:test';
import assert from 'node:assert/strict';
import { facadeGeometry } from '../src/vernissageGeometry';
import { parts, parseVernissage, initialModule, type Module } from '../src/model';
import { kitchenBase } from '../src/kitchen';
import { newProject } from '../src/project';
import { estimate, lineGroup } from '../src/pricing';
import { vernissageLayout, vernissageFacadePrice, vernissageMilling, VERNISSAGE_MILLINGS, PROVISIONAL, type VernissageFacade } from '../src/facadesVernissage';

const SIZES: [number, number][] = [[300, 300], [450, 716], [597, 2000], [150, 716]];
const KINDS: [string, VernissageFacade['open']][] = [['15', 'solid'], ['1', 'solid'], ['3', 'solid'], ['54', 'solid'], ['52', 'solid'], ['W1', 'solid'], ['46', 'solid'], ['100', 'solid'], ['79', 'solid'], ['78/1', 'solid'], ['109', 'solid'], ['25', 'glass'], ['54', 'grille'], ['93', 'solid']];

/** Сетка замкнута и ориентирована: каждое направленное ребро встречается один раз и ровно один раз в обратную сторону. */
function checkMesh(g: ReturnType<typeof facadeGeometry>, label: string) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), key = (i: number) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const edges = new Map<string, number>();
  let vol = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    assert.ok(nx * n.getX(i) + ny * n.getY(i) + nz * n.getZ(i) > 0, `${label}: треугольник вывернут относительно нормали`);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const ks = [key(i), key(i + 1), key(i + 2)];
    for (let k = 0; k < 3; k++) { const e = ks[k] + '>' + ks[(k + 1) % 3]; edges.set(e, (edges.get(e) ?? 0) + 1); }
  }
  let open = 0, dup = 0;
  for (const [e, c] of edges) { if (c > 1) dup++; const [a, b] = e.split('>'); if (!edges.has(b + '>' + a)) open++; }
  return { vol, open, dup };
}

test('Вернисаж: геометрия строится под габарит — точный габарит, замкнутая сетка без вывернутых треугольников', () => {
  const bad: string[] = [];
  for (const [id, open] of KINDS) for (const [w, h] of SIZES) {
    const t = 19, L = vernissageLayout({ milling: id, cover: 'film', film: 'Моно белый', thickness: t, open }, w, h), g = facadeGeometry(L, 1), bb = g.boundingBox!;
    const label = `№${id} ${open} ${w}×${h}`;
    assert.ok(Math.abs(bb.max.x - bb.min.x - w) < 1e-3 && Math.abs(bb.max.y - bb.min.y - h) < 1e-3 && Math.abs(bb.max.z - bb.min.z - t) < 1e-3, `${label}: габарит ${bb.max.x - bb.min.x}×${bb.max.y - bb.min.y}×${bb.max.z - bb.min.z}`);
    const r = checkMesh(g, label);
    if (!(r.vol > 0 && r.vol <= w * h * t * 1.02)) bad.push(`${label}: объём ${r.vol}`);
    if (r.open || r.dup) bad.push(`${label}: незамкнутых рёбер ${r.open}, повторных ${r.dup}`);
  }
  assert.deepEqual(bad, []);
});

test('Вернисаж: рамка не меняет ширину при любом габарите, филёнка растягивается', () => {
  for (const id of ['54', '52', 'W1', '25', '75']) {
    const m = vernissageMilling(id)!, F = m.shape.inset!;
    for (const [w, h] of SIZES) {
      const L = vernissageLayout({ milling: id, cover: 'film', film: 'Моно белый', thickness: 19 }, w, h);
      assert.equal(L.frame, F, `№${id} ${w}×${h}`);
      assert.ok(Math.abs(L.opening!.x0 - (-w / 2 + F)) < 1e-9 && Math.abs(L.opening!.x1 - (w / 2 - F)) < 1e-9 && Math.abs(L.opening!.y0 - (-h / 2 + F)) < 1e-9, `№${id} ${w}×${h}: проём`);
      const g = facadeGeometry(L, 1), p = g.getAttribute('position');
      let hit = false; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - (-w / 2 + F)) < 1e-3 && p.getZ(i) < 19 / 2 - 1) { hit = true; break; }
      assert.ok(hit, `№${id} ${w}×${h}: кромка филёнки на расстоянии ${F} от края`);
    }
  }
  assert.equal(PROVISIONAL.frame, 60);
});

test('Вернисаж: рейки — шаг постоянный, число пазов по ширине', () => {
  const a = vernissageLayout({ milling: '79', cover: 'film', film: 'Моно белый', thickness: 19 }, 300, 716).rails!, b = vernissageLayout({ milling: '79', cover: 'film', film: 'Моно белый', thickness: 19 }, 597, 716).rails!;
  const step = (r: typeof a) => r.grooves[1][0] - r.grooves[0][0];
  assert.ok(Math.abs(step(a) - step(b)) < 1e-9);
  assert.ok(b.grooves.length > a.grooves.length);
});

test('Вернисаж: цена по прайсу 10.08.2026 — три ручных расчёта', () => {
  // 1) Стандарт №1, плёнка «Моно белый» (кат. 2 → «Категория ПВХ 2, Моно»), 19 мм: 4800 ₽/м² × 0,45×0,716 = 0,3222 м²
  const a = vernissageFacadePrice({ milling: '1', cover: 'film', film: 'Моно белый', thickness: 19 }, 450, 716);
  assert.equal(a.perM2, 4800); assert.equal(a.total, Math.round(4800 * 0.3222 * 100) / 100);
  // 2) Оптима №25, «Шато мята» (кат. 5), 16 мм, под стекло (+10 %): 8010 × 1,1 = 8811; 300×300 = 0,09 → как 0,3 м² (ПВХ) = 2643,3
  const b = vernissageFacadePrice({ milling: '25', cover: 'film', film: 'Шато мята', thickness: 16, open: 'glass' }, 300, 300);
  assert.equal(b.perM2, 8811); assert.equal(b.billArea, 0.3); assert.equal(b.total, 2643.3);
  // 3) Престиж №72, эмаль мат 19 мм, с двух сторон (+50 %) и лак (+800): 12630 × 1,5 + 800 = 19745; 0,597×2 = 1,194 м² → 23575,53 (эмаль — без минимума)
  const c = vernissageFacadePrice({ milling: '72', cover: 'enamel-matte', thickness: 19, twoSided: true, lacquer: true }, 597, 2000);
  assert.equal(c.perM2, 19745); assert.equal(c.total, 23575.53);
  // 4) Адилет: Оптима №22, «Плёнка мат. Carbon CBR-1 Эгрет» (кат. 3), 19 мм: 7470 ₽/м² (лист «Прайс Адилет» R22)
  const d = vernissageFacadePrice({ milling: '22', cover: 'adilet', film: 'Плёнка мат. Carbon CBR-1 Эгрет', thickness: 19 }, 450, 716);
  assert.equal(d.perM2, 7470); assert.ok(d.notes.some((n) => n.includes('+5')));
  // 5) МДФ 25 мм: +40 % к 16 мм — Стандарт №1, Моно белый: 4600 × 1,4 = 6440
  assert.equal(vernissageFacadePrice({ milling: '1', cover: 'film', film: 'Моно белый', thickness: 25 }, 450, 716).perM2, 6440);
  // ограничения прайса — предупреждения
  assert.ok(vernissageFacadePrice({ milling: '72', cover: 'film', film: 'Моно белый', thickness: 16 }, 400, 700).warnings.some((w) => w.includes('19')));
  assert.ok(vernissageFacadePrice({ milling: '78', cover: 'enamel-gloss', thickness: 19 }, 400, 700).warnings.some((w) => w.includes('матовая')));
});

test('Вернисаж в модуле: фасады — сторонний участок со своей ценой; без выбора детали шкафа не меняются', () => {
  const p = newProject(), base = parts(p.modules[0].module);
  const m: Module = { ...p.modules[0].module, vernissage: { milling: '54', cover: 'film', film: 'Моно белый', thickness: 19 }, facadeT: 19 };
  const ps = parts(m), facades = ps.filter((x) => x.role === 'door' || x.id.endsWith(':facade'));
  assert.ok(facades.length > 0 && facades.every((x) => x.vernissage && x.external && x.edge.every((e) => e === 0)));
  assert.ok(base.every((x) => !x.vernissage));
  const e = estimate({ ...p, modules: [{ ...p.modules[0], module: m }] }), line = e.lines.find((l) => l.id.startsWith('vernissage:54'));
  assert.ok(line && line.unitPrice === 7580, 'Престиж 19 мм, кат. 2 → «Категория ПВХ 2,3» 7580 ₽/м²');
  const area = facades.reduce((s, x) => s + Math.max(x.size[0] * x.size[1] / 1e6, 0.3), 0);
  assert.ok(Math.abs(line.quantity - area) < 0.01);
  assert.ok(!e.lines.some((l) => l.id === 'facade-external'));
  assert.equal(lineGroup(line.id), 'material', 'фасады Вернисажа — в «Материалах», не в фурнитуре');
  const hinges = ps.filter((x) => x.id.includes(':hingecup:')).length, boring = e.lines.find((l) => l.id === 'vernissage-hinge-boring');
  assert.ok(hinges > 0 && boring?.quantity === hinges && boring.unitPrice === 40, 'присадка под петли 40 ₽/шт по числу петель');
  assert.deepEqual(parseVernissage(JSON.parse(JSON.stringify(m.vernissage))), m.vernissage);
});

test('Вернисаж на кухне: двери и фасады ящиков нижнего модуля получают фрезеровку, раскладка строится под их размер', () => {
  const v: VernissageFacade = { milling: '3', cover: 'enamel-matte', enamelColor: 'RAL 9003', thickness: 19 };
  for (const kind of ['doors', 'drawers'] as const) {
    const m = { ...kitchenBase(initialModule(), 600, kind), vernissage: v, facadeT: 19 }, fs = parts(m).filter((x) => x.role === 'door' || x.id.endsWith(':facade'));
    assert.ok(fs.length > 0 && fs.every((x) => x.vernissage && x.external), kind);
    for (const f of fs) { const g = facadeGeometry(vernissageLayout(v, f.size[0], f.size[1], f.size[2])), bb = g.boundingBox!; assert.ok(Math.abs(bb.max.x - bb.min.x - f.size[0]) < 1e-3 && Math.abs(bb.max.y - bb.min.y - f.size[1]) < 1e-3, f.id); }
  }
});

test('Вернисаж: каталог — все фрезеровки прайса со своей раскладкой', () => {
  assert.equal(VERNISSAGE_MILLINGS.length, 97);
  for (const m of VERNISSAGE_MILLINGS) { const L = vernissageLayout({ milling: m.id, cover: 'film', film: 'Моно белый', thickness: 19 }, 450, 716); assert.ok(facadeGeometry(L).getAttribute('position').count > 0, m.id); }
});
