import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ManagerMode, millingOptionLabel, millingVisible } from "./clientLabels";
import { MILL_STYLES, MILLING_TILES, tierGroups, tileOf, type MillStyle } from "./vernissageCatalog";
import { VERNISSAGE_MARKUP_DEFAULT } from "./pricing";
import "./vernissage-picker.css";
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
  // клиенту: короткие имена фрезеровок, без «паспорт/условно» и неопознанных рисунков; менеджер («Все настройки») видит всё
  const manager = useContext(ManagerMode);
  return <div className="vernissage-picker">
    {!manager ? <MillingTiles selected={m.id} misfit={misfit} onPick={(id) => set({ milling: id })} /> : <>
    <label className="hardware-field">Серия<select aria-label="Серия Вернисаж" value={s.id} onChange={(e) => { const first = VERNISSAGE_MILLINGS.find((x) => x.series === e.target.value)!; set({ milling: first.id, open: undefined }); }}>
      {VERNISSAGE_SERIES.map((x) => <option key={x.id} value={x.id}>{SERIES_LABEL[x.id as VSeriesId]}</option>)}</select></label>
    {!pet && <label className="hardware-field">{handle ? "Модель ручки" : "Фрезеровка"}<select aria-label="Фрезеровка Вернисаж" value={m.id} onChange={(e) => set({ milling: e.target.value })}>
      {VERNISSAGE_MILLINGS.filter((x) => x.series === s.id && millingVisible(x, x.id === m.id, manager)).map((x) => <option key={x.id} value={x.id}>{millingOptionLabel(x, { handle, misfit: misfit.has(x.id), manager })}</option>)}</select></label>}
    </>}
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
    {m.mdf19Only && <p className="field-note">№{m.id}: МДФ 19 мм для фасадов с петлями; 16 мм — только без петель{manager ? " (прайс, примечание к серии Престиж)" : ""}.</p>}
    {value.cover !== "none" && value.cover !== "pet" && <label className="check-row"><input type="checkbox" checked={!!value.patina} onChange={(e) => set({ patina: e.target.checked || undefined })} /> Патина</label>}
    {value.cover.startsWith("enamel") && <label className="check-row"><input type="checkbox" checked={!!value.twoSided} onChange={(e) => set({ twoSided: e.target.checked || undefined })} /> Покраска с 2 сторон +{VERNISSAGE_NOTES.enamelTwoSidedMarkupPct} %</label>}
    {value.cover === "enamel-matte" && <label className="check-row"><input type="checkbox" checked={!!value.lacquer} onChange={(e) => set({ lacquer: e.target.checked || undefined })} /> Лак на матовую эмаль</label>}
    <p className="field-note">Фасады заказные, изготавливаются отдельно. Выбор покрытия учтён в итоговой стоимости проекта.</p>
    {sizeErrors.map((x) => <p key={x} className="field-note" role="alert" style={{ color: "#b3261e" }}><b>Не по паспорту:</b> {x}</p>)}
    {[...sizeWarnings, ...price.warnings].map((x) => <p key={x} className="field-note" style={{ color: "#a4471d" }}>{x}</p>)}
    {manager && handle && <p className="field-note" role="note" style={{ color: "#a4471d" }}><b>Размеры условные.</b> Профиля ручки {m.id} на сайте Вернисажа нет — в 3D и на схеме нарисована паз-выборка по верхнему краю на всю ширину: высота {PROVISIONAL.handle.h} мм, глубина {PROVISIONAL.handle.d} мм от лица (одинаково для V5/V6/V7 до тех. информации Вернисажа). На цену не влияет.</p>}
    {!manager ? null : m.pp ? <div className="field-note"><b>Паспорт PDF</b> ({m.pp.pdf}, стр. 1{m.pp.catPage ? `; стр. ${m.pp.catPage} каталога` : ""}): {m.shapeNote}.
      <br />Размеры с фрезеровкой, высота × ширина, мм: {(["solid", "glass", "grille", "drawer"] as const).map((k) => `${ROW_LABEL[k]} ${lim(m.pp!.limits[k])}`).join("; ")}{m.pp.maxAlt ? `; max ${m.pp.maxAlt.map(([a, b]) => `${a}×${b}`).join(" или ")}` : ""}.
      {m.pp.glass?.frame ? <><br />Рамка витрины/решётки {m.pp.glass.frame} мм{m.pp.glass.r ? `, угол проёма R${m.pp.glass.r}` : ""}{m.pp.glass.from ? ` (от фрезеровки №${m.pp.glass.from})` : ""}.</> : null}
      {m.pp.notes.length ? <><br />Примечания паспорта: {m.pp.notes.join("; ")}.</> : null}
      {m.pp.series && m.pp.series !== SERIES_LABEL[m.series] ? <><br />В паспорте серия «{m.pp.series}», в прайсе — «{SERIES_LABEL[m.series]}»: цена по прайсу.</> : null}</div>
      : !handle && !pet && <p className="field-note">Паспорта PDF у №{m.id} нет{m.pdfNote ? ` (${m.pdfNote})` : ""} — рисунок «{m.shapeNote}» по фото каталога, размеры условные: рамка {PROVISIONAL.frame} мм, паз {PROVISIONAL.groove.w}×{PROVISIONAL.groove.d} мм; ограничений размеров нет.</p>}
    {manager && <p className="field-note">{handle ? `Интегрированная ручка ${m.id}: только МДФ 19 мм, фасады прямые.` : pet ? "ПЭТ: гладкая плита 18 мм." : ""} {tex ? `В 3D — текстура плёнки «${tex.name}» с сайта Вернисажа (образец ${tex.tileMm} мм, масштаб приблизительный).` : value.cover.startsWith("enamel") || value.cover === "none" ? "В 3D — цвет эмали/МДФ." : value.film && V_FILM_COLORS[value.film] ? "Однотонная — в 3D цвет образца с сайта Вернисажа." : "Образца этой плёнки на сайте нет — в 3D цвет приблизительный, по названию."}</p>}
  </div>;
}

const rub = (x: number) => x.toLocaleString("ru-RU");
const tileNo = (id: string, series: string) => series === "pet" ? "" : series === "handle" ? id : `№${id}`;

/** Выбор рисунка для клиента (решение 16.10, вариант А): сразу все рисунки плитками с фото, группы по цене (дешёвые сверху),
 *  стиль — фильтр-чипы. Выбор применяется сразу (3D и превью обновляются). Без фото — наша схема с пометкой «схема». */
function MillingTiles({ selected, misfit, onPick }: { selected: string; misfit: Set<string>; onPick: (id: string) => void }) {
  const [style, setStyle] = useState<MillStyle | "all">("all");
  const groups = useMemo(() => tierGroups(VERNISSAGE_MARKUP_DEFAULT), []);
  const schemes = useMemo(() => Object.fromEntries(MILLING_TILES.filter((t) => !t.photo).map((t) => [t.id, previewSvg(vernissageLayout(normalizeVernissage({ milling: t.id, cover: "film", film: "Моно белый", thickness: 19 }), 450, 716), 160)])), []);
  const cur = tileOf(selected);
  const box = useRef<HTMLDivElement>(null);
  // выбранная плитка — в зоне видимости списка (без прокрутки всей страницы)
  useEffect(() => {
    const b = box.current, el = b?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (b && el) b.scrollTop = Math.max(0, el.offsetTop - 36); // 36 — под липким заголовком группы
  }, [style]);
  const count = (st: MillStyle | "all") => MILLING_TILES.filter((t) => st === "all" || t.style === st).length;
  return <div className="vmill">
    <div className="vmill-current" aria-live="polite">
      <span>Рисунок</span><b>{cur?.name ?? `№${selected}`}</b>{cur && tileNo(cur.id, cur.milling.series) ? <small>{tileNo(cur.id, cur.milling.series)}</small> : null}
    </div>
    {!cur && <p className="field-note">Этого рисунка нет среди плиток — менеджер покажет его в каталоге фабрики.</p>}
    <div className="vmill-chips" role="group" aria-label="Стиль рисунка">
      {(["all", ...MILL_STYLES.map((x) => x.id)] as const).map((st) => <button key={st} type="button" aria-pressed={style === st} onClick={() => setStyle(st)}>
        {st === "all" ? "Все" : MILL_STYLES.find((x) => x.id === st)!.label}<span>{count(st)}</span></button>)}
    </div>
    <div className="vmill-box" ref={box} role="radiogroup" aria-label="Фрезеровка Вернисаж">
      {groups.map((g) => {
        const tiles = g.tiles.filter((t) => style === "all" || t.style === style);
        if (!tiles.length) return null;
        return <section key={g.id} className="vmill-group" aria-label={`${g.label} — от ${rub(g.from)} ₽ за м²`}>
          <h4>{g.label}<span>от {rub(g.from)} ₽/м²</span></h4>
          <p>{g.hint}</p>
          <div className="vmill-grid">{tiles.map((t) => {
            const no = tileNo(t.id, t.milling.series), bad = misfit.has(t.id);
            return <button key={t.id} type="button" role="radio" aria-checked={t.id === selected} aria-label={`${t.name}${no ? ", " + no : ""}`} className={"vmill-tile" + (bad ? " is-misfit" : "")} onClick={() => onPick(t.id)}>
              <span className="vmill-pic">{t.photo
                ? <img src={import.meta.env.BASE_URL + t.photo} alt="" loading="lazy" decoding="async" />
                : <><span className="vmill-scheme" dangerouslySetInnerHTML={{ __html: schemes[t.id] }} /><em className="vmill-badge">схема</em></>}</span>
              <b>{t.name}</b>
              <small>{[no, t.glass ? "бывает со стеклом" : "", bad ? "не по размеру фасадов" : ""].filter(Boolean).join(" · ")}</small>
            </button>;
          })}</div>
        </section>;
      })}
    </div>
    <p className="field-note">Фото — из каталога фабрики, цвет на фото — пример: плёнка или эмаль выбираются ниже. Цена за м² — ориентир в плёнке, МДФ 19 мм; точная — в расчёте проекта.</p>
  </div>;
}