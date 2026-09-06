const fs = require("node:fs"),
  vm = require("node:vm");
const src = fs.readFileSync(
  new URL(
    "../../web/assets/catalog-lamarty.js",
    `file://${__filename.replaceAll("\\", "/")}`,
  ),
  "utf8",
);
// tier — ценовая группа прайса Lamarty 01.01.2026 (КЛАССИКА / ПРЕМИУМ / ЛЮКС); цена листа считается в pricing.ts.
const data = vm
  .runInNewContext(src + "; LAMARTY;")
  .map((c) => ({ n: c.n, cat: c.cat, tier: c.tier, tex: c.tex ? "../" + c.tex : "" }));
fs.writeFileSync(
  new URL("../src/catalog.ts", `file://${__filename.replaceAll("\\", "/")}`),
  "export type Tier='КЛАССИКА'|'ПРЕМИУМ'|'ЛЮКС';\nexport type Decor={n:string;cat:string;tier:Tier;tex:string};\nexport const catalog:Decor[]=" +
    JSON.stringify(data, null, 2) +
    ";\n",
);
console.log(`Catalog: ${data.length} decors with price tiers`);
