/** bake-calc-kupe.ts — калькулятор дверей-купе на сайте (web/calc) = калькулятор купе v2.10/2.11, отданный магазину
 *  (решение Макса 23.10.2026: прайс дверей купе общий — v2.10, цены −20 % к прайсу 29.04).
 *
 *  Источник (только чтение): Desktop\Claude Project\Calc\kupe — v2.11 от 30.09.2026 = v2.10 + суммы в полях проёма
 *  (808+880); прайс 2026.06.08, 17 систем, GRACE подвесная. Студия импортирует тот же прайс (scripts/import-kupe.cjs → src/kupeData.ts).
 *
 *  Что делает (на месте, в web/calc; повторный запуск даёт тот же результат):
 *   1. data/profiles.js, data/fillings.js, data/lamarty.js генерируются из данных источника (vm), без комментариев источника:
 *      — профили: в источнике цена за пог. м до множителя ×3 (getAdjustedPrices). Здесь хранится только клиентская цена
 *        (значение × 3), множитель из kupe.js убран. Служебная система «Свои цены» не публикуется (как в студии — 17 систем);
 *      — цвет рамки — как в студии (kupeGrad: одинаковые названия — один цвет, «Золото кракелюр» Slim — золото);
 *      — ЛДСП Lamarty: в источнике заглушка 1 800 ₽/м². По решению Макса 16.10.2026 — лист декора по прайсу Lamarty
 *        в пересчёте на м² листа × коэффициент сметы, тот же kupeLdspPerM2 студии. Хранится только итог за м²;
 *   2. data/profile-sections.js, assets/sections, assets/textures/lamarty — копия (текстуры на сайте разрешены, решение 23.10);
 *   3. js/kupe.js — источник с правками: без множителя; ширина каждой двери с нахлёстом на ручку (js/kupe-door.js) в результате,
 *      на схеме и в КП (как в web/calc 22.10); строки спецификации и КП сходятся с итогом (roundParts, как web/calc 18.10);
 *      без кнопки «Отправить расчёт / заказать» и контактов (контакты на сайте Конструктора — вопрос Максу);
 *   4. js/utils.js — утилиты источника + roundParts (им пользуются и фасады);
 *   5. index.html — блок page-kupe и окно сечения профиля из источника, подключение данных;
 *   6. фасады ALU берут стёкла из своего прежнего каталога: data/fasad-fillings.js (FASAD_FILLINGS) — цены фасадов не меняются.
 *  Стили css/main.css слиты один раз 23.10 (3-way: calc-platform 837f242 / web/calc / v2.11), скрипт их не трогает.
 *  bake-calc.py (фасады из calc-ready) перезаписывает web/calc целиком — после него запускать этот скрипт.
 *
 *  Проверки в конце (код 1 при ошибке): нет множителя, нет закупочных значений профилей источника в данных, нет служебных
 *  слов и имён поставщиков (те же шаблоны, что страж publish.ps1 4b), 17 систем = студия, у всех декоров ЛДСП есть цена.
 *  Запуск: cd studio; npx tsx scripts/bake-calc-kupe.ts [--src <Calc\kupe>] */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { KUPE_SYSTEMS, KUPE_PROFILE_MULT } from "../src/kupeData";
import { kupeGrad } from "../src/kupe";
import { kupeLdspPerM2, MARKUP_DEFAULT } from "../src/pricing";

const STUDIO = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(dirname(STUDIO), "web", "calc");
const argSrc = process.argv.indexOf("--src");
const SRC = argSrc > 0 ? process.argv[argSrc + 1] : "C:/Users/My PC/Desktop/Claude Project/Calc/kupe";
const V = "20261023";
const PF = ["ruchka", "verh", "niz", "razd", "napravl_top", "napravl_bot"] as const;
const STUDIO_PF: Record<(typeof PF)[number], "ruchka" | "verh" | "niz" | "razd" | "top" | "bot"> = { ruchka: "ruchka", verh: "verh", niz: "niz", razd: "razd", napravl_top: "top", napravl_bot: "bot" };
// те же шаблоны, что страж publish.ps1 (4b) и bake-calc.py
const GUARD_WORDS = /(закуп|себестоим|наценк|решени[ея] макса)/i;
const GUARD_NAMES = /(?<![Ѐ-ӿ])(СФЗ|ФАМ|ФАС|АТБ|МВМ|МДМ)(?![Ѐ-ӿ])|Побед[аыеу]|Мега-?[Тт]рейд|Мегатрейд|Древиз/;
const GUARD_NUMBERS = /(?<![\w$])(markup|sheetPrice|vernissageMarkup)\s*:\s*(?![01](?![\d.e]))-?\.?\d|\?\?\s*(23e3|23000)\b/;

class BakeError extends Error {}
const read = (p: string) => readFileSync(p, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const write = (p: string, t: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t, "utf8"); };
/** Замена ровно одного фрагмента (иначе — ошибка: источник изменился, правку надо пересмотреть). */
function must(t: string, from: string | RegExp, to: string, what: string): string {
  const n = typeof from === "string" ? t.split(from).length - 1 : (t.match(new RegExp(from.source, from.flags.includes("g") ? from.flags : from.flags + "g")) ?? []).length;
  if (n !== 1) throw new BakeError(`${what}: фрагмент найден ${n} раз(а) вместо 1`);
  return typeof from === "string" ? t.replace(from, () => to) : t.replace(from, () => to);
}
function copyDir(a: string, b: string): number {
  if (existsSync(b)) rmSync(b, { recursive: true, force: true });
  let n = 0;
  for (const f of readdirSync(a)) {
    const p = join(a, f), q = join(b, f);
    if (statSync(p).isDirectory()) n += copyDir(p, q); else { mkdirSync(b, { recursive: true }); copyFileSync(p, q); n++; }
  }
  return n;
}
const lit = (v: unknown) => JSON.stringify(v);
const obj = (o: Record<string, unknown>) => "{ " + Object.entries(o).map(([k, v]) => k + ":" + lit(v)).join(", ") + " }";

type SrcColor = { name: string; frameGrad: string } & Record<(typeof PF)[number], number>;
type SrcSystem = { system: string; colors: SrcColor[] } & Record<string, unknown>;

function sourceData() {
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  for (const f of ["data/profiles.js", "data/fillings.js", "data/lamarty.js"]) {
    const code = read(join(SRC, f)).replace(/^const (\w+)/gm, "globalThis.$1");
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx as {
    PROFILES_VERSION: string; FILLINGS_VERSION: string; LAMARTY_VERSION: string;
    PROFILE_SYSTEMS: SrcSystem[]; SECTION_OPTS: Record<string, unknown>[]; FILLINGS: Record<string, unknown>[]; LAMARTY_LDSP: Record<string, unknown>[];
    SOFT_CLOSE_PRICE: number; COMPLEX_WORK_PRICE: number; COMPLEX_SECTIONS_THRESHOLD: number;
    FILM_ARMOR: { name: string; p: number }; FILM_SAFETY: { name: string; p: number };
  };
}

function bakeData(kupeSrc: string) {
  const d = sourceData();
  const m = /const PROF_MULT\s*=\s*(\d+(?:\.\d+)?)\s*;/.exec(kupeSrc);
  if (!m) throw new BakeError("PROF_MULT не найден в kupe.js источника");
  const mult = Number(m[1]);
  if (mult !== KUPE_PROFILE_MULT) throw new BakeError(`множитель профиля источника ${mult} ≠ студии ${KUPE_PROFILE_MULT}`);
  const purchase = new Set<number>();
  const systems = d.PROFILE_SYSTEMS.filter((s) => s.system !== "Свои цены").map((s) => {
    const st = KUPE_SYSTEMS.find((x) => x.system === s.system);
    if (!st) throw new BakeError(`система «${s.system}» есть в калькуляторе, но не в студии`);
    const colors = s.colors.map((c) => {
      const sc = st.colors.find((x) => x.name === c.name);
      if (!sc) throw new BakeError(`цвет «${c.name}» системы «${s.system}» нет в студии`);
      const o: Record<string, unknown> = { ...c, frameGrad: kupeGrad(sc) };
      for (const k of PF) {
        if (c[k] !== sc[STUDIO_PF[k]]) throw new BakeError(`${s.system} · ${c.name} · ${k}: калькулятор ${c[k]} ≠ студия ${sc[STUDIO_PF[k]]}`);
        purchase.add(c[k]);
        o[k] = Math.round(c[k] * mult * 1e6) / 1e6;
      }
      return o;
    });
    return { ...s, colors };
  });
  if (systems.length !== KUPE_SYSTEMS.length) throw new BakeError(`систем ${systems.length}, в студии ${KUPE_SYSTEMS.length}`);
  const pv = d.PROFILES_VERSION.replace(/-minus20$/, ""), fv = d.FILLINGS_VERSION.replace(/-minus20$/, "");
  const head = (file: string, what: string) => `// ${file} — СГЕНЕРИРОВАНО studio/scripts/bake-calc-kupe.ts из калькулятора дверей-купе v2.11. Не править вручную.\n// ${what}\n`;
  const profiles = head("data/profiles.js", "Системы профилей купе (Аристо) и цвета. Цены — ₽ за пог. м; комплект фурнитуры, доводчик, сборка — ₽ за дверь; плёнки — ₽ за м².") +
    "// Public: PROFILES_VERSION, PROFILE_SYSTEMS, SECTION_OPTS, SOFT_CLOSE_PRICE, COMPLEX_WORK_PRICE, COMPLEX_SECTIONS_THRESHOLD, FILM_ARMOR, FILM_SAFETY\n\n" +
    `const PROFILES_VERSION = ${lit(pv)};\n\nconst PROFILE_SYSTEMS = [\n` +
    systems.map((s) => { const { colors, ...rest } = s; return "  " + obj(rest).slice(0, -2) + ",\n    colors: [\n" + colors.map((c) => "      " + obj(c) + ",").join("\n") + "\n    ] },"; }).join("\n") +
    "\n];\n\n// h — горизонтальных разделителей, v — вертикальных; доли рядов и колонок\nconst SECTION_OPTS = [\n" + d.SECTION_OPTS.map((o) => "  " + obj(o) + ",").join("\n") + "\n];\n\n" +
    `const SOFT_CLOSE_PRICE = ${d.SOFT_CLOSE_PRICE};\nconst COMPLEX_WORK_PRICE = ${d.COMPLEX_WORK_PRICE};\nconst COMPLEX_SECTIONS_THRESHOLD = ${d.COMPLEX_SECTIONS_THRESHOLD};\n` +
    `const FILM_ARMOR  = ${obj(d.FILM_ARMOR)};\nconst FILM_SAFETY = ${obj(d.FILM_SAFETY)};\n`;
  const plain = d.FILLINGS.filter((f) => f.g !== "ЛДСП Lamarty");
  const fillings = head("data/fillings.js", "Наполнения дверей-купе: p — ₽ за м², mat — класс для схемы.") + "// Public: FILLINGS_VERSION, FILLINGS\n\n" +
    `const FILLINGS_VERSION = ${lit(fv)};\n\nconst FILLINGS = [\n` + plain.map((f) => "  " + obj(f) + ",").join("\n") + "\n];\n";
  const noPrice: string[] = [];
  const ldsp = d.LAMARTY_LDSP.map((f) => {
    const r = kupeLdspPerM2(String(f.n), MARKUP_DEFAULT);
    if (r.price === null) noPrice.push(String(f.n));
    return { ...f, p: r.price };
  });
  if (noPrice.length) throw new BakeError("ЛДСП без цены в студии: " + noPrice.join(", "));
  const lamarty = head("data/lamarty.js", "ЛДСП Lamarty для вставок купе: p — ₽ за м² (лист декора по прайсу Lamarty в пересчёте на м² листа 2750×1830, как в Ё Конструкторе), tex — текстура.") +
    "// Public: LAMARTY_VERSION, LAMARTY_LDSP (добавляются в FILLINGS)\n\n" +
    `const LAMARTY_VERSION = ${lit(d.LAMARTY_VERSION)};\n\nconst LAMARTY_LDSP = [\n` + ldsp.map((f) => "  " + obj(f) + ",").join("\n") + "\n];\n\n" +
    "if (typeof FILLINGS !== 'undefined' && !FILLINGS.some(f => f.g === 'ЛДСП Lamarty')) {\n  Array.prototype.push.apply(FILLINGS, LAMARTY_LDSP);\n}\n";
  write(join(OUT, "data", "profiles.js"), profiles);
  write(join(OUT, "data", "fillings.js"), fillings);
  write(join(OUT, "data", "lamarty.js"), lamarty);
  return { systems, purchase, retail: new Set(systems.flatMap((s) => s.colors.flatMap((c) => PF.map((k) => c[k] as number)))), plain: plain.length, ldsp: ldsp.length };
}

function bakeKupeJs(src: string): string {
  let t = src;
  // 1. множитель профиля — цены в data/profiles.js уже клиентские
  t = must(t, /\/\* =+\n\s*BUSINESS LOGIC — getAdjustedPrices\(\)\n[\s\S]*?\n\}\n/,
    "/* ============================================================\n   BUSINESS LOGIC — getAdjustedPrices()\n   Цены профиля (₽/пог.м.) — из data/profiles.js\n   ============================================================ */\n" +
    "function getAdjustedPrices() {\n  const p = getCurrentProfile();\n  return { ruchka: p.ruchka, verh: p.verh, niz: p.niz, razd: p.razd, napravl_top: p.napravl_top, napravl_bot: p.napravl_bot };\n}\n", "getAdjustedPrices");
  // 2. «Заказать дверь»: контактов на сайте Конструктора нет (вопрос Максу) — кнопка убрана, константы пустые
  t = must(t, /const ORDER_PHONE_DISPLAY = [^\n]*\n[\s\S]*?const ORDER_TG_URL\s*=[^\n]*\n/,
    "// Контакты для «Заказать дверь» на сайте Конструктора не публикуются (кнопка скрыта).\nconst ORDER_PHONE_DISPLAY = '';\nconst ORDER_PHONE_TEL = '';\nconst ORDER_SITE_URL = '';\nconst ORDER_MAX_URL = '';\nconst ORDER_TG_URL  = '';\n", "контакты заказа");
  t = must(t, "    // v1.5: CTA для клиентов — отправить расчёт в мессенджер\n    '<button type=\"button\" class=\"kupe-btn-order\" onclick=\"openOrderModal()\">Отправить расчёт / заказать</button>' +\n",
    "    // — Ширина каждой двери (полотно с нахлёстом на ручку, js/kupe-door.js)\n" +
    "    '<div id=\"kupeDoorSizes\">' +\n" +
    "      '<div class=\"kupe-sec-lbl\" style=\"margin-bottom:6px\">Ширина дверей' + (d.N > 1 ? ' · нахлёст ' + d.doorOverlap + ' мм' : '') + '</div>' +\n" +
    "      '<div class=\"kupe-spec-list\">' +\n" +
    "        Array.from({ length: d.N }, (_, i) =>\n" +
    "          '<div class=\"kupe-spec-row\">' +\n" +
    "            '<span class=\"kupe-spec-name\">Дверь ' + (i + 1) + '</span>' +\n" +
    "            '<span class=\"kupe-spec-qty\"></span>' +\n" +
    "            '<span class=\"kupe-spec-price kupe-door-w\">' + fmt(d.doorW) + ' мм</span>' +\n" +
    "          '</div>'\n" +
    "        ).join('') +\n" +
    "      '</div>' +\n" +
    "    '</div>' +\n", "кнопка заказа → ширина дверей");
  // служебной системы «Свои цены» на сайте нет — пустое семейство «Свои» в списке не показываем
  t = must(t, "  const FAMILIES = ['Стандарт', 'Эконом', 'SLIM LINE', 'NOVA', 'GRACE', 'Свои'];\n",
    "  const FAMILIES = ['Стандарт', 'Эконом', 'SLIM LINE', 'NOVA', 'GRACE', 'Свои'].filter(f => PROFILE_SYSTEMS.some(s => s.family === f));\n", "семейства профилей");
  // 3. ширина полотна с нахлёстом (js/kupe-door.js) — для размеров; цена по-прежнему от W / N
  t = must(t, "  const dims = PROFILE_SYSTEMS[sysIdx].dims;\n\n  renderResults({\n    W, H, N, bd, isSinglePartition,\n",
    "  const dims = PROFILE_SYSTEMS[sysIdx].dims;\n  // Ширина полотна с нахлёстом на ручку (js/kupe-door.js) — для размеров дверей; цена по-прежнему от W / N\n" +
    "  const door = kupeDoorWidth(W, N, kupeSystemProfile(PROFILE_SYSTEMS[sysIdx]));\n  const doorW = Math.round(door.width), doorOverlap = Math.round(door.overlap);\n\n" +
    "  renderResults({\n    W, H, N, bd, isSinglePartition, doorW, doorOverlap,\n", "ширина двери в calculate");
  t = must(t, "  dim.textContent = W + ' × ' + H + ' мм · ' + N + ' ' + (N === 1 ? 'дверь' : N < 5 ? 'двери' : 'дверей');\n",
    "  const _sys = PROFILE_SYSTEMS[num('profileSystem', 0)];\n  const _dw = typeof kupeDoorWidth === 'function' && _sys ? Math.round(kupeDoorWidth(W, N, kupeSystemProfile(_sys)).width) : 0;\n" +
    "  dim.textContent = W + ' × ' + H + ' мм · ' + N + ' ' + (N === 1 ? 'дверь' : N < 5 ? 'двери' : 'дверей') + (_dw ? ' по ' + fmt(_dw) + ' мм' : '');\n", "ширина двери на схеме");
  t = must(t, "        '<tr><td>Количество полотен</td><td>' + d.N + ' шт</td></tr>' +\n",
    "        '<tr><td>Количество полотен</td><td>' + d.N + ' шт</td></tr>' +\n" +
    "        (d.doorW ? Array.from({ length: d.N }, (_, i) =>\n" +
    "          '<tr><td>Ширина двери ' + (i + 1) + '</td><td>' + fmt(d.doorW) + ' мм' + (i === 0 && d.N > 1 ? ' (с нахлёстом ' + d.doorOverlap + ' мм на ручку)' : '') + '</td></tr>'\n" +
    "        ).join('') : '') +\n", "ширина двери в КП");
  t = must(t, "Полотен: <strong>${t.d.N} шт</strong> · Наполнение:", "Полотен: <strong>${t.d.N} шт</strong>${t.d.doorW ? ` по <strong>${fmt(t.d.doorW)} мм</strong>` : ''} · Наполнение:", "ширина двери на 2-й странице КП");
  // 4. строки спецификации и КП сходятся с итогом до рубля (roundParts)
  t = must(t, "  const specHTML = specItems.map(it =>\n", "  const specR = roundParts(specItems.map(it => it.sum), d.total);\n  const specHTML = specItems.map((it, i) =>\n", "спецификация: roundParts");
  t = must(t, "      '<span class=\"kupe-spec-price\">'+fmt(it.sum)+' ₽</span>'+\n", "      '<span class=\"kupe-spec-price\">'+fmt(specR[i])+' ₽</span>'+\n", "спецификация: округлённая строка");
  t = must(t, "  const profRowsHTML = d.profRows.map(r =>\n", "  const profR = roundParts(d.profRows.map(r => r.c), d.profTotal);\n  const profRowsHTML = d.profRows.map((r, i) =>\n", "КП профиль: roundParts");
  t = must(t, "      '<td class=\"r\">' + fmt(r.c) + '</td>' +\n", "      '<td class=\"r\">' + fmt(profR[i]) + '</td>' +\n", "КП профиль: строка");
  t = must(t, "  const itemRowsHTML = itemRows.map((r, i) =>\n", "  const itemR = roundParts(itemRows.map(r => r.val), d.total);\n  const itemRowsHTML = itemRows.map((r, i) =>\n", "КП состав: roundParts");
  t = must(t, "      '<td class=\"r\">' + fmt(r.val) + '</td>' +\n", "      '<td class=\"r\">' + fmt(itemR[i]) + '</td>' +\n", "КП состав: строка");
  // 5. служебный комментарий шапки
  t = t.replace("// Depends on: utils.js, store.js, router.js, shared-kp.js,\n//             data/fillings.js, data/profiles.js\n",
    "// Depends on: utils.js, store.js, router.js, shared-kp.js, kupe-door.js,\n//             data/fillings.js, data/profiles.js, data/lamarty.js, data/profile-sections.js\n// Копия калькулятора купе v2.11 для сайта — studio/scripts/bake-calc-kupe.ts.\n");
  if (/PROF_MULT/.test(t)) throw new BakeError("в kupe.js остался PROF_MULT");
  return t;
}

function bakeUtils(src: string, cur: string): string {
  const m = /\n(\/\/ Округление слагаемых[\s\S]*?\nfunction roundParts\([\s\S]*?\n\}\n)/.exec(cur) ?? /\n(\/\/ Округление слагаемых[\s\S]*?\n\}\n)/.exec(cur);
  if (/function roundParts\(/.test(src)) return src;
  if (!m) throw new BakeError("roundParts не найден в web/calc/js/utils.js");
  return must(src, "\n// Debounce", "\n" + m[1] + "\n// Debounce", "utils: roundParts").replace("// Public: $, num, fmt, pluralDoors, debounce, escapeHtml, escapeAttr", "// Public: $, num, fmt, pluralDoors, roundParts, debounce, escapeHtml, escapeAttr, parseDimensionSum");
}

function bakeIndex(srcHtml: string, cur: string): string {
  const a = srcHtml.indexOf('<div class="module-page active" id="page-kupe">'), b = srcHtml.indexOf("<!-- v1.5: модал «Заказать дверь»");
  if (a < 0 || b < a) throw new BakeError("index.html источника: не найден блок page-kupe / окно сечения");
  const block = srcHtml.slice(a, b);
  const ca = cur.indexOf('<div class="module-page active" id="page-kupe">'), fz = cur.indexOf('<div class="module-page" id="page-fasad-alu">');
  const cb = cur.lastIndexOf("<!--", fz);
  if (ca < 0 || fz < 0 || cb < ca) throw new BakeError("web/calc/index.html: не найдены границы page-kupe / page-fasad-alu");
  let t = cur.slice(0, ca) + block + cur.slice(cb);
  t = t.replace(/<script src="data\/(fasad-fillings|fillings|profiles|lamarty|profile-sections)\.js[^"]*"><\/script>\n/g, "");
  t = must(t, /<script src="data\/fasad-alu-data\.js/,
    `<script src="data/fasad-fillings.js?v=${V}"></script>\n<script src="data/fillings.js?v=${V}"></script>\n<script src="data/profiles.js?v=${V}"></script>\n` +
    `<script src="data/lamarty.js?v=${V}"></script>\n<script src="data/profile-sections.js?v=${V}"></script>\n<script src="data/fasad-alu-data.js`, "index: данные");
  t = t.replace(/js\/utils\.js\?v=\d+/, "js/utils.js?v=" + V).replace(/js\/kupe\.js\?v=\d+/, "js/kupe.js?v=" + V).replace(/js\/fasad-alu\.js\?v=\d+/, "js/fasad-alu.js?v=" + V);
  return t;
}

function bakeFasad() {
  const ff = join(OUT, "data", "fasad-fillings.js");
  if (!existsSync(ff)) {
    const old = read(join(OUT, "data", "fillings.js"));
    if (!/^const FILLINGS = \[/m.test(old) || /bake-calc-kupe/.test(old)) throw new BakeError("data/fillings.js уже не каталог фасадов — нет data/fasad-fillings.js");
    write(ff, old.replace("// data/fillings.js\n", "// data/fasad-fillings.js — каталог стёкол фасадов ALU (прежний data/fillings.js; купе — свой data/fillings.js)\n")
      .replace(/^const FILLINGS_VERSION/m, "const FASAD_FILLINGS_VERSION").replace(/^const FILLINGS = \[/m, "const FASAD_FILLINGS = [")
      .replace("// Public: const FILLINGS, const FILLINGS_VERSION", "// Public: const FASAD_FILLINGS, const FASAD_FILLINGS_VERSION"));
  }
  const p = join(OUT, "js", "fasad-alu.js");
  let t = read(p);
  if (!/FASAD_FILLINGS\.filter\(/.test(t)) t = must(t, "fasadFills = FILLINGS.filter(", "fasadFills = FASAD_FILLINGS.filter(", "fasad-alu: каталог стёкол");
  t = t.replace(/из FILLINGS\b/, "из FASAD_FILLINGS").replace("data/fillings.js, data/fasad-alu-data.js", "data/fasad-fillings.js, data/fasad-alu-data.js");
  if (/(?<!FASAD_)FILLINGS\b/.test(t.replace(/\/\/[^\n]*/g, ""))) throw new BakeError("fasad-alu.js ещё ссылается на FILLINGS купе");
  write(p, t);
}

function check(purchase: Set<number>, retail: Set<number>): string[] {
  const problems: string[] = [];
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(OUT)) {
    if (![".js", ".html", ".htm", ".css", ".json", ".svg", ".txt"].includes(extname(f).toLowerCase())) continue;
    const rel = relative(OUT, f), lines = read(f).split("\n");
    lines.forEach((l, i) => {
      if (GUARD_WORDS.test(l) || GUARD_NAMES.test(l)) problems.push(`${rel}:${i + 1} служебное слово: ${l.trim().slice(0, 100)}`);
      if (/\.(js|html?)$/.test(f) && GUARD_NUMBERS.test(l)) problems.push(`${rel}:${i + 1} коэффициент: ${l.trim().slice(0, 100)}`);
      if (/\bPROF_MULT\b|ORDER_TG_URL\s*=\s*'h|tel:\+7\d/.test(l)) problems.push(`${rel}:${i + 1} множитель или контакт: ${l.trim().slice(0, 100)}`);
    });
  }
  const prof = read(join(OUT, "data", "profiles.js"));
  const left = new Set<number>();
  for (const m of prof.matchAll(new RegExp("\\b(" + PF.join("|") + "):(\\d+(?:\\.\\d+)?)", "g"))) { const v = Number(m[2]); if (purchase.has(v) && !retail.has(v)) left.add(v); }
  if (left.size) problems.push("data/profiles.js: остались значения источника до множителя: " + [...left].slice(0, 8).join(", "));
  return problems;
}

function main() {
  if (!existsSync(join(SRC, "index.html")) || !existsSync(join(SRC, "js", "kupe.js"))) { console.error("нет источника: " + SRC); return 2; }
  if (!existsSync(join(OUT, "index.html"))) { console.error("нет web/calc: " + OUT); return 2; }
  try {
    const kupeSrc = read(join(SRC, "js", "kupe.js"));
    bakeFasad();
    const data = bakeData(kupeSrc);
    write(join(OUT, "js", "kupe.js"), bakeKupeJs(kupeSrc));
    write(join(OUT, "js", "utils.js"), bakeUtils(read(join(SRC, "js", "utils.js")), read(join(OUT, "js", "utils.js"))));
    write(join(OUT, "data", "profile-sections.js"), read(join(SRC, "data", "profile-sections.js")));
    write(join(OUT, "index.html"), bakeIndex(read(join(SRC, "index.html")), read(join(OUT, "index.html"))));
    const nSec = copyDir(join(SRC, "assets", "sections"), join(OUT, "assets", "sections"));
    const nTex = copyDir(join(SRC, "assets", "textures"), join(OUT, "assets", "textures"));
    const problems = check(data.purchase, data.retail);
    console.log(`систем ${data.systems.length} (студия ${KUPE_SYSTEMS.length}), цветов ${data.systems.reduce((s, x) => s + x.colors.length, 0)}, наполнений ${data.plain} + ЛДСП ${data.ldsp}; сечений ${nSec}, текстур ${nTex}`);
    if (problems.length) { for (const p of problems.slice(0, 40)) console.log("  ПРОБЛЕМА " + p); console.log(`bake-calc-kupe: ${problems.length} проблем(а)`); return 1; }
    console.log("bake-calc-kupe OK -> " + OUT);
    return 0;
  } catch (e) {
    if (e instanceof BakeError) { console.error("ОШИБКА запекания: " + e.message); return 2; }
    throw e;
  }
}
process.exit(main());
