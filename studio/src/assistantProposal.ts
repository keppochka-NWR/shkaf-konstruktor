import { initialModule, section, parseModule, validate, RULES } from "./model";
import { catalog } from "./catalog";
import { LEGATO_CATALOG } from "./legatoCatalog";
import { estimate } from "./pricing";
import { appendFromPalette } from "./paletteAdd";
import {
  addRoom,
  activeRoom,
  updateRoom,
  parseRoomDocument,
  type RoomDocument,
} from "./roomDocument";

export type FurnitureSpec = {
  name: string;
  width: number;
  height: number;
  depth: number;
  doors: boolean;
  sections: { shelves: number; drawers: number; rod: boolean }[];
  roomId: string | null;
};
export type RoomSpec = {
  name: string;
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
};
export type AssistantProposal = {
  message: string;
  warnings: string[];
  questions: { question: string; options: string[] }[];
  rooms: RoomSpec[];
  furniture: FurnitureSpec[];
  updates?: {
    roomId: string;
    moduleId: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    x: number | null;
    z: number | null;
  }[];
};
function number(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`Размер вне диапазона ${min}–${max} мм.`);
  return v;
}
/** Only explicitly supported geometry is accepted. No scripts, deletions or price overrides. */
export function applyAssistantProposal(
  document: RoomDocument,
  proposal: AssistantProposal,
): RoomDocument {
  let d = structuredClone(document);
  if (proposal.rooms.length > 30 || proposal.furniture.length > 40)
    throw Error("Слишком много объектов в одном предложении.");
  for (const r of proposal.rooms) {
    d = addRoom(d, r.name);
    const room = activeRoom(d);
    room.origin = {
      x: number(r.x, -100000, 100000),
      z: number(r.z, -100000, 100000),
    };
    d = updateRoom(d, room.id, {
      ...room.project,
      room: {
        ...room.project.room,
        width: number(r.width, 500, 20000),
        depth: number(r.depth, 500, 20000),
        height: number(r.height, 500, 20000),
      },
    });
  }
  for (const spec of proposal.furniture) {
    const target = spec.roomId
      ? d.rooms.find((r) => r.id === spec.roomId)
      : activeRoom(d);
    if (!target) throw Error("Комната предложения больше не существует.");
    if (!spec.sections.length || spec.sections.length > 8)
      throw Error("Нужно от 1 до 8 секций.");
    const module = parseModule({
      ...initialModule(),
      name: spec.name,
      width: number(spec.width, 200, 2700),
      height: number(spec.height, 200, 3000),
      depth: number(spec.depth, 150, 1200),
      doors: spec.doors,
      sections: spec.sections.map((s) => {
        if (!Number.isInteger(s.shelves) || !Number.isInteger(s.drawers))
          throw Error("Число полок и ящиков должно быть целым.");
        number(s.shelves, 0, 12);
        number(s.drawers, 0, 8);
        return {
          ...section(),
          shelves: Array.from(
            { length: s.shelves },
            (_, i) => (i + 1) / (s.shelves + 1),
          ),
          drawers: s.drawers,
          rod: s.rod,
        };
      }),
    });
    const errors = validate(module);
    if (errors.length) throw Error(errors.join("\n"));
    d = updateRoom(d, target.id, appendFromPalette(target.project, module));
  }
  if ((proposal.updates?.length ?? 0) > 40)
    throw Error("Слишком много изменений.");
  for (const u of proposal.updates ?? []) {
    const room = d.rooms.find((r) => r.id === u.roomId),
      placed = room?.project.modules.find((m) => m.id === u.moduleId);
    if (!room || !placed)
      throw Error("Объект предложения больше не существует.");
    const module = structuredClone(placed.module);
    if (module.raw)
      throw Error("Размеры модели из Базиса изменяются в Базисе.");
    if (u.width !== null) module.width = number(u.width, 200, 2700);
    if (u.height !== null) module.height = number(u.height, 200, 3000);
    if (u.depth !== null) module.depth = number(u.depth, 150, 1200);
    const errors = validate(module);
    if (errors.length) throw Error(errors.join("\n"));
    const next = {
      ...placed,
      module,
      x: u.x === null ? placed.x : number(u.x, 0, 20000),
      z: u.z === null ? placed.z : number(u.z, 0, 20000),
    };
    d = updateRoom(d, room.id, {
      ...room.project,
      modules: room.project.modules.map((m) => (m.id === placed.id ? next : m)),
    });
  }
  return parseRoomDocument(d);
}
export function assistantContext(d: RoomDocument) {
  const selected = activeRoom(d),
    calculation = selected.project.modules.length
      ? estimate(selected.project)
      : null;
  return {
    activeRoomId: d.activeRoomId,
    knowledge: {
      source: "Каталоги и правила текущей сборки Ё Конструктора",
      decors: catalog.map((x) => ({ name: x.n, category: x.cat })),
      premial: LEGATO_CATALOG,
      rules: {
        panel: RULES.panel,
        back: RULES.back,
        plinth: RULES.plinth,
        minW: RULES.minW,
        maxW: RULES.maxW,
        minH: RULES.minH,
        maxH: RULES.maxH,
        minD: RULES.minD,
        maxD: RULES.maxD,
        maxSections: RULES.maxSections,
        maxShelves: RULES.maxShelves,
      },
      notice:
        "Цены каталога — на дату checked; наличие на складе не подтверждено. Правила движка не являются полной технологической проверкой.",
    },
    pricingPreview: calculation
      ? {
          roomId: selected.id,
          retail: calculation.retail,
          sheetPrice: calculation.sheetPrice,
          ldspSheets: calculation.ldspSheets,
          missing: calculation.missingExtrasLines.map((l) => ({
            name: l.label,
            source: l.source,
          })),
          lines: calculation.lines.map((l) => ({
            name: l.label,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            source: l.source,
          })),
          notice:
            "Предварительный расчёт текущей комнаты, без доставки и монтажа. Нельзя суммировать закупочные строки и выдавать это за продажную цену.",
        }
      : null,
    rooms: d.rooms.map((r) => ({
      id: r.id,
      name: r.title,
      dimensions: r.project.room,
      origin: r.origin,
      modules: r.project.modules.map((m) => ({
        id: m.id,
        name: m.module.name,
        width: m.module.width,
        height: m.module.height,
        depth: m.module.depth,
        x: m.x,
        z: m.z,
      })),
    })),
  };
}
