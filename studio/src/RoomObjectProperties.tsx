import { useState } from "react";
import type { Room, Opening } from "./project";
import { FIXTURES, type Fixture } from "./fixtures";
export type EnvironmentSelection = {
  kind: "opening" | "fixture" | "obstacle";
  id: string;
};
export function RoomObjectProperties({
  room,
  selection,
  onChange,
  onClose,
}: {
  room: Room;
  selection: EnvironmentSelection;
  onChange: (r: Room) => boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const list =
    selection.kind === "opening"
      ? room.openings
      : selection.kind === "fixture"
        ? room.fixtures
        : room.obstacles;
  const object = list?.find((o) => o.id === selection.id);
  if (!object) return null;
  function patch(change: Record<string, unknown>) {
    const key =
      selection.kind === "opening"
        ? "openings"
        : selection.kind === "fixture"
          ? "fixtures"
          : "obstacles";
    const next = {
      ...room,
      [key]: list!.map((o) => (o.id === object!.id ? { ...o, ...change } : o)),
    };
    try {
      if (onChange(next)) setError("");
      else
        setError(
          "Параметры не применены. Проверьте размеры и границы комнаты.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function number(
    key: string,
    title: string,
    value: number,
    change?: (v: number) => void,
  ) {
    return (
      <label key={key}>
        {title}
        <input
          aria-label={title}
          type="number"
          key={String(value)}
          defaultValue={value}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = String(value);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const v = e.target.value.trim() ? Number(e.target.value) : NaN;
            if (!Number.isFinite(v)) {
              setError("Введите число.");
              return;
            }
            if (v !== value) (change ?? ((n) => patch({ [key]: n })))(v);
          }}
        />
      </label>
    );
  }
  const o = selection.kind === "opening" ? (object as Opening) : undefined,
    f = selection.kind === "fixture" ? (object as Fixture) : undefined;
  return (
    <aside
      className="environment-properties"
      role="dialog"
      aria-label="Параметры объекта помещения"
    >
      <header>
        <strong>
          {o
            ? o.type === "door"
              ? "Дверь"
              : "Окно"
            : f
              ? FIXTURES[f.type].label
              : "Препятствие"}
        </strong>
        <button onClick={onClose}>Закрыть параметры</button>
      </header>
      {o || f ? (
        <label>
          Стена
          <select
            aria-label="Стена объекта"
            value={(o || f)!.wall}
            onChange={(e) => patch({ wall: e.target.value })}
          >
            {Object.entries({
              back: "Задняя",
              left: "Левая",
              right: "Правая",
              front: "Передняя",
            }).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {number("width", o ? "Ширина проёма" : "Ширина объекта", object.width)}
      {number("height", o ? "Высота проёма" : "Высота объекта", object.height)}
      {o && (
        <>
          {number("offset", "От начала стены", o.offset)}
          {number("sill", "Низ проёма от пола", o.sill)}
          {number("casing", "Ширина наличников", o.casing ?? 60)}
          {number("casingThick", "Выступ наличников", o.casingThick ?? 12)}
          {number("frameDepth", "Глубина коробки или рамы", o.frameDepth ?? 80)}
          {number("reveal", "Глубина откосов", o.reveal ?? 0)}
          <label>
            Петли
            <select
              value={o.hinge ?? "left"}
              onChange={(e) => patch({ hinge: e.target.value })}
            >
              <option value="left">Слева</option>
              <option value="right">Справа</option>
            </select>
          </label>
          <label>
            Открывание
            <select
              value={o.direction ?? "in"}
              onChange={(e) => patch({ direction: e.target.value })}
            >
              <option value="in">В комнату</option>
              <option value="out">Из комнаты</option>
            </select>
          </label>
          {number("swingAngle", "Угол открывания", o.swingAngle ?? 90)}
          {number("handleProjection", "Выступ ручки", o.handleProjection ?? 60)}
          <label>
            Цвет
            <input
              aria-label="Цвет проёма"
              type="color"
              value={o.color ?? "#aa8e6d"}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          {o.type === "window" && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={!!o.windowSill}
                  onChange={(e) =>
                    patch({
                      windowSill: e.target.checked
                        ? {
                            width: o.width + 100,
                            thick: 30,
                            overhang: 80,
                            offset: Math.max(0, o.offset - 50),
                          }
                        : undefined,
                    })
                  }
                />
                Подоконник
              </label>
              {o.windowSill &&
                (["width", "thick", "overhang", "offset"] as const).map((k) =>
                  number(
                    k,
                    {
                      width: "Ширина подоконника",
                      thick: "Толщина подоконника",
                      overhang: "Вылет подоконника",
                      offset: "Подоконник от начала стены",
                    }[k],
                    o.windowSill![k],
                    (v) => patch({ windowSill: { ...o.windowSill!, [k]: v } }),
                  ),
                )}
            </>
          )}
        </>
      )}
      {f && (
        <>
          {number("offset", "От начала стены", f.offset)}
          {number("fromFloor", "От пола", f.fromFloor)}
          {number("depth", "Выступ или глубина", f.depth)}
          {number("wallGap", "Зазор от стены", f.wallGap ?? 0)}
          {number(
            "serviceClearance",
            "Зона доступа перед объектом",
            f.serviceClearance ?? 0,
          )}
          <p>
            Зона доступа задаётся по документации изделия; 0 означает, что она
            не задана.
          </p>
          <label>
            Цвет
            <input
              aria-label="Цвет препятствия"
              type="color"
              value={f.color ?? "#c7bcae"}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          {f.type === "pipe" && (
            <>
              {number(
                "diameter",
                "Наружный диаметр трубы",
                f.diameter ?? Math.min(f.width, f.depth),
                (v) => {
                  const diameter = v,
                    outer = v + 2 * (f.insulation ?? 0);
                  patch({
                    diameter,
                    round: true,
                    depth: outer,
                    ...(f.horizontal ? { height: outer } : { width: outer }),
                  });
                },
              )}
              {number(
                "insulation",
                "Толщина изоляции",
                f.insulation ?? 0,
                (v) => {
                  const diameter = f.diameter ?? Math.min(f.width, f.depth),
                    outer = diameter + 2 * v;
                  patch({
                    diameter,
                    insulation: v,
                    round: true,
                    depth: outer,
                    ...(f.horizontal ? { height: outer } : { width: outer }),
                  });
                },
              )}
              <label>
                <input
                  type="checkbox"
                  checked={!!f.horizontal}
                  onChange={(e) =>
                    patch({
                      horizontal: e.target.checked,
                      width: f.height,
                      height: f.width,
                    })
                  }
                />
                Горизонтальная труба
              </label>
            </>
          )}
        </>
      )}
      {!o &&
        !f &&
        (["x", "y", "z", "depth"] as const).map((k) =>
          number(
            k,
            {
              x: "Положение X",
              y: "Положение Y",
              z: "Положение Z",
              depth: "Глубина объекта",
            }[k],
            (object as any)[k],
          ),
        )}
      <button
        onClick={() => {
          const key =
            selection.kind === "opening"
              ? "openings"
              : selection.kind === "fixture"
                ? "fixtures"
                : "obstacles";
          try {
            if (
              onChange({
                ...room,
                [key]: list!.filter((o) => o.id !== object.id),
              })
            )
              onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Удалить этот объект
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
