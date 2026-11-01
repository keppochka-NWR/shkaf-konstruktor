// Куда ведёт «Параметры» выбранной детали (Макс 01.11.2026: «при нажатии на параметры ящика открываются параметры секции»).
// Плашка над сценой и колесо — один маршрут: свой блок детали → её раздел настроек → раздел «Секция» → первый раздел панели
// (кухня, угол и купе — панели без «Секции»; там ведём к разделу с тем же началом названия: «Ящики и бутылочницы», «Фасады»).
export type PartKind = "drawer" | "shelf" | "door" | "rod" | "divider" | "section";

export function partKind(pid: string, role?: string): PartKind {
  if (pid.includes(":drawer:") || pid.startsWith("kd:")) return "drawer"; // id раньше роли: фасад ящика — часть ящика, а не дверь
  if (pid.includes(":shelf:")) return "shelf";
  if (role === "door" || /:(door|hingecup|hingearm|hingeplate|handle):/.test(pid)) return "door";
  if (/:rod(:|$)|:pantograph:|:pullout:|:flange:/.test(pid)) return "rod";
  if (pid.includes(":divider")) return "divider";
  return "section";
}

const SETTING: Record<PartKind, string> = { drawer: "Ящики", shelf: "Полки", door: "Фасад", rod: "Штанги", divider: "Перегородки секции", section: "Секция" };
/** Раздел настроек детали (SettingsSection title). */
export const partSetting = (pid: string, role?: string) => SETTING[partKind(pid, role)];

/** Селекторы по убыванию точности; подсвечивается первый найденный. */
export function partParamTargets(pid: string, role?: string): string[] {
  const kind = partKind(pid, role), s = SETTING[kind], p = ".properties ";
  return [
    ...(kind === "section" ? [] : [`${p}[data-part-params="${kind}"]`]),
    `${p}details[data-setting="${s}"]`,
    `${p}details[data-setting^="${s}"]`,
    `${p}details[data-setting="Секция"]`,
    `${p}.kupe-panel`,
    `${p}.property-section`,
  ];
}
