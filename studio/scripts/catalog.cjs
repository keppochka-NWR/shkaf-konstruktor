const fs = require("node:fs"),
  vm = require("node:vm");
const src = fs.readFileSync(
  new URL(
    "../../web/assets/catalog-lamarty.js",
    `file://${__filename.replaceAll("\\", "/")}`,
  ),
  "utf8",
);
// tex — путь от страницы студии: текстуры лежат в studio/public/tex (копия web/assets/tex), в сборке web/studio/tex —
// не «../assets/tex» от корня сайта: на Pages старого web/assets нет, текстуры давали 404 (критик 20.10, m10).
// tier — ценовая группа прайса Lamarty 01.01.2026 (КЛАССИКА / ПРЕМИУМ / ЛЮКС); цена листа считается в pricing.ts.
const data = vm
  .runInNewContext(src + "; LAMARTY;")
  .map((c) => ({ n: c.n, cat: c.cat, tier: c.tier, tex: c.tex ? c.tex.replace(/^assets\//, "") : "" }));
const catalogUrl = new URL("../src/catalog.ts", `file://${__filename.replaceAll("\\", "/")}`);
const catalogText =
  "export type Tier='КЛАССИКА'|'ПРЕМИУМ'|'ЛЮКС';\nexport type Decor={n:string;cat:string;tier:Tier;tex:string};\nexport const catalog:Decor[]=" +
  JSON.stringify(data, null, 2) +
  ";\n";
// окончания строк — как у файла на диске (Windows autocrlf: CRLF), иначе каждый прогон сборки «меняет» catalog.ts
// и publish.ps1 со второго раза падает на шаге 1 (uncommitted changes); при том же содержании файл не переписываем
let catalogOld = "";
try { catalogOld = fs.readFileSync(catalogUrl, "utf8"); } catch {}
const catalogOut = catalogOld.includes("\r\n") ? catalogText.replace(/\n/g, "\r\n") : catalogText;
if (catalogOut !== catalogOld) fs.writeFileSync(catalogUrl, catalogOut);
console.log(`Catalog: ${data.length} decors with price tiers`);
