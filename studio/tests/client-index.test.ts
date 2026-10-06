import test from 'node:test';
import assert from 'node:assert/strict';
import {loadIndex,saveIndex,addProject,removeProject,renameProject,switchProject,addClient,switchClient,renameClient,activeClient,setPrice,clientTotal,clientBundle,importBundle,isClientBundle,projectStorageKey,CLIENT_INDEX} from '../src/clientIndex';
import {newProject,parseProject} from '../src/project';

function memory(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);},m};}

test('first run keeps the existing single project as project 1 of the first client',()=>{
  const s=memory();s.setItem(projectStorageKey(''),JSON.stringify(newProject()));
  const i=loadIndex(s);assert.equal(i.clients.length,1);assert.deepEqual(activeClient(i).projects.map(p=>p.key),['']);
  s.setItem(CLIENT_INDEX,'{broken');assert.equal(loadIndex(s).clients.length,1,'damaged index starts over without touching projects');
  assert.ok(s.getItem(projectStorageKey('')),'project data untouched');
});

test('add, copy, rename, switch and remove projects of one client; totals sum project prices',()=>{
  const s=memory();s.setItem(projectStorageKey(''),JSON.stringify(newProject()));
  let i=loadIndex(s);
  const a=addProject(s,i,'Спальня');i=a.index;assert.equal(activeClient(i).active,a.key);assert.equal(s.getItem(projectStorageKey(a.key)),null,'empty project is created by the editor');
  const b=addProject(s,i,'Прихожая · вариант','');i=b.index;assert.ok(s.getItem(projectStorageKey(b.key)),'copy stored');
  assert.deepEqual(parseProject(JSON.parse(s.getItem(projectStorageKey(b.key))!)).modules.length,newProject().modules.length);
  assert.equal(addProject(s,i,'Спальня').index.clients[0].projects.at(-1)!.title,'Спальня 2','duplicate titles get a number');
  i=renameProject(i,'','Прихожая');assert.equal(activeClient(i).projects[0].title,'Прихожая');
  assert.throws(()=>renameProject(i,'','  '));
  i=switchProject(i,'');assert.equal(activeClient(i).active,'');
  i=setPrice(setPrice(setPrice(i,'',50000),a.key,70000),b.key,null);assert.equal(clientTotal(activeClient(i)),null,'unknown price keeps total open');
  i=setPrice(i,b.key,30000);assert.equal(clientTotal(activeClient(i)),150000);
  i=removeProject(s,i,b.key);assert.equal(activeClient(i).projects.length,2);assert.equal(s.getItem(projectStorageKey(b.key)),null);assert.ok(s.getItem('module-studio-removed-'+b.key),'removed project kept as backup');
  saveIndex(s,i);assert.deepEqual(loadIndex(s),i);
});

test('several clients and a client folder file round trip',()=>{
  const s=memory();s.setItem(projectStorageKey(''),JSON.stringify(newProject()));
  let i=renameClient(loadIndex(s),'7212718 Цецегов');
  const second=addProject(s,i,'Шкаф-купе','');i=second.index;
  const c=addClient(i,'Новый');i=c.index;assert.equal(i.clients.length,2);assert.equal(activeClient(i).label,'Новый');
  i=switchClient(i,i.clients[0].id);assert.equal(activeClient(i).label,'7212718 Цецегов');
  const bundle=clientBundle(s,activeClient(i));assert.ok(isClientBundle(bundle));assert.equal(bundle.projects.length,2);
  const t=memory();const imported=importBundle(t,loadIndex(t),JSON.parse(JSON.stringify(bundle)));
  const ic=activeClient(imported.index);assert.equal(ic.label,'7212718 Цецегов');assert.deepEqual(ic.projects.map(p=>p.title),['Проект 1','Шкаф-купе']);
  assert.ok(ic.projects.every(p=>t.getItem(projectStorageKey(p.key))));
  assert.throws(()=>importBundle(t,imported.index,{...bundle,projects:[]}));
  assert.throws(()=>removeProject(s,{...i,clients:[{...i.clients[1]}],active:i.clients[1].id},activeClient({...i,active:i.clients[1].id}).projects[0].key),/хотя бы один/);
});
