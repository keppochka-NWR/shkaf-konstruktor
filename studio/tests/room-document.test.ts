import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject } from '../src/project';
import { cornerProject, CORNER_DEFAULT } from '../src/cornerWardrobe';
import { kitchenProject } from '../src/kitchenProject';
import { estimate } from '../src/pricing';
import { activeRoom, addRoom, migrateRoomDocument, parseRoomDocument, persistRoomDocument, removeRoom, renameRoom, selectRoom, updateRoom, ROOM_DOCUMENT_KEY, ROOM_DOCUMENT_BACKUP } from '../src/roomDocument';

for (const [name, create] of [['wardrobe', newProject], ['corner', () => cornerProject(CORNER_DEFAULT)], ['kitchen', kitchenProject]] as const) {
  test(`P0/P1: ${name} migration preserves source, parts and price across round trip`, () => {
    const p = create(), before = JSON.stringify(p), cost = estimate(p);
    const doc = parseRoomDocument(JSON.parse(JSON.stringify(migrateRoomDocument(p))));
    assert.equal(JSON.stringify(p), before);
    // JSON has no undefined-valued properties; compare the file representation.
    assert.deepEqual(JSON.parse(JSON.stringify(doc.rooms[0].project.modules)), JSON.parse(JSON.stringify(p.modules)));
    assert.deepEqual(estimate(doc.rooms[0].project), cost);
    assert.deepEqual(parseRoomDocument(doc), doc);
  });
}
test('P1: empty rooms stay empty; switching isolates design; copies have independent walls/data', () => {
  let d = migrateRoomDocument(), first = activeRoom(d).id;
  assert.equal(activeRoom(d).project.modules.length, 0);
  d = updateRoom(d, first, newProject());
  d = addRoom(d, 'Спальня');
  assert.equal(activeRoom(d).project.modules.length, 0);
  d = selectRoom(d, first);
  d = addRoom(d, 'Копия', first);
  assert.notDeepEqual(activeRoom(d).walls, d.rooms[0].walls);
  activeRoom(d).project.modules[0].module.name = 'Изменён только дубль';
  assert.notEqual(d.rooms[0].project.modules[0].module.name, 'Изменён только дубль');
  assert.equal(parseRoomDocument(d).rooms.length, 3);
});
test('P1: door, sill, obstacles and measurement survive migration', () => {
  const p = newProject();
  p.room.openings = [{id:'door',type:'door',wall:'left',offset:20,width:800,height:2000,sill:0,casing:60,casingThick:12,hinge:'right'},
    {id:'window',type:'window',wall:'back',offset:1500,width:1200,height:1200,sill:900,reveal:150,windowSill:{width:1300,thick:30,overhang:100,offset:0}}];
  p.measurement = {number:'fixture',date:'2026-10-12',notes:'test'};
  const actual = activeRoom(parseRoomDocument(migrateRoomDocument(p))).project;
  assert.deepEqual(actual.room.openings,p.room.openings);
  assert.deepEqual(actual.measurement,p.measurement);
});
test('P1: removal chooses surviving room, immutable snapshot restores deletion, last protected', () => {
  const one = migrateRoomDocument();
  assert.throws(() => removeRoom(one,one.activeRoomId),/Последнюю/);
  const two = addRoom(one,'Вторая'), snapshot = JSON.stringify(two);
  const result = removeRoom(two,two.activeRoomId);
  assert.equal(result.activeRoomId,one.activeRoomId);
  assert.equal(JSON.stringify(two),snapshot);
  assert.equal(parseRoomDocument(JSON.parse(snapshot)).rooms.length,2);
  assert.throws(() => renameRoom(one,one.activeRoomId,''),/Название/);
  assert.throws(() => selectRoom(one,'missing'),/не найдена/);
});
test('P1: invalid/future documents and duplicate wall IDs rejected', () => {
  const d = migrateRoomDocument();
  assert.throws(() => parseRoomDocument({...d,version:2}),/формат/);
  assert.throws(() => parseRoomDocument({...d,activeRoomId:'missing'}),/Активная/);
  const bad = structuredClone(d);bad.rooms[0].walls.left=bad.rooms[0].walls.back;
  assert.throws(() => parseRoomDocument(bad),/Повторяющийся/);
  assert.throws(() => parseRoomDocument({...d,revision:NaN}),/версия/);
});
test('P1: failed save and stale save preserve last complete document; revision stays monotonic', () => {
  const map = new Map<string,string>(); let fail = false;
  const store = {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{if(fail&&k===ROOM_DOCUMENT_KEY)throw Error('Quota');map.set(k,v);}};
  const a = persistRoomDocument(store,migrateRoomDocument(),null);
  assert.throws(() => persistRoomDocument(store,a.document,null),/другой вкладке/);
  fail=true;
  assert.throws(() => persistRoomDocument(store,addRoom(a.document,'Вторая'),a.serialized),/Quota/);
  assert.equal(map.get(ROOM_DOCUMENT_KEY),a.serialized);
  assert.equal(map.get(ROOM_DOCUMENT_BACKUP),a.serialized);
  fail=false;
  const b = persistRoomDocument(store,addRoom(a.document,'Вторая'),a.serialized);
  const undo = persistRoomDocument(store,a.document,b.serialized);
  assert.equal(undo.document.revision,2);
  assert.equal(undo.document.rooms.length,1);
});
