// Физика расстановки мышью (запросы Макса 31.10.2026), как менеджер:
//   npx tsx scripts/physics-3110-scenario.ts <url> [outDir=../qa-phys3110/scenario]
// Помещение 4000 × 3000 × 2700. «А» и «Б» — шкафы 600 у задней стены, «В» — шкаф перед «Б» (тесно для поворота), «Н» — навесной 600×700×300
// у задней стены на 1400, «Ф» — шкаф на ножках, висящий в воздухе на 300 (старый проект), окно 600 на задней стене справа.
//  1. Опора: старый проект открылся; в «Проверьте расстановку» — «Ф висит в воздухе» с кнопкой «Поставить на пол» → на полу.
//     «Н» сверху тянем в комнату — остаётся спиной к стене, едет вдоль неё; к правой стене — повешен на неё, лицом в комнату.
//     «А» спереди тянем вверх — не взлетает (на полу).
//  2. Поворот R у «Б» (впереди «В» — на месте не помещается) — повёрнут и сдвинут в ближайшее свободное место, сообщение «сдвинут на N мм».
//  3. Быстрая тяга: в 3D перспективе рывком к горизонту и за холст (шаг 1–2), отпускание вне холста, две тяги подряд, «План» рывком —
//     корпус всегда внутри комнаты, без отказа и без «улёта»; на «Плане» итог — точно по месту отпускания.
//  5. Окно: на виде спереди тянем влево и вверх (шаг 10, подоконник), Ctrl+Z — одна отмена; набор «3200;1000» + Enter; на «Плане» — к краю стены.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, type Module } from "../src/model";
import { newProject, type PlacedModule, type Project } from "../src/project";

const [url = "http://127.0.0.1:8467/?fresh=1", out = "../qa-phys3110/scenario"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(10000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png`, timeout: 60000 }); };
type Arr = { id: string; x: number; z: number; y: number; w: number; d: number; h: number; r: number };
const arr = async () => (await page.evaluate("window.__arrangement && window.__arrangement()")) as Arr[];
const one = async (id: string) => (await arr()).find((a) => a.id === id)!;
const scr = (x: number, y: number, z: number) => page.evaluate(([x, y, z]) => (window as unknown as { __toScreen: (x: number, y: number, z: number) => { x: number; y: number } }).__toScreen(x, y, z), [x, y, z] as const);
const pscr = (x: number, z: number) => page.evaluate(([x, z]) => { const s = document.querySelector(".room-plan svg") as SVGSVGElement, m = s.getScreenCTM()!, q = new DOMPoint(x, z).matrixTransform(m); return { x: q.x, y: q.y }; }, [x, z] as const);
const room = async () => (await page.evaluate("window.__room && window.__room()")) as Project["room"] | undefined;
const errorText = async () => (await page.locator(".error-banner:not(.place-note)").allInnerTexts().catch(() => [] as string[])).join(" | ");
const noteText = async () => (await page.getByTestId("studio-note").allInnerTexts().catch(() => [] as string[])).join(" | ");
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(1300); };
async function drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps }); await page.mouse.up(); await page.waitForTimeout(350); }
async function typeKeys(text: string) { for (const ch of text) { await page.keyboard.press(ch === ";" ? "Semicolon" : ch); await page.waitForTimeout(30); } }
const inside = (a: Arr, W = 4000, D = 3000) => { const rot = ((a.r % 360) + 360) % 360, w = rot % 180 ? a.d : a.w, d = rot % 180 ? a.w : a.d; return a.x >= -25 && a.z >= -25 && a.x + w <= W + 25 && a.z + d <= D + 25; };

const box = (name: string, w: number, h: number, d: number, extra: Partial<Module> = {}): Module => { const m = initialModule(); return { ...m, name, width: w, height: h, depth: d, sections: m.sections.map((s) => ({ ...s, shelves: [], rod: false })), ...extra }; };
const place = (id: string, m: Module, x: number, z: number, y = 0, rotation = 0): PlacedModule => ({ id, x, z, y, rotation, module: m });
const model: Project = (() => {
  const p = newProject(); p.room = { width: 4000, depth: 3000, height: 2700, openings: [{ id: "win", type: "window", wall: "back", offset: 3150, width: 600, height: 1200, sill: 900 }] };
  p.modules = [place("a", box("А", 600, 2000, 550), 300, 3), place("b", box("Б", 600, 2000, 550), 2400, 3), place("c", box("В", 600, 2000, 550), 2400, 610),
    place("h", box("Н", 600, 700, 300, { hanging: true, plinthHeight: 0 }), 1100, 3, 1400), place("f", box("Ф", 600, 1800, 500, { feet: { height: 100 } }), 1300, 1700, 300)];
  return p;
})();

await page.goto(url, { timeout: 60000 });
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(model));
await page.goto(url, { timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(2000);
check("0. старый проект с висящим шкафом открылся без ошибки", (await arr()).length === 5 && !(await errorText()), await errorText());
await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click();

// ── 1. опора ──
{
  await page.locator(".room-warning-link").first().click().catch(() => {}); await page.waitForTimeout(600);
  const fix = page.getByTestId("support-fix").first();
  const has = await fix.count();
  check("1а. предупреждение «висит в воздухе» с кнопкой «Поставить на пол»", has > 0 && /Поставить на пол/.test(await fix.innerText().catch(() => "")), String(has));
  if (has) { await fix.evaluate((el) => (el as HTMLButtonElement).click()); await page.waitForTimeout(600); }
  const f = await one("f");
  check("1а. «Ф» поставлен на пол одним щелчком (y = 0, x/z на месте)", f.y === 0 && f.x === 1300 && f.z === 1700, JSON.stringify(f));
  await shot("support-fixed");
}
await view("Сверху");
{
  const h = await one("h"), s = await scr(h.x + 300, h.y + 700, h.z + 150), t = await scr(h.x + 300 + 500, h.y + 700, h.z + 150 + 700);
  await drag(s, t);
  const n = await one("h");
  check("1б. навесной «Н» тянем в комнату — остаётся спиной к задней стене (z = 3), едет вдоль неё", n.z === 3 && Math.abs(n.x - (h.x + 500)) <= 40 && n.r === 0, JSON.stringify(n));
  const s2 = await scr(n.x + 300, n.y + 700, n.z + 150), t2 = await scr(3850, n.y + 700, 1500);
  await drag(s2, t2, 12);
  const m = await one("h");
  check("1б. «Н» к правой стене — повешен на неё лицом в комнату (поворот 270, спина у стены)", m.r === 270 && Math.abs(m.x + m.d + 3 - 4000) <= 5, JSON.stringify(m));
  check("1б. ошибок нет", !(await errorText()), await errorText());
  await shot("hanging-right-wall");
}
await view("Спереди");
{
  const a = await one("a"), s = await scr(a.x + 300, 1000, a.z + 560), t = { x: s.x, y: s.y - 250 };
  await drag(s, t);
  const n = await one("a");
  check("1в. шкаф «А» спереди тянем вверх — не взлетает (на полу)", n.y === 0, JSON.stringify(n));
}
// ── 2. поворот без места ──
{
  await view("Сверху");
  const b = await one("b"), s = await scr(b.x + 300, 2000, b.z + 200);
  await page.mouse.click(s.x, s.y); await page.waitForTimeout(400);
  await page.keyboard.press("r"); await page.waitForTimeout(800);
  const n = await one("b"), note = await noteText();
  check("2. R у «Б» (впереди «В») — повёрнут и сдвинут в ближайшее свободное место", (n.r === 270 || n.r === 90) && (n.x !== b.x || n.z !== b.z) && !(await errorText()), JSON.stringify(n) + " " + (await errorText()));
  check("2. сообщение «сдвинут на N мм»", /сдвинут на \d+ мм/.test(note), note);
  await shot("rotate-nearest");
  await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
  const u = await one("b");
  check("2. Ctrl+Z — одной отменой обратно", u.r === 0 && u.x === b.x && u.z === b.z, JSON.stringify(u));
}
// ── 3. быстрая тяга ──
await view("3D");
{
  const vp = page.viewportSize()!;
  let bad = 0, rej = 0, log = "";
  for (const [dx, dy, steps] of [[520, -330, 1], [-760, 220, 2], [320, -460, 1], [900, 120, 1], [-220, -620, 2], [60, 420, 1]] as const) {
    const a = await one("a"), rot = ((a.r % 360) + 360) % 360, c = rot % 180 ? { x: a.x + a.d / 2, z: a.z + a.w / 2 } : { x: a.x + a.w / 2, z: a.z + a.d / 2 };
    const s = await scr(c.x, 1900, c.z);
    await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(Math.max(1, Math.min(vp.width - 1, s.x + dx)), Math.max(1, Math.min(vp.height - 1, s.y + dy)), { steps }); await page.mouse.up(); await page.waitForTimeout(300);
    const n = await one("a"), e = await errorText();
    if (!inside(n)) bad++; if (e) rej++;
    log += `${dx},${dy}→${n.x}/${n.z}/r${n.r}${e ? " ОТКАЗ" : ""}; `;
  }
  check("3а. рывки в перспективе к горизонту и в сторону — корпус всегда в комнате", bad === 0, log);
  check("3а. рывки без отказа «выходит за границы» (корпус не «улетает» назад)", rej === 0, log);
  await shot("fast-iso");
}
{
  // отпускание вне холста (над левой панелью)
  const a = await one("a"), rot = ((a.r % 360) + 360) % 360, c = rot % 180 ? { x: a.x + a.d / 2, z: a.z + a.w / 2 } : { x: a.x + a.w / 2, z: a.z + a.w / 2 };
  const s = await scr(c.x, 1900, c.z);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(60, s.y, { steps: 2 }); await page.mouse.up(); await page.waitForTimeout(400);
  const n = await one("a");
  check("3б. отпустили над панелью вне холста — корпус в комнате, без отказа", inside(n) && !(await errorText()), JSON.stringify(n) + " " + (await errorText()));
}
await view("Сверху");
{
  // две тяги подряд без паузы: вторая — от места первой
  const b = await one("b"), s = await scr(b.x + 300, 2000, b.z + 275), mid = await scr(b.x + 300 - 900, 2000, b.z + 275 + 900), end = await scr(b.x + 300 - 900 + 200, 2000, b.z + 275 + 900 + 200);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(mid.x, mid.y, { steps: 1 }); await page.mouse.up();
  await page.mouse.move(mid.x, mid.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 1 }); await page.mouse.up(); await page.waitForTimeout(500);
  const n = await one("b");
  check("3в. две быстрые тяги подряд — вторая продолжает первую", Math.abs(n.x - (b.x - 700)) <= 40 && Math.abs(n.z - (b.z + 1100)) <= 40 && !(await errorText()), `${b.x}/${b.z} → ${n.x}/${n.z} ${await errorText()}`);
}
{
  // красный след и причина у курсора: «Б» тянем в «В» (глубоко, места рядом нет) — плашка красная, отпустили — «Б» на прежнем месте
  const b = await one("b"), c = await one("c"), s = await scr(b.x + 300, 2000, b.z + 275), t = await scr(c.x + 300, 2000, c.z + 275);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(t.x, t.y, { steps: 6 }); await page.waitForTimeout(250);
  const red = await page.locator(".drag-badge.invalid").innerText().catch(() => "");
  await shot("red-footprint");
  await page.mouse.up(); await page.waitForTimeout(500);
  const n = await one("b");
  check("3д. тянем в соседа — плашка красная с причиной «пересекается»", /пересекается/.test(red), red);
  check("3д. отпустили на красном — корпус на прежнем месте", n.x === b.x && n.z === b.z, JSON.stringify(n));
  await page.locator(".error-banner button[aria-label=\"Закрыть сообщение\"]").first().click().catch(() => {});
}
await view("План");
{
  const b = await one("b"), s = await pscr(b.x + 300, b.z + 275), t = await pscr(b.x + 300 + 400, b.z + 275 + 300);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(t.x, t.y, { steps: 1 }); await page.mouse.up(); await page.waitForTimeout(500);
  const n = await one("b");
  check("3г. «План», рывок одним шагом и сразу отпустили — корпус ровно там, где отпустили", Math.abs(n.x - (b.x + 400)) <= 30 && Math.abs(n.z - (b.z + 300)) <= 30, `${b.x}/${b.z} → ${n.x}/${n.z}`);
  const s2 = await pscr(n.x + 300, n.z + 275), t2 = await pscr(-5000, 2500);
  await page.mouse.move(s2.x, s2.y); await page.mouse.down(); await page.mouse.move(t2.x, t2.y, { steps: 1 }); await page.mouse.up(); await page.waitForTimeout(500);
  const m = await one("b");
  check("3г. «План», рывок далеко за стену — корпус упёрся в стену", inside(m) && !(await errorText()), JSON.stringify(m) + " " + (await errorText()));
  await shot("plan-fast");
  // критик 31.10: потерянный pointerup на «Плане» (pointermove с buttons = 0) — тяга кончается на этом месте, без «Maximum call stack»
  {
    const f0 = await one("f"), s3 = await pscr(f0.x + 300, f0.z + 250), t3 = await pscr(f0.x + 300 + 300, f0.z + 250);
    await page.mouse.move(s3.x, s3.y); await page.mouse.down(); await page.mouse.move(t3.x - 40, t3.y, { steps: 3 });
    await page.evaluate(([x, y]) => { const s = document.querySelector(".room-plan svg")!; s.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, buttons: 0, pointerType: "mouse", pointerId: 1, isPrimary: true })); }, [t3.x, t3.y] as const);
    await page.waitForTimeout(400); await page.mouse.up(); await page.waitForTimeout(300);
    const f1 = await one("f");
    check("3е. «План»: отпускание потерялось (buttons = 0) — тяга кончилась на месте, без ошибки стека", !errors.some((x) => /call stack/i.test(x)) && Math.abs(f1.x - (f0.x + 300)) <= 30 && f1.r === f0.r, `${f0.x} → ${f1.x} r${f1.r} ${errors.join(" | ")}`);
  }
  // критик 31.10: шкаф у стены боком не разворачивается при тяге — «Ф» тянем к левой стене, поворот прежний
  {
    const f0 = await one("f"), s4 = await pscr(f0.x + 300, f0.z + 250), t4 = await pscr(330, f0.z + 250);
    await page.mouse.move(s4.x, s4.y); await page.mouse.down(); await page.mouse.move(t4.x, t4.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(400);
    const f1 = await one("f");
    check("3ж. «План»: шкаф подведён к левой стене боком — не развернулся", f1.r === f0.r && f1.x < f0.x, `${f0.x}/r${f0.r} → ${f1.x}/r${f1.r}`);
  }
}
// ── 5. окно мышью ── (исходная расстановка заново: окно не закрыто корпусами, переставленными выше)
await page.goto(url, { timeout: 60000 }); await page.waitForSelector("canvas", { timeout: 60000 }); // чистая загрузка без правок — уход со страницы не сохранит прежнюю расстановку поверх
await page.evaluate((raw) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(model));
await page.goto(url, { timeout: 60000 }); await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click();
await view("Спереди");
{
  const r0 = (await room())!, w0 = r0.openings!.find((o) => o.id === "win")!;
  const s = await scr(w0.offset + 300, w0.sill + 900, 0), t = await scr(w0.offset + 300 - 437, w0.sill + 900 + 123, 0);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(t.x, t.y, { steps: 8 }); await page.waitForTimeout(150);
  const wb = await page.locator(".drag-badge").innerText().catch(() => "");
  await page.mouse.up(); await page.waitForTimeout(400);
  check("5а. у курсора — «от угла · от пола»", /от угла · \d+ от пола/.test(wb), wb);
  const w1 = (await room())!.openings!.find((o) => o.id === "win")!;
  check("5а. окно на виде спереди тянется влево и вверх (шаг 10 мм)", w1.offset < w0.offset - 300 && w1.sill > w0.sill + 80 && w1.offset % 10 === 0 && w1.sill % 10 === 0, `${w0.offset}/${w0.sill} → ${w1.offset}/${w1.sill}`);
  await shot("window-dragged");
  await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
  const w2 = (await room())!.openings!.find((o) => o.id === "win")!;
  check("5а. Ctrl+Z — одной отменой на место", w2.offset === w0.offset && w2.sill === w0.sill, `${w2.offset}/${w2.sill}`);
  const s3 = await scr(w0.offset + 300, w0.sill + 900, 0);
  await page.mouse.move(s3.x, s3.y); await page.mouse.down(); await page.mouse.move(s3.x - 20, s3.y - 10, { steps: 3 }); await page.waitForTimeout(150);
  await typeKeys("3200;1000"); await page.keyboard.press("Enter"); await page.mouse.up(); await page.waitForTimeout(500);
  const w3 = (await room())!.openings!.find((o) => o.id === "win")!;
  check("5б. набор «3200;1000» + Enter — окно ровно 3200 от угла и 1000 от пола", w3.offset === 3200 && w3.sill === 1000, `${w3.offset}/${w3.sill}`);
  {
    const s5 = await scr(3200 + 300, 1000 + 600, 0);
    await page.mouse.move(s5.x, s5.y); await page.mouse.down(); await page.mouse.move(s5.x - 20, s5.y - 10, { steps: 3 }); await page.waitForTimeout(150);
    await typeKeys("3900;2000"); await page.waitForTimeout(150);
    const live = await page.locator(".drag-badge").innerText().catch(() => "");
    await page.keyboard.press("r"); await page.keyboard.press("Enter"); await page.mouse.up(); await page.waitForTimeout(500);
    const w4 = (await room())!.openings!.find((o) => o.id === "win")!;
    check("5б. набор «3900;2000» — сразу в пределах стены и потолка (3400 от угла, 1500 от пола), R во время тяги не поворачивает", w4.offset === 3400 && w4.sill === 1500 && /3400 от угла · 1500 от пола/.test(live) && (await arr()).every((a) => a.r === 0 || a.id === "h"), `${w4.offset}/${w4.sill} «${live}»`);
  }
}
await view("План");
{
  const w = (await room())!.openings!.find((o) => o.id === "win")!;
  const s = await pscr(w.offset + w.width / 2, 10), t = await pscr(4000 - w.width / 2 + 25, 10);
  await drag(s, t);
  const w2 = (await room())!.openings!.find((o) => o.id === "win")!;
  check("5в. «План»: окно у края стены — привязка к углу (до угла 0)", w2.offset + w2.width === 4000, `${w.offset} → ${w2.offset}`);
  await shot("window-plan");
}
check("ошибок страницы нет", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r[1]);
console.log(`\nИтог: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
