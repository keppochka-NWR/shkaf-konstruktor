import { useMemo } from "react";
import { previewSvg } from "./vernissageGeometry";
import { ADILET_FILMS, VERNISSAGE_FILMS, VERNISSAGE_MILLINGS, VERNISSAGE_NOTES, VERNISSAGE_SERIES, PROVISIONAL, SERIES_LABEL, openings, seriesOf, vernissageFacadePrice, vernissageLayout, vernissageMilling, type VernissageFacade, type VernissageCover } from "./facadesVernissage";
import type { VSeriesId } from "./vernissageData";

const OPEN_LABEL = { solid: "Глухой", glass: "Рамочный под стекло", grille: "С решёткой и стеклом" } as const;
const COVER_LABEL: Record<VernissageCover, string> = { film: "Плёнка ПВХ", adilet: "Плёнка Адилет (срок +5 дней)", "enamel-matte": "Эмаль матовая", "enamel-gloss": "Эмаль глянец", none: "Без плёнки (МДФ под покраску)" };
const FILM_CATS = ["2", "3", "4", "5", "6", "Премиум"];

/** Выбор фасада «Вернисаж»: серия → фрезеровка → исполнение → покрытие → толщина. Превью — наша схема по той же раскладке, что и 3D. */
export function VernissagePicker({ value, onChange, sample }: { value: VernissageFacade; onChange: (v: VernissageFacade) => void; sample?: [number, number] }) {
  const m = vernissageMilling(value.milling) ?? VERNISSAGE_MILLINGS[0], s = seriesOf(value.milling);
  const set = (p: Partial<VernissageFacade>) => onChange({ ...value, ...p });
  const covers = (Object.keys(COVER_LABEL) as VernissageCover[]).filter((c) => c === "film" || c === "adilet" ? true : c === "none" ? "no_film" in s.columns : c === "enamel-matte" ? m.enamel !== "none" && "enamel_matte" in s.columns : m.enamel === "matte-gloss" && "enamel_gloss" in s.columns);
  const [w, h] = sample ?? [450, 716];
  const previews = useMemo(() => ([["Фасад", w, h], ["Высокий", 450, 1800], ["Ящик", 600, 180]] as const).map(([label, pw, ph]) => ({ label, svg: previewSvg(vernissageLayout(value, pw, ph), 70) })), [value, w, h]);
  const price = vernissageFacadePrice(value, w, h);
  return <div className="vernissage-picker">
    <label className="hardware-field">Серия<select aria-label="Серия Вернисаж" value={s.id} onChange={(e) => { const first = VERNISSAGE_MILLINGS.find((x) => x.series === e.target.value)!; set({ milling: first.id, open: undefined }); }}>
      {VERNISSAGE_SERIES.map((x) => <option key={x.id} value={x.id}>{SERIES_LABEL[x.id as VSeriesId]}</option>)}</select></label>
    <label className="hardware-field">Фрезеровка<select aria-label="Фрезеровка Вернисаж" value={m.id} onChange={(e) => { const nm = vernissageMilling(e.target.value)!; set({ milling: nm.id, open: value.open && openings(nm).includes(value.open) ? value.open : undefined, ...(nm.mdf19Only ? { thickness: 19 } : {}) }); }}>
      {VERNISSAGE_MILLINGS.filter((x) => x.series === s.id).map((x) => <option key={x.id} value={x.id}>№{x.id}{x.grafika ? " (Графика)" : ""} — {x.shapeNote}{x.mdf19Only ? " · МДФ 19" : ""}</option>)}</select></label>
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", margin: "6px 0" }}>
      {previews.map((p) => <figure key={p.label} style={{ margin: 0, textAlign: "center", fontSize: 11 }}><span dangerouslySetInnerHTML={{ __html: p.svg }} /><figcaption>{p.label}</figcaption></figure>)}
    </div>
    {openings(m).length > 1 && <label className="hardware-field">Исполнение<select aria-label="Исполнение Вернисаж" value={value.open ?? "solid"} onChange={(e) => set({ open: e.target.value === "solid" ? undefined : e.target.value as VernissageFacade["open"] })}>
      {openings(m).map((o) => <option key={o} value={o}>{OPEN_LABEL[o]}{o !== "solid" ? ` · +${VERNISSAGE_NOTES.framesAndGrillesMarkupPct} %` : ""}</option>)}</select></label>}
    <label className="hardware-field">Покрытие<select aria-label="Покрытие Вернисаж" value={value.cover} onChange={(e) => { const c = e.target.value as VernissageCover; set({ cover: c, ...(c === "film" && !VERNISSAGE_FILMS.some((f) => f.name === value.film) ? { film: "Моно белый" } : c === "adilet" && !ADILET_FILMS.some((f) => f.name === value.film) ? { film: ADILET_FILMS.find((f) => !f.out)!.name } : {}) }); }}>
      {covers.map((c) => <option key={c} value={c}>{COVER_LABEL[c]}</option>)}</select></label>
    {value.cover === "film" && <label className="hardware-field">Плёнка<select aria-label="Плёнка Вернисаж" value={value.film ?? ""} onChange={(e) => set({ film: e.target.value })}>
      {FILM_CATS.map((cat) => <optgroup key={cat} label={`Категория ${cat}`}>{VERNISSAGE_FILMS.filter((f) => f.cat === cat).map((f) => <option key={cat + f.name} value={f.name}>{f.name}</option>)}</optgroup>)}</select></label>}
    {value.cover === "adilet" && <label className="hardware-field">Плёнка Адилет<select aria-label="Плёнка Адилет" value={value.film ?? ""} onChange={(e) => set({ film: e.target.value })}>
      {["3", "4", "5", "6"].map((cat) => <optgroup key={cat} label={`Категория ${cat}`}>{ADILET_FILMS.filter((f) => f.cat === cat).map((f) => <option key={cat + f.name} value={f.name}>{f.name}{f.out ? " · выводится" : ""}</option>)}</optgroup>)}</select></label>}
    {value.cover.startsWith("enamel") && <label className="hardware-field">Цвет эмали (RAL/NCS или #hex)<input aria-label="Цвет эмали Вернисаж" value={value.enamelColor ?? ""} onChange={(e) => set({ enamelColor: e.target.value })} placeholder="например RAL 9003" /></label>}
    <div className="kitchen-field"><span>Толщина МДФ</span><div className="kitchen-chips" role="group" aria-label="Толщина МДФ Вернисаж">{([16, 19, 25] as const).map((t) => <button key={t} type="button" aria-pressed={value.thickness === t} disabled={t === 16 && m.mdf19Only} onClick={() => set({ thickness: t })}>{t}{t === 25 ? " · +40 %" : ""}</button>)}</div></div>
    {value.cover !== "none" && <label className="check-row"><input type="checkbox" checked={!!value.patina} onChange={(e) => set({ patina: e.target.checked || undefined })} /> Патина +{VERNISSAGE_NOTES.patinaPerM2} ₽/м²</label>}
    {value.cover.startsWith("enamel") && <label className="check-row"><input type="checkbox" checked={!!value.twoSided} onChange={(e) => set({ twoSided: e.target.checked || undefined })} /> Покраска с 2 сторон +{VERNISSAGE_NOTES.enamelTwoSidedMarkupPct} %</label>}
    {value.cover === "enamel-matte" && <label className="check-row"><input type="checkbox" checked={!!value.lacquer} onChange={(e) => set({ lacquer: e.target.checked || undefined })} /> Лак на матовую эмаль +{VERNISSAGE_NOTES.enamelMatteLacquerPerM2} ₽/м²</label>}
    <p className="field-note">Прайс от {VERNISSAGE_NOTES.priceDate}: {price.column ?? "—"} {price.base !== null ? `${price.base} ₽/м²` : ""}{price.perM2 !== null && price.perM2 !== price.base ? ` → ${price.perM2} ₽/м²` : ""}. ПВХ меньше {VERNISSAGE_NOTES.minAreaM2Pvc} м² — как {VERNISSAGE_NOTES.minAreaM2Pvc}; присадка под петли {VERNISSAGE_NOTES.hingeBoringPerPc} ₽/шт. Сторонний участок — вне раскроя ЛДСП.</p>
    {price.warnings.map((x) => <p key={x} className="field-note" style={{ color: "#a4471d" }}>{x}</p>)}
    <p className="field-note">Рисунок «{m.shapeNote}» — по фото каталога; размеры профиля {PROVISIONAL.frame} / паз {PROVISIONAL.groove.w}×{PROVISIONAL.groove.d} мм условные до тех. PDF Вернисажа. Цвет в 3D приблизительный.</p>
  </div>;
}
