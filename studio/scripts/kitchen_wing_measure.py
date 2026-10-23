# Замер второго крыла Г-кухни (ветка claude/w-lwing, 23.10.2026) — копия сценария тестера кухонь 22.10 (run.py) с отличиями:
#   py kitchen_wing_measure.py <kNN> <метка> <порт> <папка> <spec.json>
#   - сборка своя (порт 8140+), семантика палитры — новой сборки («Низ навесных», pal_new);
#   - перед проверкой модуля фокус уходит из поля (как следующий клик менеджера) — итог читается после применения;
#     сообщение, пришедшее при этом, считается отказом. Действия менеджера — те же, что у тестера (поворот, X, Z по одному).
# Клиентских данных нет: только номера kNN и размеры модулей из spec.json тестера.
import json, sys, time, os, re
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

KIT, BUILD, PORT, OUTDIR, SPECF = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
SPEC = json.load(open(SPECF, encoding="utf-8"))[KIT]
LABEL = BUILD
BUILD = "new"
LIMIT = 600.0
OFF = 21
os.makedirs(OUTDIR, exist_ok=True)

cnt = {"left": 0, "right": 0, "inputs": 0, "keys": 0, "drags": 0, "panels": 0}
errors, deadends, log = [], [], []
t0 = None

def L(*a):
    log.append([round(time.time() - (t0 or time.time()), 2)] + [str(x) for x in a])

def mark():
    global t0
    if t0 is None:
        t0 = time.time()

def elapsed():
    return time.time() - t0 if t0 else 0.0

pw = sync_playwright().start()
br = pw.chromium.launch(channel="chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
ctx = br.new_context(viewport={"width": 1366, "height": 768}, accept_downloads=True)
pg = ctx.new_page()
pg.on("dialog", lambda d: d.accept())
pg.goto(f"http://127.0.0.1:{PORT}/studio/?fresh=1")
pg.wait_for_timeout(4000)

STATE_JS = """(()=>{const s=JSON.parse(localStorage.getItem('garderyob-rooms-v1')||'null');if(!s)return [];const r=s.rooms.find(r=>r.id===s.activeRoomId);
return r.project.modules.map(m=>{const u=m.module;const k=u.kitchen||{};return {id:m.id,name:u.name,x:m.x,y:m.y,z:m.z,rot:m.rotation||0,w:u.width,h:u.height,d:u.depth,role:k.role,app:k.appliance||null,col:k.column?k.column.kind:null,feet:u.feet?u.feet.height:null,doors:u.doors,bottom:u.bottom,sh:(u.sections||[]).map(s=>(s.shelves||[]).length),dr:(u.sections||[]).map(s=>s.drawers),own:!!u.ownWidthOnly,wt:!!u.worktop}})})()"""

def state():
    pg.wait_for_timeout(250)
    return pg.evaluate(STATE_JS)

def vis(sel):
    return pg.locator(sel + " >> visible=true").first

def lab(l):
    return f'[aria-label="{l}"]'

def open_ancestors(sel):
    loc = pg.locator(sel).first
    for _ in range(4):
        if loc.count() == 0:
            return False
        if loc.is_visible():
            return True
        h = loc.element_handle()
        s = h.evaluate_handle("e=>{let p=e.parentElement,top=null;while(p){if(p.tagName==='DETAILS'&&!p.open)top=p;p=p.parentElement}return top?top.querySelector(':scope>summary'):null}")
        el = s.as_element()
        if not el:
            return loc.is_visible()
        mark(); el.click(); cnt["left"] += 1; cnt["panels"] += 1
        L("panel", (el.inner_text() or "").split("\n")[0][:40])
        pg.wait_for_timeout(250)
    return loc.is_visible()

def click(sel, what="", panel=False, right=False):
    mark()
    if not open_ancestors(sel):
        pass
    l = vis(sel)
    if right:
        l.click(button="right", timeout=5000); cnt["right"] += 1
    else:
        l.click(timeout=5000); cnt["left"] += 1
    if panel: cnt["panels"] += 1
    L("click", what or sel)
    pg.wait_for_timeout(200)

def toast():
    try:
        t = pg.evaluate("""(()=>{const e=[...document.querySelectorAll('div,section')].find(x=>x.innerText&&x.innerText.startsWith('Изменение не применено')&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().width<700);return e?e.innerText.replace(/\\n/g,' ').slice(0,260):null})()""")
    except Exception:
        t = None
    return t

def fill(label, v, end="Enter"):
    mark()
    sel = lab(label)
    open_ancestors(sel)
    l = vis(sel)
    l.click(timeout=5000); cnt["left"] += 1
    pg.keyboard.press("Control+a")
    pg.keyboard.type(str(v))
    if end: pg.keyboard.press(end)
    cnt["inputs"] += 1; cnt["keys"] += 2 + len(str(v)) if end else 1 + len(str(v))
    L("fill", label, v)
    pg.wait_for_timeout(450)
    t = toast()
    if t:
        errors.append(f"{label}={v}: {t}")
        L("toast", t)
    return t

def setcheck(label, want):
    sel = lab(label)
    if not open_ancestors(sel):
        return False
    l = vis(sel)
    if l.is_checked() != want:
        mark(); l.click(timeout=5000); cnt["left"] += 1
        L("check", label, want)
        pg.wait_for_timeout(450)
        t = toast()
        if t: errors.append(f"{label}={want}: {t}"); L("toast", t)
    return True

def select(label, text):
    mark()
    sel = lab(label)
    open_ancestors(sel)
    l = vis(sel)
    l.click(timeout=5000); cnt["left"] += 1
    l.select_option(label=text); cnt["left"] += 1
    L("select", label, text)
    pg.wait_for_timeout(500)
    t = toast()
    if t: errors.append(f"{label}={text}: {t}"); L("toast", t)
    return t

def field_val(label):
    l = pg.locator(lab(label) + " >> visible=true")
    if l.count() == 0:
        l = pg.locator(lab(label))
        if l.count() == 0: return None
    try:
        return float(l.first.input_value())
    except Exception:
        return None

def palette_buttons(prefix):
    return pg.evaluate("""(p)=>[...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).filter(a=>{const m=a.match(/^(.*) (\\d+)$/);return m&&m[1]===p}).map(a=>+a.split(' ').pop())""", prefix)

def height_label():
    for l in ("Высота с опорами", "Высота"):
        if pg.locator(lab(l)).count() > 0:
            return l
    return "Высота"

def others_changed(before, after, mid):
    b = {m["id"]: m for m in before if m["id"] != mid}
    ch = []
    for m in after:
        if m["id"] in b:
            o = b[m["id"]]
            if any(abs((o[k] or 0) - (m[k] or 0)) > 0.4 for k in ("x", "y", "z", "w", "h", "d")):
                ch.append(m["name"])
    return ch

def guarded_fill(label, v, mid):
    before = state()
    t = fill(label, v)
    after = state()
    ch = others_changed(before, after, mid)
    if ch:
        deadends.append(f"{label}={v}: изменились соседи {ch} -> Ctrl+Z, затем 'только этого корпуса'")
        L("dead", label, ch)
        mark(); pg.keyboard.press("Control+z"); cnt["keys"] += 1
        pg.wait_for_timeout(500)
        setcheck("Менять ширину только этого корпуса", True)
        t = fill(label, v)
    elif t and "сосед" in t and label == "Ширина":
        deadends.append(f"{label}={v}: отказ из-за соседа -> галочка 'только этого корпуса' и повтор")
        setcheck("Менять ширину только этого корпуса", True)
        t = fill(label, v)
    return t

created = {}
results = []
stopped = None

def cur(mid):
    for m in state():
        if m["id"] == mid: return m
    return None

try:
    # open kitchen tab
    click('button:has-text("Кухонные модули")', "tab Кухонные модули")
    for spec in SPEC["modules"]:
        if elapsed() > LIMIT:
            stopped = f"лимит 10 мин до {spec['key']}"; break
        key = spec["key"]
        before_ids = {m["id"] for m in state()}
        pal = spec.get("pal_" + BUILD, spec.get("pal"))
        note = spec.get("note_" + BUILD)
        if note: deadends.append(f"{key}: {note}")
        if spec.get("first"):
            tile = "Навесной кухонный" if spec["kind"] in ("wall", "antresol") else "Нижний кухонный"
            click(f'button:has-text("{tile}") >> nth=0', "tile " + tile)
            fill("Ширина новой мебели", spec["W"], "Tab")
            fill("Высота новой мебели", spec["H"], "Tab")
            fill("Глубина новой мебели", spec["D"], "Tab")
            click('button:has-text("Добавить в комнату")', "Добавить в комнату")
            pg.wait_for_timeout(900)
        else:
            if spec["kind"] == "wall" and BUILD == "new" and pg.locator(lab("Низ навесных от пола")).count() > 0:
                v = field_val("Низ навесных от пола")
                if v is None or abs(v - spec["Y"]) > 0.4:
                    fill("Низ навесных от пола", spec["Y"])
            widths = palette_buttons(pal)
            if not widths:
                open_ancestors(lab(pal + " 600"))
                widths = palette_buttons(pal)
            if not widths:
                deadends.append(f"{key}: нет кнопки палитры '{pal}'"); L("dead", "no palette", pal)
                results.append({"key": key, "status": "нет в палитре"}); continue
            w = min(widths, key=lambda x: (abs(x - spec["W"]), -x))
            click(lab(f"{pal} {w}"), f"palette {pal} {w}")
            pg.wait_for_timeout(700)
        st = state()
        new = [m for m in st if m["id"] not in before_ids]
        if not new and spec.get("fb") and not spec.get("first"):
            t = toast()
            errors.append(f"{key}: '{pal}' не добавлен: {t or ''}")
            deadends.append(f"{key}: '{pal}' из палитры не добавился -> обход через '{spec['fb']}'")
            fbw = palette_buttons(spec["fb"])
            w = min(fbw, key=lambda x: (abs(x - spec["W"]), -x))
            click(lab(f"{spec['fb']} {w}"), f"palette {spec['fb']} {w}")
            pg.wait_for_timeout(700)
            st = state()
            new = [m for m in st if m["id"] not in before_ids]
        if not new and not spec.get("first") and spec["kind"] != "tall":
            t = toast()
            errors.append(f"{key}: палитра не добавила: {t or ''}")
            deadends.append(f"{key}: палитра не добавила модуль -> обход через форму 'Добавить мебель' (размеры + Добавить в комнату)")
            tile = "Навесной кухонный" if spec["kind"] in ("wall", "antresol") else "Нижний кухонный"
            click(f'button:has-text("{tile}") >> nth=0', "tile " + tile)
            fill("Ширина новой мебели", spec["W"], "Tab")
            fill("Высота новой мебели", spec["H"], "Tab")
            fill("Глубина новой мебели", spec["D"], "Tab")
            click('button:has-text("Добавить в комнату")', "Добавить в комнату")
            pg.wait_for_timeout(900)
            st = state()
            new = [m for m in st if m["id"] not in before_ids]
        if not new:
            t = toast()
            errors.append(f"{key}: модуль не добавлен {t or ''}")
            deadends.append(f"{key}: добавление не прошло")
            results.append({"key": key, "status": "не добавлен"}); continue
        mid = new[-1]["id"]; created[key] = mid
        m = new[-1]
        L("added", key, m["name"], m["x"], m["y"], m["z"], m["w"], m["h"], m["d"])
        # ops before dims
        for op in spec.get("ops", []):
            if op.startswith("assign:"):
                select("Назначение кухонного модуля", op.split(":", 1)[1])
        for op in spec.get("ops", []):
            if op == "legs_off": setcheck("Опоры под корпусом", False)
        def do_dims():
            # dims
            m = cur(mid)
            if abs(m["w"] - spec["W"]) > 0.4:
                guarded_fill("Ширина", spec["W"], mid)
            m = cur(mid)
            if abs(m["h"] - spec["H"]) > 0.4:
                t = guarded_fill(height_label(), spec["H"], mid)
                if t and "границ" in t:
                    deadends.append(f"{key}: высота {spec['H']} не влезла до потолка от авто-положения -> сначала 'От пола' {spec['Y']}, потом высота")
                    fill("От пола", spec["Y"])
                    guarded_fill(height_label(), spec["H"], mid)
            m = cur(mid)
            if abs(m["d"] - spec["D"]) > 0.4:
                guarded_fill("Глубина", spec["D"], mid)
            m = cur(mid)
            for kk, nm in (("w", "W"), ("h", "H"), ("d", "D")):
                if abs(m[kk] - spec[nm]) > 0.4:
                    deadends.append(f"{key}: {nm}={spec[nm]} не применилось, осталось {m[kk]}")
        def do_pos():
            global OFF
            # position
            rot = spec.get("rot", 0)
            if spec.get("first"):
                fv = field_val("От левой стены")
                if fv is None:
                    open_ancestors(lab("От левой стены")); fv = field_val("От левой стены")
                OFF = (fv if fv is not None else 0)
                L("OFF", OFF)
            tx = 0 if spec["X"] == 0 else spec["X"] + 21
            ty = spec["Y"]; tz = spec.get("Z", 0)
            if rot:
                rv = pg.locator(lab("Поворот кухонного модуля")).first.input_value()
                if str(rv) != str(rot):
                    v = field_val("От задней стены")
                    if v is None or abs(v - max(tz, 700)) > 0.4: fill("От задней стены", max(tz, 700))
                    t = select("Поворот кухонного модуля", f"{rot}°")
                    rv = pg.locator(lab("Поворот кухонного модуля")).first.input_value()
                    if str(rv) != str(rot):
                        deadends.append(f"{key}: поворот {rot} не применился ({(t or '')[:90]}) -> увожу корпус в середину комнаты и поворачиваю снова")
                        fill("От задней стены", 1500)
                        t = select("Поворот кухонного модуля", f"{rot}°")
                for _ in range(2):
                    v = field_val("От левой стены")
                    if v is None or abs(v - tx) > 0.4: fill("От левой стены", tx)
                    v = field_val("От задней стены")
                    if v is None or abs(v - tz) > 0.4: fill("От задней стены", tz)
                    vx, vz = field_val("От левой стены"), field_val("От задней стены")
                    if vx is not None and vz is not None and abs(vx - tx) <= 0.4 and abs(vz - tz) <= 0.4:
                        break
            else:
                for _ in range(2):
                    v = field_val("От левой стены")
                    if v is None or abs(v - tx) > 0.4: fill("От левой стены", tx)
                    v = field_val("От задней стены")
                    if v is None or abs(v - tz) > 0.4: fill("От задней стены", tz)
                    v = field_val("От пола")
                    if v is None or abs(v - ty) > 0.4: fill("От пола", ty)
                    vx, vz, vy = field_val("От левой стены"), field_val("От задней стены"), field_val("От пола")
                    if None not in (vx, vz, vy) and abs(vx - tx) <= 0.4 and abs(vz - tz) <= 0.4 and abs(vy - ty) <= 0.4:
                        break
            v = field_val("От пола")
            if v is None or abs(v - ty) > 0.4: fill("От пола", ty)
        if spec.get('rot', 0):
            do_pos(); do_dims(); do_pos()
        else:
            do_dims(); do_pos()
        # other ops
        for op in spec.get("ops", []):
            if op == "facades_off": setcheck("Распашные фасады", False)
            elif op == "bottom_off": setcheck("Дно корпуса", False)
            elif op.startswith("shelves:"):
                n = op.split(":")[1]
                sel = lab("Количество полок кухонного модуля")
                open_ancestors(sel)
                try:
                    if vis(sel).input_value() != n: select("Количество полок кухонного модуля", n)
                except Exception as e:
                    deadends.append(f"{key}: полки {n}: {str(e)[:80]}")
        rot = spec.get('rot', 0)
        tx = 0 if spec['X'] == 0 else spec['X'] + 21
        ty = spec['Y']; tz = spec.get('Z', 0)
        # verify: фокус уходит из поля (как следующий клик менеджера), итог — после применения
        pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
        pg.wait_for_timeout(450)
        t = toast()
        if t and (not errors or not errors[-1].endswith(t)):
            errors.append(f"{key} выход из поля: {t}"); L("toast", t)
        m = cur(mid)
        fx, fz, fy = field_val("От левой стены"), field_val("От задней стены"), field_val("От пола")
        res = {"key": key, "name": m["name"], "role": m["role"], "app": m["app"], "col": m["col"],
               "W": m["w"], "H": m["h"], "D": m["d"], "fx": fx, "fy": fy, "fz": fz, "rot": m["rot"],
               "dims_ok": all(abs(a - b) <= 2 for a, b in ((m["w"], spec["W"]), (m["h"], spec["H"]), (m["d"], spec["D"]))),
               "pos_ok": (fx is not None and abs(fx - tx) <= 2 and abs((fy or 0) - ty) <= 2 and abs((fz or 0) - tz) <= 2 and int(m["rot"]) == int(rot)),
               "t": round(elapsed(), 1)}
        results.append(res)
        L("verify", json.dumps(res, ensure_ascii=False))
    if not stopped and SPEC.get("worktop") and elapsed() <= LIMIT:
        try:
            click(lab("Столешница над нижними"), "Столешница над нижними")
            pg.wait_for_timeout(800)
        except Exception as e:
            deadends.append("столешница: " + str(e)[:120])
except Exception as e:
    stopped = "исключение: " + str(e)[:300]
    L("exc", str(e)[:300])

secs = round(elapsed(), 1)
final = state()
# screenshots (outside timing)
try:
    pg.screenshot(path=os.path.join(OUTDIR, f"{KIT}-{LABEL}-end.png"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    for nm, b in (("front", "Спереди"), ("top", "Сверху")):
        try:
            pg.locator(f'button:has-text("{b}") >> visible=true').first.click(timeout=3000)
            pg.wait_for_timeout(1200)
            pg.screenshot(path=os.path.join(OUTDIR, f"{KIT}-{LABEL}-{nm}.png"))
        except Exception:
            pass
except Exception:
    pass
price = None
try:
    price = pg.evaluate("(()=>{const e=[...document.querySelectorAll('footer *, .bottom-bar *, body *')].find(x=>/^[\\d\\s ]+₽$/.test((x.innerText||'').trim())&&x.children.length===0);return e?e.innerText.trim():null})()")
except Exception:
    pass
out = {"kit": KIT, "build": LABEL, "seconds": secs, **cnt, "errors": errors, "deadends": deadends, "stopped": stopped,
       "modules_total": len(SPEC["modules"]), "results": results, "final_state": final, "price": price, "log": log}
json.dump(out, open(os.path.join(OUTDIR, f"{KIT}-{LABEL}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ok_dims = sum(1 for r in results if r.get("dims_ok"))
ok_pos = sum(1 for r in results if r.get("dims_ok") and r.get("pos_ok"))
print(json.dumps({"kit": KIT, "build": LABEL, "seconds": secs, **cnt, "n_err": len(errors), "n_dead": len(deadends), "stopped": stopped,
                  "dims_ok": ok_dims, "pos_ok": ok_pos, "total": len(SPEC["modules"]), "price": price}, ensure_ascii=False))
for r in results:
    print(json.dumps({k: r.get(k) for k in ("key", "name", "W", "H", "D", "fx", "fy", "fz", "rot", "dims_ok", "pos_ok", "status", "t")}, ensure_ascii=False))
for e in errors: print("ERR", e)
for d in deadends: print("DEAD", d)
ctx.close(); br.close(); pw.stop()
