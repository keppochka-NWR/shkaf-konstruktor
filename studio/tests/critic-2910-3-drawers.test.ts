// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): равные фасады комода при «+/−» — тестом, воспроизводящим находку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, validate, boxes, facadeTop, facadeBottom, hasDrawerCap, isAutoDrawerLayout, type Module } from '../src/model';
import { createModule } from '../src/ModulePalette';
import { setDrawerCount, roofDrawers } from '../src/drawerModes';

// ───────── 3. комод: «+/−» — фасады равные и до крыши ─────────
function faceStats(m: Module) {
  const s = m.sections[0], b = boxes(m)[0];
  const f = parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).map((p) => [p.position[1] - p.size[1] / 2, p.size[1]] as const).sort((a, z) => a[0] - z[0]);
  const gaps = f.slice(1).map((x, i) => x[0] - f[i][0] - f[i][1]);
  return { n: s.drawers, hs: f.map((x) => x[1]), gaps, sum: f.reduce((a, x) => a + x[1], 0) + gaps.reduce((a, x) => a + x, 0), column: facadeTop(m) - Math.min(facadeBottom(m), b.bottom), lo: f[0]?.[0] ?? 0, cap: hasDrawerCap(m, s) };
}
function assertEven(m: Module, tag: string) {
  const st = faceStats(m);
  assert.equal(st.hs.length, st.n, tag + ': фасад у каждого ящика');
  assert.ok(Math.max(...st.hs) - Math.min(...st.hs) <= 1, `${tag}: фасады равны — ${st.hs.join('/')}`);
  if (st.gaps.length) assert.ok(Math.max(...st.gaps) - Math.min(...st.gaps) < 0.01, `${tag}: зазоры одинаковые — ${st.gaps.join(',')}`);
  assert.ok(Math.abs(st.sum - st.column) < 0.01, `${tag}: фасады + зазоры ${st.sum} = столбец фасадов ${st.column} (без щели)`);
  assert.equal(st.cap, false, tag + ': без полки и открытой ниши над ящиками');
  assert.deepEqual(validate(m), [], tag);
  assert.ok(roofDrawers(m, m.sections[0]) && (st.n < 2 || isAutoDrawerLayout(m, m.sections[0])), tag + ': расстановка «по правилу» до крыши — следующий «+/−» снова поровну');
}
test('блокер 3: случаи критика — «−/+» у комода дают равные фасады без щели или понятный отказ', () => {
  const cases: [number, number, number[], (number | 'err')[]][] = [
    [800, 1000, [-1, -1, +1, +1], [2, 'err', 3, 4]],
    [1000, 1200, [-1], [3]],
    [600, 1500, [-1, -1, -1], [4, 3, 2]],
    [600, 850, [+1, +1], [4, 'err']],
    [400, 600, [+1], ['err']],
  ];
  for (const [w, h, steps, expect] of cases) {
    const m = createModule('drawers', w, h, 550, initialModule());
    assertEven(m, `${w}×${h} старт`);
    steps.forEach((d, i) => {
      const before = JSON.stringify(m.sections[0]);
      try { setDrawerCount(m, m.sections[0].id, m.sections[0].drawers + d); assert.notEqual(expect[i], 'err', `${w}×${h} шаг ${i + 1}: ждали отказ`); assertEven(m, `${w}×${h} шаг ${i + 1}`); assert.equal(m.sections[0].drawers, expect[i]); }
      catch (e) { if (e instanceof assert.AssertionError) throw e; assert.equal(expect[i], 'err', `${w}×${h} шаг ${i + 1}: ${(e as Error).message}`); assert.match((e as Error).message, /не встают: при \d ящик/); assert.equal(JSON.stringify(m.sections[0]), before, 'при отказе секция не меняется'); }
    });
  }
  // было: 800×1000 «−» → 404/338 и щель 224 мм; теперь — 482,5/482,5 до крыши
  const m = createModule('drawers', 800, 1000, 550, initialModule()); setDrawerCount(m, m.sections[0].id, 2);
  assert.deepEqual(faceStats(m).hs, [482.5, 482.5]);
});
test('блокер 3: все сочетания высот 400–1500 × 1–6 ящиков — фасады равны (±1 мм), фасады + зазоры = столбец фасадов', () => {
  let ok = 0, refused = 0;
  for (let H = 400; H <= 1500; H += 25) {
    for (const W of [400, 800]) {
      const m = createModule('drawers', W, H, 550, initialModule());
      const sid = m.sections[0].id;
      assertEven(m, `${W}×${H} старт ${m.sections[0].drawers}`);
      // вниз до 1 и вверх до 6 (предел студии — RULES.maxDrawers = 5: шестой не добавляется)
      for (const target of [...Array.from({ length: m.sections[0].drawers }, (_, k) => m.sections[0].drawers - k - 1).filter((n) => n >= 1), 2, 3, 4, 5, 6]) {
        const before = JSON.stringify(m.sections[0]), from = m.sections[0].drawers;
        const n = Math.min(target, 5);
        if (n === from) { assert.equal(target > 5 ? m.sections[0].drawers : n, Math.min(5, m.sections[0].drawers)); continue; }
        try { setDrawerCount(m, sid, n); assertEven(m, `${W}×${H}: ${from}→${n}`); ok++; }
        catch (e) { if (e instanceof assert.AssertionError) throw e; assert.match((e as Error).message, /не встают/, `${W}×${H}: ${from}→${n}`); assert.equal(JSON.stringify(m.sections[0]), before); refused++; }
      }
      assert.ok(m.sections[0].drawers <= 5);
    }
  }
  assert.ok(ok > 300, `сочетаний с равными фасадами: ${ok}, отказов с причиной: ${refused}`);
});
