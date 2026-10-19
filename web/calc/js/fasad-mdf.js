// js/fasad-mdf.js
// Модуль «Крашеные МДФ-фасады».
// Расчёт стоимости покраски + фрезеровки + soft-touch + петли.
// Чертёж включает: цвет, паттерн фрезеровки, петли с правильной стороны.
//
// Public globals (для inline onclick=""): initMdfModule, addMdfRow, removeMdfRow,
//   mdfRowChange, mdfSetDefaultColor, mdfSetDefaultFinish, mdfSetDefaultMilling,
//   mdfSetDefaultThickness, mdfSetDefaultHinge, openMdfKP.
//
// Depends on: utils.js, store.js, router.js, shared-kp.js,
//             data/fasad-mdf-data.js, data/ral-k7.js

// ── Состояние модуля ──────────────────────────────────────────
let mdfRows                 = [];     // [{w,h,qty,color,finishId,millingId,thickness,hingeId,hingeSide,hingeTopOffset,hingeBottomOffset}]
let mdfDefaultColor         = '9003'; // Сигнальный белый
let mdfDefaultFinish        = 'matte';
let mdfDefaultMilling       = 'none';
let mdfDefaultThickness     = 16;
let mdfDefaultHinge         = 'blum';
let mdfDefaultHingeSide     = 'left'; // 'left' | 'right'

// ── Инициализация ─────────────────────────────────────────────

function initMdfModule() {
  // Селект цвета (RAL) — группы как optgroup
  var cs = document.getElementById('mdfDefaultColorSel');
  if (cs) cs.innerHTML = mdfBuildColorSelectOptions(mdfDefaultColor);

  // Покрытие
  var fs = document.getElementById('mdfDefaultFinishSel');
  if (fs) fs.innerHTML = MDF_FINISHES.map(function(f){
    return '<option value="'+f.id+'"'+(f.id===mdfDefaultFinish?' selected':'')+'>'+f.name+'</option>';
  }).join('');

  // Фрезеровка — показываем код и шаг
  var ms = document.getElementById('mdfDefaultMillingSel');
  if (ms) ms.innerHTML = MDF_MILLINGS.map(function(m){
    var label = (m.code && m.code !== '—' ? m.code+' · ' : '') + m.name +
      (m.price ? ' (+'+fmt(m.price)+' ₽)' : '');
    return '<option value="'+m.id+'"'+(m.id===mdfDefaultMilling?' selected':'')+'>'+label+'</option>';
  }).join('');

  // Толщина
  var ts = document.getElementById('mdfDefaultThicknessSel');
  if (ts) ts.innerHTML = MDF_THICKNESS.map(function(t){
    return '<option value="'+t+'"'+(t===mdfDefaultThickness?' selected':'')+'>'+t+' мм</option>';
  }).join('');

  // Петли
  var hs = document.getElementById('mdfDefaultHingeSel');
  if (hs) hs.innerHTML = MDF_HINGES.map(function(h){
    return '<option value="'+h.id+'"'+(h.id===mdfDefaultHinge?' selected':'')+'>'+h.name+'</option>';
  }).join('');

  // Обновить превью фрезеровки
  mdfUpdateMillingPreview();

  renderMdfTable();
}

function mdfUpdateMillingPreview() {
  var preview = document.getElementById('mdfDefaultMillingPreview');
  if (!preview) return;
  var milling = mdfFindMilling(mdfDefaultMilling);
  preview.innerHTML = milling.iconSvg || '';
}

function mdfBuildColorSelectOptions(selectedCode) {
  var groups = {};
  RAL_K7.forEach(function(c){
    (groups[c.group] = groups[c.group] || []).push(c);
  });
  return Object.keys(groups).map(function(gKey){
    var groupName = (typeof RAL_GROUPS !== 'undefined' && RAL_GROUPS[gKey]) || gKey;
    var opts = groups[gKey].map(function(c){
      return '<option value="'+c.code+'"'+(c.code===selectedCode?' selected':'')+'>'+
        'RAL '+c.code+' — '+c.name+'</option>';
    }).join('');
    return '<optgroup label="'+groupName+'">'+opts+'</optgroup>';
  }).join('');
}

function mdfFindColor(code) {
  return RAL_K7.filter(function(c){ return c.code===code; })[0] || RAL_K7[0];
}
function mdfFindFinish(id) {
  return MDF_FINISHES.filter(function(f){ return f.id===id; })[0] || MDF_FINISHES[0];
}
function mdfFindMilling(id) {
  return MDF_MILLINGS.filter(function(m){ return m.id===id; })[0] || MDF_MILLINGS[0];
}
function mdfFindHinge(id) {
  return MDF_HINGES.filter(function(h){ return h.id===id; })[0] || MDF_HINGES[0];
}

/**
 * Получить требуемую толщину для выбранной фрезеровки.
 * Возвращает specs.thickness, если задана; иначе текущий default.
 */
function mdfRequiredThickness(millingId) {
  var m = mdfFindMilling(millingId);
  return (m.specs && m.specs.thickness) || mdfDefaultThickness;
}

/**
 * Возвращает превью SVG фрезеровки нужного размера.
 */
function mdfMillingIcon(id, w, h) {
  var m = mdfFindMilling(id);
  if (!m.iconSvg) return '';
  return m.iconSvg
    .replace(/width="60"/, 'width="'+w+'"')
    .replace(/height="40"/, 'height="'+h+'"');
}

/**
 * Проверить размер фасада относительно допусков фрезеровки.
 * @returns {string[]} массив предупреждений (пустой = ОК)
 */
function mdfValidateRow(row) {
  var milling = mdfFindMilling(row.millingId);
  if (!milling.specs) return [];

  var warnings = [];
  var lim = milling.specs.limits.solid; // пока только глухой вариант
  if (row.w < lim.minW || row.w > lim.maxW) {
    warnings.push('Ширина '+row.w+' мм вне диапазона '+lim.minW+'–'+lim.maxW+' мм');
  }
  if (row.h < lim.minH || row.h > lim.maxH) {
    warnings.push('Высота '+row.h+' мм вне диапазона '+lim.minH+'–'+lim.maxH+' мм');
  }
  // Проверка кратности шага по ширине
  var sw = milling.specs.stdWidths;
  if (sw && row.w >= sw.from && row.w <= sw.to) {
    var diff = (row.w - sw.from) % sw.step;
    if (diff !== 0) {
      var nearest = sw.from + Math.round((row.w - sw.from) / sw.step) * sw.step;
      warnings.push('Нестандартная ширина (шаг ряда '+sw.step+' мм). Ближайшая стандартная: '+nearest+' мм');
    }
  }
  return warnings;
}

// ── Расчёт ────────────────────────────────────────────────────

/**
 * Авто-расчёт стандартных позиций петель по высоте фасада (мм от верха).
 * 2 петли: 100 / H-100 (если H > 1200 — добавляется средняя по центру).
 */
function mdfAutoHingePositions(h) {
  var top = MDF_HINGE_DEFAULT_OFFSET;
  if (h <= 1200) return [top, h - top];
  return [top, Math.round(h/2), h - top];
}

/**
 * Возвращает массив позиций петель для строки.
 * Если row.hingePositions задан — берёт его (авторитет).
 * Иначе — автогенерация по высоте.
 */
function mdfHingePositionsFor(row) {
  if (row.hingePositions && row.hingePositions.length >= 2) {
    return row.hingePositions;
  }
  return mdfAutoHingePositions(row.h);
}

/**
 * Расчёт стоимости одного фасада МДФ.
 * Принимает row целиком (раньше — отдельные параметры).
 * Учитывает row.hingePositions если задан (override автомата 2/3).
 */
function calcOneMdf(row) {
  var finish  = mdfFindFinish(row.finishId);
  var milling = mdfFindMilling(row.millingId);
  var hinge   = mdfFindHinge(row.hingeId);

  var areaM2 = (row.w * row.h) / 1e6;
  var paintCost   = areaM2 * MDF_BASE_PRICE * finish.priceMultiplier;
  var millingCost = milling.price;

  var positions = mdfHingePositionsFor(row);
  var hingeCount = positions.length;
  var hingeCost  = hinge ? hingeCount * hinge.price : 0;

  var total = paintCost + millingCost + hingeCost;
  return {
    areaM2: areaM2,
    paintCost: paintCost,
    millingCost: millingCost,
    hingeCost: hingeCost,
    hingeCount: hingeCount,
    hingePositions: positions,
    isCustomHinges: !!(row.hingePositions && row.hingePositions.length >= 2),
    total: total
  };
}

// ── Рендер таблицы и итогов ───────────────────────────────────

var MDF_SIDE_LABELS = { left:'Левая', right:'Правая' };

function renderMdfTable() {
  var tbody   = document.getElementById('mdfTbody');
  var empty   = document.getElementById('mdfEmpty');
  var sumCard = document.getElementById('mdfSummaryCard');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!mdfRows.length) {
    if (empty)   empty.style.display   = 'block';
    if (sumCard) sumCard.style.display = 'none';
    return;
  }
  if (empty)   empty.style.display   = 'none';
  if (sumCard) sumCard.style.display = 'block';

  var totPaint=0, totMilling=0, totHinge=0, totArea=0, totAll=0;

  mdfRows.forEach(function(row, i) {
    var c = calcOneMdf(row);
    totPaint   += c.paintCost   * row.qty;
    totMilling += c.millingCost * row.qty;
    totHinge   += c.hingeCost   * row.qty;
    totArea    += c.areaM2      * row.qty;
    // Цена/шт до рубля, строка = цена/шт × кол-во, итог = сумма строк
    var unitR = Math.round(c.total);
    totAll     += unitR * row.qty;

    var color   = mdfFindColor(row.color);
    var milling = mdfFindMilling(row.millingId);

    var colorOpts = mdfBuildColorSelectOptions(row.color);
    var finishOpts = MDF_FINISHES.map(function(f){
      return '<option value="'+f.id+'"'+(f.id===row.finishId?' selected':'')+'>'+f.name+'</option>';
    }).join('');
    var millingOpts = MDF_MILLINGS.map(function(m){
      var label = (m.code && m.code !== '—' ? m.code+' · ' : '') + m.name +
        (m.price ? ' (+'+fmt(m.price)+')' : '');
      return '<option value="'+m.id+'"'+(m.id===row.millingId?' selected':'')+'>'+label+'</option>';
    }).join('');
    var hingeOpts = MDF_HINGES.map(function(hg){
      return '<option value="'+hg.id+'"'+(hg.id===row.hingeId?' selected':'')+'>'+hg.name+'</option>';
    }).join('');
    var sideOpts = ['left','right'].map(function(s){
      return '<option value="'+s+'"'+(s===row.hingeSide?' selected':'')+'>'+MDF_SIDE_LABELS[s]+'</option>';
    }).join('');

    var rowMillingIcon = mdfMillingIcon(row.millingId, 24, 16);

    // Валидация — собираем предупреждения
    var warnings = mdfValidateRow(row);
    var warnText = warnings.length
      ? '<div style="font-size:.66rem;color:#cd7f32;margin-top:2px;line-height:1.2">⚠ '+warnings.join('; ')+'</div>'
      : '';
    // Подпись толщины (авто-фиксируется по фрезеровке)
    var thicknessNote = milling.specs
      ? '<span style="display:inline-block;font-size:.66rem;color:var(--color-text-muted);margin-left:2px;">'+row.thickness+'мм</span>'
      : '';

    var tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--color-border);';
    tr.innerHTML =
      '<td style="padding:6px 8px;color:var(--color-text-muted);">'+(i+1)+'</td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:78px" type="number" value="'+row.w+'"'+
        ' min="'+MDF_LIMITS.minW+'" max="'+MDF_LIMITS.maxW+'" step="1" onchange="mdfRowChange('+i+',\'w\',+this.value)">'+warnText+'</td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:78px" type="number" value="'+row.h+'"'+
        ' min="'+MDF_LIMITS.minH+'" max="'+MDF_LIMITS.maxH+'" step="1" onchange="mdfRowChange('+i+',\'h\',+this.value)"></td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:56px" type="number" value="'+row.qty+'"'+
        ' min="1" step="1" onchange="mdfRowChange('+i+',\'qty\',+this.value)"></td>'+
      '<td style="padding:3px 6px;"><div style="display:flex;align-items:center;gap:6px;">'+
        '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:'+color.hex+';border:1px solid rgba(0,0,0,.2);flex-shrink:0;"></span>'+
        '<select class="inp" style="min-width:140px;max-width:170px;" onchange="mdfRowChange('+i+',\'color\',this.value)">'+colorOpts+'</select>'+
      '</div></td>'+
      '<td style="padding:3px 6px;"><select class="inp" style="min-width:118px;" onchange="mdfRowChange('+i+',\'finishId\',this.value)">'+finishOpts+'</select></td>'+
      '<td style="padding:3px 6px;"><div style="display:flex;align-items:center;gap:6px;">'+
        '<span style="display:inline-flex;width:26px;height:18px;border:1px solid var(--color-border);border-radius:2px;overflow:hidden;background:#fff;flex-shrink:0;align-items:center;justify-content:center;">'+rowMillingIcon+'</span>'+
        '<select class="inp" style="min-width:130px;" onchange="mdfRowChange('+i+',\'millingId\',this.value)">'+millingOpts+'</select>'+
        thicknessNote+
      '</div></td>'+
      '<td style="padding:3px 6px;"><select class="inp" style="min-width:120px;" onchange="mdfRowChange('+i+',\'hingeId\',this.value)">'+hingeOpts+'</select></td>'+
      '<td style="padding:3px 6px;"><div style="display:flex;align-items:center;gap:4px;">'+
        '<select class="inp" style="min-width:96px;" onchange="mdfRowChange('+i+',\'hingeSide\',this.value)">'+sideOpts+'</select>'+
        '<button onclick="openMdfHingeEditor('+i+')" title="Настроить петли" style="height:32px;width:32px;background:var(--color-surface-offset);border:1px solid var(--color-border);border-radius:var(--radius-sm);cursor:pointer;font-size:14px;line-height:1;color:var(--color-text-muted);flex-shrink:0;" onmouseenter="this.style.color=\'var(--color-primary)\';this.style.borderColor=\'var(--color-primary)\'" onmouseleave="this.style.color=\'var(--color-text-muted)\';this.style.borderColor=\'var(--color-border)\'">⚙</button>'+
      '</div></td>'+
      '<td style="padding:6px 8px;text-align:right;color:var(--color-text-muted);font-size:.78rem;">'+c.areaM2.toFixed(2)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;">'+fmt(unitR)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;font-weight:700;">'+fmt(unitR*row.qty)+'</td>'+
      '<td style="padding:3px;"><button onclick="removeMdfRow('+i+')"'+
        ' style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:20px;line-height:1;padding:2px 6px;"'+
        ' onmouseenter="this.style.color=\'#e53e3e\'" onmouseleave="this.style.color=\'var(--color-text-muted)\'"'+
        ' title="Удалить строку">×</button></td>';
    tbody.appendChild(tr);
  });

  // Фрезеровки и петли — целые рубли; покраска добирает остаток, чтобы статьи = ИТОГО
  totMilling = Math.round(totMilling); totHinge = Math.round(totHinge);
  totPaint = totAll - totMilling - totHinge;
  var sumEl = document.getElementById('mdfSummary');
  if (sumEl) sumEl.innerHTML =
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Покраска</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totPaint))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Фрезеровки</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totMilling))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Петли</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totHinge))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Площадь</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+totArea.toFixed(2)+' м²</div></div>'+
    '<div style="flex:1;min-width:150px;border-left:2px solid var(--color-border);padding-left:20px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">ИТОГО</div>'+
      '<div style="font-size:1.35rem;font-weight:800;color:var(--color-primary);">'+fmt(Math.round(totAll))+' ₽</div></div>';

  if (typeof AppState !== 'undefined') {
    AppState.fasadMdf.rows = mdfRows;
    AppState.fasadMdf.lastTotals = { paint:totPaint, milling:totMilling, hinge:totHinge, area:totArea, total:totAll };
  }
  if (typeof EventBus !== 'undefined') EventBus.emit('fasad-mdf:changed', { totals: totAll });
}

// ── Управление строками ───────────────────────────────────────

function addMdfRow() {
  var thickness = mdfRequiredThickness(mdfDefaultMilling);
  mdfRows.push({
    w:600, h:716, qty:1,
    color:             mdfDefaultColor,
    finishId:          mdfDefaultFinish,
    millingId:         mdfDefaultMilling,
    thickness:         thickness,
    hingeId:           mdfDefaultHinge,
    hingeSide:         mdfDefaultHingeSide,
    hingeTopOffset:    MDF_HINGE_DEFAULT_OFFSET,
    hingeBottomOffset: MDF_HINGE_DEFAULT_OFFSET
  });
  renderMdfTable();
}

function removeMdfRow(idx) {
  mdfRows.splice(idx,1);
  renderMdfTable();
}

function mdfRowChange(i, field, val) {
  // Пустое/нулевое значение размера или количества не принимаем (иначе строка = 0 ₽)
  if ((field === 'w' || field === 'h' || field === 'qty') && !(val > 0)) { renderMdfTable(); return; }
  if (field === 'qty') val = Math.round(val);
  // Смена высоты — ручные позиции петель могли оказаться за краем, возвращаем авто-расстановку
  if (field === 'h' && mdfRows[i].hingePositions && val !== mdfRows[i].h) mdfRows[i].hingePositions = null;
  mdfRows[i][field] = val;
  // Авто-форс толщины при смене фрезеровки
  if (field === 'millingId') {
    mdfRows[i].thickness = mdfRequiredThickness(val);
  }
  renderMdfTable();
}

function mdfSetDefaultColor(code)       { mdfDefaultColor = code; }
function mdfSetDefaultFinish(id)        { mdfDefaultFinish = id; }
function mdfSetDefaultMilling(id)       {
  mdfDefaultMilling = id;
  // Автоматически выставляем default-толщину под фрезеровку
  mdfDefaultThickness = mdfRequiredThickness(id);
  var ts = document.getElementById('mdfDefaultThicknessSel');
  if (ts) ts.value = String(mdfDefaultThickness);
  mdfUpdateMillingPreview();
}
function mdfSetDefaultThickness(t)      { mdfDefaultThickness = t; }
function mdfSetDefaultHinge(id)         { mdfDefaultHinge = id; }
function mdfSetDefaultHingeSide(s)      { mdfDefaultHingeSide = s; }

// ── Рисование паттерна фрезеровки в чертеже ───────────────────

/**
 * Отрисовка паттерна фрезеровки внутри прямоугольника фасада.
 * Использует milling.specs.step для определения частоты вертикальных линий.
 *
 * @param {string} millingId
 * @param {number} x, y, w, h — прямоугольник фасада в px
 * @param {number} scale — px/mm (масштаб чертежа)
 * @returns {string} SVG markup элементов
 */
function drawMillingPattern(millingId, x, y, w, h, scale) {
  if (!millingId || millingId === 'none') return '';
  var milling = mdfFindMilling(millingId);
  if (!milling.specs) return '';

  var stepMm = milling.specs.step;
  var stepPx = Math.max(1.5, stepMm * scale);
  var lines = '';

  if (millingId === 'volna') {
    // Широкие округлые рейки: чередующиеся светлые/тёмные полосы
    var idx = 0;
    for (var px = 0; px < w; px += stepPx) {
      var width = Math.min(stepPx, w - px);
      var fill = (idx % 2 === 0) ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.13)';
      lines += '<rect x="'+(x+px)+'" y="'+y+'" width="'+width+'" height="'+h+'" fill="'+fill+'"/>';
      idx++;
    }
  }
  else if (millingId === 'pryamaya') {
    // Узкие V-канавки: тонкие тёмные линии
    for (var px = stepPx; px < w; px += stepPx) {
      lines += '<line x1="'+(x+px)+'" y1="'+y+'" x2="'+(x+px)+'" y2="'+(y+h)+
        '" stroke="rgba(0,0,0,.22)" stroke-width=".5"/>';
    }
  }
  else if (millingId === 'type3') {
    // Прямоугольные рейки: более заметные тёмные линии
    for (var px = stepPx; px < w; px += stepPx) {
      lines += '<line x1="'+(x+px)+'" y1="'+y+'" x2="'+(x+px)+'" y2="'+(y+h)+
        '" stroke="rgba(0,0,0,.28)" stroke-width="1"/>';
    }
  }

  return lines;
}

/**
 * Отрисовка петель на чертеже.
 * Положение: hingeTopOffset мм от верха, hingeBottomOffset мм от низа.
 * При 3 петлях — третья посередине между крайними.
 * Сторона: row.hingeSide ('left'|'right').
 *
 * @returns {string} SVG markup элементов петель
 */
function drawMdfHinges(row, offX, offY, rW, rH, scale, c) {
  var positions = c.hingePositions || mdfHingePositionsFor(row);
  if (!positions.length) return '';

  var side = row.hingeSide || 'left';
  var hingeX = (side === 'right') ? (offX + rW - 6) : (offX + 2);
  var sign = (side === 'right') ? -1 : 1;

  var lines = '';
  positions.forEach(function(mmFromTop){
    var cy = offY + mmFromTop * scale;
    lines += '<circle cx="'+hingeX+'" cy="'+cy+'" r="3.2" fill="rgba(255,255,255,.85)" stroke="#444" stroke-width=".7"/>';
    lines += '<circle cx="'+hingeX+'" cy="'+cy+'" r="1.3" fill="#666"/>';
    var edgeX = (side === 'right') ? offX + rW : offX;
    lines += '<line x1="'+(edgeX - sign*3)+'" y1="'+cy+'" x2="'+(edgeX + sign*1)+'" y2="'+cy+'"'+
      ' stroke="#444" stroke-width=".5" opacity=".6"/>';
  });

  return lines;
}

function mdfIsDark(hex) {
  var h = (hex || '#888').replace('#','');
  if (h.length !== 6) return false;
  var r = parseInt(h.substring(0,2), 16);
  var g = parseInt(h.substring(2,4), 16);
  var b = parseInt(h.substring(4,6), 16);
  var brightness = (r*299 + g*587 + b*114) / 1000;
  return brightness < 128;
}

/**
 * Технологический чертёж одного МДФ-фасада.
 */
function buildMdfSVG(row) {
  var W = row.w, H = row.h;
  var color   = mdfFindColor(row.color);
  var finish  = mdfFindFinish(row.finishId);
  var milling = mdfFindMilling(row.millingId);

  var scale = Math.min(170/W, 230/H);
  var rW = Math.round(W * scale);
  var rH = Math.round(H * scale);

  var padLeft = 60, padRight = 60, padTop = 32, padBottom = 42;
  var offX = padLeft, offY = padTop;
  var svgW = offX + rW + padRight;
  var svgH = offY + rH + padBottom;

  var c = calcOneMdf(row);

  var lines = '';

  // 1. Прямоугольник фасада, заливка цветом RAL
  lines += '<rect x="'+offX+'" y="'+offY+'" width="'+rW+'" height="'+rH+'"'+
    ' fill="'+color.hex+'" stroke="#333" stroke-width="1.5"/>';

  // 2. Паттерн фрезеровки (вертикальный)
  lines += drawMillingPattern(row.millingId, offX, offY, rW, rH, scale);

  // 3. Подпись цвета внутри (контрастная)
  var textColor = mdfIsDark(color.hex) ? '#fff' : '#222';
  lines += '<text x="'+(offX+5)+'" y="'+(offY+12)+'" font-size="7" fill="'+textColor+'" opacity=".75" font-family="Arial">RAL '+color.code+'</text>';
  if (milling.id !== 'none') {
    lines += '<text x="'+(offX+5)+'" y="'+(offY+rH-5)+'" font-size="6.5" fill="'+textColor+'" opacity=".65" font-family="Arial">'+
      (milling.code && milling.code!=='—' ? milling.code+' ' : '')+milling.name+
      (milling.specs ? ', шаг '+milling.specs.step+' мм' : '')+
      '</text>';
  }

  // 4. Подпись толщины + покрытия сверху
  var titleX = offX + Math.round(rW/2);
  lines += '<text x="'+titleX+'" y="'+(offY-14)+'" text-anchor="middle" font-size="8" fill="#01696f" font-weight="700" font-family="Arial">'+
    'МДФ '+row.thickness+' мм · '+finish.name+'</text>';

  // 5. Петли
  lines += drawMdfHinges(row, offX, offY, rW, rH, scale, c);

  // 6. Размеры W/H + размеры петельных отступов
  // W — снизу
  var dimYbot = offY + rH + 22;
  lines += dimLineH(offX, dimYbot, offX+rW, dimYbot, W+'',
    Math.round(offX + rW/2), dimYbot+11);

  // H — на стороне без петель
  var hingesOnLeft = (row.hingeSide || 'left') === 'left';
  var dimXh = hingesOnLeft ? (offX + rW + 22) : (offX - 22);
  var dimAnchor = hingesOnLeft ? 'start' : 'end';
  var dimTextX = hingesOnLeft ? (dimXh + 5) : (dimXh - 5);
  lines += dimLineV(dimXh, offY, dimXh, offY+rH, H+'',
    dimTextX, Math.round(offY + rH/2)+3, dimAnchor);

  // Размеры петельных отступов — на стороне петель
  // Для каждой петли показываем расстояние от верха фасада
  if (c.hingePositions && c.hingePositions.length) {
    var pX     = hingesOnLeft ? (offX - 18) : (offX + rW + 18);
    var pAnchor= hingesOnLeft ? 'end' : 'start';
    var pTextX = hingesOnLeft ? (pX - 5) : (pX + 5);

    var positions = c.hingePositions;
    // 1. Размер от верха до первой петли
    var firstMm = positions[0];
    lines += dimLineV(pX, offY, pX, offY+firstMm*scale, firstMm+'',
      pTextX, Math.round(offY + firstMm*scale/2)+3, pAnchor);
    // 2. Межосевые между соседними петлями (если 3+)
    for (var pi = 1; pi < positions.length; pi++) {
      var prevMm = positions[pi-1];
      var curMm  = positions[pi];
      var gap = curMm - prevMm;
      lines += dimLineV(pX, offY+prevMm*scale, pX, offY+curMm*scale, gap+'',
        pTextX, Math.round(offY + (prevMm+curMm)*scale/2)+3, pAnchor);
    }
    // 3. Размер от последней петли до низа
    var lastMm = positions[positions.length-1];
    var bottomMm = row.h - lastMm;
    lines += dimLineV(pX, offY+lastMm*scale, pX, offY+rH, bottomMm+'',
      pTextX, Math.round(offY + (lastMm*scale + rH)/2)+3, pAnchor);
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" style="font-family:Arial,sans-serif;">'+lines+'</svg>';
}

// ── КП ─────────────────────────────────────────────────────────

function buildMdfKPHTML(client, phone, manager) {
  var now     = new Date();
  var dateStr = now.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
  var kpNum   = 'КП-МДФ-' + now.getFullYear() +
    String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' +
    String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');

  var rowsHTML = '', svgPages = '';
  var grand=0, totPaint=0, totMilling=0, totHinge=0, totArea=0;
  var millingSmeta = {};
  var hingeSmeta = {};

  mdfRows.forEach(function(row, i) {
    var c       = calcOneMdf(row);
    var color   = mdfFindColor(row.color);
    var finish  = mdfFindFinish(row.finishId);
    var milling = mdfFindMilling(row.millingId);
    var hinge   = mdfFindHinge(row.hingeId);
    var lineT   = Math.round(c.total) * row.qty;   // как на экране: цена/шт × кол-во
    grand      += lineT;
    totPaint   += Math.round(c.paintCost * row.qty);
    totMilling += Math.round(c.millingCost * row.qty);
    totHinge   += Math.round(c.hingeCost * row.qty);
    totArea    += c.areaM2 * row.qty;

    // Учёт фрезеровок
    if (milling.id !== 'none') {
      if (!millingSmeta[milling.id]) millingSmeta[milling.id] = {
        name: (milling.code && milling.code!=='—' ? milling.code+' · ' : '')+milling.name,
        count:0, unitPrice:milling.price, total:0, iconSvg:milling.iconSvg||''
      };
      millingSmeta[milling.id].count += row.qty;
      millingSmeta[milling.id].total += Math.round(milling.price * row.qty);
    }
    // Учёт петель
    if (hinge) {
      if (!hingeSmeta[hinge.id]) hingeSmeta[hinge.id] = {
        name: hinge.name, count:0,
        unitSell: Math.round(hinge.price), total:0
      };
      hingeSmeta[hinge.id].count += c.hingeCount * row.qty;
      hingeSmeta[hinge.id].total += Math.round(c.hingeCost * row.qty);
    }

    rowsHTML +=
      '<tr>'+
        '<td>'+(i+1)+'</td>'+
        '<td>МДФ-фасад '+row.thickness+'мм, '+row.w+'×'+row.h+' мм<br>'+
          '<span style="color:#999;font-size:8pt">'+
          '<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+color.hex+';border:1px solid rgba(0,0,0,.2);vertical-align:middle;margin-right:4px;"></span>'+
          'RAL '+color.code+' '+color.name+' · '+finish.name+
          (milling.id!=='none' ? ' · фрез: '+milling.name : '')+
          ' · петли: '+hinge.name+' '+c.hingeCount+' шт ('+(MDF_SIDE_LABELS[row.hingeSide||'left'])+')'+
          '</span></td>'+
        '<td class="r">'+row.w+' × '+row.h+'</td>'+
        '<td class="r">'+row.qty+' шт</td>'+
        '<td class="r">'+fmt(Math.round(c.total))+'</td>'+
        '<td class="r" style="font-weight:600">'+fmt(lineT)+'</td>'+
      '</tr>';

    var svg = buildMdfSVG(row);
    svgPages +=
      '<div style="page-break-inside:avoid;margin-bottom:8mm;padding:4mm 0;border-bottom:1px solid #eee;">'+
        '<div style="font-size:9pt;font-weight:700;color:#01696f;margin-bottom:3mm">'+
          '№'+(i+1)+' — '+row.w+'×'+row.h+' мм · RAL '+color.code+' '+color.name+' · '+finish.name+
          (milling.id!=='none' ? ' · '+milling.name : '')+
        '</div>'+
        svg+
      '</div>';
  });

  // Смета фрезеровок
  var millingKeys = Object.keys(millingSmeta);
  var millingTable = '';
  if (millingKeys.length) {
    var millingRows = millingKeys.map(function(k){
      var s = millingSmeta[k];
      var icon = (s.iconSvg || '').replace(/width="60"/, 'width="32"').replace(/height="40"/, 'height="20"');
      return '<tr>'+
        '<td><div style="display:flex;align-items:center;gap:8px;">'+
          '<span style="display:inline-block;width:34px;height:22px;border:1px solid #ddd;border-radius:2px;overflow:hidden;background:#fff;flex-shrink:0;">'+icon+'</span>'+
          '<span>Фрезеровка '+s.name+'</span>'+
        '</div></td>'+
        '<td class="r">'+s.count+' шт</td>'+
        '<td class="r">'+fmt(s.unitPrice)+'</td>'+
        '<td class="r" style="font-weight:600">'+fmt(s.total)+'</td>'+
        '</tr>';
    }).join('');
    millingTable =
      '<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin:6mm 0 3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">'+
      'Смета фрезеровок</div>'+
      '<table class="kp-table"><thead><tr><th>Наименование</th>'+
        '<th class="r">Кол-во</th><th class="r">Цена, ₽</th><th class="r">Сумма, ₽</th></tr></thead>'+
      '<tbody>'+millingRows+
        '<tr class="kp-total-row"><td colspan="3">Итого фрезеровка</td>'+
          '<td class="r">'+fmt(totMilling)+'</td></tr>'+
      '</tbody></table>';
  }

  // Смета петель
  var hingeKeys = Object.keys(hingeSmeta);
  var hingeTable = '';
  if (hingeKeys.length) {
    var hingeRowsHTML = hingeKeys.map(function(k){
      var s = hingeSmeta[k];
      return '<tr><td>Петля '+s.name+'</td><td class="r">'+s.count+' шт</td>'+
        '<td class="r">'+fmt(s.unitSell)+'</td><td class="r" style="font-weight:600">'+fmt(s.total)+'</td></tr>';
    }).join('');
    hingeTable =
      '<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin:6mm 0 3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">'+
      'Смета фурнитуры (петли)</div>'+
      '<table class="kp-table"><thead><tr><th>Наименование</th>'+
        '<th class="r">Кол-во</th><th class="r">Цена, ₽</th><th class="r">Сумма, ₽</th></tr></thead>'+
      '<tbody>'+hingeRowsHTML+
        '<tr class="kp-total-row"><td colspan="3">Итого петли</td>'+
          '<td class="r">'+fmt(totHinge)+'</td></tr>'+
      '</tbody></table>';
  }

  // Разбивка по статьям (покраска добирает остаток округления — статьи = итог)
  totPaint = grand - totMilling - totHinge;
  var breakHTML =
    '<tr><td colspan="5">Покраска (МДФ-плита + грунт + покраска + сушка)'+
      '<br><span style="color:#999;font-size:8pt">'+totArea.toFixed(2)+' м² (с учётом покрытия)</span></td>'+
      '<td class="r">'+fmt(totPaint)+'</td></tr>'+
    (totMilling > 0
      ? '<tr><td colspan="5">Фрезеровки (декоративная обработка)</td>'+
        '<td class="r">'+fmt(totMilling)+'</td></tr>'
      : '')+
    (totHinge > 0
      ? '<tr><td colspan="5">Петли</td>'+
        '<td class="r">'+fmt(totHinge)+'</td></tr>'
      : '');

  var grandRow =
    '<tr class="kp-total-row"><td colspan="5">ИТОГО К ОПЛАТЕ</td>'+
      '<td class="r" style="font-size:11pt;font-weight:700;">'+fmt(grand)+' ₽</td></tr>';

  var HDR = '<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">';

  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;padding-bottom:6mm;border-bottom:2px solid #01696f">'+
    '<div><div style="font-size:15pt;font-weight:700;color:#01696f;margin-bottom:2px">Крашеные МДФ-фасады</div>'+
    '<div style="font-size:8.5pt;color:#999">Коммерческое предложение</div></div>'+
    '<div style="text-align:right"><div style="font-size:18pt;font-weight:700;letter-spacing:-.02em">КП</div>'+
    '<div style="font-size:8.5pt;color:#999">№ '+kpNum+'</div>'+
    '<div style="font-size:8.5pt;color:#999">'+dateStr+'</div></div></div>'+

    '<table style="width:100%;border-collapse:collapse;margin-bottom:8mm;font-size:9.5pt">'+
    '<tr><td style="padding:3px 0;color:#666;width:130px">Клиент:</td><td style="font-weight:600">'+(client||'—')+'</td></tr>'+
    '<tr><td style="padding:3px 0;color:#666">Телефон:</td><td>'+(phone||'—')+'</td></tr>'+
    '<tr><td style="padding:3px 0;color:#666">Менеджер:</td><td>'+(manager||'—')+'</td></tr>'+
    '</table>'+

    HDR+'Состав заказа</div>'+
    '<table class="kp-table"><thead><tr>'+
    '<th style="width:26px">№</th><th>Наименование</th>'+
    '<th class="r" style="width:86px">Размер, мм</th>'+
    '<th class="r" style="width:54px">Кол-во</th>'+
    '<th class="r" style="width:86px">Цена/шт, ₽</th>'+
    '<th class="r" style="width:96px">Сумма, ₽</th>'+
    '</tr></thead><tbody>'+rowsHTML+'</tbody></table>'+

    millingTable+
    hingeTable+

    '<div style="margin-top:6mm">'+HDR+'Разбивка по статьям</div>'+
    '<table class="kp-table"><thead><tr>'+
    '<th colspan="5">Статья затрат</th><th class="r" style="width:96px">Сумма, ₽</th>'+
    '</tr></thead><tbody>'+breakHTML+grandRow+'</tbody></table>'+

    '<div style="background:#f8faf9;border:1.5px solid #cedcd8;border-radius:6px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;margin-top:6mm">'+
    '<div style="font-size:11pt;font-weight:700">ИТОГО К ОПЛАТЕ:</div>'+
    '<div style="font-size:18pt;font-weight:700;color:#01696f">'+fmt(grand)+' ₽</div></div>'+

    '<div style="margin-top:10mm;font-size:8.5pt;color:#aaa;border-top:1px solid #eee;padding-top:4mm;line-height:1.6">'+
    'Данное КП действительно 14 дней. Цены указаны с учётом всех комплектующих. Срок изготовления: 12–18 рабочих дней.<br>'+
    'Настоящее КП не является публичной офертой.</div>'+

    '<div style="display:flex;justify-content:space-between;margin-top:12mm">'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись менеджера</div>'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись клиента</div>'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:120px;font-size:8pt;color:#999;text-align:center">МП</div>'+
    '</div>'+

    '<div style="page-break-before:always;padding-top:6mm;">'+
    HDR+'Чертежи фасадов</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:12mm;">'+svgPages+'</div>'+
    '</div>';
}

function openMdfKP() {
  if (!mdfRows.length) {
    alert('Добавьте хотя бы один фасад перед формированием КП.');
    return;
  }
  // Поля клиента — свои в блоке итогов; если пусто — берём из купе (если там заполнено)
  function kpField(own, kupe) {
    var v = ((document.getElementById(own) || {}).value || '').trim();
    return v || ((document.getElementById(kupe) || {}).value || '').trim();
  }
  var client  = kpField('mdfKpClient',  'kpClient');
  var phone   = kpField('mdfKpPhone',   'kpPhone');
  var manager = kpField('mdfKpManager', 'kpManager');
  var html = buildMdfKPHTML(client, phone, manager);
  if (typeof displayKPDocument === 'function') {
    displayKPDocument(html, 'fasad-mdf');
  } else {
    var el = document.getElementById('kpPageContent');
    if (el) el.innerHTML = html;
    var modal = document.getElementById('kpDocument');
    if (modal) { modal.classList.add('kp-open'); document.body.style.overflow = 'hidden'; }
  }
}

if (typeof ROUTER !== 'undefined' && ROUTER.registerInit) {
  ROUTER.registerInit('fasad-paint', initMdfModule);
}

// ============================================================
// РЕДАКТОР ПЕТЕЛЬ — drag-n-drop + add/remove/reset
// ============================================================

var MDF_HINGE_MIN_GAP   = 30;    // мм, минимальный зазор между соседними и от края
var MDF_HINGE_MAX_COUNT = 5;     // максимум петель на фасад
var MDF_HINGE_EDITOR_W  = 280;   // px, целевая ширина превью внутри модалки
var MDF_HINGE_EDITOR_H  = 480;   // px, целевая высота превью

// State редактора (активный сеанс)
var _mdfHEditRow   = -1;          // индекс строки фасада
var _mdfHEditPos   = [];          // рабочие позиции (мм от верха)
var _mdfHEditDrag  = null;        // {idx, startY, startMm, scale}

function openMdfHingeEditor(rowIdx) {
  if (rowIdx < 0 || rowIdx >= mdfRows.length) return;
  _mdfHEditRow = rowIdx;
  var row = mdfRows[rowIdx];
  // Старт с текущих позиций (или авто)
  _mdfHEditPos = mdfHingePositionsFor(row).slice().sort(function(a,b){return a-b;});

  var title = 'Петли · Фасад №' + (rowIdx+1) + ' · ' + row.w + '×' + row.h + ' мм';
  var titleEl = document.getElementById('mdfHingeEditorTitle');
  if (titleEl) titleEl.textContent = title;

  renderMdfHingeEditor();
  var modal = document.getElementById('mdfHingeEditor');
  if (modal) modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMdfHingeEditor() {
  // Сохранить позиции в строку
  if (_mdfHEditRow >= 0 && _mdfHEditPos.length >= 2) {
    mdfRows[_mdfHEditRow].hingePositions = _mdfHEditPos.slice();
    renderMdfTable();
  }
  var modal = document.getElementById('mdfHingeEditor');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  _mdfHEditRow = -1;
  _mdfHEditPos = [];
  _mdfHEditDrag = null;
}

/**
 * Перерисовать превью редактора с draggable петлями.
 */
function renderMdfHingeEditor() {
  if (_mdfHEditRow < 0) return;
  var row = mdfRows[_mdfHEditRow];
  var preview = document.getElementById('mdfHingePreview');
  if (!preview) return;

  var W = row.w, H = row.h;
  // Масштаб — крупнее чем в карточке
  var scale = Math.min(MDF_HINGE_EDITOR_W/W, MDF_HINGE_EDITOR_H/H);
  var rW = Math.round(W * scale);
  var rH = Math.round(H * scale);
  var pad = 80;
  var svgW = pad + rW + pad;
  var svgH = 30 + rH + 50;

  var color   = mdfFindColor(row.color);
  var milling = mdfFindMilling(row.millingId);
  var side    = row.hingeSide || 'left';
  var hingesOnLeft = side === 'left';

  var lines = '';

  // Прямоугольник фасада с цветом RAL
  lines += '<rect x="'+pad+'" y="30" width="'+rW+'" height="'+rH+'"'+
    ' fill="'+color.hex+'" stroke="#333" stroke-width="1.5"/>';

  // Паттерн фрезеровки
  lines += drawMillingPattern(row.millingId, pad, 30, rW, rH, scale);

  // Подпись цвета и фрезеровки внутри
  var textColor = mdfIsDark(color.hex) ? '#fff' : '#222';
  lines += '<text x="'+(pad+8)+'" y="'+(30+16)+'" font-size="10" fill="'+textColor+'" opacity=".75" font-family="Arial">RAL '+color.code+'</text>';
  if (milling.id !== 'none') {
    lines += '<text x="'+(pad+8)+'" y="'+(30+rH-8)+'" font-size="9" fill="'+textColor+'" opacity=".7" font-family="Arial">'+
      milling.code+' · шаг '+milling.specs.step+' мм</text>';
  }

  // Размер W снизу
  var dimYbot = 30 + rH + 18;
  lines += dimLineH(pad, dimYbot, pad+rW, dimYbot, W+'',
    pad + Math.round(rW/2), dimYbot+11);

  // Размер H — на стороне без петель (далеко)
  var farX = hingesOnLeft ? (pad + rW + 50) : (pad - 50);
  var farAnchor = hingesOnLeft ? 'start' : 'end';
  var farTextX = hingesOnLeft ? (farX + 5) : (farX - 5);
  lines += dimLineV(farX, 30, farX, 30+rH, H+'',
    farTextX, Math.round(30 + rH/2)+3, farAnchor);

  // Размеры между петлями + от краёв (на стороне с петлями)
  var pX = hingesOnLeft ? (pad - 26) : (pad + rW + 26);
  var pAnchor = hingesOnLeft ? 'end' : 'start';
  var pTextX  = hingesOnLeft ? (pX - 4) : (pX + 4);

  if (_mdfHEditPos.length > 0) {
    // От верха до первой
    var first = _mdfHEditPos[0];
    lines += dimLineV(pX, 30, pX, 30 + first*scale, first+'',
      pTextX, Math.round(30 + first*scale/2)+3, pAnchor);
    // Между соседними
    for (var pi = 1; pi < _mdfHEditPos.length; pi++) {
      var prev = _mdfHEditPos[pi-1];
      var cur  = _mdfHEditPos[pi];
      lines += dimLineV(pX, 30+prev*scale, pX, 30+cur*scale, (cur-prev)+'',
        pTextX, Math.round(30 + (prev+cur)*scale/2)+3, pAnchor);
    }
    // От последней до низа
    var last = _mdfHEditPos[_mdfHEditPos.length-1];
    lines += dimLineV(pX, 30+last*scale, pX, 30+rH, (H-last)+'',
      pTextX, Math.round(30 + (last*scale+rH)/2)+3, pAnchor);
  }

  // Петли — большие draggable круги
  var hingeX = hingesOnLeft ? (pad + 10) : (pad + rW - 10);
  _mdfHEditPos.forEach(function(mmFromTop, idx){
    var py = 30 + mmFromTop * scale;
    // Группа draggable
    lines += '<g class="mdf-hinge-handle" data-idx="'+idx+'"'+
      ' onmousedown="mdfHingeStartDrag(event,'+idx+')">';
    lines += '<circle cx="'+hingeX+'" cy="'+py+'" r="11" fill="rgba(255,255,255,.96)" stroke="#01696f" stroke-width="2"/>';
    lines += '<circle cx="'+hingeX+'" cy="'+py+'" r="3.5" fill="#01696f"/>';
    lines += '</g>';

    // Подпись текущего mm рядом с петлёй (быстро видно при перетаскивании)
    var hLabelX = hingesOnLeft ? (hingeX + 18) : (hingeX - 18);
    var hLabelAnchor = hingesOnLeft ? 'start' : 'end';
    lines += '<text x="'+hLabelX+'" y="'+(py+4)+'" text-anchor="'+hLabelAnchor+'" font-size="11" font-weight="700" fill="#01696f" font-family="Arial" pointer-events="none">'+
      Math.round(mmFromTop)+'</text>';

    // Кнопка удалить (видна если 3+ петель)
    if (_mdfHEditPos.length > 2) {
      var rmX = hingesOnLeft ? (hingeX - 22) : (hingeX + 22);
      lines += '<g class="mdf-hinge-remove-btn" onclick="mdfHingeRemove('+idx+')">';
      lines += '<circle cx="'+rmX+'" cy="'+py+'" r="7" fill="#fff" stroke="#c44"/>';
      lines += '<text x="'+rmX+'" y="'+(py+4)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#c44" font-family="Arial" pointer-events="none">×</text>';
      lines += '</g>';
    }
  });

  preview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+
    '" style="display:block;margin:0 auto;font-family:Arial,sans-serif;user-select:none;">'+
    lines+'</svg>';

  // Информационная строка с количеством
  var countEl = document.getElementById('mdfHingeCount');
  if (countEl) countEl.textContent = 'Всего петель: ' + _mdfHEditPos.length;

  // Disable add button if no room
  var addBtn = document.getElementById('mdfHingeAddBtn');
  if (addBtn) {
    var canAdd = _mdfHEditPos.length < MDF_HINGE_MAX_COUNT && mdfHingeMaxGap() >= MDF_HINGE_MIN_GAP * 2;
    addBtn.disabled = !canAdd;
  }
}

/**
 * Найти максимальный зазор между соседними позициями (включая края).
 * @returns {number} максимальный зазор в мм
 */
function mdfHingeMaxGap() {
  if (_mdfHEditRow < 0) return 0;
  var H = mdfRows[_mdfHEditRow].h;
  var bounds = [0].concat(_mdfHEditPos).concat([H]);
  var max = 0;
  for (var i = 0; i < bounds.length - 1; i++) {
    var g = bounds[i+1] - bounds[i];
    if (g > max) max = g;
  }
  return max;
}

function mdfHingeStartDrag(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  var row = mdfRows[_mdfHEditRow];
  var scale = Math.min(MDF_HINGE_EDITOR_W/row.w, MDF_HINGE_EDITOR_H/row.h);
  _mdfHEditDrag = {
    idx: idx,
    startY: e.clientY,
    startMm: _mdfHEditPos[idx],
    scale: scale,
    h: row.h
  };
  document.addEventListener('mousemove', mdfHingeOnDragMove);
  document.addEventListener('mouseup', mdfHingeOnDragEnd);
}

function mdfHingeOnDragMove(e) {
  if (!_mdfHEditDrag) return;
  var d = _mdfHEditDrag;
  var deltaPx = e.clientY - d.startY;
  var deltaMm = deltaPx / d.scale;
  var newMm = d.startMm + deltaMm;

  // Constraints: не ближе MIN_GAP к краю и соседним петлям
  var minMm = MDF_HINGE_MIN_GAP;
  var maxMm = d.h - MDF_HINGE_MIN_GAP;
  if (d.idx > 0) {
    minMm = Math.max(minMm, _mdfHEditPos[d.idx - 1] + MDF_HINGE_MIN_GAP);
  }
  if (d.idx < _mdfHEditPos.length - 1) {
    maxMm = Math.min(maxMm, _mdfHEditPos[d.idx + 1] - MDF_HINGE_MIN_GAP);
  }
  newMm = Math.max(minMm, Math.min(maxMm, newMm));
  _mdfHEditPos[d.idx] = Math.round(newMm);

  renderMdfHingeEditor();
}

function mdfHingeOnDragEnd() {
  document.removeEventListener('mousemove', mdfHingeOnDragMove);
  document.removeEventListener('mouseup', mdfHingeOnDragEnd);
  _mdfHEditDrag = null;
}

/**
 * Добавить петлю в самый большой зазор.
 */
function mdfHingeAdd() {
  if (_mdfHEditRow < 0) return;
  if (_mdfHEditPos.length >= MDF_HINGE_MAX_COUNT) return;
  var H = mdfRows[_mdfHEditRow].h;
  var bounds = [0].concat(_mdfHEditPos).concat([H]);
  var maxGap = 0, maxStart = 0;
  for (var i = 0; i < bounds.length - 1; i++) {
    var g = bounds[i+1] - bounds[i];
    if (g > maxGap) { maxGap = g; maxStart = bounds[i]; }
  }
  if (maxGap < MDF_HINGE_MIN_GAP * 2) return;
  var newPos = Math.round(maxStart + maxGap / 2);
  _mdfHEditPos.push(newPos);
  _mdfHEditPos.sort(function(a,b){return a-b;});
  renderMdfHingeEditor();
}

/**
 * Удалить петлю с заданным индексом (минимум 2 должно остаться).
 */
function mdfHingeRemove(idx) {
  if (_mdfHEditRow < 0) return;
  if (_mdfHEditPos.length <= 2) return;
  if (idx < 0 || idx >= _mdfHEditPos.length) return;
  _mdfHEditPos.splice(idx, 1);
  renderMdfHingeEditor();
}

/**
 * Сбросить позиции к стандартным (по высоте: 100/H-100, +середина для H>1200).
 * Также удаляет hingePositions из row → авто-расчёт по высоте.
 */
function mdfHingeReset() {
  if (_mdfHEditRow < 0) return;
  var row = mdfRows[_mdfHEditRow];
  _mdfHEditPos = mdfAutoHingePositions(row.h).slice();
  // При закрытии редактора это сохранится; чтобы вернуться к чистому авто, удалим override
  delete mdfRows[_mdfHEditRow].hingePositions;
  renderMdfHingeEditor();
}
