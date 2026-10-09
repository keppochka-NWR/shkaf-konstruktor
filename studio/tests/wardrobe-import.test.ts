import test from 'node:test';
import assert from 'node:assert/strict';
import {xf,compose,panelBox,type Trans,type CPanel} from '../scripts/wardrobe/xform';
import {isWardrobeImportFile} from '../scripts/wardrobe/files';
import {packRows} from '../scripts/wardrobe/pack';

test('сцена Базиса шире 20 м раскладывается рядами в помещение до 20 000 мм, модули не пересекаются',()=>{
  // как 025: 7 изделий, в сцене 23 м по ширине; одно висит на y=3500 (выше 2600 — на пол)
  const items=[{w:2400,h:2500,d:616,y:0},{w:3800,h:416,d:420,y:0},{w:1200,h:600,d:450,y:200},{w:2502,h:180,d:420,y:281},{w:1830,h:2402,d:616,y:60},{w:9503,h:2500,d:585,y:3500},{w:2435,h:2500,d:638,y:0}];
  const r=packRows(items)!;
  assert.ok(r);
  assert.ok(r.room.width<=20000&&r.room.depth<=20000&&r.room.height<=20000,JSON.stringify(r.room));
  r.pos.forEach((p,i)=>{const it=items[i];assert.ok(p.x>=0&&p.z>=0&&p.x+it.w<=r.room.width&&p.z+it.d<=r.room.depth&&p.y+it.h<=r.room.height,`модуль ${i}`);});
  assert.equal(r.pos[2].y,200); assert.equal(r.pos[5].y,0);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=r.pos[i],b=r.pos[j],A=items[i],B=items[j];
    const sep=a.x+A.w<=b.x||b.x+B.w<=a.x||a.z+A.d<=b.z||b.z+B.d<=a.z;
    assert.ok(sep,`модули ${i} и ${j} пересекаются`);
  }
  // один модуль шире лимита (как 051, 33 м) — не раскладываем
  assert.equal(packRows([{w:33428,h:2665,d:16,y:0}]),null);
});

test('parts-snapshot исключает только импорт wardrobe-NNN.json и wardrobes.json',()=>{
  for(const f of ['wardrobe-001.json','wardrobe-271.json','wardrobes.json']) assert.ok(isWardrobeImportFile(f),f);
  for(const f of ['wardrobe.json','wardrobe-ivanov.json','wardrobe-12-copy.json','wardrobe-001.json.bak','my-wardrobe-001.json']) assert.ok(!isWardrobeImportFile(f),f);
});

const T=(x:number,y:number,z:number,q:[number,number,number,number]=[1,0,0,0]):Trans=>({x,y,z,q});
const near=(a:number[],b:number[])=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`[${i}] ${v} != ${b[i]}`));
const s=Math.SQRT1_2;

test('wardrobe import: panel.chain учитывается (днище ящика встаёт на направляющую, а не на пол)',()=>{
  // сборка ящика на высоте 800, у днища chain = подъём на 15 (как wardrobe-012: днище y=815 на направляющей y=815)
  const p:CPanel={name:'Дно ящика',mat:'ЛДСП 16',thick:16,bbox:[0,0,400,500],trans:T(0,0,0,[s,-s,0,0]),chain:[T(0,15,0)]};
  const b=panelBox(p,xf(T(0,800,0)))!;
  assert.equal(Math.round(b[1]),815);
  const noChain=panelBox({...p,chain:undefined},xf(T(0,800,0)))!;
  assert.equal(Math.round(noChain[1]),800);
});

test('wardrobe import: порядок chain как в dump.py — сборка ∘ chain[0] ∘ … ∘ chain[n-1] ∘ trans',()=>{
  // chain[0] = поворот 90° вокруг Y, chain[1] = сдвиг x+100: точка (0,0,0) -> R·(100,0,0) = (0,0,-100)
  const p:CPanel={name:'деталь',mat:'ЛДСП',thick:0,bbox:[0,0,0,0],trans:T(0,0,0),chain:[T(0,0,0,[s,0,s,0]),T(100,0,0)]};
  near(panelBox(p,xf())!,[0,0,-100,0,0,-100]);
  // обратный порядок дал бы (100,0,0) — проверяем, что это не так
  const rev=panelBox({...p,chain:[...p.chain!].reverse()},xf())!;
  near(rev,[100,0,0,100,0,0]);
  // без chain совпадает с прежним расчётом сборка ∘ trans
  const w=compose(xf(T(10,20,30)),xf(T(1,2,3)));
  near(panelBox({...p,chain:[],trans:T(1,2,3)},xf(T(10,20,30)))!,[...w.t,...w.t]);
});
