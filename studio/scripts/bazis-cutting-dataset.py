# -*- coding: utf-8 -*-
"""Обезличенный датасет раскроев Базиса из PDF «Раскрой…» базы заказов.

Запуск (из папки studio):
    py -P scripts/bazis-cutting-dataset.py "C:\\Users\\My PC\\Desktop\\Пистос" tests/fixtures/cutting-bazis.json

Что берётся из PDF (текст через fitz/PyMuPDF):
  * страница карты: «Материал: …», «Размер плиты AxB», «Карта N из M. Количество плит материала K»,
    таблица деталей (Поз. / Длина / Ширина / Кол.; Кол. — на одну плиту карты, всего = Кол. × K),
    подписи деталей на чертеже «поз* AxB» (A — вдоль длинной стороны плиты) и «Обрезок AxB»;
  * сводка материала (на первой карте материала): «Количество плит материала = N», «КИМ = x%, с учетом обрезков = y%»,
    «Кол. резов = n», «Площадь панелей = s кв.м».
Группа = (PDF, материал). В фикстуру попадают ТОЛЬКО числа: хеш группы, лист, тип материала, флаг текстуры,
детали [длина, ширина, кол-во], число плит Базиса, обрезка края (trim — наименьшая из четырёх чисел на полях карт:
у Базиса чаще 12, но в части заказов 10/9/8/5/3), КИМ, резы, заполнение карт (% площади деталей от площади плиты),
крупнейший обрезок последней карты. Имён клиентов, адресов, номеров заказов
и названий декоров в фикстуре нет.

Правило «textured» (можно ли поворачивать детали в нашем прогоне):
  textured = false, если на картах Базиса хотя бы одна деталь группы лежит повёрнутой
  (подпись на чертеже «ширина x длина» при длине ≠ ширине или метка «<R>») — значит, технолог разрешил поворот;
  иначе textured = true (поворот запрещён). Название декора не используется для решения: даже однотонный декор,
  где Базис ничего не поворачивал, считаем «с текстурой», чтобы не дать нашему движку преимущества, которого не было
  у Базиса. Для справки пишется decorKind по каталогу студии (plain/wood/fantasy/unknown) и rotated — сколько деталей
  Базис положил повёрнутыми; rotatedTypes — типоразмеры [длина, ширина], которые Базис хоть раз повернул
  (для «строгого» прогона: поворачивать только их — вдруг у остальных деталей группы текстура была задана).
"""
import fitz, os, re, sys, json, hashlib, collections

ROOT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\My PC\Desktop\Пистос"
OUT = sys.argv[2] if len(sys.argv) > 2 else "tests/fixtures/cutting-bazis.json"
CATALOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "catalog.ts")
EXCLUDE = [os.sep + "пример" + os.sep]  # дубли учебных раскроев
DEBUG = os.environ.get("BAZIS_DEBUG") == "1"  # подробности по отбракованным группам — только в консоль, не в фикстуру

def num(s):
    return float(s.replace(",", ".").replace(" ", ""))

def first_num(s):
    m = re.match(r"\s*([\d]+(?:[.,]\d+)?)", s)
    return num(m.group(1)) if m else None

RE_CARD = re.compile(r"Карта (\d+) из (\d+)\. Количество плит материала (\d+)")
RE_MAT = re.compile(r"Материал: (.+)")
RE_SIZE = re.compile(r"Размер плиты (\d+)x(\d+)")
RE_TOTAL = re.compile(r"Количество плит материала = (\d+)")
RE_KIM = re.compile(r"КИМ = ([\d,]+)%, с учетом обрезков = ([\d,]+)%")
RE_CUTS = re.compile(r"Кол\. резов = (\d+)")
RE_PAREA = re.compile(r"Площадь панелей = ([\d,]+) кв\.м")
RE_LABEL = re.compile(r"^(.+?)\s+(\d+(?:,\d+)?)x(\d+(?:,\d+)?)$")

def load_catalog():
    try:
        txt = open(CATALOG, encoding="utf-8").read()
    except OSError:
        return {}
    out = {}
    for m in re.finditer(r'"n":\s*"([^"]+)",\s*"cat":\s*"([^"]+)"', txt):
        out[m.group(1).lower()] = m.group(2)
    return out

CAT = load_catalog()
WOOD = re.compile(r"дуб|орех|ясень|сосна|вяз|бук|клен|клён|венге|акаци|груш|ольх|вишн|тик|пайн|сонома|лиственниц|кедр|береза|берёза|зебрано|махагон|секвой|эвкалипт|робиния|гикори|wood|oak", re.I)

def decor_kind(material):
    name = re.sub(r"\(.*?\)", "", material)
    name = re.sub(r"^(ЛДСП|ДСП|ЛХДФ|ХДФ|ДВП|МДФ)\s*", "", name.strip(), flags=re.I)
    name = re.sub(r"^(Lamarty|Kronospan|Egger|Увадрев|Nordeco|Swiss ?Krono|Кроношпан|Эггер)\s*", "", name.strip(), flags=re.I).strip()
    cat = CAT.get(name.lower())
    if cat:
        return {"Однотонные": "plain", "Светлое дерево": "wood", "Темное дерево": "wood", "Фантазия": "fantasy"}.get(cat, "unknown")
    if WOOD.search(name):
        return "wood"
    return "unknown"

def material_type(material):
    m = material.lower()
    if re.search(r"хдф|двп|hdf", m):
        return "hdf"
    if re.search(r"дсп", m):
        return "ldsp"
    return "other"

def parse_table(lines):
    """Таблица карты: Поз. … ИТОГО / Длина … / Ширина … / Кол. … итог. Возвращает [(поз, L, W, qty)]."""
    try:
        i = lines.index("Поз.")
    except ValueError:
        return None
    pos = []
    j = i + 1
    while j < len(lines) and lines[j] != "ИТОГО":
        pos.append(lines[j].strip())
        j += 1
    n = len(pos)
    try:
        a = lines.index("Длина", j)
        b = lines.index("Ширина", a)
        c = lines.index("Кол.", b)
    except ValueError:
        return None
    L = [first_num(x) for x in lines[a + 1:a + 1 + n]]
    W = [first_num(x) for x in lines[b + 1:b + 1 + n]]
    Q = [first_num(x) for x in lines[c + 1:c + 1 + n]]
    if len(L) != n or len(W) != n or len(Q) != n or None in L or None in W or None in Q:
        return None
    return [(pos[k], L[k], W[k], int(Q[k])) for k in range(n)]

def norm_pos(s):
    # «75(70) <R>» — Базис помечает повёрнутую деталь; «⊐» — фигурная. Для сопоставления с таблицей убираем метки.
    # «(ПОДРЕЗАТЬ30)» / «(Подрезать до 45)» — узкая деталь кроится заготовкой 59 мм (ValueDetailsJoining) и подрезается.
    return re.sub(r"\(\s*подрезать[^)]*\)|<[^>]*>|[\s⊐]+", "", s, flags=re.I)

def main():
    groups = collections.OrderedDict()
    problems = collections.Counter()
    files = 0
    for dp, dn, fn in os.walk(ROOT):
        dn.sort()
        for f in sorted(fn):
            if not f.lower().endswith(".pdf") or "аскрой" not in f:
                continue
            path = os.path.join(dp, f)
            if any(x in path + os.sep for x in EXCLUDE):
                problems["excluded_example"] += 1
                continue
            files += 1
            try:
                doc = fitz.open(path)
            except Exception:
                problems["open_fail"] += 1
                continue
            rel = os.path.relpath(path, ROOT)
            for pg in doc:
                t = pg.get_text()
                m = RE_CARD.search(t)
                if not m:
                    continue
                lines = [x.strip() for x in t.split("\n")]
                mat = RE_MAT.search(t)
                size = RE_SIZE.search(t)
                if not mat or not size:
                    problems["card_without_header"] += 1
                    continue
                material = mat.group(1).strip()
                key = (rel, material)
                g = groups.setdefault(key, {"rel": rel, "material": material, "cards": [], "summary": None,
                                            "sheet": (int(size.group(1)), int(size.group(2)))})
                if g["sheet"] != (int(size.group(1)), int(size.group(2))):
                    problems["mixed_sheet_size"] += 1
                    g["mixed"] = True
                    if DEBUG: print("  mixed sheet:", rel, material, g["sheet"], size.group(0), file=sys.stderr)
                if RE_TOTAL.search(t):
                    kim = RE_KIM.search(t)
                    cuts = RE_CUTS.search(t)
                    parea = RE_PAREA.search(t)
                    g["summary"] = {
                        "total": int(RE_TOTAL.search(t).group(1)),
                        "kim": num(kim.group(1)) if kim else None,
                        "kimOff": num(kim.group(2)) if kim else None,
                        "cuts": int(cuts.group(1)) if cuts else None,
                        "parea": num(parea.group(1)) if parea else None,
                    }
                rows = parse_table(lines)
                if rows is None:
                    problems["table_parse_fail"] += 1
                    g["bad"] = True
                    continue
                # обрезка края листа: первые четыре числа страницы карты (у Базиса 12, но бывает 10/9/8/5/3)
                trims = []
                for ln in lines[:6]:
                    if re.fullmatch(r"\d+(?:,\d+)?", ln):
                        trims.append(num(ln))
                    else:
                        break
                if len(trims) == 4:
                    g["trim"] = min(g.get("trim", 1e9), min(trims))
                # подписи на чертеже — до строки «Количество плит материала =» / «Дата:»
                labels, offcuts = [], []
                for ln in lines:
                    if ln.startswith("Количество плит") or ln.startswith("Дата"):
                        break
                    lm = RE_LABEL.match(ln)
                    if not lm:
                        continue
                    a, b = num(lm.group(2)), num(lm.group(3))
                    if lm.group(1).startswith("Обрезок"):
                        offcuts.append((a, b))
                    else:
                        labels.append((norm_pos(lm.group(1)), a, b))
                g["cards"].append({"n": int(m.group(1)), "of": int(m.group(2)), "k": int(m.group(3)),
                                   "rows": rows, "labels": labels, "offcuts": offcuts})
    out = []
    seen = {}
    stats = collections.Counter()
    for key, g in groups.items():
        if g.get("bad") or not g["cards"]:
            problems["group_dropped_bad_table"] += 1
            continue
        # PDF иногда содержит один и тот же раскрой дважды (печать двух копий) — одинаковые карты берём один раз
        uniq = {}
        for c in g["cards"]:
            uniq.setdefault((c["n"], c["of"], c["k"], tuple(c["rows"])), c)
        if len(uniq) < len(g["cards"]):
            problems["duplicate_cards_merged"] += 1
        cards = sorted(uniq.values(), key=lambda c: c["n"])
        if len({c["n"] for c in cards}) != len(cards) or cards[-1]["of"] != len(cards):
            problems["group_dropped_cards_mismatch"] += 1
            if DEBUG: print("  cards mismatch:", g["rel"], g["material"], [(c["n"], c["of"], c["k"]) for c in cards], file=sys.stderr)
            continue
        L0, W0 = g["sheet"]
        sheets = sum(c["k"] for c in cards)
        parts = collections.Counter()
        rotated = 0
        rotTypes = set()
        unmatched = 0
        fills = []
        for c in cards:
            byPos = collections.defaultdict(list)
            area = 0.0
            for pos, L, W, q in c["rows"]:
                parts[(L, W)] += q * c["k"]
                byPos[norm_pos(pos)].append((L, W))
                area += L * W * q
            fills += [round(area / (L0 * W0) * 100, 1)] * c["k"]
            for pos, a, b in c["labels"]:
                cand = byPos.get(pos)
                if not cand:
                    unmatched += 1
                    if DEBUG: print("  unmatched label (no pos):", pos, a, b, list(byPos)[:6], file=sys.stderr)
                    continue
                L, W = cand[0]
                if abs(a - L) < 0.6 and abs(b - W) < 0.6:
                    continue
                if abs(a - W) < 0.6 and abs(b - L) < 0.6 and abs(L - W) >= 0.6:
                    rotated += c["k"]
                    rotTypes.add((L, W))
                else:
                    unmatched += 1
                    if DEBUG: print("  unmatched label (dims):", pos, a, b, cand, file=sys.stderr)
        s = g["summary"]
        if g.get("mixed"):
            problems["group_dropped_mixed_sheet"] += 1
            continue
        if s and s["total"] != sheets:
            problems["summary_sheet_mismatch"] += 1
            if DEBUG: print("  summary mismatch:", g["rel"], g["material"], s["total"], sheets, [(c["n"], c["of"], c["k"]) for c in cards], file=sys.stderr)
        partArea = sum(L * W * q for (L, W), q in parts.items()) / 1e6
        if s and s["parea"] and abs(s["parea"] - partArea) > 0.02 + 0.002 * partArea:
            problems["summary_area_mismatch"] += 1
        mtype = material_type(g["material"])
        if mtype == "other":
            problems["material_other_skipped"] += 1
            continue
        plist = sorted(([L, W, q] for (L, W), q in parts.items()), key=lambda r: (-r[0], -r[1]))
        sig = json.dumps([[L0, W0], plist])
        if sig in seen:
            problems["duplicate_group_skipped"] += 1
            stats[("dup", mtype, L0, W0)] += 1
            stats[("dupSheets", mtype, L0, W0)] += sheets
            if DEBUG: print("  duplicate:", g["rel"], "==", seen[sig], file=sys.stderr)
            continue
        gid = hashlib.sha1((g["rel"] + "|" + g["material"]).encode("utf-8")).hexdigest()[:10]
        seen[sig] = gid
        last_off = max(cards[-1]["offcuts"], key=lambda o: o[0] * o[1], default=None)
        rec = {
            "group": gid,
            "sheet": [L0, W0],
            "material": mtype,
            "textured": rotated == 0,
            "decorKind": decor_kind(g["material"]),
            "rotated": rotated,
            "parts": plist,
            "bazisSheets": sheets,
            "bazisCardFill": fills,
        }
        if rotTypes:
            rec["rotatedTypes"] = sorted(([L, W] for L, W in rotTypes), key=lambda r: (-r[0], -r[1]))
        if "trim" in g:
            rec["trim"] = g["trim"]
        if last_off:
            rec["bazisLastOffcut"] = [last_off[0], last_off[1]]
        if s:
            if s["kim"] is not None:
                rec["kim"] = s["kim"]
                rec["kimWithOffcuts"] = s["kimOff"]
            if s["cuts"] is not None:
                rec["cuts"] = s["cuts"]
        if unmatched:
            rec["unmatchedLabels"] = unmatched
        out.append(rec)
        stats[(mtype, L0, W0)] += 1
        stats[("sheets", mtype, L0, W0)] += sheets
        stats[("parts", mtype, L0, W0)] += sum(q for *_, q in plist)
        stats[("textured", mtype, L0, W0, rec["textured"])] += 1
        stats[("kind", mtype, rec["decorKind"], rec["textured"])] += 1
    out.sort(key=lambda r: r["group"])
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in out) + "\n]\n")
    print("PDF:", files, "групп:", len(out))
    for k, v in sorted(stats.items(), key=lambda kv: str(kv[0])):
        print(" ", k, v)
    print("Проблемы:", dict(problems))

if __name__ == "__main__":
    main()
