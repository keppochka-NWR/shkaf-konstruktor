// Объекты замера на стенах — по составу скрипта Базиса «Замер помещения» (технолог.бел): всё, что замерщик
// отмечает на стене и что мешает мебели или требует доступа. Двери и окна остаются проёмами (Opening), здесь — остальное.
import type { Opening } from "./project";
export type Wall = Opening["wall"];
export type FixtureType =
  | "vent" | "socket" | "switch" | "stoveSocket" | "api" | "panel" | "cableDuct"
  | "verticalBox" | "horizontalBox" | "ceilingPlinth" | "floorPlinth"
  | "radiator" | "pipe" | "niche" | "apron" | "hatch" | "waterHeater" | "gasMeter";
export type Fixture = {
  id: string;
  type: FixtureType;
  wall: Wall;
  /** Отступ вдоль стены от её начала (как у проёмов: слева направо на задней/передней, от задней стены — на боковых). */
  offset: number;
  /** Низ объекта от пола. */
  fromFloor: number;
  /** Размер вдоль стены. */
  width: number;
  height: number;
  /** Выступ из стены в комнату (для ниши — глубина ниши в стене). */
  depth: number;
  name?: string;
  /** Круглая вентиляция / круглая труба — рисуется цилиндром. */
  round?: boolean;
  /** Труба: горизонтальная вдоль стены (иначе вертикальная). */
  horizontal?: boolean;
  /** Решётка вентиляции, лючок: открывание. */
  grille?: boolean;
};
export type FixtureSpec = {
  label: string;
  group: "Электрика" | "Отопление и вода" | "Строительное";
  /** Размеры по умолчанию: вдоль стены, высота, выступ, от пола. */
  w: number; h: number; d: number; y: number;
  /** Растягивается на всю стену (плинтус, фартук, горизонтальный короб). */
  fullWall?: boolean;
  /** Нужен доступ: мебель не должна закрывать (розетки, щиток, лючок, счётчик, водонагреватель). */
  access?: boolean;
  /** Ниша — углубление в стене, не выступ. */
  recess?: boolean;
  /** Цилиндр вместо бокса. */
  round?: boolean;
  /** Цвет в сцене. */
  color: number;
};
export const FIXTURES: Record<FixtureType, FixtureSpec> = {
  socket: { label: "Розетка", group: "Электрика", w: 80, h: 80, d: 12, y: 900, access: true, color: 0xf2f2ee },
  switch: { label: "Выключатель", group: "Электрика", w: 80, h: 80, d: 12, y: 900, access: true, color: 0xf2f2ee },
  stoveSocket: { label: "Розетка электроплиты", group: "Электрика", w: 70, h: 70, d: 40, y: 100, access: true, color: 0xe6e6e0 },
  api: { label: "АПИ (пожарный извещатель)", group: "Электрика", w: 70, h: 70, d: 40, y: 1800, access: true, color: 0xe6e6e0 },
  panel: { label: "Электрощит", group: "Электрика", w: 300, h: 400, d: 90, y: 1300, access: true, color: 0xdadfe3 },
  cableDuct: { label: "Кабель-канал", group: "Электрика", w: 70, h: 800, d: 50, y: 1600, color: 0xe8e8e2 },
  radiator: { label: "Батарея", group: "Отопление и вода", w: 800, h: 600, d: 140, y: 150, color: 0xd9e0e4 },
  pipe: { label: "Труба", group: "Отопление и вода", w: 25, h: 2500, d: 75, y: 0, round: true, color: 0xb9bcc0 },
  waterHeater: { label: "Водонагреватель", group: "Отопление и вода", w: 310, h: 480, d: 180, y: 1300, access: true, color: 0xf4f4f2 },
  gasMeter: { label: "Газовый счётчик", group: "Отопление и вода", w: 170, h: 190, d: 120, y: 1300, access: true, color: 0xe1dcc9 },
  hatch: { label: "Лючок ревизионный", group: "Отопление и вода", w: 200, h: 200, d: 3, y: 900, access: true, color: 0xf0f0ea },
  vent: { label: "Вентиляция", group: "Строительное", w: 200, h: 150, d: 5, y: 2100, access: true, color: 0xcfd4d6 },
  verticalBox: { label: "Вертикальный короб", group: "Строительное", w: 150, h: 2500, d: 150, y: 0, color: 0xd5d5cc },
  horizontalBox: { label: "Горизонтальный короб", group: "Строительное", w: 2500, h: 150, d: 300, y: 2350, fullWall: true, color: 0xd5d5cc },
  ceilingPlinth: { label: "Потолочный плинтус", group: "Строительное", w: 2500, h: 40, d: 30, y: 2460, fullWall: true, color: 0xe9e9e4 },
  floorPlinth: { label: "Напольный плинтус", group: "Строительное", w: 2500, h: 70, d: 25, y: 0, fullWall: true, color: 0xcfc7b8 },
  niche: { label: "Ниша в стене", group: "Строительное", w: 900, h: 800, d: 100, y: 0, recess: true, color: 0xe4e1d8 },
  apron: { label: "Фартук", group: "Строительное", w: 2500, h: 600, d: 12, y: 850, fullWall: true, color: 0xe7e3dc },
};
export const FIXTURE_GROUPS = ["Электрика", "Отопление и вода", "Строительное"] as const;
export const WALL_NAMES: Record<Wall, string> = { back: "Задняя стена", left: "Левая стена", right: "Правая стена", front: "Передняя стена" };
export function wallLength(room: { width: number; depth: number }, wall: Wall) { return wall === "back" || wall === "front" ? room.width : room.depth; }
/** Габарит объекта в координатах комнаты (что занимает в комнате). Ниша — нулевой выступ. */
export function fixtureBox(room: { width: number; depth: number; height: number }, f: Fixture) {
  const spec = FIXTURES[f.type], d = spec.recess ? 0 : Math.max(0, f.depth);
  const y = f.fromFloor, h = f.height;
  switch (f.wall) {
    case "back": return { x: f.offset, y, z: 0, w: f.width, d, h };
    case "front": return { x: f.offset, y, z: room.depth - d, w: f.width, d, h };
    case "left": return { x: 0, y, z: f.offset, w: d, d: f.width, h };
    default: return { x: room.width - d, y, z: f.offset, w: d, d: f.width, h };
  }
}
export function fixtureLabel(f: Fixture, index: number) { return `О${index + 1} · ${f.name || FIXTURES[f.type].label}`; }
export function newFixture(room: { width: number; depth: number; height: number }, type: FixtureType, wall: Wall = "back", idValue: string): Fixture {
  const s = FIXTURES[type], len = wallLength(room, wall);
  const width = s.fullWall ? len : Math.min(s.w, len);
  const height = type === "verticalBox" || type === "pipe" && !s.fullWall ? room.height : Math.min(s.h, room.height);
  const fromFloor = type === "ceilingPlinth" ? room.height - height : Math.min(s.y, Math.max(0, room.height - height));
  return { id: idValue, type, wall, offset: s.fullWall ? 0 : Math.round((len - width) / 2), fromFloor, width, height, depth: s.d, ...(s.round ? { round: true } : {}) };
}
export function validateFixture(room: { width: number; depth: number; height: number }, f: Fixture): string | null {
  if (!f || typeof f.id !== "string" || !f.id) return "Объект на стене без идентификатора.";
  if (!(f.type in FIXTURES)) return "Неизвестный тип объекта на стене.";
  if (!["back", "left", "right", "front"].includes(f.wall)) return "Объект на стене: укажите стену.";
  if (![f.offset, f.fromFloor, f.width, f.height, f.depth].every(Number.isFinite)) return "Объект на стене: размеры и отступы должны быть числами.";
  const len = wallLength(room, f.wall), label = f.name || FIXTURES[f.type].label;
  if (f.width < 5 || f.height < 3 || f.depth < 0 || f.depth > 600) return `«${label}»: ширина от 5, высота от 3, выступ 0–600 мм.`;
  if (f.offset < 0 || f.offset + f.width > len + 0.1) return `«${label}»: выходит за длину стены (${len} мм).`;
  if (f.fromFloor < 0 || f.fromFloor + f.height > room.height + 0.1) return `«${label}»: выходит за высоту помещения (${room.height} мм).`;
  if (f.name !== undefined && (typeof f.name !== "string" || f.name.length > 80)) return "Название объекта на стене — до 80 символов.";
  return null;
}
