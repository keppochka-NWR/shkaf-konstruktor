import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSheetQuotes} from '../src/compactPricing';
import {compactPriceCatalog} from '../src/compactPriceCatalog';
import {initialModule,RULES} from '../src/model';
import {kitchenWorktop} from '../src/kitchen';
import {estimate} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {newProject,parseProject} from '../src/project';

const decor='Premial HPL Compact Фаерстоун';
function top(width=2400,depth=600,name=decor){
  const m=kitchenWorktop(initialModule(),width);
  m.depth=depth;m.height=12;m.decor=name;
  m.worktop={...m.worktop!,material:'compact',thickness:12};return m;
}
function project(modules:ReturnType<typeof top>[]){
  return {...newProject(),modules:modules.map((module,i)=>({id:`top-${i}`,x:0,z:i*700,y:880,rotation:0 as const,module})),calculation:{markup:7,overrides:{},model:'sheet' as const}};
}
test('two 2400 by 600 tops use one Firestone sheet, charged once at 125000',()=>{
  const q=compactSheetQuotes([top(),top()]);assert.equal(q.length,1);
  assert.equal(q[0].sheets.length,1);assert.equal(q[0].price,125000);
  assert.equal(q[0].sheets.flat().length,2);
});
test('piece geometry, not area alone, determines full-sheet count',()=>{
  const q=compactSheetQuotes([top(2400,700),top(2400,700)])[0];
  assert.equal(q.sheets.length,2);assert.equal(q.price,250000);
});
test('waterfalls include outer mitre allowance; cutouts do not subtract material',()=>{
  const m=top();m.worktop!.waterfall={left:true,right:true,drop:868};
  const q=compactSheetQuotes([m])[0];assert.equal(q.sheets.flat().length,3);
  assert.equal(q.sheets.flat().find(p=>p.id==='0:left')!.w,880);
  assert.ok(q.sheets.flat().every(p=>p.x>=RULES.sheetMargin&&p.y>=RULES.sheetMargin));
});
test('different decors and thicknesses cannot share sheets',()=>{
  const other=compactPriceCatalog.find(s=>s.thickness===12&&s.decor!==decor)!;
  assert.equal(compactSheetQuotes([top(500,500),top(500,500,other.decor)]).length,2);
  const m=top(500,500);m.worktop!.thickness=4;
  const q=compactSheetQuotes([top(500,500),m]);assert.equal(q.length,2);
  assert.ok(q.every(g=>g.sheets.flat().length<=1));
});
test('a longer stock format is selected when the short format cannot fit',()=>{
  const d=compactPriceCatalog.find(s=>s.length===4200&&s.thickness===12)!;
  const q=compactSheetQuotes([top(3500,600,d.decor)])[0];
  assert.equal(q.stock?.length,4200);assert.equal(q.sheets.length,1);
});
test('unknown decor or oversized part cannot silently become zero or area price',()=>{
  for(const m of [top(5000),top(2400,600,'Unknown')]){
    const q=compactSheetQuotes([m])[0];assert.equal(q.price,null);assert.ok(q.error);
    const e=estimate(project([m]),[]);assert.equal(e.retail,null);
    assert.ok(e.missing.some(l=>l.id.startsWith('worktop:compact-sheet:')));
  }
});
test('engine, client rows and saved project keep whole-sheet price without another markup',()=>{
  const p=project([top(),top()]);const e=estimate(p,[]);
  const material=e.lines.filter(l=>l.id.startsWith('worktop:compact-sheet:'));
  assert.equal(material.length,1);assert.equal(material[0].unitPrice,125000);
  assert.equal(material[0].quantity,1);assert.equal(e.retail,125000);
  assert.ok(!e.lines.some(l=>l.id==='worktop:compact:12'));
  assert.ok(e.pending.some(l=>l.id==='worktop:edge:compact:12'));
  const c=clientView(e);assert.equal(c.lines.reduce((n,l)=>n+l.quantity*(l.unitPrice??0),0),125000);
  assert.equal(estimate(parseProject(JSON.parse(JSON.stringify(p))),[]).retail,125000);
});
