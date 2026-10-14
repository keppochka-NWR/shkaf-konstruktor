import { RoomCloudPanel } from "./RoomCloudPanel";
import { useState, useEffect } from "react";
import {
  activeRoom,
  attachRoom,
  loadVariant,
  saveVariant,
  selectRoom,
  updateRoom,
  type RoomDocument,
} from "./roomDocument";
import { roomSummary, handoffHTML, bazisExport } from "./RoomDeliverables";
import { freePanel, placeFreePanel, type FreePanelInput } from "./freePanels";
import { catalog } from "./catalog";
import { saveFile } from "./exports";
import { estimate } from "./pricing";
import { RoomSurveyEditor } from "./RoomSurveyEditor";
export function RoomTools({
  document,
  update,
}: {
  document: RoomDocument;
  update: (d: RoomDocument) => boolean;
}) {
  const room = activeRoom(document),
    [error, setError] = useState(""),
    [side, setSide] = useState<"back" | "front" | "left" | "right">("right"),
    [title, setTitle] = useState("Вариант"),
    [editPanel, setEditPanel] = useState<string | null>(null),
    [contour, setContour] = useState("");
  const [panel, setPanel] = useState<FreePanelInput>({
    name: "Панель",
    width: 600,
    height: 2000,
    thickness: 16,
    plane: "xy",
    edge: 0.4,
    decor: "Белый",
  });
  const summary = roomSummary(document),
    total = summary.some((x) => x.price === null)
      ? null
      : summary.reduce((s, x) => s + (x.price ?? 0), 0);
  function run(action: () => RoomDocument) {
    try {
      if (update(action())) setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function edit(id: string) {
    const m = room.project.modules.find((a) => a.id === id)!.module,
      p = m.raw!.panels[0],
      plane = p.plane ?? "xy",
      size = [p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]],
      w = plane === "yz" ? size[2] : size[0],
      h = plane === "xz" ? size[2] : size[1];
    setPanel({
      name: m.name,
      width: w,
      height: h,
      thickness: p.thick ?? 16,
      plane,
      edge: p.edges?.[0]?.[0] ?? 0,
      decor: m.decor,
    });
    setEditPanel(id);
    setContour(
      p.contour
        ?.map((p) => (plane === "yz" ? [p[1], p[0]] : p).join(" "))
        .join("\n") ?? "",
    );
  }
  const edited = room.project.modules.find((a) => a.id === editPanel);
  const editedSignature = edited
    ? JSON.stringify([
        edited.module.name,
        edited.module.decor,
        edited.module.raw,
      ])
    : "";
  useEffect(() => {
    if (editPanel && edited) edit(editPanel);
    else if (editPanel) {
      setEditPanel(null);
      setContour("");
    }
  }, [room.id, editPanel, editedSignature]);
  const positions = document.rooms.map((r, i) => ({
      r,
      x: r.origin?.x ?? i * 5000,
      z: r.origin?.z ?? 0,
    })),
    minX = Math.min(...positions.map((p) => p.x)),
    minZ = Math.min(...positions.map((p) => p.z)),
    maxX = Math.max(...positions.map((p) => p.x + p.r.project.room.width)),
    maxZ = Math.max(...positions.map((p) => p.z + p.r.project.room.depth));
  return (
    <details className="room-tools">
      <summary>Общий план · замер · панели · варианты · передача</summary>
      <div className="room-tools-grid">
        <section>
          <h3>Заказ и достройка</h3>
          <label>
            Клиент / заказ
            <input
              aria-label="Клиент заказа комнат"
              key={document.customer ?? ""}
              defaultValue={document.customer ?? ""}
              onBlur={(e) =>
                run(() => ({
                  ...document,
                  customer: e.target.value.trim() || undefined,
                }))
              }
            />
          </label>
          <p>
            Общая цена:{" "}
            {total === null
              ? "есть неоценённые позиции"
              : total.toLocaleString("ru-RU") + " ₽"}
          </p>
          <ul>
            {summary.map((r) => (
              <li key={r.id}>
                {r.title}:{" "}
                {r.price === null ? "нет полной цены" : r.price + " ₽"} ·{" "}
                {r.modules} мод.
              </li>
            ))}
          </ul>
          <svg
            aria-label="Общий план комнат"
            viewBox={`${minX - 300} ${minZ - 300} ${maxX - minX + 600} ${maxZ - minZ + 600}`}
            width="420"
            height="240"
          >
            {positions.map(({ r, x, z }) => (
              <g
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={"Выбрать комнату " + r.title}
                onClick={() => run(() => selectRoom(document, r.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run(() => selectRoom(document, r.id));
                }}
              >
                <rect
                  x={x}
                  y={z}
                  width={r.project.room.width}
                  height={r.project.room.depth}
                  fill={r.id === room.id ? "#d2e9e2" : "#edf0f3"}
                  stroke="#345"
                  strokeWidth="25"
                />
                <text
                  x={x + r.project.room.width / 2}
                  y={z + r.project.room.depth / 2}
                  textAnchor="middle"
                  fontSize="220"
                >
                  {r.title}
                </text>
              </g>
            ))}
          </svg>
          <label>
            Сторона достройки
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as typeof side)}
            >
              {Object.entries({
                right: "Справа",
                left: "Слева",
                front: "Спереди",
                back: "Сзади",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              run(() =>
                attachRoom(
                  document,
                  "Комната " + (document.rooms.length + 1),
                  side,
                ),
              )
            }
          >
            Достроить комнату с общей дверью
          </button>
          {(document.links ?? [])
            .filter((l) => l.a === room.id || l.b === room.id)
            .map((l) => (
              <p key={l.id}>
                Общая дверь связана с соседней комнатой.{" "}
                <button
                  onClick={() =>
                    run(() => ({
                      ...document,
                      links: document.links?.filter((x) => x.id !== l.id),
                    }))
                  }
                >
                  Разорвать связь двери
                </button>
              </p>
            ))}
        </section>
        <section>
          <h3>Варианты комнаты</h3>
          <input
            aria-label="Название варианта"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button onClick={() => run(() => saveVariant(document, title))}>
            Сохранить вариант
          </button>
          <button onClick={() => run(() => saveVariant(document, title, true))}>
            Зафиксировать согласованный вариант
          </button>
          <p>
            Снимок содержит мебель и замер на момент сохранения. Дальнейшие
            изменения не меняют снимок.
          </p>
          {(room.variants ?? []).map((v) => (
            <p key={v.id}>
              <strong>{v.title}</strong> {v.approvedAt ? "согласован" : "эскиз"}{" "}
              ·{" "}
              {v.project.modules.length
                ? (estimate(v.project).retail ?? "неполная цена")
                : 0}{" "}
              ₽{" "}
              <button onClick={() => run(() => loadVariant(document, v.id))}>
                Открыть копию варианта
              </button>
            </p>
          ))}
          <RoomCloudPanel document={document} update={update} />
          <h3>Передача технологу</h3>
          <button
            onClick={() =>
              saveFile("Ё Конструктор передача.html", handoffHTML(document))
            }
          >
            Скачать план и деталировку
          </button>
          <button
            onClick={() => {
              try {
                const data = bazisExport(document);
                saveFile(
                  "Ё Конструктор Базис manifest.json",
                  JSON.stringify(data.manifest, null, 2),
                  "application/json",
                );
                setError(
                  data.manifest.unsupported.length
                    ? `В выгрузке ${data.manifest.unsupported.length} деталей требуют отдельного переноса. Список в manifest.`
                    : "Ведомость выгрузки сохранена. Материалы, кромки и присадку сверяет технолог.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Ведомость для Базиса
          </button>
          <button
            onClick={() => {
              try {
                const data = bazisExport(document);
                if (data.manifest.unsupported.length)
                  throw Error(
                    "Скрипт не создаётся: есть сложные детали, которые он пока не переносит. Скачайте ведомость.",
                  );
                saveFile(
                  "Ё Конструктор построить в Базисе.js",
                  data.script,
                  "text/javascript;charset=utf-8",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Скрипт панелей для Базиса
          </button>
          <p>
            Пилот: прямоугольные панели, материал выбирается в Базисе. Кромки и
            присадка не назначаются. Выполнять в новом документе; затем
            сохранить .b3d.
          </p>
        </section>
        <section>
          <h3>
            {editPanel
              ? "Изменить отдельную панель"
              : "Добавить отдельную панель"}
          </h3>
          <label>
            Название
            <input
              value={panel.name}
              onChange={(e) => setPanel({ ...panel, name: e.target.value })}
            />
          </label>
          {(["width", "height", "thickness", "edge"] as const).map((k) => (
            <label key={k}>
              {
                {
                  width: "Длина панели",
                  height: "Ширина панели",
                  thickness: "Толщина панели",
                  edge: "Кромка по контуру",
                }[k]
              }
              <input
                aria-label={
                  {
                    width: "Длина панели",
                    height: "Ширина панели",
                    thickness: "Толщина панели",
                    edge: "Кромка по контуру",
                  }[k]
                }
                type="number"
                value={panel[k]}
                onChange={(e) =>
                  setPanel({ ...panel, [k]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <label>
            Плоскость
            <select
              value={panel.plane}
              onChange={(e) =>
                setPanel({
                  ...panel,
                  plane: e.target.value as FreePanelInput["plane"],
                })
              }
            >
              <option value="xy">Фронтальная</option>
              <option value="xz">Горизонтальная</option>
              <option value="yz">Боковая</option>
            </select>
          </label>
          <label>
            Материал
            <select
              value={panel.decor}
              onChange={(e) => setPanel({ ...panel, decor: e.target.value })}
            >
              {catalog.map((c) => (
                <option value={c.n} key={c.n}>
                  {c.n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Контур: пары координат через пробел, каждая вершина с новой строки
            <textarea
              aria-label="Контур отдельной панели"
              placeholder="Пусто — прямоугольник"
              value={contour}
              onChange={(e) => setContour(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              run(() => {
                const coordinates = contour.trim()
                  ? contour
                      .trim()
                      .split("\n")
                      .map(
                        (s) =>
                          s.trim().split(/\s+/).map(Number) as [number, number],
                      )
                  : undefined;
                const old = room.project.modules.find(
                    (a) => a.id === editPanel,
                  ),
                  placed = old
                    ? freePanel({ ...panel, contour: coordinates })
                    : placeFreePanel(room.project, {
                        ...panel,
                        contour: coordinates,
                      });
                const next = old
                  ? {
                      ...placed,
                      id: old.id,
                      x: old.x,
                      y: old.y,
                      z: old.z,
                      rotation: old.rotation,
                    }
                  : placed;
                return updateRoom(document, room.id, {
                  ...room.project,
                  modules: old
                    ? room.project.modules.map((a) =>
                        a.id === old.id ? next : a,
                      )
                    : [...room.project.modules, next],
                });
              })
            }
          >
            {editPanel ? "Применить панель" : "Добавить панель в комнату"}
          </button>
          <button
            onClick={() => {
              setEditPanel(null);
              setContour("");
            }}
          >
            Новая панель
          </button>
          {room.project.modules
            .filter((a) => a.module.raw?.source === "garderyob-free-panel")
            .map((a) => (
              <p key={a.id}>
                <button onClick={() => edit(a.id)}>
                  {a.module.name} — параметры
                </button>
                <button
                  onClick={() =>
                    run(() =>
                      updateRoom(document, room.id, {
                        ...room.project,
                        modules: room.project.modules.filter(
                          (x) => x.id !== a.id,
                        ),
                      }),
                    )
                  }
                >
                  Удалить панель
                </button>
              </p>
            ))}
        </section>
        <section>
          <RoomSurveyEditor
            room={room.project.room}
            onChange={(r) =>
              update(
                updateRoom(document, room.id, { ...room.project, room: r }),
              )
            }
          />
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
