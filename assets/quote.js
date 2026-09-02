/* Коммерческое предложение: печатная страница в новом окне (печать = PDF). */

function openQuote(project, svgEl) {
  const pr = priceProject(project);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const modulesRows = project.modules.map((m, i) => {
    const inner = innerBox(project, m);
    const items = m.items.map(it => {
      if (it.type === "drawers") return it.count + " ящ. (" + SLIDES[it.slide].label + ")";
      if (it.type === "mesh") {
        const mesh = meshCatalog().find(x => x.id === it.meshId);
        return mesh ? mesh.label : "сетка";
      }
      return { shelf_adj: "полка съёмн.", shelf_fixed: "полка жёстк.", rod: "штанга" }[it.type] || it.type;
    }).join(", ") || "пусто";
    const fac = m.facade.system === "hinge"
      ? (m.facade.doors + " дв., " + (m.facade.opening === "push" ? "push" : "ручка"))
      : "без фасада";
    return "<tr><td>" + (m.kind === "base" ? "Нижний " : "Верхний ") + (i + 1) + "</td>" +
      "<td>" + m.w + " × " + m.h + " × " + modDepth(project, m) + "</td>" +
      "<td>" + esc(items) + "</td><td>" + esc(fac) + "</td></tr>";
  }).join("");

  const hwRows = pr.spec.hardware.map(h =>
    "<tr><td>" + esc(h.name) + "</td><td>" + h.qty + "</td></tr>").join("");

  const svgClone = svgEl ? svgEl.outerHTML.replace(/cursor:\s*pointer/g, "") : "";
  const today = new Date().toLocaleDateString("ru-RU");

  const html = "<!DOCTYPE html><html lang='ru'><head><meta charset='utf-8'>" +
    "<title>КП · " + esc(project.name) + "</title><style>" +
    "body{font-family:'Segoe UI',system-ui,sans-serif;color:#221f1a;margin:34px;font-size:14px;line-height:1.5}" +
    "h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 10px}" +
    ".muted{color:#6d675c}.head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #235b4e;padding-bottom:12px}" +
    "table{width:100%;border-collapse:collapse;font-size:13px}" +
    "th{background:#e4eeea;color:#235b4e;text-align:left;padding:7px 9px}" +
    "td{padding:6px 9px;border-bottom:1px solid #e3dcd0}" +
    ".price{font-size:30px;font-weight:700;color:#235b4e}" +
    ".sketch{margin:18px 0;border:1px solid #ddd6c8;border-radius:10px;overflow:hidden}" +
    ".sketch svg{width:100%;height:auto;max-height:430px}" +
    ".foot{margin-top:30px;font-size:12px;color:#6d675c;border-top:1px solid #ddd6c8;padding-top:10px}" +
    "@media print{.noprint{display:none}}" +
    "</style></head><body>" +
    "<div class='head'><div><h1>Коммерческое предложение</h1>" +
    "<div class='muted'>" + esc(project.name) + " · " + today + "</div></div>" +
    "<div class='price'>" + fmtRub(pr.retail) + "</div></div>" +
    "<div class='sketch'>" + svgClone + "</div>" +
    "<h2>Состав</h2><table><tr><th>Модуль</th><th>Габариты, мм</th><th>Наполнение</th><th>Фасад</th></tr>" +
    modulesRows + "</table>" +
    "<h2>Материалы и фурнитура</h2>" +
    "<table><tr><th>Позиция</th><th>Кол-во</th></tr>" +
    "<tr><td>ЛДСП 16 мм (" + esc(project.bodyDecor) + ")</td><td>" + pr.sheetsCount + " лист.</td></tr>" +
    "<tr><td>Кромка 2 мм / 0,4 мм</td><td>" + pr.edge.face.toFixed(1) + " / " + pr.edge.tech.toFixed(1) + " пог.м</td></tr>" +
    hwRows + "</table>" +
    "<h2>Итого</h2>" +
    "<table><tr><td>Стоимость изделия под ключ</td><td style='text-align:right;font-weight:700'>" + fmtRub(pr.retail) + "</td></tr>" +
    "<tr><td class='muted'>Срок изготовления</td><td style='text-align:right'>от 20 рабочих дней</td></tr></table>" +
    "<p class='foot'>Предложение действительно 14 дней. Точные размеры уточняются замером. " +
    "Доставка и монтаж включены в стоимость по Нижнему Новгороду.</p>" +
    "<p class='noprint'><button onclick='print()' style='font-size:15px;padding:10px 22px;cursor:pointer'>Печать / сохранить в PDF</button></p>" +
    "</body></html>";

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
