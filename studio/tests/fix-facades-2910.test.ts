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
