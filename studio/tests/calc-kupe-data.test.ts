// Решение Макса 23.10.2026: прайс дверей купе общий — калькулятор купе v2.10; калькулятор на сайте (web/calc) приведён к нему
// (scripts/bake-calc-kupe.ts). Тест: данные web/calc = данные студии — те же 17 систем и цвета, профиль = прайс × 3 (запечено),
// наполнения те же, ЛДСП Lamarty — та же цена за м², что в смете студии; в публичных данных нет множителя и служебной системы.
// Полная сверка итогов страницы в браузере — scripts/calc-kupe-sverka.ts (5 конфигураций отчёта 22.10).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { KUPE_SYSTEMS, KUPE_FILLS, KUPE_PROFILE_MULT, KUPE_SOFT_CLOSE, KUPE_COMPLEX_WORK, KUPE_FILM_ARMOR, KUPE_FILM_SAFETY } from "../src/kupeData";
import { kupeGrad } from "../src/kupe";
import { kupeLdspPerM2, MARKUP_DEFAULT } from "../src/pricing";

type Color = { name: string; frameGrad: string; ruchka: number; verh: number; niz: number; razd: number; napravl_top: number; napravl_bot: number };
function calcData() {
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  for (const f of ["fillings.js", "profiles.js", "lamarty.js"]) {
    const code = readFileSync(new URL("../../web/calc/data/" + f, import.meta.url), "utf8").replace(/^﻿/, "").replace(/^const (\w+)/gm, "globalThis.$1");
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx as { PROFILE_SYSTEMS: { system: string; systemKind?: string; hardwarePerDoor?: number; colors: Color[] }[]; FILLINGS: { g: string; n: string; p: number }[]; SOFT_CLOSE_PRICE: number; COMPLEX_WORK_PRICE: number; FILM_ARMOR: { p: number }; FILM_SAFETY: { p: number } };
}

test("web/calc: системы, цвета и цены профилей = студия × множитель", () => {
  const c = calcData();
  assert.equal(JSON.stringify(c.PROFILE_SYSTEMS.map((s) => s.system)), JSON.stringify(KUPE_SYSTEMS.map((s) => s.system)), "17 систем в том же порядке, без «Свои цены»"); // массивы из vm — другой realm, сравнение по JSON
  for (const s of KUPE_SYSTEMS) {
    const cs = c.PROFILE_SYSTEMS.find((x) => x.system === s.system)!;
    assert.equal(cs.systemKind ?? "slide", s.kind, s.system + ": тип системы");
    assert.equal(cs.hardwarePerDoor, s.hardwarePerDoor, s.system + ": комплект фурнитуры за дверь");
    assert.equal(JSON.stringify(cs.colors.map((x) => x.name)), JSON.stringify(s.colors.map((x) => x.name)), s.system + ": цвета");
    for (const col of s.colors) {
      const cc = cs.colors.find((x) => x.name === col.name)!;
      assert.equal(cc.frameGrad, kupeGrad(col), `${s.system} · ${col.name}: цвет рамки как в студии`);
      const want = { ruchka: col.ruchka, verh: col.verh, niz: col.niz, razd: col.razd, napravl_top: col.top, napravl_bot: col.bot };
      for (const [k, v] of Object.entries(want)) assert.equal(cc[k as keyof Color], v * KUPE_PROFILE_MULT, `${s.system} · ${col.name} · ${k}`);
    }
  }
  const grace = c.PROFILE_SYSTEMS.find((s) => s.system === "GRACE (Аристо)")!;
  assert.equal(grace.systemKind, "hang", "GRACE подвесная");
  assert.equal(c.SOFT_CLOSE_PRICE, KUPE_SOFT_CLOSE); assert.equal(c.COMPLEX_WORK_PRICE, KUPE_COMPLEX_WORK);
  assert.equal(c.FILM_ARMOR.p, KUPE_FILM_ARMOR.p); assert.equal(c.FILM_SAFETY.p, KUPE_FILM_SAFETY.p);
});

test("web/calc: наполнения = студия; ЛДСП Lamarty — цена за м² из сметы студии (лист по прайсу Lamarty), не заглушка 1800", () => {
  const c = calcData();
  assert.equal(c.FILLINGS.length, KUPE_FILLS.length, "наполнения: столько же позиций");
  for (const f of KUPE_FILLS) {
    const cf = c.FILLINGS.find((x) => x.n === f.n && x.g === f.g);
    assert.ok(cf, "наполнение " + f.n);
    if (f.g.startsWith("ЛДСП")) assert.equal(cf!.p, kupeLdspPerM2(f.n, MARKUP_DEFAULT).price, "ЛДСП " + f.n);
    else assert.equal(cf!.p, f.p, f.n);
  }
  assert.ok(!c.FILLINGS.some((f) => f.g.startsWith("ЛДСП") && f.p === 1800), "заглушки 1800 нет");
});

test("web/calc: в публичном коде нет множителя профиля, контактов заказа и служебной системы", () => {
  const kupe = readFileSync(new URL("../../web/calc/js/kupe.js", import.meta.url), "utf8");
  assert.doesNotMatch(kupe, /PROF_MULT/);
  assert.doesNotMatch(kupe, /openOrderModal\(\)">/, "кнопки «Отправить расчёт / заказать» нет");
  assert.doesNotMatch(kupe, /tel:\+7\d|t\.me\/|max\.ru\/u\//, "контактов нет");
  assert.match(kupe, /kupeDoorWidth\(W, N, kupeSystemProfile/, "ширина двери с нахлёстом считается");
  const profiles = readFileSync(new URL("../../web/calc/data/profiles.js", import.meta.url), "utf8");
  assert.doesNotMatch(profiles, /Свои цены/);
  const html = readFileSync(new URL("../../web/calc/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /orderModal|tel:\+7/, "окна заказа с телефоном нет");
  assert.match(html, /Golos\+Text/, "шрифт Golos Text");
});
