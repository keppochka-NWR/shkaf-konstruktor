import test from 'node:test';
import assert from 'node:assert/strict';
import {xf,compose,panelBox,type Trans,type CPanel} from '../scripts/wardrobe/xform';
import {isWardrobeImportFile} from '../scripts/wardrobe/files';

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
