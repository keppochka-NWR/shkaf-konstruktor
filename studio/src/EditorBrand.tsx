import {Box} from 'lucide-react';
export function EditorBrand({kitchen=false}:{kitchen?:boolean}){return <a className="brand" href="./" aria-label="ГардерЁб — главная"><span className="brand-mark"><Box size={23}/></span><strong>ГардерЁб<span>{kitchen?'проектировщик кухни':'проектировщик мебели'}</span></strong></a>;}
