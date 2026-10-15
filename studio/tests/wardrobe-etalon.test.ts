import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,section,validate,type Module,type Part} from '../src/model';
import {compareModule} from '../scripts/kitchen/compare';
import {wardrobeFromEtalon,layoutWardrobe,type WRefModule,type WRefPanel} from '../scripts/wardrobe/fromEtalon';
import {reasonKey,reasonSummary,verdict,ETALON_W,type WardrobeVerdict} from '../scripts/wardrobe/batch';
import {existsSync,readFileSync} from 'node:fs';
import type {PlacedModule} from '../src/project';

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
test('свод причин: корпуса отдельно от частей (part), редкие причины (H_прочее) не теряются', () => {
  const v = (archetype: string, why: string[], pass = false): WardrobeVerdict => ({file: 'w000', key: 'm01', archetype, pass, geom: false, why});
  const res = [v('swing', ['конфирмат 8/12 Δ15', 'прочее 1/0']), v('part', ['конфирмат 2/0', 'лишних 1: Бок']), v('part', ['W_PART: не корпус']), v('open', [], true)];
  assert.deepEqual(reasonSummary(res, true), [['H_конфирмат', 1], ['H_прочее', 1]]);
  assert.deepEqual(reasonSummary(res, false), [['G_EXTRA', 1], ['H_конфирмат', 1], ['W_PART', 1]]);
  assert.deepEqual(reasonSummary(res, null)[0], ['H_конфирмат', 2]);
});

test('параметрическое изделие: расстановка по place() с поворотом 90 — габарит по занимаемому прямоугольнику, отступ 300 от стен', () => {
  const mod = (width: number, depth: number, height: number) => ({...initialModule(), width, depth, height});
  // A: yaw 0, x 0..800, z 0..500; B: yaw 90 (по x — глубина 400, по z — ширина 1000), x −600..−200, z −200..800, стоит на 100 ниже
  const a: PlacedModule = {id: 'a', x: 0, y: 0, z: 0, rotation: 0, module: mod(800, 500, 2000)};
  const b: PlacedModule = {id: 'b', x: -600, y: -100, z: -200, rotation: 90, module: mod(1000, 400, 2100)};
  const {size, room} = layoutWardrobe([a, b], 300);
  assert.deepEqual(size, [1400, 2100, 1000]);
  assert.deepEqual([a.x, a.y, a.z, b.x, b.y, b.z], [900, 100, 500, 300, 0, 300]);
  assert.deepEqual(room, {width: 2000, depth: 1600, height: 2700});
});

// Эталоны шкафов (Кухни/etalon-w, строит Кухни/scripts/etalon_wardrobe.py) — вне git; проверка полноты, если они есть на машине.
const STATS = `${ETALON_W}/_stats.json`;
test('эталон шкафов не теряет фурнитуру: все сверловки и профили corpus — в модулях или в row.hardware (сборки без панелей)', {skip: !existsSync(STATS)}, () => {
  const st = JSON.parse(readFileSync(STATS, 'utf8')) as Record<string, {counts?: Record<string, number>; error?: string}>;
  const files = Object.entries(st).filter(([, x]) => x.counts);
  assert.ok(files.length >= 271, `файлов ${files.length}`);
  for (const [w, x] of files) {
    const c = x.counts!;
    assert.equal(c.hw_lost ?? NaN, 0, `${w}: потеряно ${c.hw_lost}`);
    assert.equal((c.hardware ?? 0) + (c.orphan_far_hw ?? 0), (c.drills_src ?? 0) + (c.profiles_src ?? 0), w);
  }
  // находки критика: w119 — две сборки «Направ. шарик. Versalite» (18 сверловок), w188 — сборка с 3 профилями
  const hw = (w: string) => (JSON.parse(readFileSync(`${ETALON_W}/${w}.json`, 'utf8')) as {modules: WRefModule[]}).modules.flatMap((m) => m.hardware as {kit?: string; node?: string}[]);
  assert.equal(hw('w119').filter((h) => /Versalite/.test(h.kit ?? '')).length, 18);
  assert.equal(hw('w188').filter((h) => h.node === 'profile').length, 3);
});
// Разбор замечаний критика на данных эталонов (пропуск, если эталонов на машине нет).
test('эталон шкафов: сверка честная, а расхождения объяснены (w049 m03, w060 m02, w021 m07)', {skip: !existsSync(STATS)}, () => {
  const mod = (w: string, k: string) => (JSON.parse(readFileSync(`${ETALON_W}/${w}.json`, 'utf8')) as {modules: WRefModule[]}).modules.find((m) => m.key === k)!;
  // w049 m03: панели совпали, но отверстия 0/16. Это присадка конфирмата: у Базиса «Евровинт 7х50» D7 сквозное + D5×34, у студии D8×16 + D5×35 (S_DRILL, вопрос Максу)
  const v49 = verdict('w049', mod('w049', 'm03'));
  assert.ok(v49.geom && !v49.pass && !v49.noEdge, v49.why.join('; '));
  assert.ok(v49.why.map(reasonKey).includes('S_DRILL'));
  // w060 m02: расходится только кромка. Мутация модуля (height+1) даёт Δ=1 и FAIL, то есть сверка не подгоняется
  const ref = mod('w060', 'm02'), m = wardrobeFromEtalon(ref).module;
  assert.ok(verdict('w060', ref).noEdge);
  const c = compareModule(ref, {...m, height: m.height + 1});
  assert.ok(c.pairs.some((x) => x.delta >= 1) || c.missing.length > 0);
  // импорт (import.ts) отбрасывает деталь 0×0 мм, а эталон её хранит, как в Базисе: отсюда 11 960 и 11 961 панелей
  assert.equal(mod('w021', 'm07').panels.filter((p) => (p as unknown as {lw: number[]}).lw.every((x) => x < 0.5)).length, 1);
});