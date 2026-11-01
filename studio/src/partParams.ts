// Куда ведёт «Параметры» выбранной детали (Макс 01.11.2026: «при нажатии на параметры ящика открываются параметры секции»).
// Плашка над сценой и колесо — один маршрут: свой блок детали → её раздел настроек → раздел «Секция» → первый раздел панели
// (кухня, угол и купе — панели без «Секции»; там ведём к разделу с тем же началом названия: «Ящики и бутылочницы», «Фасады»).
export type PartKind = "drawer" | "shelf" | "door" | "rod" | "divider" | "kupe" | "section";

export function partKind(pid: string, role?: string): PartKind {
  if (/^kupe:\d+:fill:/.test(pid)) return "kupe"; // вставка двери купе — редактор этой секции; профиль и рамка — панель купе целиком
  if (pid.includes(":drawer:") || pid.startsWith("kd:")) return "drawer"; // id раньше роли: фасад ящика — часть ящика, а не дверь
  if (pid.includes(":shelf:")) return "shelf";
  if (role === "door" || /:(door|hingecup|hingearm|hingeplate|handle):/.test(pid)) return "door";
  if (/:rod(:|$)|:pantograph:|:pullout:|:flange:/.test(pid)) return "rod";
  if (pid.includes(":divider")) return "divider";
  return "section";
}

const SETTING: Record<PartKind, string> = { drawer: "Ящики", shelf: "Полки", door: "Фасад", rod: "Штанги", divider: "Перегородки секции", kupe: "Двери купе", section: "Секция" };
/** Раздел настроек детали (SettingsSection title). */
export const partSetting = (pid: string, role?: string) => SETTING[partKind(pid, role)];

/** Номер ящика или полки в id: у углового шкафа у каждого свой блок (критик 01.11: подсвечивалось вступление, «Наполнение» оставалось закрытым). */
export const partIndex = (pid: string) => { const m = /:(?:drawer|shelf):(\d+)/.exec(pid); return m ? Number(m[1]) : null; };

/** Селекторы по убыванию точности; подсвечивается первый найденный. */
export function partParamTargets(pid: string, role?: string): string[] {
  const kind = partKind(pid, role), s = SETTING[kind], p = ".properties ", n = partIndex(pid);
  return [
    ...(n === null ? [] : [`${p}[data-part-params="${kind}"][data-part-index="${n}"]`]),
    ...(kind === "section" ? [] : [`${p}[data-part-params="${kind}"]`]),
    `${p}details[data-setting="${s}"]`,
    `${p}details[data-setting^="${s}"]`,
    `${p}details[data-setting="Секция"]`,
    `${p}details[data-setting="Наполнение угла"]`,
    `${p}.kupe-panel`,
    `${p}.property-section`,
  ];
}
