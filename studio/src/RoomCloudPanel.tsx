import { useState, useRef } from "react";
import { studioApi } from "./studioApi";
import { parseRoomDocument, type RoomDocument } from "./roomDocument";
export function RoomCloudPanel({
  document,
  update,
}: {
  document: RoomDocument;
  update: (d: RoomDocument) => boolean;
}) {
  const latest = useRef(document);
  latest.current = document;
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [user, setUser] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [items, setItems] = useState<
      { id: string; name: string; revision: number }[]
    >([]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    const me = await studioApi("/me");
    setUser(me.email);
    const data = await studioApi("/projects");
    setItems(data.items);
  }
  return (
    <details>
      <summary>Сохранение на сервере</summary>
      <p>
        Нужен запущенный сервер кабинета и учётная запись сотрудника. До
        подтверждения сервера данные остаются локальными.
      </p>
      {!user && (
        <>
          <label>
            Логин
            <input
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                try {
                  await studioApi("/auth/login", { login, password });
                  await reload();
                } finally {
                  setPassword("");
                }
              })
            }
          >
            Войти
          </button>
        </>
      )}
      <button disabled={busy} onClick={() => run(reload)}>
        Проверить подключение
      </button>
      {user && (
        <>
          <p>Сотрудник: {user}</p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const linked =
                  document.cloud?.owner === user ? document.cloud : undefined;
                const result = await studioApi("/projects", {
                  id: linked?.id ?? crypto.randomUUID(),
                  name: document.customer ?? "Комнаты заказа",
                  revision: linked?.revision ?? 0,
                  data: document,
                });
                if (latest.current !== document) {
                  setMessage(
                    "Сервер сохранил отправленный снимок. В заказе уже есть новые правки: они оставлены локально. Серверная запись доступна в списке.",
                  );
                  await reload();
                  return;
                }
                const ok = update({
                  ...document,
                  cloud: {
                    id: result.id,
                    revision: result.revision,
                    owner: user,
                  },
                });
                setMessage(
                  ok
                    ? "Сервер подтвердил сохранение версии " + result.revision
                    : "Сервер сохранил версию, локальную связь обновить не удалось. Откройте сохранённую запись.",
                );
                await reload();
              })
            }
          >
            Сохранить комнаты на сервер
          </button>
          {items.map((item) => (
            <p key={item.id}>
              {item.name} · v{item.revision}{" "}
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const before = latest.current;
                    const result = await studioApi(
                      "/projects/" + encodeURIComponent(item.id),
                    );
                    if (latest.current !== before)
                      throw Error(
                        "Документ изменился во время загрузки. Повторите открытие серверной версии.",
                      );
                    const parsed = parseRoomDocument(result.data);
                    if (
                      update({
                        ...parsed,
                        cloud: {
                          id: item.id,
                          revision: result.revision,
                          owner: result.email,
                        },
                      })
                    )
                      setMessage("Открыта серверная версия " + result.revision);
                  })
                }
              >
                Открыть документ комнат
              </button>
            </p>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
