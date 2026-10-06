// Аудит вёрстки: npx tsx scripts/overflow-audit.ts <url> <project.json> <outDir> [widths] [stages]
// На каждой ширине и каждом этапе ищет видимые элементы, которые вылезают за рамку своего блока (кнопки, поля, подписи),
// и текст шире своей кнопки. Печатает список и снимает скриншоты. Код проверки передаётся строкой (tsx ломает функции в evaluate).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out, widthsArg, stagesArg] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const widths = (widthsArg ?? "1600,1440,1280,1100,1024,900,768,600,400").split(",").map(Number);
const stages = (stagesArg ?? "room,fixtures,bodies,filling,facades,docs").split(",");
const auditCode = (modal: boolean) => `(() => {
  const MODAL = ${modal};
  const res = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0; };
  const name = (el) => { const t = (el.getAttribute("aria-label") || el.innerText || String(el.className) || el.tagName).replace(/\\s+/g, " ").trim(); return el.tagName.toLowerCase() + " «" + t.slice(0, 40) + "»"; };
  const closedDetails = (el) => { for (let d = el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) if (!d.open && !(el.closest("summary") && el.closest("summary").parentElement === d)) return true; return false; };
  const skip = (el) => el.closest(".scene, canvas, .sr-only") || closedDetails(el) || (MODAL ? !el.closest(".modal") : !!el.closest(".modal-backdrop"));
  const items = document.querySelectorAll("button, input, select, textarea, label, a, summary, h1, h2, h3, strong, small, span, p, svg, img");
  for (const el of items) {
    if (!visible(el) || skip(el)) continue;
    const r = el.getBoundingClientRect();
    let box = el.parentElement;
    while (box && box !== document.body) {
      const cs = getComputedStyle(box);
      const framed = cs.overflowX !== "visible" || (cs.borderLeftWidth !== "0px" && cs.borderLeftStyle !== "none") || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
      if (framed) break;
      box = box.parentElement;
    }
    if (!box || box === document.body) continue;
    const csb = getComputedStyle(box);
    if (csb.overflowX === "auto" || csb.overflowX === "scroll") continue;
    const b = box.getBoundingClientRect();
    const over = Math.max(b.left - r.left, r.right - b.right);
    if (over > 1.5) res.push("выходит на " + Math.round(over) + "px: " + name(el) + " из " + box.tagName.toLowerCase() + "." + String(box.className).split(" ")[0]);
  }
  for (const el of document.querySelectorAll("button, label, summary, select, h2, h3, strong")) {
    if (!visible(el) || skip(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
    if (el.scrollWidth > el.clientWidth + 2) res.push("текст шире блока на " + (el.scrollWidth - el.clientWidth) + "px: " + name(el));
  }
  // 3) Кнопки/поля перекрывают друг друга (панель инструментов поверх колонки иконок и т.п.)
  // только то, что реально видно в окне прокручиваемой панели
  const inView = (el) => { const r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight) return false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX)) { const b = p.getBoundingClientRect(); if (r.top < b.top - 1 || r.bottom > b.bottom + 1) return false; } } return true; };
  const ctl = [...document.querySelectorAll("button, input:not([type=checkbox]):not([type=radio]), select, textarea, a, summary")].filter((el) => visible(el) && !skip(el) && inView(el) && !el.parentElement.closest("button, a, summary"));
  const rects = ctl.map((el) => el.getBoundingClientRect());
  const hidden = (el, r) => { const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, x)), Math.min(innerHeight - 1, Math.max(0, y))); return top && top !== el && !el.contains(top) && !top.contains(el); };
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = rects[i], b = rects[j];
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 3 && iy > 3 && a.bottom > 0 && b.bottom > 0 && a.top < innerHeight && b.top < innerHeight) res.push("перекрываются " + Math.round(ix) + "×" + Math.round(iy) + "px: " + name(ctl[i]) + " и " + name(ctl[j]));
  }
  // 4) Текст или иконка залезает на рамку кнопки (нет внутреннего отступа)
  for (const el of ctl) {
    if (!["BUTTON", "SUMMARY", "A"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.borderLeftStyle === "none" && cs.backgroundColor === "rgba(0, 0, 0, 0)") continue;
    const inner = { l: r.left + parseFloat(cs.borderLeftWidth) + 1, r: r.right - parseFloat(cs.borderRightWidth) - 1 };
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(n); parts.push(...rg.getClientRects()); }
    for (const s of el.querySelectorAll("svg, img")) parts.push(s.getBoundingClientRect());
    const bad = parts.some((p) => p.width > 0 && (p.left < inner.l - 0.5 || p.right > inner.r + 0.5));
    if (bad) res.push("текст/иконка на рамке: " + name(el));
  }
  // 5) Элемент закрыт другим элементом (центр кнопки указывает на чужой элемент)
  for (let i = 0; i < ctl.length; i++) { const r = rects[i]; if (r.top >= 0 && r.bottom <= innerHeight && hidden(ctl[i], r)) { const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); res.push("закрыт другим элементом: " + name(ctl[i]) + " ← " + (top ? top.tagName.toLowerCase() + "." + String(top.className).split(" ")[0] : "?")); } }
  // 6) Подписи размеров в 3D не налезают друг на друга
  const dims = [...document.querySelectorAll(".model-dimension")].filter((el) => visible(el) && getComputedStyle(el).visibility !== "hidden").map((el) => [el, el.getBoundingClientRect()]);
  for (let i = 0; i < dims.length; i++) for (let j = i + 1; j < dims.length; j++) { const a = dims[i][1], b = dims[j][1]; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 2 && iy > 2) res.push("подписи размеров налезают: «" + dims[i][0].textContent + "» и «" + dims[j][0].textContent + "»"); }
  // 7) Нижняя панель в одну строку на ПК и планшете
  const bar = document.querySelector(".dock-bar"); if (bar && innerWidth > 700 && bar.getBoundingClientRect().height > 60) res.push("нижняя панель переносится на вторую строку");
  if (innerWidth >= 700) for (const s of document.querySelectorAll(".stage-steps, .dock-tabs, .output-tabs")) if (visible(s) && s.scrollWidth > s.clientWidth + 2) res.push("часть кнопок спрятана прокруткой: " + String(s.className).split(" ")[0]);
  if (document.documentElement.scrollWidth > innerWidth + 1) res.push("страница шире окна на " + (document.documentElement.scrollWidth - innerWidth) + "px");
  return [...new Set(res)];
})()`;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let total = 0;
for (const w of widths) {
  for (const stage of stages) {
    const page = await browser.newPage({ viewport: { width: w, height: w < 700 ? 860 : 900 } });
    await page.goto(url);
    await page.evaluate(([raw, st]) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", st); localStorage.setItem("studio-dock", "project"); }, [project, stage]);
    await page.goto(url);
    await page.waitForSelector(".app");
    await page.waitForTimeout(1500);
    for (let k = 0; k < 3 && await page.locator(".modal-backdrop").count(); k++) { await page.keyboard.press("Escape"); await page.locator(".modal-backdrop button[aria-label='Закрыть окно']").first().click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(300); }
    const issues = (await page.evaluate(auditCode(false))) as string[];
    total += issues.length;
    if (issues.length) console.log(`\n== ${w}px · ${stage}: ${issues.length}\n  ` + issues.slice(0, 30).join("\n  ") + (issues.length > 30 ? `\n  … ещё ${issues.length - 30}` : ""));
    await page.screenshot({ path: `${out}/audit-${w}-${stage}.png` });
    await page.close();
  }
}
// Окна и нижняя панель: на нескольких ширинах открываем каждое окно и вкладку и проверяем их содержимое.
const report = (w: number, what: string, issues: string[]) => { total += issues.length; if (issues.length) console.log(`\n== ${w}px · ${what}: ${issues.length}\n  ` + issues.slice(0, 30).join("\n  ") + (issues.length > 30 ? `\n  … ещё ${issues.length - 30}` : "")); };
const closeModal = async (page: import("playwright").Page) => { for (let k = 0; k < 3 && await page.locator(".modal-backdrop").count(); k++) { await page.locator(".modal-backdrop button[aria-label='Закрыть окно']").first().click({ timeout: 1500 }).catch(() => page.keyboard.press("Escape")); await page.waitForTimeout(250); } };
const OPENERS: [string, string][] = [["bodies", "Выдать документы"], ["bodies", "Кабинет"], ["room", "Как пользоваться"], ["bodies", "Новый проект / восстановить"], ["bodies", "Моя библиотека модулей"], ["bodies", "Все"]];
for (const w of (widthsArg ? widths : [1440, 1100, 768, 400])) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 700 ? 860 : 900 } });
  const open = async (stage: string) => { await page.goto(url); await page.evaluate(([raw, st]) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", st); localStorage.setItem("studio-dock", "project"); }, [project, stage]); await page.goto(url); await page.waitForSelector(".app"); await page.waitForTimeout(1300); await closeModal(page); };
  await open("bodies");
  for (const tab of ["Смета", "Фурнитура", "Детали", "Документы"]) {
    await page.locator(".dock-tabs button", { hasText: tab }).click();
    await page.waitForTimeout(900);
    report(w, "нижняя панель · " + tab, (await page.evaluate(auditCode(false))) as string[]);
    await page.screenshot({ path: `${out}/audit-${w}-dock-${tab}.png` });
  }
  await page.locator(".dock-tabs button", { hasText: "Проект" }).click();
  let stageNow = "bodies";
  for (const [stage, label] of OPENERS) {
    if (stage !== stageNow) { await open(stage); stageNow = stage; }
    const btn = page.getByRole("button", { name: label, exact: true }).filter({ visible: true }).first();
    if (!(await btn.count())) { console.log(`\n-- ${w}px: кнопка «${label}» не найдена на этапе ${stage}`); continue; }
    await btn.click().catch(() => {});
    await page.waitForTimeout(700);
    if (!(await page.locator(".modal").count())) { console.log(`\n-- ${w}px: «${label}» не открыла окно`); continue; }
    report(w, "окно «" + label + "»", (await page.evaluate(auditCode(true))) as string[]);
    await page.screenshot({ path: `${out}/audit-${w}-modal-${label.replace(/[^А-Яа-яA-Za-z]+/g, "_")}.png` });
    const tabs = page.locator(".modal .output-tabs button");
    for (let k = 1; k < await tabs.count(); k++) {
      const name = (await tabs.nth(k).innerText()).trim();
      await tabs.nth(k).click(); await page.waitForTimeout(700);
      report(w, "документы · " + name, (await page.evaluate(auditCode(true))) as string[]);
    }
    await closeModal(page);
  }
  await page.close();
}
console.log("\nИтого замечаний:", total);
await browser.close();
