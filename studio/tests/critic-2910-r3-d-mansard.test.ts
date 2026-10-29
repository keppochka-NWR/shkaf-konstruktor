// Повторная проверка критика 29.10 (круг 3), D: 1) «Опустить полки под скос» давал модель с другой ошибкой (900×1600×600, 5 полок,
// сзади 700 → «между полками нужно ≥ 80 мм») — теперь результат проверяется, иначе отказ с причиной; 2) отказ по полке обрывался
// («…у задней кромки или увеличьте высоту сзади») — теперь «Уберите полку»; 3) комод после кнопки, затем «+/−» — ящики снова в крышу
// (800×1000, сзади 900, «+» → «Ящик 4 выше скоса на 75 мм») — теперь поровну под скосом или отказ с причиной.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { mansardIntrusions } from '../src/shapes';
import { fitUnderMansard } from '../src/paletteBuild';
import { setDrawerCount } from '../src/drawerModes';
import { createModule } from '../src/ModulePalette';

const left = (m: Module) => mansardIntrusions(m, parts(m)).filter((x) => x.error).map((x) => `${x.part.name} +${x.over}`);
const body = (H: number, D: number, sec: Partial<Module['sections'][number]>, rear: number): Module => ({ ...initialModule(), name: 'М', width: 900, height: H, depth: D, doors: false, sections: [{ ...section(), rod: false, ...sec }], mansard: { rear } });

test('D1: 900×1600×600, 5 полок, сзади 700 — не чужая ошибка «≥ 80 мм» после кнопки, а отказ: «уберите полки, встанет не больше N»', () => {
  const m = body(1600, 600, { shelves: [0.2, 0.4, 0.6, 0.8, 0.92] }, 700);
  assert.throws(() => fitUnderMansard(m), /Под скос не встают 5 полок секции 1: .*Уберите полки \(встанет не больше \d\)/);
});
test('D2: отказ по полке — с тем, что убрать: «…у задней кромки. Уберите полку или увеличьте высоту сзади»', () => {
  const m = body(1600, 600, { shelves: [0.85], rod: true }, 700);
  assert.throws(() => fitUnderMansard(m), /у задней кромки\. Уберите полку или увеличьте высоту сзади/);
});
test('D3: комод под мансардой после кнопки, затем «+/−» — ящики поровну под скосом или отказ с причиной, в крышу не уходят', () => {
  for (const [H, rear] of [[1000, 900], [1000, 700], [1200, 1000], [1500, 1300]] as const) {
    const f = fitUnderMansard({ ...createModule('drawers', 800, H, 550, initialModule()), mansard: { rear } });
    assert.deepEqual(validate(f), []);
    for (const d of [1, -1]) {
      const c = structuredClone(f), before = JSON.stringify(c.sections[0]);
      try { setDrawerCount(c, c.sections[0].id, c.sections[0].drawers + d); assert.deepEqual(left(c), [], `${H}/${rear} ${d > 0 ? '+' : '−'}`); assert.deepEqual(validate(c), [], `${H}/${rear} ${d > 0 ? '+' : '−'}`); }
      catch (e) { if (e instanceof assert.AssertionError) throw e; assert.match((e as Error).message, /не встают/); assert.equal(JSON.stringify(c.sections[0]), before, 'при отказе секция прежняя'); }
    }
  }
  // случай критика: 800×1000, сзади 900, «+» — 4 ящика под скосом (было: «Ящик 4 выше скоса на 75 мм»)
  const f = fitUnderMansard({ ...createModule('drawers', 800, 1000, 550, initialModule()), mansard: { rear: 900 } });
  setDrawerCount(f, f.sections[0].id, 4);
  assert.equal(f.sections[0].drawers, 4); assert.deepEqual(left(f), []); assert.deepEqual(validate(f), []);
});
test('D: перебор (наполнение × высота × глубина × сзади) — после кнопки модель без ошибок или отказ с причиной', () => {
  const variants: Partial<Module['sections'][number]>[] = [
    { shelves: [0.2, 0.4, 0.6, 0.8, 0.92] }, { shelves: [], rod: true }, { shelves: [], rod: true, rodAt: 0.9 }, { shelves: [0.85], rod: true },
    { shelves: [], drawers: 5 }, { shelves: [0.9], pullouts: 3 }, { shelves: [], pullouts: 2 }, { shelves: [0.95], pantograph: true, rodAt: 0.85 }, { shelves: [0.9], rod: true, rodAt: 0.85, rodLower: 0.4 },
  ];
  let ok = 0, refused = 0;
  for (const v of variants) for (const H of [2400, 1600]) for (const D of [350, 600]) for (const rear of [400, 500, 700, 900, 1100, 1300, 1500, 1800, 2000, 2200, 2340]) {
    if (rear > H - 50) continue;
    const m = body(H, D, v, rear), base = { ...m }; delete base.mansard;
    if (validate(base).length) continue;
    const v0 = validate(m); if (v0.some((e) => /скос круче|высота сзади/.test(e)) || !v0.some((e) => /пересекает крышу/.test(e))) continue;
    try { const f = fitUnderMansard(m); assert.deepEqual(validate(f), [], `${JSON.stringify(v)} H${H} D${D} сзади ${rear}`); ok++; }
    catch (e) { if (e instanceof assert.AssertionError) throw e; assert.match((e as Error).message, /^(Под скос не вста[ёю]т|«Опустить полки под скос» не помогает)/); assert.doesNotMatch((e as Error).message, /кромки или/); refused++; }
  }
  assert.ok(ok >= 50, `исправлено ${ok}, отказов ${refused}`);
});
