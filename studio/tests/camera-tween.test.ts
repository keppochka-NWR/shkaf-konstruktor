// Плавный переход между видами (Макс 30.10.2026): облёт по сфере, масштаб без рывка, концы — точно исходный и конечный кадр.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {tweenState,tweenProgress,wantsViewTween,VIEW_MS} from '../src/cameraTween';

const st=(d:[number,number,number],H:number,T:[number,number,number]=[0,0,0])=>({T:new THREE.Vector3(...T),d:new THREE.Vector3(...d).normalize(),H});
const near=(a:THREE.Vector3,b:THREE.Vector3,eps=1e-6)=>a.distanceTo(b)<eps;

test('концы перехода — ровно исходный и конечный кадр',()=>{
  const a=st([0,0,1],3000,[100,1350,200]),b=st([0,1,0.001],5000,[0,1000,0]);
  const s0=tweenState(a,b,0),s1=tweenState(a,b,1);
  assert.ok(near(s0.d,a.d)&&near(s0.T,a.T)&&Math.abs(s0.H-3000)<1e-9);
  assert.ok(near(s1.d,b.d,1e-9)&&near(s1.T,b.T)&&Math.abs(s1.H-5000)<1e-9);
});

test('спереди → сверху: камера поднимается, не уходя вбок; масштаб — между концами',()=>{
  const m=tweenState(st([0,0,1],3000),st([0,1,0.001],5000),.5);
  assert.ok(Math.abs(m.d.x)<1e-9&&m.d.y>0.6&&m.d.y<0.8&&m.d.z>0.6,'середина — 45° над фасадом');
  assert.ok(m.H>3000&&m.H<5000);
});

test('слева → справа: облёт по горизонту (через фасад или спину), не через потолок',()=>{
  for(const e of [.25,.5,.75]){const m=tweenState(st([-1,0,.001],3000),st([1,0,.001],3000),e);assert.ok(Math.abs(m.d.y)<1e-6,'на высоте глаз');assert.ok(Math.abs(m.d.length()-1)<1e-9);}
});

test('время: сглаженный ход, конец — 1; вид не сменился, показ клиенту — без перехода',()=>{
  assert.equal(tweenProgress(0),0);assert.equal(tweenProgress(VIEW_MS),1);assert.equal(tweenProgress(VIEW_MS*3),1);
  assert.ok(tweenProgress(VIEW_MS/4)<.25,'мягкий старт');
  assert.equal(wantsViewTween(undefined,'front',false),false,'первый кадр');
  assert.equal(wantsViewTween('front','front',false),false);
  assert.equal(wantsViewTween('front','iso',true),false,'презентация');
  assert.equal(wantsViewTween('front','iso',false),true);
});
