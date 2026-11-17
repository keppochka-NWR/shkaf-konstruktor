import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,hardwareKind} from '../src/pricing';
import {newProject} from '../src/project';
import {selectableKupeFill} from '../src/kupeFillSelection';
test('Premial hinges and push devices appear under hinges in the estimate',()=>{
 for(const id of ['premial-hinge:044408','premial-alu-hinge:250506','premial-push:070501','hinge:premial','hinge-bazis:вкладная:premial'])assert.equal(hardwareKind(id),'hinges',id);
 const p=newProject();p.modules[0].module.doorOpen='push';
 const e=estimate(p),hinges=e.lines.filter(l=>l.id.startsWith('premial-hinge:')),push=e.lines.find(l=>l.id==='premial-push:070501');
 assert.ok(hinges.length&&push);for(const l of [...hinges,push!])assert.equal(hardwareKind(l.id),'hinges');
});
test('only glass and mirror thicker than 4 mm are unavailable for new coupe selections',()=>{
 for(const n of ['Стекло 5 мм','Зеркало 6 мм','Стекло 4,5 мм'])assert.equal(selectableKupeFill({n}),false,n);
 for(const n of ['Стекло 4 мм','Зеркало 4мм','ЛДСП 16 мм'])assert.equal(selectableKupeFill({n}),true,n);
});
