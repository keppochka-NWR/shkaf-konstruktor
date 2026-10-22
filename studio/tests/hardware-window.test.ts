// Окно «Фурнитура» (менеджеры 22.10.2026, п. 15): замена во всём проекте или в одном модуле; разница цены — розничный итог сметы.
import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {scopedSwap,scopeProject,setAllHinges,setAllSlides,hardwareChoice} from '../src/hardwareSwap';
import {newProject,type Project} from '../src/project';

const two=():Project=>{const p=newProject();p.modules[0].module.sections[0].drawers=2;p.modules.push({...structuredClone(p.modules[0]),id:'m2',x:1300});return p;};

test('scopedSwap: модуль — меняется только он, проект — все; что стоит сейчас — по выбранной части',()=>{
  const p=two(),one=scopedSwap(p,'m2',q=>setAllHinges(q,'blum'));
  assert.equal(one.modules[0].module.hingeBrand,undefined);assert.equal(one.modules[1].module.hingeBrand,'blum');
  assert.deepEqual(hardwareChoice(one).hinges.sort(),['blum','gtv']);
  assert.deepEqual(hardwareChoice(scopeProject(one,'m2')).hinges,['blum']);
  const all=scopedSwap(p,null,q=>setAllHinges(q,'blum'));assert.ok(all.modules.every(a=>a.module.hingeBrand==='blum'));
  assert.throws(()=>scopedSwap(p,'нет',q=>q));
  assert.equal(p.modules[1].module.hingeBrand,undefined,'исходный проект не меняется');
});

test('разница в цене: Blum дороже GTV, Pulse дешевле; в модуле — меньше, чем во всём проекте; направляющие меняют цену',()=>{
  const p=two(),base=estimate(p).retail!;
  const d=(q:Project)=>estimate(q).retail!-base;
  const blumAll=d(scopedSwap(p,null,q=>setAllHinges(q,'blum'))),blumOne=d(scopedSwap(p,'m2',q=>setAllHinges(q,'blum')));
  assert.ok(blumAll>0&&blumOne>0&&blumOne<blumAll,`${blumOne} < ${blumAll}`);
  assert.ok(d(scopedSwap(p,null,q=>setAllHinges(q,'pulse')))<0);
  assert.notEqual(d(scopedSwap(p,null,q=>setAllSlides(q,'hidden-premial-soft'))),0);
});
