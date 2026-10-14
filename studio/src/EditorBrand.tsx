import {Box} from 'lucide-react';
export function EditorBrand({kitchen=false}:{kitchen?:boolean}){return <a className="brand" href="./" aria-label="Ё Конструктор — главная"><span className="brand-mark"><Box size={23}/></span><strong>Ё Конструктор<span>{kitchen?'проектировщик кухни':'проектировщик мебели'}</span></strong></a>;}
