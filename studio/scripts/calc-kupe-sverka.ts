/** Сверка цены дверей купе: калькулятор на сайте (web/calc, v2.11 после bake-calc-kupe.ts) = студия (src/kupe.ts kupeLines).
 *  Пять конфигураций из отчёта сверки 22.10 («Релиз 22.10\купе-цены-сверка.md»), цвет — первый в системе:
 *   1) 1500×2600, 2 двери, Стандарт, зеркало серебро 4 мм — без доводчиков и с доводчиками;
 *   2) 2400×2600, 3 двери, Стандарт, ЛДСП «Белоснежный», 2 равные секции;
 *   3) 1800×2400, 2 двери, верх зеркало / низ ЛДСП «Белоснежный» (2 равные);
 *   4) Slim line, 1600×2600, 2 двери, зеркало;   5) GRACE (подвесная), 1600×2600, 2 двери, зеркало.
 *  Калькулятор — настоящая страница в браузере: параметры ставятся функциями страницы, расчёт — её calculate(), итог — с экрана.
 *  Студия — те же функции, что смета (kupeLines + kupeLdspPerM2 с коэффициентом сметы).
 *  Запуск: npx tsx scripts/calc-kupe-sverka.ts <origin с папкой web, напр. http://127.0.0.1:8140> [out.json] → код 1 при расхождении. */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { kupeLines, kupeTotal, DEFAULT_KUPE, type KupeSpec } from "../src/kupe";
import { KUPE_SYSTEMS } from "../src/kupeData";
import { createKupeModule } from "../src/ModulePalette";
import { initialModule, validate } from "../src/model";
import { kupeLdspPerM2, MARKUP_DEFAULT } from "../src/pricing";

const [origin = "http://127.0.0.1:8140", outJson] = process.argv.slice(2);
const MIRROR = "Зеркало Серебро 4мм", LDSP = "Белоснежный";
type Cfg = { tag: string; title: string; W: number; H: number; N: number; system: string; sections: number; fills: string[][]; softClose?: boolean; report?: number };
const sys = (s: string) => KUPE_SYSTEMS.find((x) => x.system === s)!;
const same = (N: number, n: number, f: string) => Array.from({ length: N }, () => Array.from({ length: n }, () => f));
const CFGS: Cfg[] = [
  { tag: "1a", title: "1500×2600×2 Стандарт, зеркало, без доводчиков", W: 1500, H: 2600, N: 2, system: "Стандарт (Аристо)", sections: 0, fills: same(2, 1, MIRROR), report: 33547 },
  { tag: "1b", title: "1500×2600×2 Стандарт, зеркало, с доводчиками", W: 1500, H: 2600, N: 2, system: "Стандарт (Аристо)", sections: 0, fills: same(2, 1, MIRROR), softClose: true, report: 44747 },
  { tag: "2", title: "2400×2600×3 Стандарт, ЛДСП Белоснежный, 2 секции", W: 2400, H: 2600, N: 3, system: "Стандарт (Аристо)", sections: 1, fills: same(3, 2, LDSP), report: 42719 },
  { tag: "3", title: "1800×2400×2 Стандарт, верх зеркало / низ ЛДСП", W: 1800, H: 2400, N: 2, system: "Стандарт (Аристо)", sections: 1, fills: Array.from({ length: 2 }, () => [MIRROR, LDSP]), report: 32789 },
  { tag: "4", title: "1600×2600×2 Slim line, зеркало", W: 1600, H: 2600, N: 2, system: "Slim line (Аристо)", sections: 0, fills: same(2, 1, MIRROR), report: 31010 },
  { tag: "5", title: "1600×2600×2 GRACE (подвесная), зеркало", W: 1600, H: 2600, N: 2, system: "GRACE (Аристо)", sections: 0, fills: same(2, 1, MIRROR), report: 102026 },
];

function studio(c: Cfg) {
  const m = createKupeModule(c.W, c.H, initialModule());
  const s = sys(c.system);
  const door = c.fills.map((d) => d[0]);
  const k: KupeSpec = { ...DEFAULT_KUPE, doors: c.N, system: c.system, color: s.colors[0].name, fills: door, sections: c.sections, softClose: !!c.softClose };
  const sf = c.fills.map((d, i) => d.map((f) => (f === door[i] ? null : f)));
  if (sf.some((r) => r.some(Boolean))) k.sectionFills = sf;
  m.kupe = k;
  const errs = validate(m);
  const lines = kupeLines(m, (n) => kupeLdspPerM2(n, MARKUP_DEFAULT));
  return { total: kupeTotal(lines), errors: errs, lines: lines.map((l) => ({ label: l.label.replace(/^Купе · /, ""), q: l.quantity, p: l.unitPrice, sum: Math.round(l.quantity * (l.unitPrice ?? 0)) })) };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [], dialogs: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => { dialogs.push(d.message().slice(0, 120)); void d.accept(); });
await page.route((u) => !u.href.startsWith(origin), (r) => r.abort()); // шрифты CDN без сети не ждём
await page.goto(origin + "/calc/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#width");
const rows: Record<string, unknown>[] = [];
let bad = 0;
for (const c of CFGS) {
  const st = studio(c);
  const calc = await page.evaluate(`(function (c) {
    var $ = function (id) { return document.getElementById(id); };
    var PS = PROFILE_SYSTEMS, FL = FILLINGS;
    $("width").value = String(c.W); $("height").value = String(c.H);
    $("doorCount").value = String(c.N); onDoorCountChange(); if (typeof updateChipsActive === "function") updateChipsActive(c.N);
    var si = PS.findIndex(function (s) { return s.system === c.system; });
    $("profileFamily").value = PS[si].family; populateProfileSystemsForFamily(PS[si].family);
    $("profileSystem").value = String(si); populateProfileColors(si); $("profileColor").value = "0";
    setSections(c.sections);
    c.fills.forEach(function (d, di) { d.forEach(function (n, sj) { var f = FL.find(function (x) { return x.n === n; }); if (!f) throw new Error("нет наполнения " + n); doorFills[di][sj] = f; }); });
    $("softClose").checked = !!c.softClose;
    calculate();
    var d = window._lastCalcData;
    var hero = ((document.querySelector("#resultContent .kupe-hero-price") || {}).textContent || "").replace(/\\D/g, "");
    var spec = Array.from(document.querySelectorAll("#resultContent .kupe-spec-list .kupe-spec-row .kupe-spec-price")).map(function (e) { return e.textContent || ""; }).filter(function (s) { return /₽/.test(s); });
    var specSum = spec.slice(0, -1).reduce(function (a, s) { return a + Number(s.replace(/\\D/g, "")); }, 0);
    return d ? { total: d.total, hero: Number(hero), specSum: specSum, doorW: d.doorW, prof: d.profRows.map(function (r) { return { n: r.n, l: r.l, pr: r.pr, c: Math.round(r.c) }; }), fill: Math.round(d.filCost), soft: d.softCloseCost, complex: d.complexCost, profile: PS[si].system + " · " + PS[si].colors[0].name } : null;
  })(${JSON.stringify(c)})`) as { total: number; hero: number; specSum: number; doorW: number; prof: { n: string; l: number; pr: number; c: number }[]; fill: number; soft: number; complex: number; profile: string } | null;
  if (!calc) { bad++; rows.push({ cfg: c.title, error: "калькулятор не посчитал", dialogs: dialogs.slice(-2) }); console.log(`FAIL ${c.tag} ${c.title}: калькулятор не посчитал (${dialogs.slice(-1)[0] ?? ""})`); continue; }
  const calcTotal = Math.round(calc.total), diff = calcTotal - st.total;
  const ok = diff === 0 && calc.hero === calcTotal && calc.specSum === calcTotal && st.errors.length === 0;
  if (!ok) bad++;
  rows.push({ tag: c.tag, cfg: c.title, studio: st.total, calc: calcTotal, hero: calc.hero, specSum: calc.specSum, diff, report: c.report, doorW: calc.doorW, profile: calc.profile, studioErrors: st.errors, studioLines: st.lines, calcProfile: calc.prof, calcFill: calc.fill });
  console.log(`${ok ? "OK  " : "FAIL"} ${c.tag} ${c.title}: студия ${st.total.toLocaleString("ru-RU")} ₽, калькулятор ${calcTotal.toLocaleString("ru-RU")} ₽ (на экране ${calc.hero.toLocaleString("ru-RU")}, сумма строк ${calc.specSum.toLocaleString("ru-RU")}), разница ${diff}; отчёт 22.10: ${c.report?.toLocaleString("ru-RU")}${st.errors.length ? "; ошибки студии: " + st.errors.join(" | ") : ""}`);
}
if (errors.length) { bad++; console.log("ошибки страницы: " + errors.slice(0, 3).join(" | ")); }
if (dialogs.length) console.log("окна страницы: " + dialogs.join(" | "));
if (outJson) writeFileSync(outJson, JSON.stringify({ origin, rows, errors, dialogs }, null, 1), "utf8");
console.log(bad ? `сверка: ${bad} расхождени(е/я)` : `сверка: ${CFGS.length} из ${CFGS.length} — калькулятор = студия до рубля`);
await browser.close();
process.exit(bad ? 1 : 0);
