import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, parseModule } from '../src/model';
import { newSurfaceLight, panelAxes, surfaceLightParts } from '../src/surfaceLights';
import { kitchenWall } from '../src/kitchen';
import { setUnderLight } from '../src/kitchenUnderLight';
import { clearLights, lightSummary, setLight, setDetailSpec } from '../src/lights';
import { newProject } from '../src/project';
import { estimate } from '../src/pricing';
import { insertShelf, dropId, rekeyCutouts } from '../src/partIds';

test('line on a suspended cabinet bottom: underside, front offset, end setbacks and saved state', () => {
  const m = initialModule(), bottom = parts(m).find(p => p.id === 'bottom')!;
  m.lightType = 'surface';
  m.surfaceLights = [{ ...newSurfaceLight(bottom, 'under'), offset: 120, start: 30, end: 50 }];
  const led = parts(m).find(p => p.id === 'surface-led:under')!;
  assert.ok(led.position[1] < bottom.position[1] - bottom.size[1] / 2);
  assert.equal(bottom.position[2] + bottom.size[2] / 2 - (led.position[2] + led.size[2] / 2), 120);
  assert.equal(led.length, bottom.size[0] - 80);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).surfaceLights, m.surfaceLights);
  const p = newProject(m); const cost = estimate(p).lines.find(l => l.id.startsWith('light-surface-horizontal'));
  assert.equal(cost?.quantity, led.length / 1000); assert.equal(cost?.unitPrice, 4000);
  assert.equal(lightSummary(m).horizontal.meters, led.length / 1000);
  clearLights(m); assert.equal(parts(m).some(p => p.id.startsWith('surface-led:')), false);
});

test('opposite sides of horizontal, side and back panels; both directions stay within the selected face', () => {
  const m = initialModule(); m.lightType = 'surface';
  for (const host of parts(m).filter(p => ['bottom', 'left', 'back'].includes(p.id))) {
    const { normal, axes } = panelAxes(host);
    for (const face of [-1, 1] as const) for (const along of axes) {
      m.surfaceLights = [{ ...newSurfaceLight(host, 'test'), face, along, offset: 80 }];
      const led = parts(m).find(p => p.id === 'surface-led:test')!;
      assert.ok(led, host.id);
      assert.ok((led.position[normal] - host.position[normal]) * face > host.size[normal] / 2);
      assert.equal(led.length, host.size[along] - 40);
      const across = axes.find(a => a !== along)!;
      assert.ok(Math.abs(led.position[across] - host.position[across]) + led.size[across] / 2 <= host.size[across] / 2);
    }
  }
});

test('missing host or excessive setback remains visible as an unpriced placement problem, not silently free lighting', () => {
  const m = initialModule(), host = parts(m).find(p => p.id === 'bottom')!;
  m.surfaceLights = [{ ...newSurfaceLight(host, 'bad'), offset: 9000 }];
  assert.equal(surfaceLightParts(m, parts(m)).warnings.length, 1);
  const e = estimate(newProject(m)); assert.ok(e.lines.some(l => l.id.startsWith('light-placement:') && l.unitPrice === null));
  m.surfaceLights[0].host = 'removed';
  assert.equal(surfaceLightParts(m, parts(m)).warnings.length, 1);
  assert.throws(() => parseModule({ ...m, surfaceLights: [{ ...m.surfaceLights![0], start: -1 }] }));
});

test('existing kitchen and internal shelf/stand lights retain defaults but support saved individual front offsets', () => {
  const m = kitchenWall(initialModule(), 600); setUnderLight(m, true);
  const before = parts(m).find(p => p.id === 'kitchen-underlight')!;
  m.kitchen!.underLightOffset = 100;
  const after = parts(m).find(p => p.id === 'kitchen-underlight')!;
  assert.equal(before.position[2] - after.position[2], 80);
  assert.equal(before.length, after.length);
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.underLightOffset, 100);
  const n = initialModule(), key = n.sections[0].id + ':stand:left'; setLight(n, key, true);
  const a = parts(n).find(p => p.id.endsWith(':light:left'))!;
  setDetailSpec(n, key, { frontOffset: 150 });
  assert.equal(a.position[2] - parts(n).find(p => p.id.endsWith(':light:left'))!.position[2], 50);
  const saved = parseModule(JSON.parse(JSON.stringify(n)));
  assert.equal(saved.sections[0].lightSpec?.left.frontOffset, 150);
});
test('surface line follows its shelf identity through insertion and copying, and does not jump to the next shelf on deletion', () => {
  const m=initialModule(),s=m.sections[0]; s.shelves=[0.3,0.7];
  const host=parts(m).find(p=>p.id===s.id+':shelf:1')!;
  m.surfaceLights=[newSurfaceLight(host,'stable',m)];
  const before=parts(m).find(p=>p.id==='surface-led:stable')!;
  insertShelf(s,0.5);
  assert.equal(parts(m).find(p=>p.id==='surface-led:stable')!.position[1],before.position[1]);
  const copy=structuredClone(m),old=copy.sections[0].id;copy.sections[0].id='copied-section';
  rekeyCutouts(copy,new Map([[old,'copied-section']]));
  assert.equal(parts(copy).find(p=>p.id==='surface-led:stable')!.position[1],before.position[1]);
  dropId(s,'shelf',2);s.shelves.splice(2,1);
  assert.equal(parts(m).some(p=>p.id==='surface-led:stable'),false);
  assert.equal(surfaceLightParts(m,parts(m)).warnings.length,1);
});
