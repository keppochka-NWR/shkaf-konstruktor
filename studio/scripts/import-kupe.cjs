// Импорт прайса калькулятора дверей-купе (Calc\kupe\data) в студию: node scripts/import-kupe.cjs [путь к Calc\kupe]
// Один источник цен: профили Аристо, наполнения, доводчик, сложная сборка, плёнки. Результат — src/kupeData.ts (коммитится).
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = process.argv[2] || "C:/Users/My PC/Desktop/Claude Project/Calc/kupe";
const ctx = {};
vm.createContext(ctx);
for (const f of ["data/profiles.js", "data/fillings.js", "data/lamarty.js"]) {
  const code = fs.readFileSync(path.join(root, f), "utf8").replace(/^\uFEFF/, "").replace(/^const (\w+)/gm, "globalThis.$1");
  vm.runInContext(code, ctx, { filename: f });
}
const systems = ctx.PROFILE_SYSTEMS.filter((s) => s.system !== "Свои цены").map((s) => ({
  system: s.system, family: s.family, profile: s.profile, dims: s.dims, limits: s.limits, kind: s.systemKind || "slide",
  ...(s.hardwarePerDoor ? { hardwarePerDoor: s.hardwarePerDoor, hardwareLabel: s.hardwareLabel } : {}),
  colors: s.colors.map((c) => ({ name: c.name, grad: c.frameGrad, ruchka: c.ruchka, verh: c.verh, niz: c.niz, razd: c.razd, top: c.napravl_top, bot: c.napravl_bot })),
}));
const fills = ctx.FILLINGS.map((f) => ({ g: f.g, n: f.n, p: f.p, mat: f.mat }));
const ldspPrice = ctx.LAMARTY_LDSP[0]?.p ?? 1800;
const out = `// СГЕНЕРИРОВАНО scripts/import-kupe.cjs из калькулятора дверей-купе (Calc\\kupe\\data). Не править вручную.
// Профили ${ctx.PROFILES_VERSION}, наполнения ${ctx.FILLINGS_VERSION}, Lamarty ${ctx.LAMARTY_VERSION}. Цены — розничные, как в калькуляторе купе.
export const KUPE_VERSION = ${JSON.stringify({ profiles: ctx.PROFILES_VERSION, fillings: ctx.FILLINGS_VERSION, lamarty: ctx.LAMARTY_VERSION })};
export type KupeColor = { name: string; grad: string; ruchka: number; verh: number; niz: number; razd: number; top: number; bot: number };
export type KupeSystem = { system: string; family: string; profile: string; dims: { frameSide: number; frameTop: number; frameBot: number; divider: number; trackTop: number; trackBot: number }; limits: { Hmin: number; Hmax: number; doorL_min: number; doorL_max: number }; kind: "slide" | "hang"; hardwarePerDoor?: number; hardwareLabel?: string; colors: KupeColor[] };
export type KupeFill = { g: string; n: string; p: number; mat: string };
export const KUPE_SYSTEMS: KupeSystem[] = ${JSON.stringify(systems)};
export const KUPE_FILLS: KupeFill[] = ${JSON.stringify(fills)};
/** ЛДСП Lamarty как наполнение купе: одна цена за м² для всех декоров (как в калькуляторе купе). */
export const KUPE_LDSP_PRICE = ${ldspPrice};
export const KUPE_SECTIONS: { label: string; h: number; v: number; rowRatios: number[]; colRatios: number[] }[] = ${JSON.stringify(ctx.SECTION_OPTS)};
export const KUPE_SOFT_CLOSE = ${ctx.SOFT_CLOSE_PRICE};
export const KUPE_COMPLEX_WORK = ${ctx.COMPLEX_WORK_PRICE};
export const KUPE_COMPLEX_THRESHOLD = ${ctx.COMPLEX_SECTIONS_THRESHOLD};
export const KUPE_FILM_ARMOR = ${JSON.stringify(ctx.FILM_ARMOR)};
export const KUPE_FILM_SAFETY = ${JSON.stringify(ctx.FILM_SAFETY)};
/** Цены профилей в прайсе — закупка за пог. м; калькулятор купе умножает на 3. */
export const KUPE_PROFILE_MULT = 3;
`;
fs.writeFileSync(path.join(__dirname, "../src/kupeData.ts"), out, "utf8");
console.log("kupeData.ts:", systems.length, "систем,", fills.length, "наполнений, ЛДСП", ldspPrice, "₽/м²");
