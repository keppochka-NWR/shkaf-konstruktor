import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {newProject,type PlacedModule} from '../src/project';
import {joinedUnderLightParts} from '../src/joinedUnderLight';
import {estimate} from '../src/pricing';
const make=(id:string,x:number):PlacedModule=>{const m=kitchenWall(initialModule(),600);m.kitchen!.underLight=true;return{id,x,z:0,y:1400,module:m};};
const led=(a:PlacedModule,all:PlacedModule[])=>joinedUnderLightParts(a,all).find(p=>p.id==='kitchen-underlight')!;
test('adjacent LEDs meet and estimate includes both extended ends',()=>{
 const all=[make('a',0),make('b',600),make('c',1200)];
 assert.deepEqual(all.map(a=>led(a,all).length),[564,600,564]);
 const p={...newProject(),modules:all};assert.equal(estimate(p).lines.find(l=>l.id==='light-under')!.quantity,1.728);
 assert.equal(led(all[0],all).position[0]+led(all[0],all).size[0]/2,600);
 assert.equal(led(all[1],all).position[0]-led(all[1],all).size[0]/2,0);
});
test('gaps, heights, disabled neighbours and different profiles retain separation',()=>{
 for(const edit of [(b:PlacedModule)=>b.x+=10,(b:PlacedModule)=>b.y!+=10,(b:PlacedModule)=>delete b.module.kitchen!.underLight,(b:PlacedModule)=>b.module.lightType='surface' as const]){
  const all=[make('a',0),make('b',600)];edit(all[1]);assert.equal(led(all[0],all).length,528);
 }
});
test('rotated row joins in room coordinates',()=>{
 const a=make('a',0),b=make('b',0);a.rotation=b.rotation=90;a.z=600;b.z=0;
 assert.equal(led(a,[a,b]).length,564);assert.equal(led(b,[a,b]).length,564);
});
test('only lines at the same front setback join',()=>{
 const a=make('a',0),b=make('b',600);
 a.module.kitchen!.underLightOffset=120;
 assert.equal(led(a,[a,b]).length,528);
 b.module.kitchen!.underLightOffset=120;
 assert.equal(led(a,[a,b]).length,564);
 assert.equal(led(b,[a,b]).length,564);
});
