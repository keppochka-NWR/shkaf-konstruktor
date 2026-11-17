import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,parseProject} from '../src/project';
import {parts,validate} from '../src/model';
import {facadePanels} from '../src/facadePanels';
import {setPanelFacade} from '../src/panelFacadeSelection';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {BoxGeometry} from 'three';
import {compactMaterialGroups} from '../src/compactEdges';

for(const brand of ['AGT','Eterno'])test(`${brand}: real sheet size, price once, drawer material survives import`,()=>{
 const panel=facadePanels.find(p=>p.brand===brand&&p.sheet)!,p=newProject(),m=p.modules[0].module;
 m.doors=false;setPanelFacade(m,'drawerFacadeDecor',panel.n);
 assert.deepEqual(validate(m),[]);
 const faces=parts(m).filter(d=>d.id.endsWith(':facade'));assert.ok(faces.length);
 assert.ok(faces.every(d=>d.decor===panel.n&&d.thickness===18));
 assert.ok(parts(m).filter(d=>d.id==='left'||d.id==='right').every(d=>d.thickness===16));
 const q=parseProject(JSON.parse(JSON.stringify(p)));assert.equal(q.modules[0].module.drawerFacadeT,18);
 const sheets=nest(q),panelSheets=sheets.filter(s=>s.decor===panel.n);assert.ok(panelSheets.length);
 assert.ok(panelSheets.every(s=>s.width===1220&&s.height===2800));
 const e=estimate(q),line=e.lines.find(l=>l.id==='facade-panel:'+panel.n)!;
 assert.equal(line.unitPrice,brand==='AGT'?45000:55000);assert.equal(line.quantity,panelSheets.length);assert.equal(line.retail,true);
 assert.equal(e.ldspSheets,sheets.filter(s=>s.material!=='hdf'&&s.decor!==panel.n).length);
 assert.ok(!e.lines.some(l=>l.id==='sheet:'+panel.n));
});
test('unverified panel dimensions cannot silently use Lamarty dimensions',()=>{
 const panel=facadePanels.find(p=>!p.sheet)!;
 assert.throws(()=>setPanelFacade(newProject().modules[0].module,'facadeDecor',panel.n),/подтверждения/);
});
test('compact material separates top and bottom faces from the four black edges',()=>{
 const g=new BoxGeometry(1000,12,600);compactMaterialGroups(g,1);
 assert.equal(g.groups.filter(x=>x.materialIndex===0).reduce((n,x)=>n+x.count,0),12);
 assert.equal(g.groups.filter(x=>x.materialIndex===1).reduce((n,x)=>n+x.count,0),24);
 g.dispose();
});
