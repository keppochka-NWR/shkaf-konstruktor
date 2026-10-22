// Задание 22 (менеджеры 22.10): проверка отображения всех профилей купе без браузера.
// npx tsx scripts/kupe-profile-audit.ts [out.json]
// По каждой системе прайса: каждая модель GLB есть; сечение модели совпадает с сечением детали (fitProfile в Scene вписывает модель
// в габарит детали по всем осям — расхождение пропорций = искажённое сечение); рамки и разделители не выступают из ручки по глубине
// и стыкуются с ручками без щелей; цвет профиля в 3D и в 2D-рамке калькулятора (web/calc) соответствует названию цвета.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { KUPE_SYSTEMS } from "../src/kupeData";
import { kupeParts, kupeHandle, kupeProfileStyle, kupeGrad, DEFAULT_KUPE } from "../src/kupe";
import { createKupeModule } from "../src/ModulePalette";
import { initialModule, type Part } from "../src/model";

const glbBox = new Map<string, { min: number[]; max: number[] } | null>();
function bbox(file: string) {
  if (glbBox.has(file)) return glbBox.get(file)!;
  const path = "public/models/" + file;
  if (!existsSync(path)) { glbBox.set(file, null); return null; }
  const b = readFileSync(path), len = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes ?? []) for (const pr of mesh.primitives ?? []) {
    const a = json.accessors[pr.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
  }
  const r = { min: min.map((v) => v * 1000), max: max.map((v) => v * 1000) };
  glbBox.set(file, r); return r;
}
/** Масштаб вписывания модели в деталь по осям сечения (1 — сечение не искажено). */
function sectionScale(p: Part) {
  const bx = bbox(p.model!.file);
  if (!bx) return null;
  const s = bx.max.map((v, i) => v - bx.min[i]);
  // length 'y': сечение — X и Z модели; length 'x': модель повёрнута на −90° вокруг Z — ось X модели идёт в Y детали
  return p.model!.length === "y" ? { a: p.size[0] / s[0], b: p.size[2] / s[2] } : { a: p.size[1] / s[0], b: p.size[2] / s[2] };
}
// 2D-калькулятор web/calc: цвета рамки по названию
const ctx: Record<string, unknown> = {}; vm.createContext(ctx);
vm.runInContext(readFileSync("../web/calc/data/profiles.js", "utf8").replace(/^(const|let|var) (\w+)/gm, "globalThis.$2"), ctx);
const CALC = ctx.PROFILE_SYSTEMS as { system: string; colors: { name: string; frameGrad: string }[] }[];

const lum = (hex: string) => { const n = parseInt(hex.replace("#", ""), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return { l: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, r, g, b }; };
/** Название цвета → ожидаемая светлота/оттенок; null — проверить нечем (древесные и кашемиры). */
function colorIssue(name: string, grad: string): string | null {
  const parts = grad.split(","), mid = lum(parts[0]), light = lum(parts[1] ?? parts[0]);
  const n = name.toLowerCase();
  if (/чёрн|черн|антрацит/.test(n) && mid.l > 0.3) return `«${name}» слишком светлый (${parts[0]})`;
  if (/бел|молочн|слонов/.test(n) && !/бел.*дуб|дуб бел/.test(n) && mid.l < 0.75) return `«${name}» слишком тёмный (${parts[0]})`;
  if (/серебр/.test(n) && (mid.l < 0.6 || Math.abs(mid.r - mid.b) > 20)) return `«${name}» не серебро (${parts[0]})`;
  if (/золот/.test(n) && !(mid.r > mid.b + 60)) return `«${name}» не золото (${parts[0]})`;
  if (/бронз/.test(n) && !(mid.r > mid.b + 40 && mid.l < 0.6)) return `«${name}» не бронза (${parts[0]})`;
  if (/шампань/.test(n) && !(mid.r > mid.b + 15 && mid.l > 0.55)) return `«${name}» не шампань (${parts[0]})`;
  if (light.l + 0.02 < mid.l) return `«${name}»: блик темнее основного (${grad})`;
  return null;
}

type Row = { system: string; profile: string; handle: string; files: number; missing: string[]; distorted: string[]; protrude: string[]; gaps: string[]; colors: string[] };
const rows: Row[] = [];
for (const s of KUPE_SYSTEMS) {
  const m = createKupeModule(1600, 2400, initialModule());
  m.kupe = { ...DEFAULT_KUPE, system: s.system, color: s.colors[0].name, sections: 1, doors: 2 };
  const ps = kupeParts(m), row: Row = { system: s.system, profile: s.profile, handle: kupeProfileStyle(s), files: 0, missing: [], distorted: [], protrude: [], gaps: [], colors: [] };
  const files = new Set<string>();
  for (const p of ps) if (p.model) {
    files.add(p.model.file);
    const sc = sectionScale(p);
    if (!sc) { if (!row.missing.includes(p.model.file)) row.missing.push(p.model.file); continue; }
    for (const [ax, v] of Object.entries(sc)) if (Math.abs(v - 1) > 0.03 && !row.distorted.some((x) => x.startsWith(p.model!.file))) row.distorted.push(`${p.model.file} ${ax}×${v.toFixed(3)}`);
  }
  row.files = files.size;
  // рамки/разделители/вставки полотна 0 — по глубине в пределах ручки и вплотную к ручкам по ширине
  const by = (id: string) => ps.find((p) => p.id === id)!, hl = by("kupe:0:side:l"), hr = by("kupe:0:side:r");
  const z0 = hl.position[2] - hl.size[2] / 2, z1 = hl.position[2] + hl.size[2] / 2;
  for (const id of ["kupe:0:frame:top", "kupe:0:frame:bottom", "kupe:0:div-h:0", "kupe:0:fill:0:0"]) {
    const p = by(id); if (!p) continue;
    const a = p.position[2] - p.size[2] / 2, b = p.position[2] + p.size[2] / 2;
    if (a < z0 - 0.5 || b > z1 + 0.5) row.protrude.push(`${p.name}: ${Math.max(z0 - a, b - z1).toFixed(1)} мм из ручки ${hl.size[2]} по глубине`);
    if (!id.includes("fill")) {
      const gl = (p.position[0] - p.size[0] / 2) - (hl.position[0] + hl.size[0] / 2), gr = (hr.position[0] - hr.size[0] / 2) - (p.position[0] + p.size[0] / 2);
      if (Math.abs(gl) > 0.5 || Math.abs(gr) > 0.5) row.gaps.push(`${p.name}: щель ${gl.toFixed(1)}/${gr.toFixed(1)} мм у ручек`);
    }
  }
  // полотно стоит над нижней направляющей и под верхней (зазоры по чертежу), ручка не короче полотна
  const tb = ps.find((p) => p.id === "kupe:track:bottom"), fb = by("kupe:0:frame:bottom");
  if (tb && hl.position[1] - hl.size[1] / 2 < tb.size[1] - 0.01) row.gaps.push(`полотно ниже верха нижней направляющей`);
  if (Math.abs((hl.position[1] - hl.size[1] / 2) - (fb.position[1] - fb.size[1] / 2)) > 0.5) row.gaps.push(`рамка нижняя не от низа ручки`);
  if (kupeHandle(s).w !== hl.size[0]) row.gaps.push(`ширина ручки ${hl.size[0]} ≠ сечение ${kupeHandle(s).w}`);
  for (const c of s.colors) { const e = colorIssue(c.name, kupeGrad(c)); if (e) row.colors.push("студия: " + e); }
  const cs = CALC.find((x) => x.system === s.system);
  if (cs) for (const c of cs.colors) {
    const e = colorIssue(c.name, c.frameGrad); if (e) row.colors.push("web/calc: " + e);
    const st = s.colors.find((x) => x.name === c.name);
    if (!st) row.colors.push(`web/calc: цвета «${c.name}» нет в прайсе студии`);
    else if (kupeGrad(st).toLowerCase() !== c.frameGrad.toLowerCase()) row.colors.push(`«${c.name}»: web/calc ${c.frameGrad} ≠ студия ${kupeGrad(st)}`);
  }
  rows.push(row);
}
const calcOnly = CALC.filter((c) => c.system !== "Свои цены" && !KUPE_SYSTEMS.some((s) => s.system === c.system)).map((c) => c.system);
const out = { systems: rows.length, calcSystems: CALC.filter((c) => c.system !== "Свои цены").length, calcOnly, rows };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1), "utf8");
for (const r of rows) {
  const issues = [...r.missing.map((x) => "нет файла " + x), ...r.distorted.map((x) => "сечение искажено " + x), ...r.protrude, ...r.gaps, ...r.colors];
  console.log(`${issues.length ? "!!" : "ok"} ${r.system} · ${r.profile} → ${r.handle}, моделей ${r.files}${issues.length ? "\n   - " + issues.join("\n   - ") : ""}`);
}
console.log(`систем ${rows.length}; в web/calc ${out.calcSystems}${calcOnly.length ? ", только в web/calc: " + calcOnly.join(", ") : ""}`);
