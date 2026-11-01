// Тяга окна/двери мышью (запрос Макса 31.10.2026): привязки 10 мм, углы, края соседних проёмов, подоконник; прямоугольник и контур.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,projectErrors,type Opening,type Project} from '../src/project';
import {snapOpening,placeOpening,openingSpot,parseOpeningTyped,ownOffset,clampOpening,openingOverlap} from '../src/openingDrag';
import {outlinePreset,withOutline} from '../src/roomOutline';

const win=(id:string,wall:Opening['wall'],offset:number,width=1200,sill=850,height=1400):Opening=>({id,type:'window',wall,offset,width,height,sill});
function room(openings:Opening[]):Project{const p=newProject();p.room={width:4000,depth:3000,height:2700,openings};return p;}

test('окно: шаг 10, угол и край соседнего окна', () => {
  const p=room([win('a','back',500),win('b','back',2500,800)]);
  assert.deepEqual(snapOpening(p.room,'a',1234,850,{vertical:false}),{s:1230,sill:850,what:[]});
  const c=snapOpening(p.room,'a',25,850,{vertical:false});assert.equal(c.s,0);assert.deepEqual(c.what,['угол']);
  const d=snapOpening(p.room,'a',1290,850,{vertical:false});assert.equal(d.s,1300,'правый край вплотную к окну 2 (2500 − 1200)');assert.match(d.what[0],/окно 2/);
  assert.equal(snapOpening(p.room,'a',1290,850,{vertical:false,free:true}).s,1290,'без привязок — только шаг 10');
  assert.equal(snapOpening(p.room,'a',9000,850,{vertical:false}).s,2800,'не дальше конца стены');
});

test('окно: подоконник по высоте только на виде спереди, привязка к соседнему окну', () => {
  const p=room([win('a','back',200),win('b','back',2500,800,900)]);
  assert.equal(snapOpening(p.room,'a',200,700,{vertical:false}).sill,850,'сверху высота не меняется');
  const s=snapOpening(p.room,'a',200,880,{vertical:true});assert.equal(s.sill,900);assert.ok(s.what.includes('подоконник окна 2'));
  assert.equal(snapOpening(p.room,'a',200,5000,{vertical:true}).sill,1300,'не выше потолка (2700 − 1400)');
  const door:Opening={id:'d',type:'door',wall:'left',offset:400,width:900,height:2100,sill:0};
  assert.equal(snapOpening(room([door]).room,'d',600,400,{vertical:true}).sill,0,'дверь по высоте не тянется');
});

test('проём на новом месте: передняя стена — отступ по старым правилам, одна правка без ошибок', () => {
  const p=room([win('f','front',300,1000)]);
  const sp=openingSpot(p.room,p.room.openings![0]);assert.equal(sp.edge,2);assert.equal(sp.s,2700,'обход передней стены — справа налево');
  const n=placeOpening(p,'f',{s:1000,sill:900});assert.equal(n.room.openings![0].offset,2000);assert.equal(n.room.openings![0].sill,900);
  assert.equal(ownOffset(p.room,p.room.openings![0],1000),2000);assert.deepEqual(projectErrors(n),[]);
});

test('контур: окно на косой стене едет вдоль неё', () => {
  const p=room([]);p.room=withOutline(p.room,outlinePreset('chamfer',4000,3000));
  const o=p.room.outline!,diag=o.findIndex((q,i)=>{const n=o[(i+1)%o.length];return Math.abs(n.x-q.x)>1&&Math.abs(n.z-q.z)>1;});
  p.room.openings=[{id:'w',type:'window',wall:'back',edge:diag,offset:50,width:400,height:1000,sill:900}];
  const s=snapOpening(p.room,'w',203,900,{vertical:false});assert.equal(s.s,200);
  const n=placeOpening(p,'w',{s:s.s,sill:900});assert.equal(n.room.openings![0].edge,diag);assert.equal(n.room.openings![0].offset,200);assert.deepEqual(projectErrors(n),[]);
});

test('набор «600;900»', () => {
  assert.deepEqual(parseOpeningTyped('600;900'),{offset:600,sill:900});
  assert.deepEqual(parseOpeningTyped('600'),{offset:600});
  assert.equal(parseOpeningTyped('6x0'),null);
});

test('набор и тяга окна: в пределах стены и потолка, пересечение с другим проёмом — красное (критик 31.10)', () => {
  const p=room([win('a','back',500),win('b','back',2500,800)]);
  assert.deepEqual(clampOpening(p.room,'a',3900,2000),{s:2800,sill:1300},'4000 − 1200 по стене, 2700 − 1400 по высоте');
  assert.deepEqual(clampOpening(p.room,'a',-50,-10),{s:0,sill:0});
  assert.match(openingOverlap(p.room,'a',2000,850)!,/пересекается с окном 2/);
  assert.equal(openingOverlap(p.room,'a',1300,850),null,'вплотную — можно');
  assert.equal(openingOverlap(p.room,'a',2000,2300-1400+1400),null,'выше окна 2 — можно');
});