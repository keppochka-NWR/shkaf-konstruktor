// js/fasad-alu.js
// Модуль «Фасады ALU» — рамочные алюминиевые фасады.
// Отвечает за: расчёт стоимости, отрисовку таблицы фасадов, генерацию КП и SVG-чертежа.
//
// Public globals (для inline onclick=""): initFasadModule, addFasadRow, removeFasadRow,
//   fasadRowChange, fasadMountChange, fasadSetProfile, fasadSetDefaultFill,
//   fasadSetDefaultHinge, fasadSetDefaultMount, fasadSetDefaultOpenDir, openFasadKP.
//
// Depends on: utils.js, store.js, router.js, shared-kp.js,
//             data/fillings.js, data/fasad-alu-data.js

// ── Состояние модуля ──────────────────────────────────────────
let fasadRows          = [];         // [{w,h,qty,fillIdx,mountType,openDir,hingeId}]
let fasadProfileId     = 'F1-09';
let fasadDefaultFill   = 0;          // индекс в fasadFills[]
let fasadDefaultHinge  = 'gtv-std';
let fasadDefaultMount  = 'nakl';     // 'nakl'|'polunakl'|'vkladnoy'
let fasadDefaultOpenDir= 'left';     // 'left'|'right'|'up'
let fasadFills         = [];         // заполняется в initFasadModule() из FILLINGS

const MOUNT_LABELS = { nakl:'Накладной', polunakl:'Полунакладной', vkladnoy:'Вкладной' };
const OPEN_LABELS  = { left:'Левое',     right:'Правое',           up:'Вверх' };

// ── Каталоги ──────────────────────────────────────────────────

function fasadHingesForMount(mountType) {
  return FASAD_HINGES.filter(function(h){ return h.types.indexOf(mountType) !== -1; });
}

function initFasadModule() {
  fasadFills = FILLINGS.filter(function(f){ return FASAD_FILL_GROUPS.indexOf(f.g) !== -1; });

  var ps = document.getElementById('fasadProfileSel');
  if (ps) ps.innerHTML = FASAD_PROFILES.map(function(p){
    return '<option value="'+p.id+'"'+(p.id===fasadProfileId?' selected':'')+'>'+p.name+'</option>';
  }).join('');

  var fs = document.getElementById('fasadDefaultFillSel');
  if (fs) fs.innerHTML = fasadFills.map(function(f,i){
    return '<option value="'+i+'"'+(i===fasadDefaultFill?' selected':'')+'>'+f.n+'</option>';
  }).join('');

  var ms = document.getElementById('fasadDefaultMountSel');
  if (ms) ms.value = fasadDefaultMount;

  var od = document.getElementById('fasadDefaultOpenDirSel');
  if (od) od.value = fasadDefaultOpenDir;

  fasadUpdateDefaultHingeList();
  renderFasadTable();
}

function fasadUpdateDefaultHingeList() {
  var hs = document.getElementById('fasadDefaultHingeSel');
  if (!hs) return;
  var avail = fasadHingesForMount(fasadDefaultMount);
  hs.innerHTML = avail.map(function(h){
    return '<option value="'+h.id+'"'+(h.id===fasadDefaultHinge?' selected':'')+'>'+h.name+'</option>';
  }).join('');
  if (!avail.some(function(h){ return h.id===fasadDefaultHinge; })) {
    fasadDefaultHinge = avail[0] ? avail[0].id : '';
    hs.value = fasadDefaultHinge;
  }
}

// ── Расчёт ────────────────────────────────────────────────────

/**
 * Расчёт стоимости одного фасада ALU.
 * @param {number} w  — ширина в мм
 * @param {number} h  — высота в мм
 * @param {number} fillIdx  — индекс в fasadFills[]
 * @param {string} hingeId  — id из FASAD_HINGES
 * @param {string} openDir  — 'left'|'right'|'up'
 * @returns {{profileCost,glassCost,hingeCost,liftCost,gasketCost,total,hingeCount,hasLift,perimM,areaM2}}
 */
function calcOneFasad(w, h, fillIdx, hingeId, openDir) {
  var prof   = FASAD_PROFILES.filter(function(p){ return p.id===fasadProfileId; })[0] || FASAD_PROFILES[0];
  var fill   = fasadFills[fillIdx] || fasadFills[0];
  var hinge  = FASAD_HINGES.filter(function(h2){ return h2.id===hingeId; })[0] || null;
  var perimM = 2*(w+h)/1000;
  var areaM2 = w*h/1e6;
  var profileCost = perimM * prof.pricePerM;
  var glassCost   = areaM2 * (fill ? fill.p : 0);
  var hingeCount  = h <= 1200 ? 2 : 3;
  var hingeCost   = hinge ? hingeCount * hinge.price : 0;
  var liftCost    = (openDir === 'up') ? FASAD_LIFT.price : 0; // 1 комплект
  var gasketCost  = perimM * FASAD_GASKET;
  var total       = profileCost + glassCost + hingeCost + liftCost + gasketCost;
  return { profileCost:profileCost, glassCost:glassCost, hingeCost:hingeCost,
           liftCost:liftCost, gasketCost:gasketCost, total:total,
           hingeCount:hingeCount, hasLift:(openDir==='up'),
           perimM:perimM, areaM2:areaM2 };
}

// ── Рендер таблицы и итогов ───────────────────────────────────

function renderFasadTable() {
  var tbody   = document.getElementById('fasadTbody');
  var empty   = document.getElementById('fasadEmpty');
  var sumCard = document.getElementById('fasadSummaryCard');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!fasadRows.length) {
    if (empty)   empty.style.display   = 'block';
    if (sumCard) sumCard.style.display = 'none';
    return;
  }
  if (empty)   empty.style.display   = 'none';
  if (sumCard) sumCard.style.display = 'block';

  var totProf=0, totGlass=0, totHinge=0, totLift=0, totGasket=0, totAll=0;

  fasadRows.forEach(function(row, i) {
    var c = calcOneFasad(row.w, row.h, row.fillIdx, row.hingeId, row.openDir);
    totProf   += c.profileCost * row.qty;
    totGlass  += c.glassCost   * row.qty;
    totHinge  += c.hingeCost   * row.qty;
    totLift   += c.liftCost    * row.qty;
    totGasket += c.gasketCost  * row.qty;
    // Цена/шт округляется до рубля, строка = цена/шт × кол-во, итог = сумма строк
    var unitR = Math.round(c.total);
    totAll    += unitR * row.qty;

    var fOpts = fasadFills.map(function(f,fi){
      return '<option value="'+fi+'"'+(fi===row.fillIdx?' selected':'')+'>'+f.n+'</option>';
    }).join('');

    var availH = fasadHingesForMount(row.mountType);
    var hOpts  = availH.map(function(h){
      return '<option value="'+h.id+'"'+(h.id===row.hingeId?' selected':'')+'>'+h.name+'</option>';
    }).join('');

    var mountOpts = ['nakl','polunakl','vkladnoy'].map(function(m){
      return '<option value="'+m+'"'+(m===row.mountType?' selected':'')+'>'+MOUNT_LABELS[m]+'</option>';
    }).join('');
    var openOpts  = ['left','right','up'].map(function(d){
      return '<option value="'+d+'"'+(d===row.openDir?' selected':'')+'>'+OPEN_LABELS[d]+'</option>';
    }).join('');

    var hingeInfo = c.hingeCount+' шт'+(c.hasLift ? '+подъём' : '');

    var tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--color-border);';
    tr.innerHTML =
      '<td style="padding:6px 8px;color:var(--color-text-muted);">'+(i+1)+'</td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:80px" type="number" value="'+row.w+'"'+
        ' min="100" step="10" onchange="fasadRowChange('+i+',\'w\',+this.value)"></td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:80px" type="number" value="'+row.h+'"'+
        ' min="100" step="10" onchange="fasadRowChange('+i+',\'h\',+this.value)"></td>'+
      '<td style="padding:3px 6px;"><input class="inp" style="width:58px" type="number" value="'+row.qty+'"'+
        ' min="1" step="1" onchange="fasadRowChange('+i+',\'qty\',+this.value)"></td>'+
      '<td style="padding:3px 6px;"><select class="inp" onchange="fasadMountChange('+i+',this.value)">'+mountOpts+'</select></td>'+
      '<td style="padding:3px 6px;"><select class="inp" onchange="fasadRowChange('+i+',\'openDir\',this.value)">'+openOpts+'</select></td>'+
      '<td style="padding:3px 6px;"><select class="inp" style="max-width:180px;" onchange="fasadRowChange('+i+',\'fillIdx\',+this.value)">'+fOpts+'</select></td>'+
      '<td style="padding:3px 6px;"><select class="inp" style="min-width:130px;" onchange="fasadRowChange('+i+',\'hingeId\',this.value)">'+hOpts+'</select></td>'+
      '<td style="padding:6px 8px;text-align:right;font-size:.78rem;color:var(--color-text-muted);white-space:nowrap;">'+hingeInfo+'</td>'+
      '<td style="padding:6px 8px;text-align:right;">'+fmt(unitR)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;font-weight:700;">'+fmt(unitR*row.qty)+'</td>'+
      '<td style="padding:3px;"><button onclick="removeFasadRow('+i+')"'+
        ' style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:20px;line-height:1;padding:2px 6px;"'+
        ' onmouseenter="this.style.color=\'#e53e3e\'" onmouseleave="this.style.color=\'var(--color-text-muted)\'"'+
        ' title="Удалить строку">×</button></td>';
    tbody.appendChild(tr);
  });

  var totFurn = totHinge + totLift;
  // Статьи округляются так, чтобы их сумма совпадала с ИТОГО
  // (фурнитура — целые рубли, её не трогаем, как и в КП)
  totFurn = Math.round(totFurn);
  var partsR = roundParts([totProf, totGlass, totGasket], totAll - totFurn);
  totProf = partsR[0]; totGlass = partsR[1]; totGasket = partsR[2];
  var sumEl = document.getElementById('fasadSummary');
  if (sumEl) sumEl.innerHTML =
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Профиль</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totProf))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Наполнение</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totGlass))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Фурнитура</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totFurn))+' ₽</div></div>'+
    '<div style="flex:1;min-width:110px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">Уплотнитель</div>'+
      '<div style="font-size:1rem;font-weight:700;">'+fmt(Math.round(totGasket))+' ₽</div></div>'+
    '<div style="flex:1;min-width:150px;border-left:2px solid var(--color-border);padding-left:20px;">'+
      '<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:2px">ИТОГО</div>'+
      '<div style="font-size:1.35rem;font-weight:800;color:var(--color-primary);">'+fmt(Math.round(totAll))+' ₽</div></div>';

  // Сообщить подписчикам (для будущих интеграций)
  if (typeof AppState !== 'undefined') {
    AppState.fasadAlu.rows = fasadRows;
    AppState.fasadAlu.lastTotals = { profile:totProf, glass:totGlass, furniture:totFurn, gasket:totGasket, total:totAll };
  }
  if (typeof EventBus !== 'undefined') EventBus.emit('fasad-alu:changed', { totals: totAll });
}

// ── Управление строками ───────────────────────────────────────

function addFasadRow() {
  fasadRows.push({
    w:600, h:716, qty:1,
    fillIdx:  fasadDefaultFill,
    hingeId:  fasadDefaultHinge,
    mountType:fasadDefaultMount,
    openDir:  fasadDefaultOpenDir
  });
  renderFasadTable();
}

function removeFasadRow(idx) {
  fasadRows.splice(idx,1);
  renderFasadTable();
}

function fasadRowChange(i, field, val) {
  // Пустое/нулевое значение размера или количества не принимаем (иначе строка = 0 ₽)
  if ((field === 'w' || field === 'h' || field === 'qty') && !(val > 0)) { renderFasadTable(); return; }
  if (field === 'qty') val = Math.round(val);
  fasadRows[i][field] = val;
  renderFasadTable();
}

// При смене типа монтажа — обновить доступные петли в строке
function fasadMountChange(i, mountType) {
  fasadRows[i].mountType = mountType;
  var avail = fasadHingesForMount(mountType);
  if (!avail.some(function(h){ return h.id===fasadRows[i].hingeId; })) {
    fasadRows[i].hingeId = avail[0] ? avail[0].id : '';
  }
  renderFasadTable();
}

function fasadSetProfile(id)       { fasadProfileId = id; renderFasadTable(); }
function fasadSetDefaultFill(idx)  { fasadDefaultFill = idx; }
function fasadSetDefaultHinge(id)  { fasadDefaultHinge = id; }
function fasadSetDefaultMount(m)   { fasadDefaultMount = m; fasadUpdateDefaultHingeList(); }
function fasadSetDefaultOpenDir(d) { fasadDefaultOpenDir = d; }

// ── SVG-чертёж фасада ─────────────────────────────────────────

function buildFasadSVG(row, c) {
  var W = row.w, H = row.h;
  var openDir   = row.openDir || 'left';
  var fill      = fasadFills[row.fillIdx] || fasadFills[0];
  var fillName  = fill ? fill.n : '';

  // Масштаб (сохраняем пропорции)
  var scale = Math.min(170/W, 230/H);
  var rW    = Math.round(W * scale);
  var rH    = Math.round(H * scale);

  // Толщина профиля 20 мм в пикселях (мин. 3 для видимости)
  var FRAME_MM = 20;
  var frameTh  = Math.max(3, Math.round(FRAME_MM * scale));

  // Отступы под размерные линии (верх увеличен для open=up — размеры петель сверху)
  var isUpEarly = (openDir === 'up');
  var padLeft   = (openDir === 'right') ? 90 : 70;   // при правом открывании размер H слева — нужен запас под текст
  var padRight  = 70;
  var padTop    = isUpEarly ? 36 : 24;
  var padBottom = 42;
  var offX = padLeft, offY = padTop;
  var svgW = offX + rW + padRight;
  var svgH = offY + rH + padBottom;

  // Позиции петель (px от верха фасада)
  var pos100 = Math.round(100 * scale);
  var hingePositions = [];
  if (c.hingeCount === 2) {
    hingePositions = [pos100, rH - pos100];
  } else {
    hingePositions = [pos100, Math.round(rH/2), rH - pos100];
  }
  var interAxis = H - 200; // межосевое крайних петель (мм)

  var isRight      = (openDir === 'right');
  var isUp         = (openDir === 'up');
  var hingesOnLeft = !isRight && !isUp;

  var lines = '';

  // 1. Внешний прямоугольник (габарит фасада)
  lines += '<rect x="'+offX+'" y="'+offY+'" width="'+rW+'" height="'+rH+'"'+
    ' fill="#dcd4c5" stroke="#333" stroke-width="1.5"/>';

  // 2. Внутренний прямоугольник (наполнение, отступ = толщина профиля)
  var inX = offX + frameTh;
  var inY = offY + frameTh;
  var inW = rW - 2*frameTh;
  var inH = rH - 2*frameTh;
  lines += '<rect x="'+inX+'" y="'+inY+'" width="'+inW+'" height="'+inH+'"'+
    ' fill="#f6f1e7" stroke="#777" stroke-width=".8"/>';

  // 3. Текст наполнения по центру
  var cx = offX + Math.round(rW/2);
  var cy = offY + Math.round(rH/2);
  // Подпись наполнения не шире светового проёма (≈5 px на символ при 9px)
  var maxChars = Math.max(6, Math.min(24, Math.floor((rW - 2*frameTh - 6) / 5)));
  var trimmedName = fillName.length > maxChars ? fillName.substring(0, maxChars-1)+'…' : fillName;
  lines += '<text x="'+cx+'" y="'+cy+'" text-anchor="middle" font-size="9" fill="#777" font-family="Arial">'+
    escapeXml(trimmedName)+'</text>';

  // 4. Петли — НЕ видны (скрыты за профилем),
  //    показываем только тонкую центровую засечку поперёк профиля
  //    + точку оси отверстия (для технологического обозначения)
  if (!isUp) {
    var profileMidX = hingesOnLeft
      ? (offX + Math.round(frameTh/2))
      : (offX + rW - Math.round(frameTh/2));
    var tickHalf = Math.round(frameTh/2) + 1;
    hingePositions.forEach(function(py){
      var hy = offY + py;
      // тонкая центровая засечка через профиль
      lines += '<line x1="'+(profileMidX - tickHalf)+'" y1="'+hy+'"'+
        ' x2="'+(profileMidX + tickHalf)+'" y2="'+hy+'"'+
        ' stroke="#666" stroke-width=".6" stroke-dasharray="2,1.5"/>';
      // точка оси (центр чашки)
      lines += '<circle cx="'+profileMidX+'" cy="'+hy+'" r="1.2" fill="#666"/>';
    });
  } else {
    // Открывание вверх: петли по верхнему профилю, 100мм от боковых краёв
    var topProfileY = offY + Math.round(frameTh/2);
    var pos100x = Math.round(100 * scale);
    var hingePosX = []; // x-позиции петель в px от левого края rect
    if (c.hingeCount === 2) {
      hingePosX = [pos100x, rW - pos100x];
    } else {
      hingePosX = [pos100x, Math.round(rW/2), rW - pos100x];
    }
    var tickHalfTop = Math.round(frameTh/2) + 1;
    hingePosX.forEach(function(px){
      var hx2 = offX + px;
      lines += '<line x1="'+hx2+'" y1="'+(topProfileY - tickHalfTop)+'"'+
        ' x2="'+hx2+'" y2="'+(topProfileY + tickHalfTop)+'"'+
        ' stroke="#666" stroke-width=".6" stroke-dasharray="2,1.5"/>';
      lines += '<circle cx="'+hx2+'" cy="'+topProfileY+'" r="1.2" fill="#666"/>';
    });
    // Подпись "подъёмник"
    var liftLabelY = offY + Math.round(rH/2) + 14;
    lines += '<text x="'+cx+'" y="'+liftLabelY+'" text-anchor="middle" font-size="7" fill="#999" font-family="Arial">+ подъёмник</text>';
  }

  // 5. РАЗМЕРНЫЕ ЛИНИИ
  //    — W: снизу
  //    — H: на стороне БЕЗ петель (дальняя ладдер, 50px)
  //    — 100/межосевое/100: на стороне ПЕТЕЛЬ (ближняя ладдер, 18px)

  // Ширина W
  var dimYBottom = offY + rH + 22;
  lines += dimLineH(offX, dimYBottom, offX+rW, dimYBottom, W+'', cx, dimYBottom+11);

  if (!isUp) {
    // Высота H — на ПРОТИВОПОЛОЖНОЙ стороне от петель (далеко)
    var hX     = hingesOnLeft ? (offX + rW + 50) : (offX - 50);
    var hAnchor= hingesOnLeft ? 'start' : 'end';
    var hTextX = hingesOnLeft ? (hX + 5) : (hX - 5);
    lines += dimLineV(hX, offY, hX, offY+rH, H+'', hTextX, cy, hAnchor);

    // Петельные размеры — на стороне ПЕТЕЛЬ (близко к рамке)
    var pX     = hingesOnLeft ? (offX - 18) : (offX + rW + 18);
    var pAnchor= hingesOnLeft ? 'end' : 'start';
    var pTextX = hingesOnLeft ? (pX - 5) : (pX + 5);

    // 100 от верха
    lines += dimLineV(pX, offY, pX, offY+pos100, '100',
      pTextX, Math.round(offY + pos100/2)+3, pAnchor);

    // Межосевое
    if (hingePositions.length >= 2) {
      var yA = offY + hingePositions[0];
      var yB = offY + hingePositions[hingePositions.length-1];
      lines += dimLineV(pX, yA, pX, yB, interAxis+'',
        pTextX, Math.round((yA+yB)/2)+3, pAnchor);
    }

    // 100 от низа
    lines += dimLineV(pX, offY+rH-pos100, pX, offY+rH, '100',
      pTextX, Math.round(offY + rH - pos100/2)+3, pAnchor);
  } else {
    // Open=up: H справа (общий габарит)
    var hX2 = offX + rW + 18;
    lines += dimLineV(hX2, offY, hX2, offY+rH, H+'', hX2+5, cy, 'start');

    // Горизонтальные размеры для верхних петель — над фасадом
    var pos100xUp = Math.round(100 * scale);
    var hingeXsUp = (c.hingeCount === 2)
      ? [pos100xUp, rW - pos100xUp]
      : [pos100xUp, Math.round(rW/2), rW - pos100xUp];
    var dimYtopRow = offY - 12;       // ближняя ладдер с размерами петель
    // 100 от левого края
    lines += dimLineH(offX, dimYtopRow, offX + hingeXsUp[0], dimYtopRow,
      '100', Math.round(offX + hingeXsUp[0]/2), dimYtopRow - 3);
    // Межосевое (между крайними)
    var interAxisX = W - 200;
    if (hingeXsUp.length >= 2) {
      var xA = offX + hingeXsUp[0];
      var xB = offX + hingeXsUp[hingeXsUp.length-1];
      lines += dimLineH(xA, dimYtopRow, xB, dimYtopRow,
        interAxisX+'', Math.round((xA+xB)/2), dimYtopRow - 3);
    }
    // 100 от правого края
    var lastXUp = offX + hingeXsUp[hingeXsUp.length-1];
    lines += dimLineH(lastXUp, dimYtopRow, offX + rW, dimYtopRow,
      '100', Math.round((lastXUp + offX + rW)/2), dimYtopRow - 3);
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" style="font-family:Arial,sans-serif;">'+lines+'</svg>';
}

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Вертикальная размерная линия (с засечками-стрелками)
function dimLineV(x1,y1,x2,y2,label,tx,ty,anchor) {
  return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#666" stroke-width=".7"/>'+
    '<line x1="'+(x1-3)+'" y1="'+(y1+1)+'" x2="'+(x1+3)+'" y2="'+(y1-1)+'" stroke="#666" stroke-width=".9"/>'+
    '<line x1="'+(x2-3)+'" y1="'+(y2+1)+'" x2="'+(x2+3)+'" y2="'+(y2-1)+'" stroke="#666" stroke-width=".9"/>'+
    '<text x="'+tx+'" y="'+ty+'" text-anchor="'+(anchor||'middle')+'" font-size="7.5" fill="#333">'+label+'</text>';
}

// Горизонтальная размерная линия
function dimLineH(x1,y1,x2,y2,label,tx,ty) {
  return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#666" stroke-width=".7"/>'+
    '<line x1="'+(x1-1)+'" y1="'+(y1-3)+'" x2="'+(x1+1)+'" y2="'+(y1+3)+'" stroke="#666" stroke-width=".9"/>'+
    '<line x1="'+(x2-1)+'" y1="'+(y2-3)+'" x2="'+(x2+1)+'" y2="'+(y2+3)+'" stroke="#666" stroke-width=".9"/>'+
    '<text x="'+tx+'" y="'+ty+'" text-anchor="middle" font-size="7.5" fill="#333">'+label+'</text>';
}

// ── КП фасадов ────────────────────────────────────────────────

function buildFasadKPHTML(client, phone, manager) {
  var now     = new Date();
  var dateStr = now.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
  var kpNum   = 'КП-АЛ-' + now.getFullYear() +
    String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' +
    String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');

  var prof = FASAD_PROFILES.filter(function(p){ return p.id===fasadProfileId; })[0] || FASAD_PROFILES[0];

  var rowsHTML = '', svgPages = '';
  var grand=0, totalProf=0, totalGlass=0, totalHinge=0, totalLift=0, totalGasket=0;
  var totalArea=0, totalPerim=0;
  // Смета по петлям: { hingeId+mountType → {name,count,unitSell,total,sortKey} }
  var hingeSmeta = {};

  fasadRows.forEach(function(row, i) {
    var c     = calcOneFasad(row.w, row.h, row.fillIdx, row.hingeId, row.openDir);
    var fill  = fasadFills[row.fillIdx] || fasadFills[0];
    var hinge = FASAD_HINGES.filter(function(h){ return h.id===row.hingeId; })[0] || null;
    // Как на экране: цена/шт до рубля, строка = цена/шт × кол-во, итог = сумма строк
    var lineT = Math.round(c.total) * row.qty;
    grand       += lineT;
    totalProf   += c.profileCost * row.qty;
    totalGlass  += c.glassCost   * row.qty;
    totalHinge  += Math.round(c.hingeCost   * row.qty);
    totalLift   += Math.round(c.liftCost    * row.qty);
    totalGasket += c.gasketCost  * row.qty;
    totalArea   += c.areaM2 * row.qty;
    totalPerim  += c.perimM * row.qty;

    // Смета петель — отдельный учёт по типу монтажа
    if (hinge) {
      var hKey = hinge.id + '_' + row.mountType;
      var mountLbl = (MOUNT_LABELS[row.mountType] || '').toLowerCase();
      if (!hingeSmeta[hKey]) hingeSmeta[hKey] = {
        name: hinge.name + ' · ' + mountLbl,
        count: 0,
        unitSell: Math.round(hinge.price),
        total: 0,
        sortKey: row.mountType + '|' + hinge.id
      };
      hingeSmeta[hKey].count += c.hingeCount * row.qty;
      hingeSmeta[hKey].total += Math.round(c.hingeCost * row.qty);
    }
    if (c.hasLift) {
      var lKey = 'lift';
      if (!hingeSmeta[lKey]) hingeSmeta[lKey] = {
        name: FASAD_LIFT.name,
        count: 0,
        unitSell: Math.round(FASAD_LIFT.price),
        total: 0,
        sortKey: 'z'
      };
      hingeSmeta[lKey].count += row.qty;
      hingeSmeta[lKey].total += Math.round(c.liftCost * row.qty);
    }

    var openLabel  = OPEN_LABELS[row.openDir]  || row.openDir;
    var mountLabel = MOUNT_LABELS[row.mountType]|| row.mountType;
    rowsHTML +=
      '<tr>'+
        '<td>'+(i+1)+'</td>'+
        '<td>Фасад рам. '+prof.name+', '+row.w+'×'+row.h+' мм<br>'+
          '<span style="color:#999;font-size:8pt">'+fill.n+' · '+mountLabel+' · откр.: '+openLabel+
          (hinge?' · '+hinge.name+' '+c.hingeCount+' шт':'')+
          (c.hasLift?' · '+FASAD_LIFT.name:'')+
          '</span></td>'+
        '<td class="r">'+row.w+' × '+row.h+'</td>'+
        '<td class="r">'+row.qty+' шт</td>'+
        '<td class="r">'+fmt(Math.round(c.total))+'</td>'+
        '<td class="r" style="font-weight:600">'+fmt(lineT)+'</td>'+
      '</tr>';

    // SVG чертёж для каждой позиции
    var svg = buildFasadSVG(row, c);
    svgPages +=
      '<div style="page-break-inside:avoid;margin-bottom:8mm;padding:4mm 0;border-bottom:1px solid #eee;">'+
        '<div style="font-size:9pt;font-weight:700;color:#01696f;margin-bottom:3mm">'+
          '№'+(i+1)+' — '+row.w+'×'+row.h+' мм · '+fill.n+' · '+mountLabel+' · откр.: '+openLabel+
        '</div>'+
        svg+
      '</div>';
  });

  // Смета по петлям HTML — сортировка: nakl → polunakl → vkladnoy → подъёмник
  var hmKeys = Object.keys(hingeSmeta).sort(function(a,b){
    var sa = hingeSmeta[a].sortKey || '', sb = hingeSmeta[b].sortKey || '';
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  var hingeTable = '';
  if (hmKeys.length) {
    var hmRows = hmKeys.map(function(k){
      var s = hingeSmeta[k];
      return '<tr><td>'+s.name+'</td><td class="r">'+s.count+' шт</td>'+
        '<td class="r">'+fmt(s.unitSell)+'</td><td class="r" style="font-weight:600">'+fmt(s.total)+'</td></tr>';
    }).join('');
    hingeTable =
      '<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin:6mm 0 3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">'+
      'Смета фурнитуры</div>'+
      '<table class="kp-table"><thead><tr><th>Наименование</th>'+
        '<th class="r">Кол-во</th><th class="r">Цена, ₽</th><th class="r">Сумма, ₽</th></tr></thead>'+
      '<tbody>'+hmRows+
        '<tr class="kp-total-row"><td colspan="3">Итого фурнитура</td>'+
          '<td class="r">'+fmt(totalHinge+totalLift)+'</td></tr>'+
      '</tbody></table>';
  }

  // Разбивка по статьям
  var totalFurn = totalHinge + totalLift;
  // Статьи (кроме фурнитуры — она целая и совпадает со сметой) округляются под итог
  var brR = roundParts([totalProf, totalGlass, totalGasket], grand - totalFurn);
  totalProf = brR[0]; totalGlass = brR[1]; totalGasket = brR[2];
  var breakHTML =
    '<tr><td colspan="5">Профиль '+prof.name+
      '<br><span style="color:#999;font-size:8pt">'+totalPerim.toFixed(2)+' п.м.</span></td>'+
      '<td class="r">'+fmt(totalProf)+'</td></tr>'+
    '<tr><td colspan="5">Наполнение'+
      '<br><span style="color:#999;font-size:8pt">'+totalArea.toFixed(2)+' м²</span></td>'+
      '<td class="r">'+fmt(totalGlass)+'</td></tr>'+
    '<tr><td colspan="5">Фурнитура (петли + подъёмники)</td>'+
      '<td class="r">'+fmt(totalFurn)+'</td></tr>'+
    '<tr><td colspan="5">Уплотнитель'+
      '<br><span style="color:#999;font-size:8pt">'+totalPerim.toFixed(2)+' п.м. × '+FASAD_GASKET+' ₽/м</span></td>'+
      '<td class="r">'+fmt(totalGasket)+'</td></tr>';

  var grandRow =
    '<tr class="kp-total-row"><td colspan="5">ИТОГО К ОПЛАТЕ</td>'+
      '<td class="r" style="font-size:11pt;font-weight:700;">'+fmt(grand)+' ₽</td></tr>';

  var HDR = '<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">';

  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;padding-bottom:6mm;border-bottom:2px solid #01696f">'+
    '<div><div style="font-size:15pt;font-weight:700;color:#01696f;margin-bottom:2px">Фасады в алюминиевой рамке</div>'+
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

    hingeTable+

    '<div style="margin-top:6mm">'+HDR+'Разбивка по статьям</div>'+
    '<table class="kp-table"><thead><tr>'+
    '<th colspan="5">Статья затрат</th><th class="r" style="width:96px">Сумма, ₽</th>'+
    '</tr></thead><tbody>'+breakHTML+grandRow+'</tbody></table>'+

    '<div style="background:#f8faf9;border:1.5px solid #cedcd8;border-radius:6px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;margin-top:6mm">'+
    '<div style="font-size:11pt;font-weight:700">ИТОГО К ОПЛАТЕ:</div>'+
    '<div style="font-size:18pt;font-weight:700;color:#01696f">'+fmt(grand)+' ₽</div></div>'+

    '<div style="margin-top:10mm;font-size:8.5pt;color:#aaa;border-top:1px solid #eee;padding-top:4mm;line-height:1.6">'+
    'Данное КП действительно 14 дней. Цены указаны с учётом всех комплектующих. Срок изготовления уточняется при заказе.<br>'+
    'Настоящее КП не является публичной офертой.</div>'+

    '<div style="display:flex;justify-content:space-between;margin-top:12mm">'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись менеджера</div>'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись клиента</div>'+
    '<div style="border-top:1px solid #ccc;padding-top:3px;width:120px;font-size:8pt;color:#999;text-align:center">МП</div>'+
    '</div>'+

    // Чертежи — новая страница
    '<div style="page-break-before:always;padding-top:6mm;">'+
    HDR+'Чертежи фасадов</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:12mm;">'+svgPages+'</div>'+
    '</div>';
}

function openFasadKP() {
  if (!fasadRows.length) {
    alert('Добавьте хотя бы один фасад перед формированием КП.');
    return;
  }
  // Берём client/phone/manager из полей купе (если они заполнены)
  // Поля клиента — свои в блоке итогов; если пусто — берём из купе (если там заполнено)
  function kpField(own, kupe) {
    var v = ((document.getElementById(own) || {}).value || '').trim();
    return v || ((document.getElementById(kupe) || {}).value || '').trim();
  }
  var client  = kpField('aluKpClient',  'kpClient');
  var phone   = kpField('aluKpPhone',   'kpPhone');
  var manager = kpField('aluKpManager', 'kpManager');
  var html = buildFasadKPHTML(client, phone, manager);
  // Используем общий хелпер из shared-kp.js, fallback на ручную манипуляцию модалкой
  if (typeof displayKPDocument === 'function') {
    displayKPDocument(html, 'fasad-alu');
  } else {
    var el = document.getElementById('kpPageContent');
    if (el) el.innerHTML = html;
    var modal = document.getElementById('kpDocument');
    if (modal) { modal.classList.add('kp-open'); document.body.style.overflow = 'hidden'; }
  }
}

// ── Регистрация в роутере для lazy-init ───────────────────────
if (typeof ROUTER !== 'undefined' && ROUTER.registerInit) {
  ROUTER.registerInit('fasad-alu', initFasadModule);
}
