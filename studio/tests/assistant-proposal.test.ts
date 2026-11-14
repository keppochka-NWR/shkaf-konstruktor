import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAssistantProposal,
  type AssistantProposal,
} from "../src/assistantProposal";
import { migrateRoomDocument, parseRoomDocument } from "../src/roomDocument";
import {newProject} from '../src/project';
test('assistant updates an existing module without replacing its fittings or identifiers',()=>{
 const d=migrateRoomDocument(newProject());const m=d.rooms[0].project.modules[0];const p=base();
 p.updates=[{roomId:d.activeRoomId,moduleId:m.id,width:650,height:null,depth:null,x:null,z:null}];
 const next=applyAssistantProposal(d,p),n=next.rooms[0].project.modules[0];assert.equal(n.module.width,650);assert.equal(m.module.width,600);assert.equal(n.id,m.id);assert.deepEqual(n.module.sections,m.module.sections);
});
const base = (): AssistantProposal => ({
  message: "Эскиз",
  warnings: [],
  questions: [],
  rooms: [],
  furniture: [],
});
test("assistant proposal creates native editable furniture, preserves original and roundtrips", () => {
  const d = migrateRoomDocument();
  d.rooms[0].project.modules = [];
  const before = JSON.stringify(d);
  const p = base();
  p.furniture = [
    {
      name: "По рендеру",
      width: 600,
      height: 2000,
      depth: 550,
      doors: true,
      roomId: d.activeRoomId,
      sections: [{ shelves: 3, drawers: 0, rod: false }],
    },
  ];
  const result = applyAssistantProposal(d, p);
  assert.equal(JSON.stringify(d), before);
  assert.equal(result.rooms[0].project.modules.length, 1);
  assert.equal(
    result.rooms[0].project.modules[0].module.sections[0].shelves.length,
    3,
  );
  assert.equal(result.rooms[0].project.modules[0].module.raw, undefined);
  assert.deepEqual(parseRoomDocument(result), result);
});
test("whole apartment proposal appends measured rooms without deleting existing ones", () => {
  const d = migrateRoomDocument();
  const p = base();
  p.rooms = [
    { name: "Спальня", width: 4200, depth: 3600, height: 2700, x: 4500, z: 0 },
  ];
  const next = applyAssistantProposal(d, p);
  assert.equal(next.rooms.length, d.rooms.length + 1);
  assert.equal(next.rooms.at(-1)!.origin!.x, 4500);
  assert.deepEqual(next.rooms[0], d.rooms[0]);
});
test("invalid geometry and unknown target never partially change the document", () => {
  const d = migrateRoomDocument(),
    before = JSON.stringify(d);
  const p = base();
  p.rooms = [
    { name: "Новая", width: 4000, depth: 3000, height: 2700, x: 0, z: 0 },
  ];
  p.furniture = [
    {
      name: "Шкаф",
      width: 600,
      height: 2000,
      depth: 550,
      doors: false,
      roomId: "missing",
      sections: [{ shelves: 1, drawers: 0, rod: false }],
    },
  ];
  assert.throws(() => applyAssistantProposal(d, p), /Комната/);
  assert.equal(JSON.stringify(d), before);
  p.rooms[0].width = NaN;
  assert.throws(() => applyAssistantProposal(d, p), /Размер/);
});
