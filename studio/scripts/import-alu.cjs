// Импорт калькулятора фасадов ALU (calc-platform: data/fasad-alu-data.js + data/fillings.js) в студию:
//   node scripts/import-alu.cjs [путь к calc-platform]
// Один источник цен рамочных алюминиевых фасадов: профили (₽/м), наполнения групп FASAD_FILL_GROUPS (₽/м²), уплотнитель (₽/м).
// В студию попадают только ЦЕНЫ КЛИЕНТА (как считает калькулятор): профиль = прайс × FASAD_PROF_MARKUP, наполнение — розница
// FILLINGS, уплотнитель — FASAD_GASKET. Закупочные цены профилей в файл не пишутся. Результат — src/aluData.ts (коммитится).
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = process.argv[2] || "C:/Users/My PC/Desktop/Claude Project/calc-ready/calc-platform";
const ctx = {};
vm.createContext(ctx);
for (const f of ["data/fillings.js", "data/fasad-alu-data.js"]) {
  const code = fs.readFileSync(path.join(root, f), "utf8").replace(/^\uFEFF/, "").replace(/^const (\w+)/gm, "globalThis.$1");
  vm.runInContext(code, ctx, { filename: f });
}
const round2 = (v) => Math.round(v * 100) / 100;
const profiles = ctx.FASAD_PROFILES.map((p) => ({ id: p.id, name: p.name, perM: round2(p.pricePerM * ctx.FASAD_PROF_MARKUP) }));
// Порядок как в калькуляторе (fasadFills = FILLINGS.filter по группам) — индекс наполнения калькулятора совпадает с индексом здесь.
const fills = ctx.FILLINGS.filter((f) => ctx.FASAD_FILL_GROUPS.includes(f.g)).map((f) => ({ g: f.g, n: f.n, p: f.p, mat: f.mat }));
const out = `// СГЕНЕРИРОВАНО scripts/import-alu.cjs из калькулятора фасадов ALU (calc-platform: data/fasad-alu-data.js, data/fillings.js). Не править вручную.
// Фасады ALU ${ctx.FASAD_ALU_VERSION}, наполнения ${ctx.FILLINGS_VERSION}. Все цены — цены клиента, как в калькуляторе (calcOneFasad).
export const ALU_CALC_VERSION = ${JSON.stringify({ fasad: ctx.FASAD_ALU_VERSION, fillings: ctx.FILLINGS_VERSION })};
/** Профиль рамки: perM — цена клиента за пог. м периметра (в калькуляторе: прайс × наценка профиля). */
export const ALU_CALC_PROFILES: { id: string; name: string; perM: number }[] = ${JSON.stringify(profiles)};
/** Наполнения групп калькулятора (${ctx.FASAD_FILL_GROUPS.join(", ")}): p — цена клиента за м² площади фасада. */
export const ALU_CALC_FILLS: { g: string; n: string; p: number; mat: string }[] = ${JSON.stringify(fills)};
/** Уплотнитель, цена клиента за пог. м периметра фасада. */
export const ALU_CALC_GASKET_PER_M = ${ctx.FASAD_GASKET};
/** Петли в калькуляторе: до 1200 мм высоты — 2, выше — 3 (фурнитура в студии считается своими строками петель). */
export const ALU_CALC_HINGE_SPLIT_H = 1200;
`;
fs.writeFileSync(path.join(__dirname, "../src/aluData.ts"), out, "utf8");
console.log("aluData.ts:", profiles.length, "профилей,", fills.length, "наполнений");
