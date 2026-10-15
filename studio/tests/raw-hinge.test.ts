// Сторона петель фасада «как есть»: по петлям Базиса у кромок фасада — сцена открывает фасад вокруг этой кромки.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,type Module} from '../src/model';
import {newProject} from '../src/project';
import {estimate} from '../src/pricing';
import {rawParts,type RawSpec} from '../src/rawModule';

function rawModule(raw:RawSpec):Module{return {...initialModule(),name:'Сырой',width:600,height:720,depth:330,decor:'Белый',facadeDecor:'Слэйт',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw};}
const door=(box:[number,number,number,number,number,number])=>({name:'Фасад',kind:'ldsp',box,facade:true});
const hinge=(x:number,y:number,z=312)=>({name:'Петля',category:'петля',pos:[x,y,z] as [number,number,number],quat:[0,0,0,1] as [number,number,number,number]});

test('навесной откидной: две петли у верхней кромки фасада — фасад открывается вверх, а не вбок', () => {
  const ps=rawParts(rawModule({panels:[door([0,0,314,600,720,330])],hardware:[hinge(100,690),hinge(500,690)]}));
  assert.equal(ps.find(p=>p.id==='raw:p0')!.hinge,'top');
});

test('распашная дверь: петли у левой кромки — left, у правой — right', () => {
  const l=rawParts(rawModule({panels:[door([0,0,314,300,720,330])],hardware:[hinge(22,100),hinge(22,620)]}));
  assert.equal(l.find(p=>p.id==='raw:p0')!.hinge,'left');
  const r=rawParts(rawModule({panels:[door([300,0,314,600,720,330])],hardware:[hinge(578,100),hinge(578,620)]}));
  assert.equal(r.find(p=>p.id==='raw:p0')!.hinge,'right');
});

test('смета откидного фасада «как есть» не меняется: строки подъёмного механизма сверх Базиса нет', () => {
  const m=rawModule({source:'bazis-kitchen',panels:[door([0,0,314,600,720,330])],hardware:[hinge(100,690),hinge(500,690)]});
  const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:0,y:0,z:0,rotation:0,module:m}];
  const lines=estimate(p).lines;
  assert.equal(lines.some(l=>l.id.startsWith('lift-mechanism')),false);
  const q=rawModule({panels:[door([0,0,314,600,720,330])],hardware:[hinge(100,690),hinge(500,690)]});
  const p2=newProject({...initialModule(),sections:[section()]});p2.modules=[{id:id(),x:0,y:0,z:0,rotation:0,module:q}];
  assert.equal(estimate(p2).lines.some(l=>l.id.startsWith('lift-mechanism')),false);
});

test('петли соседнего фасада не учитываются; фасад без петель — без стороны', () => {
  const ps=rawParts(rawModule({panels:[door([0,0,314,300,720,330]),door([300,0,314,600,200,330])],hardware:[hinge(22,100),hinge(22,620)]}));
  assert.equal(ps.find(p=>p.id==='raw:p0')!.hinge,'left');
  assert.equal(ps.find(p=>p.id==='raw:p1')!.hinge,undefined);
});
