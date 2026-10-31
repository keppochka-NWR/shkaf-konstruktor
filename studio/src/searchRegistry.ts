// Реестр поиска по параметрам (Макс 31.10.2026). Скрытых панелей нет в DOM, поэтому каждый пункт знает дорогу сам:
// этап, нужен ли выбранный шкаф, что открыть (документы, меню ПКМ, план) и где на экране цель — список селекторов по порядку.
// Селекторы — по aria-label, data-setting, data-testid, data-search, data-tour: переживают перестановку панелей (claude/ui-layout).
// Добавить пункт: новая запись ниже — title (как в интерфейсе), where (путь), keys (слова и синонимы), куда идти и target.
// Текстовый фильтр в селекторе: «селектор::текст» — элемент, в тексте которого есть «текст».
import type { Module } from "./model";
import type { OutputTab } from "./ProjectDock";
import type { SearchEntry } from "./searchMatch";

export type SearchKind = "Поле" | "Кнопка" | "Раздел" | "Меню ПКМ" | "Клавиши" | "Вид" | "Документ" | "Обучение";
export type SearchItem = SearchEntry & {
  kind: SearchKind;
  /** Этап, на котором пункт виден (docs не переключается — документы открываются окном). */
  stage?: "room" | "bodies";
  /** Нужен выбранный шкаф: панель свойств модуля. */
  module?: boolean;
  /** Почему пункт не подходит к выбранному шкафу (серым, с причиной). */
  applies?: (m: Module) => string | undefined;
  /** Включить «План» (true) или 3D-вид (false). */
  plan?: boolean;
  /** Раскрыть верхнюю панель (кнопки «Показать клиенту», «Сохранить файл»…). */
  top?: boolean;
  /** Открыть окно документов на вкладке. */
  output?: OutputTab;
  /** Открыть круговое меню выбранного шкафа и подсветить пункт с этой подписью ('' — само меню). */
  radial?: string;
  /** Нажать перед поиском цели (например, цену внизу — открыть панель стоимости). */
  click?: string;
  /** Цель на экране: первый найденный и видимый. */
  target: string[];
  /** Короткая подсказка после перехода (как пользоваться найденным). */
  note?: string;
  action?: "tour" | "help" | "cloud";
  /** Работает и в пустой комнате (палитра слева). */
  empty?: boolean;
  /** Только в полном редакторе (в пустой комнате этих панелей нет). */
  full?: boolean;
  /** Только в папке клиента (заказ с комнатами). */
  folder?: boolean;
};

const raw = (m: Module) => (m.raw ? "Модуль из Базиса: правится в Базисе (переимпорт)" : undefined);
const kupe = (m: Module) => (m.kupe ? "У дверей купе свои настройки — справа" : undefined);
const body = (m: Module) => raw(m) ?? kupe(m);
const doors = (m: Module) => body(m) ?? (!m.doors && !m.kitchen ? "У шкафа нет распашных фасадов — включите «Распашные фасады»" : undefined);
const std = (m: Module) => body(m) ?? (m.kitchen || m.worktop ? "У кухонного модуля своя панель справа" : m.corner ? "У углового модуля своя панель справа" : undefined);
const stdDoors = (m: Module) => std(m) ?? (!m.doors ? "У шкафа нет распашных фасадов — включите «Распашные фасады»" : undefined);

// кухонные модули (критик 31.10): ящики — у нижних, система ящиков — когда они есть, стеклянные полки — когда есть полки
const kDrawers = (m: Module) => body(m) ?? (m.kitchen && !m.kdrawers?.length && (m.kitchen.role !== "base" || m.kitchen.appliance) ? "У этого кухонного модуля ящиков нет — они у нижних модулей" : undefined);
const kSlides = (m: Module) => body(m) ?? (m.kitchen && !m.kdrawers?.length ? "Сначала добавьте ящики в модуль" : undefined);
const kGlass = (m: Module) => body(m) ?? (m.kitchen && (m.kdrawers?.length || m.sections.every((s) => s.drawers > 0)) ? "В модуле только ящики — полок нет" : undefined);

const M = { kind: "Поле" as const, stage: "bodies" as const, module: true };
const F = "Мебель › ";
export const SEARCH_ITEMS: SearchItem[] = [
  // ——— шкаф: габариты и положение ———
  { ...M, rank: 0.3, id: "width", title: "Ширина корпуса", where: F + "Габариты", keys: ["ширина", "ширина шкафа", "размер", "габарит"], applies: raw, target: ['[data-setting="Габариты"] input[aria-label="Ширина"]', 'input[aria-label="Ширина"]', 'input[aria-label="Ширина проёма купе"]', '[data-setting="Габариты"]'] },
  { ...M, rank: 0.3, id: "height", title: "Высота корпуса", where: F + "Габариты", keys: ["высота", "высота шкафа", "размер", "габарит"], applies: raw, target: ['[data-setting="Габариты"] input[aria-label="Высота"]', 'input[aria-label="Высота"]', 'input[aria-label="Высота с опорами"]', 'input[aria-label="Высота проёма купе"]', '[data-setting="Габариты"]'] },
  { ...M, id: "depth", title: "Глубина корпуса", where: F + "Габариты", keys: ["глубина", "размер", "габарит"], applies: raw, target: ['[data-setting="Габариты"] input[aria-label="Глубина"]', 'input[aria-label="Глубина"]', '[data-setting="Габариты"]'] },
  { ...M, kind: "Кнопка", id: "upper", title: "Антресоль сверху", where: F + "Габариты", keys: ["антресоль", "над шкафом", "верхний модуль"], applies: std, target: ['[data-search="upper"]'] },
  { ...M, id: "position", title: "Положение в комнате", where: F + "Положение", keys: ["положение", "от стены", "отступ", "поворот", "от пола", "навесной"], applies: std, target: ['[data-setting="Положение"] input[aria-label="От левой стены"]', 'input[aria-label="Поворот кухонного модуля"]', '[data-setting="Положение"]'] },
  { ...M, kind: "Кнопка", id: "mirror-filling", title: "Зеркально отразить наполнение", where: F + "Положение", keys: ["отразить", "зеркально", "поменять местами", "левый правый"], applies: std, target: ['[data-search="mirror-filling"]'] },
  // ——— материалы ———
  { ...M, kind: "Кнопка", id: "decor", title: "Цвет корпуса (декор)", where: F + "Материал корпуса", keys: ["цвет", "декор", "материал", "лдсп", "текстура", "цвет корпуса"], applies: body, target: ['[data-search="decor"]', '[aria-label$="— выбрать декор"]', '[data-setting="Материал корпуса"]'] },
  { ...M, kind: "Кнопка", id: "facade-decor", title: "Цвет фасадов", where: F + "Фасад", keys: ["цвет фасадов", "декор фасадов", "материал фасадов", "цвет", "декор"], applies: doors, target: ['[data-search="facade-decor"]', '[aria-label^="Фасады:"][aria-label$="выбрать декор"]', 'select[aria-label="Материал кухонных фасадов"]'] },
  { ...M, id: "edge-body", title: "Кромка корпуса", where: F + "Конструкция и фурнитура", keys: ["кромка", "пвх", "торец"], applies: std, target: ['select[aria-label="Кромка корпуса"]', 'select[aria-label="Кромка открытых торцов"]'] },
  { ...M, id: "edge-facade", title: "Кромка фасадов", where: F + "Конструкция и фурнитура", keys: ["кромка", "кромка фасадов"], applies: stdDoors, target: ['select[aria-label="Кромка фасадов корпуса"]'] },
  // ——— наполнение ———
  { ...M, id: "shelves", title: "Полки", where: F + "Наполнение секции", keys: ["полка", "полки", "полок", "полочка", "добавить полку", "количество полок", "наполнение"], applies: body, target: ['button[aria-label="Добавить: Полки"]', 'select[aria-label="Количество полок кухонного модуля"]', '[aria-label="Количество полок угловой секции"]', '[data-setting="Полки"]'] },
  { ...M, id: "shelf-depth", title: "Глубина полок", where: F + "Полки", keys: ["глубина полок", "полка"], applies: std, target: ['input[aria-label="Глубина полок"]', '[data-setting="Полки"]'] },
  { ...M, rank: 0.2, id: "glass-shelf", title: "Стеклянная полка", where: F + "Секция", keys: ["стекло", "стеклянная полка", "полка из стекла"], applies: kGlass, note: "Выберите полку в сцене — появится флажок «Стеклянная полка»", target: ['input[aria-label="Стеклянная полка"]', 'input[aria-label^="Полки из стекла"]', 'select[aria-label="Толщина стекла полок"]', '[data-setting="Дополнительные параметры секции"]'] },
  { ...M, id: "drawers", title: "Ящики", where: F + "Наполнение секции", keys: ["ящик", "ящики", "выдвижной", "комод", "добавить ящик", "наполнение"], applies: kDrawers, target: ['button[aria-label="Добавить: Ящики"]', 'select[aria-label="Ящики нижнего модуля"]', '[role=group][aria-label="Количество ящиков"]', '[aria-label="Количество ящиков угловой секции"]', '[data-setting="Ящики"]'] },
  { ...M, id: "slides", title: "Направляющие ящиков", where: F + "Ящики", keys: ["направляющие", "шариковые", "скрытого монтажа", "доводчик ящика", "ящик"], applies: kSlides, target: ['select[aria-label="Направляющие ящика"]', 'select[aria-label="Система ящиков"]', '[data-setting="Ящики"]'] },
  { ...M, id: "rod", title: "Штанга", where: F + "Штанги", keys: ["штанга", "вешалка", "плечики", "одежда", "наполнение"], applies: std, target: ['button[role="switch"][aria-label="Штанга"]', '[data-setting="Штанги"]'] },
  { ...M, kind: "Кнопка", id: "pantograph", title: "Пантограф", where: F + "Штанги", keys: ["пантограф", "лифт для одежды", "штанга"], applies: std, target: ['[data-search="pantograph"]', '[data-setting="Штанги"]'] },
  { ...M, id: "pullout", title: "Выдвижной тремпель", where: F + "Штанги", keys: ["тремпель", "выдвижная вешалка"], applies: std, target: ['[aria-label="Выдвижные тремпели в секции"]'] },
  { ...M, id: "section-width", title: "Ширина секции", where: F + "Секция", keys: ["секция", "ширина секции", "разделить", "перегородка", "проём"], applies: std, target: ['input[aria-label="Внутренняя ширина"]', '[data-setting="Секция"]'] },
  { ...M, kind: "Раздел", id: "dividers", title: "Перегородки секции", where: F + "Наполнение", keys: ["перегородка", "частичная перегородка", "стойка"], applies: std, target: ['[data-setting="Перегородки секции"]', 'input[aria-label="Внутренняя ширина"]'] },
  { ...M, kind: "Кнопка", id: "copy-filling", title: "Копировать наполнение секции", where: F + "Секция", keys: ["копировать наполнение", "вставить наполнение", "копия"], applies: std, target: ['[data-search="copy-filling"]', '[data-setting="Секция"]'] },
  { ...M, kind: "Кнопка", id: "clear-section", title: "Очистить наполнение секции", where: F + "Очистка секции", keys: ["очистить", "удалить наполнение", "удалить секцию"], applies: std, target: ['[data-setting="Очистка секции"]'] },
  { ...M, id: "light", title: "Подсветка", where: F + "Подсветка", keys: ["подсветка", "свет", "led", "светодиодная лента", "профиль подсветки"], applies: std, target: ['input[aria-label="Подсветка в стойках"]', '[data-setting="Подсветка"]'] },
  // ——— фасады и фурнитура ———
  { ...M, id: "doors", rank: 0.3, title: "Распашные фасады", where: F + "Фасад", keys: ["фасад", "фасады", "двери", "створки", "дверцы", "добавить фасады"], applies: body, target: ['button[role="switch"][aria-label="Распашные фасады"]', 'input[aria-label="Распашные фасады"]', 'select[aria-label="Число створок"]', '[data-setting="Фасад"]'] },
  { ...M, id: "facade-kind", title: "Тип фасадов: ЛДСП, МДФ, ALU", where: F + "Фасад", keys: ["тип фасадов", "мдф", "вернисаж", "alu", "алюминиевая рамка", "фасад"], applies: body, target: ['select[aria-label="Тип распашных фасадов"]', 'select[aria-label="Материал кухонных фасадов"]', '[data-setting="Фасад"]'] },
  { ...M, id: "leaves", title: "Створки секции", where: F + "Фасады секции", keys: ["створки", "одна створка", "две створки", "дверь"], applies: stdDoors, target: ['select[aria-label="Створки выбранной секции"]', 'select[aria-label="Число створок"]'] },
  { ...M, id: "hinges", title: "Петли", where: F + "Тип открывания", keys: ["петли", "петля", "blum", "hettich", "gtv", "блюм", "хеттих", "хетих", "гтв", "фурнитура"], rank: 0.3, applies: doors, target: ['select[aria-label="Петли корпуса"]', 'select[aria-label="Бренд петель кухонного модуля"]'] },
  { ...M, id: "hinge-side", title: "Сторона петель", where: F + "Фасады секции", keys: ["петли слева", "петли справа", "сторона открывания", "петли"], applies: doors, target: ['select[aria-label="Петли выбранной секции"]', 'select[aria-label="Сторона петель кухонного модуля"]', 'select[aria-label="Сторона петель"]'] },
  { ...M, id: "hinge-165", title: "Петли 155–165°", where: F + "Тип открывания", keys: ["165", "угол петель", "широкий угол открывания", "петли"], applies: stdDoors, target: ['input[aria-label="Петли 155–165°"]'] },
  { ...M, id: "opening", title: "Открывание: ручки или нажатием", where: F + "Тип открывания", keys: ["открывание", "push", "нажатием", "tip on", "без ручек", "доводчик"], applies: doors, target: ['select[aria-label="Открывание фасадов"]', 'input[aria-label="Профиль Gola"]', 'input[aria-label="Ручки на фасадах"]', '[data-setting="Тип открывания"]'] },
  { ...M, kind: "Кнопка", id: "handles", title: "Ручки", where: F + "Ручки", keys: ["ручка", "ручки", "скоба", "кнопка ручка"], applies: body, target: ['[data-search="handles"]', 'select[aria-label="Расположение ручек модуля"]', '[data-setting="Ручки"]'] },
  { ...M, id: "handle-height", title: "Высота ручек от пола", where: F + "Ручки", keys: ["высота ручек", "ручки от пола", "ручка"], applies: stdDoors, target: ['[data-testid="module-handle-floor"] input', '[data-setting="Ручки"]'] },
  { ...M, id: "mirror", title: "Зеркало на фасадах", where: F + "Конструкция и фурнитура", keys: ["зеркало", "зеркальный фасад"], applies: stdDoors, target: ['select[aria-label="Зеркало на фасадах"]'] },
  // ——— конструкция ———
  { ...M, id: "plinth", title: "Цоколь и опоры", where: F + "Опоры", keys: ["цоколь", "основание", "ножки", "опоры", "высота цоколя"], applies: std, target: ['select[aria-label="Высота цоколя"]', 'select[aria-label="Основание корпуса"]', '[data-setting="Опоры"]'] },
  { ...M, id: "fillers", rank: 0.2, title: "Фальши и фальшпанели", where: F + "Конструкция и фурнитура", keys: ["фальш", "фальшпанель", "фп", "добор", "планка у стены", "боковая панель"], applies: std, target: ['input[aria-label="Боковая фальшпанель слева"]', 'input[aria-label="Без фальша у стены"]'] },
  { ...M, id: "back", title: "Задняя стенка", where: F + "Конструкция и фурнитура", keys: ["задник", "задняя стенка", "лхдф", "хдф", "паз"], applies: body, target: ['select[aria-label="Тип задней стенки"]', 'select[aria-label="Задняя стенка кухонного модуля"]', 'select[aria-label="Задняя стенка углового модуля"]'] },
  { ...M, id: "bottom", title: "Дно корпуса", where: F + "Конструкция и фурнитура", keys: ["дно", "без дна", "скамья"], applies: std, target: ['select[aria-label="Дно корпуса"]'] },
  { ...M, id: "top", title: "Крыша", where: F + "Конструкция и фурнитура", keys: ["крыша", "стеклянная крыша", "без крыши", "стекло"], applies: std, target: ['select[aria-label="Материал крыши"]'] },
  { ...M, id: "top-strip", title: "Планка под крышей (карниз)", where: F + "Конструкция и фурнитура", keys: ["карниз", "планка", "планка под крышей"], applies: std, target: ['select[aria-label="Планка под крышей"]'] },
  { ...M, id: "fastening", title: "Крепёж корпуса", where: F + "Конструкция и фурнитура", keys: ["крепеж", "конфирмат", "эксцентрик", "минификс"], applies: std, target: ['select[aria-label="Крепёж корпуса"]'] },
  { ...M, id: "slope", title: "Скос под потолок", where: F + "Конструкция и фурнитура", keys: ["скос", "наклонный потолок", "скошенный шкаф"], applies: std, target: ['select[aria-label="Скос под потолок"]', 'input[aria-label="Мансарда (скос назад)"]'] },
  { ...M, id: "mansard", title: "Мансарда (скос назад)", where: F + "Фигурные детали", keys: ["мансарда", "скос", "скат"], applies: std, target: ['input[aria-label="Мансарда (скос назад)"]', 'select[aria-label="Скос под потолок"]'] },
  { ...M, id: "skew", title: "Скос фронта в плане", where: F + "Конструкция и фурнитура", keys: ["скос", "трапеция", "косой фасад"], applies: std, target: ['select[aria-label="Скос фронта в плане"]'] },
  { ...M, kind: "Кнопка", id: "cutouts", title: "Вырезы в деталях", where: F + "Фигурные детали", keys: ["вырез", "вырезы", "плинтус", "труба", "отверстие", "под розетку"], applies: std, note: "Или правой кнопкой по детали → «Вырез…»", target: ['[data-search="cutouts"]', '[data-testid="shape-panel"]'] },
  // ——— меню правой кнопкой ———
  { ...M, kind: "Меню ПКМ", id: "radial", title: "Меню правой кнопкой", where: "Сцена › правая кнопка по шкафу", keys: ["правая кнопка", "пкм", "меню", "круговое меню", "контекстное меню", "действия"], radial: "", target: [".radial-menu .radial-ring", ".radial-menu [role=menuitem]"] },
  { ...M, kind: "Меню ПКМ", id: "radial-wall", title: "Поставить к стене", where: "Меню ПКМ › Поставить к стене", keys: ["к стене", "прижать к стене", "у стены"], radial: "Поставить к стене", applies: (m) => (m.worktop ? "Столешница ставится на модули" : undefined), target: [".radial-menu [role=menuitem]::Поставить к стене"] },
  { ...M, kind: "Меню ПКМ", id: "radial-copy", title: "Копия корпуса", where: "Меню ПКМ › Копия", keys: ["копия", "копировать шкаф", "дублировать", "такой же"], radial: "Копия", target: [".radial-menu [role=menuitem]::Копия"] },
  { ...M, kind: "Меню ПКМ", id: "radial-worktop", title: "Столешница на модуль", where: "Меню ПКМ › Столешница на модуль", keys: ["столешница", "стол", "столешница на шкаф"], radial: "Столешница на модуль", applies: (m) => (m.worktop || m.kupe || m.raw ? "Для этого модуля столешницы нет" : undefined), target: [".radial-menu [role=menuitem]::Столешница"] },
  { ...M, kind: "Меню ПКМ", id: "radial-facades", title: "Фасады: петли, ручки, открывание", where: "Меню ПКМ › Фасады", keys: ["петли меню", "фасады меню", "редактировать фасад", "редактор фасадов"], radial: "Фасады", target: [".radial-menu [role=menuitem]::Фасад"] },
  { ...M, kind: "Меню ПКМ", id: "radial-hide", title: "Скрыть модуль", where: "Меню ПКМ › Скрыть модуль", keys: ["скрыть", "спрятать шкаф"], radial: "Скрыть", target: [".radial-menu [role=menuitem]::Скрыть"] },
  // ревизия структуры 31.10: функции, доступные только правой кнопкой или клавишами, — самые ценные цели поиска
  { ...M, kind: "Меню ПКМ", id: "radial-corner", title: "Продолжить ряд за угол", where: "Меню ПКМ › Продолжить ряд за угол", keys: ["за угол", "продолжить ряд", "второе крыло", "угловой ряд"], radial: "Продолжить ряд за угол", note: "Пункт есть у крайнего модуля ряда у стены", target: [".radial-menu [role=menuitem]::Продолжить ряд"] },
  { ...M, kind: "Меню ПКМ", rank: -0.3, id: "radial-fillers", title: "Фальши (меню ПКМ)", where: "Меню ПКМ › Фальши", keys: ["фальш", "фальши", "фп", "фальшпанель", "добор", "планка под крышей"], radial: "Фальши", applies: std, target: [".radial-menu [role=menuitem]::Фальши"] },
  { ...M, kind: "Меню ПКМ", id: "radial-match", title: "Высота или глубина как у соседа", where: "Меню ПКМ › Размеры › …как у соседа", keys: ["как у соседа", "высота как у соседа", "глубина как у соседа", "по соседу", "выровнять по соседу"], radial: "Размеры", note: "В кольце «Размеры» — «Высота / Глубина как у соседа»", target: [".radial-menu [role=menuitem]::Размеры"] },
  { ...M, kind: "Меню ПКМ", id: "radial-align", title: "Выровнять отмеченные", where: "Меню ПКМ › Выровнять отмеченные", keys: ["выровнять", "выровнять отмеченные", "одинаковая высота", "одинаковая глубина"], radial: "Выровнять отмеченные", note: "Высота или глубина отмеченных — как у этого модуля", target: [".radial-menu [role=menuitem]::Выровнять отмеченные"] },
  // удаление (критик 31.10): модуль — кнопкой слева или Delete; полка/ящик — щелчок по детали и Delete
  { ...M, kind: "Кнопка", id: "delete-module", title: "Удалить модуль", where: "Мебель › Слева · клавиша Delete", keys: ["удалить", "удалить шкаф", "удалить модуль", "удалить корпус", "delete"], note: "Или выделите модуль и нажмите Delete — с вопросом «Да, удалить»; вернуть — Ctrl+Z", target: ['[data-tour="modules"] button::Удалить выбранный модуль'] },
  { ...M, kind: "Клавиши", id: "delete-part", title: "Удалить полку, ящик или штангу", where: "Сцена › щелчок по детали · Delete", keys: ["удалить полку", "удалить ящик", "удалить штангу", "удалить фасад", "удалить", "delete"], note: "Щёлкните полку или ящик в сцене → Delete или «Удалить» на плашке; или правая кнопка → «Удалить»", target: ['[data-testid="scene"]'] },
  { ...M, id: "sink", title: "Мойка в столешнице", where: "Кухня › Столешница › Вырезы", keys: ["мойка", "раковина", "вырез под мойку"], applies: (m) => (m.worktop ? undefined : "Мойка — вырез в столешнице: выберите столешницу"), target: ['select[aria-label="Модель мойки"]', '[role=group][aria-label^="Вырез "]', 'select[aria-label="Материал столешницы"]'] },
  { ...M, id: "oven", title: "Ниша духовки", where: "Кухня › Модуль под духовку", keys: ["духовка", "духовой шкаф", "ниша духовки"], applies: (m) => (m.kitchen?.oven || m.kitchen?.column?.kind === "oven" ? undefined : "Духовка — в кухонном модуле под духовку"), target: ['input[aria-label="Высота ниши духовки"]'] },
  { ...M, kind: "Меню ПКМ", id: "cut-similar", title: "Вырез на схожие детали", where: "Правая кнопка по детали с вырезом", keys: ["вырез на схожие", "перенести вырез", "скопировать вырез", "вырез"], applies: std, note: "Правая кнопка по детали с вырезом → «Вырез на схожие…»; или «Вырезы деталей…» здесь", target: ['[data-search="cutouts"]', '[data-testid="shape-panel"]'] },
  { ...M, id: "door-mount", title: "Монтаж фасадов: накладные или вкладные", where: F + "Конструкция и фурнитура", keys: ["монтаж фасада", "накладные", "вкладные", "тип петли", "накладная петля", "вкладная петля"], applies: stdDoors, target: ['select[aria-label="Монтаж фасадов"]'] },
  { kind: "Клавиши", stage: "bodies", id: "type-size", title: "Точный размер при растяжении «600;2400»", where: "Сцена › тяга за угол корпуса", keys: ["600;2400", "точный размер", "ввод размера", "растянуть", "растяжение", "тянуть за угол"], note: "Тяните угол выбранного корпуса и наберите «600;2400» → Enter: оба размера сразу; «;2400» — только второй", target: ['[data-tour="guides"]', '[data-testid="scene"]'] },
  { kind: "Клавиши", stage: "bodies", id: "snap-keys", title: "Привязки Alt и Ctrl при перетаскивании", where: "Сцена › при перетаскивании", keys: ["alt", "ctrl", "привязка к линии", "к пересечению", "пересечение линий"], note: "Тяните корпус или угол: Alt — к линии, Ctrl — к пересечению; без привязки — снимите «Привязки корпусов»", target: ['input[aria-label="Привязки корпусов"]', '[data-tour="guides"]'] },
  { kind: "Клавиши", stage: "bodies", id: "wheel-door", title: "Открыть створку колёсиком", where: "Сцена › средняя кнопка мыши", keys: ["колесо", "колесиком", "средняя кнопка", "открыть створку", "открыть ящик", "открыть дверцу"], note: "Щелчок колёсиком по фасаду — открыть или закрыть створку или ящик; по корпусу — весь модуль", target: ['[data-testid="scene"]'] },
  { kind: "Раздел", top: true, folder: true, id: "variants", title: "Варианты комнаты", where: "Сверху › Заказ и инструменты", keys: ["вариант", "варианты", "копия проекта", "согласован", "версия раскладки"], note: "Варианты есть в папке клиента (заказ с комнатами)", target: ['input[aria-label="Название варианта"]', "h3::Варианты комнаты"] },
  // ——— левая панель и сцена ———
  // палитра по типам мебели (критик 31.10: «купе», «тумба», «пенал», «письменный стол»)
  { kind: "Раздел", stage: "bodies", empty: true, id: "add-kupe", title: "Шкаф-купе: двери купе", where: "Мебель › Палитра › Шкафы-купе", keys: ["купе", "двери купе", "шкаф купе", "раздвижные двери"], target: ['[data-tour="palette"] button::Шкафы-купе', '[data-tour="palette"]'] },
  { kind: "Раздел", stage: "bodies", empty: true, id: "add-kitchen", title: "Кухонные модули: тумба, пенал, навесной", where: "Мебель › Палитра › Кухонные модули", keys: ["кухня", "кухонный", "тумба", "пенал", "навесной шкаф", "нижний модуль", "под мойку"], target: ['[data-tour="palette"] button::Кухонные модули', '[data-tour="palette"]'] },
  { kind: "Раздел", stage: "bodies", empty: true, id: "add-desk", title: "Письменный стол", where: "Мебель › Палитра", keys: ["стол", "письменный стол", "рабочий стол", "компьютерный стол"], target: ['[data-tour="palette"] button::Стол', '[data-tour="palette"]'] },
  { kind: "Раздел", stage: "bodies", empty: true, id: "add-cabinet", title: "Добавить шкаф", where: "Мебель › Палитра слева", keys: ["добавить шкаф", "новый шкаф", "модуль", "корпус", "палитра", "каталог", "стеллаж", "комод", "кухня"], target: ['[data-tour="palette"]'] },
  { kind: "Раздел", stage: "bodies", id: "modules", rank: 0.3, title: "Модули проекта (список)", where: "Мебель › Слева", keys: ["список", "корпуса", "модули проекта", "выбрать шкаф", "найти корпус", "найти модуль"], target: ['[data-tour="modules"]'] },
  { kind: "Поле", stage: "bodies", id: "snapping", title: "Привязки корпусов", where: "Мебель › Слева", keys: ["привязки", "магнит", "прилипание", "шаг 1 мм", "без привязки"], target: ['input[aria-label="Привязки корпусов"]'] },
  { kind: "Поле", stage: "bodies", id: "move-all", title: "Двигать всю композицию", where: "Мебель › Слева", keys: ["вся композиция", "двигать всё", "сдвинуть всё"], target: ['input[aria-label="Двигать всю композицию"]'] },
  { kind: "Раздел", stage: "bodies", id: "group", title: "Двигать группу (Shift)", where: "Мебель › Слева", keys: ["группа", "shift", "несколько корпусов", "выделить несколько"], note: "Shift + щелчок — отметить, Shift + перетаскивание — двигать вместе", target: ['[data-search="move-group"]', '[data-tour="modules"]'] },
  { kind: "Кнопка", stage: "bodies", id: "library", title: "Моя библиотека модулей", where: "Мебель › Слева", keys: ["библиотека", "сохранить шкаф", "шаблон", "мои модули"], target: ['[data-search="library"]'] },
  { kind: "Кнопка", id: "new-project", title: "Новый проект / восстановить", where: "Слева сверху", keys: ["новый проект", "восстановить", "начать заново", "очистить проект"], target: ['[data-search="new-project"]'] },
  { kind: "Вид", stage: "bodies", id: "modes", title: "Режимы: выбрать, двигать, наполнение", where: "Сцена › над моделью", keys: ["режим", "наполнение", "двигать корпуса", "свободная камера", "выбрать"], target: ['[data-tour="modes"]'] },
  { kind: "Вид", id: "views", rank: 0.7, title: "Виды: 3D, спереди, сбоку, сверху, план", where: "Сцена", keys: ["вид", "спереди", "сбоку", "сверху", "3d", "камера", "wasd", "план", "3д", "объемный вид"], note: "Клавиши: W — сверху, S — спереди, A/D — бока, E — 3D", target: ['[data-tour="views"]'] },
  { kind: "Вид", id: "guides", title: "Вспомогательная линия (Q)", where: "Сцена › клавиша Q", keys: ["линия q", "q", "вспомогательная линия", "направляющая линия", "разметка", "линия"], note: "На виде спереди, сверху или на плане: Q → щелчок по краю → размер → Enter", target: ['[data-tour="guides"]', '[data-tour="views"]'] },
  { kind: "Кнопка", id: "dimensions", title: "Показать размеры", where: "Сцена › справа", keys: ["размеры", "размерные линии", "линейка"], target: ['button[aria-label="Показать размеры"]'] },
  { kind: "Кнопка", id: "transparent", title: "Прозрачный корпус", where: "Сцена › справа", keys: ["прозрачный", "просвет", "рентген"], target: ['button[aria-label="Прозрачный корпус"]'] },
  { kind: "Кнопка", id: "open-doors", title: "Открыть фасады (вид)", where: "Сцена › справа", keys: ["открыть двери", "открыть фасады", "распахнуть"], target: ['button[aria-label="Открыть фасады"]'] },
  { kind: "Кнопка", id: "rotate", title: "Повернуть корпус на 90°", where: "Сцена › справа · клавиша R", keys: ["повернуть", "поворот", "развернуть", "r"], target: ['button[aria-label="Повернуть корпус на 90° по часовой"]'] },
  { kind: "Кнопка", id: "fit", title: "Вписать модель", where: "Сцена › справа", keys: ["вписать", "показать всё", "масштаб", "приблизить"], target: ['button[aria-label="Вписать модель"]'] },
  // ——— помещение ———
  { kind: "Поле", stage: "room", id: "room-size", title: "Размеры комнаты", where: "Помещение › Замер", keys: ["размер комнаты", "ширина комнаты", "глубина комнаты", "помещение", "замер", "комната"], target: ['input[aria-label="Ширина комнаты"]', 'input[aria-label="Ширина пустой комнаты"]'] },
  { kind: "Поле", stage: "room", rank: 0.3, id: "ceiling", title: "Высота и тип потолка", where: "Помещение › Замер", keys: ["потолок", "высота потолка", "натяжной потолок", "высота"], target: ['input[aria-label="Высота потолка"]', 'input[aria-label="Высота пустой комнаты"]', 'select[aria-label="Тип потолка"]'] },
  { kind: "Раздел", stage: "room", id: "room-shape", title: "Форма комнаты", where: "Помещение › Форма комнаты", keys: ["форма комнаты", "контур", "г образная", "эркер", "скошенный угол", "пятиугольная", "скругленный угол", "скос", "дуга"], rank: 0.2, target: ['[data-testid="room-shape-panel"]'] },
  { kind: "Поле", stage: "room", full: true, id: "walls", title: "Толщина стен", where: "Помещение › Стены", keys: ["стены", "толщина стен", "угол стен"], target: ['input[aria-label="Толщина стен"]'] },
  { kind: "Раздел", stage: "room", id: "openings", title: "Окна и двери", where: "Помещение › Проёмы", keys: ["окно", "окна", "окон", "дверь", "двери", "проём", "подоконник", "наличник"], target: ['[data-search="openings"]'] },
  { kind: "Поле", stage: "room", id: "fixtures", title: "Розетки, трубы, радиаторы", where: "Помещение › Объекты на стенах", keys: ["розетка", "выключатель", "труба", "радиатор", "батарея", "электрика", "коммуникации", "счетчик", "водонагреватель", "щиток"], target: ['select[aria-label="Тип объекта"]'] },
  { kind: "Раздел", stage: "room", id: "obstacles", title: "Объекты в комнате: колонны, техника", where: "Помещение › Объекты в комнате", keys: ["колонна", "балка", "препятствие", "короб", "объект в комнате", "холодильник", "стиральная машина", "плита", "посудомойка", "вытяжка", "варочная панель", "техника"], target: ['[data-search="obstacles"]'] },
  { kind: "Раздел", stage: "room", rank: 0.3, id: "finishes", title: "Отделка: пол и стены", where: "Помещение › Отделка", keys: ["ламинат", "обои", "плитка", "покраска", "пол", "стены", "отделка", "паркет", "линолеум"], target: ['[data-testid="room-finishes"] select', '[data-testid="room-finishes"]'] },
  { kind: "Кнопка", stage: "room", id: "bazis-import", title: "Загрузить замер из Базиса", where: "Помещение › Объекты на стенах", keys: ["базис", "config xml", "импорт замера", "замер из базиса", "сохранить для базиса"], target: ['[data-search="bazis-import"]'] },
  { kind: "Раздел", stage: "room", id: "survey", title: "Точки замера и кривые стены", where: "Помещение › Замер", keys: ["точки замера", "кривые стены", "перепад", "завал стены"], target: ['[data-search="survey"]'] },
  { kind: "Раздел", stage: "room", full: true, id: "measure-card", title: "Карточка замера: номер, дата", where: "Помещение › Замер", keys: ["номер замера", "дата замера", "замерщик", "особенности замера", "примечания"], target: ['[data-search="measure-card"]'] },
  { kind: "Раздел", stage: "room", full: true, id: "niche", title: "Мебель в нише · вычеты СТП", where: "Помещение › Замер", keys: ["ниша", "стп", "вычеты", "зазор до потолка"], target: ['[data-search="niche"]'] },
  { kind: "Раздел", stage: "room", full: true, id: "composition", title: "Сдвинуть всю композицию", where: "Помещение › Замер", keys: ["сдвинуть композицию", "композиция от стены", "вся мебель"], target: ['[data-search="composition-shift"]'] },
  { kind: "Вид", stage: "room", id: "plan", title: "План помещения", where: "Помещение › План", plan: true, keys: ["план", "вид сверху комнаты", "чертеж комнаты", "править на плане"], target: ['[data-tour="views"] button::План', '[data-tour="views"]'] },
  // ——— цена и документы ———
  { kind: "Кнопка", id: "price", title: "Стоимость проекта", where: "Внизу › Стоимость", keys: ["стоимость", "цена", "смета", "сколько стоит", "итог", "рубли"], rank: 0.3, click: 'button[aria-label="Открыть стоимость"]', target: [".dock-estimate .dock-sum.total", '[data-tour="price"]', 'button[aria-label="Открыть стоимость"]'] },
  { kind: "Документ", id: "doc-estimate", title: "Документ «Стоимость»", where: "Документы › Для клиента", output: "estimate", keys: ["стоимость", "цена", "смета", "документ стоимости"], target: ['[aria-label="Документы для клиента"] button::Стоимость', ".output-panel"] },
  { kind: "Документ", id: "doc-quote", title: "Коммерческое предложение (КП)", where: "Документы › Для клиента", output: "quote", keys: ["кп", "коммерческое предложение", "предложение клиенту", "pdf"], target: ['[aria-label="Документы для клиента"] button::Коммерческое', ".output-panel"] },
  { kind: "Документ", id: "doc-client-spec", title: "Спецификация для клиента", where: "Документы › Для клиента", output: "client-spec", keys: ["спецификация", "состав изделий"], target: ['[aria-label="Документы для клиента"] button::Спецификация', ".output-panel"] },
  { kind: "Документ", id: "doc-placement", title: "Расстановка", where: "Документы › Для клиента", output: "placement", keys: ["расстановка", "план расстановки", "документ"], target: ['[aria-label="Документы для клиента"] button::Расстановка', ".output-panel"] },
  { kind: "Документ", id: "doc-sheets", title: "Карты листов и деталировка (раскрой)", where: "Документы › Для производства", output: "sheets", keys: ["раскрой", "карты листов", "листы", "нестинг", "деталировка", "csv", "lamarty"], target: ['[aria-label="Документы для производства"] button::Карты', ".output-panel"] },
  { kind: "Документ", id: "doc-spec", title: "Ведомость комплектации", where: "Документы › Для производства", output: "specification", keys: ["ведомость", "комплектация", "фурнитура списком"], target: ['[aria-label="Документы для производства"] button::Ведомость', ".output-panel"] },
  { kind: "Документ", id: "doc-drawings", title: "Чертежи модулей", where: "Документы › Для производства", output: "drawings", keys: ["чертежи", "чертеж", "сборочный"], target: ['[aria-label="Документы для производства"] button::Чертежи', ".output-panel"] },
  { kind: "Документ", id: "doc-labels", title: "Бирки деталей", where: "Документы › Для производства", output: "labels", keys: ["бирки", "этикетки", "наклейки"], target: ['[aria-label="Документы для производства"] button::Бирки', ".output-panel"] },
  { kind: "Документ", id: "doc-zip", title: "Комплект ZIP технологу", where: "Документы › Для производства", output: "sheets", keys: ["zip", "архив", "технологу", "комплект", "документы"], target: [".review-package button::ZIP", ".output-panel"] },
  { kind: "Документ", id: "doc-order", title: "Номер заказа", where: "Документы › Для производства", output: "sheets", keys: ["номер заказа", "заказ"], target: ['input[aria-label="Номер заказа"]'] },
  { kind: "Кнопка", id: "hardware", title: "Фурнитура проекта", where: "Внизу › Фурнитура", keys: ["фурнитура", "поменять фурнитуру", "петли всем", "направляющие всем"], click: '[aria-label="Навигация по проекту"] button::Фурнитура', target: [".dock-hardware button", '[aria-label="Навигация по проекту"] button::Фурнитура'] },
  { kind: "Кнопка", top: true, id: "presentation", title: "Показать клиенту", where: "Сверху", keys: ["показать клиенту", "презентация", "картинка", "изображение"], target: [".presentation-trigger"] },
  { kind: "Кнопка", top: true, id: "save-file", title: "Сохранить файл проекта", where: "Сверху", keys: ["сохранить", "скачать проект", "файл", "файл заказа", "json", "экспорт"], target: ['button[aria-label="Сохранить проект файлом"]'] },
  { kind: "Кнопка", top: true, id: "open-file", rank: 0.2, title: "Открыть файл проекта", where: "Сверху", keys: ["открыть", "загрузить проект", "импорт", "файл", "файл заказа"], target: ['button[aria-label="Открыть"]'] },
  { kind: "Кнопка", id: "cloud", title: "Кабинет проектов", where: "Сверху", action: "cloud", keys: ["кабинет", "сервер", "версии", "облако", "мои проекты"], target: [".modal"] },
  { kind: "Кнопка", id: "undo", title: "Отменить / повторить (Ctrl+Z)", where: "Сверху справа", keys: ["отмена", "отменить", "назад", "ctrl z", "ctrl y", "вернуть", "повторить", "undo", "redo"], target: ['button[aria-label="Отменить"]'] },
  { kind: "Раздел", id: "stages", title: "Этапы: помещение, мебель, документы", where: "Сверху", keys: ["этап", "шаг", "помещение", "построение мебели", "документы"], target: ['[data-tour="stages"]'] },
  { kind: "Поле", id: "advanced", title: "Все настройки", where: "Сверху справа", keys: ["все настройки", "эксперт", "расширенный режим", "все панели"], target: [".stage-advanced input"] },
  // ——— обучение ———
  { kind: "Обучение", id: "tour", title: "Обучение: основные функции", where: "9 коротких шагов", action: "tour", rank: 0.5, keys: ["обучение", "тур", "помощь", "как пользоваться", "подсказки", "инструкция", "научиться", "с чего начать"], target: [] },
  { kind: "Обучение", id: "help", title: "Как пользоваться (справка)", where: "Слева внизу", action: "help", keys: ["как пользоваться", "справка", "помощь", "вопросы"], target: [".help-content"] },
];

/** Пункты при пустом запросе — частые (Макс 31.10: «основные пункты редактирования»). */
export const SUGGESTED = ["hinges", "shelves", "drawers", "decor", "handles", "room-shape", "price", "doc-quote", "tour"];
