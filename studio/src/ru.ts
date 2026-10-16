/** Склонение по числу: plural(3, ["деталь", "детали", "деталей"]) → «детали». */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const a = Math.abs(Math.trunc(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
/** Число со словом: count(3, [...]) → «3 детали». */
export const count = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;
export const DETAILS: [string, string, string] = ["деталь", "детали", "деталей"];
export const SHEETS: [string, string, string] = ["лист", "листа", "листов"];
