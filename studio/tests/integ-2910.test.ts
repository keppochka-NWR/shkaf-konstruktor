// Интеграция 29.10.2026: два сбоя из сборки dp-2810 мышью и совместимость влитых веток (ящики × малый корпус × фигурные детали × фальши).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject, projectErrors, applyAutoFillers, type Project } from '../src/project';
import { estimate } from '../src/pricing';
import { activeRoom, addRoom, loadVariant, migrateRoomDocument, parseRoomDocument, persistRoomDocument, saveVariant, storedRoomDocument, updateRoom, ROOM_DOCUMENT_KEY } from '../src/roomDocument';
import { clientBundle, importBundle, loadIndex, activeClient, readClientRooms, clientRoomsKey } from '../src/clientIndex';
import { initialModule, section, validate, parts, drawerFacesEqual, type Module } from '../src/model';
import { facadeKindBlock, facadeKindOf, setFacadeKind } from '../src/facadeKind';
import { nextOption } from '../src/selectGuard';
import { freePanel } from '../src/freePanels';
import { sideFacadeSpec } from '../src/facadesVernissage';
import { setDrawersOverlay, relayoutDrawers, fullSectionDrawer } from '../src/drawerModes';
import { withMansard } from '../src/paletteBuild';
import { fitSmallModule } from '../src/smallSize';
import { partCollisions } from '../src/collisions';
import { DEFAULT_VERNISSAGE } from '../src/facadesVernissage';
import type { Cutout } from '../src/shapes';
import { scenarios, cornerReport } from '../scripts/corner-fillers-audit';

function memory(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);},m};}

// С 30.10.2026 цена — только по листам (выбора «Модель цены» нет): настройки расчёта заказа — цена листа, коэффициент, ручные цены.
const withSheet = (p: Project, sheetPrice: number): Project => ({ ...p, calculation: { ...(p.calculation ?? { markup: 2.2, overrides: {} }), sheetPrice } });

test('Настройки расчёта — одно место на документ комнат: правка в комнате — на весь заказ, в хранилище только в документе', () => {
  let d = migrateRoomDocument(newProject());
  const first = activeRoom(d).id;
  d = updateRoom(d, first, withSheet(activeRoom(d).project, 25000));
  assert.equal(d.calculation?.sheetPrice, 25000);
  d = addRoom(d, 'Спальня');
  assert.equal(activeRoom(d).project.calculation?.sheetPrice, 25000, 'новая комната — по настройкам заказа');
  d = updateRoom(d, activeRoom(d).id, { ...newProject(), calculation: activeRoom(d).project.calculation });
  assert.ok(d.rooms.every((r) => r.project.calculation?.sheetPrice === 25000), 'все комнаты по одним настройкам');
  // хранилище: настройки только на уровне документа
  const s = memory();
  const { serialized } = persistRoomDocument(s, d, null);
  const raw = JSON.parse(serialized);
  assert.equal(raw.calculation.sheetPrice, 25000);
  assert.ok(raw.rooms.every((r: { project: { calculation?: unknown } }) => r.project.calculation === undefined));
  // чтение — снова в каждой комнате; цена комнаты — по листам с ценой листа заказа
  const back = parseRoomDocument(raw);
  for (const r of back.rooms) { const e = estimate(r.project); assert.equal(e.sheetPrice, 25000); assert.equal(e.retail, e.bySheet); }
  // смена цены листа в одной комнате меняет её для всего заказа
  const other = back.rooms.find((r) => r.id !== back.activeRoomId)!;
  const d2 = updateRoom(back, other.id, withSheet(other.project, 23000));
  assert.ok(d2.rooms.every((r) => r.project.calculation?.sheetPrice === 23000) && d2.calculation?.sheetPrice === 23000);
});

test('Настройки расчёта: прежний документ (модель «по большей» только в активной комнате) читается на весь заказ, модель отброшена; вариант не откатывает настройки', () => {
  let d = migrateRoomDocument(newProject());
  d = addRoom(d, 'Прихожая');
  // как писали документы до 29.10: у активной комнаты своя модель, у другой — нет
  const old = JSON.parse(JSON.stringify(storedRoomDocument(d)));
  delete old.calculation;
  old.rooms.find((r: { id: string }) => r.id === old.activeRoomId).project.calculation = { markup: 2.2, overrides: {}, maxModel: true, sheetPrice: 24000 };
  const p = parseRoomDocument(old);
  assert.ok(p.rooms.every((r) => r.project.calculation?.sheetPrice === 24000 && r.project.calculation.maxModel === undefined));
  for (const r of p.rooms.filter((x) => x.project.modules.length)) { const e = estimate(r.project); assert.equal(e.retail, e.bySheet, 'старый документ «по большей» — по листам'); }
  let v = saveVariant(updateRoom(p, p.activeRoomId, withSheet(activeRoom(p).project, 23000)), 'Вариант 23 000');
  v = updateRoom(v, v.activeRoomId, withSheet(activeRoom(v).project, 25000));
  const loaded = loadVariant(v, activeRoom(v).variants![0].id);
  assert.equal(activeRoom(loaded).project.calculation?.sheetPrice, 25000, 'снимок мебели, настройки — заказа');
});

test('Настройки расчёта в экспорте/импорте JSON: папка клиента и файл проекта комнаты', () => {
  const s = memory();
  let d = migrateRoomDocument(newProject());
  d = updateRoom(d, d.activeRoomId, withSheet(activeRoom(d).project, 25000));
  persistRoomDocument({ getItem: (k) => s.getItem(k === ROOM_DOCUMENT_KEY ? clientRoomsKey('') : k), setItem: (k, v) => s.setItem(k === ROOM_DOCUMENT_KEY ? clientRoomsKey('') : k, v) }, d, null);
  const index = loadIndex(s), bundle = JSON.parse(JSON.stringify(clientBundle(s, activeClient(index))));
  assert.equal(bundle.projects[0].project.calculation.sheetPrice, 25000, 'файл проекта комнаты — с настройками');
  const r = importBundle(s, index, bundle);
  const rooms = readClientRooms(s, r.key);
  assert.equal(activeRoom(rooms).project.calculation?.sheetPrice, 25000, 'импорт папки клиента сохраняет настройки');
  // файл одного проекта (кнопка «Скачать» редактора) → «Открыть документ комнат» (миграция)
  const single = JSON.parse(JSON.stringify(activeRoom(d).project));
  assert.equal(parseProject(single).calculation?.sheetPrice, 25000);
  assert.equal(migrateRoomDocument(single).calculation?.sheetPrice, 25000);
});

test('«Тип фасадов»: рамка у дверей 2400 доступна (высота — по листу стекла, Макс 29.10), недоступный тип — с причиной, Вернисаж выбирается', () => {
  const m = initialModule(); m.height = 2400;
  assert.equal(facadeKindOf(m), 'ldsp');
  assert.equal(facadeKindBlock(m, 'alu'), '', 'зеркало: лист 3210×2250 — дверь ~2350 в рамке проходит (прежний предел СТП 2000 снят)');
  const kz = structuredClone(m); setFacadeKind(kz, 'alu'); kz.alu!.insert = 'fill:Кризет б/ц';
  assert.match(validate(kz).join(' '), /Алюминиевый фасад.*не выше 2100/, 'наполнение с листом 2100 — отказ с причиной');
  assert.equal(facadeKindBlock(m, 'vernissage'), '');
  const n = structuredClone(m); setFacadeKind(n, 'vernissage');
  assert.deepEqual(validate(n), []);
  assert.equal(facadeKindOf(n), 'vernissage');
  const low = initialModule(); low.height = 1900;
  assert.equal(facadeKindBlock(low, 'alu'), '', 'низкая дверь — рамка доступна');
});

// ───────── совместимость влитых веток ─────────
const wardrobe = (extra: Partial<Module> = {}): Module => ({ ...initialModule(), name: 'Шкаф И', width: 600, height: 2200, depth: 550, doors: true, sections: [{ ...section(), shelves: [0.6], drawers: 3 }], ...extra });
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id));
const doors = (m: Module) => parts(m).filter((p) => p.role === 'door');
const cut = (c: Partial<Cutout> & Pick<Cutout, 'host'>): Cutout => ({ id: 'c' + Math.random(), shape: 'rect', w: 100, h: 100, u: 0, v: 0, fromU: 'min', fromV: 'min', ...c });
const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };

test('совместимость: ящики в накладку и равные фасады в мансардном шкафу', () => {
  const m = wardrobe(); const sid = m.sections[0].id;
  setDrawersOverlay(m, sid, true);
  const mm = withMansard(m, 1600);
  assert.ok(mm.mansard, 'мансарда поставлена');
  assert.deepEqual(validate(mm), []);
  const hs = faces(mm).map((p) => p.size[1]);
  assert.equal(hs.length, 3);
  assert.ok(drawerFacesEqual(mm, mm.sections[0]), 'фасады ящиков равны: ' + hs.join('/'));
  // дверь над ящиками через зазор фасадов, верх двери — под наклонной крышей (по передней высоте)
  const topFace = Math.max(...faces(mm).map((p) => p.position[1] + p.size[1] / 2));
  for (const d of doors(mm)) { const bottom = d.position[1] - d.size[1] / 2; assert.ok(bottom > topFace && bottom - topFace < 5, `дверь от ${bottom}, фасад ящика до ${topFace}`); }
  assert.deepEqual(partCollisions(parts(mm)).filter((c) => /drawer|door/.test(JSON.stringify(c))), [], 'ящики и двери ничего не пересекают');
  assert.deepEqual(projectErrors(one(mm)), []);
});

test('совместимость: малый корпус — ящики снимаются сообщением, «в накладку» в нём не ломает модель', () => {
  const m = wardrobe({ width: 300, height: 400, depth: 400 });
  const notes = fitSmallModule(m);
  assert.ok(Array.isArray(notes));
  assert.deepEqual(validate(m), [], 'после снятия неподходящего наполнения модуль валиден');
  const k = wardrobe({ width: 400, height: 700, depth: 450, doors: false, sections: [{ ...section(), shelves: [], drawers: 2 }] });
  fitSmallModule(k);
  if (k.sections[0].drawers) { relayoutDrawers(k, k.sections[0]); assert.deepEqual(validate(k), []); assert.ok(drawerFacesEqual(k, k.sections[0]), 'малый комод — равные фасады'); }
  // выкатной ящик на всю секцию в низкой антресоли
  const a = wardrobe({ width: 600, height: 350, depth: 500, plinthHeight: 0, sections: [{ ...section(), shelves: [], drawers: 0 }] });
  fitSmallModule(a);
  fullSectionDrawer(a, a.sections[0].id);
  assert.deepEqual(validate(a), []);
  assert.equal(doors(a).length, 0, 'двери в секции с выкатным ящиком нет');
});

test('совместимость: вырез на фасаде ящика в накладку и на видимом боке из фасада МДФ', () => {
  const m = wardrobe(); const sid = m.sections[0].id;
  setDrawersOverlay(m, sid, true);
  const host = faces(m)[0].id;
  const withCut: Module = { ...m, cutouts: [cut({ host, shape: 'round', w: 40, u: 150, v: 60 })] };
  assert.deepEqual(validate(withCut), []);
  const f = parts(withCut).find((p) => p.id === host)!;
  assert.ok(f.shape && f.shape.holes.length === 1, 'отверстие в фасаде ящика');
  assert.ok(estimate(one(withCut)).lines.some((l) => l.id === 'cut-work'), 'работа «вырез» в смете');
  // видимый бок из фасада (Вернисаж): деталь стороннего участка (МДФ) — вырез в студии не делается, понятная ошибка, не сбой
  const v: Module = { ...wardrobe(), vernissage: { ...DEFAULT_VERNISSAGE }, facadeT: DEFAULT_VERNISSAGE.thickness, sidePanels: { left: { height: 2200, depth: 550, facade: true } } };
  assert.deepEqual(validate(v), []);
  const side = parts(v).find((p) => p.id === 'side-panel:left')!;
  assert.ok(side.sideFacade);
  const vc: Module = { ...v, cutouts: [cut({ host: 'side-panel:left', w: 20, h: 80, label: 'под плинтус' })] };
  assert.ok(validate(vc).some((e) => /Видимый бок левый.*вырез не делается/.test(e)), JSON.stringify(validate(vc)));
  assert.ok(estimate(one(v)).lines.some((l) => /^vernissage-panel:15:/.test(l.id)), 'бок — строкой «Панели МДФ» (общей с отдельной панелью МДФ)');
});

test('совместимость: стык угловых фальшей рядом с мансардой — без пересечений и ошибок', () => {
  for (const s of scenarios().slice(0, 4)) {
    const p = structuredClone(s.project);
    const a = p.modules.find((x) => !x.module.kitchen && !x.module.corner && x.module.height > 1000);
    if (!a) continue;
    a.module = withMansard(a.module, Math.max(400, a.module.height - 400));
    const q = applyAutoFillers(p);
    assert.deepEqual(cornerReport(q).overlaps, [], s.name);
    assert.deepEqual(projectErrors(q), [], s.name);
  }
});

test('стрелки в закрытом списке: листают доступные пункты (недоступные пропускаются), без применения промежуточных', () => {
  const o = [{ disabled: false }, { disabled: true }, { disabled: false }];
  assert.equal(nextOption(o, 0, 'ArrowDown'), 2, 'рамка (недоступна) пропущена: ЛДСП → Вернисаж');
  assert.equal(nextOption(o, 2, 'ArrowUp'), 0);
  assert.equal(nextOption(o, 2, 'ArrowDown'), -1);
  assert.equal(nextOption(o, 1, 'Home'), 0); assert.equal(nextOption(o, 0, 'End'), 2);
});

test('один механизм панелей МДФ: видимый бок из фасада и отдельная панель МДФ — одна строка «Панели МДФ» при одном МДФ', () => {
  const v = sideFacadeSpec({ ...DEFAULT_VERNISSAGE });
  const m: Module = { ...wardrobe(), vernissage: { ...DEFAULT_VERNISSAGE }, facadeT: DEFAULT_VERNISSAGE.thickness, sidePanels: { left: { height: 2200, depth: 550, facade: true } } };
  const p = one(m);
  const panel = freePanel({ name: 'Щит', width: 550, height: 2200, thickness: 16, edge: 0, decor: m.decor, plane: 'yz', vernissage: v } as Parameters<typeof freePanel>[0]);
  p.modules.push({ ...panel, x: 1000, z: 30 });
  const rows = estimate(p).lines.filter((l) => l.id.startsWith('vernissage-panel:'));
  assert.equal(rows.length, 1, rows.map((r) => r.id).join(' | '));
  assert.ok(Math.abs(rows[0].quantity - 2 * 0.55 * 2.2) < 0.05, 'две панели 550×2200 в одной строке: ' + rows[0].quantity);
});