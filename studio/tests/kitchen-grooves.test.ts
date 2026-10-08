import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,scaleHingeY,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {newProject} from '../src/project';
import {labelData,detailCSV} from '../src/exports';

const withLed=():Module=>{const m=kitchenWall(initialModule(),630);m.height=930;m.grooves=['left','right'].map(h=>({host:h,face:(h==='left'?'+':'-') as '+'|'-',along:[16,16] as [number,number],across:[100,117] as [number,number],depth:8,name:'паз под подсветку'}));return m;};

test('LED groove follows its side when the cabinet is resized and stays between bottom and top',()=>{
  for(const [w,h] of [[630,930],[450,600],[900,720]]){
    const m={...withLed(),width:w,height:h},ps=parts(m),g=ps.find(p=>p.id==='groove:1')!,right=ps.find(p=>p.id==='right')!;
    assert.ok(Math.abs((g.position[0]-g.size[0]/2)-(right.position[0]-8))<0.01,'on the inner face of the right side');
    assert.equal(Math.round(g.position[1]+g.size[1]/2),h-16,'ends under the top');
  }
});

test('grooves reach the workshop: detail CSV column and a label line short enough for the 96 mm label row',()=>{
  const p=newProject(withLed());
  assert.match(detailCSV(p),/Пазование/);
  assert.match(detailCSV(p),/подсветка 17×8/);
  const side=labelData(p).find(l=>l.name==='Боковина левая')!;
  assert.match(side.groove,/под ЛХДФ/);
  assert.match(side.notches,/подсветка 17×8/);
  assert.ok(('Паз: '+side.notches).length<=46,'«Паз:» row fits ~96 mm at 10 pt: '+side.notches.length);
});

test('manual hinge heights follow the front height: bottom keeps its offset, top keeps its offset from the top',()=>{
  assert.deepEqual(scaleHingeY([100,533.5,827],927,927),[100,533.5,827]);
  const s=scaleHingeY([100,533.5,827],927,597);
  assert.equal(s[0],100);assert.equal(Math.round(s[2]),497);assert.ok(s[1]>100&&s[1]<497);
});
