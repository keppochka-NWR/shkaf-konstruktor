// fix-drawers (правки Макса 29.10.2026) мышью, как менеджер: npx tsx scripts/fix-drawers-manager.ts <url /studio/?fresh=1> <outDir> [--base]
// От пустой комнаты, только мышь и клавиатура: 1) палитра «Комод» 600×850×550 → фасады ящиков (было 310/244/260); «+» ящик, «−» ящик,
// высота 1000 — фасады снова равные; 2) «Для одежды» 800×2000×600 с двумя ящиками за дверью → «Фасады ящиков: в накладку» (дверь над
// ящиками через зазор, петли в пределах двери) → ПКМ по фасаду ящика «За дверью» / «В накладку»; 3) «Антресоль сверху» → «Один выкатной
// ящик на всю секцию» (дверь антресоли заменяется фасадом ящика) → смета: комплекты направляющих. --base — прогон на сборке до правок
// (только снимки и числа «как было», без проверок новых кнопок).
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, facadeTop, facadeBottom, type Module, type Part } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";

const [url, out] = process.argv.slice(2), base = process.argv.includes("--base");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const note = (s: string) => { results.push([s, true, "(число)"]); console.log("·    " + s); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(300); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(500); };
const pick = async (l: Locator, label: string | RegExp) => { await l.scrollIntoViewIfNeeded(); const opts = await l.locator("option").allInnerTexts(); const want = opts.find((o) => typeof label === "string" ? o.trim() === label || o.includes(label) : label.test(o)); if (!want) throw Error("нет пункта " + label + " в " + opts.join(" | ")); await l.selectOption({ label: want }); await page.waitForTimeout(400); };
const field = (label: string) => page.locator(`input[aria-label="${label}"]`).first();
const sel = (label: string) => page.locator(`select[aria-label="${label}"]`).first();
const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).first();
async function openCat(cat: string) { const d = page.locator(`details[data-settings-category="${cat}"]`).first(); if (!(await d.count())) throw Error("нет категории " + cat); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openSet(cat: string, title: string) { await openCat(cat); const d = page.locator(`details[data-setting="${title}"]`).first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
let lastRaw = "";
/** Проект из хранилища браузера (комнаты «garderyob-rooms-v1» пишутся с задержкой): ждём, пока сохранённое изменится после действия. */
const saved = async (): Promise<Project> => { for (let k = 0; k < 40; k++) { await page.waitForTimeout(250); const raw = (await page.evaluate(() => Object.keys(localStorage).sort().map((key) => localStorage.getItem(key) ?? "").join("\u0001"))) as string; if (raw !== lastRaw) { await page.waitForTimeout(300); lastRaw = (await page.evaluate(() => Object.keys(localStorage).sort().map((key) => localStorage.getItem(key) ?? "").join("\u0001"))) as string; break; } }
  const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Project][] = []; const walk = (k: string, v: unknown, depth = 0) => { if (!v || typeof v !== "object" || depth > 6) return; const o = v as Record<string, unknown>; if (Array.isArray(o.modules) && o.room) { found.push([k, o as unknown as Project]); return; } for (const x of Object.values(o)) walk(k, x, depth + 1); };
  for (const [k, s] of all) { try { const doc = JSON.parse(s), n0 = found.length; walk(k, doc); if (doc?.calculation) for (const f of found.slice(n0)) if (!f[1].calculation) f[1] = { ...f[1], calculation: doc.calculation }; /* расчёт — в документе комнат (29.10) */ } catch { /* не JSON */ } }
  const best = found.filter(([k]) => !k.endsWith(":previous") && !/undo|history/i.test(k)).sort((a, b) => b[1].modules.length - a[1].modules.length)[0];
  if (!best) throw Error("проект не сохранён"); return parseProject(JSON.parse(JSON.stringify(best[1]))); };
const mod = (p: Project, i: number) => p.modules[i].module; // по порядку добавления: комод, шкаф, антресоль (первый из пустой комнаты назван по виду — «Комод», ae6153a 30.10; остальные «Модуль N»)
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
const hs = (ps: Part[]) => ps.map((p) => Math.round(p.size[1] * 10) / 10).join(" / ");
const spread = (ps: Part[]) => ps.length ? Math.max(...ps.map((p) => p.size[1])) - Math.min(...ps.map((p) => p.size[1])) : 0;
const lo = (p: Part) => p.position[1] - p.size[1] / 2, hi = (p: Part) => p.position[1] + p.size[1] / 2;
async function addFromPalette(kind: string, w: number, h: number, d: number) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1000);
}
/** Чистый вид для снимка: Esc (меню, выделение детали), закрыть открытые для ящиков створки, выбрать корпус в списке слева, вид и «Приблизить». */
async function view(name: RegExp, mode: "Спереди" | "3D" = "Спереди") {
  for (let k = 0; k < 3; k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(120); }
  const doors = page.locator('button[aria-label="Открыть фасады"]').first(); if ((await doors.getAttribute("aria-pressed").catch(() => null)) === "true") await doors.click(); // створки закрыть
  await page.locator("button, [role=button], li").filter({ hasText: name }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.getByRole("button", { name: mode, exact: true }).click().catch(() => {});
  await zoomOn();
  await page.waitForTimeout(1300);
}
/** «Приблизить выбранный корпус» — переключатель: включить, если выключен (aria-pressed). */
async function zoomOn() { const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "true")) !== "true") await z.click().catch(() => {}); }
async function frontZoom() {
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await zoomOn();
  await page.waitForTimeout(1200);
}
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const esc = async () => { for (let k = 0; k < 3 && (await menuOpen()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(80); } };
const item = (label: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") }) }).first();
/** ПКМ по детали с заголовком меню re: проход снизу вверх по вертикали в центре сцены. */
async function rclickPart(re: RegExp, x?: number): Promise<boolean> {
  await esc(); await page.keyboard.press("Escape"); await page.waitForTimeout(200); // снять выделение детали (плашка внизу сцены)
  await page.getByRole("button", { name: "Выбрать", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
  // Esc снял и выбор корпуса — выбрать шкаф в списке проекта слева и приблизить: корпус по центру сцены
  await view(/Для одежды\s*800 × 2000/);
  // сцена — самый большой canvas (у палитры и превью свои маленькие)
  const c = (await page.evaluate(() => [...document.querySelectorAll("canvas")].map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })).sort((a, b) => b.width * b.height - a.width * a.height)[0])), seen = new Set<string>();
  console.log("     (сцена " + JSON.stringify(c) + ")");
  for (let y = c.y + c.height - 40; y > c.y + 60; y -= 5) {
    await page.mouse.click(x ?? c.x + c.width * 0.5, y, { button: "right" }); await page.waitForTimeout(160);
    const t = await title(); if (t) seen.add(t);
    if (re.test(t)) return true; await esc();
  }
  console.log("     (ПКМ: заголовки меню по пути — " + [...seen].join(" | ") + ")");
  if (process.env.FD_DEBUG) { await page.mouse.click(c.x + c.width / 2, c.y + c.height * 0.7, { button: "right" }); await page.waitForTimeout(500); await shot("rmb-debug"); }
  return false;
}
try {
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(3000);
  await page.evaluate(() => localStorage.setItem("studio-tip-rmb", "1"));
  // ── правка 1: комод из палитры ──
  await addFromPalette("Комод", 600, 850, 550);
  await frontZoom(); await shot("komod-palette");
  let p = await saved(), k = mod(p, 0);
  const k0 = faces(k);
  note(`Комод 600×850 со старта: фасады ${hs(k0)} мм (снизу вверх)`);
  if (!base) check("комод со старта: фасады равные (разброс ≤ 1 мм)", spread(k0) <= 1, hs(k0));
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await openSet("Наполнение", "Ящики");
  await click(btn("Добавить: Ящики")); p = await saved(); k = mod(p, 0);
  note(`«+» ящик: ${k.sections[0].drawers} ящ., фасады ${hs(faces(k))}`);
  if (!base) check("«+» в полный комод: 4 ящика, снова поровну до крыши", k.sections[0].drawers === 4 && spread(faces(k)) <= 1 && Math.abs(hi(faces(k).at(-1)!) - facadeTop(k)) < 0.1, hs(faces(k)));
  await view(/Комод\s*600 ×/); await shot("komod-plus");
  await openSet("Наполнение", "Ящики");
  await click(btn("Уменьшить: Ящики")); await click(btn("Уменьшить: Ящики")); p = await saved(); k = mod(p, 0);
  note(`«−» два раза: ${k.sections[0].drawers} ящ., фасады ${hs(faces(k))}`);
  if (!base) check("«−»: 2 ящика, равные, до крыши", k.sections[0].drawers === 2 && spread(faces(k)) <= 1 && Math.abs(hi(faces(k).at(-1)!) - facadeTop(k)) < 0.1, hs(faces(k)));
  await click(btn("Добавить: Ящики"));
  await openSet("Корпус и размещение", "Габариты");
  await type(field("Высота"), 1000); p = await saved(); k = mod(p, 0);
  note(`высота 1000: ${k.sections[0].drawers} ящ., фасады ${hs(faces(k))}`);
  if (!base) check("высота комода 1000: фасады снова равные", spread(faces(k)) <= 1 && Math.abs(lo(faces(k)[0]) - facadeBottom(k)) < 0.1, hs(faces(k)));
  await view(/Комод\s*600 ×/); await shot("komod-1000");

  // ── правка 3: ящики в накладку ──
  await addFromPalette("Для одежды", 800, 2000, 600);
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  await openSet("Наполнение", "Ящики");
  await click(btn("Добавить: Ящики")); await click(btn("Добавить: Ящики"));
  p = await saved(); let w = mod(p, 1);
  const door0 = parts(w).find((x) => x.role === "door")!;
  note(`шкаф 800×2000, 2 ящика за дверью: дверь ${Math.round(door0.size[1])} мм, фасады ящиков ${hs(faces(w))} (вкладные, за дверью)`);
  await view(/Для одежды\s*800 × 2000/); await shot("wardrobe-behind");
  if (!base) {
    await openSet("Наполнение", "Ящики");
    await pick(sel("Фасады ящиков"), "В накладку");
    p = await saved(); w = mod(p, 1);
    const ps = parts(w), door = ps.find((x) => x.role === "door")!, fs = faces(w), hinges = ps.filter((x) => x.id.includes(":hingecup:"));
    note(`в накладку: дверь ${Math.round(door.size[1])} мм (было ${Math.round(door0.size[1])}), фасады ящиков ${hs(fs)}, петель ${hinges.length}`);
    check("в накладку: фасады ящиков в плоскости двери", fs.every((f) => Math.abs(f.position[2] - door.position[2]) < 0.1));
    check("в накладку: дверь над ящиками через зазор 2 мм", Math.abs(lo(door) - hi(fs.at(-1)!) - 2) < 0.1, `${Math.round(lo(door) - hi(fs.at(-1)!))} мм`);
    check("в накладку: фасады ящиков равные, нижний до цоколя", spread(fs) <= 1 && Math.abs(lo(fs[0]) - facadeBottom(w)) < 0.1, hs(fs));
    check("петли — в пределах новой двери", hinges.length > 0 && hinges.every((x) => x.position[1] > lo(door) && x.position[1] < hi(door)), hinges.map((x) => Math.round(x.position[1])).join(", "));
    await view(/Для одежды\s*800 × 2000/); await shot("wardrobe-overlay");
    await view(/Для одежды\s*800 × 2000/, "3D"); await shot("wardrobe-overlay-3d");
    await frontZoom();
    // ПКМ по фасаду ящика → «За дверью» → снова «В накладку»
    const hit = await rclickPart(/^Ящик \d/);
    check("ПКМ по фасаду ящика открывает меню ящика", hit, await title());
    if (hit) { await shot("drawer-menu"); const has = (await item("За дверью").count()) > 0; check("в меню ящика пункт «За дверью»", has); if (has) await click(item("За дверью")); }
    p = await saved(); w = mod(p, 1);
    check("ПКМ «За дверью»: дверь снова во всю высоту, ящики за дверью", !w.sections[0].externalDrawers && Math.abs(parts(w).find((x) => x.role === "door")!.size[1] - door0.size[1]) < 0.1);
    await shot("wardrobe-behind-again");
    await openSet("Наполнение", "Ящики"); await pick(sel("Фасады ящиков"), "В накладку");
    p = await saved(); w = mod(p, 1);
    check("панель «Фасады ящиков: в накладку» — снова накладные", !!w.sections[0].externalDrawers && Math.abs(parts(w).find((x) => x.role === "door")!.size[1] - 1524) < 0.1);
  }

  // ── правка 2: антресоль, один выкатной ящик на всю секцию ──
  await openSet("Корпус и размещение", "Габариты");
  await click(btn(/Антресоль сверху на этот корпус/));
  p = await saved(); let a = mod(p, 2);
  note(`антресоль ${a.width}×${a.height}×${a.depth}: двери ${parts(a).filter((x) => x.role === "door").length}, ящиков ${a.sections[0].drawers}`);
  await view(/Антресоль\s*800 × 600/); await shot("antresol-start");
  if (!base) {
    await openSet("Наполнение", "Ящики");
    await click(btn("Один выкатной ящик на всю секцию"));
    p = await saved(); a = mod(p, 2);
    const ps = parts(a), f = faces(a)[0], side = ps.find((x) => /:drawer:0:left$/.test(x.id));
    check("антресоль: 1 ящик, двери и петель в секции нет", a.sections[0].drawers === 1 && !ps.some((x) => x.role === "door" || x.role === "hinge"));
    check("фасад ящика на всю секцию (низ — верх фасадов)", !!f && Math.abs(lo(f) - facadeBottom(a)) < 0.1 && Math.abs(hi(f) - facadeTop(a)) < 0.1, f ? `${Math.round(f.size[0])}×${Math.round(f.size[1])}` : "");
    note(`короб ${side ? Math.round(side.size[1]) : "?"} мм по высоте, направляющие ${a.sections[0].drawerConfigs?.[0]?.length} мм при глубине ${a.depth}`);
    const e = estimate(p), kits = e.lines.filter((l) => l.id.startsWith("slide:"));
    note("смета, направляющие: " + kits.map((l) => `${l.label} — ${l.quantity} ${l.unit}`).join("; "));
    check("смета: направляющие комплектами, по комплекту на ящик", kits.every((l) => l.unit === "компл") && kits.reduce((s, l) => s + l.quantity, 0) === p.modules.reduce((s, x) => s + x.module.sections.reduce((t, q) => t + q.drawers, 0), 0));
    await view(/Антресоль\s*800 × 600/); await shot("antresol-drawer");
    await view(/Антресоль\s*800 × 600/, "3D"); await shot("antresol-drawer-3d");
  }
  check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) { check("сценарий дошёл до конца", false, (e as Error).message); await shot("error"); }
writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 1));
await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log(bad ? `ПРОВАЛОВ: ${bad}` : "сценарий: всё OK");
process.exit(bad ? 1 : 0);
