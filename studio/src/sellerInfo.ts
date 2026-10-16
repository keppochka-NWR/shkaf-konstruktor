// Шапка продавца в КП: название и контакты салона задаёт менеджер на своём устройстве (localStorage, не в проекте и не в git —
// репозиторий публичный, реальных реквизитов в коде нет). Пустые поля — блок продавца в КП не печатается.
export type SellerInfo = { name: string; contacts: string };
const KEY = "studio-seller";
export const EMPTY_SELLER: SellerInfo = { name: "", contacts: "" };
export function loadSeller(): SellerInfo {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") return { name: String(v.name ?? "").slice(0, 160), contacts: String(v.contacts ?? "").slice(0, 600) };
  } catch { /* хранилище недоступно */ }
  return { ...EMPTY_SELLER };
}
export function saveSeller(s: SellerInfo): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ name: s.name.slice(0, 160), contacts: s.contacts.slice(0, 600) })); return true; } catch { return false; }
}
export const hasSeller = (s: SellerInfo | undefined) => !!s && (s.name.trim() !== "" || s.contacts.trim() !== "");
