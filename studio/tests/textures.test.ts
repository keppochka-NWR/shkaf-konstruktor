// Текстуры декоров в собранной студии (критик 20.10, m10): путь от страницы студии (tex/…), файл лежит в public/tex —
// на Pages старого web/assets нет, «../assets/tex/…» давал 404 (Дуб Вотан, Белый, Графит, Дуб Солсбери).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { catalog } from "../src/catalog";

test("каталог декоров: текстуры относительно студии и есть в public/tex", () => {
  const withTex = catalog.filter((c) => c.tex);
  assert.ok(withTex.length > 100);
  for (const c of withTex) {
    assert.match(c.tex, /^tex\//, c.n + ": путь от страницы студии");
    assert.ok(existsSync(new URL("../public/" + c.tex, import.meta.url)), c.n + ": нет файла " + c.tex);
  }
  for (const n of ["Дуб Вотан", "Белый", "Графит", "Дуб Солсбери"]) assert.ok(withTex.some((c) => c.n === n), n);
});
