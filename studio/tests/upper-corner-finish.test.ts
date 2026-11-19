import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,parseModule} from '../src/model';
import {kitchenWallCorner,kitchenBaseCorner} from '../src/kitchenCorner';
import {newProject} from '../src/project';
import {applyFacadeAppearance,changeFacadeKind} from '../src/facadeAppearance';
import {estimate} from '../src/pricing';
test('upper corner fillers inherit group film as smooth MDF, roundtrip and return to LDSP',()=>{
 const m=kitchenWallCorner(initialModule(),{width:1100,height:920});const p=newProject(m);
 const draft=changeFacadeKind(m,'vernissage');draft.vernissage!.milling='47';
 const next=applyFacadeAppearance(p,p.modules[0].id,draft,true);const result=parseModule(next.modules[0].module);
 assert.deepEqual(result.kitchen!.faceFiller,m.kitchen!.faceFiller);
 const fillers=parts(result).filter(p=>p.id.startsWith('face-filler:')&&p.id.endsWith(':facade'));
 assert.equal(fillers.length,2);for(const f of fillers){assert.equal(f.sideFacade,true);assert.equal(f.vernissage,undefined);assert.equal(f.external,true);assert.equal(f.thickness,draft.vernissage!.thickness);assert.deepEqual(f.edge,[0,0,0,0]);}
 assert.ok(parts(result).some(p=>p.vernissage));
 const q=estimate(next);assert.ok(q.lines.some(l=>l.id.startsWith('vernissage-panel:15:')));assert.ok(q.lines.some(l=>l.id.startsWith('vernissage:47:')));
 const ldsp=changeFacadeKind(result,'ldsp');ldsp.facadeDecor='Белый';
 const reset=applyFacadeAppearance(next,next.modules[0].id,ldsp,true);
 for(const f of parts(reset.modules[0].module).filter(p=>p.id.startsWith('face-filler:')&&p.id.endsWith(':facade'))){assert.equal(f.decor,'Белый');assert.equal(f.sideFacade,undefined);assert.equal(f.external,undefined);}
});
