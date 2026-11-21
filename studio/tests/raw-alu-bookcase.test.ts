import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {newProject,parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {rawErrors} from '../src/rawModule';
import {aluProfile,aluFill,ALU_GASKET_PER_M} from '../src/alu';
function fixture(){
 const m=initialModule();m.width=832;m.height=2377;m.depth=450;m.alu={profile:'F1-09',color:'black',insert:'glass-bronze'};
 m.raw={source:'test-import',counts:{},hardware:[{name:'Hettich',category:'петля',pos:[25,200,429],quat:[1,0,0,0]}],panels:[
  {name:'Фальш',kind:'ldsp',decor:'Тэффи',box:[0,0,0,16,2377,450]},
  {name:'Бок',kind:'ldsp',decor:'Дуб Вотан',box:[16,0,0,32,2300,429]},
  {name:'Рамка',kind:'alu',facade:true,box:[19,73,429,414.5,2297,449]}]};
 return m;
}
test('imported frame stays a single opening ALU door after project round trip',()=>{
 const p=newProject(fixture()),m=parseProject(JSON.parse(JSON.stringify(p))).modules[0].module;
 const ps=parts(m),d=ps.find(x=>x.material==='alu')!;
 assert.equal(d.role,'door');assert.equal(d.hinge,'left');assert.deepEqual(d.size,[395.5,2224,20]);
 assert.deepEqual(ps.filter(x=>x.material==='board').map(x=>x.decor),['Тэффи','Дуб Вотан']);
 assert.deepEqual(rawErrors(m),[]);
});
test('imported ALU price uses facade perimeter/area without glass or LDSP duplication',()=>{
 const p=newProject(fixture());p.calculation={markup:2.2,sheetPrice:23000,overrides:{}};
 const e=estimate(p),frame=e.lines.find(x=>x.id==='alu-profile:F1-09:black')!,fill=e.lines.find(x=>x.id==='alu-insert:glass-bronze')!;
 assert.equal(frame.quantity,5.239);assert.equal(frame.unitPrice,aluProfile('F1-09')!.perM);assert.equal(frame.retail,true);
 assert.equal(fill.quantity,0.88);assert.equal(fill.unitPrice,aluFill('glass-bronze')!.perM2);
 assert.equal(e.lines.find(x=>x.id==='alu-seal')!.unitPrice,ALU_GASKET_PER_M);
 assert.equal(e.lines.some(x=>x.id==='glass-shelf'||x.id==='facade-external'),false);
 assert.equal(e.lines.filter(x=>x.id.startsWith('sheet:')).length,2);
});
test('imported ALU requires a valid profile and insert rather than silently showing LDSP',()=>{
 const m=fixture();delete m.alu;assert.equal(rawErrors(m).length,1);
});
