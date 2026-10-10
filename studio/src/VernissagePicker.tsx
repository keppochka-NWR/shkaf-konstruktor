import { useMemo } from "react";
import { previewSvg } from "./vernissageGeometry";
import { ADILET_FILMS, PET_DECORS, VERNISSAGE_FILMS, VERNISSAGE_MILLINGS, VERNISSAGE_NOTES, VERNISSAGE_SERIES, PROVISIONAL, SERIES_LABEL, coversOf, filmCatsOf, fmtRu, normalizeVernissage, openings, priceDateRu, seriesOf, thicknessesOf, vernissageFacadePrice, vernissageLayout, vernissageMilling, vernissageSizeCheck, vernissageTexture, type VernissageFacade, type VernissageCover } from "./facadesVernissage";
import type { VLimit, VSeriesId } from "./vernissageData";
import { V_FILM_COLORS } from "./vernissageTextures";

const ROW_LABEL = { solid: "глухой", glass: "витрина", grille: "решётка", drawer: "ящик" } as const;
const lim = (r: VLimit | null) => r ? `${r[0]}–${r[1] ?? "…"} × ${r[2]}–${r[3] ?? "…"}` : "не делается";

const OPEN_LABEL = { solid: "Глухой", glass: "Рамочный под стекло", grille: "С решёткой и стеклом" } as const;
const COVER_LABEL: Record<VernissageCover, string> = { film: "Плёнка ПВХ", adilet: "Плёнка Адилет (срок +5 дней)", pet: "Плёнка ПЭТ на PUR-клее", "enamel-matte": "Эмаль матовая", "enamel-gloss": "Эмаль глянец", none: "Без плёнки (МДФ под покраску)" };

/** Выбор фасада «Вернисаж»: серия → фрезеровка → исполнение → покрытие → толщина. Превью — наша схема по той же раскладке, что и 3D.
 *  Покрытия, категории плёнок и толщины — только те, для которых в прайсе серии есть цена; при смене серии/фрезеровки выбор
 *  приводится к допустимому (normalizeVernissage), чтобы список не показывал одно, а в расчёт не шло другое. */
export function VernissagePicker({ value, onChange, sample, sizes }: { value: VernissageFacade; onChange: (v: VernissageFacade) => void; sample?: [number, number]; sizes?: [number, number][] }) {
  const m = vernissageMilling(value.milling) ?? VERNISSAGE_MILLINGS[0], s = seriesOf(value.milling);
  const set = (p: Partial<VernissageFacade>) => onChange(normalizeVernissage({ ...value, ...p }));
  const covers = coversOf(m.id), cats = filmCatsOf(m.id), ths = thicknessesOf(m.id);
  const [w, h] = sample ?? sizes?.[0] ?? [450, 716];
  const previews = useMemo(() => ([["Фасад", w, h], ["Высокий", 450, 1800], ["Ящик", 600, 180]] as const).map(([label, pw, ph]) => ({ label, svg: previewSvg(vernissageLayout(value, pw, ph), 70) })), [value, w, h]);
  const price = vernissageFacadePrice(value, w, h);
  const handle = s.id === "handle", pet = s.id === "pet";
  // ограничения паспорта PDF по фасадам модуля: ошибки (проект не примет) и предупреждения (без фрезеровки, рисунок разделён)
  const fs = sizes?.length ? sizes : [[w, h] as [number, number]];
  const checks = fs.map(([fw, fh]) => vernissageSizeCheck(m.id, value.open, fw, fh));
  const sizeErrors = [...new Set(checks.flatMap((c) => c.errors))], sizeWarnings = [...new Set(checks.flatMap((c) => c.warnings))];
  const misfit = useMemo(() => new Set(VERNISSAGE_MILLINGS.filter((x) => x.pp && fs.some(([fw, fh]) => vernissageSizeCheck(x.id, undefined, fw, fh).errors.length)).map((x) => x.id)), [fs.map((f) => f.join("x")).join(",")]);
  const tex = vernissageTexture(value);
  return <div className="vernissage-picker">
    <label className="hardware-field">Серия<select aria-label="Серия Вернисаж" value={s.id} onChange={(e) => { const first = VERNISSAGE_MILLINGS.find((x) => x.series === e.target.value)!; set({ milling: first.id, open: undefined }); }}>
      {VERNISSAGE_SERIES.map((x) => <option key={x.id} value={x.id}>{SERIES_LABEL[x.id as VSeriesId]}</option>)}</select></label>
    {!pet && <label className="hardware-field">{handle ? "Модель ручки" : "Фрезеровка"}<select aria-label="Фрезеровка Вернисаж" value={m.id} onChange={(e) => set({ milling: e.target.value })}>
      {VERNISSAGE_MILLINGS.filter((x) => x.series === s.id).map((x) => <option key={x.id} value={x.id}>{handle ? x.id : `№${x.id}`}{x.grafika ? " (Графика)" : ""}{x.pp ? " · паспорт" : " · условно"}{misfit.has(x.id) ? " · не по размеру фасадов" : ""} — {x.shapeNote}{x.mdf19Only ? " · МДФ 19 с петлями" : ""}</option>)}</select></label>}
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", margin: "6px 0" }}>
      {previews.map((p) => <figure key={p.label} style={{ margin: 0, textAlign: "center", fontSize: 11 }}><span dangerouslySetInnerHTML={{ __html: p.svg }} /><figcaption>{p.label}</figcaption></figure>)}
    </div>
    {openings(m).length > 1 && <label className="hardware-field">Исполнение<select aria-label="Исполнение Вернисаж" value={value.open ?? "solid"} onChange={(e) => set({ open: e.target.value === "solid" ? undefined : e.target.value as VernissageFacade["open"] })}>
      {openings(m).map((o) => <option key={o} value={o}>{OPEN_LABEL[o]}{o !== "solid" ? ` · +${VERNISSAGE_NOTES.framesAndGrillesMarkupPct} %` : ""}</option>)}</select></label>}
    {covers.length > 1 && <label className="hardware-field">Покрытие<select aria-label="Покрытие Вернисаж" value={value.cover} onChange={(e) => set({ cover: e.target.value as VernissageCover })}>
      {covers.map((c) => <option key={c} value={c}>{handle && c === "none" ? "Без покрытия (эмалевый участок)" : COVER_LABEL[c]}</option>)}</select></label>}
    {value.cover === "film" && <label className="hardware-field">Плёнка<select aria-label="Плёнка Вернисаж" value={value.film ?? ""} onChange={(e) => set({ film: e.target.value })}>
      {cats.map((cat) => <optgroup key={cat} label={`Категория ${cat}`}>{VERNISSAGE_FILMS.filter((f) => f.cat === cat).map((f) => <option key={cat + f.name} value={f.name}>{f.name}{value.milling === "V5" && f.v5 === false ? " · не для V5" : ""}</option>)}</optgroup>)}</select></label>}
    {value.cover === "adilet" && <label className="hardware-field">Плёнка Адилет<select aria-label="Плёнка Адилет" value={value.film ?? ""} onChange={(e) => set({ film: e.target.value })}>
      {["3", "4", "5", "6"].map((cat) => <optgroup key={cat} label={`Категория ${cat}`}>{ADILET_FILMS.filter((f) => f.cat === cat).map((f) => <option key={cat + f.name} value={f.name}>{f.name}{f.out ? " · выводится" : ""}</option>)}</optgroup>)}</select></label>}
    {value.cover === "pet" && <label className="hardware-field">Декор ПЭТ<select aria-label="Декор ПЭТ Вернисаж" value={value.film ?? ""} onChange={(e) => set({ film: e.target.value })}>
      {PET_DECORS.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>}
    {value.cover.startsWith("enamel") && <label className="hardware-field">Цвет эмали (RAL/NCS или #hex)<input aria-label="Цвет эмали Вернисаж" value={value.enamelColor ?? ""} onChange={(e) => set({ enamelColor: e.target.value })} placeholder="например RAL 9003" /></label>}
    <div className="kitchen-field"><span>Толщина МДФ</span><div className="kitchen-chips" role="group" aria-label="Толщина МДФ Вернисаж">{ths.map((t) => <button key={t} type="button" aria-pressed={value.thickness === t} onClick={() => set({ thickness: t })}>{t}{t === 25 ? " · +40 %" : ""}</button>)}</div></div>
    {m.mdf19Only && <p className="field-note">№{m.id}: МДФ 19 мм для фасадов с петлями; 16 мм — только без петель (прайс, примечание к серии Престиж).</p>}
    {value.cover !== "none" && value.cover !== "pet" && <label className="check-row"><input type="checkbox" checked={!!value.patina} onChange={(e) => set({ patina: e.target.checked || undefined })} /> Патина +{VERNISSAGE_NOTES.patinaPerM2} ₽/м²</label>}
    {value.cover.startsWith("enamel") && <label className="check-row"><input type="checkbox" checked={!!value.twoSided} onChange={(e) => set({ twoSided: e.target.checked || undefined })} /> Покраска с 2 сторон +{VERNISSAGE_NOTES.enamelTwoSidedMarkupPct} %</label>}
    {value.cover === "enamel-matte" && <label className="check-row"><input type="checkbox" checked={!!value.lacquer} onChange={(e) => set({ lacquer: e.target.checked || undefined })} /> Лак на матовую эмаль +{VERNISSAGE_NOTES.enamelMatteLacquerPerM2} ₽/м²</label>}
    <p className="field-note">Прайс от {priceDateRu()}: {price.column ?? "—"} {price.base !== null ? `${price.base} ₽/м²` : ""}{price.perM2 !== null && price.perM2 !== price.base ? ` → ${price.perM2} ₽/м²` : ""}. ПВХ меньше {fmtRu(VERNISSAGE_NOTES.minAreaM2Pvc)} м² — как {fmtRu(VERNISSAGE_NOTES.minAreaM2Pvc)} м²; присадка под петли {VERNISSAGE_NOTES.hingeBoringPerPc} ₽/шт. Сторонний участок — вне раскроя ЛДСП.</p>
    {sizeErrors.map((x) => <p key={x} className="field-note" role="alert" style={{ color: "#b3261e" }}><b>Не по паспорту:</b> {x}</p>)}
    {[...sizeWarnings, ...price.warnings].map((x) => <p key={x} className="field-note" style={{ color: "#a4471d" }}>{x}</p>)}
    {price.notes.filter((x) => !x.startsWith("ПВХ меньше")).map((x) => <p key={x} className="field-note">{x}</p>)}
    {handle && <p className="field-note" role="note" style={{ color: "#a4471d" }}><b>Размеры условные.</b> Профиля ручки {m.id} на сайте Вернисажа нет — в 3D и на схеме нарисована паз-выборка по верхнему краю на всю ширину: высота {PROVISIONAL.handle.h} мм, глубина {PROVISIONAL.handle.d} мм от лица (одинаково для V5/V6/V7 до тех. информации Вернисажа). На цену не влияет.</p>}
    {m.pp ? <div className="field-note"><b>Паспорт PDF</b> ({m.pp.pdf}, стр. 1{m.pp.catPage ? `; стр. ${m.pp.catPage} каталога` : ""}): {m.shapeNote}.
      <br />Размеры с фрезеровкой, высота × ширина, мм: {(["solid", "glass", "grille", "drawer"] as const).map((k) => `${ROW_LABEL[k]} ${lim(m.pp!.limits[k])}`).join("; ")}{m.pp.maxAlt ? `; max ${m.pp.maxAlt.map(([a, b]) => `${a}×${b}`).join(" или ")}` : ""}.
      {m.pp.glass?.frame ? <><br />Рамка витрины/решётки {m.pp.glass.frame} мм{m.pp.glass.r ? `, угол проёма R${m.pp.glass.r}` : ""}{m.pp.glass.from ? ` (от фрезеровки №${m.pp.glass.from})` : ""}.</> : null}
      {m.pp.notes.length ? <><br />Примечания паспорта: {m.pp.notes.join("; ")}.</> : null}
      {m.pp.series && m.pp.series !== SERIES_LABEL[m.series] ? <><br />В паспорте серия «{m.pp.series}», в прайсе — «{SERIES_LABEL[m.series]}»: цена по прайсу.</> : null}</div>
      : !handle && !pet && <p className="field-note">Паспорта PDF у №{m.id} нет{m.pdfNote ? ` (${m.pdfNote})` : ""} — рисунок «{m.shapeNote}» по фото каталога, размеры условные: рамка {PROVISIONAL.frame} мм, паз {PROVISIONAL.groove.w}×{PROVISIONAL.groove.d} мм; ограничений размеров нет.</p>}
    <p className="field-note">{handle ? `Интегрированная ручка ${m.id}: только МДФ 19 мм, фасады прямые.` : pet ? "ПЭТ: гладкая плита 18 мм." : ""} {tex ? `В 3D — текстура плёнки «${tex.name}» с сайта Вернисажа (образец ${tex.tileMm} мм, масштаб приблизительный).` : value.cover.startsWith("enamel") || value.cover === "none" ? "В 3D — цвет эмали/МДФ." : value.film && V_FILM_COLORS[value.film] ? "Однотонная — в 3D цвет образца с сайта Вернисажа." : "Образца этой плёнки на сайте нет — в 3D цвет приблизительный, по названию."}</p>
  </div>;
}
