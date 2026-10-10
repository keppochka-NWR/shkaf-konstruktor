import test from 'node:test';
import assert from 'node:assert/strict';
import { facadeGeometry, offsetContour, signedArea, rectContour, archContour, concaveRectContour, type Feature, type P } from '../src/vernissageGeometry';
import { parts, parseVernissage, initialModule, validate, type Module } from '../src/model';
import { kitchenBase } from '../src/kitchen';
import { newProject } from '../src/project';
import { estimate, estimateCSV, lineGroup } from '../src/pricing';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V_FILM_COLORS, V_TEXTURES } from '../src/vernissageTextures';
import { vernissageTexture, vernissageColor, VERNISSAGE_FILMS } from '../src/facadesVernissage';
import { vernissageLayout, vernissageFacadePrice, vernissageMilling, vernissageSizeCheck, openings, coversOf, filmCatsOf, thicknessesOf, normalizeVernissage, DEFAULT_VERNISSAGE, PET_DECORS, VERNISSAGE_SERIES, VERNISSAGE_MILLINGS, PROVISIONAL, type VernissageFacade } from '../src/facadesVernissage';

const SIZES: [number, number][] = [[300, 300], [450, 716], [597, 2000], [150, 716]];
const KINDS: [string, VernissageFacade['open']][] = [['15', 'solid'], ['1', 'solid'], ['3', 'solid'], ['54', 'solid'], ['52', 'solid'], ['W1', 'solid'], ['46', 'solid'], ['100', 'solid'], ['79', 'solid'], ['78/1', 'solid'], ['109', 'solid'], ['25', 'glass'], ['54', 'grille'], ['93', 'solid']];

/** Сетка замкнута и ориентирована: каждое направленное ребро встречается один раз и ровно один раз в обратную сторону.
 *  up/down — площадь проекции на плоскость фасада лицевых (n.z > 0) и тыльных (n.z < 0) треугольников: у тела без вывернутых
 *  и наложенных треугольников обе равны площади тела в плане (рельеф фасада — «высотное поле», без поднутрений). */
function checkMesh(g: ReturnType<typeof facadeGeometry>, label: string) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), key = (i: number) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const edges = new Map<string, number>();
  let vol = 0, up = 0, down = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    assert.ok(nx * n.getX(i) + ny * n.getY(i) + nz * n.getZ(i) > 0, `${label}: треугольник вывернут относительно нормали`);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    if (nz > 0) up += nz / 2; else down -= nz / 2;
    const ks = [key(i), key(i + 1), key(i + 2)];
    for (let k = 0; k < 3; k++) { const e = ks[k] + '>' + ks[(k + 1) % 3]; edges.set(e, (edges.get(e) ?? 0) + 1); }
  }
  let open = 0, dup = 0;
  for (const [e, c] of edges) { if (c > 1) dup++; const [a, b] = e.split('>'); if (!edges.has(b + '>' + a)) open++; }
  return { vol, open, dup, up, down };
}
/** Площадь тела в плане по раскладке: полотно минус сквозные проёмы, плюс стекло и планки решётки (отдельные тела). */
function footprint(L: ReturnType<typeof vernissageLayout>) {
  let s = L.w * L.h;
  const walk = (f: Feature) => { for (const k of f.kids ?? []) { if (k.through) s -= Math.abs(signedArea(offsetContour(k.c, k.path[k.path.length - 1][0]))); walk(k); } };
  walk(L.root);
  if (L.glass) s += Math.abs(signedArea(L.glass.c));
  for (const b of L.bars) s += (b.x1 - b.x0) * (b.y1 - b.y0);
  return s;
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

test('Вернисаж: все фрезеровки каталога × 150×300, 300×300, 450×716, 597×2000, 1170×2750 × исполнения × МДФ 16/19/25 — сетка замкнута, рёбра парные, нет вывернутых треугольников, объём положительный', () => {
  const bad: string[] = [];
  let n = 0;
  // + фасад ящика 596×176 и узкая дверь 316×756 (арки и глубокие профили паспортов на малых габаритах)
  for (const m of VERNISSAGE_MILLINGS) for (const open of openings(m)) for (const [w, h] of [[150, 300], [300, 300], [450, 716], [597, 2000], [1170, 2750], [596, 176], [316, 756]] as const) for (const t of [16, 19, 25] as const) {
    const label = `№${m.id} ${open} ${w}×${h}×${t}`, L = vernissageLayout({ milling: m.id, cover: 'film', film: 'Моно белый', thickness: t, open }, w, h), r = checkMesh(facadeGeometry(L, 1), label), f = footprint(L), tol = 0.5 + 1e-7 * w * h;
    n++;
    if (r.open || r.dup) bad.push(`${label}: непарных рёбер ${r.open}, повторных ${r.dup}`);
    if (!(r.vol > 0) || r.vol > w * h * t * 1.0001) bad.push(`${label}: объём ${r.vol.toFixed(0)}`);
    if (Math.abs(r.up - f) > tol || Math.abs(r.down - f) > tol) bad.push(`${label}: вывернутые/наложенные треугольники — проекция лица ${r.up.toFixed(1)}, тыла ${r.down.toFixed(1)} при площади в плане ${f.toFixed(1)}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(VERNISSAGE_MILLINGS.filter((m) => !['handle', 'pet'].includes(m.series)).length === 97 && n >= 97 * 5 * 3, `проверено вариантов ${n}`);
  // №59: вогнутые углы филёнки — контур проёма в углу уходит внутрь (точка проёма на диагонали угла дальше от угла, чем у прямоугольника)
  const L = vernissageLayout({ milling: '59', cover: 'film', film: 'Моно белый', thickness: 19 }, 597, 2000), c = L.root.kids![0].c, F = L.frame!;
  assert.ok(vernissageMilling('59')!.shape.cornerKind === 'concave');
  const cx = -597 / 2 + F, cy = -2000 / 2 + F;
  assert.ok(!c.some(([x, y]) => Math.hypot(x - cx, y - cy) < 13.9), 'у угла проёма вырезана четверть круга');
});

test('Вернисаж: смещение контура не выворачивается — радиус max(0, r − d), вырожденный контур честно сходится', () => {
  /** Ни одна сторона не сменила направление, площадь не отрицательная, точек столько же. */
  const sound = (c: P[], o: number, label: string) => {
    const d = offsetContour(c, o);
    assert.equal(d.length, c.length, label);
    assert.ok(signedArea(d) >= -1e-9, `${label}: площадь ${signedArea(d)}`);
    for (let i = 0; i < c.length; i++) { const j = (i + 1) % c.length; assert.ok((c[j][0] - c[i][0]) * (d[j][0] - d[i][0]) + (c[j][1] - c[i][1]) * (d[j][1] - d[i][1]) >= -1e-9, `${label}: сторона ${i} вывернута`); }
    return d;
  };
  // скругление r = 14 внутрь на 25 (случай №59 до исправления): углы прямые (радиус 0), прямоугольник меньше на 25 с каждой стороны
  const r14 = sound(rectContour(-100, -200, 100, 200, 14), -25, 'r14 −25'), bb = (c: P[]) => [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))];
  assert.deepEqual(bb(r14).map((x) => Math.round(x * 1e6) / 1e6), [-75, 75, -175, 175]);
  assert.ok(Math.abs(signedArea(r14) - 150 * 350) < 1e-6, 'радиус после смещения 0 — площадь прямоугольника');
  // r − d > 0: радиус уменьшается на d
  const r30 = sound(rectContour(-100, -200, 100, 200, 30), -10, 'r30 −10');
  assert.ok(Math.abs(signedArea(r30) - (180 * 380 - (4 - Math.PI) * 20 * 20)) < 30, 'радиус 20 после смещения на 10');
  // смещение больше половины стороны: контур сходится в отрезок (площадь 0), а не выворачивается
  for (const r of [0, 6]) assert.ok(Math.abs(signedArea(sound(rectContour(-20, -50, 20, 50, r), -30, `узкий r${r} −30`))) < 1e-6);
  // вогнутые углы и арки (смещение на ус): стороны не выворачиваются при глубоком смещении внутрь и наружу
  for (const o of [-25, -12, 9]) sound(concaveRectContour(-150, -300, 150, 300, 14), o, `вогнутые ${o}`);
  for (const o of [-40, -25, 4, 9]) { sound(archContour(-120, -300, 120, 300, 40, 18, 28), o, `арка с плечиками ${o}`); sound(archContour(-40, -100, 40, 100, 12, 0, 8), o, `узкая арка ${o}`); }
});

test('Вернисаж: по паспорту PDF — рамка и профиль по числам паспорта, не меняются с габаритом; мелкий фасад — отступы пропорционально', () => {
  // W1: рамка 50, профиль 30 (W1.pdf); №25: 49 + 32 + 9 (25.pdf); №75: кант 15, уступ 3 мм (75.pdf, «глубина фрезы 3 мм»); №3: 49 + 32
  for (const [id, F, E] of [['W1', 50, 80], ['25', 49, 93], ['75', 15, 18], ['3', 49, 81]] as const) for (const [w, h] of [[450, 716], [597, 2000], [300, 300]]) {
    const L = vernissageLayout({ milling: id, cover: 'film', film: 'Моно белый', thickness: 19 }, w, h), label = `№${id} ${w}×${h}`;
    assert.equal(L.frame, F, label);
    assert.ok(Math.abs(L.opening!.x0 - (-w / 2 + E)) < 1e-6, `${label}: филёнка в ${E} мм от кромки`);
    assert.ok(!L.notes.some((n) => n.includes('уменьшен')), label);
  }
  const m75 = vernissageMilling('75')!;
  assert.deepEqual(m75.shape.face!.pts, [[15, 0], [18, 3]], 'глубина 3 мм — из примечания паспорта');
  assert.ok(m75.pp!.source.includes('75.pdf') && m75.pp!.source.includes('стр. 1'));
  // узкий фасад: отступы рисунка уменьшаются пропорционально, филёнка не меньше 30 мм
  const n = vernissageLayout({ milling: 'W1', cover: 'film', film: 'Моно белый', thickness: 19 }, 150, 716);
  assert.ok(n.frame! < 50 && n.notes.some((x) => x.includes('уменьшен')) && n.opening!.x1 - n.opening!.x0 >= 30 - 1e-6);
});

test('Вернисаж: ограничения размеров из паспортов PDF — проверка проекта и предупреждения', () => {
  assert.equal(VERNISSAGE_MILLINGS.filter((m) => m.pp).length, 55, 'фрезеровок с паспортом PDF');
  for (const m of VERNISSAGE_MILLINGS.filter((x) => x.pp)) assert.ok(/\.pdf, стр\. 1/.test(m.pp!.source), `№${m.id}: источник — файл и страница`);
  // №86: на карточке сайта PDF №76 — своих размеров нет, рисунок условный
  assert.ok(!vernissageMilling('86')!.pp && vernissageMilling('86')!.pdfNote!.includes('76'));
  // №3 (3.pdf): глухой 246–2750 × 246–1000, витрина/решётка от 296, ящик 116–246; «Ящик < Min размера изготавливается без фрезеровки»
  assert.deepEqual(vernissageSizeCheck('3', 'solid', 450, 716).errors, []);
  assert.ok(vernissageSizeCheck('3', 'solid', 450, 2800).errors[0].includes('2750'));
  assert.ok(vernissageSizeCheck('3', 'solid', 1100, 716).errors[0].includes('1000'));
  assert.ok(vernissageSizeCheck('3', 'glass', 260, 716).errors[0].includes('витрина'));
  assert.equal(vernissageSizeCheck('3', 'solid', 596, 177).row, 'drawer');
  const small = vernissageSizeCheck('3', 'solid', 596, 100);
  assert.ok(small.smooth && small.errors.length === 0 && small.warnings[0].includes('без фрезеровки'));
  // меньше минимума ящика — фасад без фрезеровки (в 3D гладкий)
  const L = vernissageLayout({ milling: '3', cover: 'film', film: 'Моно белый', thickness: 19 }, 596, 100);
  assert.ok(L.root.kids!.length === 0 && L.notes.some((x) => x.includes('без фрезеровки')));
  // №6 (6.pdf): решётка «-» — в исполнениях её нет; №78: только глухой
  assert.deepEqual(openings(vernissageMilling('6')!), ['solid', 'glass']);
  assert.deepEqual(openings(vernissageMilling('78')!), ['solid']);
  assert.ok(vernissageSizeCheck('6', 'grille', 450, 716).errors[0].includes('не делается'));
  // №45 (45-BIG.pdf): max 2450×1100 или 2750×1000
  assert.deepEqual(vernissageSizeCheck('45', 'solid', 1050, 2400).errors, []);
  assert.ok(vernissageSizeCheck('45', 'solid', 1050, 2600).errors.length === 1);
  // проверка проекта: кухонная бутылочница 150 с №3 — фасад уже 246 мм по паспорту — ошибка; №1 (паспорта нет) — без ограничений
  const narrow = { ...kitchenBase(initialModule(), 150, 'doors'), vernissage: { milling: '3', cover: 'film', film: 'Моно белый', thickness: 19 } as VernissageFacade, facadeT: 19 };
  assert.ok(validate(narrow).some((e) => e.includes('Вернисаж') && e.includes('246')), validate(narrow).join('; '));
  assert.ok(!validate({ ...narrow, vernissage: { ...narrow.vernissage, milling: '1' } }).some((e) => e.includes('Вернисаж')));
  // шапка паспорта: №113 — МДФ 22 мм; №78 — эмаль только матовая
  assert.ok(vernissageFacadePrice({ milling: '113', cover: 'film', film: 'Моно белый', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('22')));
});

test('Вернисаж: рамка не меняет ширину при любом габарите, филёнка растягивается (условные, без паспорта)', () => {
  for (const id of ['54', '52']) {
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

test('Вернисаж: интегрированная ручка V5/V6/V7 и ПЭТ на PUR-клее — в каталоге и в выборе, цены по прайсу (R46–R57)', () => {
  for (const id of ['V5', 'V6', 'V7', 'ПЭТ']) assert.ok(vernissageMilling(id), id);
  assert.equal(VERNISSAGE_SERIES.length, 6);
  // ручка, плёнка ПВХ: «2, 3 категория» 8930, «5, 6 категория» 9840 ₽/м² (R49), только 19 мм
  const a = vernissageFacadePrice({ milling: 'V5', cover: 'film', film: 'Моно айс', thickness: 19 }, 450, 716);
  assert.equal(a.perM2, 8930); assert.deepEqual(a.warnings, []);
  assert.equal(vernissageFacadePrice({ milling: 'V6', cover: 'film', film: 'Сиена айс', thickness: 19 }, 450, 716).perM2, 9840);
  assert.equal(vernissageFacadePrice({ milling: 'V5', cover: 'film', film: 'Карамель глянец', thickness: 19 }, 450, 716).perM2, null, 'категории 4 у ручки нет');
  assert.deepEqual(filmCatsOf('V5'), ['2', '3', '5', '6']);
  // колонка «V5» листа категорий: «Кантри Мята» — нет
  assert.ok(vernissageFacadePrice({ milling: 'V5', cover: 'film', film: 'Кантри Мята', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('V5')));
  // эмалевый участок (R54): без покрытия 6520, мат 11190, глянец 12230; минимум 0,3 м² — только ПВХ
  const e = vernissageFacadePrice({ milling: 'V7', cover: 'none', thickness: 19 }, 300, 300);
  assert.equal(e.perM2, 6520); assert.equal(e.billArea, 0.09);
  assert.equal(vernissageFacadePrice({ milling: 'V7', cover: 'enamel-matte', thickness: 19 }, 450, 716).perM2, 11190);
  assert.equal(vernissageFacadePrice({ milling: 'V7', cover: 'enamel-gloss', thickness: 19 }, 450, 716).perM2, 12230);
  assert.deepEqual(thicknessesOf('V5'), [19]);
  // ПЭТ на PUR-клее 18 мм: 7200 ₽/м² (R57), 13 декоров, без минимума площади
  const p = vernissageFacadePrice({ milling: 'ПЭТ', cover: 'pet', film: 'Луара', thickness: 18 }, 300, 300);
  assert.equal(p.perM2, 7200); assert.equal(p.billArea, 0.09); assert.equal(PET_DECORS.length, 13);
  assert.deepEqual(thicknessesOf('ПЭТ'), [18]); assert.deepEqual(coversOf('ПЭТ'), ['pet']);
  // смена серии на ПЭТ приводит выбор к допустимому: покрытие ПЭТ, декор из списка, 18 мм
  assert.deepEqual(normalizeVernissage({ milling: 'ПЭТ', cover: 'enamel-matte', thickness: 19, twoSided: true }), { milling: 'ПЭТ', cover: 'pet', film: 'Луара', thickness: 18 });
  for (const id of ['V5', 'ПЭТ']) { const g = facadeGeometry(vernissageLayout(normalizeVernissage({ ...DEFAULT_VERNISSAGE, milling: id }), 450, 716)), r = checkMesh(g, id); assert.equal(r.open + r.dup, 0, id); }
  // ручка: профиля на сайте нет — паз-выборка по верхнему краю на всю ширину с условными размерами из PROVISIONAL, пометка «размеры условные»
  for (const id of ['V5', 'V6', 'V7']) {
    const m = vernissageMilling(id)!, L = vernissageLayout({ milling: id, cover: 'film', film: 'Моно айс', thickness: 19 }, 450, 716), H = PROVISIONAL.handle;
    assert.equal(m.shape.kind, 'handle', id); assert.ok(m.shapeNote.includes('размеры условные'), id);
    assert.deepEqual(L.handle, { y0: 716 / 2 - H.h, y1: 716 / 2, depth: H.d }, id);
    const g = facadeGeometry(L, 1), p = g.getAttribute('position'), bb = g.boundingBox!;
    assert.ok(Math.abs(bb.max.x - bb.min.x - 450) < 1e-3 && Math.abs(bb.max.y - bb.min.y - 716) < 1e-3 && Math.abs(bb.max.z - bb.min.z - 19) < 1e-3, `${id}: габарит`);
    // дно выборки — на глубине d от лица у верхней кромки по всей ширине; ниже выборки лицо фасада целое
    let floorL = false, floorR = false, faceUnder = false;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(y - 716 / 2) < 1e-3 && Math.abs(z - (19 / 2 - H.d)) < 1e-3) { if (Math.abs(x + 225) < 1e-3) floorL = true; if (Math.abs(x - 225) < 1e-3) floorR = true; }
      if (Math.abs(y + 716 / 2) < 1e-3 && Math.abs(z - 19 / 2) < 1e-3) faceUnder = true;
    }
    assert.ok(floorL && floorR && faceUnder, `${id}: выборка по верхнему краю на всю ширину`);
  }
  // низкий фасад ящика: выборка не больше трети высоты; совсем узкий — честно гладкий с пометкой
  assert.equal(vernissageLayout({ milling: 'V6', cover: 'none', thickness: 19 }, 600, 60).handle!.y1 - vernissageLayout({ milling: 'V6', cover: 'none', thickness: 19 }, 600, 60).handle!.y0, 20);
  const tiny = vernissageLayout({ milling: 'V7', cover: 'none', thickness: 19 }, 600, 20); assert.ok(!tiny.handle && tiny.notes.some((x) => x.includes('не помещается')));
  assert.deepEqual(parseVernissage({ milling: 'ПЭТ', cover: 'pet', film: 'Луара', thickness: 18 }), { milling: 'ПЭТ', cover: 'pet', film: 'Луара', thickness: 18 });
});

test('Вернисаж: правила прайса — эмаль №44/№58 (R28), Лайн/Сиена у Премиума (R38), №109 в Адилет (R27), 16 мм без петель (R26), сброс покрытия', () => {
  // R28: «без декора: №44», «без решёток: №58» — в эмали исполняются, с ограничением
  assert.ok(coversOf('44').includes('enamel-matte') && coversOf('44').includes('enamel-gloss'));
  assert.ok(vernissageFacadePrice({ milling: '44', cover: 'enamel-matte', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('без декора')));
  assert.ok(vernissageFacadePrice({ milling: '58', cover: 'enamel-matte', thickness: 19, open: 'grille' }, 450, 716).warnings.some((w) => w.includes('без решёток')));
  assert.ok(!vernissageFacadePrice({ milling: '58', cover: 'enamel-matte', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('без решёток')));
  // R38: вся серия Премиум не рекомендуется в Лайн и Сиена
  assert.ok(vernissageFacadePrice({ milling: '75', cover: 'film', film: 'Лайн белый', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('Лайн')));
  assert.ok(vernissageFacadePrice({ milling: '90', cover: 'film', film: 'Сиена айс', thickness: 19 }, 450, 716).warnings.some((w) => w.includes('Лайн')));
  // Премиум: колонки категории 4 нет — в выборе её нет
  assert.ok(!filmCatsOf('75').includes('4'));
  // Адилет R27: №109 — МДФ 19 с петлями
  assert.ok(vernissageFacadePrice({ milling: '109', cover: 'adilet', film: 'Плёнка мат. Carbon CBR-1 Эгрет', thickness: 16 }, 450, 716).warnings.some((w) => w.includes('19')));
  // R26: «только МДФ 19» — если есть петли; 16 мм доступна (без петель), с предупреждением
  assert.ok(thicknessesOf('72').includes(16));
  // смена фрезеровки: эмали глянец у №75 нет — покрытие сбрасывается на допустимое (список и расчёт совпадают)
  for (const [id, cover] of [['75', 'enamel-gloss'], ['54', 'enamel-matte']] as const) { const n = normalizeVernissage({ milling: id, cover, thickness: 19 }); assert.ok(coversOf(id).includes(n.cover), id); assert.ok(vernissageFacadePrice(n, 450, 716).perM2 !== null, id); }
  // неизвестный номер из файла — не хранится (подпись и геометрия от одной фрезеровки)
  assert.equal(parseVernissage({ milling: '999', cover: 'film', thickness: 19 }).milling, '1');
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

test('Вернисаж: шкаф по умолчанию, №86, эмаль мат с двух сторон — фасады в цене клиента в обеих моделях (по листам — закупка × коэффициент сверху листов)', () => {
  const p = newProject(), m: Module = { ...p.modules[0].module, vernissage: { milling: '86', cover: 'enamel-matte', thickness: 19, twoSided: true }, facadeT: 19 };
  const base = { ...p, calculation: { ...(p.calculation ?? { markup: 2.2, overrides: {} }), model: 'sheet' as const } };
  const plain = estimate(base), withV = estimate({ ...base, modules: [{ ...p.modules[0], module: m }] });
  const cost = withV.lines.filter((l) => l.id.startsWith('vernissage')).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
  assert.ok(cost > 20000, `закупка фасадов ${cost}`);
  // фасады Вернисажа сверху листов — закупка × свой коэффициент 1,6 (решение Макса 10.10.2026), не общий 2,2
  assert.equal(withV.vernissageMarkup, 1.6);
  assert.equal(withV.bySheet, withV.ldspSheets * withV.sheetPrice + withV.retailExtras + Math.round(cost * 1.6 / 100) * 100);
  assert.equal(withV.vernissageOnTop, Math.round(cost * 1.6 / 100) * 100);
  assert.ok(withV.bySheet > plain.bySheet, `цена по листам ${plain.bySheet} → ${withV.bySheet}: фасады не должны удешевлять шкаф`);
  // цена клиента (retail) в модели «по листам» — с фасадами: листы те же (фасады вне раскроя ЛДСП), разница — фасады × коэффициент
  assert.equal(withV.retail, withV.bySheet);
  assert.equal(withV.retail! - plain.retail!, (withV.ldspSheets - plain.ldspSheets) * withV.sheetPrice + withV.vernissageOnTop);
  // закупка фасадов остаётся в себестоимости сметы (не розничная строка)
  assert.ok(withV.lines.filter((l) => l.id.startsWith('vernissage')).every((l) => !l.retail) && withV.knownCost >= Math.round(cost));
  // модель наценки: фасады в «Материалах» по своему коэффициенту 1,6 — цена клиента тоже с фасадами
  const mkBase = estimate(p), mk = estimate({ ...p, modules: [{ ...p.modules[0], module: m }] });
  assert.equal(mk.model, 'markup'); assert.equal(mk.retail, mk.byMarkup);
  assert.ok(mk.retail !== null && mk.retail > mkBase.retail!, `цена по коэффициенту ${mkBase.retail} → ${mk.retail}`);
  assert.ok(mk.split.materialCost >= Math.round(cost) - 1, 'закупка фасадов — в материалах');
  // CSV сметы показывает, что фасады идут сверху листов
  assert.ok(estimateCSV({ ...base, modules: [{ ...p.modules[0], module: m }] }).includes('сверху фасады Вернисаж'));
});

test('Вернисаж: цена клиенту = закупка × 1,6 (решение Макса 10.10.2026) в обеих моделях — ручной пример', () => {
  // Шкаф по умолчанию, Стандарт №1, плёнка «Моно белый» (кат. 2 → «Категория ПВХ 2, Моно»), МДФ 19 мм: 4800 ₽/м².
  // Фасады: дверь 596×1968 = 1,1729 м²; два ящика 546×177 = 0,0966 м² → ПВХ меньше 0,3 м² — по 0,3 м². Итого 1,773 м² × 4800 = 8510,40 ₽.
  // Присадка под петли: 5 петель × 40 ₽ = 200 ₽. Закупка Вернисажа: 8710,40 ₽ → клиенту × 1,6 = 13 936,64 → 13 900 ₽ (округление до 100, как у групп сметы).
  const p = newProject(), m: Module = { ...p.modules[0].module, vernissage: { milling: '1', cover: 'film', film: 'Моно белый', thickness: 19 }, facadeT: 19 };
  const q = { ...p, modules: [{ ...p.modules[0], module: m }] }, e = estimate(q);
  const f = e.lines.find((l) => l.id.startsWith('vernissage:1:'))!, b = e.lines.find((l) => l.id === 'vernissage-hinge-boring')!;
  assert.equal(f.unitPrice, 4800); assert.equal(f.quantity, 1.773);
  assert.equal(b.unitPrice, 40); assert.equal(b.quantity, 5);
  assert.equal(e.vernissageCost, 8710.4);
  assert.equal(e.vernissageMarkup, 1.6);
  assert.equal(e.vernissageOnTop, 13900);
  assert.ok(f.source.includes('× 1,6'), 'в строке сметы — закупка, пометка «клиенту × 1,6»');
  // модель «себестоимость × коэффициент»: материалы без Вернисажа × 2,2 + Вернисаж × 1,6; закупка Вернисажа остаётся в себестоимости материалов
  const own = Math.round(e.lines.filter((l) => !l.retail && lineGroup(l.id) === 'material' && !l.id.startsWith('vernissage')).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0));
  assert.equal(e.split.material, Math.round(own * 2.2 / 100) * 100 + 13900);
  assert.ok(e.split.materialCost >= own + 8710);
  assert.equal(e.byMarkup, e.split.material + e.split.hardware);
  // модель «цена за лист»: листы × 23 000 + фасады Вернисаж 13 900 сверху
  const s = estimate({ ...q, calculation: { markup: 2.2, overrides: {}, model: 'sheet' } });
  assert.equal(s.vernissageOnTop, 13900);
  assert.equal(s.bySheet, s.ldspSheets * 23000 + s.retailExtras + 13900);
  assert.equal(s.retail, s.bySheet);
  // свой коэффициент проекта (calculation.vernissageMarkup): 8710,40 × 1,8 = 15 678,72 → 15 700
  assert.equal(estimate({ ...q, calculation: { markup: 2.2, overrides: {}, vernissageMarkup: 1.8 } }).vernissageOnTop, 15700);
  assert.ok(estimateCSV(q).includes('коэффициент Вернисажа'));
});

test('Вернисаж: текстуры плёнок с сайта — файл есть, масштаб в мм, UV по образцу; однотонные и ПЭТ — цвет образца', () => {
  const names = Object.keys(V_TEXTURES);
  assert.ok(names.length >= 30, `текстур ${names.length}`);
  for (const n of names) {
    const t = V_TEXTURES[n], p = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'vernissage', t.file);
    assert.ok(existsSync(p), `${n}: нет файла ${t.file}`);
    assert.ok(VERNISSAGE_FILMS.some((f) => f.name === n), `${n}: плёнка из прайса`);
    assert.ok(t.tileMm >= 150 && t.tileMm <= 400 && /^https:\/\/vernisag-fasad\.ru\//.test(t.src), `${n}: ${t.tileMm} мм, ${t.src}`);
  }
  // Дуб Турин — карточка №15, квадрат 700 px × 0,49 мм/px ≈ 343 мм
  const tex = vernissageTexture({ milling: '1', cover: 'film', film: 'Дуб Турин', thickness: 19 })!;
  assert.equal(tex.url, 'textures/vernissage/dub-turin.jpg'); assert.equal(tex.tileMm, 343);
  // UV в образцах: фасад 450×716 → по ширине 450/343 образца, текстура повторяется, не растягивается под габарит
  const g = facadeGeometry(vernissageLayout({ milling: '1', cover: 'film', film: 'Дуб Турин', thickness: 19 }, 450, 716), 1, tex.tileMm), uv = g.getAttribute('uv');
  let umax = -Infinity, vmax = -Infinity; for (let i = 0; i < uv.count; i++) { umax = Math.max(umax, uv.getX(i)); vmax = Math.max(vmax, uv.getY(i)); }
  assert.ok(Math.abs(umax - 450 / 343) < 1e-6 && Math.abs(vmax - 716 / 343) < 1e-6, `${umax} ${vmax}`);
  // эмаль, Адилет, софт/глянец — без текстуры
  assert.equal(vernissageTexture({ milling: '1', cover: 'enamel-matte', thickness: 19 }), null);
  assert.equal(vernissageTexture({ milling: '1', cover: 'film', film: 'Белый глянец', thickness: 19 }), null);
  // однотонные: цвет образца с сайта (карточка «Белый глянец», плакат ПЭТ «Монблан»)
  assert.equal(vernissageColor({ milling: '1', cover: 'film', film: 'Белый глянец', thickness: 19 }), parseInt(V_FILM_COLORS['Белый глянец'].color.slice(1), 16));
  assert.equal(vernissageColor({ milling: 'ПЭТ', cover: 'pet', film: 'Римо', thickness: 18 }), parseInt(V_FILM_COLORS['Римо'].color.slice(1), 16));
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
  // 97 фрезеровок серий прайса + интегрированная ручка V5/V6/V7 + ПЭТ на PUR-клее
  assert.equal(VERNISSAGE_MILLINGS.filter((m) => m.series !== 'handle' && m.series !== 'pet').length, 97);
  assert.equal(VERNISSAGE_MILLINGS.length, 101);
  for (const m of VERNISSAGE_MILLINGS) { const L = vernissageLayout({ milling: m.id, cover: 'film', film: 'Моно белый', thickness: 19 }, 450, 716); assert.ok(facadeGeometry(L).getAttribute('position').count > 0, m.id); }
});
