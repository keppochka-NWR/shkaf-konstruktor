/* Логика редактора v2: виды, кликабельные размеры, секции ящиков, смета, раскрой. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var svg = $("canvas");

  var project = loadProject() || newProject();
  var sel = { modId: null, itemId: null, face: null };
  var view = { showFacades: false, mode: "front" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, isNaN(v) ? lo : v)); }
  function findMod(id) { return project.modules.find(function (m) { return m.id === id; }); }
  function findItem(mod, id) { return mod && mod.items.find(function (i) { return i.id === id; }); }

  /* ---------- undo ---------- */

  var undoStack = [];
  function pushUndo() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 60) undoStack.shift();
  }
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (undoStack.length > 1) {
        undoStack.pop();
        project = migrateProject(JSON.parse(undoStack[undoStack.length - 1]));
        sel = { modId: null, itemId: null, face: null };
        syncTop();
        update(true);
        saveProject(project);
      }
    }
    if (e.key === "Delete" && sel.modId) {
      var mod = findMod(sel.modId);
      if (!mod) return;
      if (sel.itemId) {
        mod.items = mod.items.filter(function (i) { return i.id !== sel.itemId; });
        sel.itemId = null;
      } else {
        project.modules = project.modules.filter(function (m) { return m.id !== mod.id; });
        sel = { modId: null, itemId: null, face: null };
      }
      update();
    }
  });

  /* ---------- зум и пан ---------- */

  var vbOverride = null;   // сохранённый viewBox после зума/пана
  var lastAutoVB = null;

  function applyViewBox() {
    lastAutoVB = svg.getAttribute("viewBox");
    if (vbOverride) svg.setAttribute("viewBox", vbOverride.join(" "));
  }

  svg.addEventListener("wheel", function (e) {
    e.preventDefault();
    var vb = (svg.getAttribute("viewBox") || "0 0 100 100").split(" ").map(Number);
    var rect = svg.getBoundingClientRect();
    var mx = vb[0] + (e.clientX - rect.left) / rect.width * vb[2];
    var my = vb[1] + (e.clientY - rect.top) / rect.height * vb[3];
    var k = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    var nw = clamp(vb[2] * k, 400, 30000);
    var nh = vb[3] * (nw / vb[2]);
    vbOverride = [mx - (mx - vb[0]) * (nw / vb[2]), my - (my - vb[1]) * (nh / vb[3]), nw, nh];
    svg.setAttribute("viewBox", vbOverride.join(" "));
  }, { passive: false });

  svg.addEventListener("dblclick", function () {
    vbOverride = null;
    update(true);
  });

  var pan = null;
  svg.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // клики по размерам: гасим фокус-поведение mousedown, иначе поле ввода закрывается
  svg.addEventListener("mousedown", function (e) {
    if (e.target.closest && e.target.closest("[data-dim]")) e.preventDefault();
  });
  svg.addEventListener("pointerdown", function (e) {
    if (e.button === 1 || e.button === 2) {
      var vb = (svg.getAttribute("viewBox") || "").split(" ").map(Number);
      pan = { x: e.clientX, y: e.clientY, vb: vb };
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
  });
  svg.addEventListener("pointermove", function (e) {
    if (!pan) return;
    var rect = svg.getBoundingClientRect();
    var dx = (e.clientX - pan.x) / rect.width * pan.vb[2];
    var dy = (e.clientY - pan.y) / rect.height * pan.vb[3];
    vbOverride = [pan.vb[0] - dx, pan.vb[1] - dy, pan.vb[2], pan.vb[3]];
    svg.setAttribute("viewBox", vbOverride.join(" "));
  });
  svg.addEventListener("pointerup", function () { pan = null; });

  /* ---------- главный цикл ---------- */

  function update(skipSave) {
    renderProject(svg, project, sel, { showFacades: view.showFacades, view: view.mode });
    applyViewBox();
    renderProps();
    renderSpec();
    renderCut();
    renderStatus();
    $("canvasHint").hidden = project.modules.length > 0;
    if (!skipSave) { saveProject(project); pushUndo(); }
  }

  /* ---------- верхняя панель ---------- */

  function syncTop() {
    $("roomW").value = project.room.w;
    $("roomH").value = project.room.h;
    $("depth").value = project.depth;
    $("plinthH").value = project.plinthH;
    $("back").value = project.back;
  }

  function bindTop() {
    syncTop();
    $("roomW").addEventListener("change", function () { project.room.w = clamp(+this.value, 600, 12000); update(); });
    $("roomH").addEventListener("change", function () { project.room.h = clamp(+this.value, 1800, 4000); update(); });
    $("depth").addEventListener("change", function () { project.depth = clamp(+this.value, CONST.module.minD, CONST.module.maxD); update(); });
    $("plinthH").addEventListener("change", function () { project.plinthH = clamp(+this.value, 60, 150); update(); });
    $("back").addEventListener("change", function () { project.back = this.value; update(); });
    $("showFacades").addEventListener("change", function () { view.showFacades = this.checked; update(true); });

    $("viewSwitch").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      view.mode = b.dataset.view;
      this.querySelectorAll("button").forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
      update(true);
    });

    $("btnQuote").addEventListener("click", function () {
      if (!project.modules.length) { banner("Сначала соберите шкаф.", null); return; }
      var was = view.mode;
      if (was !== "front") { view.mode = "front"; update(true); }
      var how = openQuote(project, svg);
      if (was !== "front") { view.mode = was; update(true); }
      if (how === "download") banner("КП скачано файлом: откройте его и нажмите «Печать».", null);
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
      project = newProject(); sel = { modId: null, itemId: null, face: null };
      syncTop(); update();
    });
  }

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
        var p = migrateProject(JSON.parse(r.result));
        if (p && p.modules) {
          project = p; sel = { modId: null, itemId: null, face: null };
          syncTop(); update();
        }
      } catch (e) { banner("Файл не похож на проект конструктора.", null); }
    };
    r.readAsText(f);
    this.value = "";
  }

  /* ---------- баннер ---------- */

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
    if (view.mode !== "front") { view.mode = "front"; syncViewSwitch(); }
    update();
  }

  function syncViewSwitch() {
    document.querySelectorAll("#viewSwitch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.view === view.mode));
    });
  }

  /* шаблоны модулей */
  var PRESETS = {
    hang: function () {
      var m = newModule("base");
      m.facade.system = "hinge"; m.facade.doors = 2;
      var rod = newItem("rod"); rod.y = m.h - plinthOf(project, m) - 2 * CONST.panel - 120;
      var shelf = newItem("shelf_adj"); shelf.y = rod.y - 320;
      m.items = [shelf, rod];
      return m;
    },
    drawers: function () {
      var m = newModule("base");
      m.facade.system = "hinge"; m.facade.doors = 2;
      var dr = newItem("drawers"); dr.y = 0; dr.count = 3;
      var shelf = newItem("shelf_fixed"); shelf.y = dr.count * (dr.boxH + CONST.drawerStep) + 32;
      var rod = newItem("rod"); rod.y = m.h - plinthOf(project, m) - 2 * CONST.panel - 120;
      m.items = [dr, shelf, rod];
      return m;
    },
    shelves: function () {
      var m = newModule("base");
      m.facade.system = "hinge"; m.facade.doors = 1;
      var inner = m.h - CONST.plinthH - 2 * CONST.panel;
      m.items = [];
      for (var i = 1; i <= 5; i++) {
        var s = newItem("shelf_adj");
        s.y = Math.round(inner * i / 6 / 16) * 16;
        m.items.push(s);
      }
      return m;
    },
  };

  document.querySelectorAll("[data-preset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var m = PRESETS[btn.dataset.preset]();
      project.modules.push(m);
      sel = { modId: m.id, itemId: null, face: null };
      if (view.mode !== "front") { view.mode = "front"; syncViewSwitch(); }
      update();
    });
  });

  document.querySelectorAll(".pal-item").forEach(function (elp) {
    elp.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", elp.dataset.drag + "|" + (elp.dataset.mesh || ""));
      e.dataTransfer.effectAllowed = "copy";
    });
    elp.addEventListener("click", function () {
      var mod = findMod(sel.modId);
      if (!mod) { banner("Сначала выберите модуль на холсте.", null); return; }
      tryAddItem(mod, elp.dataset.drag, null, elp.dataset.mesh || null);
    });
  });

  /* ---------- координаты ---------- */

  function svgPoint(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: project.room.h - p.y };
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
    if (view.mode !== "front") { banner("Наполнение добавляется в виде «Спереди».", null); return; }
    var data = (e.dataTransfer.getData("text/plain") || "").split("|");
    var type = data[0];
    if (!type) return;
    var p = svgPoint(e);
    var mod = modAt(p);
    if (!mod) { banner("Бросьте элемент на модуль.", null); return; }
    var inner = innerBox(project, mod);
    var yLocal = Math.round((p.y - moduleY(project, mod) - inner.y0) / 16) * 16;
    tryAddItem(mod, type, clamp(yLocal, 0, Math.max(0, inner.h - 100)), data[1] || null);
  });

  function tryAddItem(mod, type, y, meshId) {
    var it = newItem(type, { meshId: meshId });
    if (y != null) it.y = y;
    var check = canInsert(project, mod, it);
    if (!check.ok) {
      if (check.suggestW) {
        banner(check.reason + " Расширить модуль до " + Math.ceil(check.suggestW) + " мм?",
          function () {
            mod.w = clamp(Math.ceil(check.suggestW), CONST.module.minW, CONST.module.maxW);
            mod.items.push(it);
            sel = { modId: mod.id, itemId: it.id, face: null };
            update();
          }, "Расширить");
      } else banner(check.reason, null);
      return;
    }
    if (check.note) banner(check.note, null);
    mod.items.push(it);
    sel = { modId: mod.id, itemId: it.id, face: null };
    update();
  }

  /* ---------- выбор, drag, клики по размерам ---------- */

  var drag = null;

  svg.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var dimEl = e.target.closest ? e.target.closest("[data-dim]") : null;
    if (dimEl) { openDimInput(dimEl, e); return; }
    var t = e.target.closest ? e.target.closest("[data-item],[data-face],[data-mod]") : null;
    if (!t) { sel = { modId: null, itemId: null, face: null }; update(true); return; }
    var modId = t.getAttribute("data-mod");
    if (t.hasAttribute("data-item") && view.mode === "front") {
      sel = { modId: modId, itemId: t.getAttribute("data-item"), face: null };
      var mod = findMod(modId);
      var it = findItem(mod, sel.itemId);
      var p = svgPoint(e);
      drag = { mode: "item", modId: modId, itemId: sel.itemId, startY: p.y, origY: it.y };
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (t.hasAttribute("data-face")) {
      sel = { modId: modId, itemId: null, face: +t.getAttribute("data-face") };
    } else {
      sel = { modId: modId, itemId: null, face: null };
      if (view.mode === "front") {
        var p2 = svgPoint(e);
        drag = { mode: "module", modId: modId, startX: p2.x };
        try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      }
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
      renderProject(svg, project, sel, { showFacades: view.showFacades, view: view.mode });
    }
    if (drag.mode === "module") {
      var mod2 = findMod(drag.modId);
      var dx = p.x - drag.startX;
      if (Math.abs(dx) > mod2.w * 0.6) {
        var row = project.modules.filter(function (m) { return m.kind === mod2.kind; });
        var idx = row.indexOf(mod2);
        var swap = dx > 0 ? row[idx + 1] : row[idx - 1];
        if (swap) {
          var ai = project.modules.indexOf(mod2);
          var bi = project.modules.indexOf(swap);
          project.modules[ai] = swap;
          project.modules[bi] = mod2;
          drag.startX = p.x;
          renderProject(svg, project, sel, { showFacades: view.showFacades, view: view.mode });
        }
      }
    }
  });

  svg.addEventListener("pointerup", function () {
    if (drag) { update(); drag = null; }
  });

  /* инлайн-редактирование размеров: клик по жёлтой рамке.
     preventDefault обязателен: иначе mousedown по svg уводит фокус
     и поле закрывается в момент открытия (реальная мышь, не тесты). */
  function openDimInput(dimEl, evt) {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    var dim = dimEl.getAttribute("data-dim").split("|");
    var input = $("dimInput");
    var rect = dimEl.getBoundingClientRect();
    var wrap = $("canvas").parentElement.getBoundingClientRect();
    input.style.left = (rect.left - wrap.left + rect.width / 2 - 46) + "px";
    input.style.top = (rect.top - wrap.top - 6) + "px";
    input.hidden = false;
    input.value = currentDimValue(dim);
    var done = false;
    var openedAt = performance.now();
    function commit() {
      if (done) return;
      done = true;
      if (input.value !== "" && !isNaN(+input.value)) applyDim(dim, +input.value);
      input.hidden = true;
    }
    input.onkeydown = function (e) {
      e.stopPropagation();
      if (e.key === "Enter" || e.code === "Enter" || e.keyCode === 13) commit();
      if (e.key === "Escape" || e.code === "Escape" || e.keyCode === 27) {
        done = true; input.hidden = true;
      }
    };
    // страховка: mousedown исходного клика может украсть фокус сразу после
    // открытия (preventDefault на pointerdown его не всегда гасит) -
    // первые 400 мс возвращаем фокус вместо закрытия
    input.onblur = function () {
      if (performance.now() - openedAt < 400) {
        setTimeout(function () { if (!input.hidden) { input.focus(); input.select(); } }, 0);
        return;
      }
      commit();
    };
    setTimeout(function () { input.focus(); input.select(); }, 0);
  }

  function currentDimValue(dim) {
    var mod = dim[1] ? findMod(dim[1]) : null;
    switch (dim[0]) {
      case "roomW": return project.room.w;
      case "roomH": return project.room.h;
      case "upperY": return project.upperY;
      case "plinth": return project.plinthH;
      case "modW": return mod ? mod.w : "";
      case "modH": return mod ? mod.h : "";
      case "modD": return mod ? modDepth(project, mod) : "";
      case "itemY": {
        var it = findItem(mod, dim[2]);
        return it ? it.y : "";
      }
    }
    return "";
  }

  function applyDim(dim, value) {
    if (isNaN(value)) return;
    var mod = dim[1] ? findMod(dim[1]) : null;
    switch (dim[0]) {
      case "roomW": project.room.w = clamp(value, 600, 12000); $("roomW").value = project.room.w; break;
      case "roomH": project.room.h = clamp(value, 1800, 4000); $("roomH").value = project.room.h; break;
      case "upperY": project.upperY = clamp(value, 1000, 3000); break;
      case "plinth": project.plinthH = clamp(value, 60, 150); $("plinthH").value = project.plinthH; break;
      case "modW": if (mod) mod.w = clamp(value, CONST.module.minW, CONST.module.maxW); break;
      case "modH": if (mod) mod.h = clamp(value, CONST.module.minH, CONST.module.maxH); break;
      case "modD": if (mod) mod.depth = clamp(value, CONST.module.minD, CONST.module.maxD); break;
      case "itemY": {
        var it = findItem(mod, dim[2]);
        if (it) it.y = clamp(Math.round(value / 16) * 16, 0, innerBox(project, mod).h - 32);
        break;
      }
    }
    update();
  }

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

  function numRow(label, value, min, max, step, onChange, placeholder) {
    var wrap = document.createElement("div");
    wrap.className = "p-row";
    wrap.innerHTML = "<label>" + esc(label) + "</label>";
    var inp = document.createElement("input");
    inp.type = "number"; inp.min = min; inp.max = max; inp.step = step || 1;
    if (value == null) inp.placeholder = placeholder || "";
    else inp.value = value;
    inp.addEventListener("change", function () {
      onChange(inp.value === "" ? null : clamp(+inp.value, min, max));
    });
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
    var shown = decorRow._all ? LAMARTY
      : LAMARTY.filter(function (d) { return popular.indexOf(d.n) >= 0; });
    shown.forEach(function (d) {
      var s = document.createElement("div");
      s.className = "decor-sw" + (d.n === current ? " on" : "");
      s.title = d.n + " · " + d.cat;
      if (d.tex) s.style.backgroundImage = "url('" + encodeURI(d.tex) + "')";
      else s.style.background = "#e8e2d6";
      s.addEventListener("click", function () { onChange(d.n); });
      grid.appendChild(s);
    });
    var more = document.createElement("button");
    more.type = "button";
    more.className = "decor-more";
    more.textContent = decorRow._all ? "Свернуть каталог" : "Весь каталог Lamarty (133)";
    more.addEventListener("click", function () { decorRow._all = !decorRow._all; renderProps(); });
    grid.appendChild(more);
    wrap.appendChild(grid);
    return wrap;
  }

  function renderProps() {
    var box = $("tabProps");
    box.innerHTML = "";
    var mod = findMod(sel.modId);

    if (!mod) {
      var g = document.createElement("div");
      g.className = "p-group";
      g.innerHTML = "<h3>Проект</h3>";
      var nameRow = document.createElement("div");
      nameRow.className = "p-row";
      nameRow.innerHTML = "<label>Название</label>";
      var nameInp = document.createElement("input");
      nameInp.type = "text"; nameInp.value = project.name || "Шкаф";
      nameInp.addEventListener("change", function () {
        project.name = nameInp.value.trim().slice(0, 60) || "Шкаф"; update();
      });
      nameRow.appendChild(nameInp);
      g.appendChild(nameRow);
      g.appendChild(numRow("Высота верхнего ряда от пола", project.upperY, 1000, 3000, 10,
        function (v) { project.upperY = v; update(); }));
      g.appendChild(numRow("Наценка (розница = себест. × k)", project.markup, 1, 5, 0.1,
        function (v) { project.markup = v; update(); }));
      box.appendChild(g);
      box.appendChild(decorRow("Декор корпуса", project.bodyDecor, function (n) {
        project.bodyDecor = n; update();
      }));
      box.appendChild(decorRow("Декор фасадов (общий)", project.facadeDecor, function (n) {
        project.facadeDecor = n; update();
      }));
      /* библиотека проектов */
      var gl = document.createElement("div");
      gl.className = "p-group";
      gl.innerHTML = "<h3>Мои проекты</h3>";
      var saveBtn = document.createElement("button");
      saveBtn.className = "p-del"; saveBtn.type = "button";
      saveBtn.style.color = "var(--accent)";
      saveBtn.textContent = "Сохранить в проекты: " + (project.name || "Шкаф");
      saveBtn.addEventListener("click", function () {
        librarySave(project);
        saveProject(project);
        banner("Проект «" + (project.name || "Шкаф") + "» сохранён в библиотеку.", null);
        renderProps();
      });
      gl.appendChild(saveBtn);
      libraryList().forEach(function (entry) {
        var row = document.createElement("div");
        row.className = "lib-row";
        var open = document.createElement("button");
        open.className = "btn-link-mini"; open.type = "button";
        open.textContent = entry.name + " · " + entry.updated;
        open.addEventListener("click", function () {
          var p = libraryLoad(entry.id);
          if (p) {
            project = p; sel = { modId: null, itemId: null, face: null };
            syncTop(); update();
          }
        });
        var del = document.createElement("button");
        del.className = "btn-link-mini danger"; del.type = "button";
        del.textContent = "×";
        del.title = "Удалить из библиотеки";
        del.addEventListener("click", function () {
          libraryDelete(entry.id);
          renderProps();
        });
        row.appendChild(open);
        row.appendChild(del);
        gl.appendChild(row);
      });
      box.appendChild(gl);

      var e = document.createElement("div");
      e.className = "p-empty";
      e.textContent = "Выберите модуль на холсте, чтобы настроить его размеры, наполнение и фасады.";
      box.appendChild(e);
      return;
    }

    var item = findItem(mod, sel.itemId);

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
      if (item.type === "drawers") {
        gi.appendChild(numRow("Ящиков в секции", item.count, 1, 8, 1,
          function (v) { item.count = v; update(); }));
        gi.appendChild(numRow("Высота ящика, мм", item.boxH, CONST.drawer.minBoxH,
          CONST.drawer.maxBoxH, 1, function (v) { item.boxH = v; update(); }));
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
        var note = document.createElement("p");
        note.className = "p-note";
        var sides = hingeSidesOf(mod);
        note.textContent = SLIDES[item.slide].note + "." +
          (sides.length ? " Фальш 16 мм в зоне ящиков: " + sides.join(", ") + "." : "");
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
        var mesh = meshCatalog().find(function (x) { return x.id === item.meshId; });
        if (mesh) {
          var mn = document.createElement("p");
          mn.className = "p-note";
          mn.textContent = "Техничка: ширина " + mesh.reqW + ", глубина от " + mesh.reqD +
            " мм." + (mesh.price ? " Розница Лемана " + mesh.price + " ₽." : "");
          gi.appendChild(mn);
        }
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

    var gm = document.createElement("div");
    gm.className = "p-group";
    gm.innerHTML = "<h3>" + (mod.kind === "base" ? "Нижний модуль" : "Верхний модуль") + "</h3>";
    gm.appendChild(numRow("Ширина, мм", mod.w, CONST.module.minW, CONST.module.maxW, 10,
      function (v) { mod.w = v || CONST.module.defaultW; update(); }));
    gm.appendChild(numRow("Высота, мм", mod.h, CONST.module.minH, CONST.module.maxH, 10,
      function (v) { mod.h = v || 600; update(); }));
    gm.appendChild(numRow("Глубина, мм", mod.depth, CONST.module.minD, CONST.module.maxD, 10,
      function (v) { mod.depth = v; update(); }, "общая " + project.depth));
    var fills = fillerPanels(project, mod);
    if (fills.length) {
      var fn = document.createElement("p");
      fn.className = "p-note";
      fn.textContent = "Фальши 16 мм в зонах выкатных: " + fills.length + " шт (авто).";
      gm.appendChild(fn);
    }
    box.appendChild(gm);

    var gf = document.createElement("div");
    gf.className = "p-group";
    gf.innerHTML = "<h3>Фасады</h3>";
    gf.appendChild(segRow("Система", mod.facade.system, [
      { value: "none", label: "нет" },
      { value: "hinge", label: "распашные" },
      { value: "coupe", label: "купе (скоро)" },
    ], function (v) {
      if (v === "coupe") { banner("Редактор купе - следующий этап.", null); return; }
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
            handlesCatalog().map(function (h) {
              return { value: h.id, label: h.label + (h.price ? " · " + h.price + " ₽" : "") };
            })),
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

    var dup = document.createElement("button");
    dup.className = "p-del"; dup.type = "button";
    dup.style.color = "var(--accent)";
    dup.textContent = "Дублировать модуль";
    dup.addEventListener("click", function () {
      var copy = migrateProject(JSON.parse(JSON.stringify({ modules: [mod] }))).modules[0];
      copy.id = uid();
      copy.items.forEach(function (i) { i.id = uid(); });
      var idx = project.modules.indexOf(mod);
      project.modules.splice(idx + 1, 0, copy);
      sel = { modId: copy.id, itemId: null, face: null };
      update();
    });
    box.appendChild(dup);

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
             drawers: "Секция ящиков", mesh: "Сетчатый элемент" }[type] || type;
  }

  /* ---------- смета ---------- */

  function renderSpec() {
    var box = $("tabSpec");
    if (!project.modules.length) {
      box.innerHTML = '<div class="p-empty">Добавьте модули, и смета соберётся сама.</div>';
      return;
    }
    var pr = priceProject(project);
    var html = '<div class="price-box"><div class="price-big">' + fmtRub(pr.retail) + "</div>" +
      '<div class="price-sub">розница · наценка ×' + pr.markup + "</div></div>";

    html += '<table class="spec-table"><thead><tr><th>Себестоимость</th><th style="text-align:right">₽</th></tr></thead><tbody>';
    pr.sheets.forEach(function (s) {
      html += "<tr><td>" + esc(s.label) + " · " + s.count + " лист · КИМ " +
        Math.round(s.kim * 100) + "%</td><td style='text-align:right'>" + fmtRub(s.cost) + "</td></tr>";
    });
    html += "<tr><td>Кромка " + pr.edge.face.toFixed(1) + " м (2 мм) + " + pr.edge.tech.toFixed(1) +
      " м (0,4)</td><td style='text-align:right'>" + fmtRub(pr.edgeCost) + "</td></tr>";
    html += "<tr><td>Фурнитура</td><td style='text-align:right'>" + fmtRub(pr.hwCost) + "</td></tr>";
    if (pr.feeCost) html += "<tr><td>Мелкие детали (+300 ₽/шт)</td><td style='text-align:right'>" + fmtRub(pr.feeCost) + "</td></tr>";
    html += "<tr><td>Работа цеха (" + pr.sheetsCount + " л. × " + CONST.pricing.workPerSheet +
      ")</td><td style='text-align:right'>" + fmtRub(pr.workCost) + "</td></tr>";
    html += "<tr><td style='font-weight:700'>Итого себестоимость</td><td style='text-align:right;font-weight:700'>" +
      fmtRub(pr.cost) + "</td></tr>";
    html += "</tbody></table>";

    html += '<table class="spec-table"><thead><tr><th>Фурнитура</th><th>шт</th><th>₽ закуп</th></tr></thead><tbody>';
    pr.spec.hardware.forEach(function (h) {
      html += "<tr><td>" + esc(h.name) + "</td><td>" + h.qty + "</td><td>" +
        (h.price != null ? (h.price * h.qty).toLocaleString("ru-RU") : "уточнить") + "</td></tr>";
    });
    html += "</tbody></table>";

    html += '<details class="spec-details"><summary>Деталировка (' +
      pr.spec.panels.reduce(function (a, p) { return a + p.qty; }, 0) + ' деталей)</summary>';
    html += '<table class="spec-table"><thead><tr><th>Деталь</th><th>Размер</th><th>шт</th><th>Кромка</th></tr></thead><tbody>';
    var lastMod = "";
    pr.spec.panels.forEach(function (p) {
      if (p.mod !== lastMod) {
        html += '<tr><td colspan="4" style="font-weight:700;padding-top:10px">' + esc(p.mod) + "</td></tr>";
        lastMod = p.mod;
      }
      html += "<tr><td>" + esc(p.part) + (p.material ? " <span style='color:var(--muted)'>(" + esc(p.material) + ")</span>" : "") +
        "</td><td>" + p.w + "×" + p.h + "</td><td>" + p.qty + "</td><td>" + esc(p.edge) + "</td></tr>";
    });
    html += "</tbody></table></details>";
    box.innerHTML = html;
  }

  /* ---------- раскрой ---------- */

  function renderCut() {
    var box = $("tabCut");
    if (!project.modules.length) {
      box.innerHTML = '<div class="p-empty">Добавьте модули: карты раскроя построятся автоматически.</div>';
      return;
    }
    var plan = cuttingPlan(project);
    var html = "";
    plan.forEach(function (g) {
      html += '<div class="p-group"><h3>' + esc(g.label) + " · " + g.result.count +
        " лист · КИМ " + Math.round(g.result.kim * 100) + "%</h3>";
      g.result.sheets.forEach(function (sheet, si) {
        var scale = 236 / g.sheetW;
        var sh = Math.round(g.sheetH * scale);
        html += '<svg class="cut-sheet" viewBox="0 0 ' + g.sheetW + " " + g.sheetH +
          '" style="height:' + sh + 'px">';
        html += '<rect width="' + g.sheetW + '" height="' + g.sheetH +
          '" fill="#f4efe2" stroke="#8d8271" stroke-width="8"/>';
        sheet.placed.forEach(function (r) {
          html += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h +
            '" fill="#dcd2ba" stroke="#6d675c" stroke-width="5"/>';
          if (r.w > 400 && r.h > 120) {
            html += '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2 + 30) +
              '" font-size="85" text-anchor="middle" fill="#5c5647" font-family="Manrope">' +
              esc(r.label) + " " + r.w + "×" + r.h + "</text>";
          }
        });
        html += "</svg>";
      });
      if (g.result.oversize.length) {
        html += '<p class="p-warn">Не влезли в лист: ' +
          g.result.oversize.map(function (p) { return esc(p.label) + " " + p.w + "×" + p.h; }).join(", ") + "</p>";
      }
      html += "</div>";
    });
    html += '<p class="p-note">Гильотинная раскладка полосами, пропил ' + CONST.sheet.kerf +
      ' мм, детали не вращаются (текстура). Точный нестинг под ЧПУ - следующий этап.</p>';
    box.innerHTML = html;
  }

  function renderStatus() {
    var warns = projectWarnings(project);
    var s = specification(project);
    var pr = project.modules.length ? priceProject(project) : null;
    $("statusbar").innerHTML =
      "<span>Модулей: " + project.modules.length + "</span>" +
      "<span>Деталей: " + s.panels.reduce(function (a, p) { return a + p.qty; }, 0) + "</span>" +
      "<span>ЛДСП: " + s.ldspArea.toFixed(2) + " м²</span>" +
      (pr ? "<span>Розница: <b>" + fmtRub(pr.retail) + "</b></span>" : "") +
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
      $("tabCut").hidden = t.dataset.tab !== "cut";
    });
  });

  /* ---------- старт ---------- */

  bindTop();
  update(true);
})();
