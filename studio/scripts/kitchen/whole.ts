// Сверка ЦЕЛОЙ кухни из Базиса с проектом студии (критик целых кухонь, шаг 14): то, чего не видит сверка одного модуля (loop/batch).
//  1) расстановка: габарит панелей каждого модуля в мире (Базис: p = origin + Ry(yaw)·p_mod) против студии (localToRoom), общий сдвиг импорта;
//  2) детали: все платы студии против всех панелей Базиса (модули + «Ряд») в мире, ±1 мм — лишнее и недостающее;
//  3) пересечения деталей РАЗНЫХ модулей (> 0,5 мм) в студии и в Базисе;
//  4) разбор проекта (parseProject — как студия открывает файл): какие поля и детали параметрических модулей теряются;
//  5) первая правка (commitProject = applyAutoFillers + projectErrors): сдвиги, фальши, новые пересечения, отказ правки;
//  6) фурнитура Базиса (категория × имя) против строк сметы студии; кромка и фасадный материал.
// npx tsx scripts/kitchen/whole.ts k06,k22 [папка проектов] [отчёт.md]
import { readFileSync, writeFileSync } from "node:fs";
import { parts, type Part } from "../../src/model";
import { parseProject, localToRoom, applyAutoFillers, projectErrors, type PlacedModule, type Project } from "../../src/project";
import { estimate } from "../../src/pricing";
import { worktopGroupRole } from "./rowWorktop";
import { allowedContact } from "../../src/collisions";
import { etalonHoleItems, holeSig, supplierEdgeKind } from "./wholeChecks";
import { kitHeaderIdx } from "./refHardware";

const ET = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon";
const keys = (process.argv[2] ?? "").split(",").filter(Boolean);
const PDIR = process.argv[3] ?? "public/local-projects";
const OUT = process.argv[4];
type Box = number[];
const r1 = (v: number) => Math.round(v * 10) / 10, r3 = (v: number) => Math.round(v * 1000) / 1000;
const fmt = (b: number[]) => b.map(r1).join(",");
const ROW = ["worktops", "plinths", "wallPanels", "profiles", "other"];
const lines: string[] = [];
const log = (s = "") => { lines.push(s); console.log(s); };

/** Базис → мир: p = origin + Ry(yaw)·p_mod (x' = x·cos + z·sin, z' = −x·sin + z·cos). */
function bazisBox(o: number[], yaw: number, b: number[]): Box {
  const a = (yaw * Math.PI) / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)), xs: number[] = [], zs: number[] = [];
  for (const x of [b[0], b[3]]) for (const z of [b[2], b[5]]) { xs.push(o[0] + x * c + z * s); zs.push(o[2] - x * s + z * c); }
  return [Math.min(...xs), o[1] + b[1], Math.min(...zs), Math.max(...xs), o[1] + b[4], Math.max(...zs)];
}
function studioBox(a: PlacedModule, q: Part): Box {
  const [cx, cy, cz] = q.position, [sx, sy, sz] = q.size, p0 = localToRoom(a, cx - sx / 2, cz - sz / 2), p1 = localToRoom(a, cx + sx / 2, cz + sz / 2), y = a.y ?? 0;
  return [Math.min(p0.x, p1.x), y + cy - sy / 2, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), y + cy + sy / 2, Math.max(p0.z, p1.z)];
}
const union = (bs: Box[]): Box => [0, 1, 2].map((i) => Math.min(...bs.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...bs.map((b) => b[i]))));
const pen = (A: Box, B: Box) => Math.min(...[0, 1, 2].map((i) => Math.min(A[i + 3], B[i + 3]) - Math.max(A[i], B[i])));
const isBoard = (q: Part) => q.material === "board" || q.material === "hdf" || q.material === "glass";
function interModule(p: Project, off: number[] = [0, 0, 0]) {
  // фурнитура сырых модулей (raw:h*) в студии — точка Базиса с условным кубом 10 мм, а не форма изделия; у Базиса фурнитура
  // в пересечения не входит — сравниваем одинаково (иначе петля/навес/клипса у соседней детали дают «пересечение» 3–5 мм)
  // объекты «Ряда» (с 1a7d673 каждый цоколь, стеновая панель, столешница — свой объект) — одна группа, как «ряд» у Базиса ниже:
  // стык цоколя фронтального и бокового внутри ряда — не пересечение разных модулей
  const all = p.modules.flatMap((a, i) => parts(a.module).filter((q) => q.material !== "alu" && !q.id.startsWith("raw:h")).map((q) => ({ i: a.module.raw?.row ? -1 : i, n: a.module.name, q, b: studioBox(a, q).map((v, t) => v - off[t % 3]) })));
  const out: string[] = [];
  // разрешённые контакты — тот же реестр, что у проверки студии (collisions.allowedContact): опора под дном до 3 мм, клипса на цоколе.
  // У Базиса фурнитура в пересечения не входит, а её сетки там те же: k23 «Нижний модуль» — опора Ø58 в точке z 493 доходит до 522,
  // цоколь ряда Базиса начинается с 520 — те же 2 мм, что у студии (n4-kitchens3)
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const A = all[i], B = all[j]; if (A.i === B.i) continue; const d = pen(A.b, B.b); if (d > 0.5 && !allowedContact(A.q, B.q, d)) out.push(`${A.n} / ${A.q.name} × ${B.n} / ${B.q.name}: ${r1(d)} мм`); }
  return out;
}

let total = 0;
for (const k of keys) {
  const e = JSON.parse(readFileSync(`${ET}/${k}.json`, "utf8"));
  const file = JSON.parse(readFileSync(`${PDIR}/kitchen-${k}.json`, "utf8"));
  const p = parseProject(structuredClone(file));
  const mods = e.modules as { key: string; name: string; world: { origin: number[]; yaw?: number }; panels: { name: string; kind: string; mat?: string; box: number[]; edges?: { thick: number; len: number }[] }[]; hardware: { name: string; category: string }[] }[];
  const issues: string[] = [];
  log(`\n# ${k}: модулей Базиса ${mods.length}, объектов студии ${p.modules.length}`);

  // 1. расстановка
  const bazis: { mod: string; name: string; b: Box; used?: boolean }[] = [];
  let off: number[] | null = null;
  log("\n## 1. Расстановка (габарит панелей в мире)");
  mods.forEach((m, i) => {
    const a = p.modules[i], yaw = m.world.yaw ?? 0, bb = m.panels.filter((x) => Array.isArray(x.box)).map((x) => bazisBox(m.world.origin, yaw, x.box));
    m.panels.filter((x) => Array.isArray(x.box)).forEach((x, j) => bazis.push({ mod: m.key, name: x.name, b: bb[j] }));
    const B = union(bb), S = union(parts(a.module).filter(isBoard).map((q) => studioBox(a, q))), d = [0, 1, 2, 3, 4, 5].map((t) => S[t] - B[t]);
    if (!off) off = d.slice(0, 3);
    const dev = d.map((v, t) => v - off![t % 3]), bad = dev.some((v) => Math.abs(v) > 0.6) || (a.rotation ?? 0) !== yaw;
    if (bad) issues.push(`расстановка ${m.key}: откл. ${fmt(dev)}, поворот ${a.rotation ?? 0}/${yaw}`);
    log(`${m.key} ${m.name} · yaw ${yaw}/${a.rotation ?? 0} · ${a.module.raw ? "сырой" : "парам."} · ${bad ? "ОТКЛ. " + fmt(dev) : "ok"}`);
  });
  // обстановка модели Базиса (стены «Бетон», макеты техники «Пластик»/«Хром» — роль appliance, макет на столешнице) — не изделие:
  // импорт её не берёт (rowPanelsOf, n3-plinth), сверка тоже
  for (const g of ROW) for (const x of e.row?.[g] ?? []) if (Array.isArray(x.box) && x.role !== "appliance" && !(g === "worktops" && worktopGroupRole(x) === "mock")) bazis.push({ mod: "ряд", name: `${g}: ${x.name}`, b: x.box });
  log(`общий сдвиг импорта ${off!.map(r1).join(",")}`);

  // 2. детали
  const extra: string[] = [];
  // фигурная столешница ряда разбита на прямоугольники «(часть i/n)» по контуру Базиса — сверяем их габарит с деталью Базиса
  const studioBoxes: { name: string; b: Box }[] = [];
  for (const a of p.modules) {
    const groups = new Map<string, Box[]>();
    for (const q of parts(a.module).filter(isBoard)) {
      const b = studioBox(a, q).map((v, t) => v - off![t % 3]), m = / \(часть \d+\/\d+\)$/.exec(q.name);
      if (m) { const k = `${a.module.name} / ${q.name.slice(0, m.index)}`; groups.set(k, [...(groups.get(k) ?? []), b]); } else studioBoxes.push({ name: `${a.module.name} / ${q.name}`, b });
    }
    for (const [name, bs] of groups) studioBoxes.push({ name: name + " (по контуру)", b: union(bs) });
  }
  for (const s of studioBoxes) {
    const hit = bazis.find((z) => !z.used && z.b.every((v, t) => Math.abs(v - s.b[t]) <= 1.01));
    if (hit) hit.used = true; else extra.push(`${s.name} ${fmt(s.b)}`);
  }
  const miss = bazis.filter((z) => !z.used).map((z) => `${z.mod} / ${z.name} ${fmt(z.b)}`);
  log(`\n## 2. Детали: лишних в студии ${extra.length}, нет в студии ${miss.length}`);
  extra.forEach((x) => log("  + " + x)); miss.forEach((x) => log("  − " + x));
  if (extra.length || miss.length) issues.push(`детали: лишних ${extra.length}, нет ${miss.length}`);

  // 3. пересечения между модулями
  const sInter = interModule(p, off!);
  let bInter = 0;
  for (let i = 0; i < bazis.length; i++) for (let j = i + 1; j < bazis.length; j++) if (bazis[i].mod !== bazis[j].mod && pen(bazis[i].b, bazis[j].b) > 0.5) bInter++;
  log(`\n## 3. Пересечения разных модулей: студия ${sInter.length}, Базис ${bInter}`);
  sInter.slice(0, 30).forEach((x) => log("  " + x));
  if (sInter.length > bInter) issues.push(`пересечений модулей ${sInter.length} (в Базисе ${bInter})`);

  // 4. разбор проекта
  log("\n## 4. Разбор файла проекта (как студия его открывает)");
  file.modules.forEach((a: PlacedModule, i: number) => {
    if (a.module.raw) return;
    const key = (q: Part) => `${q.id}|${q.size.map(r1)}|${q.position.map(r1)}`, A = parts(a.module), B = parts(p.modules[i].module), sb = new Set(B.map(key)), sa = new Set(A.map(key));
    const lost = Object.keys(a.module).filter((f) => !(f in p.modules[i].module)), oa = A.filter((q) => !sb.has(key(q))).length, ob = B.filter((q) => !sa.has(key(q))).length;
    if (lost.length || oa || ob) { log(`  ${a.module.name}: потеряны поля [${lost.join(",")}], деталей изменилось ${oa}/${ob}`); issues.push(`разбор: ${a.module.name} теряет [${lost.join(",")}]`); }
  });

  // 5. первая правка
  const q = applyAutoFillers(p), err = projectErrors(q), qi = interModule(q, off!);
  const moved = q.modules.map((a, i) => ({ a, b: p.modules[i] })).filter(({ a, b }) => Math.abs(a.x - b.x) > 0.01 || Math.abs(a.z - b.z) > 0.01 || a.module.cornerFiller !== b.module.cornerFiller || JSON.stringify(a.module.wallFiller) !== JSON.stringify(b.module.wallFiller));
  log(`\n## 5. Первая правка (applyAutoFillers): изменено ${moved.length}, правка ${err.length ? "ОТКЛОНЕНА: " + err[0] : "принята"}, пересечений ${sInter.length} → ${qi.length}`);
  moved.forEach(({ a, b }) => log(`  ${b.module.name} (${b.module.raw ? "сырой" : "парам."}): сдвиг ${r1(a.x - b.x)},${r1(a.z - b.z)}${a.module.cornerFiller ? ", угловая фальш " + a.module.cornerFiller : ""}${a.module.wallFiller ? ", фальш к стене" : ""}`));
  if (moved.length || err.length) issues.push(`первая правка: изменено ${moved.length}${err.length ? ", отклонена" : ""}, пересечений → ${qi.length}`);

  // 6. фурнитура и смета
  const names: Record<string, number> = {};
  // член вложенного комплекта направляющих (refHardware.kitHeaderIdx) — та же направляющая второй записью, не считаем
  for (const m of mods) { const kh = kitHeaderIdx(m.hardware); for (const [hi, h] of (m.hardware as { name: string; category: string; mat?: string | null }[]).entries()) { if (kh.has(hi)) continue; const n = `${h.category} | ${h.name}${h.mat && h.mat !== h.name && /^профиль\d*$/i.test(h.name) ? " (" + h.mat + ")" : ""}`; names[n] = (names[n] ?? 0) + 1; } }
// сушка из безымянных тел моделирования («Вращение», «Тело по траектории») — изделие по имени комплекта, одно на kitId (k08)
  for (const m of mods) {
    const hw = m.hardware as { name: string; category: string; kit?: string | null; kitId?: number | null }[], named = new Set(hw.map((h) => (h.name ?? "").trim())), kits = new Map<string, Set<number | string>>();
    hw.forEach((h, i) => { const kit = (h.kit ?? "").trim(); if (/^(тело по траектории|вращение|выталкивание\s*\d*|основа)$/i.test((h.name ?? "").trim()) && /^сушк/i.test(kit) && !named.has(kit)) { const s = kits.get(kit) ?? new Set(); s.add(h.kitId ?? i); kits.set(kit, s); } });
    for (const [kit, s] of kits) names[`сушка | ${kit}`] = (names[`сушка | ${kit}`] ?? 0) + s.size;
  }
  for (const h of e.row?.hardware ?? []) names[`ряд ${h.category} | ${h.name}`] = (names[`ряд ${h.category} | ${h.name}`] ?? 0) + 1;
  for (const x of e.row?.profiles ?? []) { const n = `ряд профиль | ${x.name}${x.mat && x.mat !== x.name ? " (" + x.mat + ")" : ""}`; names[n] = (names[n] ?? 0) + 1; }
  // фурнитура ряда в «прочем» без габарита (навесы, конфирматы, петли объектов ряда — «Пенал на столешку», «Карнизы»)
  for (const x of (e.row?.other ?? []) as { name: string; category?: string; box?: number[] }[]) if (!Array.isArray(x.box) && x.category) { const n = `ряд ${x.category} | ${x.name}`; names[n] = (names[n] ?? 0) + 1; }
  log("\n## 6. Фурнитура Базиса");
  for (const [n, c] of Object.entries(names).sort()) log(`  ${c} × ${n}`);
  const edge: Record<string, number> = {}, edgeF: Record<string, number> = {}; let fa = 0;
  const panels = [...mods.flatMap((m) => m.panels), ...ROW.flatMap((g) => e.row?.[g] ?? [])];
  for (const x of panels) { const fm = /фасадн/i.test(x.mat ?? ""); for (const ed of x.edges ?? []) if (ed.len > 0) (fm ? edgeF : edge)[ed.thick] = ((fm ? edgeF : edge)[ed.thick] ?? 0) + ed.len / 1000;
    if (fm && Array.isArray(x.box)) { const s = [x.box[3] - x.box[0], x.box[4] - x.box[1], x.box[5] - x.box[2]].sort((u, v) => v - u); fa += s[0] * s[1] / 1e6; } }
  const mats: Record<string, number> = {};
  for (const x of panels) if (Array.isArray(x.box) && x.kind !== "hdf" && !/фасадн/i.test(x.mat ?? "")) mats[x.mat ?? x.kind] = (mats[x.mat ?? x.kind] ?? 0) + 1;
  log(`кромка Базиса (без фасадного мат-ла), м: ${JSON.stringify(Object.fromEntries(Object.entries(edge).map(([t, v]) => [t, r3(v)])))}; на фасадном мат-ле: ${JSON.stringify(Object.fromEntries(Object.entries(edgeF).map(([t, v]) => [t, r3(v)])))}; фасадный мат-л ${r3(fa)} м²`);
  log(`материалы Базиса (панелей): ${JSON.stringify(mats)}`);
  log("\n## 7. Смета студии");
  const est = estimate(p).lines;
  for (const l of est) log(`  ${l.id} · ${l.label} · ${l.quantity} ${l.unit}`);
  // штуки Базиса против строк сметы (пары направляющих — ×2, комплект ящика — 2 направляющие)
  const cnt = (re: RegExp, cat?: string) => Object.entries(names).filter(([n]) => (!cat || n.split(" | ")[0].endsWith(cat)) && re.test(n.split(" | ")[1] ?? "")).reduce((s, [, c]) => s + c, 0);
  const sum = (re: RegExp, mul = 1) => est.filter((l) => re.test(l.id)).reduce((s, l) => s + l.quantity * mul, 0);
  // строки «как в Базисе» (n3): bazis:<категория>:<название>, firmax:<артикул> (пары), shelf-holder:<название>, kitchen-leg:<название>
  const pipes = est.some((l) => /^bazis:прочее:Труба/i.test(l.id)) ? cnt(/труба/i) : 0;
  const prodProfiles = cnt(/gola|kb \d|врезной|фасадный профиль|алюминиев/i, "профиль");
  // отверстия-крепёж Базиса — независимо от правила имени в bazisHoles и от категории (wholeChecks.etalonHoleItems: service без модели
  // + безымянный размер «прочего» ряда). Пропуск именованного отверстия смета↔Базис теперь виден (n4-kitchens3)
  const holeHw = etalonHoleItems(e);
  const holesBazis = holeHw.length, holeNames: Record<string, number> = {};
  for (const h of holeHw) holeNames[(h.name ?? "").trim()] = (holeNames[(h.name ?? "").trim()] ?? 0) + 1;
  if (holesBazis) log(`отверстия-крепёж Базиса (service без модели): ${holesBazis} — ${Object.entries(holeNames).map(([n, c]) => `${c} × ${n}`).join(", ")}`);
  const pairs: [string, number, number][] = [
    ["опоры", cnt(/./, "опора"), sum(/^kitchen-leg/)], ["клипсы", cnt(/./, "клипса"), sum(/^kitchen-clip$/)], ["навесы", cnt(/./, "навес"), sum(/^kitchen-hanger$/)],
    ["конфирматы", cnt(/./, "конфирмат"), sum(/^confirmat(-7x50)?$/)], ["эксцентрики", cnt(/./, "эксцентрик"), sum(/^eccentric$/)], ["полкодержатели", cnt(/./, "полкодержатель"), sum(/^shelf-holder/)],
    ["шканты", cnt(/./, "шкант"), sum(/^dowel$/)], ["петли", cnt(/^петля/i), sum(/^hinge/)], ["рафиксы", cnt(/./, "рафикс"), sum(/^bazis:рафикс:/)], ["сушки", cnt(/^сушка/i, "сушка"), sum(/^bazis:сушка:Сушка/i)],
    // Firmax кухни из Базиса — штуками (n4-kitchens3), студийный firmax-ldsp — парами. Axis PRO — комплект на ящик (2 направляющие);
    // строка внутреннего ящика axis-pro:inner (передняя панель, держатели, стабилизатор — n4-drawers) направляющих не добавляет
    ["направляющие Axis PRO", cnt(/axis pro направляющая/i), sum(/^axis-pro(?!:inner:)/, 2)], ["направляющие Firmax", cnt(/firmax/i, "направляющая"), est.filter((l) => /^firmax/.test(l.id)).reduce((s, l) => s + l.quantity * (l.unit === "пара" ? 2 : 1), 0)],
    // отверстия-крепёж Базиса («3x3», «5x12», «Отверстие 3х2», «Отверстие глухое_d2x10 мм.»…) — строки «Отверстие …» (n4-kitchens3).
    // Счёт Базиса — не по правилу имени bazisHoles, а по признакам эталона: см. holesBazis выше
    ["отверстия-крепёж", holesBazis, sum(/^bazis:отверстие:/)],
    // ящики параметрики n3-runners (MODERN SLIDE, Versalite — пара; Indigo, СТАРТ — комплект на ящик: 2 направляющие)
    ["направляющие прочие", cnt(/^(?!.*(axis pro|firmax)).*/i, "направляющая"), sum(/^bazis:направляющая:/) + sum(/^(modern-slide|versalite-h45|indigo):/, 2) + sum(/^start-sc:(?!rail)/, 2)], ["штанги/фланцы", cnt(/труба|фланец/i), sum(/^(rod|flange)/) + sum(/^bazis:прочее:Фланец/i) + pipes],
    // профили — изделия (GOLA, KB, врезной, узкий фасадный); в смете — строками с длиной: сверяем наличие
    ["профили-изделия: строки сметы есть", prodProfiles ? 1 : 0, est.some((l) => /^(gola-|bazis:профиль:)/.test(l.id)) || !prodProfiles ? (prodProfiles ? 1 : 0) : 0],
  ];
  const est2: string[] = [];
  for (const [n, b, s] of pairs) if (Math.abs(b - s) > 0.01) est2.push(`${n}: Базис ${b}, смета ${r3(s)}`);
  // отверстия ещё и по размерам (цифры имени: «3х2» и «Отверстие 3x2» — «3x2»): строка с другим размером не прячется за общей суммой
  const hb: Record<string, number> = {}, hs: Record<string, number> = {};
  for (const [n, c] of Object.entries(holeNames)) hb[holeSig(n)] = (hb[holeSig(n)] ?? 0) + c;
  for (const l of est) if (l.id.startsWith("bazis:отверстие:")) hs[holeSig(l.id.slice(16))] = (hs[holeSig(l.id.slice(16))] ?? 0) + l.quantity;
  for (const g of new Set([...Object.keys(hb), ...Object.keys(hs)])) if ((hb[g] ?? 0) !== (hs[g] ?? 0)) est2.push(`отверстия ${g || "без размера"}: Базис ${hb[g] ?? 0}, смета ${hs[g] ?? 0}`);
  const ids = est.map((l) => l.id), added = ["kit", "confirmat-cap", "worktop-cut:sink", "worktop-cut:hob", "small", "work"].filter((x) => ids.includes(x));
  // кромка по толщинам: разница допустима, только если это кромка изделий поставщика, которые смета считает м²/пог. м, — и это
  // проверяется по деталям Базиса каждого модуля (n4-kitchens3): в параметрическом модуле — плита МДФ (фасад «external»), в любом —
  // стекло, зеркало, столешница, стеновая панель. Остаток, не объяснённый такими деталями, — замечание
  const eid: Record<string, string> = { edge04: "0.4", edge05: "0.5", edge08: "0.8", edge1: "1", edge2: "2" }, se: Record<string, number> = {};
  for (const l of est) if (eid[l.id]) se[eid[l.id]] = (se[eid[l.id]] ?? 0) + l.quantity;
  const ed = [...new Set([...Object.keys(edge), ...Object.keys(se)])].filter((t) => Math.abs((se[t] ?? 0) - (edge[t] ?? 0)) > 0.05).map((t) => `${t} мм: Базис ${r3(edge[t] ?? 0)}, смета ${r3(se[t] ?? 0)}`);
  const edgeWhy: string[] = [], edgeBad: string[] = [];
  // «Ряд» с 1a7d673 — много объектов (каждый цоколь, стеновая панель, столешница): все они против всех деталей ряда Базиса — одной
  // группой, иначе каждый объект сравнивался бы со всей кромкой ряда
  const rowMods = p.modules.filter((a) => a.module.raw?.row);
  const groupsE: { name: string; mods: PlacedModule[]; ps: unknown[]; param: boolean }[] = [
    ...p.modules.map((a, i) => ({ a, i })).filter(({ a }) => !a.module.raw?.row).map(({ a, i }) => ({ name: a.module.name, mods: [a], ps: mods[i]?.panels ?? [], param: !a.module.raw })),
    ...(rowMods.length ? [{ name: `Ряд (${rowMods.length} об.)`, mods: rowMods, ps: ROW.flatMap((g) => e.row?.[g] ?? []), param: false }] : []),
  ];
  groupsE.forEach((gE) => {
    const ps = gE.ps as { name?: string; kind?: string; mat?: string | null; edges?: { thick: number; len: number }[] }[];
    const be: Record<string, number> = {}, sup: Record<string, Record<string, number>> = {}, sm: Record<string, number> = {};
    for (const l of estimate({ ...p, modules: gE.mods }).lines) if (eid[l.id]) sm[eid[l.id]] = (sm[eid[l.id]] ?? 0) + l.quantity;
    for (const x of ps) {
      if (/фасадн/i.test(x.mat ?? "")) continue;
      const kind = supplierEdgeKind(x, gE.param);
      for (const g of x.edges ?? []) if (g.len > 0) { const t = String(g.thick); be[t] = (be[t] ?? 0) + g.len / 1000; if (kind) (sup[t] ??= {})[kind] = (sup[t][kind] ?? 0) + g.len / 1000; }
    }
    for (const t of new Set([...Object.keys(be), ...Object.keys(sm)])) {
      const d = (be[t] ?? 0) - (sm[t] ?? 0), s = Object.values(sup[t] ?? {}).reduce((u, v) => u + v, 0);
      if (Math.abs(d) <= 0.05) continue;
      if (Math.abs(d - s) <= 0.05) edgeWhy.push(`${gE.name} ${t} мм ${r3(d)} — ${Object.entries(sup[t]!).map(([c, v]) => `${c} ${r3(v)}`).join(", ")}`);
      else edgeBad.push(`${gE.name} ${t} мм: Базис ${r3(be[t] ?? 0)}, смета ${r3(sm[t] ?? 0)}${s ? `, изделия поставщика ${r3(s)}` : ""}`);
    }
  });
  log(`кромка Базис ↔ смета: ${ed.length ? ed.join("; ") : "сходится"}`);
  if (edgeWhy.length) log(`  кромка изделий поставщика (по деталям Базиса): ${edgeWhy.join("; ")}`);
  if (edgeBad.length) { log(`  кромка не объяснена изделиями поставщика: ${edgeBad.join("; ")}`); issues.push(`кромка ≠ смета (${edgeBad.length})`); }
  log(`\nфурнитура Базис ↔ смета: ${est2.length ? est2.join("; ") : "сходится"}`);
  log(`строки сметы не из Базиса: ${added.join(", ") || "нет"}`);
  if (est2.length) issues.push(`фурнитура ≠ смета (${est2.length})`);
  if (added.some((x) => !["small", "work"].includes(x))) issues.push(`смета добавляет: ${added.filter((x) => !["small", "work"].includes(x)).join(", ")}`);
  log(`\n## Итог ${k}: ${issues.length ? issues.join("; ") : "сходится"}`);
  total += issues.length;
}
if (OUT) writeFileSync(OUT, lines.join("\n"));
console.log(`\nкухонь ${keys.length}, замечаний ${total}`);
