// Слияние w-lwing + w-formerrors (23.10): «Кухня угловая (Г)» и «Кухня П-образная» в форме «Добавить мебель» — ошибки списком у полей
// (длины рядов в пределах стен комнаты и угла), с исправлением; проверка формы согласована со сборкой (createKitchenCornerRow/URow)
// и постановкой в пустую комнату (автофальши + projectErrors — как placeKitchenCorner и «Добавить в комнату»).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule} from '../src/model';
import {KITCHEN} from '../src/kitchen';
import {createKitchenCornerRow,createKitchenURow,kitchenCornerBounds} from '../src/kitchenCornerRow';
import {paletteIssues,paletteAutoFix,type PaletteInput} from '../src/paletteCheck';
import {applyAutoFillers,projectErrors,newProject} from '../src/project';
import {KIND_LABEL} from '../src/paletteBuild';

const source=initialModule(),room={width:4000,depth:3000,height:2700};
const g=(back:number,side:number,extra:Partial<PaletteInput>={}):PaletteInput=>({kind:'kitchen-corner',width:back,height:KITCHEN.baseHeight,depth:KITCHEN.baseDepth,side,wing:'right',room,...extra});
const u=(left:number,back:number,right:number,extra:Partial<PaletteInput>={}):PaletteInput=>({kind:'kitchen-u',width:back,height:KITCHEN.baseHeight,depth:KITCHEN.baseDepth,left,side:right,room,...extra});
const builds=(inp:PaletteInput)=>{try{inp.kind==='kitchen-u'
  ?createKitchenURow(source,{left:inp.left!,back:inp.width,right:inp.side!,room:inp.room!,height:inp.height,depth:inp.depth})
  :createKitchenCornerRow(source,{back:inp.width,side:inp.side!,wing:inp.wing??'right',room:inp.room!,height:inp.height,depth:inp.depth});return true;}catch{return false;}};
/** «Добавить в комнату» удаётся: собирается и встаёт в пустую комнату без пересечений. */
const adds=(inp:PaletteInput)=>{if(!builds(inp))return false;const group=inp.kind==='kitchen-u'
  ?createKitchenURow(source,{left:inp.left!,back:inp.width,right:inp.side!,room:inp.room!,height:inp.height,depth:inp.depth})
  :createKitchenCornerRow(source,{back:inp.width,side:inp.side!,wing:inp.wing??'right',room:inp.room!,height:inp.height,depth:inp.depth});
  const p=newProject();return projectErrors(applyAutoFillers({...p,room:{...p.room,...inp.room!},modules:group})).length===0;};

test('виды Г и П в палитре: названия и поля',()=>{
  assert.equal(KIND_LABEL['kitchen-corner'],'Кухня угловая (Г)');assert.equal(KIND_LABEL['kitchen-u'],'Кухня П-образная');
  const palette=readFileSync(new URL('../src/ModulePalette.tsx',import.meta.url),'utf8');
  for(const s of ["'По левой стене'","'По задней стене'","'По боковой стене'","'По правой стене'",'Второе крыло угловой кухни','onAddGroup(group,true)'])assert.ok(palette.includes(s),s);
});

test('угловая 3000 × 2400 и П 3000 + 4000 + 2000 в комнате 4000 × 3000 — без ошибок, собираются',()=>{
  assert.deepEqual(paletteIssues(g(3000,2400),source),[]);assert.ok(builds(g(3000,2400)));
  assert.deepEqual(paletteIssues(u(2400,4000,2000),source),[]);assert.ok(builds(u(2400,4000,2000)));
});

test('Г: длины длиннее стен комнаты — обе ошибки сразу, у своих полей, с пределом и исправлением; автоисправление собирается',()=>{
  const list=paletteIssues(g(4500,3500),source);
  assert.deepEqual(list.map(x=>x.field),['width','side'],list.map(x=>x.problem).join(' / '));
  assert.equal(list[0].problem,'По задней стене 4500 > 4000 мм');assert.deepEqual(list[0].auto,{width:4000});assert.equal(list[0].limit?.max,4000);
  assert.equal(list[1].problem,'По боковой стене 3500 > 2980 мм');assert.deepEqual(list[1].auto,{side:2980});assert.match(list[1].action,/без 20 мм под фальш-планку/); /* фальш у стены 16 + 4 (29.10), было 2979 */
  // исходные тексты — тексты сборки (как у прочих видов формы)
  assert.match(list[0].text,/^Угловая кухня: ряд по задней стене 4500 мм длиннее стены \(4000 мм\)\.$/);
  const r=paletteAutoFix(g(4500,3500),source);
  assert.deepEqual(r.patch,{width:4000,side:2980});assert.equal(r.left.length,0);assert.ok(adds(r.input));
});

test('Г: короткие ряды — минимум по задней стене (угловой + модуль) и по боковой (глубина ряда + планка + модуль)',()=>{
  const b=kitchenCornerBounds();
  const list=paletteIssues(g(1100,600),source);
  assert.deepEqual(list.map(x=>x.field),['width','side'],list.map(x=>x.problem).join(' / '));
  assert.match(list[0].action,/только угловой/);assert.equal(list[0].fixes.length,2);
  assert.equal(list[1].problem,`По боковой стене 600 < ${Math.max(b.wingMin,b.worktopDepth+b.worktopMin)} мм`);assert.match(list[1].action,/столешницы крыла — от 200 мм/);
  for(const f of list.flatMap(x=>x.fixes))assert.ok(builds({...g(1100,600),...f.patch,...(f.patch.side===undefined?{side:2400}:{}),...(f.patch.width===undefined?{width:3000}:{})}),f.label);
  const r=paletteAutoFix(g(1100,600),source);assert.equal(r.left.length,0);assert.ok(adds(r.input));
});

test('П: задняя не во всю ширину комнаты — исправление «По задней стене 4000»; левая и правая длиннее стен — у своих полей',()=>{
  const list=paletteIssues(u(3200,3600,3100),source);
  assert.deepEqual(list.map(x=>x.field),['width','left','side'],list.map(x=>x.problem).join(' / '));
  assert.equal(list[0].problem,'По задней стене 3600 ≠ 4000 мм');assert.deepEqual(list[0].auto,{width:4000});
  assert.deepEqual(list[1].auto,{left:2980});assert.deepEqual(list[2].auto,{side:2980});
  const r=paletteAutoFix(u(3200,3600,3100),source);assert.equal(r.left.length,0);assert.ok(adds(r.input));
});

test('нет комнаты — ошибка без поля; высота вне пределов — у поля «Высота» вместе с длинами',()=>{
  const none=paletteIssues({...g(3000,2400),room:undefined},source);
  assert.equal(none.length,1);assert.equal(none[0].field,undefined);assert.match(none[0].problem,/ставится в комнату/);
  const hd=paletteIssues(g(4500,2400,{height:3000}),source);
  assert.deepEqual(hd.map(x=>x.field).sort(),['height','width']);
});

test('проверка формы согласована со сборкой и постановкой: нет ошибок ⇔ кухня встаёт в комнату (Г обе стороны, П)',()=>{
  let n=0;
  for(const back of [900,1000,1098,1099,1100,1200,1248,1249,1250,1300,2000,3000,3979,3980,4000,4001,4200])
    for(const side of [500,700,743,744,745,799,800,801,1500,2978,2979,2980,2999,3000,3001])
      for(const wing of ['left','right'] as const){const inp=g(back,side,{wing});assert.ok(paletteIssues(inp,source).every(x=>x.field&&!x.after),`Г ${back} × ${side}: ошибка без поля`);
        assert.equal(paletteIssues(inp,source).length===0,adds(inp),`Г ${wing} ${back} × ${side}: ${paletteIssues(inp,source).map(x=>x.problem).join(' / ')}`);n++;}
  for(const R of [2000,2196,2197,2200,2300,2346,2347,2400,3000,4000])
    for(const side of [700,744,799,800,2400,2979,2980]){const inp=u(side,R,side,{room:{...room,width:R}});
      assert.equal(paletteIssues(inp,source).length===0,adds(inp),`П ${R}: ${paletteIssues(inp,source).map(x=>x.problem).join(' / ')}`);n++;}
  assert.ok(n>300);
});
