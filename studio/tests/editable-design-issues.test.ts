import {previewPrice} from '../src/previewPrice';
import {roomSummary} from '../src/RoomDeliverables';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProject,parseProject,projectErrors} from '../src/project';
import {initialModule,section,validate,parseModule} from '../src/model';
import {migrateRoomDocument,parseRoomDocument,persistRoomDocument,ROOM_DOCUMENT_KEY} from '../src/roomDocument';
import {buildCheck} from '../src/buildCheck';
import {blockingDesignChanges} from '../src/editableDesignIssues';

const wide=()=>({...initialModule(),width:900,height:800,doors:true,sections:[{...section(),doorLeaves:1 as const}]});
test('wide facade loads intact for repair; strict parser and checks still reject it',()=>{
 const m=wide();assert.ok(validate(m).some(e=>e.includes('Фасад шире')));
 assert.throws(()=>parseModule(m),/Фасад шире/);
 assert.equal(parseModule(m,true).width,900);
 const p=newProject(m);p.modules=[p.modules[0]];
 assert.throws(()=>parseProject(p),/Фасад шире/);
 const loaded=parseProject(p,false,true);
 assert.equal(loaded.modules[0].module.width,900);
 assert.ok(projectErrors(loaded).length);assert.equal(buildCheck(loaded,loaded.modules[0].id).ok,false);
 const doc=migrateRoomDocument(p);
 assert.equal(roomSummary(doc)[0].price,null);
 assert.equal(previewPrice(p),null);
 assert.ok(roomSummary(doc)[0].warnings.some(x=>x.includes("Фасад шире")));
 assert.equal(parseRoomDocument(JSON.parse(JSON.stringify(doc))).rooms[0].project.modules[0].module.width,900);
 const store=new Map<string,string>();
 persistRoomDocument({getItem:k=>store.get(k)??null,setItem:(k,v)=>{store.set(k,v);}},doc,null);
 assert.ok(store.has(ROOM_DOCUMENT_KEY));
});
test('repair loading does not accept corrupt dimensions, ids or sections',()=>{
 const p=newProject(wide());p.modules=[p.modules[0]];
 for(const invalid of [NaN,Infinity,-1]){const q=structuredClone(p);q.modules[0].module.width=invalid;assert.throws(()=>parseProject(q,false,true));}
 const q=structuredClone(p);(q.modules[0].module as any).sections=null;assert.throws(()=>parseProject(q,false,true));
 const d=migrateRoomDocument(p);d.rooms.push(structuredClone(d.rooms[0]));assert.throws(()=>parseRoomDocument(d),/идентификатор/);
});
test('existing constructive issues allow staged repair, new issues are rejected',()=>{
 const a='Фасад шире 700 мм при высоте 797. Разделите модуль на секции или уберите фасады.';
 assert.deepEqual(blockingDesignChanges([a],[a]),[]);
 assert.deepEqual(blockingDesignChanges([a],[]),[]);
 assert.deepEqual(blockingDesignChanges([], [a]),[a]);
 assert.deepEqual(blockingDesignChanges(['corrupt'],['corrupt']),['corrupt']);
});

test('overlaps and out-of-room placements survive load without becoming valid',()=>{
 const p=newProject();p.modules[1]={...structuredClone(p.modules[0]),id:'overlapping'};
 const loaded=parseProject(p,false,true);
 assert.equal(loaded.modules.length,2);
 assert.ok(projectErrors(loaded).some(x=>x.includes('пересекается')));
 p.modules=[p.modules[0]];p.modules[0].x=-100;
 assert.equal(parseProject(p,false,true).modules[0].x,-100);
 assert.ok(projectErrors(p).some(x=>x.includes('границы')));
 assert.equal(previewPrice(p),null);
});
