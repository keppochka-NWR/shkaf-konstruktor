import {type Project,projectErrors} from './project';
import {details,nest,detailCSV,nestingHTML,labelsHTML,specificationHTML,labelOrder} from './exports';
import {drawingsHTML} from './drawings';
import {placementHTML} from './placementPlan';
import {estimate,estimateCSV} from './pricing';
import {roomWarnings} from './roomWarnings';

/** A single immutable snapshot is shared by all documents in the archive. */
export function reviewFiles(project:Project,created=new Date()):Record<string,string>{
  const p=structuredClone(project),errors=projectErrors(p);
  if(errors.length)throw new Error(errors[0]);
  const sheets=nest(p),cost=estimate(p,sheets),warnings=roomWarnings(p);
  const note=[
    'КОМПЛЕКТ ДЛЯ ПРОВЕРКИ ТЕХНОЛОГОМ',
    labelOrder(p),
    'Сформирован: '+created.toISOString(),
    'Корпусов: '+p.modules.length+'; плитных деталей: '+details(p).length+'; листов: '+sheets.length+'.',
    '',
    'Все файлы сформированы из одного состояния проекта. После изменения конструкции сформируйте новый комплект целиком: коды деталей и номера листов могут измениться.',
    'Откройте 01-Проект.project.json в редакторе, чтобы продолжить работу. HTML-документы открываются в браузере; для PDF используйте печать браузера. CSV — UTF-8 с BOM, разделитель точка с запятой.',
    'Это внутренний комплект: он содержит закупочную смету и исходный проект. Для клиента используйте отдельное коммерческое предложение.',
    '',
    'ПЕРЕД ПРОИЗВОДСТВОМ',
    'Технолог должен проверить соединения, крепёж, кромление, зазоры, направление текстуры и замер. Присадка и управляющие программы не включены. Раскрой предварительный, минимальное число листов не гарантируется; поле и промежутки 10 мм. Размеры деталей габаритные, припуски станка не включены.',
    'Печатный масштаб и разбиение документов на страницы требуют проверки. Бирки: 90 × 50 мм, по 10 на A4, масштаб 100%, без колонтитулов браузера.',
    '',
    'ЗАМЕЧАНИЯ ПО РАССТАНОВКЕ: '+warnings.length,
    ...(warnings.length?warnings.map(w=>'• '+w.message):['Автоматических замечаний нет. Это не заменяет проверку технологом.']),
    '',
    'НЕЗАПОЛНЕННЫЕ ЦЕНЫ: '+cost.missing.length,
    ...(cost.missing.length?cost.missing.map(l=>'• '+l.label+' — '+l.quantity+' '+l.unit):['Все позиции текущей расчётной модели имеют цену. Полный крепёж, доставка и монтаж ещё не включены.']),
    '',
    p.cloud?'Последняя связанная серверная версия: '+p.cloud.revision+'. Локальные правки могут быть новее этой версии.':'Проект не связан с серверным сохранением.',
    'Создание архива не сохраняет проект на сервере. Для серверной записи используйте кабинет.'
  ].join('\r\n');
  return {
    '00-Прочитайте.txt':'\ufeff'+note,
    '01-Проект.project.json':JSON.stringify(p,null,2),
    '02-Ведомость.html':specificationHTML(p),
    '03-План расстановки.html':placementHTML(p),
    '04-Размерные виды.html':drawingsHTML(p),
    '05-Карты листов.html':nestingHTML(p),
    '06-Деталировка.csv':detailCSV(p),
    '07-Бирки.html':labelsHTML(p),
    '08-Смета.csv':estimateCSV(p,cost),
  };
}
export async function reviewArchive(project:Project){
  const snapshot=structuredClone(project),created=new Date();
  const {zipSync,strToU8}=await import('three/addons/libs/fflate.module.js');
  const files=reviewFiles(snapshot,created);
  return zipSync(Object.fromEntries(Object.entries(files).map(([name,text])=>[name,strToU8(text)])),{level:6});
}
export function reviewArchiveName(project:Project){
  const name=labelOrder(project).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().slice(0,80);
  return (name||'Проект')+' — комплект технологу.zip';
}
export async function downloadReviewArchive(project:Project){
  const snapshot=structuredClone(project),data=await reviewArchive(snapshot);
  const url=URL.createObjectURL(new Blob([new Uint8Array(data).buffer],{type:'application/zip'})),link=document.createElement('a');
  link.href=url;link.download=reviewArchiveName(snapshot);link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
