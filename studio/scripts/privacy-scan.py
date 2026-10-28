# -*- coding: utf-8 -*-
"""
privacy-scan.py — поиск имён клиентских папок базы заказов в текстовых файлах.

Три источника токенов (ни один не лежит в git):
  1. `Кухни\\corpus\\index.json` — кухонные клиенты (компоненты путей после общего корня);
  2. `--names-dir` — имена файлов/папок с проектами шкафных клиентов
     (по умолчанию `studio/public/local-projects`, если папка есть);
  3. `--tokens` — текстовый файл, слово в строке (старые имена примеров, клиенты из переписки);
     по умолчанию `Кухни\\corpus\\privacy-tokens.txt`, если файл есть. Явно указанный, но
     отсутствующий файл — ошибка (код 2), чтобы страж не молчал.
Минус стоп-слова мебели/служебные слова и декоры Lamarty (из web/assets/catalog-lamarty.js),
плюс латинские транслитерации. Сами токены в скрипте не хранятся и в вывод не попадают.

Запуск (только с -I, чтобы не подхватить чужой модуль из рабочей папки):
  py -I scripts/privacy-scan.py <путь>... [--exclude <подстрока>]... [--index <index.json>]
                                 [--names-dir <папка>]... [--tokens <файл>]
                                 [--decors <catalog-lamarty.js>] [--min-len 4] [--quiet]
Вывод: только `файл:строка  маска` (первая буква + звёздочки) и строка
«источники: index N, names-dir N, tokens N». Код возврата: 0 — чисто,
1 — есть совпадения, 2 — ошибка (нет index.json, нет указанного файла токенов и т. п.).
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
DEFAULT_NAMES_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "local-projects"))
DEFAULT_TOKENS = os.path.join(os.path.dirname(DEFAULT_INDEX), "privacy-tokens.txt")

TEXT_EXT = {".ts", ".tsx", ".js", ".cjs", ".mjs", ".md", ".json", ".html", ".css", ".py", ".ps1",
            ".txt", ".csv", ".yml", ".yaml", ".bat", ".svg", ".cmd", ".sh", ".toml", ".ini", ".env"}
ALWAYS_SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv"}
MAX_FILE = 50 * 1024 * 1024

# Стоп-слова: мебель, помещения, служебные слова файлов/папок, владелец цеха, поставщики.
# Это НЕ имена клиентов — список можно держать в репозитории.
STOP = set("""
autosave bazis kupe name prikhozhaya sanuzely shkaf kitchen kitchens wardrobe wardrobes academic demo project model
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


def add_words(text, stop, min_len, cyr, lat):
    """Слова из имени файла/папки → токены (кириллица и латиница отдельно)."""
    for w in WORD_RX.findall(text):
        w = w.lower()
        if w in stop or len(w) < min_len:
            continue
        if re.fullmatch(r"[а-яё]+", w):
            cyr.add(w)
        elif re.fullmatch(r"[a-z]+", w):
            lat.add(w)


def index_components(index_path):
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
    return [os.path.splitext(comp)[0] for s in split for comp in s[prefix:]]


def names_dir_components(path):
    """Имена файлов и папок первого уровня (без расширений); кухонные kitchen-* пропускаем."""
    out = []
    for name in os.listdir(path):
        base = os.path.splitext(name)[0]
        # служебные проекты: кухни базы, импорт шкафов, тестовые и демо-расчёты, расчёты заказов order-<номер>-<вариант>
        # (имена без клиентов) — не источник фамилий; order-7441182-mirror давал ложное «mirror» в manifest.json (mirrorX), 26.10
        # dp-<номер>-<зона> — обезличенные дизайн-проекты (dp-2810-hall, -kids…, 29.10): зона — обычное слово, не фамилия
        if base.startswith(("kitchen", "wardrobe-", "test-", "garderob-", "demo-", "order-", "dp-")):
            continue
        out.append(base)
    return out


def tokens_file_lines(path):
    out = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                out.append(line)
    return out


def load_tokens(index_path, decors_path, min_len, names_dirs=(), tokens_path=None):
    """Возвращает (cyr, lat, counts) — counts: сколько токенов дал каждый источник."""
    stop = STOP | load_decor_words(decors_path)
    cyr, lat = set(), set()
    counts = {}

    def take(label, components):
        c, l = set(), set()
        for comp in components:
            add_words(comp, stop, min_len, c, l)
        counts[label] = counts.get(label, 0) + len(c) + len(l)
        cyr.update(c)
        lat.update(l)

    take("index", index_components(index_path))
    for d in names_dirs:
        take("names-dir", names_dir_components(d))
    if tokens_path:
        take("tokens", tokens_file_lines(tokens_path))
    for w in list(cyr):
        lat |= translits(w)
    lat = {w for w in lat if w not in stop and len(w) >= max(4, min_len)}
    return cyr, lat, counts


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
    ap.add_argument("--names-dir", action="append", default=None,
                    help="папка с проектами клиентов: имена файлов/папок → токены (по умолчанию studio/public/local-projects)")
    ap.add_argument("--tokens", default=None,
                    help="файл со словами-токенами, по одному в строке (по умолчанию Кухни/corpus/privacy-tokens.txt, если есть)")
    ap.add_argument("--min-len", type=int, default=4)
    ap.add_argument("--quiet", action="store_true", help="только итог и код возврата")
    ap.add_argument("--strict", action="store_true",
                    help="все три источника обязательны: без local-projects и privacy-tokens.txt — код 2 (для publish.ps1)")
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
    names_dirs = a.names_dir
    if names_dirs is None:
        if a.strict and not os.path.isdir(DEFAULT_NAMES_DIR):
            print("privacy-scan: --strict: нет папки проектов клиентов: %s" % DEFAULT_NAMES_DIR)
            return 2
        names_dirs = [DEFAULT_NAMES_DIR] if os.path.isdir(DEFAULT_NAMES_DIR) else []
    if a.tokens is None and a.strict and not os.path.isfile(DEFAULT_TOKENS):
        print("privacy-scan: --strict: нет файла токенов: %s" % DEFAULT_TOKENS)
        return 2
    for d in names_dirs:
        if not os.path.isdir(d):
            print("privacy-scan: нет папки --names-dir: %s" % d)
            return 2
    tokens_path = a.tokens
    if tokens_path is None:
        tokens_path = DEFAULT_TOKENS if os.path.isfile(DEFAULT_TOKENS) else None
    elif not os.path.isfile(tokens_path):
        print("privacy-scan: нет файла --tokens: %s" % tokens_path)
        return 2
    try:
        cyr, lat, counts = load_tokens(a.index, a.decors, a.min_len, names_dirs, tokens_path)
    except Exception as e:
        print("privacy-scan: не прочитаны источники токенов: %s" % e)
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
    print("privacy-scan: источники: index %d, names-dir %d, tokens %d" % (
        counts.get("index", 0), counts.get("names-dir", 0), counts.get("tokens", 0)))
    print("privacy-scan: файлов %d, токенов %d (+%d лат.), совпадений %d" % (files, len(cyr), len(lat), len(hits)))
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
