// Отладка сверки навесного углового k25 m18 (w-lwing, 23.10.2026): npx tsx scripts/kitchen/wallCornerDebug.ts
import { validate } from "../../src/model";
import { compareModule, honestPass } from "./compare";
import { moduleFromEtalon } from "./fromEtalon";
import { cornerRef, k25WallCorner } from "./cornerEtalons";

const r = cornerRef("k25-m18"), m = k25WallCorner(), c = compareModule(r, m), err = validate(m);
const rec = moduleFromEtalon(r).module;
console.log("распознаватель:", JSON.stringify({ facadeT: rec.facadeT, faceGap: rec.faceGap, faceGapBetween: rec.faceGapBetween, faceAir: rec.faceAir, facadeMaterial: rec.facadeMaterial, facadeEdge: rec.facadeEdge, edgeScheme: rec.edgeScheme, confirmatInset: rec.confirmatInset, depth: rec.depth, decor: rec.decor, facadeDecor: rec.facadeDecor, noHandles: rec.noHandles, grooveClear: rec.grooveClear, shelfDepth: rec.sections[0]?.shelfDepth, hingeBrand: rec.hingeBrand }));
console.log("PASS", honestPass(c, err, []), "ошибки", err);
console.log("нет:", c.missing.map((x) => `${x.name}[${x.cls}] ${JSON.stringify(x.box)}`));
console.log("лишние:", c.extra.map((x) => `${x.name} ${JSON.stringify(x.box)}`));
for (const p of c.pairs.filter((p) => p.delta > 0.5)) console.log("Δ", p.delta, p.ref.name, JSON.stringify(p.ref.box), "студия", p.studio.name, JSON.stringify(p.studio.box));
for (const h of c.hardware) if (h.ref !== h.studio || (h.maxPosDelta ?? 0) > 2 || h.note) console.log("фурн", JSON.stringify(h));
if (c.holes) console.log("отв", c.holes.matched, "/", c.holes.ref, "Δ", c.holes.maxDelta, "нет", c.holes.missing.slice(0, 8), "лишн", c.holes.extra.slice(0, 8), "off", c.holes.off?.slice(0, 5));
if (c.edges?.bad.length) console.log("кромки", c.edges.bad.slice(0, 6));
if (c.contours?.length) console.log("контуры", c.contours);
