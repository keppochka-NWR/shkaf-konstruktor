// Имена файлов импорта шкафов из базы (scripts/wardrobe/import.ts): wardrobe-NNN.json и индекс wardrobes.json.
// Только они исключаются из регрессии parts-snapshot; любой другой проект с именем на «wardrobe…» остаётся в ней.
export const isWardrobeImportFile = (f: string): boolean => /^wardrobe-\d+\.json$/.test(f) || f === "wardrobes.json";
