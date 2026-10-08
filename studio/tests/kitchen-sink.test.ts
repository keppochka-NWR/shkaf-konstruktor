import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject} from '../src/project';
import {labelData} from '../src/exports';
import {estimate} from '../src/pricing';

const sink=()=>{const m=kitchenBase(initialModule(),800,'sink');m.facadeMaterial='external';m.rails=[{place:'front-top',height:70},{place:'rear-top',height:70,at:550}];return m;};

test('sink like Bazis k12: rear rail on edge at a given height, one confirmat per rail end',()=>{
  const ps=parts(sink()),rear=ps.find(p=>p.id==='rail:rear-top')!;
  assert.equal(rear.position[1]-rear.size[1]/2,550);
  assert.match(rear.name,/на высоте 550/);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:rail:')).length,4);
});

test('sink documents: no labels for facades of facade material, end holes by real drilling, kitchen confirmat 7×50 in the estimate',()=>{
  const p=newProject(sink()),labels=labelData(p);
  assert.ok(!labels.some(l=>/Фасад/.test(l.name)),'facades of facade material are not cut parts');
  const side=labels.find(l=>l.name==='Боковина левая')!,bottom=labels.find(l=>/Дно/.test(l.name))!;
  assert.equal(side.endHoles,'2 отв.','two D5×35 from the bottom confirmats');
  assert.equal(bottom.endHoles,'—','bottom holes go into its face');
  const e=estimate(p);
  assert.ok(e.lines.some(l=>l.id==='confirmat-7x50'));
  assert.ok(!e.lines.some(l=>l.id==='confirmat'));
});
