import { useState } from "react";
import { type Project } from "./project";
import {
  nest,
  details,
  detailCSV,
  nestingHTML,
  quoteHTML,
  saveFile,
  sheetSVG,
} from "./exports";
export function OutputPanel({
  project,
  capture,
  update,
}: {
  project: Project;
  capture: () => string | undefined;
  update: (p: Project) => boolean;
}) {
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"sheets" | "quote">("sheets");
  const sheets = nest(project),
    all = details(project);
  const q = project.offer || { customer: "", price: "", notes: "" };
  return (
    <div className="output-panel">
      <div className="output-tabs">
        <button
          aria-pressed={tab === "sheets"}
          onClick={() => setTab("sheets")}
        >
          Карты листов и деталировка
        </button>
        <button aria-pressed={tab === "quote"} onClick={() => setTab("quote")}>
          Коммерческое предложение
        </button>
      </div>
      {tab === "sheets" ? (
        <>
          <div className="output-actions">
            <button
              className="primary"
              onClick={() =>
                saveFile("Карты листов.html", nestingHTML(project))
              }
            >
              Скачать карты / PDF
            </button>
            <button
              className="outline"
              onClick={() =>
                saveFile(
                  "Деталировка.csv",
                  detailCSV(project),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Деталировка CSV
            </button>
          </div>
          <p>
            {all.length} деталей · {sheets.length} листов · Lamarty{" "}
            <b>2750 × 1830 мм</b>
          </p>
          <p className="field-note">
            Для проверки технологом. Обрезка по краю 10 мм, промежуток 10 мм.
            Текстура вдоль длинной стороны. Укладка предварительная: не
            гарантирует минимального числа листов и не учитывает припуски
            станка.
          </p>
          {sheetIndex !== null && (
            <button className="text-action" onClick={() => setSheetIndex(null)}>
              ← Все листы
            </button>
          )}
          <div
            className={"sheets-grid" + (sheetIndex !== null ? " enlarged" : "")}
          >
            {sheets.map((s, i) =>
              sheetIndex !== null && sheetIndex !== i ? null : (
                <section key={i}>
                  <h3>
                    Лист {i + 1} · {s.decor}
                  </h3>
                  <small>
                    {s.height} × {s.width} × {s.thickness} мм
                  </small>
                  <button
                    className="sheet-preview"
                    aria-label={"Увеличить лист " + (i + 1)}
                    onClick={() =>
                      setSheetIndex(sheetIndex === null ? i : null)
                    }
                  >
                    <span dangerouslySetInnerHTML={{ __html: sheetSVG(s) }} />
                  </button>
                  <p>
                    {s.items.length} деталей · заполнение{" "}
                    {Math.round(
                      (s.items.reduce((n, p) => n + p.w * p.h, 0) /
                        (s.width * s.height)) *
                        100,
                    )}
                    %
                  </p>
                  {sheetIndex !== null && (
                    <table>
                      <thead>
                        <tr>
                          <th>Код</th>
                          <th>Деталь</th>
                          <th>Размер</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.items.map((a) => (
                          <tr key={a.detail.code}>
                            <td>{a.detail.code}</td>
                            <td>
                              {a.detail.moduleName} / {a.detail.name}
                            </td>
                            <td>
                              {a.h} × {a.w}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              ),
            )}
          </div>
        </>
      ) : (
        <>
          <p className="field-note">
            КП содержит текущий вид проекта, размеры, материалы и наполнение
            всех модулей. Цена пока вводится вручную; без неё выводится «после
            согласования».
          </p>
          <label className="hardware-field">
            Клиент / название предложения
            <input
              aria-label="Клиент для КП"
              value={q.customer}
              maxLength={120}
              onChange={(e) =>
                update({
                  ...project,
                  offer: { ...q, customer: e.target.value },
                })
              }
            />
          </label>
          <label className="hardware-field">
            Итоговая стоимость, ₽
            <input
              aria-label="Стоимость КП"
              type="number"
              min="0"
              value={q.price}
              onChange={(e) =>
                update({ ...project, offer: { ...q, price: e.target.value } })
              }
            />
          </label>
          <label className="hardware-field">
            Условия и примечания
            <textarea
              aria-label="Условия КП"
              maxLength={2000}
              rows={4}
              value={q.notes}
              onChange={(e) =>
                update({ ...project, offer: { ...q, notes: e.target.value } })
              }
            />
          </label>
          <button
            className="primary"
            onClick={() =>
              saveFile(
                "Коммерческое предложение.html",
                quoteHTML(project, q.customer, q.price, q.notes, capture()),
              )
            }
          >
            Скачать КП / PDF
          </button>
          <p className="field-note">
            Откройте скачанный документ и нажмите «Печать / Сохранить PDF».
          </p>
        </>
      )}
    </div>
  );
}
