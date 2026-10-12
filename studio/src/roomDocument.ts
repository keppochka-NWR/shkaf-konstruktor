import { newProject, parseProject, type Project } from './project';

/** Separate envelope: the existing v3 editor receives one room only. */
export const ROOM_DOCUMENT_KEY = 'garderyob-rooms-v1';
export const ROOM_DOCUMENT_BACKUP = ROOM_DOCUMENT_KEY + ':previous';
export const MAX_ROOMS = 30;
const wallSides = ['back', 'left', 'right', 'front'] as const;
export type RoomEntry = { id: string; title: string; walls: Record<typeof wallSides[number], string>; project: Project };
export type RoomDocument = { format: 'garderyob-rooms'; version: 1; revision: number; activeRoomId: string; rooms: RoomEntry[] };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const uid = () => crypto.randomUUID();
function label(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) throw Error('Название комнаты: от 1 до 60 символов.');
  return value.trim();
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 100) throw Error('Некорректный идентификатор комнаты или стены.');
  return value;
}
/** Legacy validation requires a cabinet. Only validation receives a temporary one. */
export function parseRoomProject(raw: unknown): Project {
  const x = raw as Project;
  const empty = x?.version === 3 && Array.isArray(x.modules) && x.modules.length === 0;
  const p = parseProject(empty ? { ...x, modules: newProject().modules } : x);
  if (empty) p.modules = [];
  return structuredClone(p);
}
function entry(project: Project, title: string): RoomEntry {
  return { id: uid(), title: label(title), walls: Object.fromEntries(wallSides.map(s => [s, uid()])) as RoomEntry['walls'], project: parseRoomProject(project) };
}
export function migrateRoomDocument(raw?: unknown): RoomDocument {
  const p = raw === undefined ? { ...newProject(), modules: [] } : parseProject(raw);
  const room = entry(p, 'Комната 1');
  return { format: 'garderyob-rooms', version: 1, revision: 0, activeRoomId: room.id, rooms: [room] };
}
export function parseRoomDocument(raw: unknown): RoomDocument {
  const d = raw as RoomDocument;
  if (!d || d.format !== 'garderyob-rooms' || d.version !== 1) throw Error('Неподдерживаемый формат документа комнат. Исходный файл не изменён.');
  if (!Number.isSafeInteger(d.revision) || d.revision < 0 || !Array.isArray(d.rooms) || !d.rooms.length || d.rooms.length > MAX_ROOMS) throw Error('Некорректный состав или версия комнат.');
  const ids = new Set<string>();
  const unique = (value: unknown) => { const id = identifier(value); if (ids.has(id)) throw Error('Повторяющийся идентификатор комнаты или стены.'); ids.add(id); return id; };
  const rooms = d.rooms.map(r => {
    if (!r || !r.walls) throw Error('Нет данных комнаты или стен.');
    return { id: unique(r.id), title: label(r.title), walls: Object.fromEntries(wallSides.map(s => [s, unique(r.walls[s])])) as RoomEntry['walls'], project: parseRoomProject(r.project) };
  });
  if (!rooms.some(r => r.id === d.activeRoomId)) throw Error('Активная комната отсутствует.');
  return { format: 'garderyob-rooms', version: 1, revision: d.revision, activeRoomId: d.activeRoomId, rooms };
}
export function activeRoom(d: RoomDocument): RoomEntry {
  const r = d.rooms.find(r => r.id === d.activeRoomId);
  if (!r) throw Error('Комната не найдена.');
  return r;
}
export function addRoom(d: RoomDocument, title: string, copyId?: string): RoomDocument {
  if (d.rooms.length >= MAX_ROOMS) throw Error(`В документе допускается до ${MAX_ROOMS} комнат.`);
  const source = copyId ? d.rooms.find(r => r.id === copyId) : undefined;
  if (copyId && !source) throw Error('Комната для копирования не найдена.');
  const p = source ? structuredClone(source.project) : { ...newProject(), modules: [] };
  // A copied room is a new design, never an alias for the old cloud project.
  if (source) delete p.cloud;
  const room = entry(p, title);
  return { ...d, activeRoomId: room.id, rooms: [...d.rooms, room] };
}
export function selectRoom(d: RoomDocument, id: string): RoomDocument {
  if (!d.rooms.some(r => r.id === id)) throw Error('Комната не найдена.');
  return { ...d, activeRoomId: id };
}
export function renameRoom(d: RoomDocument, id: string, title: string): RoomDocument {
  selectRoom(d, id);
  return { ...d, rooms: d.rooms.map(r => r.id === id ? { ...r, title: label(title) } : r) };
}
export function removeRoom(d: RoomDocument, id: string): RoomDocument {
  selectRoom(d, id);
  if (d.rooms.length === 1) throw Error('Последнюю комнату удалить нельзя.');
  const rooms = d.rooms.filter(r => r.id !== id);
  return { ...d, rooms, activeRoomId: d.activeRoomId === id ? rooms[0].id : d.activeRoomId };
}
export function updateRoom(d: RoomDocument, id: string, project: Project): RoomDocument {
  selectRoom(d, id);
  const parsed = parseRoomProject(project);
  return { ...d, rooms: d.rooms.map(r => r.id === id ? { ...r, project: parsed } : r) };
}
/** Source and destination are untouched on validation or stale-write failure. */
export function persistRoomDocument(store: Store, candidate: RoomDocument, expected: string | null): { document: RoomDocument; serialized: string } {
  if (store.getItem(ROOM_DOCUMENT_KEY) !== expected) throw Error('Документ изменён в другой вкладке. Скачайте текущую копию и перезагрузите страницу.');
  const valid = parseRoomDocument(candidate);
  const previousRevision = expected === null ? -1 : parseRoomDocument(JSON.parse(expected)).revision;
  const document = { ...valid, revision: previousRevision + 1 };
  const serialized = JSON.stringify(document);
  if (expected !== null) store.setItem(ROOM_DOCUMENT_BACKUP, expected);
  store.setItem(ROOM_DOCUMENT_KEY, serialized);
  return { document, serialized };
}
