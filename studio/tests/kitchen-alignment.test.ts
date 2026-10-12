import test from "node:test";
import assert from "node:assert/strict";
import { initialModule } from "../src/model";
import { appendModule, bounds, type Project } from "../src/project";
import { kitchenTemplate, placeKitchenModule, placeWorktop } from "../src/kitchenProject";
import { alignKitchenRow, kitchenFaceOffset } from "../src/kitchenAlignment";
const blank = (): Project => ({version:3,room:{width:6000,depth:4000,height:3000,openings:[]},modules:[]});
const front = (a: Project["modules"][number]) => a.z + kitchenFaceOffset(a.module);
test("mixed palettes put drawers, sink and hinged base on one facade plane", () => {
 let p = appendModule(blank(), kitchenTemplate("base-drawers",600,initialModule()));
 p = placeKitchenModule(p,kitchenTemplate("sink",600,initialModule())).project;
 p = placeKitchenModule(p,kitchenTemplate("base-doors",600,initialModule())).project;
 assert.equal(new Set(p.modules.map(front)).size,1);
 assert.equal(p.modules[0].z,3);
 assert.ok(p.modules.every(a=>bounds(a).z>=0));
 const top=placeWorktop(p,initialModule()).project.modules.at(-1)!;
 assert.ok(top.z+top.module.depth>front(p.modules[0])); assert.equal(top.y,820);
});
test("row repair aligns different depths without moving an island",()=>{
 let p=appendModule(blank(),kitchenTemplate("base-doors",600,initialModule()));
 p=placeKitchenModule(p,kitchenTemplate("sink",600,initialModule())).project;
 p.modules[1].module.depth=457; p.modules[1].z=33;
 p.modules.push({...structuredClone(p.modules[0]),id:"island",z:2000});
 const n=alignKitchenRow(p,p.modules[0].id);
 assert.equal(front(n.modules[0]),front(n.modules[1])); assert.equal(n.modules[2].z,2000);
 assert.equal(p.modules[1].z,33);
});
test("worktop follows an offset row and another row does not count as covered",()=>{
 let p=appendModule(blank(),kitchenTemplate("base-doors",600,initialModule()));
 p=placeKitchenModule(p,kitchenTemplate("sink",600,initialModule())).project;
 p.modules.forEach(a=>a.z+=1000);
 const top=placeWorktop(p,initialModule());
 assert.equal(top.project.modules.at(-1)!.z,1000);
 const extra={...structuredClone(p.modules[0]),id:"other",z:3};
 const next=placeWorktop({...top.project,modules:[...top.project.modules,extra]},initialModule());
 assert.equal(next.project.modules.at(-1)!.z,0);
});
