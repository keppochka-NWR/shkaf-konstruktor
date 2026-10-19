# -*- coding: utf-8 -*-
"""
bake-calc.py - публичная копия калькуляторов (купе, фасады ALU/МДФ) для GitHub Pages.

Источник (не меняется): репо калькуляторов, ветка calc-ready-1018
  Desktop\\Claude Project\\calc-ready\\calc-platform
Результат: web/calc (перезаписывается целиком).

Что делает:
  1. копирует источник без _archive, tests, .git, *.md;
  2. в таблицах данных цены полей сразу клиентские: умножает значения полей
     на коэффициенты из кода источника и убирает коэффициенты из формул;
  3. чистит служебные комментарии;
  4. добавляет в шапку ссылку назад на студию;
  5. проверяет копию: нет коэффициентов, нет исходных значений полей, нет служебных слов.
Итоговые цены клиента не меняются (сверка - эталоны tests/manual.md источника).

Запуск: py -I studio/scripts/bake-calc.py [--src <calc-platform>] [--out <web/calc>]
"""
import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
DEFAULT_SRC = os.path.normpath(os.path.join(REPO, "..", "calc-ready", "calc-platform"))
DEFAULT_OUT = os.path.join(REPO, "web", "calc")

SKIP_DIRS = {"_archive", "tests", ".git", "node_modules", "__pycache__"}

GUARD_WORDS = re.compile(r"(?i)(закуп|себестоим|наценк|решени[ея] макса)")
GUARD_NAMES = re.compile(r"(?<![Ѐ-ӿ])(СФЗ|ФАМ|ФАС|АТБ|МВМ|МДМ)(?![Ѐ-ӿ])|Побед[аыеу]|Мега-?[Тт]рейд|Мегатрейд|Древиз")
COEF_NAMES = ["PROF_MULT", "FASAD_PROF_MARKUP", "FASAD_HINGE_MARKUP", "FASAD_MARKUP", "MDF_HINGE_MARKUP"]


class BakeError(Exception):
    pass


def fmt_num(v):
    v = round(v, 6)
    return str(int(v)) if v == int(v) else repr(v)


def scale_fields(text, fields, k, region=None, expect=None):
    """Умножает числа полей `fields` на k (внутри region=(start_marker, end_marker), если задан).
    Возвращает (текст, список исходных значений)."""
    start, end = 0, len(text)
    if region:
        start = text.index(region[0])
        end = text.index(region[1], start)
    seg = text[start:end]
    found = []
    rx = re.compile(r"\b(" + "|".join(fields) + r")(\s*:\s*)(\d+(?:\.\d+)?)")

    def rep(m):
        found.append(float(m.group(3)))
        return m.group(1) + m.group(2) + fmt_num(float(m.group(3)) * k)

    seg = rx.sub(rep, seg)
    if expect is not None and len(found) != expect:
        raise BakeError("ожидалось %d значений %s, найдено %d" % (expect, fields, len(found)))
    if not found:
        raise BakeError("не найдены поля %s" % (fields,))
    return text[:start] + seg + text[end:], found


def must_sub(text, old, new, count=1):
    n = text.count(old)
    if n != count:
        raise BakeError("фрагмент встречается %d раз(а) вместо %d: %r" % (n, count, old[:80]))
    return text.replace(old, new)


def strip_coef(text, name):
    """Убирает множитель `* NAME` из выражений."""
    return re.sub(r"\s*\*\s*" + name + r"\b", "", text)


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, t):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)


def copy_tree(src, out):
    if os.path.isdir(out):  # чистим содержимое, саму папку не удаляем (её может держать локальный сервер)
        for e in os.listdir(out):
            q = os.path.join(out, e)
            shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
    for dp, dn, fn in os.walk(src):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        rel = os.path.relpath(dp, src)
        dst = os.path.join(out, rel) if rel != "." else out
        os.makedirs(dst, exist_ok=True)
        for f in fn:
            if f.lower().endswith(".md"):
                continue
            shutil.copy2(os.path.join(dp, f), os.path.join(dst, f))


def bake(src, out):
    copy_tree(src, out)
    purchase = {}  # поле -> множество исходных значений (для проверки)

    # ---- купе: профили x3 (kupe.js getAdjustedPrices)
    kupe_src = read(os.path.join(src, "js", "kupe.js"))
    m = re.search(r"const PROF_MULT\s*=\s*(\d+(?:\.\d+)?)\s*;", kupe_src)
    if not m:
        raise BakeError("PROF_MULT не найден в kupe.js")
    prof_k = float(m.group(1))
    p = os.path.join(out, "data", "profiles.js")
    t = read(p)
    pf = ["ruchka", "verh", "niz", "razd", "napravl_top", "napravl_bot"]
    t, vals = scale_fields(t, pf, prof_k, region=("const PROFILE_SYSTEMS", "];\n\n"))
    purchase["profiles"] = (pf, set(vals), prof_k)
    t = must_sub(t, " * Все цены — ₽/пог.м. до наценки\n", " * Все цены — ₽/пог.м.\n")
    t = must_sub(t, " * Все цены — ₽ за погонный метр (пересчитано из прайса: цена_шт / 5.4)\n", " * Все цены — ₽ за погонный метр\n")
    t = must_sub(t, " * Цены рассчитаны из прайса Аристо 29.04.2026, деление на 5.4 (длина штуки)\n", " * Цены от 29.04.2026\n")
    t = must_sub(t, "// 1. Обновить значения цен в PROFILE_SYSTEMS (₽/пог.м.)\n", "// 1. Обновить значения цен в PROFILE_SYSTEMS (₽/пог.м.) — пересобрать bake-calc.py\n")
    write(p, t)

    p = os.path.join(out, "js", "kupe.js")
    t = read(p)
    t = must_sub(t, "   Возвращает цены профиля ×3 (фиксированная наценка)\n", "   Возвращает цены профиля (₽/пог.м.)\n")
    t = re.sub(r"\n\s*const PROF_MULT\s*=\s*\d+(?:\.\d+)?\s*;", "", t)
    t = strip_coef(t, "PROF_MULT")
    write(p, t)

    # ---- фасады ALU: профиль x FASAD_PROF_MARKUP, петли и подъёмник x FASAD_HINGE_MARKUP
    p = os.path.join(out, "data", "fasad-alu-data.js")
    t = read(p)
    k_prof = float(re.search(r"const FASAD_PROF_MARKUP\s*=\s*(\d+(?:\.\d+)?)", t).group(1))
    k_hinge = float(re.search(r"const FASAD_HINGE_MARKUP\s*=\s*(\d+(?:\.\d+)?)", t).group(1))
    t, v1 = scale_fields(t, ["pricePerM"], k_prof, region=("const FASAD_PROFILES", "];"))
    t, v2 = scale_fields(t, ["price"], k_hinge, region=("const FASAD_HINGES", "];"))
    t, v3 = scale_fields(t, ["price"], k_hinge, region=("const FASAD_LIFT", ";"), expect=1)
    purchase["alu_prof"] = (["pricePerM"], set(v1), k_prof)
    purchase["alu_hinge"] = (["price"], set(v2) | set(v3), k_hinge)
    t = re.sub(r"\n// Наценки\nconst FASAD_PROF_MARKUP[^\n]*\nconst FASAD_HINGE_MARKUP[^\n]*\n", "\n", t)
    t = re.sub(r"\n// Обратная совместимость \(старое имя константы\)\nconst FASAD_MARKUP[^\n]*\n?", "\n", t)
    t = must_sub(t, "// Public: FASAD_PROFILES, FASAD_HINGES, FASAD_LIFT, FASAD_PROF_MARKUP,\n//         FASAD_HINGE_MARKUP, FASAD_GASKET, FASAD_FILL_GROUPS",
                 "// Public: FASAD_PROFILES, FASAD_HINGES, FASAD_LIFT, FASAD_GASKET, FASAD_FILL_GROUPS")
    t = re.sub(r"\(₽/м, закупочная цена прайса ([\d.]+)\)", r"(₽/м, цены от \1)", t)
    t = t.replace("// Петли (₽/шт, закупочная)", "// Петли (₽/шт)")
    t = t.replace("// ₽/компл, закупочная", "// ₽/компл")
    write(p, t)

    p = os.path.join(out, "js", "fasad-alu.js")
    t = read(p)
    t = strip_coef(t, "FASAD_PROF_MARKUP")
    t = strip_coef(t, "FASAD_HINGE_MARKUP")
    t = strip_coef(t, "FASAD_MARKUP")
    write(p, t)

    # ---- фасады МДФ: петли x MDF_HINGE_MARKUP
    p = os.path.join(out, "data", "fasad-mdf-data.js")
    t = read(p)
    k_mdf = float(re.search(r"const MDF_HINGE_MARKUP\s*=\s*(\d+(?:\.\d+)?)", t).group(1))
    t, v4 = scale_fields(t, ["price"], k_mdf, region=("const MDF_HINGES", "];"))
    purchase["mdf_hinge"] = (["price"], set(v4), k_mdf)
    t = re.sub(r"\n/\*\*\n \* Наценка на петли[^\n]*\n \*/\nconst MDF_HINGE_MARKUP[^\n]*\n", "\n", t)
    t = t.replace("//         MDF_THICKNESS, MDF_LIMITS, MDF_HINGES, MDF_HINGE_MARKUP", "//         MDF_THICKNESS, MDF_LIMITS, MDF_HINGES")
    t = t.replace(" × MDF_HINGE_MARKUP", "")
    t = t.replace(" * Покрытия — наценка идёт коэффициентом к BASE_PRICE × площадь.", " * Покрытия — коэффициент к BASE_PRICE × площадь.")
    t = t.replace(" * Цена закупочная за 1 шт.", " * Цена за 1 шт.")
    write(p, t)

    p = os.path.join(out, "js", "fasad-mdf.js")
    t = read(p)
    t = strip_coef(t, "MDF_HINGE_MARKUP")
    write(p, t)

    # ---- переименование локальной переменной, которую privacy-scan путает с фамилией (транслит)
    for name in ("fasad-alu.js", "fasad-mdf.js"):
        p = os.path.join(out, "js", name)
        write(p, re.sub(r"\bdimYbot\b", "dimYBottom", read(p)))

    # ---- ссылка назад на студию в шапке
    p = os.path.join(out, "index.html")
    t = read(p)
    link = ('<div class="hdr-actions">\n      <a href="../" title="Ё Конструктор — 3D-студия" '
            'style="align-self:center;font-weight:600;font-size:13px;color:inherit;opacity:.8;'
            'text-decoration:none;white-space:nowrap">← Конструктор</a>')
    t = must_sub(t, '<div class="hdr-actions">', link)
    write(p, t)

    return purchase


def check(out, purchase):
    problems = []
    for dp, dn, fn in os.walk(out):
        for f in fn:
            path = os.path.join(dp, f)
            rel = os.path.relpath(path, out)
            if os.path.splitext(f)[1].lower() not in (".js", ".html", ".htm", ".css", ".json", ".svg", ".txt"):
                continue
            t = read(path)
            for i, line in enumerate(t.split("\n"), 1):
                if GUARD_WORDS.search(line) or GUARD_NAMES.search(line):
                    problems.append("%s:%d служебное слово: %s" % (rel, i, line.strip()[:100]))
                for c in COEF_NAMES:
                    if re.search(r"\b" + c + r"\b", line):
                        problems.append("%s:%d коэффициент %s" % (rel, i, c))
    # исходные значения полей не должны остаться в таблицах копии (кроме совпавших с новыми)
    tables = {
        "profiles": (os.path.join(out, "data", "profiles.js"), ("const PROFILE_SYSTEMS", "];\n\n")),
        "alu_prof": (os.path.join(out, "data", "fasad-alu-data.js"), ("const FASAD_PROFILES", "];")),
        "alu_hinge": (os.path.join(out, "data", "fasad-alu-data.js"), ("const FASAD_HINGES", "const FASAD_GASKET")),
        "mdf_hinge": (os.path.join(out, "data", "fasad-mdf-data.js"), ("const MDF_HINGES", "];")),
    }
    for key, (fields, src_vals, k) in purchase.items():
        path, (a, b) = tables[key]
        t = read(path)
        seg = t[t.index(a):t.index(b, t.index(a))]
        new_vals = set(float(x) for x in re.findall(r"\b(?:" + "|".join(fields) + r")\s*:\s*(\d+(?:\.\d+)?)", seg))
        exp_vals = set(round(v * k, 6) for v in src_vals)
        if new_vals != exp_vals:
            problems.append("%s: значения не совпали с ожидаемыми" % key)
        left = (src_vals - exp_vals) & new_vals
        if left:
            problems.append("%s: остались исходные значения %s" % (key, sorted(left)[:5]))
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not os.path.isfile(os.path.join(a.src, "index.html")):
        print("нет источника: " + a.src)
        return 2
    try:
        purchase = bake(a.src, a.out)
    except BakeError as e:
        print("ОШИБКА запекания: " + str(e))
        return 2
    problems = check(a.out, purchase)
    for key, (fields, vals, k) in purchase.items():
        print("  %-10s %-45s значений %3d  x%s" % (key, ",".join(fields), len(vals), fmt_num(k)))
    if problems:
        for p in problems:
            print("  ПРОБЛЕМА " + p)
        return 1
    print("bake-calc OK -> " + a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
