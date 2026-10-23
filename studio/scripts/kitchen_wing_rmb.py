# Правая кнопка по корпусу (w-lwing, 23.10.2026): «Поставить к стене ›» и «Продолжить ряд за угол ›» в круговом меню.
# Как rmb_probe тестера кухонь: один нижний из палитры, ПКМ по фасаду, «Корпус ›», затем пункты; действия — мышь.
#   py kitchen_wing_rmb.py <порт> <папка>
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
PORT, OUT = int(sys.argv[1]), sys.argv[2]
MENU_JS = """(()=>{const r=[];document.querySelectorAll('button,[role=menuitem]').forEach(e=>{const b=e.getBoundingClientRect();if(b.width>0&&b.x>250&&b.x<1000&&b.y>150&&b.y<720){const t=(e.innerText||e.getAttribute('aria-label')||'').replace(/\\n/g,' ').trim();if(t&&!/^(3D|Спереди|Сбоку|Сверху|План|Выбрать|Двигать корпуса|Наполнение|Свободная камера|Скрыть фасады|Проёмы|Понятно)$/.test(t)&&!/мм$/.test(t))r.push(t.slice(0,70))}});return [...new Set(r)]})()"""
STATE_JS = """(()=>{const s=JSON.parse(localStorage.getItem('garderyob-rooms-v1')||'null');if(!s)return null;const r=s.rooms.find(r=>r.id===s.activeRoomId);return r.project.modules.map(m=>({name:m.module.name,x:m.x,z:m.z,rot:m.rotation||0}))})()"""
out = {}
with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = br.new_context(viewport={"width": 1366, "height": 768})
    pg = ctx.new_page()
    pg.goto(f"http://127.0.0.1:{PORT}/studio/?fresh=1"); pg.wait_for_timeout(4000)
    pg.locator('button:has-text("Кухонные модули") >> visible=true').first.click()
    pg.locator('button:has-text("Нижний кухонный") >> visible=true').first.click()
    pg.locator('button:has-text("Добавить в комнату") >> visible=true').first.click()
    pg.wait_for_timeout(1500)
    try: pg.locator('button:has-text("Понятно") >> visible=true').first.click(timeout=1500)
    except Exception: pass
    out["before"] = pg.evaluate(STATE_JS)
    pg.mouse.click(592, 465, button="right"); pg.wait_for_timeout(800)
    out["menu"] = pg.evaluate(MENU_JS)
    for label, shot, key in (("Корпус ›", "rmb-1-korpus.png", "korpus"), ("Поставить к стене ›", "rmb-2-to-wall.png", "to_wall")):
        try:
            pg.locator(".radial-menu .radial-item", has_text=label).first.click(timeout=2500); pg.wait_for_timeout(600)
            out[key] = pg.evaluate(MENU_JS); pg.screenshot(path=os.path.join(OUT, shot))
        except Exception as e:
            out[key] = ["(нет: %s)" % str(e)[:80]]
    try:
        pg.locator(".radial-menu .radial-item", has_text="К правой").first.click(timeout=2500); pg.wait_for_timeout(1200)
        out["after_right"] = pg.evaluate(STATE_JS); pg.screenshot(path=os.path.join(OUT, "rmb-3-right-wall.png"))
    except Exception as e:
        out["after_right"] = "(нет: %s)" % str(e)[:80]
    ctx.close(); br.close()
json.dump(out, open(os.path.join(OUT, "rmb.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False))
