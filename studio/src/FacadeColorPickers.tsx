// Выбор цвета фасада Вернисаж (решение Макса 29.10.2026: «краска — по RAL, плёнка — из каталога Вернисаж», весь ассортимент с показом в 3D):
//  RalPicker — эмаль: весь RAL Classic образцами, поиск по коду и названию; в проект пишется «RAL 9003», в смете — с названием;
//  FilmSwatches — плёнка ПВХ / Адилет / ПЭТ: весь каталог образцами (текстура или цвет с сайта Вернисажа; «≈» — условный цвет по
//  названию, образца на сайте нет), поиск по названию. Образцы-картинки грузятся лениво (loading="lazy"), только когда список открыт.
import { useMemo, useState } from "react";
import { RAL_CLASSIC, RAL_GROUPS, ralOf, ralSearch, ralValue } from "./ralClassic";
import { filmSwatch } from "./facadesVernissage";

const fold = (s: string) => s.toLowerCase().replace(/ё/g, "е");

export function RalPicker({ value, onPick }: { value: string | undefined; onPick: (v: string) => void }) {
  const [q, setQ] = useState("");
  const cur = ralOf(value);
  const found = useMemo(() => ralSearch(q), [q]);
  return <div className="facade-colors" data-picker="ral">
    <div className="facade-colors-head">
      <span className="facade-colors-cur" style={{ background: cur?.hex ?? "transparent" }} aria-hidden="true" />
      <b>{cur ? `RAL ${cur.code} ${cur.name}` : value ? `${value} — не из каталога RAL` : "Цвет RAL не выбран"}</b>
    </div>
    <input type="search" className="facade-colors-search" aria-label="Поиск цвета RAL" placeholder="Код или название: 9003, антрацит…" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="facade-colors-box" role="radiogroup" aria-label="Каталог RAL Classic">
      {RAL_GROUPS.map((g) => {
        const list = found.filter((r) => r.code[0] === g.digit);
        if (!list.length) return null;
        return <section key={g.digit}><h5>{g.label}</h5><div className="facade-colors-grid">
          {list.map((r) => <button key={r.code} type="button" role="radio" aria-checked={cur?.code === r.code} aria-label={`RAL ${r.code} ${r.name}`} title={`RAL ${r.code} ${r.name}`} onClick={() => onPick(ralValue(r))}>
            <span className="facade-swatch" style={{ background: r.hex }} /><small>{r.code}</small></button>)}
        </div></section>;
      })}
      {!found.length && <p className="field-note">Нет такого цвета в RAL Classic ({RAL_CLASSIC.length} цветов).</p>}
    </div>
    <p className="field-note">Цвет на экране приблизительный — утверждать по вееру RAL.</p>
  </div>;
}

export function FilmSwatches({ cover, list, value, onPick }: { cover: "film" | "adilet" | "pet"; list: { name: string; group: string; note?: string }[]; value: string | undefined; onPick: (name: string) => void }) {
  const [q, setQ] = useState("");
  const swatches = useMemo(() => new Map(list.map((f) => [f.name, filmSwatch(cover, f.name)])), [cover, list]);
  const found = useMemo(() => { const w = fold(q).trim().split(/\s+/).filter(Boolean); return w.length ? list.filter((f) => w.every((x) => fold(f.name + " " + f.group).includes(x))) : list; }, [q, list]);
  const groups = useMemo(() => [...new Set(found.map((f) => f.group))], [found]);
  const real = [...swatches.values()].filter((s) => s.kind !== "name").length;
  const cur = value ? swatches.get(value) : undefined;
  const base = import.meta.env.BASE_URL;
  return <div className="facade-colors" data-picker={cover}>
    <div className="facade-colors-head">
      <span className="facade-colors-cur" style={{ background: cur?.color ?? "transparent", backgroundImage: cur?.url ? `url(${base}${cur.url})` : undefined }} aria-hidden="true" />
      <b>{value ?? "Плёнка не выбрана"}</b>{cur?.kind === "name" && <small title="Образца этой плёнки на сайте Вернисажа нет — цвет условный, по названию"> ≈ цвет условный</small>}
    </div>
    <input type="search" className="facade-colors-search" aria-label="Поиск плёнки" placeholder="Название плёнки…" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="facade-colors-box" role="radiogroup" aria-label="Каталог плёнок Вернисаж">
      {groups.map((g) => <section key={g}><h5>{g}</h5><div className="facade-colors-grid facade-colors-grid--film">
        {found.filter((f) => f.group === g).map((f) => {
          const s = swatches.get(f.name)!, tip = `${f.name}${f.note ? " · " + f.note : ""}${s.kind === "name" ? " · образца на сайте нет, цвет условный" : ""}`;
          return <button key={g + f.name} type="button" role="radio" aria-checked={value === f.name} aria-label={f.name} title={tip} onClick={() => onPick(f.name)}>
            <span className="facade-swatch" style={{ background: s.color }}>{s.url ? <img src={base + s.url} alt="" loading="lazy" decoding="async" /> : null}{s.kind === "name" ? <em>≈</em> : null}</span>
            <small>{f.name}</small></button>;
        })}
      </div></section>)}
      {!found.length && <p className="field-note">Не найдено.</p>}
    </div>
    <p className="field-note">{list.length} плёнок: {real} — образец с сайта Вернисажа, у остальных «≈» — цвет условный, по названию (образца на сайте нет).</p>
  </div>;
}
