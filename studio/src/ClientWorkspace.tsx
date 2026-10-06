// Папка клиента над редактором: клиент, вкладки его проектов с ценой, «+ ещё проект», итог по клиенту.
// Переключение вкладки перезапускает редактор с ключом выбранного проекта (у каждого проекта своя история и автосохранение).
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Users, Download, Pencil, Copy, FilePlus2 } from "lucide-react";
import App from "./App";
import { parseProject, type Project } from "./project";
import { estimate } from "./pricing";
import { saveFile } from "./exports";
import { activeClient, addClient, addProject, clientBundle, clientTotal, importBundle, loadIndex, projectStorageKey, removeProject, renameClient, renameProject, saveIndex, setPrice, switchClient, switchProject, type ClientBundle, type ClientIndex } from "./clientIndex";
import "./client-bar.css";

const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
function priceOf(raw: string | null): number | null { try { return raw ? estimate(parseProject(JSON.parse(raw))).retail : null; } catch { return null; } }

export function ClientWorkspace() {
  const [index, setIndexState] = useState<ClientIndex>(() => { try { return loadIndex(localStorage); } catch { return loadIndex({ getItem: () => null, setItem: () => {}, removeItem: () => {} }); } });
  const setIndex = (next: ClientIndex) => { setIndexState(next); try { saveIndex(localStorage, next); } catch { /* браузер без хранилища: папка живёт до перезагрузки */ } };
  const client = activeClient(index), active = client.active;
  // Цены вкладок: при открытии считаем по сохранённым проектам, активный обновляется из редактора.
  useEffect(() => {
    let next = index, changed = false;
    for (const p of client.projects) if (p.price === undefined) { try { next = setPrice(next, p.key, priceOf(localStorage.getItem(projectStorageKey(p.key)))); changed = true; } catch { /* нет хранилища */ } }
    if (changed) setIndex(next);
  }, [index.active, client.projects.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<number | undefined>(undefined);
  const onProjectChange = (p: Project) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { const price = estimate(p).retail; setIndexState((cur) => { if (activeClient(cur).projects.find((x) => x.key === active)?.price === price) return cur; const next = setPrice(cur, active, price); try { saveIndex(localStorage, next); } catch { /* */ } return next; }); }, 600);
  };
  const bar = <ClientBar index={index} setIndex={setIndex} />;
  return <App key={index.active + "/" + active} projectKey={active || undefined} clientBar={bar} onProjectChange={onProjectChange} onImportBundle={(b: ClientBundle) => { const r = importBundle(localStorage, index, b); setIndex(r.index); }} />;
}

function ClientBar({ index, setIndex }: { index: ClientIndex; setIndex: (i: ClientIndex) => void }) {
  const client = activeClient(index), total = useMemo(() => clientTotal(client), [client]);
  const [adding, setAdding] = useState(false), [editing, setEditing] = useState<string | null>(null), [confirmDel, setConfirmDel] = useState<string | null>(null), [clientsOpen, setClientsOpen] = useState(false), [error, setError] = useState("");
  const run = (f: () => void) => { try { setError(""); f(); } catch (e) { setError(e instanceof Error ? e.message : "Не получилось."); } };
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); }, [error]);
  return (
    <div className="client-bar" role="navigation" aria-label="Проекты клиента">
      <div className="client-pick">
        <button type="button" className="client-name" aria-expanded={clientsOpen} onClick={() => setClientsOpen((v) => !v)} title={client.label ? "Клиенты в этом браузере" : "Укажите имя клиента или номер заказа"}><Users size={15} /><span>{client.label || "Клиент"}</span></button>
        {clientsOpen && <div className="client-menu" role="menu">
          <label>Клиент · № заказа или имя<input autoFocus aria-label="Имя клиента или номер заказа" defaultValue={client.label} maxLength={80} placeholder="Например: 7212718 Цецегов" onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setClientsOpen(false); }} onBlur={(e) => run(() => setIndex(renameClient(index, e.target.value)))} /></label>
          {index.clients.length > 1 && <div className="client-list">{index.clients.map((c) => <button key={c.id} type="button" role="menuitem" aria-pressed={c.id === index.active} onClick={() => { setIndex(switchClient(index, c.id)); setClientsOpen(false); }}>{c.label || "Клиент без имени"}<small>{c.projects.length} пр.</small></button>)}</div>}
          <div className="client-actions">
            <button type="button" className="outline" onClick={() => { const r = addClient(index); setIndex(r.index); setClientsOpen(false); }}><Plus size={14} /> Новый клиент</button>
            <button type="button" className="outline" onClick={() => run(() => { saveFile(`Клиент ${client.label || "без имени"}.garderyob.json`, JSON.stringify(clientBundle(localStorage, client), null, 1), "application/json"); })}><Download size={14} /> Скачать папку клиента</button>
          </div>
          <p className="client-hint">Хранится только в этом браузере. Открыть папку на другом компьютере — кнопкой «Открыть».</p>
        </div>}
      </div>
      <div className="project-tabs" role="tablist" aria-label="Проекты клиента">
        {client.projects.map((p) => (
          <div key={p.key} className={"project-tab" + (p.key === client.active ? " active" : "")} role="presentation">
            {editing === p.key
              ? <input autoFocus aria-label="Название проекта" defaultValue={p.title} maxLength={60} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }} onBlur={(e) => { run(() => setIndex(renameProject(index, p.key, e.target.value))); setEditing(null); }} />
              : <button type="button" role="tab" aria-selected={p.key === client.active} onClick={() => p.key !== client.active && setIndex(switchProject(index, p.key))} onDoubleClick={() => setEditing(p.key)} title="Двойной клик — переименовать">
                  <span>{p.title}</span><small>{p.price === undefined ? "…" : p.price === null ? "нет цены" : rub(p.price)}</small>
                </button>}
            {p.key === client.active && editing !== p.key && <button type="button" className="tab-icon" aria-label={"Переименовать проект " + p.title} onClick={() => setEditing(p.key)}><Pencil size={12} /></button>}
            {client.projects.length > 1 && (confirmDel === p.key
              ? <span className="tab-confirm">Удалить?<button type="button" onClick={() => { run(() => setIndex(removeProject(localStorage, index, p.key))); setConfirmDel(null); }}>Да</button><button type="button" onClick={() => setConfirmDel(null)}>Нет</button></span>
              : <button type="button" className="tab-icon" aria-label={"Удалить проект " + p.title} onClick={() => setConfirmDel(p.key)}><X size={12} /></button>)}
          </div>
        ))}
        <div className="project-add">
          <button type="button" className="add-project" aria-expanded={adding} onClick={() => setAdding((v) => !v)}><Plus size={15} /> Ещё проект</button>
          {adding && <div className="client-menu add-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { const r = addProject(localStorage, index, "Проект " + (client.projects.length + 1)); setIndex(r.index); setAdding(false); }}><FilePlus2 size={15} /> Новый проект<small>пустая комната, свой расчёт</small></button>
            <button type="button" role="menuitem" onClick={() => run(() => { const r = addProject(localStorage, index, (client.projects.find((p) => p.key === client.active)?.title ?? "Проект") + " · вариант", client.active); setIndex(r.index); setAdding(false); })}><Copy size={15} /> Копия этого проекта<small>для второго варианта</small></button>
          </div>}
        </div>
      </div>
      <div className="client-total">{client.projects.length > 1 && <>Итого по клиенту <b>{total === null ? "считаем…" : rub(total)}</b></>}</div>
      {error && <p role="alert" className="client-error">{error}</p>}
    </div>
  );
}
