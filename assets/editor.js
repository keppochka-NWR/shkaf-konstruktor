/* Логика редактора: состояние, drag&drop, панель свойств, спецификация. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var svg = $("canvas");

  var project = loadProject() || newProject();
  var sel = { modId: null, itemId: null, face: null };
  var view = { showFacades: false };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function findMod(id) { return project.modules.find(function (m) { return m.id === id; }); }
  function findItem(mod, id) { return mod && mod.items.find(function (i) { return i.id === id; }); }

  /* ---------- главный цикл ---------- */

  function update(skipSave) {
    project.modules.forEach(function (m) { applyDrawerFillers(m); });
    renderProject(svg, project, sel, { showFacades: view.showFacades });
    drawSelectionDims();
    renderProps();
    renderSpec();
    renderStatus();
    $("canvasHint").hidden = project.modules.length > 0;
    if (!skipSave) saveProject(project);
  }

  /* размеры наполнения выбранного модуля */
  function drawSelectionDims() {
    var mod = findMod(sel.modId);
    if (!mod) return;
    var inner = innerBox(project, mod);
    var x = CONST.room.sideGap + moduleX(project, mod);
    var y0 = moduleY(project, mod);
    var roomH = project.room.h;
    var items = mod.items.slice().sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (it) {
      var yAbs = y0 + inner.y0 + it.y;
      var g = el("g", { class: "dim" });
      g.appendChild(el("line", { x1: x - 60, y1: roomH - yAbs, x2: x + 8, y2: roomH - yAbs,
        stroke: "#b07c3f", "stroke-width": 2, "stroke-dasharray": "8 6" }));
      g.appendChild(text(x - 66, roomH - yAbs + 10, String(Math.round(it.y)), 30, "#a8703a", "end"));
      svg.appendChild(g);
    });
  }

  /* ---------- верхняя панель ---------- */

  function bindTop() {
    $("roomW").value = project.room.w;
    $("roomH").value = project.room.h;
    $("depth").value = project.depth;
    $("back").value = project.back;
    $("roomW").addEventListener("change", function () {
      project.room.w = clamp(+this.value, 600, 12000); update();
    });
    $("roomH").addEventListener("change", function () {
      project.room.h = clamp(+this.value, 1800, 4000); update();
    });
    $("depth").addEventListener("change", function () {
      project.depth = clamp(+this.value, CONST.module.minD, CONST.module.maxD); update();
    });
    $("back").addEventListener("change", function () { project.back = this.value; update(); });
    $("showFacades").addEventListener("change", function () {
      view.showFacades = this.checked; update(true);
    });
    $("btnExport").addEventListener("click", exportJSON);
    $("btnImport").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", importJSON);
    $("btnClear").addEventListener("click", function () {
      if (!this.dataset.armed) {
        this.dataset.armed = "1"; this.textContent = "Точно?";
        var b = this;
        setTimeout(function () { delete b.dataset.armed; b.textContent = "Очистить"; }, 3000);
        return;
      }
      delete this.dataset.armed; this.textContent = "Очистить";
      project = newProject(); sel = { modId: null, itemId: null, face: null }; update();
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, isNaN(v) ? lo : v)); }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (project.name || "шкаф") + ".json";
    a.click();
  }

  function importJSON() {
    var f = this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var p = JSON.parse(r.result);
        if (p && p.modules) { project = p; sel = { modId: null, itemId: null, face: null }; update(); }
      } catch (e) { banner("Файл не похож на проект конструктора.", null); }
    };
    r.readAsText(f);
    this.value = "";
  }

  /* ---------- баннер подтверждений ---------- */

  var bannerCb = null;
  function banner(textMsg, onOk, okLabel) {
    var b = $("banner");
    b.innerHTML = "<span>" + esc(textMsg) + "</span>" +
      (onOk ? '<button class="ok" type="button">' + esc(okLabel || "Да") + "</button>" : "") +
      '<button class="no" type="button">' + (onOk ? "Отмена" : "Понятно") + "</button>";
    b.hidden = false;
    bannerCb = onOk || null;
    b.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        b.hidden = true;
        if (btn.className === "ok" && bannerCb) bannerCb();
        bannerCb = null;
      });
    });
    clearTimeout(banner._t);
    banner._t = setTimeout(function () { b.hidden = true; }, 12000);
  }

  /* ---------- палитра ---------- */

  $("addBase").addEventListener("click", function () { addModule("base"); });
  $("addUpper").addEventListener("click", function () { addModule("upper"); });

  function addModule(kind) {
    var m = newModule(kind);
    project.modules.push(m);
    sel = { modId: m.id, itemId: null, face: null };
    update();
  }

  document.querySelectorAll(".pal-item").forEach(function (elp) {
    elp.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", elp.dataset.drag);
      e.dataTransfer.effectAllowed = "copy";
    });
    // клик = добавить в выбранный модуль
    elp.addEventListener("click", function () {
      var mod = findMod(sel.modId);
      if (!mod) { banner("Сначала выберите модуль на холсте.", null); return; }
      tryAddItem(mod, elp.dataset.drag, null);
    });
  });

  /* ---------- координаты svg ---------- */

  function svgPoint(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, yMм: project.room.h - p.y, y: project.room.h - p.y };
  }

  function modAt(pmm) {
    var startX = CONST.room.sideGap;
    for (var i = 0; i < project.modules.length; i++) {
      var m = project.modules[i];
      var x = startX + moduleX(project, m);
      var y0 = moduleY(project, m);
      if (pmm.x >= x && pmm.x <= x + m.w && pmm.y >= y0 && pmm.y <= y0 + m.h) return m;
    }
    return null;
  }

  /* ---------- drop наполнения ---------- */

  svg.addEventListener("dragover", function (e) { e.preventDefault(); });
  svg.addEventListener("drop", function (e) {
    e.preventDefault();
    var type = e.dataTransfer.getData("text/plain");
    if (!type) return;
    var p = svgPoint(e);
    var mod = modAt(p);
    if (!mod) { banner("Бросьте элемент на модуль.", null); return; }
    var inner = innerBox(project, mod);
    var yLocal = Math.round((p.y - moduleY(project, mod) - inner.y0) / 16) * 16;
    tryAddItem(mod, type, clamp(yLocal, 0, Math.max(0, inner.h - 100)));
  });

  function tryAddItem(mod, type, y) {
    var it = newItem(type);
    if (y != null) it.y = y;
    var check = canInsert(project, mod, it);
    if (!check.ok) {
      if (check.suggestW) {
        banner(check.reason + " Расширить модуль до " + Math.ceil(check.suggestW) + " мм?",
          function () {
            mod.w = Math.ceil(check.suggestW);
            mod.items.push(it);
            sel = { modId: mod.id, itemId: it.id, face: null };
            update();
          }, "Расширить");
      } else banner(check.reason, null);
      return;
    }
    if (check.note && check.fillerAdd) {
      banner(check.note + " Добавить фальш?", function () {
        mod.fillers.right += check.fillerAdd;
        mod.items.push(it);
        sel = { modId: mod.id, itemId: it.id, face: null };
        update();
      }, "Добавить");
      return;
    }
    mod.items.push(it);
    sel = { modId: mod.id, itemId: it.id, face: null };
    update();
  }

  /* ---------- выбор и перетаскивание на холсте ---------- */

  var drag = null; // { mode: "item"|"module", modId, itemId, startY, origY, startX, origIndex }

  svg.addEventListener("pointerdown", function (e) {
    var t = e.target.closest ? e.target.closest("[data-item],[data-face],[data-mod]") : null;
    if (!t) { sel = { modId: null, itemId: null, face: null }; update(true); return; }
    var modId = t.getAttribute("data-mod");
    if (t.hasAttribute("data-item")) {
      sel = { modId: modId, itemId: t.getAttribute("data-item"), face: null };
      var mod = findMod(modId);
      var it = findItem(mod, sel.itemId);
      var p = svgPoint(e);
      drag = { mode: "item", modId: modId, itemId: sel.itemId, startY: p.y, origY: it.y };
      svg.setPointerCapture(e.pointerId);
    } else if (t.hasAttribute("data-face")) {
      sel = { modId: modId, itemId: null, face: +t.getAttribute("data-face") };
    } else {
      sel = { modId: modId, itemId: null, face: null };
      var p2 = svgPoint(e);
      drag = { mode: "module", modId: modId, startX: p2.x, moved: false };
      svg.setPointerCapture(e.pointerId);
    }
    update(true);
  });

  svg.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var p = svgPoint(e);
    if (drag.mode === "item") {
      var mod = findMod(drag.modId);
      var it = findItem(mod, drag.itemId);
      if (!it) return;
      var inner = innerBox(project, mod);
      var ny = drag.origY + (p.y - drag.startY);
      it.y = clamp(Math.round(ny / 16) * 16, 0, Math.max(0, inner.h - 32));
      renderProject(svg, project, sel, { showFacades: view.showFacades });
      drawSelectionDims();
    }
    if (drag.mode === "module") {
      var mod2 = findMod(drag.modId);
      var dx = p.x - drag.startX;
      if (Math.abs(dx) > mod2.w * 0.6) {
        // перестановка в ряду
        var row = project.modules.filter(function (m) { return m.kind === mod2.kind; });
        var idx = row.indexOf(mod2);
        var swap = dx > 0 ? row[idx + 1] : row[idx - 1];
        if (swap) {
          var ai = project.modules.indexOf(mod2);
          var bi = project.modules.indexOf(swap);
          project.modules[ai] = swap;
          project.modules[bi] = mod2;
          drag.startX = p.x;
          drag.moved = true;
          renderProject(svg, project, sel, { showFacades: view.showFacades });
        }
      }
    }
  });

  svg.addEventListener("pointerup", function () {
    if (drag) { update(); drag = null; }
  });

  /* ---------- панель свойств ---------- */

  function segRow(label, current, options, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "p-row";
    wrap.innerHTML = "<label>" + esc(label) + "</label>";
    var seg = document.createElement("div");
    seg.className = "seg";
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.setAttribute("aria-pressed", String(o.value === current));
      b.addEventListener("click", function () { onPick(o.value); });
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
    return wrap;
  }

  function numRow(label, value, min, max, step, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "p-row";
    wrap.innerHTML = "<label>" + esc(label) + "</label>";
    var inp = document.createElement("input");
    inp.type = "number"; inp.value = value; inp.min = min; inp.max = max; inp.step = step || 1;
    inp.addEventListener("change", function () { onChange(clamp(+inp.value, min, max)); });
    wrap.appendChild(inp);
    return wrap;
  }

  function selectRow(label, current, options, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "p-row";
    wrap.innerHTML = "<label>" + esc(label) + "</label>";
    var s = document.createElement("select");
    options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.value; op.textContent = o.label;
      if (o.value === current) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener("change", function () { onChange(s.value); });
    wrap.appendChild(s);
    return wrap;
  }

  function decorRow(label, current, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "p-group";
    wrap.innerHTML = "<h3>" + esc(label) + " · " + esc(current) + "</h3>";
    var grid = document.createElement("div");
    grid.className = "decor-pick";
    var popular = ["Белый", "Белоснежный", "Тэффи", "Графит", "Клауд", "Дуб Вотан",
                   "Дуб Сонома", "Медея", "Орегано", "Дуб Галиано", "Терра", "Фантом"];
    var shown = LAMARTY.filter(function (d) { return popular.indexOf(d.n) >= 0; });
    if (decorRow._all) shown = LAMARTY;
    shown.forEach(function (d) { grid.appendChild(swatch(d, current, onChange)); });
    var more = document.createElement("button");
    more.type = "button";
    more.className = "decor-more";
    more.textContent = decorRow._all ? "Свернуть каталог" : "Весь каталог Lamarty (133)";
    more.addEventListener("click", function () { decorRow._all = !decorRow._all; renderProps(); });
    grid.appendChild(more);
    wrap.appendChild(grid);
    return wrap;
  }

  function swatch(d, current, onChange) {
    var s = document.createElement("div");
    s.className = "decor-sw" + (d.n === current ? " on" : "");
    s.title = d.n + " · " + d.cat;
    if (d.tex) s.style.backgroundImage = "url('" + encodeURI(d.tex) + "')";
    else s.style.background = "#e8e2d6";
    s.addEventListener("click", function () { onChange(d.n); });
    return s;
  }

  function renderProps() {
    var box = $("tabProps");
    box.innerHTML = "";
    var mod = findMod(sel.modId);

    if (!mod) {
      // свойства проекта
      var g = document.createElement("div");
      g.className = "p-group";
      g.innerHTML = "<h3>Проект</h3>";
      g.appendChild(numRow("Высота верхнего ряда от пола", project.upperY, 1000, 3000, 10,
        function (v) { project.upperY = v; update(); }));
      box.appendChild(g);
      box.appendChild(decorRow("Декор корпуса", project.bodyDecor, function (n) {
        project.bodyDecor = n; update();
      }));
      box.appendChild(decorRow("Декор фасадов (общий)", project.facadeDecor, function (n) {
        project.facadeDecor = n; update();
      }));
      var e = document.createElement("div");
      e.className = "p-empty";
      e.textContent = "Выберите модуль на холсте, чтобы настроить его размеры, наполнение и фасады.";
      box.appendChild(e);
      return;
    }

    var item = findItem(mod, sel.itemId);

    // предупреждения
    moduleWarnings(project, mod).forEach(function (w) {
      var d = document.createElement("div");
      d.className = "p-warn";
      d.textContent = w;
      box.appendChild(d);
    });

    if (item) {
      var gi = document.createElement("div");
      gi.className = "p-group";
      gi.innerHTML = "<h3>" + esc(itemLabel(item.type)) + "</h3>";
      gi.appendChild(numRow("Высота от дна секции, мм", item.y, 0,
        Math.round(innerBox(project, mod).h), 16, function (v) { item.y = v; update(); }));
      if (item.type === "drawer") {
        gi.appendChild(selectRow("Направляющие", item.slide,
          Object.keys(SLIDES).map(function (k) { return { value: k, label: SLIDES[k].label }; }),
          function (v) {
            item.slide = v;
            var chk = canInsert(project, mod, item);
            if (!chk.ok && chk.suggestW) {
              banner(chk.reason + " Расширить модуль до " + Math.ceil(chk.suggestW) + " мм?",
                function () { mod.w = Math.ceil(chk.suggestW); update(); }, "Расширить");
            }
            update();
          }));
        gi.appendChild(numRow("Высота ящика, мм", item.boxH, CONST.drawer.minBoxH,
          CONST.drawer.maxBoxH, 1, function (v) { item.boxH = v; update(); }));
        var note = document.createElement("p");
        note.className = "p-note";
        note.textContent = SLIDES[item.slide].note + ". Корпус ящика уже секции на " +
          (2 * SLIDES[item.slide].sideDeduct) + " мм.";
        gi.appendChild(note);
      }
      if (item.type === "mesh") {
        gi.appendChild(selectRow("Элемент", item.meshId,
          meshCatalog().map(function (m) { return { value: m.id, label: m.label }; }),
          function (v) {
            item.meshId = v;
            var chk = canInsert(project, mod, item);
            if (!chk.ok && chk.suggestW) {
              banner(chk.reason + " Расширить модуль до " + Math.ceil(chk.suggestW) + " мм?",
                function () { mod.w = Math.ceil(chk.suggestW); update(); }, "Расширить");
            }
            update();
          }));
      }
      var del = document.createElement("button");
      del.className = "p-del"; del.type = "button";
      del.textContent = "Убрать " + itemLabel(item.type).toLowerCase();
      del.addEventListener("click", function () {
        mod.items = mod.items.filter(function (i) { return i.id !== item.id; });
        sel.itemId = null;
        update();
      });
      gi.appendChild(del);
      box.appendChild(gi);
    }

    // модуль
    var gm = document.createElement("div");
    gm.className = "p-group";
    gm.innerHTML = "<h3>" + (mod.kind === "base" ? "Нижний модуль" : "Верхний модуль") + "</h3>";
    gm.appendChild(numRow("Ширина, мм", mod.w, CONST.module.minW, CONST.module.maxW, 10,
      function (v) { mod.w = v; update(); }));
    gm.appendChild(numRow("Высота, мм", mod.h, CONST.module.minH, CONST.module.maxH, 10,
      function (v) { mod.h = v; update(); }));
    var fl = mod.fillers.left + mod.fillers.right;
    if (fl) {
      var fn = document.createElement("p");
      fn.className = "p-note";
      fn.textContent = "Фальши: " + (mod.fillers.left || 0) + " слева, " +
        (mod.fillers.right || 0) + " справа (авто по правилам).";
      gm.appendChild(fn);
    }
    box.appendChild(gm);

    // фасады
    var gf = document.createElement("div");
    gf.className = "p-group";
    gf.innerHTML = "<h3>Фасады</h3>";
    gf.appendChild(segRow("Система", mod.facade.system, [
      { value: "none", label: "нет" },
      { value: "hinge", label: "распашные" },
      { value: "coupe", label: "купе (скоро)" },
    ], function (v) {
      if (v === "coupe") { banner("Редактор купе - следующий этап, двери посчитаем из калькулятора купе.", null); return; }
      mod.facade.system = v; update();
    }));
    if (mod.facade.system === "hinge") {
      gf.appendChild(segRow("Двери", mod.facade.doors, [
        { value: 1, label: "одна" }, { value: 2, label: "две" },
      ], function (v) { mod.facade.doors = v; update(); }));
      if (mod.facade.doors === 1) {
        gf.appendChild(segRow("Петли со стороны", mod.facade.side, [
          { value: "left", label: "слева" }, { value: "right", label: "справа" },
        ], function (v) { mod.facade.side = v; update(); }));
      }
      gf.appendChild(segRow("Открывание", mod.facade.opening, [
        { value: "handle", label: "ручка" }, { value: "push", label: "push" },
      ], function (v) { mod.facade.opening = v; update(); }));
      if (mod.facade.opening === "handle") {
        gf.appendChild(selectRow("Ручка", mod.facade.handleId || "",
          [{ value: "", label: "выберите..." }].concat(
            handlesCatalog().map(function (h) { return { value: h.id, label: h.label }; })),
          function (v) { mod.facade.handleId = v || null; update(); }));
      }
      var hint = document.createElement("p");
      hint.className = "p-note";
      var faces = facadeSizes(project, mod);
      if (faces.length) {
        var hg = hingesFor(faces[0].h);
        hint.textContent = "Фасад " + Math.round(faces[0].w) + "×" + Math.round(faces[0].h) +
          ", петель на дверь: " + hg.n + " (" +
          (mod.facade.opening === "push" ? HINGES.gtv_free.label : HINGES.gtv_soft.label) + ").";
      }
      gf.appendChild(hint);
      box.appendChild(gf);
      box.appendChild(decorRow("Декор фасадов модуля", facadeDecorOf(project, mod), function (n) {
        mod.facade.decor = n; update();
      }));
    } else {
      box.appendChild(gf);
    }

    var delM = document.createElement("button");
    delM.className = "p-del"; delM.type = "button";
    delM.textContent = "Удалить модуль";
    delM.addEventListener("click", function () {
      project.modules = project.modules.filter(function (m) { return m.id !== mod.id; });
      sel = { modId: null, itemId: null, face: null };
      update();
    });
    box.appendChild(delM);
  }

  function itemLabel(type) {
    return { shelf_adj: "Полка съёмная", shelf_fixed: "Полка жёсткая", rod: "Штанга",
             drawer: "Ящик выкатной", mesh: "Сетчатый элемент" }[type] || type;
  }

  /* ---------- спецификация ---------- */

  function renderSpec() {
    var box = $("tabSpec");
    var s = specification(project);
    if (!s.panels.length) {
      box.innerHTML = '<div class="p-empty">Добавьте модули, и спецификация соберётся сама.</div>';
      return;
    }
    var html = '<table class="spec-table"><thead><tr><th>Деталь</th><th>Размер</th><th>шт</th><th>Кромка</th></tr></thead><tbody>';
    var lastMod = "";
    s.panels.forEach(function (p) {
      if (p.mod !== lastMod) {
        html += '<tr><td colspan="4" style="font-weight:700;padding-top:10px">' + esc(p.mod) + "</td></tr>";
        lastMod = p.mod;
      }
      html += "<tr><td>" + esc(p.part) + (p.material ? " <span style='color:var(--muted)'>(" + esc(p.material) + ")</span>" : "") +
        "</td><td>" + p.w + "×" + p.h + "</td><td>" + p.qty + "</td><td>" + esc(p.edge) + "</td></tr>";
    });
    html += "</tbody></table>";

    html += '<table class="spec-table"><thead><tr><th>Фурнитура</th><th>шт</th><th>₽ закуп</th></tr></thead><tbody>';
    s.hardware.forEach(function (h) {
      html += "<tr><td>" + esc(h.name) + "</td><td>" + h.qty + "</td><td>" +
        (h.price != null ? (h.price * h.qty).toLocaleString("ru-RU") : "уточнить") + "</td></tr>";
    });
    html += "</tbody></table>";

    html += '<div class="spec-total">ЛДСП: ' + s.ldspArea.toFixed(2) + " м² · Фурнитура: ~" +
      s.hwCost.toLocaleString("ru-RU") + " ₽ закуп</div>";
    html += '<p class="spec-note">Цены фурнитуры закупочные, из справочника цеха. Расчёт листов, кромки и итоговой цены (закупка × наценка) - следующий этап. Карты раскроя строятся из этой же таблицы.</p>';
    box.innerHTML = html;
  }

  function renderStatus() {
    var warns = projectWarnings(project);
    var mods = project.modules.length;
    var s = specification(project);
    $("statusbar").innerHTML =
      "<span>Модулей: " + mods + "</span>" +
      "<span>Деталей: " + s.panels.reduce(function (a, p) { return a + p.qty; }, 0) + "</span>" +
      "<span>ЛДСП: " + s.ldspArea.toFixed(2) + " м²</span>" +
      warns.map(function (w) { return '<span class="warn">' + esc(w) + "</span>"; }).join("");
  }

  /* ---------- вкладки ---------- */

  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === t));
      });
      $("tabProps").hidden = t.dataset.tab !== "props";
      $("tabSpec").hidden = t.dataset.tab !== "spec";
    });
  });

  /* ---------- старт ---------- */

  bindTop();
  update(true);
})();
