// Цоколь кухни по Базису (вопрос Макса «почему студия добавляет то, чего нет в Базисе», критик 09.10.2026):
// у навесного/антресоли с приподнятым дном (фасад свисает ниже дна) цоколя в Базисе нет — студия его не добавляет;
// если под дном есть фронтальная ЛДСП (цоколь под другим именем) — ставит. Шкафы студии — как раньше.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,section,parts,validate} from '../src/model';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import type {RefModule} from '../scripts/kitchen/compare';

const ET=(k:string)=>`C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/${k}.json`;
const ref=(k:string,key:string)=>(JSON.parse(readFileSync(ET(k),'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('кухня: приподнятое дно без опор и без панели под ним — без «Цоколя»; шкаф студии — с цоколем',()=>{
  const wall={...initialModule(),sections:[section()],kitchen:{role:'wall' as const},plinthHeight:14};
  assert.ok(!parts(wall).some(p=>p.id==='plinth'),'навесной: цоколя нет');
  assert.ok(!validate(wall).some(e=>/цокол/i.test(e)),'подъём 14 мм у кухни — не «высота цоколя из списка»');
  const low={...wall,kitchen:{role:'wall' as const,lowFront:true}};
  assert.ok(parts(low).some(p=>p.id==='plinth'),'есть панель под дном в Базисе — ставим');
  const wardrobe={...initialModule(),sections:[section()],plinthHeight:80};
  assert.ok(parts(wardrobe).some(p=>p.id==='plinth'),'шкаф студии — цоколь как раньше');
  assert.ok(validate({...wardrobe,plinthHeight:14}).some(e=>/цоколя из списка/.test(e)),'у шкафа список высот прежний');
});

test('эталоны Базиса: k28 «Вм 5» (антресоль) — без цоколя; k14 «ВМ2» — фронтальная ЛДСП под дном остаётся цоколем',{skip:!existsSync(ET('k28'))||!existsSync(ET('k14'))},()=>{
  const a=moduleFromEtalon(ref('k28','m10')).module;
  assert.ok(!parts(a).some(p=>p.id==='plinth'));
  assert.equal(a.kitchen?.lowFront,undefined);
  const b=moduleFromEtalon(ref('k14','m03')).module;
  assert.equal(b.kitchen?.lowFront,true);
  assert.ok(parts(b).some(p=>p.id==='plinth'));
});

test('k04 m01: левые опоры и клипсы — левые сетки и поворот Базиса (cb84c30b57a5, 7ebcad9fda10), правые — как раньше',{skip:!existsSync(ET('k04'))},()=>{
  const r=ref('k04','m01'),m=moduleFromEtalon(r).module,ps=parts(m),W=r.size[0];
  const key=(mesh:string,q:number[])=>mesh+' '+q.map(v=>Math.round(v*100)/100).join(',');
  // по сторонам: набор «сетка + поворот» у Базиса и у студии совпадает
  const side=(x:number)=>x<W/2?'L':'R';
  const bz=new Set(r.hardware.filter(h=>h.category==='опора'||h.category==='клипса').map(h=>h.category+' '+side(h.pos[0])+' '+key((h as {mesh:string}).mesh,(h as {quat:number[]}).quat)));
  const st=new Set(ps.filter(p=>(p.id.startsWith('leg:')||p.id.startsWith('kitchen-clip:'))&&p.model).map(p=>(p.id.startsWith('leg:')?'опора':'клипса')+' '+side(p.model!.origin![0])+' '+key(p.model!.file.replace(/^.*\//,'').replace('.glb',''),p.model!.quat!)));
  assert.deepEqual([...st].sort(),[...bz].sort());
  assert.ok([...st].some(s=>s.startsWith('опора L cb84c30b57a5')),'левая опора — левая сетка');
});