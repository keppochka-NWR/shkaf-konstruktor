import { createContext, useContext } from "react";
import { moduleFootprint } from "./project";
import { roomOutline, flatten } from "./roomOutline";
import type { RoomDocument } from "./roomDocument";
export const ApartmentNavigation = createContext<{
  openPlan: () => void;
  openAssistant: () => void;
  title: string;
} | null>(null);
export function ApartmentTabs({ roomStage }: { roomStage: boolean }) {
  const nav = useContext(ApartmentNavigation);
  if (!nav) return null;
  return (
    <div className="yo-room-tabs">
      {roomStage && (
        <>
          <button onClick={nav.openPlan}>Комнаты · план квартиры</button>
          <span>{nav.title} · замер</span>
        </>
      )}
      <button onClick={nav.openAssistant}>Помощник · анализ ДП</button>
    </div>
  );
}
export function ApartmentPlan({
  document,
  onSelect,
  onAdd,
  onAssistant,
}: {
  document: RoomDocument;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAssistant: () => void;
}) {
  const positioned = document.rooms.filter((r) => r.origin);
  let offset = positioned.length
    ? Math.max(...positioned.map((r) => r.origin!.x + r.project.room.width)) + 500
    : 0;
  const rooms = document.rooms.map((r) => {
    const x = r.origin?.x ?? offset,
      z = r.origin?.z ?? 0;
    if (!r.origin) offset = x + r.project.room.width + 500;
    return { r, x, z };
  });
  const minX = Math.min(...rooms.map((r) => r.x)) - 400,
    minZ = Math.min(...rooms.map((r) => r.z)) - 400,
    maxX = Math.max(...rooms.map(({ r, x }) => x + r.project.room.width)) + 400,
    maxZ = Math.max(...rooms.map(({ r, z }) => z + r.project.room.depth)) + 400;
  return (
    <section className="yo-apartment" aria-label="План всей квартиры">
      <header>
        <strong>Помещение / Комнаты</strong>
        <button onClick={onAdd}>Добавить комнату</button>
        <button onClick={onAssistant}>Загрузить дизайн-проект</button>
        <button onClick={() => onSelect(document.activeRoomId)}>
          К замеру комнаты
        </button>
      </header>
      <p style={{ margin: "12px" }}>
        Выберите комнату для подробного замера. Здесь показан только вид сверху.
        Комнаты без заданных координат расположены рядом условно.
      </p>
      <svg
        viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`}
        aria-label="Комнаты и мебель сверху"
      >
        {rooms.map(({ r, x, z }) => (
          <g
            key={r.id}
            role="button"
            tabIndex={0}
            aria-label={"Открыть замер: " + r.title}
            onClick={() => onSelect(r.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r.id);
              }
            }}
          >
            <polygon
              points={flatten(roomOutline(r.project.room))
                .pts.map((p) => `${x + p.x},${z + p.z}`)
                .join(" ")}
              fill={r.id === document.activeRoomId ? "#edf1ff" : "#fff"}
              stroke="#738399"
              strokeWidth={30}
            />
            {r.project.modules.map((m) => (
              <polygon
                key={m.id}
                points={moduleFootprint(m)
                  .map((p) => `${x + p.x},${z + p.z}`)
                  .join(" ")}
                fill="#bcc9e9"
                stroke="#325bee"
                strokeWidth={15}
              />
            ))}
            <text
              x={x + r.project.room.width / 2}
              y={z + r.project.room.depth / 2}
              textAnchor="middle"
              fontSize={180}
              fill="#243248"
            >
              {r.title}
            </text>
            <text
              x={x + r.project.room.width / 2}
              y={z + r.project.room.depth / 2 + 240}
              textAnchor="middle"
              fontSize={130}
              fill="#68778a"
            >
              {r.project.room.width} × {r.project.room.depth} мм
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}
