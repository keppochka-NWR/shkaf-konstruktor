# -*- coding: utf-8 -*-
"""
privacy-scan.py — поиск имён клиентских папок базы заказов в текстовых файлах.

Токены берутся из `Кухни\\corpus\\index.json` (компоненты путей после общего корня),
минус стоп-слова мебели/служебные слова и декоры Lamarty (из web/assets/catalog-lamarty.js),
плюс латинские транслитерации. Сами токены в скрипте не хранятся и в вывод не попадают.

Запуск (только с -I, чтобы не подхватить чужой модуль из рабочей папки):
  py -I scripts/privacy-scan.py <путь>... [--exclude <подстрока>]... [--index <index.json>]
                                 [--decors <catalog-lamarty.js>] [--min-len 4] [--quiet]
Вывод: только `файл:строка  маска` (первая буква + звёздочки). Код возврата: 0 — чисто,
1 — есть совпадения, 2 — ошибка (нет index.json и т. п.).
"""
import argparse
import itertools
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INDEX = os.path.normpath(os.path.join(HERE, "..", "..", "..", "Кухни", "corpus", "index.json"))
DEFAULT_DECORS = os.path.normpath(os.path.join(HERE, "..", "..", "web", "assets", "catalog-lamarty.js"))

TEXT_EXT = {".ts", ".tsx", ".js", ".cjs", ".mjs", ".md", ".json", ".html", ".css", ".py", ".ps1",
            ".txt", ".csv", ".yml", ".yaml", ".bat", ".svg", ".cmd", ".sh", ".toml", ".ini", ".env"}
ALWAYS_SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv"}
MAX_FILE = 50 * 1024 * 1024

# Стоп-слова: мебель, помещения, служебные слова файлов/папок, владелец цеха, поставщики.
# Это НЕ имена клиентов — список можно держать в репозитории.
STOP = set("""
autosave bazis kupe name prikhozhaya sanuzely shkaf kitchen wardrobe project model
актуальные антресоль антресолью антресоли балкон белый блок бойлер боку большая большой
ванная ванную ваная вариант варианты верх версия вид вопрос вторая выбеленное выпуск
гардероб гардеробная глянец гостиная готов готовый групп группа
двери дверной двойной дерево деталей детали детская детский дизайнер длинная
документы доделать доделка доп дополнение
забудь задание заказ закрывающий закрытие закрыть зал замер замера
изделие изрезаные инсталяцией исправление исправленный итог
какой карнизы кмод коммуникации комната конструкция короба короной корпус
корректировка корректировки кривым кто купе кухнгя кухни кухню кухня кухонь
лестница лестницу лиц логисты
макс максим максу маленькая мансарду мвм мебелик мебельная модель модуль мойка
над найдешь низ нишу нога нужен нужно обрпзный обувница общ общая общий ооо ооооочень
опоры опт основа основной остров ответы отстойник офис
парящий пеналы пенал переделанный переделка петлями пиво письменный плавные план плюс под
подвесная подвесной подсветке пойдешь полка полки после посудомойку потолок пример
прихожая прихожка прихожую проекта проем проём просчет просчёт прямая пум пупупу
рабочий радиусные размерам раковину раскрой реклама рекламации рекламация рекламка
рекламция реламация сан санузел сборка сверху сделает секции серая серверный сервис серый
скм скосом согласование спальная спальня список спк спонтанный справа срочная стекло
стеллаж стиралкой стк стол стройка сюда тебе террацо терраццо тест тетра типа тому
трассы трильяж труба тумба тумбы увеличенный угловая угловой углом узел
фабрика файл фальш фальшпанелью фасад фасадами фасады фаысавыф финал финальная финальное
финальный фосновной хзамер цоколя чертежи что шаблон ширина шка шкаф шкафы шпон щкаф
экспозитарий этот ящик ящики горнолыжка горящий ждоприсадка
""".split())

# Декоры и цвета, которые встречаются в названиях папок, но не являются именами.
STOP |= set("имбирь медовый галька сонома саличе тучка айконик светла".split())

# Совпадения целиком (в нижнем регистре), которые не считаются: названия плёнок/декоров,
# случайно похожие на имена (плёнка Адилет «Matte MAT-17» в vernissageData.ts).
ALLOW = set("антонио".split())

CYR = "а-яё"
LAT = "a-z"
WORD_RX = re.compile(r"[А-Яа-яЁёA-Za-z]{3,}")

# Транслитерация с вариантами для неоднозначных букв.
TR = {
    "а": ["a"], "б": ["b"], "в": ["v"], "г": ["g"], "д": ["d"], "е": ["e", "ye"], "ё": ["e", "yo", "io"],
    "ж": ["zh", "j"], "з": ["z"], "и": ["i"], "й": ["y", "i", "j"], "к": ["k"], "л": ["l"], "м": ["m"],
    "н": ["n"], "о": ["o"], "п": ["p"], "р": ["r"], "с": ["s"], "т": ["t"], "у": ["u"], "ф": ["f"],
    "х": ["kh", "h", "x"], "ц": ["ts", "c"], "ч": ["ch"], "ш": ["sh"], "щ": ["shch", "sch"],
    "ъ": [""], "ы": ["y", "i"], "ь": ["", "'"], "э": ["e"], "ю": ["yu", "iu", "ju"], "я": ["ya", "ia", "ja"],
}


def translits(word, cap=48):
    parts = [TR.get(ch, [ch]) for ch in word]
    out = set()
    for combo in itertools.product(*parts):
        out.add("".join(combo))
        if len(out) >= cap:
            break
    return {w for w in out if len(w) >= 4}


def load_decor_words(path):
    words = set()
    if not path or not os.path.isfile(path):
        return words
    try:
        src = open(path, "r", encoding="utf-8", errors="replace").read()
    except OSError:
        return words
    for m in re.finditer(r'"n"\s*:\s*"([^"]+)"', src):
        for w in WORD_RX.findall(m.group(1)):
            words.add(w.lower())
    return words


def load_tokens(index_path, decors_path, min_len):
    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("items") or data.get("files") or list(data.values())
    paths = []
    for e in data:
        p = e.get("path") if isinstance(e, dict) else None
        if isinstance(p, str) and p:
            paths.append(p.replace("/", "\\"))
    if not paths:
        raise ValueError("index.json: нет поля path")
    split = [p.split("\\") for p in paths]
    # общий корень (папка базы) не считается именем клиента
    prefix = 0
    while all(len(s) > prefix + 1 and s[prefix] == split[0][prefix] for s in split):
        prefix += 1
    stop = STOP | load_decor_words(decors_path)
    cyr, lat = set(), set()
    for s in split:
        for comp in s[prefix:]:
            comp = os.path.splitext(comp)[0]
            for w in WORD_RX.findall(comp):
                w = w.lower()
                if w in stop or len(w) < min_len:
                    continue
                if re.fullmatch(r"[а-яё]+", w):
                    cyr.add(w)
                elif re.fullmatch(r"[a-z]+", w):
                    lat.add(w)
    for w in list(cyr):
        lat |= translits(w)
    lat = {w for w in lat if w not in stop and len(w) >= max(4, min_len)}
    return cyr, lat


def build_regex(cyr, lat):
    alts = []
    for w in sorted(cyr, key=len, reverse=True):
        alts.append("(?<![%s])%s[%s]{0,3}(?![%s])" % (CYR, re.escape(w), CYR, CYR))
    for w in sorted(lat, key=len, reverse=True):
        alts.append("(?<![%s])%s[%s]{0,3}(?![%s])" % (LAT, re.escape(w), LAT, LAT))
    if not alts:
        return None
    return re.compile("|".join(alts), re.IGNORECASE)


def mask(s):
    return s[0] + "*" * (len(s) - 1) if s else "*"


def iter_files(root, excludes):
    root = os.path.abspath(root)
    if os.path.isfile(root):
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ALWAYS_SKIP_DIRS
                       and not any(x in os.path.join(dirpath, d).lower() for x in excludes)]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            if any(x in full.lower() for x in excludes):
                continue
            if os.path.splitext(fn)[1].lower() not in TEXT_EXT:
                continue
            yield full


def main(argv):
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--exclude", action="append", default=[])
    ap.add_argument("--index", default=DEFAULT_INDEX)
    ap.add_argument("--decors", default=DEFAULT_DECORS)
    ap.add_argument("--min-len", type=int, default=4)
    ap.add_argument("--quiet", action="store_true", help="только итог и код возврата")
    ap.add_argument("--ext", default="", help="ограничить расширениями, через запятую: .md,.txt")
    a = ap.parse_args(argv)
    if a.ext:
        TEXT_EXT.intersection_update({x.strip().lower() for x in a.ext.split(",") if x.strip()})
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    if not os.path.isfile(a.index):
        print("privacy-scan: нет index.json: %s" % a.index)
        return 2
    try:
        cyr, lat = load_tokens(a.index, a.decors, a.min_len)
    except Exception as e:
        print("privacy-scan: не прочитан index.json: %s" % e)
        return 2
    rx = build_regex(cyr, lat)
    if rx is None:
        print("privacy-scan: токенов нет")
        return 2
    excludes = [x.lower() for x in a.exclude]
    hits = []
    files = 0
    for root in a.paths:
        if not os.path.exists(root):
            print("privacy-scan: нет пути: %s" % root)
            return 2
        for fp in iter_files(root, excludes):
            try:
                if os.path.getsize(fp) > MAX_FILE:
                    continue
                with open(fp, "r", encoding="utf-8", errors="replace") as f:
                    files += 1
                    for n, line in enumerate(f, 1):
                        found = {m.group(0) for m in rx.finditer(line) if m.group(0).lower() not in ALLOW}
                        if found:
                            hits.append((fp, n, " ".join(sorted(mask(x) for x in found))))
            except OSError:
                continue
    if not a.quiet:
        for fp, n, m in hits:
            print("%s:%d  %s" % (fp, n, m))
    print("privacy-scan: файлов %d, токенов %d (+%d лат.), совпадений %d" % (files, len(cyr), len(lat), len(hits)))
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
