// Повторная проверка критика 29.10 (круг 2), находка C: 1) остаток деления фасадов по 0,5 мм уходил целиком верхнему фасаду —
// 800×902×550, 5 ящиков → 172/172/172/172/174 (182 таких случая в переборе); 2) высота фасада полем, затем «−» — один фасад 30…482,5 и
// открытая ниша 515 мм без ошибки и предупреждения (проверка щелей — только от 2 ящиков); «+» после правки — отказ «Ящики не до крыши».
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, validate, boxes, facadeTop, facadeBottom, hasDrawerCap, isAutoDrawerLayout, roofEvenLayout, evenFaceHeights, type Module } from '../src/model';
import { createModule } from '../src/ModulePalette';
import { setDrawerCount, roofDrawers } from '../src/drawerModes';
import { removePart } from '../src/operations';
import { facadeForVisible, visibleFacadeH } from '../src/drawerEditing';
import { drawerGapWarnings } from '../src/roomWarnings';
import { newProject, type Project } from '../src/project';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 0, y: 0, z: 0, rotation: 0, module: m }]; return p; };
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).map((p) => [p.position[1] - p.size[1] / 2, p.size[1]] as const).sort((a, z) => a[0] - z[0]);
const hs = (m: Module) => faces(m).map((f) => Math.round(f[1] * 10) / 10);
/** Фасады закрывают весь столбец фасадов секции (от низа фасадов до верха), без полки и ниши над ящиками. */
function closesColumn(m: Module, tag: string) {
  const f = faces(m), b = boxes(m)[0], lo = Math.min(facadeBottom(m), b.bottom), hi = facadeTop(m);
  assert.ok(Math.abs(f[0][0] - lo) < 0.05 && Math.abs(f.at(-1)![0] + f.at(-1)![1] - hi) < 0.05, `${tag}: фасады ${f[0][0]}…${f.at(-1)![0] + f.at(-1)![1]} = столбец ${lo}…${hi}`);
  assert.equal(hasDrawerCap(m, m.sections[0]), false, tag + ': без полки и ниши над ящиками');
  assert.deepEqual(validate(m), [], tag);
  assert.deepEqual(drawerGapWarnings(one(m)), [], tag + ': без щелей');
}

test('C1: остаток деления — по 0,5 мм верхним фасадам, разница фасадов ≤ 1 мм (800×902×550, 5 ящиков: было 172/172/172/172/174)', () => {
  const m = createModule('drawers', 800, 902, 550, initialModule());
  setDrawerCount(m, m.sections[0].id, 5);
  const h = hs(m);
  assert.ok(Math.max(...h) - Math.min(...h) <= 1, h.join('/'));
  assert.deepEqual(evenFaceHeights(862, 5, true), [172, 172, 172, 172, 174], 'прежнее деление — весь остаток верхнему');
  const e = evenFaceHeights(862, 5);
  assert.ok(Math.max(...e) - Math.min(...e) <= 1 && Math.abs(e.reduce((a, x) => a + x, 0) - 862) < 1e-9 && e.slice(0, -1).every((x) => (x * 2) % 1 === 0), e.join('/'));
});
test('C1: перебор высот через каждый мм 850–960 и с шагом 41 мм 300–1800, 2–5 ящиков — разница фасадов ≤ 1 мм', () => {
  const heights = [...Array.from({ length: 111 }, (_, k) => 850 + k), ...Array.from({ length: 37 }, (_, k) => 300 + 41 * k)];
  let checked = 0;
  for (const H of heights) for (const W of [300, 800]) {
    let m: Module; try { m = createModule('drawers', W, H, 550, initialModule()); } catch { continue; }
    for (const n of [2, 3, 4, 5]) {
      try { setDrawerCount(m, m.sections[0].id, n); } catch { continue; }
      const h = hs(m);
      assert.ok(Math.max(...h) - Math.min(...h) <= 1, `${W}×${H}, ${n} ящиков: ${h.join('/')}`);
      checked++;
    }
  }
  assert.ok(checked > 800, 'проверено сочетаний ' + checked);
});
test('C1: расстановка, сохранённая прежним делением (весь остаток верхнему), — по-прежнему «по правилу»: «+/−» снова поровну', () => {
  const m = createModule('drawers', 800, 902, 550, initialModule()), s = m.sections[0];
  setDrawerCount(m, s.id, 5);
  s.drawerConfigs = roofEvenLayout(m, s, { topRemainder: true });
  assert.deepEqual(hs(m), [172, 172, 172, 172, 174]);
  assert.ok(isAutoDrawerLayout(m, s) && roofDrawers(m, s));
  setDrawerCount(m, s.id, 4); closesColumn(m, '5 → 4');
});

test('C2: высота фасада полем, затем «−» — фасад на весь проём (снова поровну), а не 30…482,5 и ниша 515 мм', () => {
  const m = createModule('drawers', 800, 1000, 550, initialModule()), sid = m.sections[0].id;
  setDrawerCount(m, sid, 2);
  assert.deepEqual(hs(m), [482.5, 482.5]);
  const s = m.sections[0];
  s.drawerConfigs = facadeForVisible(m, s, 0, visibleFacadeH(m, s, 0)! - 30);
  assert.deepEqual(hs(m), [452.5, 512.5]);
  assert.equal(roofDrawers(m, m.sections[0]), false, 'после правки полем — не «по правилу»');
  // как было: «−» убирал верхний ящик и оставлял нижний — фасад 30…482,5, над ним полка и ниша 515 мм, без ошибки и предупреждения
  const old = structuredClone(m), os = old.sections[0];
  os.drawers = 1; os.drawerConfigs = os.drawerConfigs!.slice(0, 1);
  assert.equal(hasDrawerCap(old, os), true, 'находка воспроизводится: над ящиком встала полка');
  const w = drawerGapWarnings(one(old));
  assert.equal(w.length, 1, 'проверка щелей видит и один ящик');
  assert.match(w[0].message, /над ящиком 1 открытая ниша 51[56] мм без фасада/);
  // как теперь: «−» — один фасад на весь проём (968 > 800 — отказ с причиной, секция не меняется)
  const before = JSON.stringify(m.sections[0]);
  assert.throws(() => setDrawerCount(m, sid, 1), /не встают: при 1 ящике фасад ящика выйдет 968 мм/);
  assert.equal(JSON.stringify(m.sections[0]), before);
  // 3 ящика, высота фасада полем, «−» → 2 равных на весь проём
  const k = createModule('drawers', 800, 1000, 550, initialModule()), ks = k.sections[0];
  ks.drawerConfigs = facadeForVisible(k, ks, 1, visibleFacadeH(k, ks, 1)! - 30);
  assert.equal(roofDrawers(k, k.sections[0]), false);
  setDrawerCount(k, ks.id, 2);
  assert.deepEqual(hs(k), [482.5, 482.5]); closesColumn(k, '3 (полем) → «−»');
});
test('C2: «+» после правки высоты фасада полем — тоже снова поровну до крыши (было: отказ «Ящики не до крыши»)', () => {
  for (const [H, n] of [[700, 2], [1000, 2], [1000, 3], [1200, 4]] as const) {
    const m = createModule('drawers', 800, H, 550, initialModule()), sid = m.sections[0].id;
    setDrawerCount(m, sid, n);
    const s = m.sections[0];
    s.drawerConfigs = facadeForVisible(m, s, 0, visibleFacadeH(m, s, 0)! - 30);
    setDrawerCount(m, sid, n + 1);
    assert.equal(m.sections[0].drawers, n + 1);
    const h = hs(m); assert.ok(Math.max(...h) - Math.min(...h) <= 1, `${H}, ${n}+1: ${h.join('/')}`);
    closesColumn(m, `${H}: ${n} (полем) → «+»`);
  }
});
test('C2: удаление ящика в комоде с высотой фасада полем — оставшиеся снова поровну на весь проём', () => {
  const m = createModule('drawers', 800, 1000, 550, initialModule()), s = m.sections[0];
  s.drawerConfigs = facadeForVisible(m, s, 0, visibleFacadeH(m, s, 0)! - 30);
  const n = removePart(one(m), 'm0', s.id, `${s.id}:drawer:2:bottom`).modules[0].module;
  assert.deepEqual(hs(n), [482.5, 482.5]); closesColumn(n, 'удалили ящик 3');
});
