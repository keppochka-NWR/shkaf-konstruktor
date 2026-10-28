import { parts } from "./model";
import { localToRoom } from "./project";
import { estimate } from "./pricing";
import { roomWarnings } from "./roomWarnings";
import type { RoomDocument } from "./roomDocument";
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function roomSummary(d: RoomDocument) {
  return d.rooms.map((r) => ({
    id: r.id,
    title: r.title,
    modules: r.project.modules.length,
    price: r.project.modules.length ? estimate(r.project).retail : 0,
    warnings: r.project.modules.length
      ? roomWarnings(r.project).map((w) => w.message)
      : [],
    variants: r.variants?.length ?? 0,
  }));
}
export function handoffHTML(d: RoomDocument) {
  const summary = roomSummary(d);
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Ё Конструктор — передача технологу</title><style>body{font:15px system-ui;max-width:1000px;margin:32px auto;color:#223}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}section{break-inside:avoid}small{color:#567}@media print{body{margin:0}}</style><h1>Заказ ${escape(d.customer ?? "без имени")}</h1><p>Версия документа ${d.revision}. Размеры в мм. Геометрия и замечания требуют проверки технологом.</p>${d.rooms
    .map(
      (r, i) =>
        `<section><h2>${escape(r.title)}</h2><p>${r.project.room.width} × ${r.project.room.depth} × ${r.project.room.height} мм. Цена: ${summary[i].price === null ? "есть неоценённые позиции" : summary[i].price + " ₽"}</p><svg viewBox="-100 -100 ${r.project.room.width + 200} ${r.project.room.depth + 200}" width="500" height="320"><rect x="0" y="0" width="${r.project.room.width}" height="${r.project.room.depth}" fill="#f0f5f3" stroke="#456"/>${r.project.modules
          .map(
            (a) =>
              `<polygon points="${[
                [0, 0],
                [a.module.width, 0],
                [a.module.width, a.module.depth],
                [0, a.module.depth],
              ]
                .map(([u, v]) => {
                  const p = localToRoom(a, u, v);
                  return p.x + "," + p.z;
                })
                .join(
                  " ",
                )}" fill="#cadbd3" stroke="#345"><title>${escape(a.module.name)}</title></polygon>`,
          )
          .join(
            "",
          )}</svg><h3>Детали</h3><table><tr><th>Корпус / деталь</th><th>Размер</th><th>Материал</th></tr>${r.project.modules
          .flatMap((a) =>
            parts(a.module)
              .filter((p) => ["board", "hdf", "glass"].includes(p.material))
              .map(
                (p) =>
                  `<tr><td>${escape(a.module.name)} / ${escape(p.name)}</td><td>${p.length} × ${p.width} × ${p.thickness}</td><td>${escape(p.decor)}</td></tr>`,
              ),
          )
          .join(
            "",
          )}</table><h3>Замер</h3><pre>${escape(JSON.stringify(r.project.room.survey ?? r.project.measurement ?? { статус: "Нет измерений по точкам" }, null, 2))}</pre><h3>Замечания</h3><ul>${summary[i].warnings.map((w) => `<li>${escape(w)}</li>`).join("") || "<li>Замечаний выполненных проверок нет; это не заключение о производственной готовности.</li>"}</ul><h3>Варианты</h3><ul>${(r.variants ?? []).map((v) => `<li>${escape(v.title)} — ${v.approvedAt ? "согласован " + escape(v.approvedAt) : "эскиз"}</li>`).join("")}</ul></section>`,
    )
    .join(
      "",
    )}<p>Приложите JSON документа с исходными данными. Схемы комнаты здесь прямоугольные; измеренные отклонения приведены в замере.</p></html>`;
}
export function bazisExport(d: RoomDocument) {
  const panels: {
      name: string;
      material: string;
      thickness: number;
      axis: number;
      box: number[];
      edges: number[];
    }[] = [],
    unsupported: string[] = [];
  for (const r of d.rooms)
    for (const a of r.project.modules)
      for (const p of parts(a.module)) {
        if (!["board", "hdf", "glass"].includes(p.material)) continue;
        if (
          (a.rotation ?? 0) % 90 !== 0 ||
          p.rotY ||
          p.rotZ ||
          p.planContour ||
          p.faceContour ||
          p.taper ||
          p.shape ||
          p.golaCuts ||
          p.rearNotch ||
          p.topNotches ||
          p.external
        ) {
          unsupported.push(`${r.title}/${a.module.name}/${p.name}`);
          continue;
        }
        const [x, y, z] = p.position,
          [w, h, depth] = p.size,
          points = [
            [x - w / 2, z - depth / 2],
            [x + w / 2, z - depth / 2],
            [x + w / 2, z + depth / 2],
            [x - w / 2, z + depth / 2],
          ].map(([u, v]) => localToRoom(a, u, v));
        const origin = r.origin ?? { x: 0, z: 0 },
          box = [
            Math.min(...points.map((p) => p.x)) + origin.x,
            (a.y ?? 0) + y - h / 2,
            Math.min(...points.map((p) => p.z)) + origin.z,
            Math.max(...points.map((p) => p.x)) + origin.x,
            (a.y ?? 0) + y + h / 2,
            Math.max(...points.map((p) => p.z)) + origin.z,
          ];
        const ext = [box[3] - box[0], box[4] - box[1], box[5] - box[2]],
          axis = ext.indexOf(Math.min(...ext));
        panels.push({
          name: `${r.title} / ${a.module.name} / ${p.name}`,
          material: p.decor,
          thickness: p.thickness,
          axis,
          box,
          edges: p.edge,
        });
      }
  const materials = [
    ...new Map(
      panels.map((p) => [p.material + " / " + p.thickness, p]),
    ).values(),
  ];
  const script = `// Ё Конструктор. Выполнять в НОВОМ пустом документе Базиса. Сохраните результат как .b3d вручную.\n// Кромка и присадка не назначаются. Исходный документ приложен к manifest.json; сложные детали требуют ручной обработки.\nvar data=${JSON.stringify(panels)};\nvar keys=${JSON.stringify(materials.map((p) => p.material + " / " + p.thickness))};\nvar mats=[];\nfor(var i=0;i<keys.length;i++) mats.push(Action.Properties.NewMaterial(keys[i]));\nAction.Properties.NewButton('Построить панели').OnClick=function(){\nfor(var i=0;i<data.length;i++){var d=data[i],k=keys.indexOf(d.material+' / '+d.thickness);mats[k].SetActive();if(Math.abs(ActiveMaterial.Thickness-d.thickness)>0.01)throw Error('Толщина материала не совпадает: '+keys[k]);}\nfor(var i=0;i<data.length;i++){var d=data[i],b=d.box;mats[keys.indexOf(d.material+' / '+d.thickness)].SetActive();var p=d.axis===1?AddHorizPanel(b[0],b[2],b[3],b[5],b[1]):d.axis===0?AddVertPanel(b[2],b[1],b[5],b[4],b[0]):AddFrontPanel(b[0],b[1],b[3],b[4],b[2]);p.Name=d.name;p.Build();}\nAction.Finish();};\nAction.Continue();`;
  return {
    script,
    manifest: {
      format: "garderyob-bazis-pilot",
      sourceDocument: structuredClone(d),
      revision: d.revision,
      panels,
      unsupported,
      completeGeometry: unsupported.length === 0,
      limitations: [
        "Кромки по рёбрам и присадка не назначаются скриптом",
        "Проверить материал и толщину перед построением",
        "Выполнение в установленном Базисе требует проверки",
      ],
    },
  };
}
