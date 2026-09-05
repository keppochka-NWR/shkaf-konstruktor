const fs = require("node:fs"),
  vm = require("node:vm");
const src = fs.readFileSync(
  new URL(
    "../../web/assets/catalog-lamarty.js",
    `file://${__filename.replaceAll("\\", "/")}`,
  ),
  "utf8",
);
const data = vm
  .runInNewContext(src + "; LAMARTY;")
  .map((c) => ({ n: c.n, cat: c.cat, tex: c.tex ? "../" + c.tex : "" }));
fs.writeFileSync(
  new URL("../src/catalog.ts", `file://${__filename.replaceAll("\\", "/")}`),
  "export type Decor={n:string;cat:string;tex:string};\nexport const catalog:Decor[]=" +
    JSON.stringify(data, null, 2) +
    ";\n",
);
console.log(`Catalog: ${data.length} decors (no prices)`);
