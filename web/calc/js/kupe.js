// js/kupe.js
// Модуль «Двери-купе» (Аристо-системы): расчёт стоимости, визуализация, КП.
//
// Public globals (для inline onclick=""): много — calculate, recalculate, updateDisplay,
//   resetCalc, openKP, и т.д. (нужно постепенно мигрировать в KupeModule namespace).
//
// Depends on: utils.js, store.js, router.js, shared-kp.js,
//             data/fillings.js, data/profiles.js
//
// TODO (post-refactor):
//   - обернуть все функции в KupeModule = {...}
//   - заменить window._lastCalcData на AppState.kupe.lastCalcData
//   - заменить onclick="calculate()" на addEventListener в init()
/* KUPE MODULE — global scope */

/* ============================================================
   CONFIG — DATA
   ============================================================ */

// FILLINGS вынесен в data/fillings.js

// PROFILE_SYSTEMS, SECTION_OPTS, FILM_*, SOFT_CLOSE_PRICE и т.д. вынесены в data/profiles.js

// FASAD_PROFILES, FASAD_HINGES, FASAD_LIFT и т.д. вынесены в data/fasad-alu-data.js

/**
 * getAutoFilm(fill) — определяет тип плёнки по материалу наполнения.
 * Оракал-плёнки: плёнка не нужна (null).
 * Зеркало / лакобель / ЛДСП / непрозрачные: армировочная.
 * Стекло прозрачное / тонированное / сатин / узорчатые: противоосколочная SF.
 */
function getAutoFilm(fill) {
  if (!fill) return null;
  const g = fill.g || '';
  const n = fill.n || '';
  const mat = fill.mat || '';
  // Оракал и плёнки — исключение, своя плёнка не нужна
  if (g === 'Плёнки') return null;
  // Зеркала — армировочная
  if (mat.includes('mirror') || g === 'Зеркала') return FILM_ARMOR;
  // Лакобель и ЛДСП — армировочная
  if (g === 'Лакобель' || g === 'ЛДСП') return FILM_ARMOR;
  // Стекло прозрачное, тонированное, сатин, узорчатые — противоосколочная
  if (g === 'Стекло' || g === 'Узорчатые (склад)' || g === 'Узорчатые (заказные)') return FILM_SAFETY;
  // По умолчанию — армировочная
  return FILM_ARMOR;
}

/* ============================================================
   STATE
   ============================================================ */
let sectH   = 0;
let sectV   = 0;
let sectOpt = SECTION_OPTS[0];   // текущий пресет (полный объект)
let doorFills    = [];            // doorFills[doorIdx][sectIdx] = FILLINGS[n]
let activeSection = null;         // { doorIdx, sectIdx } | null — выделенная секция
let rowMm        = [];            // высоты секций в мм (sum === H)
let colMm        = [];            // ширины колонок в мм (sum === dw)
let _dragDiv     = null;          // состояние drag-разделителя: { doorIdx, divIdx, startY, startRowMm }
let doorRowMm    = [];            // doorRowMm[doorIdx][] — высоты секций для каждой двери
let activeDoorEdit = 0;           // какая дверь активна (чья линейка в viz, чьи значения в сайдбаре)

// ALU state вынесено в js/fasad-alu.js

// HELPERS ($, num, fmt, pluralDoors, debounce) вынесены в js/utils.js

/* ============================================================
   LIVE UPDATE — автопересчёт при изменении параметров
   ============================================================ */

// updateDisplay: если результаты уже показаны → пересчёт, иначе → только визуализация
function updateDisplay() {
  // Поле размера стёрто (менеджер вводит новое число) — не пересчитываем и не показываем alert
  if (!num('width') || !num('height')) return;
  if (window._lastCalcData) recalculate();
  else rerenderVisualization();
}

// recalculate: полный пересчёт с сохранением полей КП
function recalculate() {
  if (!window._lastCalcData) return;
  // Сохранить поля КП — они пересоздаются при перерисовке результатов
  const kp = {
    client:   ($('kpClient')   || {}).value   || '',
    phone:    ($('kpPhone')    || {}).value    || '',
    manager:  ($('kpManager')  || {}).value    || '',
    delivery: ($('kpDelivery') || {}).value    || '0',
    install:  ($('kpInstall')  || {}).checked  || false,
  };
  calculate();
  // Восстановить поля КП
  if ($('kpClient'))   $('kpClient').value    = kp.client;
  if ($('kpPhone'))    $('kpPhone').value     = kp.phone;
  if ($('kpManager'))  $('kpManager').value   = kp.manager;
  if ($('kpDelivery')) { $('kpDelivery').value = kp.delivery; updateKPPreview(); }
  if ($('kpInstall'))  $('kpInstall').checked  = kp.install;
  // Анимация обновления цены
  const rhv = document.querySelector('.rh-value');
  if (rhv) { rhv.classList.remove('rh-value-live'); void rhv.offsetWidth; rhv.classList.add('rh-value-live'); }
}

/* ============================================================
   INIT
   ============================================================ */
(function init() {
  populateProfiles();
  buildSectionBtns();
  setSections(0);
  initTheme();
  // Phase 5 — 3-col редизайн
  if (typeof setupDoorCountChips === 'function') setupDoorCountChips();
  if (typeof initKupeVersion === 'function')     initKupeVersion();
  if (typeof updateChipsActive === 'function')   updateChipsActive(2);
  // Живой пересчёт — подписываемся на все изменения параметров
  const debouncedUpdate = debounce(updateDisplay, 350);
  $('width').addEventListener('input', debouncedUpdate);
  $('height').addEventListener('input', () => {
    rowMm = []; // сбросить mm при смене высоты чтобы пересчитались
    buildDividersBlock();
    debouncedUpdate();
  });
  $('softClose').addEventListener('change', updateDisplay);
  $('singlePartition').addEventListener('change', updateDisplay);
  $('filmToggle').addEventListener('change', updateDisplay);
})();

/* ============================================================
   SECTION EDITOR — новые функции управления наполнением
   ============================================================ */

function initDoorFills(N, sectCount) {
  doorFills = Array.from({length: N}, (_, di) => {
    const existing = doorFills[di] || [];
    return Array.from({length: sectCount}, (_, si) =>
      existing[si] || existing[existing.length - 1] || FILLINGS[0]
    );
  });
}

function initRowMm(H, rows, ratios) {
  if (rowMm.length === rows) return;
  if (ratios && ratios.length === rows) {
    // Инициализировать из пропорций пресета
    rowMm = ratios.map(r => Math.round(r * H));
    const sum = rowMm.reduce((a, b) => a + b, 0);
    rowMm[rows - 1] += H - sum; // компенсация округления
  } else {
    const base = Math.floor(H / rows);
    rowMm = Array.from({length: rows}, (_, i) =>
      i < rows - 1 ? base : H - base * (rows - 1)
    );
  }
}

function getDoorRowMm(doorIdx, H_val) {
  const H = H_val || num('height', 2000);
  const rows = sectOpt.rowRatios.length;
  if (doorRowMm[doorIdx] && doorRowMm[doorIdx].length === rows) return doorRowMm[doorIdx];
  // Инициализировать из глобального rowMm или равномерно
  initRowMm(H, rows, sectOpt.rowRatios);
  doorRowMm[doorIdx] = rowMm.slice();
  return doorRowMm[doorIdx];
}

function buildDividersBlock() {
  const block = $('dividersBlock');
  if (!block) return;
  block.innerHTML = '';
  const H = num('height', 2000);
  const rows = sectOpt.rowRatios.length;
  if (rows <= 1) { block.style.display = 'none'; return; }
  block.style.display = 'flex';
  const activeRm = getDoorRowMm(activeDoorEdit, H);
  rowMm = activeRm.slice();
  let cumMm = 0;
  for (let i = 0; i < rows - 1; i++) {
    cumMm += activeRm[i];
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML =
      '<label class="lbl">Разделитель ' + (i + 1) + ' · Дв.' + (activeDoorEdit + 1) +
      ' <span class="lbl-hint">мм от верха</span></label>' +
      '<input class="inp" id="divH_' + i + '" type="number" value="' + cumMm + '" min="100" max="' + (H - 100) + '" step="10">';
    field.querySelector('input').onchange = () => onDividerChange();
    block.appendChild(field);
  }
}

function onDividerChange() {
  const H = num('height', 2000);
  const rows = sectOpt.rowRatios.length;
  const positions = [];
  for (let i = 0; i < rows - 1; i++) {
    positions.push(+(document.getElementById('divH_' + i).value) || 0);
  }
  const newRm = positions.map((pos, i) => pos - (positions[i - 1] || 0));
  newRm.push(H - positions[positions.length - 1]);
  rowMm = newRm;
  doorRowMm[activeDoorEdit] = newRm.slice();
  sectOpt = Object.assign({}, sectOpt, { rowRatios: rowMm.map(v => v / H) });
  updateDisplay(); // разделитель меняет площадь секций → меняет цену
}

function updateDividerInputs() {
  let cumMm = 0;
  for (let i = 0; i < rowMm.length - 1; i++) {
    cumMm += rowMm[i];
    const inp = document.getElementById('divH_' + i);
    if (inp) inp.value = Math.round(cumMm);
  }
}

function startDividerDrag(e) {
  e.preventDefault();
  e.stopPropagation();
  const doorIdx = +e.currentTarget.dataset.doorIdx;
  const divIdx  = +e.currentTarget.dataset.divIdx;
  const H = num('height', 2000);
  activeDoorEdit = doorIdx;
  const startRM = getDoorRowMm(doorIdx, H).slice();
  _dragDiv = { doorIdx, divIdx, startY: e.clientY, startRowMm: startRM };
  document.addEventListener('mousemove', onDividerDragMove);
  document.addEventListener('mouseup',   onDividerDragEnd);
}

function onDividerDragMove(e) {
  if (!_dragDiv) return;
  const pxPerMm = window._vizPxPerMm || 0.15;
  const deltaMm = Math.round((e.clientY - _dragDiv.startY) / pxPerMm);
  const { doorIdx, divIdx, startRowMm } = _dragDiv;
  const minMm = 80;
  const totalAB = startRowMm[divIdx] + startRowMm[divIdx + 1];
  let newA = Math.max(minMm, startRowMm[divIdx] + deltaMm);
  let newB = Math.max(minMm, startRowMm[divIdx + 1] - deltaMm);
  if (newA + newB !== totalAB) newA = totalAB - newB;
  const newRm = startRowMm.slice();
  newRm[divIdx] = newA;
  newRm[divIdx + 1] = newB;
  doorRowMm[doorIdx] = newRm;
  rowMm = newRm;
  const H = num('height', 2000);
  sectOpt = Object.assign({}, sectOpt, { rowRatios: rowMm.map(v => v / H) });
  updateDividerInputs();
  rerenderVisualization();
}

function onDividerDragEnd() {
  if (!_dragDiv) return;
  _dragDiv = null;
  document.removeEventListener('mousemove', onDividerDragMove);
  document.removeEventListener('mouseup',   onDividerDragEnd);
  updateDisplay();
}

function startRulerEdit(labelDiv) {
  if (labelDiv.querySelector('input')) return; // уже редактируется
  const H     = num('height', 2000);
  const dIdx  = +labelDiv.dataset.doorIdx;
  const sIdx  = +labelDiv.dataset.sectIdx;
  const curMm = +labelDiv.dataset.mm;
  const rows  = sectOpt.rowRatios.length;

  const inp = document.createElement('input');
  inp.type = 'number'; inp.value = curMm; inp.min = 80; inp.step = 10;
  inp.style.cssText =
    'width:50px;font-size:10px;font-weight:600;border:none;outline:none;' +
    'background:transparent;color:rgba(1,105,111,1);font-family:inherit;text-align:center;';
  labelDiv.textContent = '';
  labelDiv.appendChild(inp);
  labelDiv.style.background = 'rgba(255,255,255,.98)';
  labelDiv.style.borderColor = 'rgba(1,105,111,.6)';
  inp.focus(); inp.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    const newMm = Math.max(80, +inp.value || curMm);
    const rm = getDoorRowMm(dIdx, H).slice();
    if (newMm === rm[sIdx]) { rerenderVisualization(); return; }
    const delta = newMm - rm[sIdx];
    // Взять из соседней секции (сначала снизу, потом сверху)
    const adj = sIdx < rows - 1 ? sIdx + 1 : sIdx - 1;
    if (rm[adj] - delta < 80) {
      const maxD = rm[adj] - 80;
      rm[sIdx] += maxD; rm[adj] = 80;
    } else {
      rm[sIdx] = newMm; rm[adj] -= delta;
    }
    doorRowMm[dIdx] = rm;
    activeDoorEdit  = dIdx;
    rowMm = rm.slice();
    sectOpt = Object.assign({}, sectOpt, { rowRatios: rowMm.map(v => v / H) });
    buildDividersBlock();
    updateDisplay();
  }
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  inp.blur();
    if (ev.key === 'Escape') { committed = true; rerenderVisualization(); }
  });
  inp.addEventListener('blur', commit);
}

function openSectionEditor(doorIdx, sectIdx) {
  activeDoorEdit = doorIdx;
  activeSection = { doorIdx, sectIdx };
  $('panelForm').classList.add('section-edit-mode');
  const cols = sectOpt.colRatios.length;
  const rows = sectOpt.rowRatios.length;
  let title = 'Дверь ' + (doorIdx + 1);
  if (rows > 1 || cols > 1) title += ' · Секция ' + (sectIdx + 1);
  $('sectionEditorTitle').textContent = title;
  buildSectionMaterialList(doorIdx, sectIdx);
  buildDividersBlock();
  updateFilmRow();
  rerenderVisualization();
}

function closeSectionEditor() {
  activeSection = null;
  $('panelForm').classList.remove('section-edit-mode');
  rerenderVisualization();
}

function buildSectionMaterialList(doorIdx, sectIdx) {
  const container = $('sectionMaterialList');
  if (!container) return;
  container.innerHTML = '';
  const current = (doorFills[doorIdx] || [])[sectIdx] || FILLINGS[0];
  let currentGroup = '';
  FILLINGS.forEach((f, fi) => {
    if (f.g !== currentGroup) {
      const grp = document.createElement('div');
      grp.className = 'mat-group-lbl';
      grp.textContent = f.g;
      container.appendChild(grp);
      currentGroup = f.g;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mat-btn' + (f === current ? ' active' : '');
    btn.onclick = () => setSectionFill(doorIdx, sectIdx, fi);
    btn.textContent = f.n + ' — ' + fmt(f.p) + ' ₽/м²';
    container.appendChild(btn);
  });
}

function setSectionFill(doorIdx, sectIdx, fillIdx) {
  if (!doorFills[doorIdx]) return;
  doorFills[doorIdx][sectIdx] = FILLINGS[fillIdx];
  buildSectionMaterialList(doorIdx, sectIdx);
  updateFilmRow();
  updateDisplay(); // пересчитать цену если результаты уже показаны
}

function applyToAllDoors() {
  if (!activeSection) return;
  const fill = (doorFills[activeSection.doorIdx] || [])[activeSection.sectIdx] || FILLINGS[0];
  // Все двери — как выбранная: та же раскладка наполнения по секциям; у двери с другим числом секций — только эта секция.
  const src = doorFills[activeSection.doorIdx] || [];
  doorFills.forEach((df, i) => {
    if (!df) return;
    if (df.length === src.length) doorFills[i] = src.slice();
    else if (activeSection.sectIdx < df.length) df[activeSection.sectIdx] = fill;
  });
  buildSectionMaterialList(activeSection.doorIdx, activeSection.sectIdx);
  updateFilmRow();
  updateDisplay();
}

function applyToAllSections() {
  if (!activeSection) return;
  const fill = (doorFills[activeSection.doorIdx] || [])[activeSection.sectIdx] || FILLINGS[0];
  if (doorFills[activeSection.doorIdx]) {
    doorFills[activeSection.doorIdx] = doorFills[activeSection.doorIdx].map(() => fill);
  }
  buildSectionMaterialList(activeSection.doorIdx, activeSection.sectIdx);
  updateDisplay();
}

function updateFilmRow() {
  const allFills = [].concat(...doorFills);
  const films = allFills.map(f => f && getAutoFilm(f)).filter(Boolean);
  const filmCard = $('filmCard');
  const filmDesc = $('filmDesc');
  const filmToggle = $('filmToggle');
  if (films.length === 0) {
    if (filmCard) filmCard.style.display = 'none';
    if (filmToggle) filmToggle.checked = false;
    return;
  }
  if (filmCard) filmCard.style.display = '';
  const allSame = films.every(f => f.name === films[0].name);
  if (filmDesc) filmDesc.textContent = allSame
    ? films[0].name + ' · ' + fmt(films[0].p) + ' ₽/м²'
    : 'Зависит от материала (армировочная / противоосколочная)';
}

function rerenderVisualization() {
  const ld = window._lastCalcData;
  if (!ld || !$('vizRoom')) return;
  renderRoom('vizRoom', ld.W, ld.H, ld.N, ld.bd, ld.isSinglePartition,
    doorFills, ld.frameGrad, ld.dims, sectOpt);
}

function populateProfiles() {
  const sel = $('profileSystem');
  PROFILE_SYSTEMS.forEach((s, i) => {
    if (s.system === 'Свои цены') return;   // служебная система с условными ценами — не показываем клиенту
    const op = document.createElement('option');
    op.value = i;
    op.textContent = s.system;
    sel.appendChild(op);
  });
  // Populate colors for first system
  populateProfileColors(0);
}

function populateProfileColors(sysIdx) {
  const sel = $('profileColor');
  sel.innerHTML = '';
  PROFILE_SYSTEMS[sysIdx].colors.forEach((c, i) => {
    const op = document.createElement('option');
    op.value = i;
    op.textContent = c.name;
    sel.appendChild(op);
  });
}

function onProfileSystemChange() {
  const sysIdx = num('profileSystem', 0);
  populateProfileColors(sysIdx);
  updateDisplay(); // смена системы профиля → новые цены
}

function onProfileColorChange() {
  updateDisplay(); // смена цвета профиля → новые frameGrad + цены
}

function getCurrentProfile() {
  const sysIdx = num('profileSystem', 0);
  const colIdx = num('profileColor', 0);
  return PROFILE_SYSTEMS[sysIdx].colors[colIdx];
}

function initTheme() {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  // Всегда стартуем в светлой теме: тёмная в купе доделана не полностью (колонки остаются светлыми)
  let theme = 'light';
  root.setAttribute('data-theme', theme);
  setThemeIcon(btn, theme);
  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    setThemeIcon(btn, theme);
  });
}

function setThemeIcon(btn, theme) {
  btn.innerHTML = theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

/* ============================================================
   UI HELPERS
   ============================================================ */





function buildSectionBtns() {
  const grid = $('sectionsGrid');
  grid.innerHTML = '';
  SECTION_OPTS.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sect-btn';
    btn.dataset.idx = idx;
    btn.innerHTML =
      '<svg width="22" height="15" viewBox="0 0 22 15" fill="none" stroke="currentColor" stroke-width="1.6">' +
      getSectSvg(opt.rowRatios, opt.colRatios) + '</svg>' +
      '<span>' + opt.label + '</span>';
    btn.onclick = () => setSections(idx);
    grid.appendChild(btn);
  });
}

/* SVG иконка секций — позиции линий по пропорциям ratios */
function getSectSvg(rowRatios, colRatios) {
  let s = '<rect x="0.8" y="0.8" width="20.4" height="13.4" rx="1.5"/>';
  let cumY = 0;
  for (let i = 0; i < rowRatios.length - 1; i++) {
    cumY += rowRatios[i];
    const y = (0.8 + cumY * 13.4).toFixed(1);
    s += '<line x1="0.8" y1="' + y + '" x2="21.2" y2="' + y + '"/>';
  }
  let cumX = 0;
  for (let i = 0; i < colRatios.length - 1; i++) {
    cumX += colRatios[i];
    const x = (0.8 + cumX * 20.4).toFixed(1);
    s += '<line x1="' + x + '" y1="0.8" x2="' + x + '" y2="14.2"/>';
  }
  return s;
}

function setSections(optIdx) {
  sectOpt = SECTION_OPTS[optIdx];
  sectH = sectOpt.h;
  sectV = sectOpt.v;
  document.querySelectorAll('.sect-btn').forEach(b =>
    b.classList.toggle('active', +b.dataset.idx === optIdx)
  );
  // Инициализировать doorFills под новое количество секций
  const newCount = sectOpt.rowRatios.length * sectOpt.colRatios.length;
  const N = num('doorCount', 2);
  initDoorFills(N, newCount);
  // Сбросить rowMm при смене пресета чтобы пересчитались равномерно
  rowMm = [];
  doorRowMm = [];
  activeDoorEdit = 0;
  buildDividersBlock();
  // Сложная сборка
  const cr = $('complexRow');
  if (newCount >= COMPLEX_SECTIONS_THRESHOLD) {
    cr.style.display = 'flex';
    $('complexWork').checked = true;
    $('complexDesc').textContent =
      '+' + fmt(COMPLEX_WORK_PRICE) + ' ₽ за дверь (' + newCount + ' вставок, ≥ ' + COMPLEX_SECTIONS_THRESHOLD + ')';
  } else {
    cr.style.display = 'none';
  }
  updateDisplay();
}

function onDoorCountChange() {
  const n = num('doorCount', 2);
  const row = $('singlePartRow');
  row.style.display = n === 2 ? '' : 'none';
  if (n !== 2) $('singlePartition').checked = false;
  // Reinit doorFills для нового количества дверей
  const sectCount = sectOpt.rowRatios.length * sectOpt.colRatios.length;
  initDoorFills(n, sectCount);
  updateDisplay();
}



/* ============================================================
   PROFILE PRICE GRID
   ============================================================ */

/* ============================================================
   BUSINESS LOGIC — getAdjustedPrices()
   Возвращает цены профиля (₽/пог.м.)
   ============================================================ */
function getAdjustedPrices() {
  const p = getCurrentProfile();
  return {
    ruchka:      p.ruchka,
    verh:        p.verh,
    niz:         p.niz,
    razd:        p.razd,
    napravl_top: p.napravl_top,
    napravl_bot: p.napravl_bot,
  };
}

/* ============================================================
   BUSINESS LOGIC — calculate()
   Формула строго по ТЗ, расширена под napravl_top / napravl_bot
   ============================================================ */
function calculate() {
  const W = num('width');
  const H = num('height');
  const N = num('doorCount', 2);
  if (!W || !H || !N) { alert('Укажите размеры проёма'); return; }

  // Партиция: если тоггл включён при N=2 → оплачивается 1 дверь, иначе N
  const isSinglePartition = N === 2 && $('singlePartition').checked;
  const bd = isSinglePartition ? 1 : N;

  const softClose = $('softClose').checked;
  // Сложная сборка: только если complexRow видим (секций на дверь ≥ 4)
  const complexRow = $('complexRow');
  const complexWork = complexRow.style.display !== 'none' && $('complexWork').checked;
  const fillMarkupMult = 1 + (num('fillMarkup') / 100);
  const p = getAdjustedPrices();

  const dw = W / N;

  // 1. Площадь и стоимость наполнения — per door × per section
  const { rowRatios, colRatios } = sectOpt;
  const sectCount = rowRatios.length * colRatios.length;
  const totalAreaPerDoor = (dw / 1000) * (H / 1000);
  const areaM2 = totalAreaPerDoor * bd;
  // Убедиться что doorFills инициализирован
  initDoorFills(N, sectCount);
  let filCost = 0;
  // 2D breakdown: sectionBreakdown2D[doorIdx][sectIdx]
  const sectionBreakdown2D = [];
  for (let di = 0; di < bd; di++) {
    const dFills = doorFills[di] || [FILLINGS[0]];
    sectionBreakdown2D[di] = [];
    for (let r = 0; r < rowRatios.length; r++) {
      for (let c = 0; c < colRatios.length; c++) {
        const si = r * colRatios.length + c;
        const f = dFills[si] || dFills[0] || FILLINGS[0];
        const sArea = totalAreaPerDoor * rowRatios[r] * colRatios[c];
        const sPrice = f.p * fillMarkupMult;
        sectionBreakdown2D[di].push({ fill: f, sArea, fillPriceAdj: sPrice, cost: sArea * sPrice });
        filCost += sArea * sPrice;
      }
    }
  }
  // Плоский breakdown для отображения (агрегирован по дверям)
  const sectionBreakdown = [];
  for (let si = 0; si < sectCount; si++) {
    const ref = (sectionBreakdown2D[0] && sectionBreakdown2D[0][si]) || { fill: FILLINGS[0], fillPriceAdj: FILLINGS[0].p * fillMarkupMult };
    const sArea = sectionBreakdown2D.reduce((s, dBd) => s + (dBd[si] ? dBd[si].sArea : 0), 0);
    const cost  = sectionBreakdown2D.reduce((s, dBd) => s + (dBd[si] ? dBd[si].cost  : 0), 0);
    sectionBreakdown.push({ fill: ref.fill, sArea, fillPriceAdj: ref.fillPriceAdj, cost });
  }
  const fill = (doorFills[0] && doorFills[0][0]) || FILLINGS[0];
  const fillPriceAdj = sectionBreakdown[0].fillPriceAdj;
  // Уникальные материалы для заголовка
  const allFillsFlat = [].concat(...doorFills.slice(0, bd));
  const uniqueFills = allFillsFlat.filter((f, i, arr) => arr.indexOf(f) === i);

  // 2. Профиль — детализация
  const profRows = [];

  // Ручка = вертикальный профиль, 2 шт на дверь, длина = H
  const lenRuchka = H * 2 * bd;
  profRows.push({
    n: 'Ручка (вертикаль)',
    note: '2 × ' + bd.toFixed(2) + ' дв.',
    l: lenRuchka,
    pr: p.ruchka,
    c: (lenRuchka / 1000) * p.ruchka,
  });

  // Верх двери
  const lenVerh = dw * bd;
  profRows.push({
    n: 'Верх двери',
    note: bd.toFixed(2) + ' дв.',
    l: lenVerh,
    pr: p.verh,
    c: (lenVerh / 1000) * p.verh,
  });

  // Низ двери
  const lenNiz = dw * bd;
  profRows.push({
    n: 'Низ двери',
    note: bd.toFixed(2) + ' дв.',
    l: lenNiz,
    pr: p.niz,
    c: (lenNiz / 1000) * p.niz,
  });

  // Горизонтальные разделители
  if (sectH > 0) {
    const l = dw * sectH * bd;
    profRows.push({
      n: 'Разд. горизонт. (' + sectH + ' шт/дв.)',
      note: (sectH * bd).toFixed(2) + ' шт',
      l,
      pr: p.razd,
      c: (l / 1000) * p.razd,
    });
  }

  // Вертикальные разделители
  if (sectV > 0) {
    const l = H * sectV * bd;
    profRows.push({
      n: 'Разд. вертикал. (' + sectV + ' шт/дв.)',
      note: (sectV * bd).toFixed(2) + ' шт',
      l,
      pr: p.razd,
      c: (l / 1000) * p.razd,
    });
  }

  // Направляющие — по ширине ВСЕГО проёма (не зависят от bd)
  profRows.push({
    n: 'Направляющая верхняя',
    note: 'по проёму',
    l: W,
    pr: p.napravl_top,
    c: (W / 1000) * p.napravl_top,
  });
  profRows.push({
    n: 'Направляющая нижняя',
    note: 'по проёму',
    l: W,
    pr: p.napravl_bot,
    c: (W / 1000) * p.napravl_bot,
  });

  const profTotal = profRows.reduce((s, r) => s + r.c, 0);

  // 3. Фурнитура и работа
  const softCloseCost = softClose ? SOFT_CLOSE_PRICE * bd : 0;
  const complexCost   = complexWork ? COMPLEX_WORK_PRICE * bd : 0;

  // Плёнка — рассчитывается по каждой двери × секции
  const filmOn = $('filmToggle') && $('filmToggle').checked;
  let filmCost = 0;
  if (filmOn) {
    sectionBreakdown2D.forEach(dBd => {
      dBd.forEach(s => {
        const f = getAutoFilm(s.fill);
        if (f) filmCost += s.sArea * f.p;
      });
    });
  }
  const film = getAutoFilm(fill); // для отображения (первая секция)

  const total = filCost + profTotal + softCloseCost + complexCost + filmCost;

  const sysIdx = num('profileSystem', 0);
  const colIdx = num('profileColor', 0);
  const profileColor = PROFILE_SYSTEMS[sysIdx].colors[colIdx];
  const profileName = PROFILE_SYSTEMS[sysIdx].system + ' · ' + profileColor.name;
  const frameGrad = profileColor.frameGrad || '#c0c0c0,#e0e0e0,#a0a0a0';
  const dims = PROFILE_SYSTEMS[sysIdx].dims;

  renderResults({
    W, H, N, bd, isSinglePartition,
    fills: uniqueFills, fill, sectionBreakdown, sectionBreakdown2D, fillPriceAdj, areaM2, filCost,
    doorFills: doorFills.map(a => a.slice()),
    profRows, profTotal,
    softClose, softCloseCost,
    complexWork, complexCost,
    film, filmOn, filmCost,
    total, profileName, frameGrad, dims, sectOpt,
  });
}

/* ============================================================
   RENDER — renderResults()
   ============================================================ */
function renderResults(d) {
  // Hide left empty, show viz center
  $('emptyState').style.display = 'none';
  if ($('kupeVizArea')) $('kupeVizArea').style.display = 'flex';

  // Hide right empty, show results
  if ($('kupeResultEmpty')) $('kupeResultEmpty').style.display = 'none';
  const rc = $('resultContent');
  rc.style.display = 'flex';

  const isPartition = d.isSinglePartition;
  const bdDisplay = String(d.bd);

  // Project number — generate once per session
  if (!window._kupeProjectNum) window._kupeProjectNum = generateProjectNum();
  if ($('kupeProjNum'))  $('kupeProjNum').textContent  = window._kupeProjectNum;
  if ($('kupeProjMeta')) $('kupeProjMeta').textContent =
    d.W + ' × ' + d.H + ' мм · ' + d.N + ' ' + pluralDoors(d.N).toUpperCase();

  // Build spec items: profile rows + fillings + extras
  const specItems = [];
  // Profile pieces
  d.profRows.forEach(r => {
    specItems.push({ name:r.n, qty:fmt(r.l) + ' мм', sum:r.c });
  });
  // Fillings
  if (d.sectionBreakdown.length === 1) {
    specItems.push({ name: d.fills[0].n, qty: d.areaM2.toFixed(2)+' м²', sum: d.filCost });
  } else {
    d.sectionBreakdown.forEach((s, i) => {
      specItems.push({ name:'Секц. '+(i+1)+' · '+s.fill.n, qty:s.sArea.toFixed(2)+' м²', sum:s.cost });
    });
  }
  // Extras
  if (d.filmCost > 0)      specItems.push({ name:'Защитная плёнка', qty:d.areaM2.toFixed(2)+' м²', sum:d.filmCost });
  if (d.softCloseCost > 0) specItems.push({ name:'Доводчик',         qty:bdDisplay+' дв.',         sum:d.softCloseCost });
  if (d.complexCost > 0)   specItems.push({ name:'Сложная сборка',   qty:bdDisplay+' дв.',         sum:d.complexCost });

  // Округляем строки так, чтобы их сумма совпадала с ИТОГО
  roundParts(specItems.map(it => it.sum), d.total).forEach((v, i) => { specItems[i].sum = v; });

  const specHTML = specItems.map(it =>
    '<div class="kupe-spec-row">'+
      '<span class="kupe-spec-name">'+it.name+'</span>'+
      '<span class="kupe-spec-qty">'+it.qty+'</span>'+
      '<span class="kupe-spec-price">'+fmt(it.sum)+' ₽</span>'+
    '</div>'
  ).join('');

  rc.innerHTML =
    // — Hero (ИТОГО + цена + meta)
    '<div>' +
      '<div class="kupe-hero-lbl">ИТОГО</div>' +
      '<div class="kupe-hero-price rh-value">' + fmt(d.total) + ' ₽</div>' +
      '<div class="kupe-hero-meta">' +
        d.N + ' ' + pluralDoors(d.N) + ' · ' + d.W + '×' + d.H + ' мм · ' +
        (d.fills.length === 1 ? d.fills[0].n : d.fills.length + ' ' + pluralMaterials(d.fills.length)) +
        (isPartition ? ' · одиночная перегородка' : '') +
      '</div>' +
    '</div>' +

    // — Спецификация
    '<div>' +
      '<div class="kupe-sec-lbl" style="margin-bottom:6px">Спецификация</div>' +
      '<div class="kupe-spec-list">' +
        specHTML +
        '<div class="kupe-spec-row" style="border-top:2px solid #28251d;border-bottom:none;padding-top:10px;margin-top:6px;font-weight:700">' +
          '<span class="kupe-spec-name">Итого</span>' +
          '<span class="kupe-spec-qty"></span>' +
          '<span class="kupe-spec-price" style="font-size:1rem">' + fmt(d.total) + ' ₽</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // — Подготовка КП
    '<div class="kp-prepare">' +
      '<div class="kp-prepare-head">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-primary);flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
        '<div class="kp-prepare-title">Формирование коммерческого предложения</div>' +
      '</div>' +
      '<div class="kp-prepare-body">' +
        // Клиент
        '<div class="field">' +
          '<label class="lbl" for="kpClient">Клиент / организация</label>' +
          '<input class="kp-client-input" id="kpClient" type="text" placeholder="ФИО или название организации">' +
        '</div>' +
        // Телефон заказчика
        '<div class="field">' +
          '<label class="lbl" for="kpPhone">Телефон заказчика</label>' +
          '<input class="kp-client-input" id="kpPhone" type="tel" placeholder="+7 (___) ___-__-__">' +
        '</div>' +
        // Менеджер
        '<div class="field">' +
          '<label class="lbl" for="kpManager">Менеджер</label>' +
          '<input class="kp-client-input" id="kpManager" type="text" placeholder="Имя менеджера">' +
        '</div>' +
        // Доставка
        '<div class="kp-row">' +
          '<div>' +
            '<div class="kp-row-label">Стоимость доставки</div>' +
            '<div class="kp-row-desc">Вводится менеджером вручную</div>' +
          '</div>' +
          '<div class="kp-delivery-input">' +
            '<input type="number" id="kpDelivery" value="0" min="0" placeholder="0">' +
            '<span>₽</span>' +
          '</div>' +
        '</div>' +
        // Установка 13%
        '<div class="tog-row" style="background:var(--color-surface-offset)">' +
          '<div>' +
            '<div class="tog-lbl">Включить стоимость установки</div>' +
            '<div class="tog-desc">13% от стоимости изделия</div>' +
          '</div>' +
          '<label class="toggle"><input type="checkbox" id="kpInstall" onchange="updateKPPreview()"><span class="t-slider"></span></label>' +
        '</div>' +
        // Превью итога КП
        '<div id="kpTotalsPreview" style="background:var(--color-surface-offset);border-radius:var(--radius-md);padding:var(--sp3) var(--sp4);display:flex;flex-direction:column;gap:6px;font-size:var(--tx-xs)">' +
        '</div>' +
        // Кнопка
        '<button class="btn-kp" onclick="openKP()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
          'Сформировать КП' +
        '</button>' +
      '</div>' +
    '</div>';

  renderRoom('vizRoom', d.W, d.H, d.N, d.bd, d.isSinglePartition, d.doorFills || [d.fills], d.frameGrad, d.dims, d.sectOpt);

  // Сохраняем данные расчёта для КП
  window._lastCalcData = d;
  updateKPPreview();

  // Phase 5: обновить список заполнений в левой колонне
  if (typeof renderKupeFillsList === 'function') renderKupeFillsList();

  // Обновление превью при изменении доставки
  $('kpDelivery').addEventListener('input', updateKPPreview);
}

/* ============================================================
   RENDER — renderRoom()
   Визуализация: комната → направляющие → полотна → тень
   isSinglePartition: bool — вторая дверь не оплачивается (ghost)
   ============================================================ */
function renderRoom(containerId, W, H, N, bd, isSinglePartition, fills, frameGrad, dims, sectOpt) {
  const room = $(containerId);
  if (!room) return;
  // Default dims if not provided
  const DM = dims || { frameSide:30, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 };

  const FLOOR_H = 64;
  const CORNICE_H = 14;

  // Адаптивное масштабирование: 230px = 2000мм (фиксированный масштаб)
  const BASELINE_DH = 230;
  const BASELINE_H_MM = 2000;
  const dw_mm = W / N;
  const availW = (room.clientWidth || 580) * 0.9;

  // dH пропорционально реальной высоте двери
  let dH = Math.round(BASELINE_DH * H / BASELINE_H_MM);
  dH = Math.min(dH, 320); // предел для очень высоких конструкций

  // dW из пропорций двери
  let dW = Math.round(dH * dw_mm / H);

  // Подогнать под ширину контейнера
  if (dW * N > availW) {
    dW = availW / N;
    dH = Math.round(dW * H / dw_mm);
  }
  dW = Math.round(dW);
  dH = Math.round(dH);
  const totalW = dW * N;
  const doorLeft = Math.round(((room.clientWidth || 580) - totalW) / 2);

  // pxPerMm — единый масштаб
  const pxPerMm = dH / H;
  if (containerId === 'vizRoom') window._vizPxPerMm = pxPerMm;

  // Направляющие — реальная толщина в пикселях
  const TRACK_TOP_H = Math.max(3, Math.round(DM.trackTop * pxPerMm));
  const TRACK_BOT_H = Math.max(2, Math.round(DM.trackBot * pxPerMm));

  // Адаптивная высота комнаты: ~500мм потолочного зазора над инсталляцией
  const aboveTrackPx = Math.max(CORNICE_H + 20, Math.round(500 * pxPerMm));
  const ROOM_H = FLOOR_H + TRACK_BOT_H + dH + TRACK_TOP_H + aboveTrackPx;
  const WALL_H = ROOM_H - FLOOR_H;

  room.style.cssText = 'width:100%;height:' + ROOM_H + 'px;position:relative;overflow:hidden;background:#e8e4da;';
  room.innerHTML = '';

  // — Стена (фон)
  room.appendChild(mkEl('div',
    'position:absolute;top:0;left:0;right:0;height:' + WALL_H + 'px;' +
    'background:linear-gradient(180deg,#f0ece3 0%,#e6e2d8 60%,#ddd8ce 100%);'
  ));

  // — Фактура стены (слабая текстура штукатурки)
  room.appendChild(mkEl('div',
    'position:absolute;top:0;left:0;right:0;height:' + WALL_H + 'px;' +
    'background-image:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.008) 3px,rgba(0,0,0,.008) 4px);' +
    'pointer-events:none;'
  ));

  // — Потолочный карниз
  room.appendChild(mkEl('div',
    'position:absolute;top:0;left:0;right:0;height:' + CORNICE_H + 'px;' +
    'background:linear-gradient(180deg,#f8f6f0 0%,#e2ded6 60%,#cac7be 100%);' +
    'box-shadow:0 3px 8px rgba(0,0,0,.12);z-index:2;'
  ));

  // — Боковые откосы проёма (слева и справа от двери)
  const REVEAL_W = 18;
  // левый откос
  const revealLeft = mkEl('div',
    'position:absolute;bottom:' + FLOOR_H + 'px;' +
    'left:' + (doorLeft - REVEAL_W) + 'px;' +
    'width:' + REVEAL_W + 'px;height:' + (dH + TRACK_TOP_H + TRACK_BOT_H + 4) + 'px;' +
    'background:linear-gradient(90deg,#cac7be 0%,#e8e4da 100%);' +
    'z-index:3;box-shadow:inset -2px 0 6px rgba(0,0,0,.1);'
  );
  room.appendChild(revealLeft);
  // правый откос
  const revealRight = mkEl('div',
    'position:absolute;bottom:' + FLOOR_H + 'px;' +
    'left:' + (doorLeft + totalW) + 'px;' +
    'width:' + REVEAL_W + 'px;height:' + (dH + TRACK_TOP_H + TRACK_BOT_H + 4) + 'px;' +
    'background:linear-gradient(90deg,#e8e4da 0%,#cac7be 100%);' +
    'z-index:3;box-shadow:inset 2px 0 6px rgba(0,0,0,.1);'
  );
  room.appendChild(revealRight);

  // — Плинтус
  room.appendChild(mkEl('div',
    'position:absolute;bottom:' + FLOOR_H + 'px;left:0;right:0;height:10px;' +
    'background:linear-gradient(180deg,#d4d0c6 0%,#b8b4aa 100%);z-index:1;'
  ));

  // — Пол с паркетными планками
  const floor = mkEl('div',
    'position:absolute;bottom:0;left:0;right:0;height:' + FLOOR_H + 'px;' +
    'background:linear-gradient(180deg,#c4a06a 0%,#b09055 40%,#c8a872 80%,#b89460 100%);overflow:hidden;'
  );
  // SVG паркетных полос
  let floorSvg = '<svg width="100%" height="' + FLOOR_H + '" style="position:absolute;top:0;left:0;opacity:.18" xmlns="http://www.w3.org/2000/svg">';
  for (let y = 10; y < FLOOR_H; y += 12) {
    floorSvg += '<line x1="0" y1="' + y + '" x2="100%" y2="' + y + '" stroke="#5a3a10" stroke-width="' + (y % 24 === 10 ? 1.2 : 0.5) + '"/>';
  }
  floorSvg += '</svg>';
  floor.innerHTML = floorSvg;
  // Перспективный градиент пола
  floor.appendChild(mkEl('div',
    'position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 0%,transparent 60%);pointer-events:none;'
  ));
  room.appendChild(floor);

  // — Тень под дверями (мягкая, широкая)
  room.appendChild(mkEl('div',
    'position:absolute;bottom:' + (FLOOR_H - 2) + 'px;' +
    'left:' + (doorLeft - 20) + 'px;' +
    'width:' + (totalW + 40) + 'px;height:24px;' +
    'background:radial-gradient(ellipse 80% 100% at 50% 100%,rgba(0,0,0,.32) 0%,transparent 100%);' +
    'z-index:2;pointer-events:none;'
  ));

  // — Верхняя направляющая
  room.appendChild(mkEl('div',
    'position:absolute;' +
    'bottom:' + (FLOOR_H + TRACK_BOT_H + dH) + 'px;' +
    'left:' + doorLeft + 'px;' +
    'width:' + totalW + 'px;height:' + TRACK_TOP_H + 'px;' +
    'background:linear-gradient(180deg,#a8a8a8 0%,#d8d8d8 40%,#f0f0f0 70%,#c0c0c0 100%);' +
    'border-radius:2px 2px 0 0;' +
    'box-shadow:0 -2px 5px rgba(0,0,0,.18),inset 0 1px 2px rgba(255,255,255,.5);' +
    'z-index:5;'
  ));

  // — Нижняя направляющая
  room.appendChild(mkEl('div',
    'position:absolute;' +
    'bottom:' + FLOOR_H + 'px;' +
    'left:' + doorLeft + 'px;' +
    'width:' + totalW + 'px;height:' + TRACK_BOT_H + 'px;' +
    'background:linear-gradient(180deg,#787878 0%,#b0b0b0 50%,#d8d8d8 100%);' +
    'border-radius:0 0 2px 2px;' +
    'box-shadow:0 3px 6px rgba(0,0,0,.24);' +
    'z-index:5;'
  ));

  // — Контейнер дверей
  const dc = mkEl('div',
    'position:absolute;' +
    'bottom:' + (FLOOR_H + TRACK_BOT_H) + 'px;' +
    'left:' + doorLeft + 'px;' +
    'display:flex;align-items:flex-end;z-index:4;'
  );

  const isDraggable = containerId === 'vizRoom';
  for (let i = 0; i < N; i++) {
    const isGhost = isSinglePartition && i === 1;
    const doorOpacity = isGhost ? 0.22 : 1;
    // fills может быть 2D (doorFills) или 1D (legacy/KP)
    const dFills = Array.isArray(fills[0])
      ? (fills[i] || fills[fills.length - 1] || [FILLINGS[0]])
      : fills;
    const _rows = (sectOpt || SECTION_OPTS[0]).rowRatios.length;
    const _dRM  = (doorRowMm[i] && doorRowMm[i].length === _rows) ? doorRowMm[i] : null;
    const doorSO = _dRM
      ? Object.assign({}, sectOpt, { rowRatios: _dRM.map(v => v / H) })
      : (sectOpt || SECTION_OPTS[0]);
    const door = makeDoor(dW, dH, i, dFills, doorSO, doorOpacity, frameGrad, pxPerMm, DM, isDraggable);
    if (i > 0) door.style.marginLeft = '-2px';
    dc.appendChild(door);
  }
  room.appendChild(dc);

  // — Линейка секций (справа от активной двери)
  const _sectRows = (sectOpt || SECTION_OPTS[0]).rowRatios.length;
  if (_sectRows > 1 && containerId === 'vizRoom') {
    const rIdx = Math.min(activeDoorEdit, N - 1);
    const rRm = (doorRowMm[rIdx] && doorRowMm[rIdx].length === _sectRows)
      ? doorRowMm[rIdx]
      : (rowMm.length === _sectRows ? rowMm : null);
    if (rRm) {
      const fTop_r = Math.max(2, Math.round(DM.frameTop * pxPerMm));
      const fBot_r = Math.max(2, Math.round(DM.frameBot * pxPerMm));
      const divW_r = Math.max(1, Math.round(DM.divider  * pxPerMm));
      const rulerX = doorLeft + rIdx * dW + dW + 8;

      // SVG-скобка: вертикальная линия + засечки
      const bSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      bSvg.setAttribute('width', '10');
      bSvg.setAttribute('height', dH);
      bSvg.setAttribute('viewBox', '0 0 10 ' + dH);
      bSvg.style.cssText =
        'position:absolute;left:' + rulerX + 'px;bottom:' + (FLOOR_H + TRACK_BOT_H) + 'px;' +
        'z-index:7;pointer-events:none;';
      let svgBody =
        '<line x1="8" y1="0" x2="8" y2="' + dH + '" stroke="rgba(80,70,60,.28)" stroke-width="1"/>' +
        '<line x1="4" y1="' + fTop_r + '" x2="8" y2="' + fTop_r + '" stroke="rgba(80,70,60,.28)" stroke-width="1"/>';
      let bCum = fTop_r;
      for (let r = 0; r < _sectRows; r++) {
        bCum += Math.round(rRm[r] * pxPerMm);
        if (r < _sectRows - 1) {
          svgBody += '<line x1="4" y1="' + bCum + '" x2="8" y2="' + bCum + '" stroke="rgba(80,70,60,.28)" stroke-width="1"/>';
          bCum += divW_r;
        }
      }
      svgBody += '<line x1="4" y1="' + (dH - fBot_r) + '" x2="8" y2="' + (dH - fBot_r) + '" stroke="rgba(80,70,60,.28)" stroke-width="1"/>';
      bSvg.innerHTML = svgBody;
      room.appendChild(bSvg);

      // Кликабельные mm-подписи для каждой секции
      let cumFromDoorTop = fTop_r;
      for (let r = 0; r < _sectRows; r++) {
        const sH     = Math.round(rRm[r] * pxPerMm);
        const midFromTop = cumFromDoorTop + Math.round(sH / 2);
        const midCssBot  = FLOOR_H + TRACK_BOT_H + dH - midFromTop;
        const mmVal  = rRm[r];
        const lbl = mkEl('div',
          'position:absolute;left:' + (rulerX + 12) + 'px;bottom:' + (midCssBot - 10) + 'px;' +
          'font-size:10px;font-weight:600;color:rgba(80,70,60,.85);' +
          'font-family:var(--font);white-space:nowrap;cursor:pointer;z-index:8;' +
          'background:rgba(240,236,227,.92);border-radius:3px;padding:2px 5px;' +
          'border:1px solid rgba(80,70,60,.18);transition:all .15s;'
        );
        lbl.textContent = mmVal + ' мм';
        lbl.dataset.doorIdx = rIdx;
        lbl.dataset.sectIdx = r;
        lbl.dataset.mm = mmVal;
        lbl.title = 'Нажмите для редактирования';
        lbl.addEventListener('mouseenter', () => {
          lbl.style.background = 'rgba(255,255,255,.98)';
          lbl.style.borderColor = 'rgba(1,105,111,.5)';
          lbl.style.color = 'rgba(1,105,111,1)';
        });
        lbl.addEventListener('mouseleave', () => {
          if (!lbl.querySelector('input')) {
            lbl.style.background = 'rgba(240,236,227,.92)';
            lbl.style.borderColor = 'rgba(80,70,60,.18)';
            lbl.style.color = 'rgba(80,70,60,.85)';
          }
        });
        lbl.addEventListener('click', e => { e.stopPropagation(); startRulerEdit(lbl); });
        room.appendChild(lbl);
        cumFromDoorTop += sH + divW_r;
      }
    }
  }

  // — Боковой световой блик на стекле (ambient occlusion снизу проёма)
  room.appendChild(mkEl('div',
    'position:absolute;bottom:' + FLOOR_H + 'px;left:0;right:0;height:' + (dH + TRACK_TOP_H + TRACK_BOT_H) + 'px;' +
    'background:linear-gradient(90deg,rgba(0,0,0,.06) 0%,transparent 8%,transparent 92%,rgba(0,0,0,.06) 100%);' +
    'pointer-events:none;z-index:6;'
  ));

  // ── ЧЕЛОВЕК (слева от дверей) ──────────────────────────────
  const personH_mm = 1800;
  const personH_px = Math.round(personH_mm * pxPerMm);
  // Реальные пропорции силуэта: 58×142 px, соотношение ~0.408
  const personAspect = 58 / 142;
  const personW_px = Math.round(personH_px * personAspect);
  const personX = doorLeft - personW_px - 28;

  if (personX > 4) {

    // SVG — реальный силуэт из фото (base64 PNG)
    // viewBox точно совпадает с пропорциями width/height — без полей сверху или снизу
    const personSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    personSvg.setAttribute('width', personW_px);
    personSvg.setAttribute('height', personH_px);
    personSvg.setAttribute('viewBox', '0 0 58 142');
    // 'none' — растягивает ровно по width×height (но т.к. они уже в правильной пропорции, искажений нет)
    personSvg.setAttribute('preserveAspectRatio', 'none');
    personSvg.style.cssText =
      'position:absolute;bottom:' + FLOOR_H + 'px;left:' + personX + 'px;' +
      'z-index:3;opacity:.6;';
    personSvg.innerHTML =
      '<image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAACOCAYAAABg4BtLAAAB0UlEQVR42u2dMW7DMAxFLcFH6JIl9z9Xly69Q7sWQdCYDCXxU+9vQZBaz5+kScVOjwMhhBBCXrXVC7jfPn7+vv78+m6lQB8BR8P2bJBX3pcAvQoRDduPTZQaNNLVrrpwQjcD6KhrJI4CCiigMgVpiaMrYFOHbuQJ6TtApgbdanqRbeo9AFGwTc0lb+421ZyzQjc1OC9wU4WzwjZ1wKuwNPVqbr7SWR3wbUeVIMnRzAO0N8pwFNDdQKm6lVpANTfJ0WpumkFVIQndahW3DOiVvrvvAGkGzTaxWNZzRh0w09bmM4U6NAPWC9qVILm8VAT1Rs42+7qELqCiEw2OVqu8fYewJXQBBbQwKF9JAApoXtAM+WldA47+pwzbntY1SN6V4jl2m50rswHDctRz8FmfSVGMZoc+VRdQQAEFtDToVg/Krjg5hK7aNJPKUX5ZY8LJIUcBBRRQQOVAvRtkM6+rOBrt5uo2EUcBBXRMfkd95YGjjGliAzehC+jAioijgAIK6HDQLLv4OFqtY0o/vRC6gIqCMngDCui43Ml0bwMNQ5ZFLt8c2+KRLcVfqmqjAC0h9+rvRoTvWdVBc+gqPp6VtmGYUcFT3aw4+x87IoQQQm/qFzVTzNgIDgrAAAAAAElFTkSuQmCC"' +
      ' x="0" y="0" width="58" height="142" preserveAspectRatio="none"/>';
    room.appendChild(personSvg);

    // Размерная стрелка человека
    const arrowX = personX - 14;
    const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowSvg.setAttribute('width', '20');
    arrowSvg.setAttribute('height', personH_px + 2);
    arrowSvg.setAttribute('viewBox', '0 0 20 ' + (personH_px + 2));
    arrowSvg.style.cssText =
      'position:absolute;bottom:' + FLOOR_H + 'px;left:' + arrowX + 'px;z-index:7;';
    arrowSvg.innerHTML =
      '<line x1="10" y1="1" x2="10" y2="' + personH_px + '" stroke="rgba(80,70,60,.5)" stroke-width="1" stroke-dasharray="3,2"/>' +
      '<polygon points="10,0 7,7 13,7" fill="rgba(80,70,60,.5)"/>' +
      '<polygon points="10,' + (personH_px+1) + ' 7,' + (personH_px-6) + ' 13,' + (personH_px-6) + '" fill="rgba(80,70,60,.5)"/>';
    room.appendChild(arrowSvg);

    // Подпись
    const personLabel = mkEl('div',
      'position:absolute;font-size:9px;font-weight:600;color:rgba(80,70,60,.65);' +
      'font-family:var(--font);white-space:nowrap;' +
      'left:' + (arrowX - 22) + 'px;' +
      'bottom:' + (FLOOR_H + Math.round(personH_px / 2) - 6) + 'px;' +
      'writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.04em;'
    );
    personLabel.textContent = '1 800 мм';
    room.appendChild(personLabel);
  }

  // ── КОМОД (справа от дверей) ───────────────────────────────
  const dresserH_mm = 1000;
  const dresserW_mm = 900;
  const dresserH_px = Math.round(dresserH_mm * pxPerMm);
  const dresserW_px = Math.round(dresserW_mm * pxPerMm);
  const _rulerExtra = (_sectRows > 1 && containerId === 'vizRoom') ? 70 : 0;
  const dresserX = doorLeft + totalW + 28 + _rulerExtra;
  const dresserBottom = FLOOR_H;
  const availRight = (room.clientWidth || 600) - dresserX - 8;

  if (availRight >= dresserW_px * 0.5) {
    const dW2 = Math.min(dresserW_px, availRight - 4);
    const scale = dW2 / dresserW_px;
    const dH2 = Math.round(dresserH_px * scale);

    const dresserSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dresserSvg.setAttribute('width', dW2);
    dresserSvg.setAttribute('height', dH2);
    dresserSvg.setAttribute('viewBox', '0 0 100 112');
    dresserSvg.setAttribute('preserveAspectRatio', 'none');
    dresserSvg.style.cssText =
      'position:absolute;bottom:' + dresserBottom + 'px;left:' + dresserX + 'px;' +
      'z-index:3;opacity:.75;';

    // Корпус комода
    dresserSvg.innerHTML =
      // Тень комода
      '<ellipse cx="50" cy="112" rx="46" ry="4" fill="rgba(0,0,0,.12)"/>' +
      // Основной корпус
      '<rect x="2" y="4" width="96" height="104" rx="2" fill="#d4c9b4" stroke="#b8ad98" stroke-width="1.5"/>' +
      // Боковая тень (объём)
      '<rect x="88" y="4" width="10" height="104" rx="1" fill="rgba(0,0,0,.08)"/>' +
      // Столешница
      '<rect x="0" y="2" width="100" height="6" rx="2" fill="#e2d8c4" stroke="#b8ad98" stroke-width="1"/>' +
      // Выдвижной ящик 1
      '<rect x="6" y="14" width="88" height="26" rx="2" fill="#c8bcaa" stroke="#a89c8c" stroke-width="1"/>' +
      '<rect x="6" y="14" width="88" height="4" rx="1" fill="rgba(255,255,255,.25)"/>' +
      '<rect x="38" y="23" width="24" height="7" rx="3.5" fill="#b0a490" stroke="#9a8e80" stroke-width="1"/>' +
      // Выдвижной ящик 2
      '<rect x="6" y="44" width="88" height="26" rx="2" fill="#c8bcaa" stroke="#a89c8c" stroke-width="1"/>' +
      '<rect x="6" y="44" width="88" height="4" rx="1" fill="rgba(255,255,255,.25)"/>' +
      '<rect x="38" y="53" width="24" height="7" rx="3.5" fill="#b0a490" stroke="#9a8e80" stroke-width="1"/>' +
      // Выдвижной ящик 3
      '<rect x="6" y="74" width="88" height="26" rx="2" fill="#c8bcaa" stroke="#a89c8c" stroke-width="1"/>' +
      '<rect x="6" y="74" width="88" height="4" rx="1" fill="rgba(255,255,255,.25)"/>' +
      '<rect x="38" y="83" width="24" height="7" rx="3.5" fill="#b0a490" stroke="#9a8e80" stroke-width="1"/>' +
      // Ножки
      '<rect x="8" y="103" width="10" height="7" rx="1" fill="#a09080"/>' +
      '<rect x="82" y="103" width="10" height="7" rx="1" fill="#a09080"/>';

    room.appendChild(dresserSvg);

    // Размерные стрелки комода — высота (справа)
    const dimX = dresserX + dW2 + 6;
    if (dimX < (room.clientWidth || 600) - 30) {
      const hSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      hSvg.setAttribute('width', '20');
      hSvg.setAttribute('height', dH2 + 2);
      hSvg.setAttribute('viewBox', '0 0 20 ' + (dH2 + 2));
      hSvg.style.cssText =
        'position:absolute;bottom:' + dresserBottom + 'px;left:' + dimX + 'px;z-index:7;';
      hSvg.innerHTML =
        '<line x1="10" y1="1" x2="10" y2="' + dH2 + '" stroke="rgba(80,70,60,.45)" stroke-width="1" stroke-dasharray="3,2"/>' +
        '<polygon points="10,0 7,7 13,7" fill="rgba(80,70,60,.45)"/>' +
        '<polygon points="10,' + (dH2+1) + ' 7,' + (dH2-6) + ' 13,' + (dH2-6) + '" fill="rgba(80,70,60,.45)"/>';
      room.appendChild(hSvg);

      const hLabel = mkEl('div',
        'position:absolute;font-size:9px;font-weight:600;color:rgba(80,70,60,.6);' +
        'font-family:var(--font);white-space:nowrap;' +
        'left:' + (dimX + 14) + 'px;' +
        'bottom:' + (dresserBottom + Math.round(dH2 / 2) - 6) + 'px;' +
        'writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.04em;'
      );
      hLabel.textContent = '1 000 мм';
      room.appendChild(hLabel);
    }

    // Размерная стрелка — ширина (снизу)
    const wArrowBottom = dresserBottom - 20;
    const wSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wSvg.setAttribute('width', dW2 + 2);
    wSvg.setAttribute('height', '16');
    wSvg.setAttribute('viewBox', '0 0 ' + (dW2 + 2) + ' 16');
    wSvg.style.cssText =
      'position:absolute;bottom:' + wArrowBottom + 'px;left:' + dresserX + 'px;z-index:7;';
    wSvg.innerHTML =
      '<line x1="1" y1="8" x2="' + (dW2+1) + '" y2="8" stroke="rgba(80,70,60,.45)" stroke-width="1" stroke-dasharray="3,2"/>' +
      '<polygon points="0,8 7,5 7,11" fill="rgba(80,70,60,.45)"/>' +
      '<polygon points="' + (dW2+2) + ',8 ' + (dW2-5) + ',5 ' + (dW2-5) + ',11" fill="rgba(80,70,60,.45)"/>';
    room.appendChild(wSvg);

    const wLabel = mkEl('div',
      'position:absolute;font-size:9px;font-weight:600;color:rgba(80,70,60,.6);' +
      'font-family:var(--font);white-space:nowrap;text-align:center;' +
      'left:' + dresserX + 'px;width:' + dW2 + 'px;' +
      'bottom:' + (wArrowBottom - 12) + 'px;'
    );
    wLabel.textContent = '900 мм';
    room.appendChild(wLabel);
  }

  // — Размерная подпись двери
  const dim = mkEl('div',
    'position:absolute;bottom:8px;right:12px;' +
    'font-size:10px;color:rgba(0,0,0,.28);font-variant-numeric:tabular-nums;' +
    'font-family:var(--font);letter-spacing:.02em;'
  );
  dim.textContent = W + ' × ' + H + ' мм · ' + N + ' ' + (N === 1 ? 'дверь' : N < 5 ? 'двери' : 'дверей');
  room.appendChild(dim);
}

function makeDoor(dW, dH, doorIdx, fills, sOpt, opacity, frameGrad, pxPerMm, dims, draggable) {
  const DM = dims || { frameSide:30, frameTop:40, frameBot:40, divider:20 };
  const fg = (frameGrad || '#c0c0c0,#e0e0e0,#a0a0a0').split(',');
  const [fMid, fLight, fDark] = fg;

  // Реальные толщины профиля в пикселях
  const fSide = Math.max(2, Math.round(DM.frameSide * pxPerMm));
  const fTop  = Math.max(2, Math.round(DM.frameTop  * pxPerMm));
  const fBot  = Math.max(2, Math.round(DM.frameBot  * pxPerMm));
  const divW  = Math.max(1, Math.round(DM.divider   * pxPerMm));

  const d = mkEl('div',
    'width:' + dW + 'px;height:' + dH + 'px;position:relative;overflow:hidden;' +
    'box-shadow:4px 6px 22px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.14);' +
    'cursor:default;transition:opacity .3s ease;' +
    'opacity:' + opacity + ';'
  );

  // Профиль рамки — верх
  d.appendChild(mkEl('div', 'position:absolute;left:0;right:0;height:' + fTop + 'px;top:0;z-index:3;' +
    'background:linear-gradient(180deg,' + fLight + ' 0%,' + fMid + ' 50%,' + fDark + ' 100%);'));
  // Профиль рамки — низ
  d.appendChild(mkEl('div', 'position:absolute;left:0;right:0;height:' + fBot + 'px;bottom:0;z-index:3;' +
    'background:linear-gradient(180deg,' + fDark + ' 0%,' + fMid + ' 50%,' + fLight + ' 100%);'));
  // Профиль рамки — лево
  d.appendChild(mkEl('div', 'position:absolute;top:0;bottom:0;width:' + fSide + 'px;left:0;z-index:3;' +
    'background:linear-gradient(90deg,' + fDark + ' 0%,' + fMid + ' 45%,' + fLight + ' 100%);'));
  // Профиль рамки — право
  d.appendChild(mkEl('div', 'position:absolute;top:0;bottom:0;width:' + fSide + 'px;right:0;z-index:3;' +
    'background:linear-gradient(90deg,' + fLight + ' 0%,' + fMid + ' 55%,' + fDark + ' 100%);'));

  const { rowRatios, colRatios } = sOpt || { rowRatios:[1], colRatios:[1] };

  // Внутренняя сетка секций — gap = толщина разделителя, пропорции из ratios
  const inner = mkEl('div',
    'position:absolute;top:' + fTop + 'px;left:' + fSide + 'px;right:' + fSide + 'px;bottom:' + fBot + 'px;' +
    'z-index:1;display:grid;gap:' + divW + 'px;' +
    'grid-template-rows:' + rowRatios.map(r => (r * 100).toFixed(2) + 'fr').join(' ') + ';' +
    'grid-template-columns:' + colRatios.map(c => (c * 100).toFixed(2) + 'fr').join(' ') + ';'
  );

  // Фон разделителей — цвет профиля в зоне gap
  inner.style.background = fMid;

  for (let r = 0; r < rowRatios.length; r++) {
    for (let c = 0; c < colRatios.length; c++) {
      const si = r * colRatios.length + c;
      const sectionFill = fills[si] || fills[0];
      const isActive = activeSection && activeSection.doorIdx === doorIdx && activeSection.sectIdx === si;
      const cell = mkEl('div',
        'position:relative;overflow:hidden;border-radius:0;cursor:pointer;' +
        (isActive ? 'outline:2.5px solid var(--color-primary);outline-offset:-2px;z-index:10;' : '')
      );
      cell.className = sectionFill.mat || 'mat-default';
      cell.onclick = (e) => { e.stopPropagation(); openSectionEditor(doorIdx, si); };
      // Лёгкий блик
      cell.appendChild(mkEl('div', 'position:absolute;inset:0;background:linear-gradient(140deg,rgba(255,255,255,.12) 0%,transparent 40%);pointer-events:none;z-index:2;'));
      inner.appendChild(cell);
    }
  }
  d.appendChild(inner);

  // Drag-handles для перетаскивания горизонтальных разделителей
  if (draggable && rowRatios.length > 1) {
    const innerH  = dH - fTop - fBot;
    const contentH = innerH - (rowRatios.length - 1) * divW;
    let cumRatio = 0;
    for (let r = 0; r < rowRatios.length - 1; r++) {
      cumRatio += rowRatios[r];
      const gapTop   = fTop + Math.round(cumRatio * contentH) + r * divW;
      const handleH  = Math.max(divW + 4, 10);
      const handle   = document.createElement('div');
      handle.className = 'div-handle';
      handle.style.cssText =
        'position:absolute;left:' + (fSide + 1) + 'px;right:' + (fSide + 1) + 'px;' +
        'height:' + handleH + 'px;' +
        'top:' + (gapTop - Math.round((handleH - divW) / 2)) + 'px;' +
        'z-index:20;cursor:row-resize;';
      handle.dataset.doorIdx = doorIdx;
      handle.dataset.divIdx  = r;
      handle.addEventListener('mousedown', startDividerDrag);
      d.appendChild(handle);
    }
  }

  // Шиммер — если хотя бы одна секция зеркало/стекло/сатин
  const hasShimmer = fills.some(f => f && (f.mat || '').match(/mirror|glass|satin/));
  if (hasShimmer) {
    d.appendChild(mkEl('div', 'position:absolute;inset:0;background:linear-gradient(52deg,transparent 20%,rgba(255,255,255,.16) 44%,transparent 62%);pointer-events:none;z-index:5;'));
  }

  // Подсветка и активация двери для редактирования разделителей
  if (draggable) {
    if (doorIdx === activeDoorEdit) {
      d.style.outline = '2px solid rgba(1,105,111,.45)';
      d.style.outlineOffset = '2px';
    }
    d.addEventListener('click', function(e) {
      if (!e.target.closest('.mat-cell')) {
        activeDoorEdit = doorIdx;
        const H = num('height', 2000);
        rowMm = getDoorRowMm(doorIdx, H).slice();
        sectOpt = Object.assign({}, sectOpt, { rowRatios: rowMm.map(v => v / H) });
        buildDividersBlock();
        rerenderVisualization();
      }
    });
  }

  return d;
}

// «2 материала», «5 материалов»
function pluralMaterials(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'материал';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'материала';
  return 'материалов';
}

function mkEl(tag, css) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  return e;
}

/* ============================================================
   КП — ФУНКЦИИ
   ============================================================ */

function getKPTotals() {
  const d = window._lastCalcData;
  if (!d) return null;
  const delivery = +($('kpDelivery') && $('kpDelivery').value) || 0;
  const installOn = $('kpInstall') && $('kpInstall').checked;
  const installCost = installOn ? Math.round(d.total * 0.13) : 0;
  const grand = d.total + delivery + installCost;
  return { d, delivery, installOn, installCost, grand };
}

function updateKPPreview() {
  const t = getKPTotals();
  const el = $('kpTotalsPreview');
  if (!t || !el) return;

  const row = (label, val, bold) =>
    '<div style="display:flex;justify-content:space-between;' + (bold ? 'font-weight:700;color:var(--color-primary);font-size:var(--tx-sm);' : '') + '">' +
      '<span style="color:' + (bold ? 'var(--color-primary)' : 'var(--color-text-muted)') + '">' + label + '</span>' +
      '<span>' + fmt(val) + ' ₽</span>' +
    '</div>';

  el.innerHTML =
    row('Изделие (наполнение + профиль + фурнитура)', t.d.total) +
    row('Доставка', t.delivery) +
    (t.installOn ? row('Установка (13%)', t.installCost) : '') +
    '<div style="border-top:1px solid var(--color-border);margin:6px 0"></div>' +
    row('ИТОГО по КП', t.grand, true);
}

function openKP() {
  // «Экспорт КП» в шапке до расчёта — сначала считаем, иначе кнопка молчит
  if (!window._lastCalcData) calculate();
  const t = getKPTotals();
  if (!t) return;
  const client  = ($('kpClient')  && $('kpClient').value.trim())  || 'Не указан';
  const phone   = ($('kpPhone')   && $('kpPhone').value.trim())   || '—';
  const manager = ($('kpManager') && $('kpManager').value.trim()) || '—';
  $('kpPageContent').innerHTML = buildKPHTML(t, client, phone, manager);
  $('kpDocument').classList.add('kp-open');
  document.body.style.overflow = 'hidden';
  // Рендерим визуализацию на второй странице КП
  const ld = window._lastCalcData;
  if (ld) {
    const vizFills = ld.doorFills || [ld.fills || [ld.fill]];
    const vizSect = ld.sectOpt || SECTION_OPTS[0];
    setTimeout(() => {
      renderRoom('kpVizRoom', ld.W, ld.H, ld.N, ld.bd, ld.isSinglePartition, vizFills, ld.frameGrad, ld.dims, vizSect);
    }, 50);
  }
}

// closeKP() вынесен в js/shared-kp.js

function buildKPHTML(t, client, phone, manager) {
  const d = t.d;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {day:'2-digit', month:'long', year:'numeric'});
  const kpNum = 'КП-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
  const bdDisplay = String(d.bd);


  // Финальные строки КП — наполнение
  const fillingRows = [];
  const bd2D = d.sectionBreakdown2D;
  // Проверить: все двери × секции одного материала?
  const allFillsSameKP = bd2D
    ? bd2D.every(dBd => dBd.every((s, si) => s.fill === bd2D[0][si].fill))
    : d.fills.length === 1;
  // Проверить: разные материалы по дверям (не только по секциям)?
  const diffAcrossDoors = bd2D && bd2D.length > 1 &&
    !bd2D.every(dBd => dBd.every((s, si) => s.fill === bd2D[0][si].fill));

  if (allFillsSameKP && d.sectionBreakdown.length === 1) {
    // Всё одно — одна строка
    fillingRows.push({label:'Наполнение (' + d.fills[0].n + ')', detail: d.areaM2.toFixed(2) + ' м² × ' + fmt(d.sectionBreakdown[0].fillPriceAdj) + ' ₽/м²', val: d.filCost});
  } else if (diffAcrossDoors && bd2D) {
    // Разные по дверям — показываем по дверям
    bd2D.forEach((dBd, di) => {
      dBd.forEach((s, si) => {
        fillingRows.push({
          label: 'Дверь ' + (di+1) + (dBd.length > 1 ? ' · Секция ' + (si+1) : '') + ' — ' + s.fill.n,
          detail: s.sArea.toFixed(2) + ' м² × ' + fmt(s.fillPriceAdj) + ' ₽/м²',
          val: s.cost,
        });
      });
    });
  } else {
    // Одна дверь или разные секции (одинаковые по дверям) — по секциям
    d.sectionBreakdown.forEach((s, i) => {
      fillingRows.push({label:'Секция ' + (i+1) + ' — ' + s.fill.n, detail: s.sArea.toFixed(2) + ' м² × ' + fmt(s.fillPriceAdj) + ' ₽/м²', val: s.cost});
    });
  }
  const itemRows = [
    ...fillingRows,
    {label:'Профиль и направляющие (' + d.profileName + ')', detail: d.profRows.length + ' позиций', val: d.profTotal},
  ];
  if (d.filmCost > 0)
    itemRows.push({label: 'Защитная плёнка', detail: d.areaM2.toFixed(2) + ' м²' + (d.sectionBreakdown.length === 1 && d.film ? ' × ' + fmt(d.film.p) + ' ₽/м²' : ' (по секциям)'), val: d.filmCost});
  if (d.softCloseCost > 0)
    itemRows.push({label:'Фурнитура — доводчик', detail: bdDisplay + ' дв. × ' + fmt(SOFT_CLOSE_PRICE) + ' ₽', val: d.softCloseCost});
  if (d.complexCost > 0)
    itemRows.push({label:'Сложная сборка', detail: bdDisplay + ' дв. × ' + fmt(COMPLEX_WORK_PRICE) + ' ₽', val: d.complexCost});

  // Округление: строки состава = «Итого изделие», строки профиля = строка «Профиль и направляющие»
  const profItemIdx = fillingRows.length;
  roundParts(itemRows.map(r => r.val), d.total).forEach((v, i) => { itemRows[i].val = v; });
  const profTotalR = itemRows[profItemIdx].val;
  const profValsR = roundParts(d.profRows.map(r => r.c), profTotalR);
  const profRowsHTML = d.profRows.map((r, i) =>
    '<tr>' +
      '<td>' + r.n + '</td>' +
      '<td class="r">' + fmt(r.l) + ' мм</td>' +
      '<td class="r">' + fmt(r.pr) + '</td>' +
      '<td class="r">' + fmt(profValsR[i]) + '</td>' +
    '</tr>'
  ).join('');

  const itemRowsHTML = itemRows.map((r, i) =>
    '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td>' + r.label + '<br><span style="color:#999;font-size:8.5pt">' + r.detail + '</span></td>' +
      '<td class="r">' + fmt(r.val) + '</td>' +
    '</tr>'
  ).join('');

  const grandRowsHTML =
    '<tr class="kp-total-row">' +
      '<td colspan="2">Итого изделие</td>' +
      '<td class="r">' + fmt(d.total) + ' ₽</td>' +
    '</tr>' +
    (t.delivery > 0
      ? '<tr><td colspan="2">Доставка</td><td class="r">' + fmt(t.delivery) + ' ₽</td></tr>'
      : '') +
    (t.installOn
      ? '<tr><td colspan="2">Монтаж и установка (13%)</td><td class="r">' + fmt(t.installCost) + ' ₽</td></tr>'
      : '') +
    '<tr class="kp-grand-row">' +
      '<td colspan="2">ИТОГО К ОПЛАТЕ</td>' +
      '<td class="r">' + fmt(t.grand) + ' ₽</td>' +
    '</tr>';

  // Характеристики
  const specsHTML =
    '<table class="kp-table">' +
      '<thead><tr><th>Параметр</th><th>Значение</th></tr></thead>' +
      '<tbody>' +
        '<tr><td>Ширина проёма</td><td>' + d.W + ' мм</td></tr>' +
        '<tr><td>Высота проёма</td><td>' + d.H + ' мм</td></tr>' +
        '<tr><td>Количество полотен</td><td>' + d.N + ' шт</td></tr>' +
        '<tr><td>Оплачивается полотен</td><td>' + bdDisplay + ' шт' + (d.isSinglePartition ? ' (одиночная перегородка)' : '') + '</td></tr>' +
        '<tr><td>Наполнение</td><td>' + (d.fills.length === 1 ? d.fills[0].n : d.fills.map(f => f.n).join(' + ')) + '</td></tr>' +
        '<tr><td>Профильная система</td><td>' + d.profileName + '</td></tr>' +
        '<tr><td>Площадь наполнения</td><td>' + d.areaM2.toFixed(2) + ' м²</td></tr>' +
        (d.softCloseCost > 0 ? '<tr><td>Доводчик</td><td>Да</td></tr>' : '') +
        (d.filmCost > 0 ? '<tr><td>Плёнка</td><td>' + d.film.name + '</td></tr>' : '') +
      '</tbody>' +
    '</table>';

  return `
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;padding-bottom:6mm;border-bottom:2px solid #01696f">
  <div>
    <div style="font-size:15pt;font-weight:700;color:#01696f;margin-bottom:2px">Двери-купе Аристо</div>
    <div style="font-size:8.5pt;color:#999">Коммерческое предложение</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:18pt;font-weight:700;letter-spacing:-.02em">КП</div>
    <div style="font-size:8.5pt;color:#999">№ ${kpNum}</div>
    <div style="font-size:8.5pt;color:#999">Дата: ${dateStr}</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:8mm;font-size:9.5pt">
  <tr><td style="padding:3px 0;color:#666;width:130px">Клиент:</td><td style="font-weight:600">${client}</td></tr>
  <tr><td style="padding:3px 0;color:#666">Телефон:</td><td>${phone}</td></tr>
  <tr><td style="padding:3px 0;color:#666">Менеджер:</td><td>${manager}</td></tr>
</table>

<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">Характеристики изделия</div>
${specsHTML}

<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0;margin-top:6mm">Состав и стоимость</div>
<table class="kp-table">
  <thead><tr><th style="width:28px">№</th><th>Наименование</th><th class="r" style="width:100px">Сумма, ₽</th></tr></thead>
  <tbody>${itemRowsHTML}${grandRowsHTML}</tbody>
</table>

<div style="background:#f8faf9;border:1.5px solid #cedcd8;border-radius:6px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;margin-top:6mm">
  <div style="font-size:11pt;font-weight:700">ИТОГО К ОПЛАТЕ:</div>
  <div style="font-size:18pt;font-weight:700;color:#01696f">${fmt(t.grand)} ₽</div>
</div>

<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#01696f;margin-top:8mm;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #e0e0e0">Детализация профиля</div>
<table class="kp-table">
  <thead><tr><th>Позиция</th><th class="r">Длина</th><th class="r">₽/п.м.</th><th class="r">Сумма, ₽</th></tr></thead>
  <tbody>${profRowsHTML}
    <tr class="kp-total-row"><td>Итого профиль</td><td></td><td></td><td class="r">${fmt(profTotalR)} ₽</td></tr>
  </tbody>
</table>

<div style="margin-top:10mm;font-size:8.5pt;color:#aaa;border-top:1px solid #eee;padding-top:4mm;line-height:1.6">
  Данное коммерческое предложение действительно в течение 14 дней с даты выставления.<br>
  Цены указаны с учётом всех комплектующих. Срок изготовления уточняется при заказе.<br>
  Настоящее КП не является публичной офертой.
</div>

<div style="display:flex;justify-content:space-between;margin-top:12mm">
  <div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись менеджера</div>
  <div style="border-top:1px solid #ccc;padding-top:3px;width:160px;font-size:8pt;color:#999;text-align:center">Подпись клиента</div>
  <div style="border-top:1px solid #ccc;padding-top:3px;width:120px;font-size:8pt;color:#999;text-align:center">МП</div>
</div>

</div>
<!-- Страница 2 — Визуализация -->
<div class="kp-page" style="margin-top:0;page-break-before:always;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8mm;padding-bottom:4mm;border-bottom:1.5px solid #01696f">
    <div style="font-size:13pt;font-weight:700;color:#01696f">Визуализация изделия</div>
    <div style="font-size:8.5pt;color:#999">${kpNum} · ${client}</div>
  </div>
  <div style="font-size:9.5pt;margin-bottom:5mm;color:#555">
    Проём: <strong>${t.d.W} × ${t.d.H} мм</strong> · Полотен: <strong>${t.d.N} шт</strong> · Наполнение: <strong>${t.d.fills.map(f => f.n).join(' + ')}</strong> · Профиль: <strong>${t.d.profileName}</strong>
  </div>
  <!-- Контейнер для SVG-визуализации (заполняется JS после рендера) -->
  <div id="kpVizRoom" style="width:100%;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;background:#e8e4da;"></div>
  <div style="margin-top:6mm;font-size:8pt;color:#bbb;text-align:center">Визуализация является схематичной и не учитывает декоративные элементы отделки</div>
</div>`;
}

/* ============================================================
   RESET
   ============================================================ */
function resetForm() {
  $('width').value = 1200;
  $('height').value = 2000;
  $('doorCount').value = 2;
  $('softClose').checked = false;
  doorFills = [];
  activeSection = null;
  rowMm = [];
  colMm = [];
  $('fillMarkup').value = 0;
  $('singlePartition').checked = false;
  // Закрыть редактор секции если открыт
  const pf = $('panelForm');
  if (pf) pf.classList.remove('section-edit-mode');
  onDoorCountChange();
  setSections(0);
  window._lastCalcData = null;
  window._kupeProjectNum = null;
  // Центральная колонка
  if ($('emptyState'))   $('emptyState').style.display = '';
  if ($('kupeVizArea'))  $('kupeVizArea').style.display = 'none';
  // Правая колонна
  if ($('kupeResultEmpty')) $('kupeResultEmpty').style.display = '';
  const rc = $('resultContent');
  if (rc) { rc.style.display = 'none'; rc.innerHTML = ''; }
  // Чипы
  if (typeof updateChipsActive === 'function') updateChipsActive(2);
  // Список заполнений
  const fillsList = $('kupeFillsList');
  if (fillsList) fillsList.innerHTML = '<div class="kupe-hint">Нажмите на секцию в превью чтобы выбрать материал</div>';
}

/* ============================================================
   3-COL UI: Chips, fills list, version, project, save/load
   ============================================================ */

/**
 * Wire door-count chips → set hidden #doorCount + dispatch change.
 */
function setupDoorCountChips() {
  const wrap = $('doorCountChips');
  if (!wrap) return;
  Array.from(wrap.querySelectorAll('.kupe-chip')).forEach(chip => {
    chip.addEventListener('click', function(){
      const val = chip.dataset.val;
      const sel = $('doorCount');
      sel.value = val;
      sel.dispatchEvent(new Event('change', {bubbles:true}));
      updateChipsActive(val);
    });
  });
}

function updateChipsActive(val) {
  document.querySelectorAll('#doorCountChips .kupe-chip').forEach(c => {
    c.classList.toggle('kupe-chip-active', c.dataset.val === String(val));
  });
}

/**
 * Update version display in topbar (reads from data files).
 */
function initKupeVersion() {
  const el = $('kupeVersion');
  if (!el) return;
  const fv = (typeof FILLINGS_VERSION !== 'undefined') ? FILLINGS_VERSION : '—';
  const pv = (typeof PROFILES_VERSION !== 'undefined') ? PROFILES_VERSION : '—';
  // Show most recent of versions
  el.textContent = 'v 2.5 — прайс ' + (fv > pv ? fv : pv);
}

/**
 * Generate next project number (4-digit, persisted in localStorage).
 */
function generateProjectNum() {
  const next = (parseInt(localStorage.getItem('kupeNextProjNum') || '450') + 1);
  localStorage.setItem('kupeNextProjNum', String(next));
  return String(next).padStart(4, '0');
}

/**
 * Render the per-door fills list in left column.
 * Shows mini swatches + first fill name per door + clickable to open editor.
 */
function renderKupeFillsList() {
  const list = $('kupeFillsList');
  if (!list) return;
  const ld = window._lastCalcData;
  if (!ld || !ld.doorFills || !ld.doorFills.length) {
    list.innerHTML = '<div class="kupe-hint">Нажмите на секцию в превью чтобы выбрать материал</div>';
    return;
  }
  let html = '';
  ld.doorFills.forEach((doorSects, di) => {
    const f0 = doorSects[0] || { n:'—', mat:'mat-default' };
    const sectCount = doorSects.length;
    const sub = sectCount > 1
      ? '<small style="color:#a8a08f;font-size:.66rem;margin-left:6px">+ '+(sectCount-1)+' секц.</small>'
      : '';
    html += '<div class="kupe-fill-row" onclick="openSectionEditor('+di+',0)">'+
      '<div class="kupe-fill-swatch '+(f0.mat||'')+'" style="position:relative"></div>'+
      '<div class="kupe-fill-name">'+(f0.n||'—')+sub+'</div>'+
      '<div class="kupe-fill-num">№'+(di+1)+'</div>'+
    '</div>';
  });
  list.innerHTML = html;
}

/* --- localStorage save / load --- */

const KUPE_DRAFTS_KEY = 'kupeDrafts_v1';

function collectKupeState() {
  return {
    W: num('width', 1200),
    H: num('height', 2000),
    N: num('doorCount', 2),
    profileSystemIdx: parseInt($('profileSystem').value) || 0,
    profileColorIdx:  parseInt($('profileColor').value) || 0,
    softClose:        $('softClose').checked,
    isSinglePartition:$('singlePartition').checked,
    filmToggle:       ($('filmToggle') || {}).checked || false,
    rowMm:            (typeof rowMm !== 'undefined' && rowMm) ? rowMm.slice() : [],
    doorRowMm:        (typeof doorRowMm !== 'undefined' && doorRowMm) ? doorRowMm.slice() : [],
    sectOpt:          window._lastCalcData ? window._lastCalcData.sectOpt : null,
    doorFills:        window._lastCalcData ? window._lastCalcData.doorFills : null,
  };
}

function kupeSaveDraft() {
  if (!window._lastCalcData) {
    alert('Сначала рассчитайте параметры (нажмите "Рассчитать стоимость")');
    return;
  }
  if (!window._kupeProjectNum) window._kupeProjectNum = generateProjectNum();

  const draft = {
    schemaVersion: '1.0',
    projectNumber: window._kupeProjectNum,
    savedAt: new Date().toISOString(),
    pricesVersion: (typeof FILLINGS_VERSION !== 'undefined') ? FILLINGS_VERSION : '',
    client: {
      name:    ($('kpClient')   || {}).value || '',
      phone:   ($('kpPhone')    || {}).value || '',
      manager: ($('kpManager')  || {}).value || '',
    },
    modules: {
      kupe:     collectKupeState(),
      fasadAlu: (typeof AppState !== 'undefined') ? JSON.parse(JSON.stringify(AppState.fasadAlu || {})) : null,
      fasadMdf: (typeof AppState !== 'undefined') ? JSON.parse(JSON.stringify(AppState.fasadMdf || {})) : null,
    },
  };

  let list = [];
  try { list = JSON.parse(localStorage.getItem(KUPE_DRAFTS_KEY) || '[]'); } catch(e){ list = []; }
  // Заменяем существующий с тем же projectNumber или добавляем
  const filtered = list.filter(d => d.projectNumber !== draft.projectNumber);
  filtered.unshift(draft);
  // Храним последние 30
  const trimmed = filtered.slice(0, 30);
  try {
    localStorage.setItem(KUPE_DRAFTS_KEY, JSON.stringify(trimmed));
    alert('Сохранено: ПРОЕКТ № ' + draft.projectNumber);
  } catch(e) {
    alert('Ошибка сохранения: ' + e.message);
  }
}

function kupeOpenDraftsList() {
  // Удалить существующий поповер если есть
  document.querySelectorAll('.kupe-drafts-pop').forEach(p => p.remove());

  let list = [];
  try { list = JSON.parse(localStorage.getItem(KUPE_DRAFTS_KEY) || '[]'); } catch(e){}

  const pop = document.createElement('div');
  pop.className = 'kupe-drafts-pop';
  // Position rel to top-right
  pop.style.right = '24px';
  pop.style.top = '60px';

  if (!list.length) {
    pop.innerHTML = '<div class="kupe-drafts-empty">Нет сохранённых проектов</div>';
  } else {
    pop.innerHTML = list.map(d => {
      const k = (d.modules && d.modules.kupe) || {};
      const date = new Date(d.savedAt).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      const cli = (d.client && d.client.name) ? ' · '+d.client.name : '';
      return '<div class="kupe-drafts-row" onclick="kupeLoadDraft(\''+d.projectNumber+'\')">'+
        '<div class="kupe-drafts-row-num">ПРОЕКТ № '+d.projectNumber+'</div>'+
        '<div class="kupe-drafts-row-meta">'+date+' · '+(k.W||'—')+'×'+(k.H||'—')+' · '+(k.N||'—')+' дв.'+cli+'</div>'+
      '</div>';
    }).join('');
  }
  document.body.appendChild(pop);
  // Закрываем по клику вне
  setTimeout(() => {
    document.addEventListener('click', function close(e){
      if (!pop.contains(e.target)) {
        pop.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}

function kupeLoadDraft(projectNumber) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KUPE_DRAFTS_KEY) || '[]'); } catch(e){}
  const draft = list.find(d => d.projectNumber === projectNumber);
  if (!draft) { alert('Проект не найден'); return; }

  const k = (draft.modules && draft.modules.kupe) || {};
  // Восстанавливаем форму
  if (k.W != null) $('width').value  = k.W;
  if (k.H != null) $('height').value = k.H;
  if (k.N != null) {
    $('doorCount').value = k.N;
    updateChipsActive(k.N);
  }
  if (k.profileSystemIdx != null) {
    $('profileSystem').value = k.profileSystemIdx;
    populateProfileColors(k.profileSystemIdx);   // список цветов — от сохранённой системы
  }
  if (k.profileColorIdx != null)  $('profileColor').value  = k.profileColorIdx;
  // Сетка секций — по названию пресета
  if (k.sectOpt && k.sectOpt.label) {
    const si = SECTION_OPTS.findIndex(o => o.label === k.sectOpt.label);
    if (si >= 0) setSections(si);
  }
  // Заполнения секций — сопоставляем по названию материала с текущим каталогом
  if (Array.isArray(k.doorFills) && k.doorFills.length) {
    doorFills = k.doorFills.map(df => (df || []).map(f =>
      FILLINGS.find(x => f && x.n === f.n) || FILLINGS[0]));
  }
  $('softClose').checked        = !!k.softClose;
  $('singlePartition').checked  = !!k.isSinglePartition;
  if ($('filmToggle')) $('filmToggle').checked = !!k.filmToggle;
  if (k.rowMm)     rowMm     = k.rowMm.slice();
  if (k.doorRowMm) doorRowMm = k.doorRowMm.slice();

  // Клиент
  window._kupeDraftClient = draft.client || null;

  // ALU/МДФ модули
  if (typeof AppState !== 'undefined') {
    if (draft.modules && draft.modules.fasadAlu) Object.assign(AppState.fasadAlu, draft.modules.fasadAlu);
    if (draft.modules && draft.modules.fasadMdf) Object.assign(AppState.fasadMdf, draft.modules.fasadMdf);
  }
  if (typeof fasadRows !== 'undefined' && draft.modules && draft.modules.fasadAlu && draft.modules.fasadAlu.rows) {
    fasadRows = draft.modules.fasadAlu.rows.slice();
  }
  if (typeof mdfRows !== 'undefined' && draft.modules && draft.modules.fasadMdf && draft.modules.fasadMdf.rows) {
    mdfRows = draft.modules.fasadMdf.rows.slice();
  }

  // Запоминаем номер проекта
  window._kupeProjectNum = draft.projectNumber;

  // Пересчитываем
  onDoorCountChange();
  calculate();

  // Восстанавливаем поля КП после калькуляции
  if (draft.client) {
    if ($('kpClient'))  $('kpClient').value  = draft.client.name || '';
    if ($('kpPhone'))   $('kpPhone').value   = draft.client.phone || '';
    if ($('kpManager')) $('kpManager').value = draft.client.manager || '';
  }

  // Закрываем поповер
  document.querySelectorAll('.kupe-drafts-pop').forEach(p => p.remove());
}


// Init router after module loads
onHashChange();


// ALU module вынесен в js/fasad-alu.js

