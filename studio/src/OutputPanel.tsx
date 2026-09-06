import {estimate} from './pricing';
import {placementHTML} from './placementPlan';
import {DrawingsPanel} from './DrawingsPanel';
import {EstimatePanel} from './EstimatePanel';
import { useState, useMemo } from "react";
import { type Project } from "./project";
import {
  nest,
  findSheetDetails,
  details,
  detailCSV,
  nestingHTML,
  quoteHTML,
  saveFile,
  sheetSVG,
  labelDetails,
  labelsHTML,
  specificationHTML,
} from "./exports";
export function OutputPanel({
  project,
  initialTab = "sheets",
  capture,
  inspect,
  update,
}: {
  project: Project;
  inspect: (moduleId:string,partId:string)=>void;
  initialTab?: "sheets" | "estimate";
  capture: () => string | undefined;
  update: (p: Project) => boolean;
}) {
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"sheets" | "quote" | "estimate" | "labels" | "drawings" | "specification" | "placement">(initialTab);
  const [detailQuery,setDetailQuery]=useState(''),[highlight,setHighlight]=useState('');
  const sheets = useMemo(()=>nest(project),[project]),all=useMemo(()=>details(project),[project]);
  const query=detailQuery.trim().toLocaleLowerCase('ru-RU');
  const found=useMemo(()=>findSheetDetails(sheets,query),[sheets,query]);
  const specification=useMemo(()=>tab==='specification'?specificationHTML(project):'',[project,tab]);
  const placement=useMemo(()=>tab==='placement'?placementHTML(project):'',[project,tab]);
  const [quoteImage,setQuoteImage]=useState<string|null>(null);
  const calculated=useMemo(()=>tab==='quote'?estimate(project,sheets):null,[tab,project,sheets]);
  const q = project.offer || { customer: "", price: "", notes: "" };
  const quotePreview=useMemo(()=>tab==='quote'&&quoteImage!==null?quoteHTML(project,q.customer,q.price,q.notes,quoteImage||undefined):'',[tab,project,quoteImage,q.customer,q.price,q.notes]);
  return (
    <div className="output-panel">
      <div className="output-tabs">
        <button
          aria-pressed={tab === "sheets"}
          onClick={() => setTab("sheets")}
        >
          Карты листов и деталировка
        </button>
        <button aria-pressed={tab === "quote"} onClick={() => setTab("quote")}>
          Коммерческое предложение
        </button>
        <button aria-pressed={tab === "placement"} onClick={()=>setTab("placement")}>Расстановка</button>
        <button aria-pressed={tab === "specification"} onClick={()=>setTab("specification")}>Ведомость</button>
        <button aria-pressed={tab === "drawings"} onClick={()=>setTab("drawings")}>Чертежи модулей</button>
        <button aria-pressed={tab === 'labels'} onClick={()=>setTab('labels')}>Бирки деталей</button>
        <button aria-pressed={tab === 'estimate'} onClick={()=>setTab('estimate')}>Смета</button>
      </div>
      {tab === "sheets" ? (
        <>
          <div className="output-actions">
            <button className="outline" onClick={()=>setTab("specification")}>Ведомость комплектации</button>
            <button
              className="primary"
              onClick={() =>
                saveFile("Карты листов.html", nestingHTML(project))
              }
            >
              Скачать карты / PDF
            </button>
            <button
              className="outline"
              onClick={() =>
                saveFile(
                  "Деталировка.csv",
                  detailCSV(project),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Деталировка CSV
            </button>
          </div>
          <p>
            {all.length} деталей · {sheets.length} листов · Lamarty{" "}
            <b>2750 × 1830 мм</b>
          </p>
          <p className="field-note">
            Для проверки технологом. Обрезка по краю 10 мм, промежуток 10 мм.
            Текстура вдоль длинной стороны. Укладка предварительная: не
            гарантирует минимального числа листов и не учитывает припуски
            станка.
          </p>
          <div className="detail-search"><label>Найти деталь на листе<input type="search" aria-label="Поиск детали на картах" placeholder="Код, корпус, материал или размер" value={detailQuery} onChange={e=>{setDetailQuery(e.target.value);setHighlight('');}}/></label>{query&&<><p>{found.length?`Найдено: ${found.length}. Выберите деталь, чтобы показать её на листе.`:'Детали не найдены. Попробуйте другое название или код.'}</p><div className="detail-results">{found.slice(0,30).map(({a,sheet})=><button key={a.detail.code} aria-pressed={highlight===a.detail.code} onClick={()=>{setSheetIndex(sheet);setHighlight(a.detail.code);}}><b>{a.detail.code} · {a.detail.name}</b><span>{a.detail.moduleName} · лист {sheet+1} · {a.h} × {a.w}</span></button>)}</div>{found.length>30&&<p>Показаны первые 30. Уточните запрос.</p>}</>}</div>
          {sheetIndex !== null && (
            <button className="text-action" onClick={() => {setSheetIndex(null);setHighlight("");}}>
              ← Все листы
            </button>
          )}
          <div
            className={"sheets-grid" + (sheetIndex !== null ? " enlarged" : "")}
          >
            {sheets.map((s, i) =>
              sheetIndex !== null && sheetIndex !== i ? null : (
                <section key={i}>
                  <h3>
                    Лист {i + 1} · {s.decor}
                  </h3>
                  <small>
                    {s.height} × {s.width} × {s.thickness} мм
                  </small>
                  <button
                    className="sheet-preview"
                    aria-label={"Увеличить лист " + (i + 1)}
                    onClick={() =>
                      setSheetIndex(sheetIndex === null ? i : null)
                    }
                  >
                    <span dangerouslySetInnerHTML={{ __html: sheetSVG(s,highlight) }} />
                  </button>
                  <p>
                    {s.items.length} деталей · заполнение{" "}
                    {Math.round(
                      (s.items.reduce((n, p) => n + p.w * p.h, 0) /
                        (s.width * s.height)) *
                        100,
                    )}
                    %
                  </p>
                  {sheetIndex !== null && (
                    <table>
                      <thead>
                        <tr>
                          <th>Код</th>
                          <th>Деталь</th>
                          <th>Размер</th><th>В модели</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.items.map((a) => (
                          <tr key={a.detail.code} className={highlight===a.detail.code?"highlight-detail":""}>
                            <td>{a.detail.code}</td>
                            <td>
                              {a.detail.moduleName} / {a.detail.name}
                            </td>
                            <td>
                              {a.h} × {a.w}
                            </td><td><button className="text-action" aria-label={'Показать в 3D деталь '+a.detail.code} onClick={()=>inspect(a.detail.moduleId,a.detail.id)}>Показать в 3D</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              ),
            )}
          </div>
        </>
      ) : tab === "placement" ? <><div className="output-actions"><button className="primary" onClick={()=>saveFile('План расстановки.html',placement)}>Скачать план / PDF</button><p className="field-note">Вид сверху и таблица отступов для согласования.</p></div><iframe title="Предпросмотр расстановки" className="specification-preview" sandbox="" srcDoc={placement.replace('<button onclick="window.print()">Печать / Сохранить PDF</button>','')}/></> : tab === "specification" ? <><div className="output-actions"><button className="primary" onClick={()=>saveFile('Ведомость проекта.html',specification)}>Скачать ведомость / PDF</button><p className="field-note">Проверьте комплект и замечания перед передачей технологу. Печать доступна в скачанном документе.</p></div><iframe title="Предпросмотр ведомости" className="specification-preview" sandbox="" srcDoc={specification.replace('<button onclick="window.print()">Печать / Сохранить PDF</button>','')}/></> : tab === "drawings" ? <DrawingsPanel project={project}/> : tab === "labels" ? <><p className="field-note">Бирки для проверки, 90 × 50 мм. Коды совпадают с деталировкой и картами текущего проекта. После изменения конструкции сформируйте весь комплект заново. Размеры габаритные, припуски и присадка ещё не включены.</p><button className="primary" onClick={()=>saveFile('Бирки деталей.html',labelsHTML(project))}>Скачать бирки / PDF</button><div className="label-grid">{labelDetails(project).map(d=><article className="label-card" key={d.code}><div><b>{d.code}</b><span>Лист {d.sheet}</span></div><strong>{d.name}</strong><small>{d.moduleName}</small><p>{d.material==='hdf'?'ЛХДФ':d.decor} · {d.thickness} мм</p><h3>{d.length} × {d.width} мм</h3><small>↑ Длина вдоль текстуры · для проверки</small></article>)}</div></> : tab === "estimate" ? <EstimatePanel project={project} update={update}/> : (
        <>
          <p className="field-note">
            КП содержит текущий вид проекта, размеры, материалы и наполнение
            всех модулей. Цену можно перенести из сметы или задать вручную;
            без неё выводится «после согласования».
          </p>
          <div className="quote-price-check">
            {calculated?.retail==null?<p>Смета ещё не завершена: незаполненных цен — {calculated?.missing.length??0}. Указанную вручную цену КП нужно проверить.</p>:<><p>По текущей смете: <b>{calculated.retail.toLocaleString('ru-RU')} ₽</b>.</p>{q.price.trim()&&Number(q.price)!==calculated.retail&&<p>Цена КП отличается от сметы. Проверьте её после изменения мебели; согласованную скидку можно оставить.</p>}<button className="outline" onClick={()=>update({...project,offer:{...q,price:String(calculated.retail)}})}>Подставить текущую смету</button></>}
            <button className="text-action" onClick={()=>setTab('estimate')}>Открыть смету</button>
          </div>
          <label className="hardware-field">
            Клиент / название предложения
            <input
              aria-label="Клиент для КП"
              key={'customer:'+q.customer}
              defaultValue={q.customer}
              maxLength={120}
              onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.currentTarget.blur();}}
              onBlur={e=>{if(e.target.value!==q.customer&&!update({...project,offer:{...q,customer:e.target.value}}))e.target.value=q.customer;}}
            />
          </label>
          <label className="hardware-field">
            Итоговая стоимость, ₽
            <input
              aria-label="Стоимость КП"
              type="number"
              min="0"
              key={'price:'+q.price}
              defaultValue={q.price}
              onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.currentTarget.blur();}}
              onBlur={e=>{if(e.target.value!==q.price&&!update({...project,offer:{...q,price:e.target.value}}))e.target.value=q.price;}}
            />
          </label>
          <label className="hardware-field">
            Условия и примечания
            <textarea
              aria-label="Условия КП"
              maxLength={2000}
              rows={4}
              key={'notes:'+q.notes}
              defaultValue={q.notes}
              onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.blur();}}
              onBlur={e=>{if(e.target.value!==q.notes&&!update({...project,offer:{...q,notes:e.target.value}}))e.target.value=q.notes;}}
            />
          </label>
          <div className="output-actions"><button className="outline" onClick={()=>setQuoteImage(quoteImage===null?(capture()||''):null)}>{quoteImage===null?'Предпросмотр КП':'Скрыть предпросмотр КП'}</button></div>
          <button
            className="primary"
            onClick={() =>
              saveFile(
                "Коммерческое предложение.html",
                quoteHTML(project, q.customer, q.price, q.notes, capture()),
              )
            }
          >
            Скачать КП / PDF
          </button>
          <p className="field-note">
            Откройте скачанный документ и нажмите «Печать / Сохранить PDF».
          </p>
          {quoteImage!==null&&<iframe title="Предпросмотр коммерческого предложения" className="specification-preview" sandbox="" srcDoc={quotePreview.replace('<button onclick="window.print()">Печать / Сохранить PDF</button>','')}/>}
        </>
      )}
    </div>
  );
}

