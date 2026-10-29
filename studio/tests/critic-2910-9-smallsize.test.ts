// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.9 — опечатка в высоте не сносит наполнение безвозвратно.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, validate, fitDrawersAfterResize, type Module } from '../src/model';
import { resizeSmall, fillingKey, type SmallMemo } from '../src/smallSize';

const wardrobe = (): Module => ({ ...initialModule(), name: 'Шкаф', width: 1000, height: 2200, depth: 600, doors: true, sections: [{ ...section(), shelves: [0.75, 0.9], rod: true }] });
/** Как поле «Высота» (App.modify): новый размер, затем правило малого корпуса с памятью. */
function setHeight(m: Module, h: number, memo?: SmallMemo) {
  const next = structuredClone(m); next.height = h;
  fitDrawersAfterResize(next, m);
  const r = resizeSmall(m, next, memo, fitDrawersAfterResize);
  return { m: next, ...r };
}
test('п.9: высота 100 вместо 1000 снимает двери, штангу, полки, цоколь — возврат высоты возвращает наполнение', () => {
  const m = wardrobe();
  const small = setHeight(m, 100);
  assert.equal(small.m.doors, false); assert.equal(small.m.sections[0].rod, false); assert.equal(small.m.sections[0].shelves.length, 0);
  assert.ok(small.notes.length > 0 && small.memo, 'снятое запомнено');
  // раньше: высота обратно — шкаф пустой, без дверей и цоколя
  const back = setHeight(small.m, 2200, small.memo);
  assert.equal(back.restored, true);
  assert.equal(fillingKey(back.m), fillingKey(m), 'двери, штанга, полки и цоколь на месте');
  assert.deepEqual(validate(back.m), []);
  // промежуточная высота меньше прежней — пока не возвращается, память сохраняется (и обновляется)
  const mid = setHeight(small.m, 1000, small.memo);
  assert.equal(mid.restored, false); assert.ok(mid.memo);
  assert.equal(setHeight(mid.m, 2200, mid.memo).restored, true);
});
test('п.9: после снятия наполнение поменяли вручную — запомненное поверх правок не возвращается', () => {
  const small = setHeight(wardrobe(), 100);
  const edited = structuredClone(small.m); edited.sections[0].drawers = 0; edited.doors = true;
  const back = setHeight(edited, 2200, small.memo);
  assert.equal(back.restored, false);
  assert.equal(back.m.sections[0].rod, false, 'штанга не вернулась поверх ручных правок');
});
