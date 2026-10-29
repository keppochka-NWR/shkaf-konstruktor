// Повторная проверка критика 29.10 (круг 2), находка D: «Опустить полки под скос» не исправлял: штангу без полок и без заданной высоты,
// ящики комода, выдвижные тремпели — пересечение с крышей оставалось; держатели штанги в крыше не проверялись. После кнопки сквозь
// крышу не остаётся ничего, или кнопка отказывает с причиной.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { mansardIntrusions } from '../src/shapes';
import { fitUnderMansard } from '../src/paletteBuild';
import { createModule } from '../src/ModulePalette';

const left = (m: Module) => mansardIntrusions(m, parts(m)).filter((x) => x.error).map((x) => `${x.part.name} +${x.over}`);
const wardrobe = (sec: Partial<Module['sections'][number]>, depth = 600): Module => ({ ...initialModule(), name: 'М', width: 900, height: 2400, depth, doors: false, sections: [{ ...section(), ...sec }] });
function fixed(m: Module, tag: string) {
  assert.ok(validate(m).some((e) => /пересекает крышу/.test(e)), tag + ': до кнопки — ошибка «пересекает крышу»');
  const f = fitUnderMansard(m);
  assert.deepEqual(left(f), [], tag + ': сквозь крышу ничего');
  assert.deepEqual(validate(f), [], tag + ': модель без ошибок');
  return f;
}

test('D1: штанга без полок и без заданной высоты, 900×2400×600, сзади 2000 — после кнопки под крышей (было: «Штанга выше скоса на 155 мм»)', () => {
  const m = { ...wardrobe({ shelves: [], rod: true }), mansard: { rear: 2000 } };
  assert.match(validate(m).join(' '), /«Штанга» выше скоса мансарды на 155 мм/);
  const f = fixed(m, 'штанга');
  assert.ok(f.sections[0].rodAt! < 0.97 && f.sections[0].rod, 'штанга осталась, ниже');
});
test('D2: комод 800×1000×550 с мансардой сзади 900 — короб верхнего ящика ниже, фасады те же (было: «Ящик 3 выше скоса на 75 мм»)', () => {
  const k = createModule('drawers', 800, 1000, 550, initialModule());
  const m = { ...k, mansard: { rear: 900 } };
  assert.match(validate(m).join(' '), /«Ящик 3» выше скоса мансарды на 75 мм/);
  const f = fixed(m, 'комод');
  const faces = (x: Module) => parts(x).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => [p.position[1] - p.size[1] / 2, p.position[1] + p.size[1] / 2]);
  const a = faces(m), b = faces(f);
  assert.equal(b.length, 3, 'ящики на месте');
  b.forEach((x, j) => assert.ok(Math.abs(x[1] - a[j][1]) < 0.05 && Math.abs(x[0] - a[j][0]) <= 1.05, `фасад ${j + 1}: ${a[j]} → ${x}`));
  assert.ok(f.sections[0].drawerConfigs![2].height < k.sections[0].drawerConfigs![2].height, 'короб верхнего ящика ниже');
  for (const [H, rear] of [[1000, 950], [1200, 1000], [1500, 1300], [1000, 600]]) fixed({ ...createModule('drawers', 800, H, 550, initialModule()), mansard: { rear } }, `комод ${H}, сзади ${rear}`);
});
test('D3: выдвижные тремпели 900×2400×600, сзади 2000 — верхняя полка под скосом, тремпели под ней (было: +404 мм)', () => {
  const m = { ...wardrobe({ shelves: [0.9], pullouts: 3 }), mansard: { rear: 2000 } };
  const f = fixed(m, 'тремпели');
  assert.equal(f.sections[0].pullouts, 3);
  assert.ok(Math.max(...f.sections[0].shelves) >= 0.6);
  // скос ниже 0,6 высоты секции у задней кромки — отказ с причиной
  assert.throws(() => fitUnderMansard({ ...wardrobe({ shelves: [0.9], pullouts: 3 }), mansard: { rear: 1400 } }), /Под скос не встают выдвижные тремпели: .*0,6 высоты секции/);
});
test('D4: держатели штанги — тоже под крышей: штанга на 0,9, глубина 600, сзади 2000 — держатели 15 мм в крыше теперь ошибка, кнопка исправляет', () => {
  const m = { ...wardrobe({ shelves: [], rod: true, rodAt: 0.9 }), mansard: { rear: 2000 } };
  assert.match(validate(m).join(' '), /«Фланец штанги D25» выше скоса мансарды на 15 мм у задней кромки — пересекает крышу/);
  fixed(m, 'держатели');
});
test('D: перебор наполнения × глубина × задняя высота — после кнопки сквозь крышу ничего или отказ с причиной', () => {
  const variants: Partial<Module['sections'][number]>[] = [
    { shelves: [0.2, 0.4, 0.6, 0.8, 0.92] }, { shelves: [0.85], rod: true }, { shelves: [], rod: true, rodAt: 0.9 }, { shelves: [], rod: true },
    { shelves: [], drawers: 5 }, { shelves: [0.5, 0.9], drawers: 3 }, { shelves: [0.9], pullouts: 3 }, { shelves: [0.95], pantograph: true, rodAt: 0.85 },
  ];
  let fixedN = 0, refused = 0;
  for (const v of variants) for (const D of [350, 600]) for (const rear of [400, 700, 1100, 1400, 1600, 1800, 2000, 2200, 2340]) {
    const base = wardrobe({ rod: false, ...v }, D);
    if (validate(base).length) continue;
    const m = { ...base, mansard: { rear } }, v0 = validate(m);
    if (!v0.some((e) => /пересекает крышу/.test(e))) continue;
    try { const f = fitUnderMansard(m); assert.deepEqual(left(f), [], `${JSON.stringify(v)} D${D} сзади ${rear}`); assert.deepEqual(validate(f), [], `${JSON.stringify(v)} D${D} сзади ${rear}`); fixedN++; }
    catch (e) { if (e instanceof assert.AssertionError) throw e; assert.match((e as Error).message, /^Под скос не встаю?т/); refused++; }
  }
  assert.ok(fixedN >= 40, `исправлено ${fixedN}, отказов ${refused}`);
});
