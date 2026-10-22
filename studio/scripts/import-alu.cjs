// Импорт калькулятора фасадов ALU (calc-platform: data/fasad-alu-data.js + data/fillings.js) в студию:
//   node scripts/import-alu.cjs [путь к calc-platform] [--allow-dirty]
// Источник должен быть закоммичен: если data/fillings.js или data/fasad-alu-data.js изменены и не закоммичены (git status),
// импорт отказывается — иначе «один источник» не воспроизводится из истории калькулятора. --allow-dirty — осознанный импорт
// незакоммиченной правки: коммит и список грязных файлов пишутся в aluData.ts (ALU_CALC_SOURCE), чтобы это было видно.
// Один источник цен рамочных алюминиевых фасадов: профили (₽/м), наполнения групп FASAD_FILL_GROUPS (₽/м²), уплотнитель (₽/м).
// В студию попадают только ЦЕНЫ КЛИЕНТА (как считает калькулятор): профиль = прайс × FASAD_PROF_MARKUP, наполнение — розница
// FILLINGS, уплотнитель — FASAD_GASKET. Закупочные цены профилей в файл не пишутся. Результат — src/aluData.ts (коммитится).
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), { execFileSync } = require("node:child_process");
const args = process.argv.slice(2), allowDirty = args.includes("--allow-dirty");
const root = args.find((a) => !a.startsWith("--")) || "C:/Users/My PC/Desktop/Claude Project/calc-ready/calc-platform";
const SRC = ["data/fillings.js", "data/fasad-alu-data.js"];
const gitRaw = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8" }), git = (...a) => gitRaw(...a).trim();
let source;
try {
  const dirty = gitRaw("status", "--porcelain", "--", ...SRC).split(/\r?\n/).filter(Boolean).map((l) => l.slice(3));
  source = { commit: git("rev-parse", "--short", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD"), dirty };
} catch { source = { commit: null, branch: null, dirty: ["(источник не в git)"] }; }
if (source.dirty.length && !allowDirty) {
  console.error("Источник калькулятора не закоммичен:", source.dirty.join(", "), "(" + root + ", коммит " + source.commit + ").");
  console.error("Закоммитьте правку в калькуляторе или запустите с --allow-dirty (состояние попадёт в aluData.ts).");
  process.exit(1);
}
const ctx = {};
vm.createContext(ctx);
for (const f of SRC) {
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
/** Состояние источника при импорте: коммит калькулятора и незакоммиченные файлы (пусто — данные воспроизводятся из коммита). */
export const ALU_CALC_SOURCE: { commit: string | null; branch: string | null; dirty: string[] } = ${JSON.stringify(source)};
/** Профиль рамки: perM — цена клиента за пог. м периметра (в калькуляторе: прайс × наценка профиля). */
export const ALU_CALC_PROFILES: { id: string; name: string; perM: number }[] = ${JSON.stringify(profiles)};
/** Наполнения групп калькулятора (${ctx.FASAD_FILL_GROUPS.join(", ")}): p — цена клиента за м² площади фасада. */
export const ALU_CALC_FILLS: { g: string; n: string; p: number; mat: string }[] = ${JSON.stringify(fills)};
/** Уплотнитель, цена клиента за пог. м периметра фасада. */
export const ALU_CALC_GASKET_PER_M = ${ctx.FASAD_GASKET};
/** Петли в калькуляторе: до 1200 мм высоты — 2, выше — 3 (фурнитура в студии считается своими строками петель). */
export const ALU_CALC_HINGE_SPLIT_H = 1200;
`;
// Тот же результат — файл не трогаем (рабочая копия git с CRLF иначе показывает «изменён» без изменений в содержимом).
const target = path.join(__dirname, "../src/aluData.ts"), eol = (s) => s.replace(/\r\n/g, "\n");
const same = fs.existsSync(target) && eol(fs.readFileSync(target, "utf8")) === out;
if (!same) fs.writeFileSync(target, out, "utf8");
console.log(same ? "aluData.ts без изменений:" : "aluData.ts:", profiles.length, "профилей,", fills.length, "наполнений; источник", source.commit, source.dirty.length ? "НЕ ЗАКОММИЧЕН: " + source.dirty.join(", ") : "чистый");
