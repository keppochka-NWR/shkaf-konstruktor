import test from 'node:test';
import assert from 'node:assert/strict';
import type {Part} from '../src/model';
import {partCollisions,partPenetration} from '../src/collisions';

const part=(id:string,size:[number,number,number],position:[number,number,number],extra:Partial<Part>={}):Part=>({id,name:id,size,position,length:Math.max(...size),width:size[1],thickness:Math.min(...size),role:'body',material:'board',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0],...extra});

test('detector: overlapping boards collide, touching boards do not',()=>{
  const a=part('a',[100,16,100],[50,8,50]);
  assert.equal(partCollisions([a,part('touch',[100,16,100],[50,24,50])]).length,0,'touching faces are not a collision');
  const c=partCollisions([a,part('over',[100,16,100],[50,20,50])]);
  assert.equal(c.length,1);assert.equal(c[0].depth,4);
});

test('detector: allowed contacts — confirmat inside its boards, hinge cup inside its own door; a hinge in a shelf is not allowed',()=>{
  const side=part('left',[16,700,500],[8,350,250]),shelf=part('S:shelf:0',[568,16,480],[300,300,240],{role:'shelf'});
  const conf=part('fast:bottom:left:0',[50,7,7],[25,300,50],{role:'fastener',material:'metal'});
  assert.equal(partCollisions([side,shelf,conf]).length,0,'confirmat sits in the side and the shelf');
  const door=part('S:door:0',[400,700,16],[200,350,508],{role:'door'});
  const cup=part('S:hingecup:0:0',[36,58,27],[22,300,498],{role:'hinge',material:'metal',collide:[{size:[35,35,12.5],position:[22,300,506]}]});
  assert.equal(partCollisions([door,cup]).length,0,'cup in its door');
  const plate=part('S:hingeplate:0:0',[20,63,76],[26,300,461],{role:'hinge',material:'metal',collide:[{size:[26,63,78],position:[29,300,461]}]});
  const c=partCollisions([shelf,plate]);
  assert.equal(c.length,1,'hinge plate across the shelf front is a collision');
});

test('detector: rotated parts use oriented boxes, not their axis-aligned envelope',()=>{
  const a=part('a',[1000,16,16],[0,0,0],{rotZ:45}),b=part('b',[16,16,16],[300,-300,0]);
  assert.ok(partPenetration(a,b)<=0,'far from the diagonal');
  assert.equal(partCollisions([a,part('c',[16,16,16],[300,300,0])]).length,1,'on the diagonal');
});
