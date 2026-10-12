import { validateFixture } from "../src/fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import {
  transform,
  inverseTransform,
  convexOverlap,
} from "../src/roomGeometry";
import { newProject, modulesOverlap, bounds } from "../src/project";
import {
  initialGrid,
  surfaceOffset,
  surfacePoint,
  parseSurvey,
  surveyNotes,
} from "../src/roomSurvey";
import { sectorHitsPolygon, environmentChecks } from "../src/environmentChecks";
import {
  parseRoomProject,
  activeRoom,
  attachRoom,
  migrateRoomDocument,
  parseRoomDocument,
  updateRoom,
  saveVariant,
  loadVariant,
  selectRoom,
} from "../src/roomDocument";
import { freePanel, placeFreePanel } from "../src/freePanels";
import { parts } from "../src/model";
import { handoffHTML, bazisExport } from "../src/RoomDeliverables";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const angle of [0, 90, 180, 270, 17, -33, 359.999])
  test(`P2a arbitrary transform roundtrip ${angle}`, () => {
    for (const [u, v] of [
      [0, 0],
      [600, 500],
      [123.45, 678.9],
    ]) {
      const p = transform(-700, 1400, 600, 800, angle, u, v),
        q = inverseTransform(-700, 1400, 600, 800, angle, p.x, p.z);
      near(q.x, u);
      near(q.z, v);
    }
  });
test("P2a contact tolerance and oblique separation", () => {
  const a = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ];
  assert.equal(
    convexOverlap(
      a,
      a.map((p) => ({ ...p, x: p.x + 10 })),
    ),
    false,
  );
  assert.equal(
    convexOverlap(
      a,
      a.map((p) => ({ ...p, x: p.x + 9 })),
    ),
    true,
  );
  const p = newProject(),
    b = structuredClone(p.modules[0]);
  b.rotation = 37;
  b.x = 1800;
  b.z = 1800;
  assert.equal(modulesOverlap(p.modules[0], b), false);
  b.x = 50;
  b.z = 30;
  assert.equal(modulesOverlap(p.modules[0], b), true);
  assert.ok(bounds(b).w > b.module.width);
});
test("P2b measured plane matches independent analytical values and original data", () => {
  const r = newProject().room,
    g = initialGrid(r, "left");
  g.u = [0, 3000];
  g.v = [0, 2700];
  g.offsets = [
    [0, 30],
    [27, 57],
  ];
  g.measured = [
    [true, true],
    [true, true],
  ];
  r.survey = { readings: [], surfaces: { left: g }, notes: "" };
  near(surfaceOffset(g, 1500, 1350).value, 28.5);
  near(surfacePoint(r, "left", 1000, 1000).x, 20);
  assert.equal(surfaceOffset(g, 1500, 1350).outside, false);
  assert.equal(surfaceOffset(g, 3500, 1350).outside, true);
  const copy = parseSurvey(r.survey);
  copy.surfaces.left!.offsets[0][0] = 5;
  assert.equal(g.offsets[0][0], 0);
});
test("P2b missing grid cells and contradictory repeated readings are never precise", () => {
  const r = newProject().room,
    g = initialGrid(r, "back");
  assert.equal(surfaceOffset(g, 10, 10).outside, true);
  r.survey = {
    surfaces: { back: g },
    notes: "",
    readings: [
      { id: "a", axis: "width", x: 0, y: 1000, z: 0, value: 3000, note: "" },
      { id: "b", axis: "width", x: 0, y: 1000, z: 0, value: 2992, note: "" },
    ],
  };
  assert.ok(surveyNotes(r).some((x) => x.includes("8.0")));
  assert.ok(surveyNotes(r).some((x) => x.includes("незаполненные")));
  const bad = structuredClone(r.survey);
  bad.surfaces.back!.u = [0, 0];
  assert.throws(() => parseSurvey(bad));
});
test("P2b crooked wall flags intrusion without modifying furniture", () => {
  const p = newProject(),
    a = p.modules[0];
  a.x = 50;
  const g = initialGrid(p.room, "left");
  g.offsets = [
    [60, 60],
    [60, 60],
  ];
  g.measured = [
    [true, true],
    [true, true],
  ];
  p.room.survey = { readings: [], surfaces: { left: g }, notes: "" };
  const before = JSON.stringify(a);
  assert.ok(environmentChecks(p).some((x) => x.kind === "survey-left"));
  assert.equal(JSON.stringify(a), before);
  a.x = 100;
  assert.equal(
    environmentChecks(p).some((x) => x.kind === "survey-left"),
    false,
  );
});
const rect = (x: number, z: number, w: number, d: number) => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + d },
  { x, z: z + d },
];
test("P4 analytic sweep detects a thin mid-angle obstacle, outside and back side", () => {
  assert.equal(sectorHitsPolygon(rect(600, 600, 1, 1), 900, 90), true);
  assert.equal(sectorHitsPolygon(rect(901, 901, 10, 10), 900, 90), false);
  assert.equal(sectorHitsPolygon(rect(600, -20, 1, 1), 900, 90), false);
  assert.equal(sectorHitsPolygon(rect(-200, -200, 400, 400), 900, 90), true);
  // Neither endpoint is inside; the polygon edge cuts the circular arc.
  assert.equal(sectorHitsPolygon(rect(400, 799, 1000, 2), 900, 90), true);
});
test("P1b shared door updates atomically, survives roundtrip and blocks invalid relocation", () => {
  let d = attachRoom(migrateRoomDocument(), "Соседняя", "right");
  assert.equal(d.rooms.length, 2);
  d = parseRoomDocument(JSON.parse(JSON.stringify(d)));
  const a = d.rooms[0],
    p = structuredClone(a.project);
  p.room.openings![0].width = 800;
  d = updateRoom(d, a.id, p);
  assert.equal(d.rooms[1].project.room.openings![0].width, 800);
  assert.equal(d.rooms[1].project.room.openings![0].direction, "in");
  const before = JSON.stringify(d);
  p.room.openings![0].wall = "left";
  assert.throws(() => updateRoom(d, a.id, p), /разорвите/);
  assert.equal(JSON.stringify(d), before);
  p.room = structuredClone(d.rooms[0].project.room);
  p.room.width += 100;
  assert.throws(() => updateRoom(d, a.id, p), /габаритов/);
});
test("P1b rejecting overlaps keeps source document intact", () => {
  const d = attachRoom(migrateRoomDocument(), "Соседняя", "right"),
    before = JSON.stringify(d);
  assert.throws(() => attachRoom(d, "Поверх первой", "left"), /пересекает/);
  assert.equal(JSON.stringify(d), before);
});
test("P6 approval snapshot retains furniture and survey after editing/loading", () => {
  let d = saveVariant(migrateRoomDocument(newProject()), "Согласован", true),
    r = activeRoom(d),
    v = r.variants![0],
    before = JSON.stringify(v);
  const p = structuredClone(r.project);
  p.modules[0].module.name = "Новая мебель";
  d = updateRoom(d, r.id, p);
  assert.equal(JSON.stringify(activeRoom(d).variants![0]), before);
  d = loadVariant(d, v.id);
  assert.equal(
    activeRoom(d).project.modules[0].module.name,
    v.project.modules[0].module.name,
  );
  assert.throws(
    () =>
      parseRoomDocument({
        ...d,
        rooms: [
          { ...activeRoom(d), variants: [{ ...v, createdAt: "broken" }] },
        ],
      }),
    /дата/,
  );
});
const input = {
  name: "Фальш",
  width: 600,
  height: 2000,
  thickness: 16,
  plane: "xy" as const,
  edge: 0.4,
  decor: "Белый",
};
test("P5 exact independent panel dimensions, edging and preserved YZ contour", () => {
  const a = freePanel(input),
    p = parts(a.module).filter((p) => p.material === "board");
  assert.equal(p.length, 1);
  assert.equal(p[0].thickness, 16);
  near(
    a.module.raw!.panels[0].edges!.reduce((s, e) => s + e[1], 0),
    5200,
  );
  const b = freePanel({
    ...input,
    plane: "yz",
    contour: [
      [0, 0],
      [600, 0],
      [500, 2000],
      [0, 2000],
    ],
  });
  assert.deepEqual(b.module.raw!.panels[0].contour, [
    [0, 0],
    [0, 600],
    [2000, 500],
    [2000, 0],
  ]);
  assert.ok(parts(b.module).some((p) => p.faceContour));
});
test("P5 self-intersecting contour rejected; placement avoids existing cabinet", () => {
  assert.throws(
    () =>
      freePanel({
        ...input,
        contour: [
          [0, 0],
          [600, 2000],
          [0, 2000],
          [600, 0],
        ],
      }),
    /пересекает/,
  );
  const p = newProject(),
    a = placeFreePanel(p, input);
  assert.equal(modulesOverlap(a, p.modules[0]), false);
  a.x = p.modules[0].x;
  a.z = p.modules[0].z;
  assert.equal(modulesOverlap(a, p.modules[0]), true);
});
test("P6 handoff escapes user text and refuses silent complex Bazis export", () => {
  let d = migrateRoomDocument(newProject());
  d.customer = "<script>alert(1)</script>";
  assert.ok(handoffHTML(d).includes("&lt;script&gt;"));
  assert.ok(!handoffHTML(d).includes("<script>"));
  const a = bazisExport(d);
  assert.ok(a.manifest.panels.length > 0);
  new Function(a.script);
  d.rooms[0].project.modules[0].rotation = 17;
  const b = bazisExport(d);
  assert.equal(b.manifest.completeGeometry, false);
  assert.ok(b.manifest.unsupported.length > 0);
});

test("P3 insulated pipe diameter has one consistent physical envelope", () => {
  const room = newProject().room,
    f = {
      id: "pipe",
      type: "pipe" as const,
      wall: "back" as const,
      offset: 100,
      fromFloor: 0,
      width: 45,
      height: 2000,
      depth: 45,
      diameter: 25,
      insulation: 10,
    };
  assert.equal(validateFixture(room, f), null);
  assert.match(validateFixture(room, { ...f, width: 25 })!, /диаметру/);
  assert.equal(
    validateFixture(room, { ...f, horizontal: true, width: 2000, height: 45 }),
    null,
  );
});

test("P1 empty small room is validated without fictitious furniture", () => {
  const p = newProject();
  p.modules = [];
  p.room = { width: 500, height: 500, depth: 500, openings: [] };
  assert.equal(parseRoomProject(p).modules.length, 0);
  p.room.width = 499;
  assert.throws(() => parseRoomProject(p));
  p.room.width = 500;
  p.room.openings = [
    {
      id: "bad",
      type: "door",
      wall: "back",
      offset: 0,
      width: 900,
      height: 2100,
      sill: 0,
    },
  ];
  assert.throws(() => parseRoomProject(p), /Проём/);
});
