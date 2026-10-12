import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialModule, parts, validate } from '../src/model';
import { kitchenBase } from '../src/kitchen';
import { newProject, parseProject } from '../src/project';
import { ALLEGRO, allegroErrors } from '../src/premialPullout';
import { allegroModel } from '../src/premialGeometry';

const cabinet = (article = '060500', width = 150) => {
  const m = kitchenBase(initialModule(), width);
  m.sections.forEach(s => { s.shelves = []; s.drawers = 0; s.rod = false; });
  m.kitchen!.premialPullout = { article }; return m;
};
test('catalogue sizes are mechanisms, not cabinet widths; both hands round trip', () => {
  for (const item of ALLEGRO) {
    const m = cabinet(item.article, item.base);
    assert.deepEqual(validate(m), []);
    const round = parseProject(JSON.parse(JSON.stringify(newProject(m)))).modules[0].module;
    assert.deepEqual(round.kitchen?.premialPullout, { article: item.article });
    const p = parts(round), basket = p.find(p => p.id.startsWith('premial-allegro:'))!;
    assert.deepEqual(basket.size, [item.width, 540, 457]);
    assert.equal(p.filter(p => p.role === 'hinge').length, 0);
    assert.ok(p.filter(p => p.role === 'door').every(p => p.hingeless && p.openShift === 0));
    assert.ok(basket.position[0] - item.width/2 >= 16);
    assert.ok(basket.position[0] + item.width/2 <= m.width - 16);
    assert.equal(basket.position[2] + basket.size[2]/2, m.depth + (m.faceAir ?? 2), 'front mounting plate reaches the facade');
    delete round.kitchen!.premialPullout;
    assert.ok(parts(round).some(p => p.role === 'hinge'));
  }
});
test('invalid resizing and conflicting furniture cannot silently leave the mechanism installed', () => {
  for (const modify of [
    (m: ReturnType<typeof cabinet>) => { m.width = 160; },
    (m: ReturnType<typeof cabinet>) => { m.depth = 450; },
    (m: ReturnType<typeof cabinet>) => { m.height = 600; },
    (m: ReturnType<typeof cabinet>) => { m.sections[0].shelves = [300]; },
    (m: ReturnType<typeof cabinet>) => { m.kitchen!.appliance = 'sink'; },
    (m: ReturnType<typeof cabinet>) => { m.kitchen!.premialPullout = { article: 'unknown' }; },
    (m: ReturnType<typeof cabinet>) => { m.doors = false; },
  ]) { const m = cabinet(); modify(m); assert.ok(allegroErrors(m).length); }
});
test('closed 3D models have finite geometry and match the manufacturer envelope within 0.1 mm', () => {
  for (const width of [95, 145]) for (const right of [true, false]) {
    const model = allegroModel(width, right);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();
    [width, 540, 457].forEach((value, axis) => assert.ok(Math.abs(size[axis] - value) < .1, `${size}`));
    model.traverse(o => { if (o instanceof THREE.Mesh) {
      assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
      assert.ok(Array.from(o.geometry.attributes.normal.array).every(Number.isFinite));
    }});
  }
});
