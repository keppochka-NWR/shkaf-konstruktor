import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parseModule,parts} from '../src/model';
import {newProject} from '../src/project';
import {changeFacadeKind,applyFacadeAppearance} from '../src/facadeAppearance';
import {estimate} from '../src/pricing';

test('facade editor applies film and enamel through existing geometry and price, without editing original',()=>{
 const m=initialModule();m.width=600;m.height=900;m.doors=true;
 const p=newProject(m),before=JSON.stringify(p),id=p.modules[0].id;
 const film=changeFacadeKind(m,'vernissage');
 const a=applyFacadeAppearance(p,id,film);
 assert.equal(JSON.stringify(p),before);assert.equal(a.modules[0].module.vernissage?.cover,'film');
 assert.ok(parts(a.modules[0].module).some(p=>p.vernissage));
 const paint=structuredClone(film);paint.vernissage!.cover='enamel-matte';paint.vernissage!.enamelColor='RAL 9003';
 const b=applyFacadeAppearance(a,id,paint);assert.equal(parseModule(b.modules[0].module).vernissage?.enamelColor,'RAL 9003');
 const q=estimate(b);assert.ok(q.lines.some(l=>l.id.startsWith('vernissage:')&&l.id.includes('enamel-matte')));
 const ldsp=changeFacadeKind(paint,'ldsp');assert.equal(ldsp.vernissage,undefined);assert.equal(ldsp.facadeT,undefined);
});
test('apply to all changes appearance only, keeps open shelves open and ignores imported modules',()=>{
 const m=initialModule();m.width=600;m.height=900;m.doors=true;const p=newProject(m),id=p.modules[0].id;
 const open=structuredClone(p.modules[0]);open.id='open';open.module.doors=false;open.module.sections.forEach(s=>{s.drawers=0;});
 const other=structuredClone(p.modules[0]);other.id='other';other.module.width=700;
 p.modules.push(open,other);const draft=changeFacadeKind(m,'vernissage');
 const next=applyFacadeAppearance(p,id,draft,true);
 assert.equal(next.modules[1].module.doors,false);assert.equal(next.modules[1].module.vernissage,undefined);
 assert.equal(next.modules[2].module.width,700);assert.deepEqual(next.modules[2].module.sections,other.module.sections);
 assert.equal(next.modules[2].module.vernissage?.cover,'film');
});
test('invalid facade style is atomic for the entire project',()=>{
 const m=initialModule();m.doors=true;const p=newProject(m),before=JSON.stringify(p);
 const draft=changeFacadeKind(m,'vernissage');draft.facadeT=100;
 assert.throws(()=>applyFacadeAppearance(p,p.modules[0].id,draft,true));assert.equal(JSON.stringify(p),before);
});

test('selected group alone changes; source outside group is not implicitly included',()=>{
 const m=initialModule();m.height=900;m.doors=true;const p=newProject(m);
 const second=structuredClone(p.modules[0]);second.id='second';const third=structuredClone(second);third.id='third';p.modules.push(second,third);
 const before=JSON.stringify(p);const next=applyFacadeAppearance(p,p.modules[0].id,changeFacadeKind(m,'vernissage'),['second']);
 assert.equal(JSON.stringify(p),before);assert.equal(next.modules[0].module.vernissage,undefined);assert.equal(next.modules[2].module.vernissage,undefined);assert.equal(next.modules[1].module.vernissage?.cover,'film');
});
