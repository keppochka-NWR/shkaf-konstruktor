import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, parseModule } from '../src/model';
import { pickSurfaceLight } from '../src/surfaceLightPick';

test('clicked broad faces are independent and place light outside the correct side', () => {
  const m=initialModule();m.lightType='surface';
  for(const face of [-1,1]) {
    assert.ok(pickSurfaceLight(m,parts(m),'bottom',[0,face,0],'both','face'+face).changed);
    const host=parts(m).find(p=>p.id==='bottom')!,led=parts(m).find(p=>p.id==='surface-led:face'+face)!;
    assert.ok((led.position[1]-host.position[1])*face>host.size[1]/2);
  }
  assert.equal(m.surfaceLights?.length,2);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).surfaceLights,m.surfaceLights);
  pickSurfaceLight(m,parts(m),'bottom',[0,1,0],'both','unused');
  assert.deepEqual(m.surfaceLights?.map(l=>l.face),[-1]);
  pickSurfaceLight(m,parts(m),'surface-led:face-1',[1,0,0],'both','unused');
  assert.equal(m.surfaceLights?.length,0);
});
test('edge and unsupported face do not select a hidden panel or change existing lights',()=>{
  const m=initialModule(),before=JSON.stringify(m);
  for(const pid of ['bottom','missing']) assert.equal(pickSurfaceLight(m,parts(m),pid,[1,0,0],'both','bad').changed,false);
  assert.equal(pickSurfaceLight(m,parts(m),'bottom',[0,1,0],'vertical','bad').changed,false);
  assert.equal(JSON.stringify(m),before);
});
test('side panel uses the clicked side and chosen direction',()=>{
  const m=initialModule();
  pickSurfaceLight(m,parts(m),'left',[-1,0,0],'both','vertical');
  pickSurfaceLight(m,parts(m),'left',[1,0,0],'horizontal','horizontal');
  assert.deepEqual(m.surfaceLights?.map(l=>[l.face,l.along]),[[-1,1],[1,2]]);
});
