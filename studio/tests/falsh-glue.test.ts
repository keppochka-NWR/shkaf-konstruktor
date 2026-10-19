import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,falshGlue,falshPieces,falshZones,fillerSides,FALSH_GLUE_GAP,RULES} from '../src/model';
import {partCollisions} from '../src/collisions';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';

// Решение Макса 16.10.2026: фальш пересекает петлю, петлю не сдвинуть — фальш из 2 плит 16, склеенных в 32 мм,
// с разрывом 100 мм на участке петли.
const fillers=(m:ReturnType<typeof initialModule>)=>parts(m).filter(p=>p.id.includes(':filler:'));

test('составной фальш: «Шкаф в прихожую» — петля 100 мм от низа в зоне ящиков → склейка 32, разрыв у петли, 0 пересечений',()=>{
  const m=initialModule(),s=m.sections[0];
  const g=falshGlue(m);
  assert.deepEqual(g,{[s.id+':left']:[130]},'петля на высоте 130 от пола не сдвигается из зоны ящиков');
  assert.deepEqual(fillerSides(m,s),{left:32,right:0});
  const all=fillers(m),f=all.filter(p=>!/:r\d+$/.test(p.id));
  // ревью Codex R4: разрыв — только в зоне петли спереди, за петлёй вставка до задней кромки (держит направляющую нижнего ящика)
  assert.deepEqual(all.map(p=>p.id.split(':filler:')[1]),['left:a:0','left:a:r0','left:b:0','left:b:r0'],'две плиты; ниже петли полной глубины места нет (разрыв 80–180 от пола, дно проёма 96) — там вставка за петлёй');
  for(const p of f){assert.equal(p.thickness,16);assert.equal(p.size[0],16);assert.equal(p.length,276);assert.equal(p.position[1]-p.size[1]/2,180,'кусок начинается над разрывом 130+50');}
  assert.deepEqual(f.map(p=>p.position[0]),[24,40],'плита у боковины и плита к ящикам — вплотную, 32 мм');
  assert.match(f[0].name,/склейка 32 мм, плита у боковины/);
  // короб и фасад ящика сужены на вторую плиту и прошли плечо петли
  const ps=parts(m),box=ps.find(p=>p.id===s.id+':drawer:0:left')!,facade=ps.find(p=>p.id===s.id+':drawer:0:facade')!;
  assert.equal(box.position[0],69);assert.equal(facade.size[0],530);
  assert.deepEqual(partCollisions(ps,m),[],'фальш × петля и фасад ящика × петля ушли');
  // смета: склейка как работа; в прайсе строки нет — 0 ₽ с пометкой для менеджера, смета остаётся полной
  const e=estimate(newProject(m)),line=e.lines.find(l=>l.id==='falsh-glue');
  assert.ok(line,'строка склейки в смете');assert.ok(line!.quantity>0);assert.equal(line!.unit,'м²');assert.equal(line!.unitPrice,1000);assert.equal(line!.retail,true);assert.match(line!.source,/1000 ₽\/м²/);
  assert.ok(!e.missing.length&&e.byMarkup!==null,'цена клиенту не пропала');
});

test('составной фальш: две петли в зоне четырёх ящиков — разрыв 100 мм у каждой, куски между разрывами',()=>{
  const m=initialModule(),s=m.sections[0];s.drawers=4;
  const ys=falshGlue(m)[s.id+':left'];
  assert.ok(ys&&ys.length>=1,'петли в зоне ящиков');
  const f=fillers(m),a=f.filter(p=>p.id.includes(':left:a:')),b=f.filter(p=>p.id.includes(':left:b:'));
  assert.equal(a.length,b.length);assert.deepEqual(a.map(p=>p.size[1]),b.map(p=>p.size[1]),'обе плиты склейки — одинаковые куски');
  for(const p of f.filter(p=>/:r\d+$/.test(p.id)))assert.ok(p.position[2]+p.size[2]/2<=falshZones(m)[s.id+':left'][0].z+0.01,'вставка — за зоной петли');
  for(const y of ys!)for(const p of f.filter(p=>!/:r\d+$/.test(p.id))){const lo=p.position[1]-p.size[1]/2,hi=p.position[1]+p.size[1]/2;assert.ok(hi<=y-FALSH_GLUE_GAP/2+0.01||lo>=y+FALSH_GLUE_GAP/2-0.01,`кусок ${p.id} не заходит в разрыв у петли ${y}`);}
  assert.deepEqual(partCollisions(parts(m),m),[]);
  // разрыв посередине: два куска выше и ниже петли
  assert.deepEqual(falshPieces(100,700,[400]),[[100,350],[450,700]]);
  assert.deepEqual(falshPieces(96,456,[130]),[[180,456]]);
  assert.deepEqual(falshPieces(100,700,[120,640]),[[170,590]],'кусок короче 30 мм не делаем');
});

test('ручная нижняя петля над ящиками (480 мм) поджимается к 200 мм от низа фасада — фальш склеен, 0 пересечений; без петли в зоне ящиков — фальш 16',()=>{
  const m=initialModule(),s=m.sections[0];
  m.sections[0]={...s,hingeY:[480,830,1180,1530,1868],hingeYFor:1968};
  const ps=parts(m),door=ps.find(p=>p.role==='door'&&p.id.includes(':door:'))!,bot=door.position[1]-door.size[1]/2;
  const low=Math.min(...ps.filter(p=>p.id.includes(':hingecup:')).map(p=>p.position[1]));
  assert.ok(low-bot<=200,'петля не дальше 200 мм от низа фасада (решение Макса 16.10)');
  assert.ok(falshGlue(m)[s.id+':left']?.length,'петля в зоне ящиков — склейка 32 с разрывом');
  assert.deepEqual(partCollisions(ps,m),[]);
  // без дверей фальшей нет вовсе
  const open=initialModule();open.doors=false;assert.deepEqual(falshGlue(open),{});
  assert.deepEqual(fillerSides(open,open.sections[0]),{left:0,right:0});
  void RULES;void estimate;void newProject;
});
