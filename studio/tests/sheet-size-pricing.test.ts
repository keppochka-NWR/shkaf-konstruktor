import assert from 'node:assert/strict';
import test from 'node:test';
import {newProject} from '../src/project';
import {nest} from '../src/exports';
import {estimate} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {freePanel} from '../src/freePanels';
import {fitsSheet} from '../src/sheetLimits';

test('only a single part crossing both thresholds adds one surcharge per LDSP sheet',()=>{
 const p=newProject(),sheet=nest(p).find(s=>s.material!=='hdf')!,item=sheet.items[0];
 const calc=(sizes:number[][],material=sheet.material)=>estimate(p,[{...sheet,material,items:sizes.map(([length,width])=>({...item,detail:{...item.detail,length,width}}))}]);
 const ordinary=calc([[2500,900]]);
 for(const pair of [[2600,600],[2000,1000],[2500,901],[2501,900],[900,2500]])assert.equal(calc([pair]).bySheet,ordinary.bySheet);
 assert.equal(calc([[2600,600],[2000,1000]]).oversizedSheets,0);
 const large=calc([[2501,901],[901,2501]]);
 assert.equal(large.oversizedSheets,1);
 assert.equal(large.bySheet-ordinary.bySheet,large.sheetPrice);
 assert.equal(clientView(large).lines.find(l=>l.id==='sheet-oversize')?.quantity,1);
 assert.equal(calc([[2501,901]],'hdf').oversizedSheets,0);
});
test('trim and grain define usable sheet dimensions',()=>{
 const board={material:'board',decor:'Дуб Вотан',length:2730,width:1810};
 assert.ok(fitsSheet(board));assert.equal(fitsSheet({...board,length:2731}),false);
 assert.equal(fitsSheet({...board,length:1810,width:2730}),false);
 assert.ok(fitsSheet({...board,material:'hdf',length:2050,width:2780}));
});

test('horizontal free panel retains face dimensions through nesting and pricing',()=>{
 const p=newProject();
 p.modules=[freePanel({name:'Панель',width:901,height:2501,plane:'xz',edge:0,thickness:16,decor:'Белый'})];
 const sheet=nest(p)[0];
 assert.deepEqual([sheet.items[0].detail.length,sheet.items[0].detail.width],[2501,901]);
 assert.equal(estimate(p).oversizedSheets,1);
});
