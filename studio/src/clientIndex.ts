// Папка клиента (06.10.2026, задание Макса: «к одному клиенту привязывать несколько проектов»).
// Хранится в браузере: список клиентов, у каждого — проекты (прихожая, спальня, шкаф-купе…). Сами проекты лежат под своими ключами
// (module-studio-v3:<key>); прежний единственный проект остаётся первым проектом первого клиента (key '').
import { parseProject, type Project } from "./project";
import { CURRENT_PROJECT } from "./projectStorage";

export const CLIENT_INDEX = "studio-clients-v1";
export type ClientProject = { key: string; title: string; price?: number | null };
export type Client = { id: string; label: string; projects: ClientProject[]; active: string };
export type ClientIndex = { version: 1; clients: Client[]; active: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const projectStorageKey = (key: string) => CURRENT_PROJECT + (key ? ":" + key : "");
const newKey = () => "c-" + crypto.randomUUID().slice(0, 8);

export function emptyIndex(): ClientIndex {
  return { version: 1, clients: [{ id: "client-1", label: "", projects: [{ key: "", title: "Проект 1" }], active: "" }], active: "client-1" };
}
/** Читает папки клиентов; повреждённый или чужой формат — начинаем заново, проекты в хранилище не трогаем. */
export function loadIndex(store: Store): ClientIndex {
  try {
    const raw = store.getItem(CLIENT_INDEX);
    if (!raw) return emptyIndex();
    const x = JSON.parse(raw) as ClientIndex;
    if (x?.version !== 1 || !Array.isArray(x.clients) || !x.clients.length) return emptyIndex();
    for (const c of x.clients) { if (!c.projects?.length) c.projects = [{ key: newKey(), title: "Проект 1" }]; if (!c.projects.some((p) => p.key === c.active)) c.active = c.projects[0].key; }
    if (!x.clients.some((c) => c.id === x.active)) x.active = x.clients[0].id;
    return x;
  } catch { return emptyIndex(); }
}
export function saveIndex(store: Store, index: ClientIndex) { store.setItem(CLIENT_INDEX, JSON.stringify(index)); }
export function activeClient(index: ClientIndex) { return index.clients.find((c) => c.id === index.active) ?? index.clients[0]; }
const withClient = (index: ClientIndex, update: (c: Client) => Client): ClientIndex => ({ ...index, clients: index.clients.map((c) => (c.id === index.active ? update(c) : c)) });

/** Ещё один проект у текущего клиента: пустой или копия указанного. Возвращает новый индекс и ключ. */
export function addProject(store: Store, index: ClientIndex, title: string, copyFrom?: string): { index: ClientIndex; key: string } {
  const key = newKey();
  if (copyFrom !== undefined) { const raw = store.getItem(projectStorageKey(copyFrom)); if (raw) { const p = parseProject(JSON.parse(raw)); delete p.cloud; store.setItem(projectStorageKey(key), JSON.stringify(p)); } }
  return { key, index: withClient(index, (c) => ({ ...c, projects: [...c.projects, { key, title: uniqueTitle(c, title) }], active: key })) };
}
function uniqueTitle(c: Client, title: string) { let t = title.trim() || "Проект"; let n = 2; const base = t; while (c.projects.some((p) => p.title === t)) t = `${base} ${n++}`; return t; }
export function renameProject(index: ClientIndex, key: string, title: string): ClientIndex {
  const t = title.trim().slice(0, 60); if (!t) throw Error("Название проекта не может быть пустым.");
  return withClient(index, (c) => ({ ...c, projects: c.projects.map((p) => (p.key === key ? { ...p, title: t } : p)) }));
}
/** Удаляет проект из папки клиента; последний проект клиента удалить нельзя. Данные проекта уходят в резервную копию. */
export function removeProject(store: Store, index: ClientIndex, key: string): ClientIndex {
  const c = activeClient(index);
  if (c.projects.length <= 1) throw Error("У клиента должен остаться хотя бы один проект.");
  const raw = store.getItem(projectStorageKey(key));
  if (raw) store.setItem("module-studio-removed-" + (key || "main"), raw);
  if (key) store.removeItem(projectStorageKey(key));
  const projects = c.projects.filter((p) => p.key !== key);
  return withClient(index, (x) => ({ ...x, projects, active: x.active === key ? projects[0].key : x.active }));
}
export function switchProject(index: ClientIndex, key: string): ClientIndex { return withClient(index, (c) => (c.projects.some((p) => p.key === key) ? { ...c, active: key } : c)); }
export function setPrice(index: ClientIndex, key: string, price: number | null): ClientIndex {
  return { ...index, clients: index.clients.map((c) => ({ ...c, projects: c.projects.map((p) => (p.key === key ? { ...p, price } : p)) })) };
}
export function renameClient(index: ClientIndex, label: string): ClientIndex { return withClient(index, (c) => ({ ...c, label: label.trim().slice(0, 80) })); }
/** Новый клиент с одним пустым проектом становится текущим. */
export function addClient(index: ClientIndex, label = ""): { index: ClientIndex; key: string } {
  const key = newKey(), id = "client-" + crypto.randomUUID().slice(0, 8);
  return { key, index: { ...index, clients: [...index.clients, { id, label: label.trim(), projects: [{ key, title: "Проект 1" }], active: key }], active: id } };
}
export function switchClient(index: ClientIndex, id: string): ClientIndex { return index.clients.some((c) => c.id === id) ? { ...index, active: id } : index; }
export function clientTotal(c: Client): number | null { const prices = c.projects.map((p) => p.price); return prices.some((p) => p === null || p === undefined) ? null : prices.reduce<number>((s, p) => s + (p ?? 0), 0); }

/** Папка клиента одним файлом: метка и все его проекты. */
export type ClientBundle = { kind: "garderyob-client"; version: 1; label: string; projects: { title: string; project: Project }[] };
export function clientBundle(store: Store, c: Client): ClientBundle {
  return { kind: "garderyob-client", version: 1, label: c.label, projects: c.projects.map((p) => { const raw = store.getItem(projectStorageKey(p.key)); if (!raw) throw Error(`Проект «${p.title}» ещё не сохранён в браузере. Откройте его один раз и повторите.`); const project = parseProject(JSON.parse(raw)); delete project.cloud; return { title: p.title, project }; }) };
}
export function isClientBundle(x: unknown): x is ClientBundle { return !!x && typeof x === "object" && (x as ClientBundle).kind === "garderyob-client"; }
/** Открыть папку клиента из файла: новый клиент, проекты проверяются так же, как при открытии файла проекта. */
export function importBundle(store: Store, index: ClientIndex, bundle: ClientBundle): { index: ClientIndex; key: string } {
  if (!Array.isArray(bundle.projects) || !bundle.projects.length || bundle.projects.length > 30) throw Error("В файле клиента должно быть от 1 до 30 проектов.");
  const parsed = bundle.projects.map((p) => ({ title: String(p.title || "Проект").slice(0, 60), project: parseProject(p.project) }));
  const id = "client-" + crypto.randomUUID().slice(0, 8), projects = parsed.map((p) => { const key = newKey(); store.setItem(projectStorageKey(key), JSON.stringify(p.project)); return { key, title: p.title }; });
  return { key: projects[0].key, index: { ...index, clients: [...index.clients, { id, label: String(bundle.label || "").slice(0, 80), projects, active: projects[0].key }], active: id } };
}
