// Имена файлов импорта шкафов из базы (scripts/wardrobe/import.ts): wardrobe-NNN.json и индекс wardrobes.json.
// Только они исключаются из регрессии parts-snapshot; любой другой проект с именем на «wardrobe…» остаётся в ней.
export const isWardrobeImportFile = (f: string): boolean => /^wardrobe-\d+\.json$/.test(f) || f === "wardrobes.json";
/** Телефоны в именах сборок и папок Базиса (058, 059: имя и телефон клиента в названии модуля) — маска: в проект студии не переносим.
 *  Проекты импорта лежат только локально (local-projects в .gitignore), но vite build копирует public/ в сборку. */
export const maskPhones = (s: string): string => s.replace(/(?:\+7|(?<!\d)8)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/g, "тел. скрыт");
