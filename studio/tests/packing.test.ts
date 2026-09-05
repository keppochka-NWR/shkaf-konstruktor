import test from 'node:test';import assert from 'node:assert/strict';
import {packRectangles} from '../src/packing';
import {nest,nestGuillotine,details} from '../src/exports';
import {newProject} from '../src/project';
import {initialModule,id} from '../src/model';
test('random fixed-grain layouts preserve every rectangle and tool gap',()=>{
  let seed=42;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let run=0;run<40;run++){
    const input=Array.from({length:35},(_,i)=>({id:String(i),w:40+Math.floor(rand()*700),h:40+Math.floor(rand()*1700)}));
    for(const gap of [0,10,30]){
      const packed=packRectangles(input,1810,2730,gap,'area','short'),ids=packed.flat().map(p=>p.id);
      assert.equal(new Set(ids).size,input.length);assert.equal(ids.length,input.length);
      for(const sheet of packed)for(const [i,a]of sheet.entries()){
        assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=1810&&a.y+a.h<=2730);
        assert.equal(a.w,input[Number(a.id)].w);assert.equal(a.h,input[Number(a.id)].h);
        for(const b of sheet.slice(0,i))assert.ok(a.x>=b.x+b.w+gap||b.x>=a.x+a.w+gap||a.y>=b.y+b.h+gap||b.y>=a.y+a.h+gap);
      }
    }
  }
});
test('nesting several wardrobes never consumes more sheets than former layout',()=>{
  for(const count of [1,3,10,40]){
    const p=newProject();p.room={width:6000,depth:6000,height:2700};p.modules=Array.from({length:count},(_,i)=>({id:id(),x:(i%8)*650,z:30+Math.floor(i/8)*700,y:0,module:initialModule()}));
    const before=nestGuillotine(p),after=nest(p);assert.ok(after.length<=before.length);assert.equal(after.flatMap(s=>s.items).length,details(p).length);
    console.log(`${count} modules: ${before.length} → ${after.length} sheets`);
  }
});
test('invalid oversize rectangles and duplicate identities are rejected',()=>{assert.throws(()=>packRectangles([{id:'1',w:2000,h:500}],1810,2730,10,'area','short'));assert.throws(()=>packRectangles([{id:'1',w:100,h:500},{id:'1',w:100,h:500}],1810,2730,10,'area','short'));});
