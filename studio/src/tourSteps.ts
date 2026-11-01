// Микро-обучение (Макс 31.10.2026: «показать основные функции»): короткие шаги с подсветкой цели.
// Цели — data-tour и aria-label, не позиции на экране: переживают перестановку панелей (claude/ui-layout).
// Шаг без цели на экране пропускается. Порядок — как идёт работа: этапы → шкаф → выбор → виды → меню → наполнение → Q → цена → поиск.

export type TourStep = { id: string; title: string; text: string; target: string[]; stage?: "room" | "bodies" };
export const TOUR_KEY = "studio-tour-v1";

export const TOUR_STEPS: TourStep[] = [
  { id: "stages", title: "Этапы работы", text: "Работа идёт по шагам: помещение → мебель → документы. Нажмите шаг, чтобы перейти.", target: ['[data-tour="stages"]'] },
  { id: "palette", stage: "bodies", title: "Добавьте шкаф", text: "Слева — палитра. Выберите тип и нажмите: шкаф встанет в комнату к стене.", target: ['[data-tour="palette"]'] },
  { id: "select", stage: "bodies", title: "Выбор и перемещение", text: "Нажмите шкаф в сцене или в списке — справа его настройки. Тяните мышью, чтобы двигать. Shift + щелчок — отметить несколько, Shift + перетаскивание — двигать группу.", target: ['[data-tour="modules"]', '[data-testid="scene"]'] },
  { id: "views", title: "Виды и клавиши", text: "3D, спереди, слева, справа, сверху и план. Клавиши: W — сверху, S — спереди, A и D — бока, E — 3D, P — план.", target: ['[data-tour="views"]'] },
  { id: "radial", stage: "bodies", title: "Меню правой кнопкой", text: "Правая кнопка по шкафу, полке или фасаду — круговое меню: размеры, полки, ящики, петли, цвет.", target: ['[data-testid="scene"]'] },
  { id: "fill", stage: "bodies", title: "Режим «Наполнение»", text: "Створки открываются: полки и ящики тянутся по высоте, перегородки — по ширине. Новое — перетаскиванием слева или через меню.", target: ['[data-tour="modes"]'] },
  { id: "guides", title: "Линии Q", text: "На виде спереди, сверху или на плане: Q → щелчок по краю → размер → Enter. К линии притягиваются корпуса: Alt — к линии, Ctrl — к пересечению.", target: ['[data-tour="guides"]', '[data-tour="views"]'] },
  { id: "price", title: "Цена и документы", text: "Внизу — итоговая стоимость. КП, карты раскроя, ведомость и бирки — на этапе «Документы».", target: ['[data-tour="price"]', '[data-tour="stages"]'] },
  { id: "search", title: "Поиск по параметрам", text: "Ctrl+K или «/» — найдите любой пункт: «петли», «цоколь», «КП». Студия откроет панель и подсветит поле.", target: ['[data-tour="search"]'] },
];

/** Авто-предложение тура — один раз новому пользователю. Не в сценариях: ?fresh=1, ?notour=1, navigator.webdriver (Playwright);
 *  ?tour=1 — показать принудительно (проверка вручную). */
export function tourAllowed({ search, webdriver, seen }: { search: string; webdriver: boolean; seen: boolean }): boolean {
  const q = new URLSearchParams(search);
  if (q.get("tour") === "1") return true;
  if (seen || webdriver || q.get("fresh") === "1" || q.get("notour") === "1") return false;
  return true;
}
export function tourSeen(): boolean { try { return !!localStorage.getItem(TOUR_KEY); } catch { return true; /* без хранилища не предлагаем при каждом входе */ } }
export function markTourSeen() { try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* без хранилища — просто закрыли */ } }
