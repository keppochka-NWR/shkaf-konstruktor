// Обмен замером помещения со скриптом Базиса «Замер помещения» (технолог.бел): его Config.xml — это заполненная
// замерщиком анкета. Импорт: Config.xml → Room студии. Экспорт: Room → Config.xml, чтобы скрипт построил комнату в Базисе.
// Соответствие стен: ФРОНТАЛЬНАЯ = задняя стена студии (z=0, отступ слева направо), ЛЕВАЯ/ПРАВАЯ — от фронтальной
// стены (= от задней стены студии), ТЫЛЬНАЯ = передняя стена студии, отступ у скрипта — слева при взгляде изнутри,
// то есть от правого угла студии.
import { id } from "./model";
import type { Room, Opening } from "./project";
import { FIXTURES, type Fixture, type FixtureType, type Wall } from "./fixtures";

type Node = { name: string; value?: string; items: Node[] };
/** Разбор простого XML скрипта (Item/Items/Value) без DOMParser, чтобы работало и в тестах node. */
export function parseConfigXml(xml: string): Node {
  const root: Node = { name: "", items: [] };
  const stack: Node[] = [root];
  const re = /<(\/?)(Item|Items|Value|Visible|ReadOnly|Options)(?:\s+Name="([^"]*)")?\s*(\/?)>([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const [, close, tag, name, selfClose, text] = m;
    if (tag === "Item") {
      if (close) { stack.pop(); continue; }
      const node: Node = { name: decode(name ?? ""), items: [] };
      stack[stack.length - 1].items.push(node);
      if (!selfClose) stack.push(node);
    } else if (tag === "Value" && !close) {
      stack[stack.length - 1].value = decode(text.trim());
    }
  }
  return root;
}
function decode(s: string) { return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
const find = (n: Node | undefined, name: string) => n?.items.find((i) => i.name === name);
const num = (n: Node | undefined, name: string, dflt: number) => { const v = find(n, name)?.value; const x = v === undefined ? NaN : Number(String(v).replace(",", ".")); return Number.isFinite(x) ? x : dflt; };
const on = (n: Node | undefined) => n?.value === "Y";

const WALLS: { key: string; wall: Wall }[] = [
  { key: "ФРОНТАЛЬНАЯ СТЕНА", wall: "back" },
  { key: "ЛЕВАЯ СТЕНА", wall: "left" },
  { key: "ПРАВАЯ СТЕНА", wall: "right" },
  { key: "ТЫЛЬНАЯ СТЕНА", wall: "front" },
];
/** Отступ скрипта → отступ студии вдоль стены. У тыльной стены отсчёт с другого угла. */
function toOffset(wall: Wall, len: number, bazisOffset: number, width: number) { return wall === "front" ? len - bazisOffset - width : bazisOffset; }
function fromOffset(wall: Wall, len: number, offset: number, width: number) { return wall === "front" ? len - offset - width : offset; }
const otstup = (n: Node | undefined, dflt: number) => num(n, "Отступ слева", NaN) || num(n, "Отступ справа", NaN) || num(n, "Отступ слева до откоса", NaN) || num(n, "Отступ справа до откоса", NaN) || dflt;

export type BazisImport = { room: Room; name: string; notes: string[] };
export function importBazisConfig(xml: string): BazisImport {
  const cfg = parseConfigXml(xml);
  const root = cfg.items[0]?.items?.length && cfg.items[0].name === "" ? cfg.items[0] : cfg;
  const items = root.items.length ? root : cfg;
  const wallNode = (key: string) => find(items, key);
  const pw = find(wallNode("ФРОНТАЛЬНАЯ СТЕНА"), "Параметры стены"), pl = find(wallNode("ЛЕВАЯ СТЕНА"), "Параметры стены");
  const width = num(pw, "Ширина", 2500), depth = num(pl, "Ширина", 2500), height = num(pw, "Высота", 2500), thickness = num(pw, "Толщина", 120);
  const room: Room = { width, depth, height, openings: [], obstacles: [], fixtures: [], walls: { thickness, angleLeft: num(items, "Угол между фронтальной и левой стеной", 90), angleRight: num(items, "Угол между фронтальной и правой стеной", 90) } };
  const notes: string[] = [];
  const add = (f: Omit<Fixture, "id">) => room.fixtures!.push({ id: id(), ...f });
  for (const { key, wall } of WALLS) {
    const w = wallNode(key); if (!w || !on(w)) continue;
    const len = wall === "back" || wall === "front" ? width : depth;
    // Дверь
    const door = find(w, "Дверь");
    if (on(door)) {
      const p = find(door, "Параметры двери"), dw = num(p, "Ширина", 800), dh = num(p, "Высота", 2000);
      const o: Opening = { id: id(), type: "door", wall, offset: toOffset(wall, len, otstup(p, 150), dw), width: dw, height: dh, sill: 0 };
      const nal = find(door, "Наличник"); if (on(nal)) { const pn = find(nal, "Параметры наличника"); o.casing = num(pn, "Ширина", 80); o.casingThick = num(pn, "Толщина", 12); }
      const blk = find(door, "Добавить дверной блок"); if (on(blk)) o.hinge = find(blk, "Открывание двери")?.value === "Правая" ? "right" : "left";
      room.openings!.push(o);
    }
    // Окно
    const win = find(w, "Окно");
    if (on(win)) {
      const p = find(win, "Параметры окна"), ww = num(p, "Ширина", 900), wh = num(p, "Высота", 1400);
      const o: Opening = { id: id(), type: "window", wall, offset: toOffset(wall, len, otstup(p, 1300), ww), width: ww, height: wh, sill: num(p, "Отступ от пола до низа окна", 850) };
      const blk = find(win, "Добавить оконный блок"); if (on(blk)) o.reveal = num(blk, "Глубина откоса", 40);
      const sill = find(win, "Подоконник"); if (on(sill)) { const ps = find(sill, "Параметры подоконника"); o.windowSill = { width: num(ps, "Ширина", 1000), thick: num(ps, "Толщина", 40), overhang: num(ps, "Выступ из стены в комнату", 65), offset: toOffset(wall, len, num(ps, "Отступ слева до подоконника", NaN) || num(ps, "Отступ справа до подоконника", 1250), num(ps, "Ширина", 1000)) }; }
      room.openings!.push(o);
    }
    // Вентиляция
    const vent = find(w, "Вентиляция");
    if (on(vent)) { const p = find(vent, "Параметры вентиляции"), vw = num(p, "Ширина", 200), vh = num(p, "Высота", 150); add({ type: "vent", wall, offset: toOffset(wall, len, otstup(p, 450), vw), fromFloor: num(p, "Отступ от пола", 2100), width: vw, height: vh, depth: 5, round: on(find(vent, "Круглая")), grille: on(find(p, "Добавить решетку")) }); }
    // Розетки / выключатели
    const power = find(w, "Розетки/выключатели");
    if (power && on(power)) for (const node of power.items) {
      if (!on(node)) continue;
      const p = node.items.find((i) => i.name.startsWith("Параметры")) ?? node;
      const kind: FixtureType = node.name.startsWith("Выключатель") ? "switch" : node.name.includes("электроплит") ? "stoveSocket" : node.name === "АПИ" ? "api" : "socket";
      const fw = num(p, "Ширина", 80);
      add({ type: kind, wall, name: node.name.replace("_", " "), offset: toOffset(wall, len, otstup(p, 1100), fw), fromFloor: num(p, "Отступ от пола", 900), width: fw, height: num(p, "Высота", 80), depth: num(p, "Толщина", 12) });
    }
    const simple: [string, FixtureType, (n: Node) => Omit<Fixture, "id" | "type" | "wall">][] = [
      ["Вертикальный короб", "verticalBox", (n) => ({ offset: toOffset(wall, len, num(n, "Отступ слева", 0) || num(n, "Отступ справа", 0), num(n, "Ширина", 150)), fromFloor: num(n, "Отступ от пола", 0), width: num(n, "Ширина", 150), height: num(n, "Высота", height), depth: num(n, "Глубина", 150) })],
      ["Горизонтальный короб", "horizontalBox", (n) => ({ offset: toOffset(wall, len, num(n, "Отступ слева до короба", 0) || num(n, "Отступ справа до короба", 0), num(n, "Ширина", len)), fromFloor: num(n, "Отступ от пола", 2350), width: num(n, "Ширина", len), height: num(n, "Высота", 150), depth: num(n, "Глубина", 300) })],
      ["Потолочный плинтус", "ceilingPlinth", (n) => ({ offset: 0, fromFloor: height - num(n, "Высота", 40), width: len, height: num(n, "Высота", 40), depth: num(n, "Ширина", 30) })],
      ["Напольный плинтус", "floorPlinth", (n) => ({ offset: 0, fromFloor: 0, width: len, height: num(n, "Высота", 70), depth: num(n, "Ширина", 25) })],
      ["Батарея", "radiator", (n) => ({ offset: toOffset(wall, len, otstup(n, 1350), num(n, "Ширина", 800)), fromFloor: num(n, "Отступ от пола", 150), width: num(n, "Ширина", 800), height: num(n, "Высота", 600), depth: num(n, "Глубина от стены", 140) })],
      ["Ниша под окном", "niche", (n) => ({ offset: toOffset(wall, len, otstup(n, 1300), num(n, "Ширина", 900)), fromFloor: 0, width: num(n, "Ширина", 900), height: num(n, "Высота", 800), depth: thickness / 2 })],
      ["Фартук", "apron", (n) => ({ offset: 0, fromFloor: num(n, "Отступ от пола", 850), width: len, height: num(n, "Высота фартука", 600), depth: num(n, "Толщина фартука", 12) })],
    ];
    for (const [key, type, make] of simple) { const n = find(w, key); if (on(n)) add({ type, wall, ...make(n!) }); }
    const luk = find(w, "Лючок ревизионный");
    if (on(luk)) { const p = find(luk, "Параметры лючка"), lw = num(p, "Ширина", 200); add({ type: "hatch", wall, offset: toOffset(wall, len, otstup(p, 1100), lw), fromFloor: num(p, "Отступ от пола", 900), width: lw, height: num(p, "Высота", 200), depth: num(p, "Толщина", 3) }); }
    const water = find(w, "Водонагреватель");
    if (on(water)) { const p = find(water, "Параметры водонагревателя"), ww = num(p, "Ширина", 310); add({ type: "waterHeater", wall, offset: toOffset(wall, len, otstup(p, 2095), ww), fromFloor: num(p, "Отступ от пола", 1300), width: ww, height: num(p, "Высота", 480), depth: num(p, "Глубина", 180) }); }
    const gas = find(w, "Газовый счетчик");
    if (on(gas)) { const p = find(gas, "Параметры газового счетчика"), gw = num(p, "Ширина", 170); add({ type: "gasMeter", wall, offset: toOffset(wall, len, otstup(p, 1018), gw), fromFloor: num(p, "Отступ от пола", 1300), width: gw, height: num(p, "Высота", 190), depth: num(p, "Глубина", 120) + num(p, "Отступ от стены", 25) }); }
    const pipes = find(w, "Трубы");
    if (pipes && on(pipes)) for (const node of pipes.items) {
      if (!on(node)) continue;
      const dia = num(node, "Диаметр", 25), gap = num(node, "Отступ от стены", 50);
      if (node.name.includes("Вертикаль")) { const off = num(node, "Отступ слева снизу", 0) || num(node, "Отступ справа снизу", 0); add({ type: "pipe", wall, name: node.name.replace(/_/g, " "), offset: toOffset(wall, len, off, dia), fromFloor: 0, width: dia, height: height, depth: gap + dia, round: true }); }
      else if (node.name.includes("Горизонталь")) { const y = num(node, "Отступ от пола до трубы слева", 20); add({ type: "pipe", wall, name: node.name.replace(/_/g, " "), offset: 0, fromFloor: y, width: len, height: dia, depth: gap + dia, round: true, horizontal: true }); }
      else { const off = otstup(node, 500), y0 = num(node, "Отступ от пола до трубы", 150), y1 = num(node, "Отступ от пола до верха", 350); add({ type: "pipe", wall, name: node.name.replace(/_/g, " "), offset: toOffset(wall, len, off, dia), fromFloor: y0, width: dia, height: Math.max(dia, y1 - y0), depth: gap + dia, round: true }); }
    }
    const battPipes = find(w, "Трубы к батарее"); if (on(battPipes)) notes.push(`${key}: трубы к батарее отмечены в замере, в студии показана только батарея.`);
  }
  const misc = find(items, "РАЗНОЕ");
  if (misc && on(misc)) for (const node of misc.items) {
    if (!on(node)) continue;
    if (node.name === "Светильники") { notes.push("Светильники на потолке из замера не перенесены (в студии учитывается только зазор до потолка)."); continue; }
    const type = node.name === "Холодильник" ? "fridge" : node.name === "Стиральная машина" ? "washer" : "stove";
    const p = node.items.find((i) => i.name.startsWith("Параметры")) ?? node;
    const w = num(p, "Ширина", type === "fridge" ? 600 : 600), d = num(p, "Глубина", 600), h = num(p, "Высота", type === "fridge" ? 1850 : 850);
    room.obstacles!.push({ id: id(), name: node.name, type, x: Math.min(width - w, Math.max(0, num(p, "Отступ от левой стены", NaN) || num(p, "Отступ слева", 0))), y: 0, z: Math.min(depth - d, Math.max(0, num(p, "Отступ от фронтальной стены", 0))), width: w, depth: d, height: h });
  }
  return { room, name: find(items, "НАЗВАНИЕ ПОМЕЩЕНИЯ")?.value ?? "", notes };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function item(name: string, body: string, value?: string) { return `<Item Name="${esc(name)}">${value === undefined ? "" : `<Value>${esc(value)}</Value>`}${body ? `<Items>${body}</Items>` : ""}</Item>`; }
const numItem = (name: string, v: number) => item(name, "", String(Math.round(v)));
const boolOn = (name: string, body: string) => item(name, body, "Y");
/** Room студии → Config.xml для скрипта Базиса: строит те же стены, проёмы и объекты. Неподдержанное скриптом опускается. */
export function exportBazisConfig(room: Room, name = "ПОМЕЩЕНИЕ"): string {
  const t = room.walls?.thickness ?? 120;
  const walls = WALLS.map(({ key, wall }) => {
    const len = wall === "back" || wall === "front" ? room.width : room.depth;
    const side = wall === "left" ? "справа" : "слева";
    const parts: string[] = [item("Параметры стены", numItem("Высота", room.height) + numItem("Ширина", len) + numItem("Толщина", t))];
    for (const o of (room.openings ?? []).filter((o) => o.wall === wall)) {
      const off = fromOffset(wall, len, o.offset, o.width);
      if (o.type === "door") {
        let body = item("Параметры двери", numItem("Ширина", o.width) + numItem("Высота", o.height) + numItem(`Отступ ${side}`, off));
        if (o.hinge) body += boolOn("Добавить дверной блок", item("Открывание двери", "", o.hinge === "right" ? "Правая" : "Левая"));
        if (o.casing) body += boolOn("Наличник", item("Параметры наличника", numItem("Ширина", o.casing) + numItem("Толщина", o.casingThick ?? 12)));
        parts.push(boolOn("Дверь", body));
      } else {
        let body = item("Параметры окна", numItem("Ширина", o.width) + numItem("Высота", o.height) + numItem(`Отступ ${side} до откоса`, off) + numItem("Отступ от пола до низа окна", o.sill));
        body += boolOn("Добавить оконный блок", numItem("Глубина откоса", o.reveal ?? 40));
        if (o.windowSill) body += boolOn("Подоконник", item("Параметры подоконника", numItem("Ширина", o.windowSill.width) + numItem("Толщина", o.windowSill.thick) + numItem(`Отступ ${side} до подоконника`, fromOffset(wall, len, o.windowSill.offset, o.windowSill.width)) + numItem("Выступ из стены в комнату", o.windowSill.overhang)));
        parts.push(boolOn("Окно", body));
      }
    }
    const fx = (room.fixtures ?? []).filter((f) => f.wall === wall);
    const off = (f: Fixture) => fromOffset(wall, len, f.offset, f.width);
    const vent = fx.find((f) => f.type === "vent");
    if (vent) parts.push(boolOn("Вентиляция", (vent.round ? boolOn("Круглая", "") : boolOn("Квадратная", "")) + item("Параметры вентиляции", numItem("Ширина", vent.width) + numItem("Высота", vent.height) + numItem(`Отступ ${side}`, off(vent)) + numItem("Отступ от пола", vent.fromFloor) + (vent.grille ? boolOn("Добавить решетку", "") : ""))));
    const power = fx.filter((f) => ["socket", "switch", "stoveSocket", "api"].includes(f.type));
    if (power.length) {
      let s = 0, k = 0;
      parts.push(boolOn("Розетки/выключатели", power.map((f) => {
        const nm = f.type === "socket" ? `Розетка_${Math.min(4, ++s)}` : f.type === "switch" ? `Выключатель_${Math.min(2, ++k)}` : f.type === "stoveSocket" ? "Розетка для электроплиты" : "АПИ";
        const pname = f.type === "socket" ? `Параметры розетки_${Math.min(4, s)}` : f.type === "switch" ? `Параметры выключателя_${Math.min(2, k)}` : f.type === "stoveSocket" ? "Параметры розетки для электроплиты" : "Параметры АПИ";
        return boolOn(nm, item(pname, numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Толщина", f.depth) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor)));
      }).join("")));
    }
    for (const f of fx) {
      switch (f.type) {
        case "verticalBox": parts.push(boolOn("Вертикальный короб", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Глубина", f.depth) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor))); break;
        case "horizontalBox": parts.push(boolOn("Горизонтальный короб", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Глубина", f.depth) + numItem("Отступ от пола", f.fromFloor) + numItem(`Отступ ${side} до короба`, off(f)))); break;
        case "ceilingPlinth": parts.push(boolOn("Потолочный плинтус", numItem("Ширина", f.depth) + numItem("Высота", f.height))); break;
        case "floorPlinth": parts.push(boolOn("Напольный плинтус", numItem("Ширина", f.depth) + numItem("Высота", f.height))); break;
        case "radiator": parts.push(boolOn("Батарея", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Глубина от стены", f.depth) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor))); break;
        case "niche": parts.push(boolOn("Ниша под окном", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem(`Отступ ${side}`, off(f)))); break;
        case "apron": parts.push(boolOn("Фартук", numItem("Высота фартука", f.height) + numItem("Толщина фартука", f.depth) + numItem("Отступ от пола", f.fromFloor))); break;
        case "hatch": parts.push(boolOn("Лючок ревизионный", item("Параметры лючка", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Толщина", f.depth) + numItem("Ширина рамки", 20) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor) + item("Открывание", "", "Левый")))); break;
        case "waterHeater": parts.push(boolOn("Водонагреватель", item("Параметры водонагревателя", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Глубина", f.depth) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor)))); break;
        case "gasMeter": parts.push(boolOn("Газовый счетчик", item("Параметры газового счетчика", numItem("Ширина", f.width) + numItem("Высота", f.height) + numItem("Глубина", Math.max(20, f.depth - 25)) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от пола", f.fromFloor) + numItem("Отступ от стены", 25)))); break;
        default: break;
      }
    }
    const pipes = fx.filter((f) => f.type === "pipe");
    if (pipes.length) parts.push(boolOn("Трубы", pipes.slice(0, 5).map((f, i) => {
      const dia = f.round ? f.width : Math.min(f.width, f.height), gap = Math.max(0, f.depth - dia);
      if (f.horizontal) return boolOn("Трубa_5_Горизонталь", numItem("Диаметр", dia) + numItem("Отступ от пола до трубы слева", f.fromFloor) + numItem("Отступ от пола до трубы справа", f.fromFloor) + numItem("Отступ от стены", gap));
      if (f.height >= room.height - 1) return boolOn("Трубa_4_Вертикаль", numItem("Диаметр", dia) + numItem(`Отступ ${side} снизу`, off(f)) + numItem(`Отступ ${side} сверху`, off(f)) + numItem("Отступ от стены", gap));
      return boolOn(`Трубa_${Math.min(3, i + 1)}_Уголок`, numItem("Диаметр", dia) + numItem(`Отступ ${side}`, off(f)) + numItem("Отступ от стены", gap) + numItem("Отступ от пола до трубы", f.fromFloor) + numItem("Отступ от пола до верха", f.fromFloor + f.height) + item("Слева/справа", "", "Слева"));
    }).join("")));
    const enabled = wall === "back" || parts.length > 1 || true;
    return enabled ? boolOn(key, parts.join("")) : item(key, parts.join(""));
  });
  const misc = (room.obstacles ?? []).filter((o) => ["fridge", "washer", "stove"].includes(o.type));
  const miscXml = misc.length ? boolOn("РАЗНОЕ", misc.map((o) => { const nm = o.type === "fridge" ? "Холодильник" : o.type === "washer" ? "Стиральная машина" : "Газовая плита"; return boolOn(nm, item(`Параметры ${nm.toLowerCase()}`, numItem("Ширина", o.width) + numItem("Высота", o.height) + numItem("Глубина", o.depth) + numItem("Отступ слева", o.x) + numItem("Отступ от фронтальной стены", o.z))); }).join("")) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Options><Items>${item("НАЗВАНИЕ ПОМЕЩЕНИЯ", "", name)}${walls.join("")}${miscXml}${numItem("Угол между фронтальной и левой стеной", room.walls?.angleLeft ?? 90)}${numItem("Угол между фронтальной и правой стеной", room.walls?.angleRight ?? 90)}</Items></Options>`;
}
export const FIXTURE_SPECS = FIXTURES;
