import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,facadeTop} from '../src/model';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Пакет 5 развития калькулятора: секции, составные корпуса, сетка фасадов (backlog F_STACKED, F_PARTITION, F_ROWS…).
// Эталоны вне репозитория — тесты с ними пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const box=(p:{size:number[];position:number[]})=>p.position.map((v,i)=>[+(v-p.size[i]/2).toFixed(1),+(v+p.size[i]/2).toFixed(1)]);

test('F_STACKED: пенал на опорах, верхний ряд дверей выше боковин — kitchen.faceTop < 0; шкаф студии — без поля, как прежде',()=>{
  const m=initialModule();m.kitchen={role:'tall',faceTop:-388.5};m.feet={height:100};m.height=2460;m.width=600;m.depth=577;
  m.doors=true;m.sections[0].doorSplit=1797.5;m.sections[0].doorLeaves=1;m.sections[0].shelves=[];
  assert.equal(facadeTop(m),2848.5,'верх фасадов = верх корпуса + 388,5');
  const doors=parts(m).filter(p=>p.role==='door').map(box).sort((a,b)=>a[1][0]-b[1][0]);
  assert.equal(doors.length,2,'два ряда по одной створке');
  assert.equal(doors[1][1][1],2848.5,'верхний ряд выше боковин');
  // без опор поле не действует (как и прежде у faceTop): верх фасадов — от высоты корпуса
  const n=structuredClone(m);delete n.feet;assert.ok(facadeTop(n)<n.height);
});

test('F_STACKED (k31 m18, m19): фасады выше боковин на 388,5 — разрез рядов как в Базисе, петли 6/6, без «не поддержано» по фасадам',{skip:!has('k31')},()=>{
  for(const key of ['m18','m19']){
    const ref=load('k31',key),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
    assert.equal(r.module.kitchen?.faceTop,-388.5,key);
    assert.ok(!r.unsupported.some(u=>/выше боковин/.test(u)),key+' '+r.unsupported.join('; '));
    assert.equal(c.missing.filter(x=>/Дверь/.test(x.name)).length,0,key+' двери Базиса на месте');
    assert.equal(c.extra.filter(x=>/Фасад/.test(x.name)).length,0,key+' лишних фасадов нет');
    const h=c.hardware.find(x=>x.category==='петля')!;assert.equal(h.ref,h.studio,key+' петли');assert.equal(h.maxPosDelta,0,key+' места петель');
    assert.ok(!validate(r.module).length,key+' '+validate(r.module).join('; '));
  }
});
