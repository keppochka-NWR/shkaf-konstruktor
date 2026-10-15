import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {sideExtension} from '../src/project';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {sideStripOf,shiftRefX} from '../scripts/kitchen/recognize-fillers';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';

// Пакет 2 развития калькулятора: доборные планки и фальшпанели кухонь Базиса (backlog F_FILLER_STRIP, F_FILLER_FLAT).
// Эталоны вне репозитория — без них тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3),holes:c.holes?.extra.slice(0,3)});
const pass=(k:string,key:string)=>{const ref=load(k,key);const r=moduleFromEtalon(ref);const err=validate(r.module);const c=compareModule(ref,r.module);return {ok:honestPass(c,err,r.unsupported),m:r.module,info:why(c)+JSON.stringify(err)+JSON.stringify(r.unsupported)};};

// Синтетический эталон: корпус 600 между боковинами, планка ЛДСП 60 снаружи справа у лица корпуса + планка из фасада 58 в плоскости фасадов.
function synthStrip(side:'left'|'right'):RefModule{
  const ox=side==='left'?60:0, W=600;
  const box=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number)=>[ox+x0,y0,z0,ox+x1,y1,z1];
  const p=(i:number,name:string,kind:string,axis:string,b:number[],edges:{side:string;thick:number}[]=[])=>({i,name,mat:kind==='ldsp'?'ЛДСП':'Фасадный мат-л',thick:kind==='ldsp'?16:kind==='hdf'?3:16,kind,axis,box:b,edges});
  const sx=side==='left'?-60:W;
  return {key:'m00',name:'НМ синт.',archetype:'base-doors',size:[660,840,576],panels:[
    p(0,'Вертикальная','ldsp','x',box(0,116,3,16,840,560),[{side:'+z',thick:0.5},{side:'+y',thick:0.5}]),
    p(1,'Вертикальная','ldsp','x',box(W-16,116,3,W,840,560),[{side:'+z',thick:0.5},{side:'+y',thick:0.5}]),
    p(2,'Горизонтальная','ldsp','y',box(0,100,3,W,116,560),[{side:'+z',thick:0.5}]),
    p(3,'Горизонтальная','ldsp','y',box(16,824,460,W-16,840,560),[{side:'+z',thick:0.5},{side:'-z',thick:0.5}]),
    p(4,'Горизонтальная','ldsp','y',box(16,824,3,W-16,840,103),[{side:'+z',thick:0.5},{side:'-z',thick:0.5}]),
    p(5,'Фронтальная','hdf','z',box(1.5,101.5,0,W-1.5,838.5,3)),
    p(6,'Дверь','other','z',box(2,102,560,W-2,838,576)),
    p(7,'Фронтальная','ldsp','z',box(sx,100,544,sx+60,840,560),[{side:'-y',thick:0.5},{side:'+y',thick:0.5}]),
    p(8,'Фронтальная','other','z',box(side==='left'?sx+1:sx+2,102,560,side==='left'?sx+59:sx+60,838,576)),
  ],hardware:[70,530].flatMap((x,i)=>[73,493].map((z,j)=>({i:10+i*2+j,name:'Опора кухонная регулируемая, H100-120мм, чёрная',category:'опора',pos:[ox+x,100,z],quat:[0.5,0.5,0.5,-0.5],host:2}))),holes:[]};
}

test('доборная планка (F_FILLER_STRIP): распознаётся снаружи любой боковины, корпус студии — между боковинами, планки вне корпуса, модуль в ряду шире на ext',()=>{
  for(const side of ['left','right'] as const){
    const ref=synthStrip(side);
    const f=sideStripOf(ref)!;
    assert.ok(f,`планка ${side} распознана`);
    assert.equal(f.strip.side,side);
    assert.equal(f.strip.ext,60);
    assert.equal(f.strip.planks.length,1);
    assert.deepEqual(f.strip.planks[0],{z:541,w:60,y0:0,yt:0,edges:['+y','-y'],edgeT:0.5},'низ от низа дна, верх от верха корпуса (пакет 0)');
    assert.equal(f.strip.facade?.w,58);
    assert.equal(f.strip.facade?.inset,side==='left'?1:0,'отступ планки из фасада от наружного края модуля');
    assert.equal(f.strip.conf,undefined,'крепежа планки в проекте нет — поле не пишется');
    assert.deepEqual(f.panels,[7,8]);
    const {module:m,unsupported}=moduleFromEtalon(ref);
    assert.equal(m.width,600,'корпус между боковинами');
    assert.equal(unsupported.length,0,JSON.stringify(unsupported));
    assert.equal(sideExtension(m,side),60);
    assert.equal(sideExtension(m,side==='left'?'right':'left'),0);
    const ps=parts(m),pl=ps.find(p=>p.id==='side-strip:plank:0')!,fp=ps.find(p=>p.id==='side-strip:facade')!;
    assert.ok(pl&&fp);
    assert.ok(!pl.external&&pl.material==='board','планка ЛДСП — в раскрое');
    assert.ok(fp.external,'планка в плоскости фасадов — фасадный материал');
    const x0=pl.position[0]-pl.size[0]/2;
    assert.equal(x0,side==='left'?-60:600,'планка от наружной пласти боковины наружу');
    assert.equal(pl.edge.filter(e=>e>0).length,2,'кромка по проекту: только концы');
    // сверка планок с эталоном (двери синтетики без петель — их сверяют тесты на эталонах базы)
    const c=compareModule(ref,m);
    assert.ok(['b7','b8'].every(id=>c.pairs.some(p=>p.ref.id===id&&p.delta<=0.5)),why(c)+JSON.stringify(c.pairs.map(p=>[p.ref.id,p.studio.id,p.delta])));
    assert.equal(c.extra.filter(x=>x.id.startsWith('side-strip')).length,0);
    assert.equal(partCollisions(ps,m).filter(x=>/side-strip/.test(x.a+' '+x.b)).length,0);
  }
});

test('доборная планка: корпус с планкой слева — проект Базиса читается от наружной пласти левой боковины (shiftRefX), без планки ничего не меняется',()=>{
  const ref=synthStrip('left');
  const s=shiftRefX(ref,-60);
  assert.equal(s.panels[0].box[0],0);
  assert.equal(s.panels[7].box[0],-60);
  assert.equal(s.size[0],600);
  assert.equal(shiftRefX(ref,0),ref);
  const m0=moduleFromEtalon({...ref,panels:ref.panels.filter(p=>p.i<7),size:[600,840,576]}).module;
  assert.equal(m0.kitchen?.sideStrip,undefined);
  assert.equal(sideExtension(m0,'left'),0);
});

test('доборная планка: не планка — стойка-перегородка или полка снаружи боковины (k11 m04), планка шире 80 мм, нет двух боковин',()=>{
  const ref=synthStrip('right');
  const withPost={...ref,panels:[...ref.panels,{i:9,name:'Вертикальная',mat:'ЛДСП',thick:16,kind:'ldsp',axis:'x',box:[600,0,479,616,2500,579]}]};
  assert.equal(sideStripOf(withPost),undefined);
  const wide={...ref,panels:ref.panels.map(p=>p.i===7?{...p,box:[600,100,544,700,840,560]}:p.i===8?{...p,box:[602,102,560,700,838,576]}:p)};
  assert.equal(sideStripOf(wide),undefined);
  assert.equal(sideStripOf({...ref,panels:ref.panels.filter(p=>p.i!==1)}),undefined);
});

test('доборная планка: конфирматы из боковины в торец передней планки — только если они есть в проекте; глубина D5 по проекту',()=>{
  const ref=synthStrip('right');
  const conf=(i:number,y:number)=>({i,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[584,y,552],quat:[0.71,-0.71,0,0],host:1});
  const r2={...ref,hardware:[...ref.hardware,conf(0,200),conf(1,600)],holes:[{panel:7,face:'-x',at:[600,200,552],dir:[1,0,0],d:5,depth:42,src:0},{panel:7,face:'-x',at:[600,600,552],dir:[1,0,0],d:5,depth:42,src:1},{panel:1,face:'-x',at:[584,200,552],dir:[1,0,0],d:8,depth:16,src:0},{panel:1,face:'-x',at:[584,600,552],dir:[1,0,0],d:8,depth:16,src:1}]};
  const f=sideStripOf(r2)!;
  assert.deepEqual([f.strip.conf,f.strip.confTop],[[100],[240]],'нижняя половина планки — от её низа, верхняя — от верха (пакет 0)');
  assert.equal(f.strip.confDepth,42,'глубина по проекту, не как у корпуса (35)');
  const m=moduleFromEtalon(r2).module;
  assert.equal(m.kitchen?.outConf,undefined,'те же конфирматы — не стяжка с соседом');
  const ps=parts(m),cs=ps.filter(p=>p.id.startsWith('fast:side-strip:'));
  assert.equal(cs.length,2);
  assert.deepEqual(cs.map(p=>p.model!.origin![0]),[584,584],'головка на внутренней пласти боковины');
  const hs=holes(m,ps).filter(h=>h.src.startsWith('fast:side-strip:'));
  assert.deepEqual(hs.map(h=>`${h.part} D${h.d}×${h.depth}`).sort(),['right D8×16','right D8×16','side-strip:plank:0 D5×42','side-strip:plank:0 D5×42']);
  // отверстия проекта под эти конфирматы (D8×16 в боковине, D5×42 в торце планки) у студии есть в тех же точках
  const c=compareModule(r2,m);
  assert.equal(c.holes?.missing.length,0,JSON.stringify(c.holes?.missing));
  // без крепежа в проекте — студия его не добавляет (правило Макса), и модуль без kitchen.sideStrip крепежа планки не получает
  assert.equal(parts(moduleFromEtalon(ref).module).filter(p=>p.id.startsWith('fast:side-strip:')).length,0);
});

test('доборная планка: сохраняется в проекте (parseModule) и не трогает шкафы студии',()=>{
  const m=moduleFromEtalon(synthStrip('right')).module;
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.sideStrip,m.kitchen?.sideStrip);
  assert.deepEqual(parts(back).map(p=>p.id),parts(m).map(p=>p.id));
  const w=initialModule();
  assert.equal(w.kitchen,undefined);
  assert.equal(parts(w).some(p=>p.id.startsWith('side-strip')),false);
  assert.equal(sideExtension(w,'left'),0);
});

test('доборная планка по базе Базиса: k25 m09 (две планки, без крепежа), k18 m01 (конфирматы), k20 m07 (антресоль), k26 m07 (три планки), k32 m10 (без планки из фасада), k29 m07 (только планка из фасада) — сверка PASS',{skip:!has('k25')||!has('k18')||!has('k20')||!has('k26')||!has('k32')||!has('k29')},()=>{
  const r25=pass('k25','m09');
  assert.ok(r25.ok,r25.info);
  assert.deepEqual(r25.m.kitchen?.sideStrip,{side:'left',ext:44,planks:[{z:491,w:44,y0:0,yt:0,edges:['+y','-y'],edgeT:1},{z:41,w:44,y0:0,yt:0,edges:['+y','-y'],edgeT:1}],facade:{w:40,inset:3,y0:1.5,yt:1.5,t:19,air:0}});
  assert.equal(r25.m.width,290);
  const r18=pass('k18','m01');
  assert.ok(r18.ok,r18.info);
  // конфирматы Базиса на 66, 418, 770 от низа планки: нижний — от низа (conf), два верхних — от верха (confTop), пакет 0
  const s18=r18.m.kitchen!.sideStrip!,h18=parts(r18.m).find(p=>p.id==='side-strip:plank:0')!.size[1];
  assert.deepEqual(s18.conf,[66]);
  assert.deepEqual(s18.confTop?.map(y=>Math.round((h18-y)*10)/10),[770,418]);
  assert.equal(r18.m.kitchen?.outConf,undefined);
  for(const [k,key,side,n] of [['k20','m07','right',1],['k26','m07','right',3],['k32','m10','right',1],['k29','m07','right',0]] as const){
    const r=pass(k,key);
    assert.ok(r.ok,`${k} ${key}: ${r.info}`);
    assert.equal(r.m.kitchen?.sideStrip?.side,side);
    assert.equal(r.m.kitchen?.sideStrip?.planks.length,n);
  }
  assert.equal(pass('k32','m10').m.kitchen?.sideStrip?.facade,undefined,'k32 m10: только планка ЛДСП у лица корпуса');
  assert.equal(pass('k29','m07').m.kitchen?.sideStrip?.facade?.w,44);
});

test('доборная планка: стойка-перегородка снаружи боковины (k11 m04) — не планка, поле не ставится',{skip:!has('k11')},()=>{
  assert.equal(moduleFromEtalon(load('k11','m04')).module.kitchen?.sideStrip,undefined);
});

// F_FILLER_FLAT: плоская фальшпанель углового стыка из фасадного материала у навесных/антресолей (faceFiller.facadeMat)
test('фальшпанель углового стыка из фасада (k06 m11): панель по высоте ряда дверей у края модуля, дверь у фальша на петлях под фальшпанель — сверка PASS',{skip:!has('k06')},()=>{
  const r=pass('k06','m11');
  assert.ok(r.ok,r.info);
  assert.deepEqual(r.m.kitchen?.faceFiller,{side:'right',width:350,facadeMat:true});
  assert.equal(r.m.faceGap,1.5);
  assert.equal(r.m.sections[0].doorLeaves,2);
  const ps=parts(r.m),fp=ps.find(p=>p.id==='face-filler:fp:facade')!;
  assert.ok(fp&&fp.external,'фальш — фасадный материал, вне раскроя');
  assert.equal(fp.position[0]+fp.size[0]/2,1000,'от края модуля');
  assert.equal(fp.size[1],347,'по высоте ряда дверей');
  const ffh=ps.filter(p=>p.falsePanelHinge&&p.id.includes(':hingeplate:'));
  assert.equal(ffh.length,2,'петли под фальшпанель — только у двери рядом с фальшем');
  assert.ok(ffh.every(p=>Math.abs(p.model!.origin![0]-648.5)<0.01),'точка петли — кромка двери у фальша');
  assert.equal(holes(r.m).filter(h=>h.d===3&&h.depth===3&&h.src.includes(':hingeplate:')&&h.part==='right').length,0,'наколок под планку у петель под фальшпанель нет');
  assert.equal(partCollisions(ps,r.m).filter(c=>/face-filler|hinge/.test(c.a+' '+c.b)).length,0);
});

test('фальшпанель из фасада с отступом от края (k22 m08: 2 мм = faceGap): фальш и двери на своих местах; сохраняется в проекте',{skip:!has('k22')},()=>{
  const ref=load('k22','m08'),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
  assert.deepEqual(r.module.kitchen?.faceFiller,{side:'right',width:372,facadeMat:true,inset:2});
  assert.ok(!r.unsupported.some(u=>u.includes('фасадов в ряду')),JSON.stringify(r.unsupported));
  for(const n of ['Фронтальная','Дверь'])assert.ok(c.pairs.filter(p=>p.ref.name===n).every(p=>p.delta<=0.5),`${n}: ${JSON.stringify(c.pairs.filter(p=>p.ref.name===n).map(p=>p.delta))}`);
  assert.equal(c.missing.length+c.extra.length,0,why(c));
  const back=parseModule(JSON.parse(JSON.stringify(r.module)));
  assert.deepEqual(back.kitchen?.faceFiller,r.module.kitchen?.faceFiller);
  assert.deepEqual(parts(back).map(p=>p.id),parts(r.module).map(p=>p.id));
});

test('фальшпанель из фасада — только при петлях под фальшпанель у её кромки; мойки с фальшем ЛДСП (k25 m02, k28 m17) — как раньше',{skip:!has('k25')||!has('k28')||!has('k06')},()=>{
  assert.deepEqual(pass('k25','m02').m.kitchen?.faceFiller,{side:'left',width:273,strip:59});
  assert.ok(pass('k28','m17').ok);
  const ref=load('k06','m11'),noH={...ref,hardware:ref.hardware.filter(h=>!/под фальшпанель/i.test(h.name))};
  assert.equal(moduleFromEtalon(noH).module.kitchen?.faceFiller,undefined);
});
