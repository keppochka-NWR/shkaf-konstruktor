import { useState } from "react";
import type { Room } from "./project";
import {
  initialGrid,
  parseSurvey,
  SURFACE_NAMES,
  surveyNotes,
  type Survey,
  type Surface,
  type Reading,
} from "./roomSurvey";
export function RoomSurveyEditor({
  room,
  onChange,
}: {
  room: Room;
  onChange: (r: Room) => boolean;
}) {
  const [error, setError] = useState("");
  const survey = room.survey ?? { readings: [], surfaces: {}, notes: "" };
  function apply(s: Survey) {
    try {
      parseSurvey(s);
      if (onChange({ ...room, survey: s })) setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function field(
    label: string,
    value: number,
    set: (v: number) => void,
    unmeasured = false,
  ) {
    return (
      <label>
        {label}
        <input
          type="number"
          aria-label={label}
          key={String(value) + unmeasured}
          placeholder={unmeasured ? "не измерено" : undefined}
          defaultValue={unmeasured ? "" : value}
          onBlur={(e) => {
            if (
              e.target.value.trim() !== "" &&
              (unmeasured || Number(e.target.value) !== value)
            )
              set(Number(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
    );
  }
  return (
    <section className="survey-editor">
      <h3>Замер по точкам</h3>
      <p>
        Координаты X, Y, Z — место замера от левого заднего угла и чистового
        пола. Все значения в мм.
      </p>
      {(["width", "height", "depth"] as const).map((axis) => (
        <div key={axis}>
          <h4>
            {{ width: "Ширина", height: "Высота", depth: "Глубина" }[axis]}
          </h4>
          {survey.readings
            .filter((r) => r.axis === axis)
            .map((r, i) => (
              <div className="survey-reading" key={r.id}>
                {(["x", "y", "z", "value"] as const).map((k) =>
                  field(
                    `${{ width: "Ширина", height: "Высота", depth: "Глубина" }[axis]} ${i + 1} ${{ x: "X", y: "Y", z: "Z", value: "Значение" }[k]}`,
                    r[k],
                    (v) =>
                      apply({
                        ...survey,
                        readings: survey.readings.map((a) =>
                          a.id === r.id
                            ? {
                                ...a,
                                [k]: v,
                                ...(k === "value"
                                  ? { status: "measured" as const }
                                  : {}),
                              }
                            : a,
                        ),
                      }),
                  ),
                )}
                <label>
                  Статус
                  <select
                    value={r.status ?? "measured"}
                    onChange={(e) =>
                      apply({
                        ...survey,
                        readings: survey.readings.map((a) =>
                          a.id === r.id
                            ? {
                                ...a,
                                status: e.target.value as Reading["status"],
                              }
                            : a,
                        ),
                      })
                    }
                  >
                    <option value="unverified">Требуется замер</option>
                    <option value="measured">Измерено</option>
                    <option value="reported">Со слов</option>
                  </select>
                </label>
                <label>
                  Источник / инструмент
                  <input
                    defaultValue={r.source ?? ""}
                    onBlur={(e) =>
                      apply({
                        ...survey,
                        readings: survey.readings.map((a) =>
                          a.id === r.id ? { ...a, source: e.target.value } : a,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Дата
                  <input
                    type="date"
                    defaultValue={r.date ?? ""}
                    onBlur={(e) =>
                      apply({
                        ...survey,
                        readings: survey.readings.map((a) =>
                          a.id === r.id ? { ...a, date: e.target.value } : a,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    apply({
                      ...survey,
                      readings: survey.readings.filter((a) => a.id !== r.id),
                    })
                  }
                >
                  Удалить замер
                </button>
              </div>
            ))}
          <button
            onClick={() => {
              const n = survey.readings.filter((r) => r.axis === axis).length;
              const r: Reading = {
                id: crypto.randomUUID(),
                axis,
                status: "unverified",
                x: 0,
                y: Math.min(room.height, n * 700),
                z: 0,
                value: room[axis],
                note: "",
              };
              apply({ ...survey, readings: [...survey.readings, r] });
            }}
          >
            Добавить замер:{" "}
            {{ width: "ширина", height: "высота", depth: "глубина" }[axis]}
          </button>
        </div>
      ))}
      <h3>Отклонения поверхностей от лазера</h3>
      <p>
        Положительный отступ направлен внутрь комнаты. Сетка задаёт положение
        точек; значения между ними интерполируются. До ввода реальных значений
        нулевая сетка — только заготовка.
      </p>
      {(Object.keys(SURFACE_NAMES) as Surface[]).map((side) => {
        const g = survey.surfaces[side];
        return (
          <details key={side}>
            <summary>
              {SURFACE_NAMES[side]}
              {g ? " · сетка" : ""}
            </summary>
            {!g ? (
              <button
                onClick={() =>
                  apply({
                    ...survey,
                    surfaces: {
                      ...survey.surfaces,
                      [side]: initialGrid(room, side),
                    },
                  })
                }
              >
                Добавить сетку {SURFACE_NAMES[side]}
              </button>
            ) : (
              <>
                <label>
                  Лазерная база
                  <input
                    defaultValue={g.datum}
                    key={g.datum}
                    onBlur={(e) =>
                      apply({
                        ...survey,
                        surfaces: {
                          ...survey.surfaces,
                          [side]: { ...g, datum: e.target.value },
                        },
                      })
                    }
                  />
                </label>
                <p>
                  U — вдоль стены (для пола и потолка X); V — высота (для пола и
                  потолка Z).
                </p>
                {(["u", "v"] as const).map((k) => (
                  <label key={k}>
                    Координаты {k.toUpperCase()} через пробел
                    <input
                      aria-label={`${side} координаты ${k}`}
                      key={g[k].join(",")}
                      defaultValue={g[k].join(" ")}
                      onBlur={(e) => {
                        const coords = e.target.value
                          .trim()
                          .split(/\s+/)
                          .map(Number);
                        if (coords.join() === g[k].join()) return;
                        const next = { ...g, [k]: coords };
                        next.offsets = next.v.map((v) =>
                          next.u.map(
                            (u) =>
                              g.offsets[g.v.indexOf(v)]?.[g.u.indexOf(u)] ?? 0,
                          ),
                        );
                        next.measured = next.v.map((v) =>
                          next.u.map(
                            (u) =>
                              g.v.includes(v) &&
                              g.u.includes(u) &&
                              (g.measured?.[g.v.indexOf(v)]?.[g.u.indexOf(u)] ??
                                true),
                          ),
                        );
                        apply({
                          ...survey,
                          surfaces: { ...survey.surfaces, [side]: next },
                        });
                      }}
                    />
                  </label>
                ))}
                <table>
                  <thead>
                    <tr>
                      <th>V / U</th>
                      {g.u.map((u) => (
                        <th key={u}>{u}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.v.map((v, j) => (
                      <tr key={v}>
                        <th>{v}</th>
                        {g.u.map((u, i) => (
                          <td key={u}>
                            {field(
                              `${side} U${u} V${v}`,
                              g.offsets[j][i],
                              (value) =>
                                apply({
                                  ...survey,
                                  surfaces: {
                                    ...survey.surfaces,
                                    [side]: {
                                      ...g,
                                      offsets: g.offsets.map((row, y) =>
                                        row.map((n, x) =>
                                          x === i && y === j ? value : n,
                                        ),
                                      ),
                                      measured: g.offsets.map((row, y) =>
                                        row.map((_, x) =>
                                          x === i && y === j
                                            ? true
                                            : (g.measured?.[y]?.[x] ?? true),
                                        ),
                                      ),
                                    },
                                  },
                                }),
                              g.measured?.[j]?.[i] === false,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => {
                    const surfaces = { ...survey.surfaces };
                    delete surfaces[side];
                    apply({ ...survey, surfaces });
                  }}
                >
                  Убрать сетку
                </button>
              </>
            )}
          </details>
        );
      })}
      {error && <p role="alert">{error}</p>}
      {surveyNotes(room).map((n) => (
        <p key={n}>{n}</p>
      ))}
    </section>
  );
}
