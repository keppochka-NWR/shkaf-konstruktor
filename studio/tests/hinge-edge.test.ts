import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,validate,hingeEdgeErrors,boxes,RULES,type Part} from '../src/model';
import {partCollisions} from '../src/collisions';

// Решение Макса 16.10.2026: «Петля снизу обязательно должна быть, её максимум, который можем поднять, — 200 мм от края фасада».
// Крайние петли распашного фасада — не дальше 200 мм от своего края, промежуточные — равномерно; поиск сдвига от полок/царг
// у крайних — только в пределах [минимум правила, 200] от края.
const doorsOf=(ps:Part[])=>ps.filter(p=>p.role==='door'&&p.id.includes(':door:'));
const cupsOf=(ps:Part[],door:Part)=>ps.filter(p=>p.id.startsWith(door.id.replace(':door:',':hingecup:')+':')).map(p=>p.position[1]).sort((a,b)=>a-b);

for(const drawers of [2,0])for(const H of [1800,2000,2200,2400])test(`петли у края ≤ 200 мм: шкаф ${H}, ${drawers?'с ящиками за дверью':'без ящиков'}`,()=>{
  const m=initialModule();m.height=H;m.sections[0].drawers=drawers;if(!drawers)delete m.sections[0].drawerConfigs;
  assert.deepEqual(validate(m),[]);
  const ps=parts(m);
  for(const d of doorsOf(ps)){
    const bot=d.position[1]-d.size[1]/2,top=d.position[1]+d.size[1]/2,ys=cupsOf(ps,d);
    assert.ok(ys.length>=2,'нижняя и верхняя петли есть');
    assert.ok(ys[0]-bot>=40-0.01&&ys[0]-bot<=RULES.hingeEdgeMax+0.01,`нижняя петля ${ys[0]-bot} от низа фасада`);
    assert.ok(top-ys.at(-1)!>=40-0.01&&top-ys.at(-1)!<=RULES.hingeEdgeMax+0.01,`верхняя петля ${top-ys.at(-1)!} от верха фасада`);
  }
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('полки у низа двери: нижняя петля ищет место только до 200 мм от низа, не уходит выше',()=>{
  const m=initialModule();m.sections[0].drawers=0;delete m.sections[0].drawerConfigs;
  // полки в зоне идеальной петли (100 мм): без правила поиск ушёл бы до 300 мм
  const ps0=parts(m),d0=doorsOf(ps0)[0],bot=d0.position[1]-d0.size[1]/2;
  const b=boxes(m)[0],h=b.top-b.bottom;
  m.sections[0].shelves=[(bot+100-b.bottom)/h,(bot+150-b.bottom)/h,...m.sections[0].shelves.filter(f=>f*h>400)];
  const ps=parts(m),d=doorsOf(ps)[0],ys=cupsOf(ps,d);
  assert.ok(ys[0]-(d.position[1]-d.size[1]/2)<=RULES.hingeEdgeMax+0.01,`нижняя петля ${ys[0]-bot}`);
});

test('ручные высоты петель шкафа поджимаются в пределы 200 мм от краёв',()=>{
  const m=initialModule();m.sections[0]={...m.sections[0],hingeY:[480,830,1180,1530,1600],hingeYFor:1968};
  const ps=parts(m),d=doorsOf(ps)[0],bot=d.position[1]-d.size[1]/2,top=d.position[1]+d.size[1]/2,ys=cupsOf(ps,d);
  assert.ok(ys[0]-bot<=200+0.01,'нижняя ≤ 200');assert.ok(top-ys.at(-1)!<=200+0.01,'верхняя ≤ 200');
  assert.deepEqual(validate(m),[]);
});

test('крайнюю петлю не поставить у края без пересечения с жёсткой горизонталью — понятная ошибка, а не тихий перенос',()=>{
  const m=initialModule(),ps=parts(m),d=doorsOf(ps)[0];
  assert.deepEqual(hingeEdgeErrors(m,ps),[]);
  const cup=ps.find(p=>p.id===d.id.replace(':door:',':hingeplate:')+':0')!;
  // жёсткая полка ровно на плече нижней петли
  const shelf:Part={id:'probe:shelf',name:'Полка жёсткая',sectionId:m.sections[0].id,size:[400,16,400],position:[cup.position[0],cup.position[1],cup.position[2]],length:400,width:400,thickness:16,role:'shelf',material:'board',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0]};
  const errs=hingeEdgeErrors(m,[...ps,shelf]);
  assert.equal(errs.length,1);assert.match(errs[0],/нижнюю петлю двери не поставить в пределах 200 мм от низа фасада — мешает «Полка жёсткая»/);
});
