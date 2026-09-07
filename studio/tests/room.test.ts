import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importBazisConfig,exportBazisConfig,parseConfigXml} from '../src/bazisRoom';
import {FIXTURES,fixtureBox,newFixture,validateFixture} from '../src/fixtures';
import {newProject,parseProject,projectErrors} from '../src/project';
import {roomWarnings} from '../src/roomWarnings';

const sample=readFileSync(new URL('./fixtures/bazis-room-config.xml',import.meta.url),'utf8');

test('Config.xml of the Bazis room script imports walls, door with casing, window with sill, radiator, sockets and pipes',()=>{
  const r=importBazisConfig(sample);
  assert.equal(r.name,'КУХНЯ');
  assert.equal(r.room.width,3200);assert.equal(r.room.depth,2600);assert.equal(r.room.height,2500);assert.equal(r.room.walls?.thickness,120);
  const door=r.room.openings!.find(o=>o.type==='door')!;assert.equal(door.wall,'back');assert.equal(door.offset,150);assert.equal(door.casing,80);assert.equal(door.hinge,'right');
  const win=r.room.openings!.find(o=>o.type==='window')!;assert.equal(win.wall,'left');assert.equal(win.offset,1300);assert.equal(win.sill,850);assert.equal(win.reveal,40);assert.equal(win.windowSill?.overhang,65);
  const types=r.room.fixtures!.map(f=>f.type);
  assert.ok(types.includes('radiator')&&types.includes('socket')&&types.includes('switch')&&types.includes('pipe')&&types.includes('floorPlinth')&&types.includes('vent'));
  const rear=r.room.fixtures!.find(f=>f.wall==='front')!;assert.equal(rear.type,'socket');assert.equal(rear.offset,3200-1100-80,'rear wall offset counted from the other corner');
  const fridge=r.room.obstacles!.find(o=>o.type==='fridge')!;assert.equal(fridge.width,600);
  const p=newProject();p.room={...p.room,...r.room};assert.deepEqual(projectErrors(p),[]);
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).room,p.room);
});

test('export produces a Config.xml the importer reads back with the same geometry',()=>{
  const r=importBazisConfig(sample).room;
  const xml=exportBazisConfig(r,'ТЕСТ');
  assert.ok(xml.startsWith('<?xml'));assert.ok(xml.includes('<Item Name="ФРОНТАЛЬНАЯ СТЕНА"><Value>Y</Value>'));
  const back=importBazisConfig(xml);
  assert.equal(back.name,'ТЕСТ');assert.equal(back.room.width,r.width);assert.equal(back.room.depth,r.depth);
  assert.equal(back.room.openings!.length,r.openings!.length);
  for(const o of r.openings!){const b=back.room.openings!.find(x=>x.wall===o.wall&&x.type===o.type)!;assert.equal(b.offset,o.offset);assert.equal(b.width,o.width);}
  const rad=r.fixtures!.find(f=>f.type==='radiator')!,rad2=back.room.fixtures!.find(f=>f.type==='radiator')!;assert.equal(rad2.offset,rad.offset);assert.equal(rad2.depth,rad.depth);
  const sockets=(t:typeof r)=>t.fixtures!.filter(f=>f.type==='socket').length;assert.equal(sockets(back.room),sockets(r));
  const tree=parseConfigXml(xml);assert.ok(tree.items.length>0);
});

test('fixtures: defaults fit the wall, boxes sit on their wall, invalid ones are rejected and furniture covering them warns',()=>{
  const p=newProject();p.room={width:4000,depth:3000,height:2700,openings:[]};
  const s=newFixture(p.room,'socket','back','s1');assert.equal(validateFixture(p.room,s),null);assert.equal(fixtureBox(p.room,s).z,0);
  const r=newFixture(p.room,'radiator','right','r1');assert.equal(fixtureBox(p.room,r).x,4000-140);
  const plinth=newFixture(p.room,'floorPlinth','back','pl');assert.equal(plinth.width,4000);
  assert.ok(validateFixture(p.room,{...s,offset:3990})!.includes('длину стены'));
  assert.ok(validateFixture(p.room,{...s,type:'nope' as never})!.includes('тип'));
  p.room.fixtures=[{...s,offset:100,fromFloor:600}];
  const w=roomWarnings(p);assert.ok(w.some(x=>x.fixtureId==='s1'&&x.message.includes('розетка')),'cabinet at the back wall covers the socket');
  p.room.fixtures=[{...s,offset:3000,fromFloor:600}];assert.ok(!roomWarnings(p).some(x=>x.fixtureId==='s1'));
  assert.ok(Object.keys(FIXTURES).length>=18);
});
