import {Children,Fragment,isValidElement,type ReactNode,type ReactElement} from 'react';

const groups=[
 {title:'Корпус и размещение',hint:'Размеры, положение, материалы и опоры',match:/^(Габариты|Корпус|Положение|Материал корпуса|Опоры|Навесы)/},
 {title:'Наполнение',hint:'Секции, полки, ящики, штанги и подсветка',match:/^(Полки|Ящики|Штанги|Подсветка|Секция|Очистка секции|Состав секции|Наполнение угла)/},
 {title:'Фасады и открывание',hint:'Фасады, ручки, петли и способ открывания',match:/^(Фасад|Ручки|Петли|Тип открывания|Материалы и фасады)/},
 {title:'Техника и подключения',hint:'Мойка, духовка и столешница',match:/^(Мойка|Духовка|Столешница)/},
 {title:'Дополнительно',hint:'Конструкция и технические параметры',match:/.*/},
];
function flatten(nodes:ReactNode):ReactNode[]{return Children.toArray(nodes).flatMap(n=>isValidElement<{children?:ReactNode}>(n)&&n.type===Fragment?flatten(n.props.children):[n]);}
function titleOf(node:ReactElement<any>):string|undefined{
 if(typeof node.props.title==='string')return node.props.title;
 if(node.type==='details'){const summary=flatten(node.props.children).find(n=>isValidElement(n)&&n.type==='summary');return isValidElement<{children?:ReactNode}>(summary)&&typeof summary.props.children==='string'?summary.props.children:undefined;}
 return typeof node.props.settingsTitle==='string'?node.props.settingsTitle:undefined;
}
/** Group existing controls without copying model state or changing command handlers. */
export function SettingsTree({children,className=''}:{children:ReactNode;className?:string}){
 const buckets:ReactNode[][]=groups.map(()=>[]),intro:ReactNode[]=[];
 for(const child of flatten(children)){
  const title=isValidElement(child)?titleOf(child):undefined;
  if(typeof title!=='string'){intro.push(child);continue;}
  buckets[groups.findIndex(g=>g.match.test(title))].push(child);
 }
 return <div className={'settings-tree '+className}>{intro}{groups.map((group,i)=>buckets[i].length>0&&<details className="settings-category" data-settings-category={group.title} key={group.title}>
  <summary><strong>{group.title}</strong><small>{group.hint}</small></summary><div className="settings-subsections">{buckets[i]}</div>
 </details>)}</div>;
}
export function revealSettings(element:HTMLElement|null|undefined){
 for(let current=element;current;current=current.parentElement){if(current instanceof HTMLDetailsElement)current.open=true;}
}
