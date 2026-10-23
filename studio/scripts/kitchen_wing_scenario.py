# Сценарий мышью как менеджер (w-lwing, 23.10.2026): «Кухня угловая (Г)» из палитры и «Поставить к стене» / «За угол» в панели
# «Положение». Playwright + системный Chrome headless (swiftshader), окно 1366×768, своя сборка; действия — только мышь и клавиатура,
# состояние проекта читается из localStorage только для проверки. Снимки — в папку из аргумента.
#   py kitchen_wing_scenario.py <порт> <папка>
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

PORT, OUT = int(sys.argv[1]), sys.argv[2]
os.makedirs(OUT, exist_ok=True)
cnt = {"left": 0, "right": 0, "inputs": 0, "keys": 0}
errors = []
STATE_JS = """(()=>{const s=JSON.parse(localStorage.getItem('garderyob-rooms-v1')||'null');if(!s)return null;const r=s.rooms.find(r=>r.id===s.activeRoomId);
return {room:r.project.room,modules:r.project.modules.map(m=>({id:m.id,name:m.module.name,x:m.x,y:m.y||0,z:m.z,rot:m.rotation||0,w:m.module.width,h:m.module.height,d:m.module.depth,role:m.module.kitchen?m.module.kitchen.role:null,worktop:!!m.module.worktop,corner:!!(m.module.kitchen&&m.module.kitchen.faceFiller&&m.module.kitchen.faceFiller.facadeMat),off:!!m.module.autoFillersOff}))}})()"""
TOAST_JS = """(()=>{const e=[...document.querySelectorAll('div,section')].find(x=>x.innerText&&x.innerText.startsWith('Изменение не применено')&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().width<700);return e?e.innerText.replace(/\\n/g,' ').slice(0,260):null})()"""

pw = sync_playwright().start()
br = pw.chromium.launch(channel="chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
ctx = br.new_context(viewport={"width": 1366, "height": 768})
pg = ctx.new_page()
pg.on("dialog", lambda d: d.accept())
pg.goto(f"http://127.0.0.1:{PORT}/studio/?fresh=1")
pg.wait_for_timeout(4000)

def vis(sel): return pg.locator(sel + " >> visible=true").first
def click(sel, right=False):
    l = vis(sel); l.scroll_into_view_if_needed(); l.click(button="right" if right else "left", timeout=8000)
    cnt["right" if right else "left"] += 1; pg.wait_for_timeout(400)
def fill(label, v, end="Enter"):
    l = vis(f'[aria-label="{label}"]'); l.scroll_into_view_if_needed(); l.click(timeout=8000); cnt["left"] += 1
    pg.keyboard.press("Control+a"); pg.keyboard.type(str(v)); cnt["inputs"] += 1; cnt["keys"] += 1 + len(str(v))
    if end: pg.keyboard.press(end); cnt["keys"] += 1
    pg.wait_for_timeout(450)
    t = pg.evaluate(TOAST_JS)
    if t: errors.append(f"{label}={v}: {t}")
def open_ancestors(sel):
    # как у тестера: раскрыть свёрнутые группы (details) над элементом кликом по их заголовку
    loc = pg.locator(sel).first
    for _ in range(4):
        if loc.count() == 0 or loc.is_visible(): return
        el = loc.element_handle().evaluate_handle("e=>{let p=e.parentElement,top=null;while(p){if(p.tagName==='DETAILS'&&!p.open)top=p;p=p.parentElement}return top?top.querySelector(':scope>summary'):null}").as_element()
        if not el: return
        el.click(); cnt["left"] += 1; pg.wait_for_timeout(300)
def shot(name):
    pg.screenshot(path=os.path.join(OUT, name)); print("снимок", name)
def views(prefix):
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    for nm, b in (("top", "Сверху"), ("3d", "3D")):
        try:
            loc = pg.locator(f'.view-tabs button:has-text("{b}") >> visible=true')
            
            loc.first.click(timeout=3000); pg.wait_for_timeout(1500); shot(f"{prefix}-{nm}.png")
        except Exception as e:
            print("вид", b, "нет:", str(e)[:80])

res = {}
try:
    # 1. Угловая кухня 3000 × 2400 из палитры «Кухонные модули»
    click('button:has-text("Кухонные модули")')
    click('button:has-text("Кухня угловая (Г)")')
    fill("По задней стене новой мебели", 3000, "Tab")
    fill("По боковой стене новой мебели", 2400, "Tab")
    click('button:has-text("Добавить в комнату")')
    pg.wait_for_timeout(1500)
    st = pg.evaluate(STATE_JS)
    t = pg.evaluate(TOAST_JS)
    if t: errors.append("угловая кухня: " + t)
    mods = st["modules"] if st else []
    res["corner_kitchen"] = {"actions": dict(cnt), "modules": len(mods), "worktops": sum(1 for m in mods if m["worktop"]), "corner": sum(1 for m in mods if m["corner"]),
                             "wing_bases": sum(1 for m in mods if m["role"] == "base" and m["rot"] != 0), "wing_walls": sum(1 for m in mods if m["role"] == "wall" and m["rot"] != 0), "room": st["room"] if st else None}
    shot("g-kitchen-end.png")
    views("g-kitchen")
    # 2. Пенал из «Готовых кухонных модулей» → «Поставить к левой стене» (панель «Положение», одна кнопка):
    #    поворот фасадом в комнату и спина к стене — одним действием, без отказов
    before = {m["id"] for m in mods}
    c0 = dict(cnt)
    try:
        summ = pg.locator('summary:has-text("Готовые кухонные модули") >> visible=true')
        if summ.count(): summ.first.click(); cnt["left"] += 1; pg.wait_for_timeout(300)
        click('[aria-label="Пенал 600"]')
        pg.wait_for_timeout(800)
        st = pg.evaluate(STATE_JS); new = [m for m in st["modules"] if m["id"] not in before]
        open_ancestors('[aria-label="Поставить к левой стене"]')
        click('[aria-label="Поставить к левой стене"]')
        pg.wait_for_timeout(800)
        t = pg.evaluate(TOAST_JS)
        if t: errors.append("к левой стене: " + t)
        st2 = pg.evaluate(STATE_JS)
        tall = [m for m in st2["modules"] if new and m["id"] == new[-1]["id"]]
        res["to_wall"] = {"actions": {k: cnt[k] - c0[k] for k in cnt}, "module": tall[0] if tall else None}
        shot("to-left-wall-end.png")
        views("to-left-wall")
    except Exception as e:
        errors.append("к стене: " + str(e)[:200])
    res["final"] = pg.evaluate(STATE_JS)
except Exception as e:
    errors.append("исключение: " + str(e)[:300])
    try: shot("g-kitchen-error.png")
    except Exception: pass

out = {"port": PORT, "counts": cnt, "errors": errors, "result": res}
json.dump(out, open(os.path.join(OUT, "scenario.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({"counts": cnt, "errors": errors, "corner_kitchen": res.get("corner_kitchen"), "to_wall": res.get("to_wall")}, ensure_ascii=False))
ctx.close(); br.close(); pw.stop()
