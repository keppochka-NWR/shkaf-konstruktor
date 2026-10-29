// Фасады по списку Макса 29.10.2026 (ветка claude/fix-facades-2910):
//  1) алюминиевые рамочные фасады — высота почти по максимуму листа стекла поставщика;
//  2) фрезеровки «Ёлочка» (№83) и «Диагональ» (№88) — рисунок по паспорту PDF, а не упрощение;
//  3) эмаль — цвет по RAL (полный RAL Classic), плёнка — из каталога Вернисажа, в 3D — выбранный цвет/образец.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vernissageLayout, vernissageFacadePrice, vernissageMilling, type VernissageFacade } from '../src/facadesVernissage';
import type { Feature, P } from '../src/vernissageGeometry';

const V = (milling: string): VernissageFacade => ({ milling, cover: 'film', film: 'Моно белый', thickness: 19 });
/** Ось паза: самая удалённая пара точек контура. */
function axis(c: P[]): [P, P] {
  let best: [P, P] = [c[0], c[0]], d = -1;
  for (const a of c) for (const b of c) { const dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (dd > d) { d = dd; best = [a, b]; } }
  return best;
}
const kids = (L: ReturnType<typeof vernissageLayout>): Feature[] => L.root.kids ?? [];

test('№83 «Ёлочка»: пазы зигзагом (изломы по ширине), шаг 14 по высоте, а не горизонтальные рейки', () => {
  const m = vernissageMilling('83')!;
  assert.equal(m.shape.kind, 'relief');
  assert.equal(m.shape.relief?.dir, 'chevron');
  for (const [w, h] of [[396, 716], [596, 1796], [446, 296]] as const) {
    const L = vernissageLayout(V('83'), w, h), ks = kids(L);
    assert.equal(L.rails, undefined, `${w}×${h}: не рейки`);
    assert.ok(ks.length >= Math.floor(h / 14) - 6, `${w}×${h}: пазов ${ks.length}`);
    // у паза в середине высоты верхняя кромка ломается: подъём и спуск чередуются, изломов не меньше 3
    const mid = ks.reduce((a, k) => (Math.abs(k.c[0][1]) < Math.abs(a.c[0][1]) ? k : a));
    const xs = mid.c.map((p) => p[0]), span = Math.max(...xs) - Math.min(...xs);
    assert.ok(span > w - 40, `${w}×${h}: паз во всю ширину поля (${span.toFixed(0)})`);
    const ys = mid.c.map((p) => p[1]), rise = Math.max(...ys) - Math.min(...ys);
    assert.ok(rise > 20, `${w}×${h}: перепад зигзага ${rise.toFixed(1)} мм`);
    let turns = 0;
    for (let i = 1; i + 1 < mid.c.length; i++) { const a = mid.c[i - 1], b = mid.c[i], c = mid.c[i + 1]; const s1 = Math.sign(b[1] - a[1]), s2 = Math.sign(c[1] - b[1]); if (s1 && s2 && s1 !== s2 && Math.abs(b[0] - a[0]) > 1 && Math.abs(c[0] - b[0]) > 1) turns++; }
    assert.ok(turns >= 3, `${w}×${h}: изломов ${turns}`);
  }
  // цена не меняется — та же колонка прайса серии Престиж
  assert.equal(vernissageFacadePrice(V('83'), 596, 1796).perM2, 7580);
});

test('№88 «Диагональ»: главная диагональ из верхнего правого угла, под ней «/», над ней треугольник с горизонталями и клин «\\»', () => {
  for (const [w, h] of [[396, 716], [596, 1796]] as const) {
    const L = vernissageLayout(V('88'), w, h), ks = kids(L);
    const dirs = { h: 0, up: 0, down: 0 };
    let topH = 0;
    for (const k of ks) {
      const [a, b] = axis(k.c), dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.abs(dy) < 0.05 * Math.abs(dx)) { dirs.h++; if (Math.min(a[1], b[1]) > h / 2 - w / 2 - 5) topH++; }
      else if (dx * dy > 0) dirs.up++; else dirs.down++;
    }
    assert.ok(dirs.h >= 4, `${w}×${h}: горизонтальных пазов ${dirs.h}`);
    assert.ok(dirs.down >= 4, `${w}×${h}: пазов «\\» ${dirs.down}`);
    assert.ok(dirs.up >= 10, `${w}×${h}: пазов «/» ${dirs.up}`);
    assert.equal(topH, dirs.h, `${w}×${h}: горизонтали — только в верхнем треугольнике`);
    // главный паз «/» проходит у верхнего правого угла
    assert.ok(ks.some((k) => { const [a, b] = axis(k.c); const hi = a[1] > b[1] ? a : b; return (b[0] - a[0]) * (b[1] - a[1]) > 0 && hi[0] > w / 2 - 15 && hi[1] > h / 2 - 15; }), `${w}×${h}: главная диагональ из угла`);
  }
  assert.equal(vernissageFacadePrice(V('88'), 596, 1796).perM2, 7580);
});

test('Эмаль по RAL: полный RAL Classic (216), поиск по коду и названию, подпись с названием в смете, цвет в 3D по каталогу', async () => {
  const { RAL_CLASSIC, ralSearch, ralOf, ralValue, enamelColorLabel } = await import('../src/ralClassic');
  const { vernissageColor, vernissageLabel } = await import('../src/facadesVernissage');
  assert.equal(RAL_CLASSIC.length, 216);
  assert.equal(new Set(RAL_CLASSIC.map((r) => r.code)).size, 216, 'коды без повторов');
  assert.ok(RAL_CLASSIC.every((r) => /^#[0-9a-f]{6}$/.test(r.hex) && r.name.length > 2));
  for (const g of '123456789') assert.ok(RAL_CLASSIC.some((r) => r.code[0] === g), `группа ${g}xxx`);
  assert.equal(ralSearch('9003')[0].code, '9003');
  assert.deepEqual(ralSearch('RAL 70').map((r) => r.code).slice(0, 3), ['7000', '7001', '7002']);
  assert.ok(ralSearch('антрацит').some((r) => r.code === '7016'));
  assert.ok(ralSearch('слоновая кость').length >= 2);
  assert.equal(ralOf('ral9005')?.code, '9005');
  assert.equal(ralValue(ralOf('9010')!), 'RAL 9010');
  assert.equal(enamelColorLabel('RAL 9003'), 'RAL 9003 Сигнальный белый');
  assert.equal(enamelColorLabel('NCS S 0502-Y'), 'NCS S 0502-Y', 'не RAL — как введено');
  const v: VernissageFacade = { milling: '15', cover: 'enamel-matte', enamelColor: 'RAL 5015', thickness: 19 };
  assert.equal(vernissageColor(v), 0x007cb0, 'цвет 3D — по каталогу RAL');
  assert.match(vernissageLabel(v), /эмаль мат RAL 5015 Небесно-синий/);
  // цена не зависит от цвета эмали
  assert.equal(vernissageFacadePrice(v, 450, 716).total, vernissageFacadePrice({ ...v, enamelColor: 'RAL 9003' }, 450, 716).total);
});

test('Плёнка из каталога Вернисажа: у каждой плёнки ПВХ, Адилет и ПЭТ есть образец (текстура/цвет с сайта или условный цвет с пометкой)', async () => {
  const { filmSwatch, filmCatalog, VERNISSAGE_FILMS, ADILET_FILMS, PET_DECORS } = await import('../src/facadesVernissage');
  const { V_TEXTURES } = await import('../src/vernissageTextures');
  const all = [...VERNISSAGE_FILMS.map((f) => ['film', f.name] as const), ...ADILET_FILMS.map((f) => ['adilet', f.name] as const), ...PET_DECORS.map((n) => ['pet', n] as const)];
  assert.ok(all.length >= 260 + 500 + 13);
  const kinds = { texture: 0, photo: 0, name: 0 };
  for (const [cover, name] of all) {
    const s = filmSwatch(cover, name);
    assert.match(s.color, /^#[0-9a-f]{6}$/, `${name}: цвет`);
    kinds[s.kind]++;
    if (s.kind === 'texture') assert.ok(s.url && V_TEXTURES[name], `${name}: текстура`);
  }
  assert.equal(kinds.texture, Object.keys(V_TEXTURES).length);
  assert.ok(kinds.photo >= 18 && kinds.name > 0);
  // условный цвет по названию — правдоподобный: белые светлые, чёрные тёмные, мята зеленее серого
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  assert.ok(lum(filmSwatch('film', 'Лайн белый').color) > 200 && lum(filmSwatch('film', 'Шарли чёрный').color) < 70);
  assert.ok(lum(filmSwatch('film', 'Дуб Галиано темный').color) < lum(filmSwatch('film', 'Дуб Галиано светлый').color));
  const mint = parseInt(filmSwatch('film', 'Шарли эвкалипт').color.slice(1), 16);
  assert.ok(((mint >> 8) & 255) > (mint >> 16), 'эвкалипт — зеленоватый');
  // каталог в выборе — все плёнки категорий, разрешённых для фрезеровки (как в прайсе)
  const cat = filmCatalog({ milling: '1', cover: 'film', film: 'Моно белый', thickness: 19 });
  assert.equal(cat.length, VERNISSAGE_FILMS.length, 'у №1 (Стандарт) — все категории');
  assert.equal(filmCatalog({ milling: '1', cover: 'adilet', film: ADILET_FILMS[0].name, thickness: 19 }).length, ADILET_FILMS.length);
});
test('Эмаль: подпись RAL не теряет текст менеджера; NCS и #hex не принимаются за RAL (критик 29.10)', async () => {
  const { enamelColorLabel, ralOf } = await import('../src/ralClassic');
  const { vernissageColor } = await import('../src/facadesVernissage');
  assert.equal(enamelColorLabel('9003'), 'RAL 9003 Сигнальный белый');
  assert.equal(enamelColorLabel('RAL9003'), 'RAL 9003 Сигнальный белый');
  assert.equal(enamelColorLabel('RAL 9003 / RAL 7016'), 'RAL 9003 Сигнальный белый / RAL 7016');
  assert.equal(enamelColorLabel('RAL 9003 глянец 80%'), 'RAL 9003 Сигнальный белый глянец 80%');
  assert.equal(enamelColorLabel('RAL 9003 Сигнальный белый'), 'RAL 9003 Сигнальный белый');
  assert.equal(enamelColorLabel('1002-Y'), '1002-Y'); assert.equal(ralOf('1002-Y'), undefined);
  assert.equal(enamelColorLabel('NCS S 1002-Y'), 'NCS S 1002-Y');
  assert.equal(enamelColorLabel('9003AB'), '9003AB'); assert.equal(ralOf('9003AB'), undefined);
  assert.equal(ralOf('90031'), undefined);
  assert.equal(vernissageColor({ milling: '15', cover: 'enamel-matte', enamelColor: '9003ab', thickness: 19 }), 0x9003ab, '#hex — свой цвет');
  // поле в выборе не переписывает введённое при потере фокуса
  const src = (await import('node:fs')).readFileSync(new URL('../src/VernissagePicker.tsx', import.meta.url), 'utf8');
  assert.ok(!/onBlur=\{[^}]*enamelColor/.test(src), 'без перезаписи цвета эмали по onBlur');
});
test('Подсказки ALU без старого предела СТП 2000 (критик 29.10)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['../src/App.tsx', '../docs/WORKSHOP-RULES.md']) assert.ok(!/не выше 2000/.test(readFileSync(new URL(f, import.meta.url), 'utf8')), f);
});
test('ALU: лист 2550×1605 — из прайса (не «стандартный, не указан»); у заказных узорчатых — принят стандартный с пометкой', async () => {
  const { aluMaxHeight, DEFAULT_ALU, ALU_FILLS } = await import('../src/alu');
  for (const id of ['glass-clear', 'satin', 'lacobel-white', 'lacobel-black']) assert.equal(aluMaxHeight({ ...DEFAULT_ALU, insert: id }).standard, false, id);
  const hc = ALU_FILLS.find((f) => /^Hithicross/.test(f.label))!.id, g = aluMaxHeight({ ...DEFAULT_ALU, insert: hc });
  assert.deepEqual([g.standard, g.sheet[0]], [true, 2550]);
});
test('ALU: Мору (Флутис) на высоком фасаде — предупреждение о закалке под ответственность заказчика (в ведомости и выборе)', async () => {
  const { aluFillWarnings, ALU_FILLS, DEFAULT_ALU } = await import('../src/alu');
  const { initialModule, section } = await import('../src/model');
  const { newProject } = await import('../src/project');
  const { specificationHTML } = await import('../src/exports');
  const moru = ALU_FILLS.find((f) => /^Мору \(Флутис\)/.test(f.label))!.id;
  assert.equal(aluFillWarnings({ ...DEFAULT_ALU, insert: moru }, [2300]).length, 1);
  assert.deepEqual(aluFillWarnings({ ...DEFAULT_ALU, insert: moru }, [1800]), []);
  assert.deepEqual(aluFillWarnings(DEFAULT_ALU, [2300]), []);
  const m = { ...initialModule(), width: 440, height: 2400, sections: [{ ...section(), doorLeaves: 1 as const }], doors: true, alu: { ...DEFAULT_ALU, insert: moru } };
  const p = newProject(); p.modules[0].module = m;
  assert.match(specificationHTML(p), /Мору.*под ответственность заказчика/);
});