(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  };
  const string = value => typeof value === 'string' ? value : '';
  const copy = value => typeof value === 'string' ? value : (value && typeof value.text === 'string' ? value.text : '');
  const list = value => Array.isArray(value) ? value : (value ? [value] : []);
  const route = entry => '#' + encodeURIComponent(entry.program.id) + '/' + encodeURIComponent(entry.lesson.id);
  let course, entries = [], current, imageFit = true, currentShot;

  function safeLocalImage(src) {
    if (typeof src !== 'string' || !src.trim()) return null;
    try {
      const url = new URL(src, location.href);
      return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }

  function normalizedMarks(shot) {
    if (!Array.isArray(shot.marks)) return [];
    const width = Number(shot.width), height = Number(shot.height);
    if (!(width > 0 && height > 0)) return [];
    return shot.marks.filter(mark => mark && [mark.x, mark.y, mark.w, mark.h].every(Number.isFinite) &&
      mark.x >= 0 && mark.y >= 0 && mark.w > 0 && mark.h > 0 && mark.x < width && mark.y < height)
      .map(mark => ({ ...mark, w: Math.min(mark.w, width - mark.x), h: Math.min(mark.h, height - mark.y) }));
  }

  function imageStage(shot, imageLabel) {
    const stage = node('span', 'shot-stage');
    const image = document.createElement('img');
    const src = safeLocalImage(shot.src);
    image.alt = string(shot.alt) || imageLabel;
    image.decoding = 'async';
    image.loading = 'eager';
    if (Number(shot.width) > 0) image.width = Number(shot.width);
    if (Number(shot.height) > 0) image.height = Number(shot.height);
    stage.append(image);
    const marks = normalizedMarks(shot);
    marks.forEach((mark, index) => {
      const box = node('span', 'shot-mark');
      box.style.left = (mark.x / shot.width * 100) + '%';
      box.style.top = (mark.y / shot.height * 100) + '%';
      box.style.width = (mark.w / shot.width * 100) + '%';
      box.style.height = (mark.h / shot.height * 100) + '%';
      box.setAttribute('aria-hidden', 'true');
      box.append(node('span', 'mark-number', String(index + 1)));
      stage.append(box);
    });
    function unavailable() {
      stage.replaceChildren(node('span', 'image-missing', 'Изображение не загрузилось. Текст инструкции доступен ниже.'));
    }
    image.addEventListener('error', unavailable, { once: true });
    if (src) image.src = src; else unavailable();
    return stage;
  }

  function openImage(shot, imageLabel, trigger) {
    currentShot = shot;
    imageFit = true;
    $('imageDialogTitle').textContent = imageLabel;
    $('imageDialogBody').replaceChildren(imageStage(shot, imageLabel));
    $('imageDialogBody').style.width = '';
    $('toggleImageSize').textContent = 'Исходный размер';
    $('imageDialog').showModal();
    $('imageDialog').addEventListener('close', () => trigger && trigger.focus(), { once: true });
  }

  function shotFigure(shot, imageLabel, printing) {
    const figure = node('figure', 'shot-figure');
    if (printing) figure.append(imageStage(shot, imageLabel));
    else {
      const imageButton = node('button', 'shot-open');
      imageButton.type = 'button';
      imageButton.setAttribute('aria-label', 'Увеличить: ' + imageLabel);
      imageButton.dataset.testid = 'open-annotated-image';
      imageButton.append(imageStage(shot, imageLabel));
      imageButton.addEventListener('click', () => openImage(shot, imageLabel, imageButton));
      figure.append(imageButton);
    }
    const caption = node('figcaption', 'shot-meta');
    caption.append(node('span', '', string(shot.caption) || (normalizedMarks(shot).length ? 'Номера на снимке соответствуют пояснениям ниже.' : 'Обзор экрана. Выделения для этого снимка не заданы.')));
    if (!printing) {
      const enlarge = node('button', '', 'Открыть крупно');
      enlarge.type = 'button';
      enlarge.addEventListener('click', () => openImage(shot, imageLabel, enlarge));
      caption.append(enlarge);
    }
    figure.append(caption);
    const legend = node('ol', 'mark-legend');
    normalizedMarks(shot).forEach((mark, index) => {
      const label = copy(mark.label);
      if (!label || /^\d+$/.test(label.trim())) return;
      const item = node('li');
      item.append(node('span', 'legend-number', String(index + 1)), node('span', '', label));
      legend.append(item);
    });
    if (legend.childElementCount) figure.append(legend);
    return figure;
  }

  function appendCopyBlock(parent, title, value, className) {
    const content = copy(value);
    if (!content) return;
    const dl = node('dl', 'explanation' + (className ? ' ' + className : ''));
    dl.append(node('dt', '', title), node('dd', '', content));
    parent.append(dl);
  }

  function buildLesson(entry, printing) {
    const { program, lesson, position } = entry;
    const fragment = document.createDocumentFragment();
    const header = node('header', 'lesson-header');
    const kicker = node('div', 'lesson-kicker');
    kicker.append(node('span', 'program-label', program.title), node('span', '', 'Урок ' + (position + 1) + ' из ' + program.lessons.length));
    header.append(kicker, node('h1', '', lesson.title));
    if (copy(lesson.goal)) header.append(node('p', 'lesson-goal', copy(lesson.goal)));
    if (copy(lesson.description)) header.append(node('p', 'lesson-description', copy(lesson.description)));
    fragment.append(header);
    const steps = node('div', 'lesson-steps');
    list(lesson.steps).forEach((step, index) => {
      const section = node('section', 'step');
      const heading = node('div', 'step-heading');
      heading.append(node('span', 'step-count', String(index + 1)), node('h2', '', string(step.title) || 'Шаг ' + (index + 1)));
      section.append(heading);
      const shots = step.shot ? [step.shot] : list(step.shots);
      shots.forEach((shot, shotIndex) => section.append(shotFigure(shot, lesson.title + ' - шаг ' + (index + 1) + (shots.length > 1 ? ', изображение ' + (shotIndex + 1) : ''), printing)));
      const explanation = node('div', 'step-copy');
      appendCopyBlock(explanation, 'Действие', step.text);
      appendCopyBlock(explanation, 'Зачем', step.why);
      appendCopyBlock(explanation, 'Результат', step.result, 'result');
      if (explanation.childElementCount) section.append(explanation);
      steps.append(section);
    });
    if (!steps.childElementCount) steps.append(node('p', 'image-missing', 'Шаги этого урока ещё не добавлены.'));
    fragment.append(steps);
    const checks = list(lesson.check).map(copy).filter(Boolean);
    if (checks.length) {
      const panel = node('section', 'check-panel');
      panel.append(node('h2', '', 'Проверьте себя'));
      const ul = node('ul'); checks.forEach(check => ul.append(node('li', '', check))); panel.append(ul); fragment.append(panel);
    }
    const notes = list(lesson.notes).map(copy).filter(Boolean);
    if (notes.length) {
      const panel = node('aside', 'notes'); panel.append(node('h2', '', 'Что учитывать'));
      const ul = node('ul'); notes.forEach(note => ul.append(node('li', '', note))); panel.append(ul); fragment.append(panel);
    }
    return fragment;
  }

  function searchText(entry) {
    return [entry.program.title, entry.lesson.title, copy(entry.lesson.goal), ...list(entry.lesson.steps).flatMap(step => [copy(step.text), copy(step.why), copy(step.result)])].join(' ').toLocaleLowerCase('ru-RU');
  }

  function renderNavigation(target, query) {
    target.replaceChildren();
    query = string(query).trim().toLocaleLowerCase('ru-RU');
    let matches = 0;
    course.programs.forEach(program => {
      const matching = entries.filter(entry => entry.program === program && (!query || searchText(entry).includes(query)));
      if (!matching.length) return;
      const section = node('section', 'nav-program'); section.append(node('h2', '', program.title));
      const ul = node('ol', 'nav-list');
      matching.forEach(entry => {
        matches++;
        const li = node('li'), link = node('a', 'lesson-link');
        link.href = route(entry);
        link.dataset.testid = 'lesson-link';
        if (entry === current) link.setAttribute('aria-current', 'page');
        link.append(node('span', 'lesson-number', String(entry.position + 1).padStart(2, '0')), node('span', '', entry.lesson.title));
        link.addEventListener('click', () => { if ($('contentsDialog').open) $('contentsDialog').close(); });
        li.append(link); ul.append(li);
      });
      section.append(ul); target.append(section);
    });
    if (!matches) target.append(node('p', 'nav-empty', 'Ничего не найдено. Попробуйте название действия или программы.'));
  }

  function updateNavigation() {
    if (!course) return;
    renderNavigation($('courseNav'), $('lessonSearch').value);
    renderNavigation($('mobileNav'), $('mobileSearch').value);
  }

  function renderPager(entry) {
    const pager = $('lessonPager'); pager.replaceChildren();
    const index = entries.indexOf(entry);
    for (const [offset, label, className] of [[-1, 'Предыдущий урок', 'previous'], [1, 'Следующий урок', 'next']]) {
      const target = entries[index + offset];
      if (!target) continue;
      const link = node('a', 'pager-link ' + className); link.href = route(target);
      link.append(node('small', '', label), node('b', '', target.lesson.title)); pager.append(link);
    }
    pager.hidden = false;
  }

  function routeFromHash(focus) {
    if (!entries.length) return;
    const hash = location.hash.slice(1);
    let desired;
    if (hash) {
      const pieces = hash.split('/');
      try { desired = entries.find(entry => entry.program.id === decodeURIComponent(pieces[0]) && entry.lesson.id === decodeURIComponent(pieces[1] || '')); } catch (_) { /* invalid fragment is reported below */ }
    } else desired = entries[0];
    if (!desired) {
      $('lessonContent').hidden = true; $('lessonPager').hidden = true;
      $('loadState').hidden = false;
      $('loadState').replaceChildren(node('h1', '', 'Урок не найден'), node('p', '', 'Выберите урок в содержании. Ссылка могла относиться к прежней версии обучения.'));
      const first = node('a', 'button', 'Открыть первый урок'); first.href = route(entries[0]); $('loadState').append(first);
      current = null; updateNavigation(); return;
    }
    current = desired;
    $('loadState').hidden = true;
    $('lessonContent').replaceChildren(buildLesson(current, false));
    $('lessonContent').hidden = false;
    document.title = current.lesson.title + ' - ' + current.program.title + ' - Обучение';
    updateNavigation(); renderPager(current);
    if (focus) { $('lessonContent').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }

  function loadError(message) {
    $('loadState').hidden = false;
    $('lessonContent').hidden = true; $('lessonPager').hidden = true;
    $('loadState').replaceChildren(node('h1', '', 'Не удалось открыть обучение'), node('p', '', message));
    const retry = node('button', 'button', 'Повторить'); retry.type = 'button'; retry.addEventListener('click', load); $('loadState').append(retry);
  }

  async function load() {
    $('printCourse').disabled = true;
    course = undefined; entries = []; current = undefined;
    $('courseNav').replaceChildren(); $('mobileNav').replaceChildren();
    $('lessonContent').hidden = true; $('lessonPager').hidden = true;
    $('loadState').hidden = false;
    $('loadState').replaceChildren(node('h1', '', 'Загружаю обучение'), node('p', '', 'Открываю инструкции и изображения.'));
    try {
      const response = await fetch('./lessons.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Файл с уроками пока недоступен. Повторите загрузку после добавления материалов.');
      const data = await response.json();
      if (!data || !Array.isArray(data.programs)) throw new Error('Файл обучения имеет неподдерживаемый формат.');
      const unique = new Set(); entries = [];
      data.programs.forEach(program => {
        if (!program || !string(program.id) || !string(program.title) || !Array.isArray(program.lessons)) throw new Error('В обучении не заполнены программа или её уроки.');
        program.lessons.forEach((lesson, position) => {
          if (!lesson || !string(lesson.id) || !string(lesson.title) || !Array.isArray(lesson.steps)) throw new Error('Один из уроков заполнен не полностью.');
          const key = program.id + '/' + lesson.id;
          if (unique.has(key)) throw new Error('В обучении повторяется адрес урока.');
          unique.add(key); entries.push({ program, lesson, position });
        });
      });
      if (!entries.length) throw new Error('Уроки ещё не добавлены. Здесь не показываются демонстрационные материалы.');
      course = data;
      $('versionLabel').textContent = string(data.versionLabel);
      $('updatedLabel').textContent = data.updated ? 'Обновлено: ' + string(data.updated) : '';
      if (typeof data.reviewHref === 'string') {
        const url = new URL(data.reviewHref, location.href);
        if (url.origin === location.origin) $('reviewLink').href = url.href;
      }
      $('printCourse').disabled = false;
      routeFromHash(false);
    } catch (error) { course = undefined; entries = []; loadError(error instanceof Error ? error.message : 'Проверьте подключение и повторите загрузку.'); }
  }

  async function printCourse() {
    if (!entries.length) return;
    const button = $('printCourse'); button.disabled = true; button.textContent = 'Готовлю страницы…';
    const root = $('printRoot'); root.replaceChildren();
    root.append(node('h1', 'print-course-title', 'Обучение работе с мебельными программами'));
    root.append(node('p', 'print-meta', [string(course.versionLabel), string(course.updated)].filter(Boolean).join(' · ')));
    course.programs.forEach(program => {
      const section = node('section', 'print-program'); section.append(node('h2', 'print-program-title', program.title));
      entries.filter(entry => entry.program === program).forEach(entry => {
        const article = node('article', 'print-lesson'); article.append(buildLesson(entry, true)); section.append(article);
      });
      root.append(section);
    });
    try {
      await Promise.allSettled([...root.querySelectorAll('img')].map(img => img.decode()));
      window.print();
    } finally { button.disabled = false; button.textContent = 'Версия для печати'; }
  }

  $('lessonSearch').addEventListener('input', updateNavigation);
  $('mobileSearch').addEventListener('input', updateNavigation);
  $('openContents').addEventListener('click', () => { $('contentsDialog').showModal(); $('mobileSearch').focus(); });
  $('closeContents').addEventListener('click', () => $('contentsDialog').close());
  $('contentsDialog').addEventListener('close', () => $('openContents').focus());
  $('closeImage').addEventListener('click', () => $('imageDialog').close());
  $('toggleImageSize').addEventListener('click', () => {
    imageFit = !imageFit;
    $('imageDialogBody').style.width = imageFit ? '' : Number(currentShot.width) + 'px';
    $('toggleImageSize').textContent = imageFit ? 'Исходный размер' : 'Вписать в окно';
  });
  $('printCourse').addEventListener('click', printCourse);
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    if (!$('lessonContent').hidden) $('lessonContent').focus();
    else $('lessonSearch').focus();
  });
  window.addEventListener('hashchange', () => routeFromHash(true));
  load();
})();
