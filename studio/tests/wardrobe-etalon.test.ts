import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,section,validate,type Module,type Part} from '../src/model';
import {compareModule} from '../scripts/kitchen/compare';
import {wardrobeFromEtalon,type WRefModule,type WRefPanel} from '../scripts/wardrobe/fromEtalon';
import {reasonKey} from '../scripts/wardrobe/batch';

// Шкафы, этап 1: распознаватель эталона шкафа Базиса (Кухни/etalon-w) → модуль шкафа студии. Правила шкафов студии не меняются —
// поэтому шкаф, построенный самой студией и переписанный в формат эталона, должен распознаться обратно в те же детали.

const ROLE: [RegExp, string][] = [[/^(left|right)$/, 'side'], [/^top$/, 'top'], [/^bottom$/, 'bottom'], [/^plinth$/, 'plinth'], [/^back$/, 'back'], [/:shelf:/, 'shelf'], [/:divider$/, 'partition'], [/:door:/, 'facade']];
function asEtalon(m: Module): WRefModule {
  const ps = parts(m).filter((p: Part) => p.material === 'board' || p.material === 'hdf');
  const panels: WRefPanel[] = ps.map((p, i) => {
    const ax = p.size.indexOf(Math.min(...p.size)), box = [0, 1, 2].map((k) => p.position[k] - p.size[k] / 2).concat([0, 1, 2].map((k) => p.position[k] + p.size[k] / 2));
    const role = ROLE.find(([rx]) => rx.test(p.id.replace(/^[0-9a-f-]{36}/, 's')))?.[1] ?? 'other';
    return {i, name: p.name, mat: p.material === 'hdf' ? 'ХДФ' : 'ЛДСП', thick: Math.min(...p.size), kind: p.material === 'hdf' ? 'hdf' : 'ldsp', box, axis: 'xyz'[ax], role};
  });
  return {key: 'm01', name: 'тест', archetype: m.doors ? 'swing' : 'open', size: [m.width, m.height, m.depth], panels, hardware: []};
}

test('шкаф студии в формате эталона распознаётся в те же детали (секции, полки съёмные/жёсткие, цоколь, накладной ХДФ, фасады)', () => {
  const m: Module = {...initialModule(), width: 1000, height: 2100, depth: 580, plinthHeight: 80, backType: 'nailed', doors: true,
    sections: [{...section(), weight: 1, shelves: [0.4, 0.7], fixed: [1]}, {...section(), weight: 1, shelves: [0.5]}]};
  assert.deepEqual(validate(m), []);
  const ref = asEtalon(m);
  const {module: r, unsupported} = wardrobeFromEtalon(ref);
  assert.deepEqual(unsupported, []);
  assert.equal(r.width, 1000); assert.equal(r.height, 2100); assert.equal(r.depth, 580);
  assert.equal(r.plinthHeight, 80); assert.equal(r.backType, 'nailed'); assert.equal(r.sections.length, 2);
  assert.deepEqual(r.sections[0].fixed, [1]);
  const c = compareModule(ref, r);
  assert.deepEqual(c.missing.map((x) => x.name), []);
  assert.deepEqual(c.extra.map((x) => x.name), []);
  assert.ok(c.pairs.every((p) => p.delta <= 0.5), c.pairs.filter((p) => p.delta > 0.5).map((p) => p.ref.name + ' ' + p.delta).join(', '));
});

test('чего правила шкафов студии не умеют — в unsupported с кодом backlog-wardrobes, а не правка правил', () => {
  const ref = asEtalon({...initialModule(), width: 800, height: 2000, depth: 500, doors: false, sections: [{...section(), shelves: []}]});
  const top = ref.panels.find((p) => p.role === 'top')!;
  top.box = [0, top.box[1], top.box[2], 800, top.box[4], top.box[5]]; // крыша на боковинах
  assert.ok(wardrobeFromEtalon(ref).unsupported.some((u) => u.startsWith('W_TOP_OVER')));
  assert.ok(wardrobeFromEtalon({...ref, archetype: 'kupe'}).unsupported.some((u) => u.startsWith('W_KUPE')));
});

test('свод причин: коды W_*, пределы и кромка студии, геометрия, фурнитура', () => {
  assert.equal(reasonKey('W_NO_TOP: без крыши'), 'W_NO_TOP');
  assert.equal(reasonKey('студия: Высота: допустимо от 250 до 2500 мм.'), 'S_LIMIT_HEIGHT');
  assert.equal(reasonKey('кромка: Бок: -y Базис 0 / студия 0.4'), 'S_EDGE_HIDDEN');
  assert.equal(reasonKey('конфирмат 8/12 Δ15'), 'H_конфирмат');
  assert.equal(reasonKey('нет 2: ldsp/16/z/корпус'), 'G_MISSING');
});
