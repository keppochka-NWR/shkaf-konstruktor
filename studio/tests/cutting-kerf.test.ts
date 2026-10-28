// Раскрой сметы (критик 28.10.2026): лист 2750×1830, поле по краю 10 мм, пропил между деталями 4 мм (правило Макса).
// До правки промежуток между деталями был 10 мм тем же параметром, что и поле, — смета брала лишний лист (+14–23 % к цене).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,RULES} from '../src/model';
import {createModule} from '../src/paletteBuild';
import {applyAutoFillers,type Project,type PlacedModule} from '../src/project';
import {addUpperModule} from '../src/operations';
import {nest} from '../src/exports';
import {estimate} from '../src/pricing';
import {cutting} from '../src/cornerCutting';
import {cornerProject,CORNER_DEFAULT} from '../src/cornerWardrobe';

const room={width:4000,depth:3000,height:2700,openings:[]};
const corpus=(decor:string)=>({...initialModule(),decor}); // фасады — декор по умолчанию (Белый)
const place=(id:string,x:number,m:ReturnType<typeof createModule>)=>({id,x,y:0,z:33,rotation:0,module:m}) as PlacedModule;
const ldsp=(p:Project,decor?:string)=>nest(p).filter(s=>s.material!=='hdf'&&(!decor||s.decor===decor));

test('правило раскроя: пропил 4 мм между деталями, поле 10 мм по краю — разные параметры',()=>{
  assert.equal(RULES.sheetKerf,4);
  assert.equal(RULES.sheetMargin,10);
  const p:Project=applyAutoFillers({version:3,room,modules:[place('a',100,createModule('wardrobe',1200,2400,600,corpus('Дуб Вотан'),3))]});
  for(const s of ldsp(p))for(const a of s.items){
    assert.ok(a.x>=RULES.sheetMargin-1e-6&&a.y>=RULES.sheetMargin-1e-6&&a.x+a.w<=s.width-RULES.sheetMargin+1e-6&&a.y+a.h<=s.height-RULES.sheetMargin+1e-6,'деталь в поле листа');
    for(const b of s.items)if(a!==b)assert.ok(a.x+a.w+RULES.sheetKerf<=b.x+1e-6||b.x+b.w+RULES.sheetKerf<=a.x+1e-6||a.y+a.h+RULES.sheetKerf<=b.y+1e-6||b.y+b.h+RULES.sheetKerf<=a.y+1e-6,'между деталями не меньше пропила');
  }
});

test('шкаф 1200×2400×600, 3 двери, штанги, корпус «Дуб Вотан»: корпус — 2 листа (было 3: полке 766×595 не хватало 5 мм)',()=>{
  const p:Project=applyAutoFillers({version:3,room,modules:[place('a',100,createModule('wardrobe',1200,2400,600,corpus('Дуб Вотан'),3))]});
  assert.equal(ldsp(p,'Дуб Вотан').length,2);
  assert.equal(ldsp(p).length,3,'корпус 2 + фасады 1');
  assert.equal(estimate(p).ldspSheets,3);
});

test('два шкафа по 900 + антресоль: 4 листа ЛДСП, четыре двери шириной 447 встают поперёк одного листа',()=>{
  let p:Project=applyAutoFillers({version:3,room,modules:[place('a',100,createModule('wardrobe',900,2000,600,corpus('Дуб Вотан'))),place('b',1000,createModule('wardrobe',900,2000,600,corpus('Дуб Вотан')))]});
  p=addUpperModule(p,'a');
  assert.equal(ldsp(p).length,4);
  assert.equal(ldsp(p,'Белый').length,1,'фасады 2 шкафов и антресоли — один лист');
  assert.equal(estimate(p).ldspSheets,4);
});

test('угловой шкаф (фигурный раскрой): тот же пропил 4 мм и поле 10 мм',()=>{
  const r=cutting(cornerProject(CORNER_DEFAULT));
  assert.equal(r.gap,RULES.sheetKerf);
  assert.equal(r.margin,RULES.sheetMargin);
});
