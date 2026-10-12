import {
  newProject,
  parseProject,
  type Project,
  type Opening,
} from "./project";

/** Separate envelope: the existing v3 editor receives one room only. */
export const ROOM_DOCUMENT_KEY = "garderyob-rooms-v1";
export const ROOM_DOCUMENT_BACKUP = ROOM_DOCUMENT_KEY + ":previous";
export const MAX_ROOMS = 30;
const opposite = {
  back: "front",
  front: "back",
  left: "right",
  right: "left",
} as const;
const validDate = (v: unknown): string => {
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)))
    throw Error("Некорректная дата варианта.");
  return v;
};
const wallSides = ["back", "left", "right", "front"] as const;
export type RoomVariant = {
  id: string;
  title: string;
  createdAt: string;
  approvedAt?: string;
  project: Project;
};
export type RoomLink = {
  id: string;
  a: string;
  b: string;
  side: Opening["wall"];
  aOpening: string;
  bOpening: string;
};
export type RoomEntry = {
  origin?: { x: number; z: number };
  variants?: RoomVariant[];
  id: string;
  title: string;
  walls: Record<(typeof wallSides)[number], string>;
  project: Project;
};
export type RoomDocument = {
  cloud?: { id: string; revision: number; owner: string };
  links?: RoomLink[];
  customer?: string;
  format: "garderyob-rooms";
  version: 1;
  revision: number;
  activeRoomId: string;
  rooms: RoomEntry[];
};
type Store = Pick<Storage, "getItem" | "setItem">;
const uid = () => crypto.randomUUID();
function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 60)
    throw Error("Название комнаты: от 1 до 60 символов.");
  return value.trim();
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 100)
    throw Error("Некорректный идентификатор комнаты или стены.");
  return value;
}
/** Rooms can contain no furniture; all environment validation still applies. */
export function parseRoomProject(raw: unknown): Project {
  return structuredClone(parseProject(raw, true));
}
function entry(project: Project, title: string): RoomEntry {
  return {
    id: uid(),
    title: label(title),
    walls: Object.fromEntries(
      wallSides.map((s) => [s, uid()]),
    ) as RoomEntry["walls"],
    project: parseRoomProject(project),
  };
}
export function migrateRoomDocument(raw?: unknown): RoomDocument {
  const p =
    raw === undefined ? { ...newProject(), modules: [] } : parseProject(raw);
  const room = entry(p, "Комната 1");
  return {
    format: "garderyob-rooms",
    version: 1,
    revision: 0,
    activeRoomId: room.id,
    rooms: [room],
  };
}
export function parseRoomDocument(raw: unknown): RoomDocument {
  const d = raw as RoomDocument;
  if (!d || d.format !== "garderyob-rooms" || d.version !== 1)
    throw Error(
      "Неподдерживаемый формат документа комнат. Исходный файл не изменён.",
    );
  if (
    !Number.isSafeInteger(d.revision) ||
    d.revision < 0 ||
    !Array.isArray(d.rooms) ||
    !d.rooms.length ||
    d.rooms.length > MAX_ROOMS
  )
    throw Error("Некорректный состав или версия комнат.");
  const ids = new Set<string>();
  const unique = (value: unknown) => {
    const id = identifier(value);
    if (ids.has(id))
      throw Error("Повторяющийся идентификатор комнаты или стены.");
    ids.add(id);
    return id;
  };
  const rooms: RoomEntry[] = d.rooms.map((r) => {
    if (!r || !r.walls) throw Error("Нет данных комнаты или стен.");
    if (
      r.origin &&
      (!Number.isFinite(r.origin.x) ||
        !Number.isFinite(r.origin.z) ||
        Math.abs(r.origin.x) > 1e6 ||
        Math.abs(r.origin.z) > 1e6)
    )
      throw Error("Некорректное положение комнаты на общем плане.");
    if (r.variants && (!Array.isArray(r.variants) || r.variants.length > 20))
      throw Error("Допустимо до 20 вариантов комнаты.");
    const variants = r.variants?.map((v) => ({
      id: unique(v.id),
      title: label(v.title),
      createdAt: validDate(v.createdAt),
      ...(v.approvedAt ? { approvedAt: validDate(v.approvedAt) } : {}),
      project: parseRoomProject(v.project),
    }));
    return {
      ...(r.origin ? { origin: { ...r.origin } } : {}),
      ...(variants ? { variants } : {}),
      id: unique(r.id),
      title: label(r.title),
      walls: Object.fromEntries(
        wallSides.map((s) => [s, unique(r.walls[s])]),
      ) as RoomEntry["walls"],
      project: parseRoomProject(r.project),
    };
  });
  if (!rooms.some((r) => r.id === d.activeRoomId))
    throw Error("Активная комната отсутствует.");
  if (d.links && (!Array.isArray(d.links) || d.links.length > 60))
    throw Error("Некорректные связи комнат.");
  const links = d.links?.map((l) => {
    const a = rooms.find((r) => r.id === l.a),
      b = rooms.find((r) => r.id === l.b);
    if (
      !a ||
      !b ||
      a === b ||
      !wallSides.includes(l.side) ||
      !a.project.room.openings?.some((o) => o.id === l.aOpening) ||
      !b.project.room.openings?.some((o) => o.id === l.bOpening)
    )
      throw Error("Связанный проём отсутствует.");
    const ao = a.project.room.openings!.find((o) => o.id === l.aOpening)!,
      bo = b.project.room.openings!.find((o) => o.id === l.bOpening)!;
    if (
      ao.wall !== l.side ||
      bo.wall !== opposite[l.side] ||
      ao.type !== "door" ||
      bo.type !== "door" ||
      ao.width !== bo.width ||
      ao.height !== bo.height ||
      ao.offset !== bo.offset
    )
      throw Error("Стороны общей двери не согласованы.");
    return { ...l, id: unique(l.id) };
  });
  if (
    d.cloud &&
    (typeof d.cloud.id !== "string" ||
      !Number.isSafeInteger(d.cloud.revision) ||
      d.cloud.revision < 1 ||
      typeof d.cloud.owner !== "string")
  )
    throw Error("Некорректная связь с сервером.");
  return {
    ...(d.cloud ? { cloud: { ...d.cloud } } : {}),
    format: "garderyob-rooms",
    version: 1,
    revision: d.revision,
    activeRoomId: d.activeRoomId,
    rooms,
    ...(links ? { links } : {}),
    ...(d.customer ? { customer: label(d.customer) } : {}),
  };
}
export function activeRoom(d: RoomDocument): RoomEntry {
  const r = d.rooms.find((r) => r.id === d.activeRoomId);
  if (!r) throw Error("Комната не найдена.");
  return r;
}
export function addRoom(
  d: RoomDocument,
  title: string,
  copyId?: string,
): RoomDocument {
  if (d.rooms.length >= MAX_ROOMS)
    throw Error(`В документе допускается до ${MAX_ROOMS} комнат.`);
  const source = copyId ? d.rooms.find((r) => r.id === copyId) : undefined;
  if (copyId && !source) throw Error("Комната для копирования не найдена.");
  const p = source
    ? structuredClone(source.project)
    : { ...newProject(), modules: [] };
  // A copied room is a new design, never an alias for the old cloud project.
  if (source) delete p.cloud;
  const room = entry(p, title);
  room.origin = {
    x:
      Math.max(
        ...d.rooms.map((r) => (r.origin?.x ?? 0) + r.project.room.width),
      ) + 500,
    z: 0,
  };
  return { ...d, activeRoomId: room.id, rooms: [...d.rooms, room] };
}
export function selectRoom(d: RoomDocument, id: string): RoomDocument {
  if (!d.rooms.some((r) => r.id === id)) throw Error("Комната не найдена.");
  return { ...d, activeRoomId: id };
}
export function renameRoom(
  d: RoomDocument,
  id: string,
  title: string,
): RoomDocument {
  selectRoom(d, id);
  return {
    ...d,
    rooms: d.rooms.map((r) =>
      r.id === id ? { ...r, title: label(title) } : r,
    ),
  };
}
export function removeRoom(d: RoomDocument, id: string): RoomDocument {
  selectRoom(d, id);
  if (d.rooms.length === 1) throw Error("Последнюю комнату удалить нельзя.");
  const rooms = d.rooms.filter((r) => r.id !== id);
  return {
    ...d,
    links: d.links?.filter((l) => l.a !== id && l.b !== id),
    rooms,
    activeRoomId: d.activeRoomId === id ? rooms[0].id : d.activeRoomId,
  };
}
export function updateRoom(
  d: RoomDocument,
  id: string,
  project: Project,
): RoomDocument {
  selectRoom(d, id);
  const parsed = parseRoomProject(project);
  const old = d.rooms.find((r) => r.id === id)!;
  if (
    (d.links ?? []).some((l) => l.a === id || l.b === id) &&
    (["width", "depth"] as const).some(
      (k) => old.project.room[k] !== parsed.room[k],
    )
  )
    throw Error(
      "Перед изменением габаритов связанной комнаты разорвите связь общей двери.",
    );
  let next = {
    ...d,
    rooms: d.rooms.map((r) => (r.id === id ? { ...r, project: parsed } : r)),
  };
  for (const link of d.links ?? []) {
    if (link.a !== id && link.b !== id) continue;
    const fromA = link.a === id,
      source = parsed.room.openings?.find(
        (o) => o.id === (fromA ? link.aOpening : link.bOpening),
      ),
      otherId = fromA ? link.b : link.a,
      openingId = fromA ? link.bOpening : link.aOpening;
    if (
      source &&
      (source.type !== "door" ||
        source.wall !== (fromA ? link.side : opposite[link.side]))
    )
      throw Error(
        "Перед переносом общей двери на другую стену разорвите связь комнат.",
      );
    if (!source)
      throw Error(
        "Сначала разорвите связь комнат перед удалением общей двери.",
      );
    next = {
      ...next,
      rooms: next.rooms.map((r) =>
        r.id !== otherId
          ? r
          : {
              ...r,
              project: parseRoomProject({
                ...r.project,
                room: {
                  ...r.project.room,
                  openings: r.project.room.openings?.map((o) =>
                    o.id === openingId
                      ? {
                          ...source,
                          id: openingId,
                          wall: opposite[source.wall],
                          direction: source.direction === "out" ? "in" : "out",
                        }
                      : o,
                  ),
                },
              }),
            },
      ),
    };
  }
  return next;
}
/** Source and destination are untouched on validation or stale-write failure. */
export function persistRoomDocument(
  store: Store,
  candidate: RoomDocument,
  expected: string | null,
): { document: RoomDocument; serialized: string } {
  if (store.getItem(ROOM_DOCUMENT_KEY) !== expected)
    throw Error(
      "Документ изменён в другой вкладке. Скачайте текущую копию и перезагрузите страницу.",
    );
  const valid = parseRoomDocument(candidate);
  const previousRevision =
    expected === null ? -1 : parseRoomDocument(JSON.parse(expected)).revision;
  const document = { ...valid, revision: previousRevision + 1 };
  const serialized = JSON.stringify(document);
  if (expected !== null) store.setItem(ROOM_DOCUMENT_BACKUP, expected);
  store.setItem(ROOM_DOCUMENT_KEY, serialized);
  return { document, serialized };
}

export function attachRoom(
  d: RoomDocument,
  title: string,
  side: Opening["wall"],
): RoomDocument {
  const base = activeRoom(d),
    next = addRoom(d, title),
    added = activeRoom(next),
    r = base.project.room,
    origin = base.origin ?? { x: 0, z: 0 };
  added.project.room = {
    width: r.width,
    height: r.height,
    depth: r.depth,
    openings: [],
  };
  added.origin = {
    x: origin.x + (side === "right" ? r.width : side === "left" ? -r.width : 0),
    z: origin.z + (side === "front" ? r.depth : side === "back" ? -r.depth : 0),
  };
  for (const other of d.rooms) {
    const p = other.origin ?? { x: 0, z: 0 };
    if (
      added.origin.x < p.x + other.project.room.width - 0.1 &&
      added.origin.x + r.width > p.x + 0.1 &&
      added.origin.z < p.z + other.project.room.depth - 0.1 &&
      added.origin.z + r.depth > p.z + 0.1
    )
      throw Error(
        "Соседняя комната пересекает существующую. Выберите другую сторону.",
      );
  }
  const aOpening = uid(),
    bOpening = uid(),
    length = side === "back" || side === "front" ? r.width : r.depth,
    width = Math.min(900, length),
    height = Math.min(2100, r.height);
  const opening: Opening = {
    id: aOpening,
    type: "door",
    wall: side,
    offset: (length - width) / 2,
    width,
    height,
    sill: 0,
    direction: "out",
  };
  const opposite = {
    back: "front",
    front: "back",
    left: "right",
    right: "left",
  } as const;
  next.rooms = next.rooms.map((x) =>
    x.id === base.id
      ? {
          ...x,
          project: parseRoomProject({
            ...x.project,
            room: {
              ...x.project.room,
              openings: [...(x.project.room.openings ?? []), opening],
            },
          }),
        }
      : x,
  );
  added.project.room.openings = [
    { ...opening, id: bOpening, wall: opposite[side], direction: "in" },
  ];
  next.links = [
    ...(d.links ?? []),
    { id: uid(), a: base.id, b: added.id, side, aOpening, bOpening },
  ];
  return parseRoomDocument(next);
}
export function saveVariant(
  d: RoomDocument,
  title: string,
  approve = false,
): RoomDocument {
  const r = activeRoom(d);
  if ((r.variants?.length ?? 0) >= 20)
    throw Error("Допустимо до 20 вариантов.");
  const now = new Date().toISOString(),
    variant: RoomVariant = {
      id: uid(),
      title: label(title),
      createdAt: now,
      ...(approve ? { approvedAt: now } : {}),
      project: structuredClone(r.project),
    };
  return {
    ...d,
    rooms: d.rooms.map((x) =>
      x.id === r.id ? { ...x, variants: [...(x.variants ?? []), variant] } : x,
    ),
  };
}
export function loadVariant(d: RoomDocument, id: string): RoomDocument {
  const r = activeRoom(d),
    v = r.variants?.find((v) => v.id === id);
  if (!v) throw Error("Вариант не найден.");
  return updateRoom(d, r.id, structuredClone(v.project));
}
