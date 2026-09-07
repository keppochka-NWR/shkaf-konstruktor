// Пошаговый режим для менеджера (задание Макса 07.09.2026): помещение → коммуникации → каркасы → наполнение → фасады → документы.
// Каждый этап показывает только свои панели и подсвечен своим цветом; «Все настройки» снимает фильтр.
export type Stage = "room" | "fixtures" | "bodies" | "filling" | "facades" | "docs";
export const STAGES: { id: Stage; n: number; title: string; short: string; color: string; hint: string }[] = [
  { id: "room", n: 1, title: "Помещение", short: "Комната", color: "#1b697a", hint: "Ширина, глубина и высота потолка. Тип потолка и номер замера — справа." },
  { id: "fixtures", n: 2, title: "Коммуникации", short: "Окна и трубы", color: "#2a7fb8", hint: "Добавьте окна, двери, батареи, розетки, трубы кнопками справа. На плане их можно двигать." },
  { id: "bodies", n: 3, title: "Каркасы", short: "Корпуса", color: "#2e9d6a", hint: "«Добавить модуль», задайте габариты справа и расставьте корпуса в 3D или на плане." },
  { id: "filling", n: 4, title: "Наполнение", short: "Полки и ящики", color: "#d08a1f", hint: "Выберите корпус и секцию, добавьте полки, ящики, штангу — кнопками слева или перетаскиванием." },
  { id: "facades", n: 5, title: "Фасады", short: "Фасады", color: "#8a4fbf", hint: "Распашные фасады и фасады ящиков: материал, ручки, открывание, алюминиевые рамки." },
  { id: "docs", n: 6, title: "Документы", short: "Смета и карты", color: "#55606a", hint: "Смета, карты листов, бирки, ведомость и КП — в окне документов." },
];
export const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.id === s);
export const nextStage = (s: Stage) => STAGES[Math.min(STAGES.length - 1, stageIndex(s) + 1)].id;
export const prevStage = (s: Stage) => STAGES[Math.max(0, stageIndex(s) - 1)].id;
export const STAGE_KEY = "studio-stage";
