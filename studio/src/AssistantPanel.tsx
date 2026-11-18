import { useCallback, useEffect, useRef, useState } from "react";
import { assistantContext, type AssistantProposal } from "./assistantProposal";
import type { RoomDocument } from "./roomDocument";
import { studioApi } from "./studioApi";

type Attachment = { name: string; data: string };
export function AssistantPanel({
  document,
  onApply,
  onClose,
  hidden = false,
  onUndo,
}: {
  document: RoomDocument;
  onApply: (p: AssistantProposal, revision: number) => boolean;
  onClose: () => void;
  hidden?: boolean;
  onUndo: () => void;
}) {
  const [text, setText] = useState(""),
    [files, setFiles] = useState<Attachment[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [messages, setMessages] = useState<
      { role: "user" | "assistant"; text: string }[]
    >([]),
    [proposal, setProposal] = useState<AssistantProposal | null>(null),
    [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const conversationId = document.rooms[0].id;
  const [connection, setConnection] = useState(""),
    [applied, setApplied] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  const [access, setAccess] = useState<"checking" | "login" | "ready" | "offline">("checking");
  const [loginOpen, setLoginOpen] = useState(false);
  const [login, setLogin] = useState(""), [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const publicSite = window.location.hostname.endsWith(".github.io");
  const checkConnection = useCallback(async (signal?: AbortSignal) => {
    setAccess("checking");
    if (publicSite) {
      setConnection("На этой публичной странице помощник не подключён. Откройте серверную версию конструктора и войдите в кабинет.");
      setAccess("offline"); return;
    }
    try {
      const r = await fetch("/api/studio/assistant/status", {signal});
      if (signal?.aborted) return;
      if (r.status === 401) {
        setConnection("Для помощника нужен вход в кабинет. Войдите здесь — проект и черновик останутся открыты.");
        setAccess("login"); return;
      }
      if (!r.ok) throw Error("Сервер помощника недоступен. Повторите проверку подключения.");
      const status = await r.json();
      if (signal?.aborted) return;
      setAccess(status.configured ? "ready" : "offline");
      setConnection(status.configured ? (status.ownerPilot ? "Astra · пилот для владельца" : status.model) : "Подключение модели ещё не настроено.");
    } catch (e) {
      if (signal?.aborted) return;
      setAccess("offline"); setConnection("Сервер помощника недоступен. Повторите проверку подключения.");
    }
  }, [publicSite]);
  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    const refresh = () => { void checkConnection(controller.signal); };
    refresh();
    window.addEventListener("studio-auth-changed", refresh);
    return () => { controller.abort(); window.removeEventListener("studio-auth-changed", refresh); };
  }, [hidden, checkConnection]);
  useEffect(() => {
    if (hidden || access !== "ready") return;
    const controller = new AbortController();
    void fetch("/api/studio/assistant/history/" + encodeURIComponent(conversationId), {signal:controller.signal})
      .then(async r => { if(r.ok) { const data=await r.json(); if(!controller.signal.aborted && Array.isArray(data.messages)) setMessages(m=>m.length?m:data.messages); } })
      .catch(()=>{});
    return () => controller.abort();
  }, [hidden, access, conversationId]);
  async function signIn() {
    if (signingIn) return;
    setSigningIn(true); setError("");
    try {
      await studioApi("/auth/login", {login, password});
      setLoginOpen(false);
      await checkConnection();
    } catch (e) { setError((e as Error).message); }
    finally { setPassword(""); setSigningIn(false); }
  }
  async function send() {
    if (!text.trim() || busy || access !== "ready") return;
    setBusy(true);
    setError("");
    setProposal(null);
    const message = text.trim(),
      history = messages.slice(-8);
    setText("");
    const base = document.revision;
    request.current = new AbortController();
    try {
      const response = await fetch("/api/studio/assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Studio-Request": "1",
        },
        body: JSON.stringify({
          message,
          conversationId,
          history,
          context: assistantContext(document),
          attachments: files,
        }),
        signal: request.current.signal,
      });
      if (response.status === 401) {
        setAccess("login");
        setConnection("Сессия завершилась. Войдите снова: черновик и вложения сохранены.");
        throw Error("Войдите в кабинет, затем повторите отправку.");
      }
      const data = await response.json().catch(() => { throw Error("Сервер помощника вернул некорректный ответ. Повторите проверку подключения."); });
      if (!response.ok)
        throw Error(data.detail || "Не удалось получить ответ.");
      setProposal(data);
      setRevision(base);
      setMessages((m) => [...m, { role: "user", text: message }, { role: "assistant", text: data.message }]);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "Ожидание остановлено. Сервер может завершить анализ; проект не изменяется."
          : (e as Error).message,
      );
      setText(message);
    } finally {
      setBusy(false);
    }
  }
  async function attach(list: FileList | null) {
    if (!list) return;
    try {
      const selected = Array.from(list);
      if (files.length + selected.length > 6)
        throw Error("Можно приложить до 6 файлов.");
      const total =
        selected.reduce((n, f) => n + f.size, 0) +
        files.reduce((n, f) => n + f.data.length * 0.75, 0);
      if (total > 12_000_000) throw Error("Общий размер файлов — до 12 МБ.");
      const added = await Promise.all(
        selected.map(async (f) => {
          if (
            ![
              "image/jpeg",
              "image/png",
              "image/webp",
              "application/pdf",
            ].includes(f.type)
          )
            throw Error("Поддерживаются JPG, PNG, WebP и PDF.");
          return {
            name: f.name,
            data: await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () =>
                reject(Error("Не удалось прочитать файл."));
              reader.readAsDataURL(f);
            }),
          };
        }),
      );
      setFiles((f) => [...f, ...added]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <aside
      hidden={hidden}
      className="yo-assistant"
      aria-label="Помощник конструктора"
    >
      <header>
        <div>
          <strong>Помощник</strong>
          <small>{connection || "Квартира · мебель · производство"}</small>
        </div>
        <button aria-label="Закрыть помощника" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="yo-assistant-access">
        {access === "login" && <button type="button" onClick={() => setLoginOpen(v=>!v)}>Войти в кабинет</button>}
        {access !== "ready" && !publicSite && <button type="button" disabled={access === "checking"} onClick={()=>void checkConnection()}>Проверить подключение</button>}
        {access === "login" && loginOpen && <form onSubmit={e=>{e.preventDefault();void signIn();}}>
          <label>Логин<input autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} required maxLength={64}/></label>
          <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label>
          <button type="submit" disabled={signingIn}>{signingIn?"Входим…":"Войти"}</button>
          <small>Используйте логин и пароль кабинета конструктора. Доступ выдаёт администратор.</small>
        </form>}
      </div>
      <div className="yo-assistant-messages" aria-live="polite">
        {!messages.length && (
          <>
            <h3>От идеи к редактируемой мебели</h3>
            <p>
              Прикрепите дизайн-проект квартиры или изображение мебели. Укажите
              известные размеры. Предложения применяются к проекту только по
              вашей кнопке.
            </p>
            <button
              onClick={() =>
                setText(
                  "Разбери дизайн-проект всей квартиры. Выдели комнаты и перечисли недостающие размеры. Пока не добавляй мебель.",
                )
              }
            >
              Анализ ДП квартиры
            </button>
            <button
              onClick={() =>
                setText(
                  "Разбери мебель на рендере. Уточни габариты и предложи редактируемую конструкцию.",
                )
              }
            >
              Мебель по рендеру
            </button>
          </>
        )}
        {messages.map((m, i) => (
          <p className={"yo-chat-" + m.role} key={i}>
            {m.text}
          </p>
        ))}
        {proposal && (
          <section className="yo-proposal">
            {proposal.warnings.map((w, i) => (
              <p key={i}>⚠ {w}</p>
            ))}
            {proposal.questions.map((q, i) => (
              <div key={i}>
                <b>{q.question}</b>
                <div className="yo-choices">
                  {q.options.map((o) => (
                    <button
                      key={o}
                      onClick={() =>
                        setText(
                          (t) => (t ? t + "\n" : "") + q.question + " " + o,
                        )
                      }
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!!(
              proposal.rooms.length +
              proposal.furniture.length +
              (proposal.updates?.length ?? 0)
            ) && (
              <>
                <h4>Предложение</h4>
                <ul>
                  {proposal.rooms.map((r, i) => (
                    <li key={"r" + i}>
                      Комната «{r.name}»: {r.width} × {r.depth} мм
                    </li>
                  ))}
                  {proposal.furniture.map((m, i) => (
                    <li key={"m" + i}>
                      {m.name}: {m.width} × {m.height} × {m.depth} мм
                    </li>
                  ))}
                  {proposal.updates?.map((u, i) => (
                    <li key={"u" + i}>
                      Изменить{" "}
                      {document.rooms
                        .find((r) => r.id === u.roomId)
                        ?.project.modules.find((m) => m.id === u.moduleId)
                        ?.module.name ?? "корпус"}
                      :{" "}
                      {Object.entries(u)
                        .filter(
                          ([k, v]) =>
                            !["roomId", "moduleId"].includes(k) && v !== null,
                        )
                        .map(
                          ([k, v]) =>
                            (({
                              width: "ширина",
                              height: "высота",
                              depth: "глубина",
                              x: "отступ X",
                              z: "отступ Z",
                            })[k] ?? k) +
                            ": " +
                            v +
                            " мм",
                        )
                        .join(", ")}
                    </li>
                  ))}
                </ul>
                <p>
                  Будут применены только перечисленные добавления и изменения.
                </p>
                <button
                  className="primary"
                  disabled={revision !== document.revision}
                  onClick={() => {
                    if (onApply(proposal, revision)) {
                      setProposal(null);
                      setApplied(true);
                    }
                  }}
                >
                  Применить к проекту
                </button>
                {revision !== document.revision && (
                  <p>Проект изменился. Запросите обновлённое предложение.</p>
                )}
              </>
            )}
          </section>
        )}
        {applied && (
          <p>
            Предложение добавлено.{" "}
            <button
              onClick={() => {
                onUndo();
                setApplied(false);
              }}
            >
              Отменить последнее изменение
            </button>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Анализирую проект…</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="yo-attachments">
          {files.map((f, i) => (
            <span key={i}>
              {f.name}
              <button
                type="button"
                aria-label={"Убрать вложение " + f.name}
                onClick={() => setFiles((a) => a.filter((_, j) => i !== j))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <label className="yo-upload">
          Прикрепить ДП или рендер
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={busy}
            onChange={(e) => {
              void attach(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <textarea
          aria-label="Сообщение помощнику"
          placeholder="Что нужно построить или уточнить?"
          value={text}
          maxLength={6000}
          onChange={(e) => setText(e.target.value)}
        />
        <small>
          Вложения и параметры проекта отправляются модели OpenAI при нажатии
          «Отправить».
        </small>
        <div>
          {busy ? (
            <button type="button" onClick={() => request.current?.abort()}>
              Прекратить ожидание
            </button>
          ) : (
            <button className="primary" disabled={!text.trim() || access !== "ready"}>
              Отправить
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}
