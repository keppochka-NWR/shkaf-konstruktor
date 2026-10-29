// Отделка помещения (список Макса 29.10.2026): ламинат и плитка на пол, обои (или покраска, плитка) на стены — по ассортименту
// Лемана ПРО (lemanapro.ru). Только показ клиенту: в детали, смету и цены отделка НЕ входит.
// Каталог собран 29.10.2026 из поисковой выдачи lemanapro.ru (страницы сайта роботу закрыты, 401): название, артикул, ссылка —
// как на сайте; размер доски/плитки/рулона — из названия или характеристик карточки (у части ламината — по коллекции у
// производителя). Картинки товаров НЕ копируются (права, репозиторий публичный): текстуры рисуются процедурно
// (finishTextures.ts) по цвету и рисунку, точный вид — по ссылке «Открыть на Лемана Про». Наличие в магазине не проверялось.
import type {Opening} from './project';

export type FinishWall=Opening['wall'];
export const FINISH_WALLS:readonly FinishWall[]=['back','left','right','front'];
export const FINISH_WALL_NAMES:Record<FinishWall,string>={back:'Задняя',left:'Левая',right:'Правая',front:'Передняя'};
export type FinishKind='laminate'|'tile'|'wallpaper';
export const FINISH_KIND_NAMES:Record<FinishKind,string>={laminate:'Ламинат',tile:'Плитка',wallpaper:'Обои'};
/** Рисунок процедурной текстуры. Ламинат: доска / ёлочка. Плитка: под камень, мрамор, бетон… Обои: однотон, фактура, полоса… */
export type FinishLook='plank'|'herringbone'|'plain'|'stone'|'marble'|'concrete'|'terrazzo'|'wood'|'mosaic'|'texture'|'stripes'|'geometric'|'floral'|'abstract';
export type FinishItem={
  /** = артикул Лемана ПРО */
  id:string;kind:FinishKind;name:string;brand:string;collection?:string;article:string;url:string;
  /** Ламинат — доска (длина × ширина), плитка — плитка (длина × ширина), мм. Обои — [ширина рулона, длина рулона], мм. */
  size:[number,number];
  /** Обои: шаг раппорта, мм, — только если он есть в карточке товара (0 — «без подбора рисунка»); нет поля — раппорт не известен,
   *  клиенту не показывается (критик 29.10: 640 мм у половины обоев было значением по умолчанию, не из карточки). */
  repeat?:number;
  /** Ламинат: класс, толщина, фаска. Плитка: толщина. */
  grade?:number;thickness?:number;chamfer?:boolean;
  /** Плитка: куда кладут (по карточке или по формату). */
  surface?:'floor'|'wall'|'both';
  look:FinishLook;
  /** Цвет и рисунок словами (по карточке). */
  colour:string;
  /** Цвета процедурной текстуры: основной и второй (волокна, прожилки, рисунок). Условно, по описанию. */
  tone:[string,string];
};

const L='https://lemanapro.ru/product/';
const lam=(article:string,slug:string,name:string,brand:string,collection:string|undefined,size:[number,number],grade:number,thickness:number,chamfer:boolean|undefined,look:'plank'|'herringbone',colour:string,tone:[string,string]):FinishItem=>({id:article,kind:'laminate',name,brand,...(collection?{collection}:{}),article,url:L+slug+'-'+article+'/',size,grade,thickness,...(chamfer===undefined?{}:{chamfer}),look,colour,tone});
const tile=(article:string,slug:string,name:string,brand:string,collection:string,size:[number,number],thickness:number|undefined,surface:'floor'|'wall'|'both',look:FinishLook,colour:string,tone:[string,string]):FinishItem=>({id:article,kind:'tile',name,brand,collection,article,url:L+slug+'-'+article+'/',size,...(thickness?{thickness}:{}),surface,look,colour,tone});
const wp=(article:string,slug:string,name:string,brand:string,collection:string|undefined,rollWidth:number,rollLength:number,repeat:number|undefined,look:FinishLook,colour:string,tone:[string,string]):FinishItem=>({id:article,kind:'wallpaper',name,brand,...(collection?{collection}:{}),article,url:L+slug+'-'+article+'/',size:[rollWidth,rollLength],...(repeat===undefined?{}:{repeat}),look,colour,tone});

export const FINISHES:readonly FinishItem[]=[
  // ── Ламинат ──
  lam('85999876','laminat-artfloor-dub-ulvar-33-klass-tolshchina-8-mm-s-faskoy-2153-m','Ламинат Artfloor Дуб ульвар 33 класс 8 мм с фаской','Artfloor',undefined,[1380,195],33,8,true,'plank','светлый белёный дуб',['#d9cfc0','#b8a890']),
  lam('90785624','laminat-tarkett-estetica-dub-natur-belyy-33-klass-tolshchina-9-mm-s-faskoy-175-m','Ламинат Tarkett Estetica Дуб Натур Белый 33 класс 9 мм с фаской','Tarkett','Estetica',[1292,194],33,9,true,'plank','белёный светлый дуб',['#e2d8c8','#c2b39b']),
  lam('90785627','laminat-tarkett-estetica-dub-natur-seryy-33-klass-tolshchina-9-mm-s-faskoy-175-m','Ламинат Tarkett Estetica Дуб Натур Серый 33 класс 9 мм с фаской','Tarkett','Estetica',[1292,194],33,9,true,'plank','серый дуб',['#a9a39a','#857e74']),
  lam('90785625','laminat-tarkett-estetica-dub-natur-korichnevyy-33-klass-tolshchina-9-mm-s-faskoy-175-m','Ламинат Tarkett Estetica Дуб Натур Коричневый 33 класс 9 мм с фаской','Tarkett','Estetica',[1292,194],33,9,true,'plank','коричневый дуб, средний тон',['#9b7350','#6e4f35']),
  lam('90785635','laminat-tarkett-estetica-dub-effekt-svetlo-korichnevyy-33-klass-tolshchina-9-mm-s-faskoy-175-m','Ламинат Tarkett Estetica Дуб Эффект Светло-коричневый 33 класс 9 мм с фаской','Tarkett','Estetica',[1292,194],33,9,true,'plank','светло-коричневый дуб',['#b8936a','#8a6a48']),
  lam('90785739','laminat-tarkett-woodstock-dub-korolevskiy-svetlyy-bezhevyy-33-klass-tolshchina-8-mm-201-m','Ламинат Tarkett Woodstock Дуб Королевский Светлый Бежевый 33 класс 8 мм','Tarkett','Woodstock',[1292,194],33,8,false,'plank','светлый бежевый дуб',['#d6c3a0','#b09670']),
  lam('90785741','laminat-tarkett-woodstock-dub-medovyy-shervud-korichnevyy-33-klass-tolshchina-8-mm-201-m','Ламинат Tarkett Woodstock Дуб Медовый Шервуд Коричневый 33 класс 8 мм','Tarkett','Woodstock',[1292,194],33,8,false,'plank','медово-коричневый дуб',['#b9853f','#8a5e2a']),
  lam('91302103','laminat-egger-classic-dub-parketnyy-temnyy-32-klass-tolshchina-8-mm-s-faskoy-2-m','Ламинат Egger Classic Дуб Паркетный Тёмный 32 класс 8 мм с фаской','Egger','Classic',[1292,193],32,8,true,'plank','тёмный дуб',['#5e4330','#3d2a1d']),
  lam('90785470','laminat-egger-dub-sherman-svetlo-seryy-32-klass-tolshchina-8-mm-s-faskoy-2-m','Ламинат Egger Дуб Шерман Светло-Серый 32 класс 8 мм с фаской','Egger',undefined,[1292,193],32,8,true,'plank','светло-серый дуб',['#c9c4bb','#a39d92']),
  lam('90840093','laminat-egger-dub-soriya-belyy-32-klass-tolshchina-8-mm-s-faskoy-199-m','Ламинат Egger Дуб Сория белый 32 класс 8 мм с фаской','Egger',undefined,[1292,193],32,8,true,'plank','белый дуб',['#e6dfd3','#c9bfae']),
  lam('90785502','laminat-egger-oreh-bedollo-temnyy-33-klass-tolshchina-8-mm-s-faskoy-2-m','Ламинат Egger Орех Бедолло Тёмный 33 класс 8 мм с фаской','Egger',undefined,[1292,193],33,8,true,'plank','тёмный орех',['#5a3f2e','#3a271b']),
  lam('90785491','laminat-egger-dub-bardolino-korichnevyy-33-klass-tolshchina-8-mm-s-faskoy-2-m','Ламинат Egger Дуб Бардолино Коричневый 33 класс 8 мм с фаской','Egger',undefined,[1292,193],33,8,true,'plank','коричневый дуб',['#8a6445','#5f432c']),
  lam('91302098','laminat-egger-classic-dub-garden-svetlyy-33-klass-tolshchina-8-mm-s-faskoy-2-m','Ламинат Egger Classic Дуб Гарден Светлый 33 класс 8 мм с фаской','Egger','Classic',[1292,193],33,8,true,'plank','светлый дуб',['#cdb48e','#a88d66']),
  lam('91302126','laminat-egger-large-aqua-dub-sherman-seryy-33-klass-tolshchina-8-mm-s-faskoy-254-m','Ламинат Egger Large Aqua+ Дуб Шерман Серый 33 класс 8 мм с фаской','Egger','Large Aqua+',[1292,246],33,8,true,'plank','серый дуб, широкая доска',['#9e988e','#7a7369']),
  lam('90840143','laminat-kastamonu-dub-everest-svetlyy-33-klass-tolshchina-8-mm-s-faskoy-2153-m','Ламинат Kastamonu Дуб Эверест светлый 33 класс 8 мм с фаской','Kastamonu',undefined,[1380,195],33,8,true,'plank','светлый дуб',['#d8cbb3','#b4a385']),
  lam('90408693','laminat-kastamonu-dub-gornyy-svetlyy-33-klass-tolshchina-8-mm-s-faskoy-215-m','Ламинат Kastamonu Дуб горный светлый 33 класс 8 мм с фаской','Kastamonu',undefined,[1380,193],33,8,true,'plank','светлый дуб',['#cfbc9a','#a99572']),
  lam('91314902','laminat-kastamonu-sunfloor-dub-split-33-klass-tolshchina-12-mm-s-faskoy-1755-m','Ламинат Kastamonu Sunfloor Дуб Сплит 33 класс 12 мм с фаской','Kastamonu','Sunfloor',[1380,159],33,12,true,'plank','бежевый дуб (кантри)',['#c4a57c','#977a55']),
  lam('90857727','laminat-quick-step-dub-sero-bezhevyy-32-klass-tolshchina-8-mm-s-faskoy-1835-m','Ламинат Quick Step Дуб серо-бежевый 32 класс 8 мм с фаской','Quick-Step',undefined,[1380,190],32,8,true,'plank','серо-бежевый дуб',['#bdb3a3','#968b79']),
  lam('90857710','laminat-quick-step-dub-etnicheskiy-seryy-32-klass-tolshchina-8-mm-s-faskoy-1835-m','Ламинат Quick Step Дуб Этнический Серый 32 класс 8 мм с фаской','Quick-Step',undefined,[1380,190],32,8,true,'plank','серый дуб',['#8f8a82','#6c665e']),
  lam('90857718','laminat-quick-step-doska-belogo-duba-lak-32-klass-tolshchina-8-mm-s-faskoy-1835-m','Ламинат Quick Step Доска белого дуба лак 32 класс 8 мм с фаской','Quick-Step',undefined,[1380,190],32,8,true,'plank','белый лакированный дуб',['#e9e3d7','#cfc6b5']),
  lam('90846460','laminat-quick-step-classic-dub-naturalnyy-otbelennyy-32-klass-tolshchina-8-mm-s-faskoy-1596-m','Ламинат Quick Step Classic Дуб натуральный отбеленный 32 класс 8 мм с фаской','Quick-Step','Classic',[1200,190],32,8,true,'plank','отбеленный натуральный дуб',['#ddd2bf','#bba98d']),
  lam('90840112','laminat-kronospan-castello-classic-dub-severnyy-32-klass-tolshchina-8-mm-222-m','Ламинат Kronospan Castello Classic Дуб Северный 32 класс 8 мм','Kronospan','Castello Classic',[1285,192],32,8,false,'plank','натуральный дуб, тёплый тон',['#c29b6b','#946f45']),
  lam('92570212','laminat-kronotex-elochka-dub-prestizh-seryy-33-klass-tolshchina-10-mm-088-m','Ламинат Kronotex ёлочка Дуб Престиж серый 33 класс 10 мм','Kronotex',undefined,[665,133],33,10,undefined,'herringbone','серый дуб, ёлочка',['#a8a196','#827a6e']),
  lam('90982961','laminat-alsafloor-herringbone-x-lock-calisson-oak-elka-33-klass-tolshchina-8-mm-s-faskoy-184-m','Ламинат Alsafloor Herringbone X Lock Calisson Oak ёлка 33 класс 8 мм с фаской','Alsafloor','Herringbone X Lock',[644,143],33,8,true,'herringbone','бежевый дуб, ёлочка',['#cdb58f','#a68c66']),
  lam('92548637','laminat-alpine-floor-herringbone-10-elka-lf107-10-dub-veneto-33-klass-tolshchina-10-mm-s-faskoy-156-m','Ламинат Alpine Floor Herringbone 10 ёлка LF107-10 Дуб Венето 33 класс 10 мм с фаской','Alpine Floor','Herringbone 10',[600,100],33,10,true,'herringbone','дуб, ёлочка (тон уточнить по ссылке)',['#b89a74','#8f7351']),
  // ── Плитка и керамогранит ──
  tile('91702335','keramogranit-kerama-marazzi-pro-laymstoun-dd641020r-60x60sm-cvet-seryy','Керамогранит Kerama Marazzi Про лаймстоун DD641020R 60×60 серый','Kerama Marazzi','Про Лаймстоун',[600,600],undefined,'both','stone','серый известняк',['#b4b0a8','#8f8a82']),
  tile('90295314','keramicheskiy-granit-kerama-marazzi-korolevskaya-doroga-bezhevyy-obreznoy-60x60sm','Керамогранит Kerama Marazzi Королевская дорога бежевый обрезной 60×60','Kerama Marazzi','Королевская дорога',[600,600],undefined,'both','stone','бежевый камень',['#d3c4a8','#b09f80']),
  tile('90296379','keramicheskiy-granit-kerama-marazzi-monte-tiberio-lappatirovannyy-60x60sm','Керамогранит Kerama Marazzi Монте Тиберио лаппатированный 60×60','Kerama Marazzi','Монте Тиберио',[600,600],undefined,'both','marble','светлый мрамор (тон уточнить по ссылке)',['#e4e0d8','#9a9288']),
  tile('90299869','keramogranit-kerama-marazzi-terracco-sg631800r-60x60sm-cvet-bezhevyy','Керамогранит Kerama Marazzi Терраццо SG631800R 60×60 бежевый','Kerama Marazzi','Терраццо',[600,600],11,'floor','terrazzo','бежевое терраццо',['#d9cdb8','#8c7b66']),
  tile('84709060','keramogranit-estima-st011-30x30x08-sm-153-m-nepolirovannyy-cvet-seryy','Керамогранит Estima ST011 30×30 неполированный серый','Estima','Standard',[300,300],8,'floor','plain','серый однотонный',['#9a9a96','#7d7d79']),
  tile('90902283','keramogranit-estima-st16-nsr9-30x30x8n-uc-30x30sm-153-m-cvet-seryy','Керамогранит Estima ST16 30×30 серый','Estima','Standard',[300,300],8,'floor','plain','серый однотонный',['#a6a5a0','#888782']),
  tile('90522960','keramogranit-ldecor-rain-marble-60x120sm-pod-mramor-belyy-polirovannyy-cena-za-upakovku','Керамогранит LDECOR Rain Marble 60×120 под мрамор белый полированный','LDECOR','Rain Marble',[1200,600],9,'both','marble','белый мрамор, глянец',['#f0eeea','#8d8a86']),
  tile('91469836','keramogranit-ldecor-parade-prde-12ag-rm-seryy-terracco-pod-kamen-60x120-matovyy-144-m2','Керамогранит LDECOR Parade серый терраццо 60×120 матовый','LDECOR','Parade',[1200,600],undefined,'both','terrazzo','серое терраццо, матовое',['#b3b1ac','#6e6c68']),
  tile('90913993','keramogranit-laparet-atlantic-white-x9999294582-60x120sm-144-m-cvet-belyy','Керамогранит Laparet Atlantic White 60×120 белый','Laparet','Atlantic',[1200,600],9,'both','marble','белый мрамор, полированный',['#eeece8','#a9a6a1']),
  tile('82755493','keramogranit-laparet-calacatta-superb-120x60x09-sm-144-m-cvet-belyy','Керамогранит Laparet Calacatta Superb 120×60 белый','Laparet','Calacatta Superb',[1200,600],9,'both','marble','белый мрамор калакатта',['#f2efe9','#b49a6e']),
  tile('84405650','keramogranit-laparet-onyx-sky-60x120-sm-144-m-polirovannyy-cvet-belo-seryy','Керамогранит Laparet Onyx Sky 60×120 полированный бело-серый','Laparet','Onyx Sky',[1200,600],undefined,'both','marble','бело-серый оникс, полированный',['#e3e2df','#a5a7aa']),
  tile('90833447','keramogranit-laparet-onix-blanco-x9999282586-60x120sm-144-m-cvet-belyy','Керамогранит Laparet Onix Blanco 60×120 белый','Laparet','Onix',[1200,600],11,'both','stone','белый камень',['#ebe8e2','#c8c3ba']),
  tile('92055488','keramogranit-ceradim-concrete-h9999304547-60x120sm-cvet-seryy-serebristyy','Керамогранит Ceradim Concrete 60×120 серый','Ceradim','Concrete',[1200,600],undefined,'both','concrete','серый бетон',['#9c9c99','#7c7c79']),
  tile('92308121','keramogranit-starowood-bosco-teak-carving-1237310-20x120sm-cvet-korichnevyy','Керамогранит Starowood Bosco Teak Carving 20×120 коричневый','Starowood','Bosco',[1200,200],undefined,'floor','wood','коричневый тик',['#8a5a35','#5e3b20']),
  tile('92287233','keramogranit-gravita-novela-78803624-20x120sm-cvet-wenge','Керамогранит Gravita Novela 20×120 венге','Gravita','Novela',[1200,200],9,'floor','wood','венге, тёмно-коричневое дерево',['#4a3528','#2e2018']),
  tile('89405522','keramogranit-vitra-alice-20x120-sm-144-m-matovyy-cvet-orehovyy','Керамогранит Vitra Alice 20×120 матовый ореховый','Vitra','Alice',[1200,200],undefined,'floor','wood','ореховое дерево, матовое',['#8c6a4c','#634a33']),
  tile('89266127','glazurovannyy-keramogranit-lb-ceramics-morris-30x603-sm-144-m-matovyy-cvet-derevo','Керамогранит LB Ceramics Моррис 30×60,3 матовый под дерево','LB Ceramics','Моррис',[603,300],8.5,'both','wood','светлое дерево, матовое',['#c9ae8c','#a28866']),
  tile('87653860','plitka-nastennaya-kerama-marazzi-sigma-20x60-sm-12-m-matovaya-cvet-belyy-kvadratiki','Плитка настенная Kerama Marazzi Сигма 20×60 матовая белая «квадратики»','Kerama Marazzi','Сигма',[600,200],9,'wall','mosaic','белая матовая с рельефом «квадратики»',['#f1f0ec','#dddbd5']),
  tile('90581654','keramicheskaya-plitka-laparet-vega-nastennaya-bezhevyy-mozaika-17-10-11-490-20x60','Плитка настенная Laparet Vega бежевая мозаика 20×60','Laparet','Vega',[600,200],9,'wall','mosaic','бежевая, декор «мозаика»',['#d8c9b0','#b9a88c']),
  tile('84133814','plitka-nastennaya-axima-skandinaviya-28x40-sm-1232-m-cvet-seryy','Плитка настенная Axima Скандинавия 28×40 серая','Axima','Скандинавия',[400,280],8,'wall','plain','серая матовая',['#a7a7a3','#8f8f8b']),
  tile('86745651','plitka-nastennaya-shahtinskaya-plitka-vostok-01-25x40-sm-14-m-glyancevaya-cvet-belyy-mramor','Плитка настенная Шахтинская плитка Восток 01 25×40 глянцевая белый мрамор','Шахтинская плитка','Восток',[400,250],8,'wall','marble','белый мрамор, глянец',['#efede9','#b3aea6']),
  tile('89360221','plitka-nastennaya-cersanit-marvel-17349-298x598-sm-1425-m-glyancevaya-cvet-belyy','Плитка настенная Cersanit Marvel 29,8×59,8 глянцевая белая','Cersanit','Marvel',[598,298],8.5,'wall','marble','белый мрамор, глянец',['#f3f2ef','#a8a6a2']),
  // ── Обои ──
  wp('92330794','oboi-flizelinovye-erismann-fashion-for-walls-4-er12185-48-106x1005-m','Обои флизелиновые Erismann Fashion for Walls 4 ER12185-48 1,06×10,05 м коричневые','Erismann','Fashion for Walls 4',1060,10050,undefined,'texture','коричневые, фактура штукатурки',['#8e735b','#76604b']),
  wp('92330801','oboi-flizelinovye-erismann-fashion-for-walls-4-er12182-48-106x1005-m','Обои флизелиновые Erismann Fashion for Walls 4 ER12182-48 1,06×10,05 м коричневые','Erismann','Fashion for Walls 4',1060,10050,undefined,'geometric','коричневые, геометрический принт',['#9a7f66','#6b5644']),
  wp('92330986','oboi-flizelinovye-erismann-versailles-106-m-cvet-persikovyy-er12172-38','Обои флизелиновые Erismann Versailles 1,06 м персиковые ER12172-38','Erismann','Versailles',1060,10050,0,'texture','персиковые, фактура штукатурки',['#e8c4a8','#d2a988']),
  wp('92330854','oboi-flizelinovye-erismann-gentle-106-m-cvet-izumrudnyy-er12207-07','Обои флизелиновые Erismann Gentle 1,06 м изумрудные ER12207-07','Erismann','Gentle',1060,10050,0,'plain','изумрудные однотонные',['#2e6b5a','#255a4b']),
  wp('92330909','oboi-flizelinovye-erismann-martinique-106-m-cvet-siniy-er12191-19','Обои флизелиновые Erismann Martinique 1,06 м синие ER12191-19','Erismann','Martinique',1060,10050,undefined,'floral','синие, растительный принт',['#2f4a6b','#8fa7c2']),
  wp('89344378','oboi-flizelinovye-inspire-decobeton-svetlo-bezhevye-106-m-is72016-12','Обои флизелиновые Inspire Decobeton светло-бежевые 1,06 м IS72016-12','Inspire','Decobeton',1060,10050,undefined,'concrete','светло-бежевый бетон',['#d9cfc2','#bfb3a3']),
  {id:'82061801',kind:'wallpaper',name:'Обои Inspire Stripe виниловые на флизелине светло-серые 1,06 м',brand:'Inspire',collection:'Stripe',article:'82061801',url:L+'oboi-inspire-stripe-82061801/',size:[1060,10050],repeat:0,look:'stripes',colour:'светло-серые в полоску',tone:['#d6d6d3','#bdbdb9']},
  wp('89190807','oboi-flizelinovye-inspire-krakelyur-serye-106-m-bohemia-6','Обои флизелиновые Inspire Кракелюр серые 1,06 м Bohemia 6','Inspire','Bohemia',1060,10050,undefined,'texture','серые, фактура кракелюр',['#a9a8a4','#8a8985']),
  wp('17036296','oboi-flizelinovye-pod-shtukaturku-inspire-106x10-m-cvet-ekryu-er-4290-2','Обои флизелиновые под штукатурку Inspire 1,06×10 м экрю ER 4290-2','Inspire',undefined,1060,10000,undefined,'texture','экрю, фактура штукатурки',['#e9e1cf','#d3c9b4']),
  wp('84534430','oboi-flizelinovye-victoria-stenova-michelle-bezhevye-106-m-889622','Обои флизелиновые Victoria Stenova Michelle бежевые 1,06 м 889622','Victoria Stenova','Michelle',1060,10000,undefined,'plain','бежевые однотонные с рельефом',['#dccbb1','#c9b796']),
  wp('86759616','oboi-flizelinovye-victoria-stenova-weekend-belye-106-m-989261','Обои флизелиновые Victoria Stenova Weekend белые 1,06 м 989261','Victoria Stenova','Weekend',1060,10000,undefined,'plain','белые однотонные',['#f2f1ed','#e2e0da']),
  wp('88062319','oboi-flizelinovye-palitra-simple-rogozhka-bezhevye-106-m-sp72075-21','Обои флизелиновые Palitra Simple Rogozhka бежевые 1,06 м SP72075-21','Palitra','Simple Rogozhka',1060,10000,0,'texture','бежевые, фактура рогожки',['#d4c5ac','#bba98c']),
  wp('82105557','oboi-flizelinovye-polosa-temno-serye-106-m-1025-23','Обои флизелиновые «Полоса» тёмно-серые 1,06 м 1025-23','марка не указана','Полоса',1060,10000,0,'stripes','тёмно-серые в полоску',['#5d5f61','#7a7c7e']),
  wp('16582308','oboi-flizelinovye-cvety-106x10-m-cvet-siniy-as-96087-3','Обои флизелиновые Цветы 1,06×10 м синие АС 96087-3','марка не указана',undefined,1060,10000,undefined,'floral','сине-голубые цветы на светлом фоне',['#e9edf2','#5b78a8']),
  wp('89346599','oboi-flizelinovye-elysium-romby-serye-106-m-e704504','Обои флизелиновые Elysium Ромбы серые 1,06 м Е704504','Elysium','Ромбы',1060,10050,undefined,'geometric','серые, ромбы',['#b9b9b6','#8e8e8a']),
  wp('85683049','oboi-flizelinovye-palitra-home-my-forest-zelenye-106-m-hc71960-67','Обои флизелиновые Palitra Home My Forest зелёные 1,06 м HC71960-67','Palitra Home','My Forest',1060,10000,undefined,'floral','зелёный растительный рисунок',['#6f8c69','#3f5a3c']),
  wp('82283853','oboi-flizelinovye-marburg-montego-serye-106-m-30876','Обои флизелиновые Marburg Montego серые 1,06 м 30876','Marburg','Montego',1060,10050,320,'abstract','серые, структурный рельеф',['#8f8e8a','#6f6e6a']),
  wp('88642731','oboi-flizelinovye-elysium-odi-serye-106-m-e57406','Обои флизелиновые Elysium Оди серые 1,06 м Е57406','Elysium','Оди',1060,10050,undefined,'abstract','серые, абстрактный рисунок',['#a3a29e','#7f7e7a']),
  wp('91672374','oboi-flizelinovye-as-creation-original-view-belye-053-m-38967-1','Обои флизелиновые A.S. Creation Original View белые 0,53 м 38967-1','A.S. Creation','Original View',530,10050,0,'abstract','белые, абстрактный рисунок',['#eeece7','#cfccc4']),
];
const BY_ID=new Map(FINISHES.map(f=>[f.id,f]));
export const finishById=(id:string|undefined)=>id?BY_ID.get(id):undefined;

/** Покраска стен: готовые цвета (любой другой — выбором цвета). */
export const PAINTS:readonly {name:string;color:string}[]=[
  {name:'Белая',color:'#f4f3ef'},{name:'Светло-серая',color:'#d9d8d3'},{name:'Бежевая',color:'#e3d6c1'},{name:'Песочная',color:'#d6c2a0'},
  {name:'Оливковая',color:'#a8ab8a'},{name:'Серо-голубая',color:'#b6c4cc'},{name:'Терракота',color:'#c08a6a'},{name:'Графит',color:'#55585c'},
];

/** Отделка стены: позиция каталога (обои, настенная плитка) или покраска цветом. */
export type WallFinish={id:string}|{paint:string};
/** Направление длинной стороны доски/плитки на полу: вдоль ширины комнаты (ось X) или вдоль глубины (ось Z). */
export type FloorFinish={id:string;along?:'width'|'depth'};
export type RoomFinish={floor?:FloorFinish;walls?:Partial<Record<FinishWall,WallFinish>>};

/** Что можно положить на поверхность: пол — ламинат и плитка для пола; стены — обои и плитка для стен. */
export function finishFits(f:FinishItem,surface:'floor'|'wall'){
  if(surface==='floor')return f.kind==='laminate'||(f.kind==='tile'&&f.surface!=='wall');
  return f.kind==='wallpaper'||(f.kind==='tile'&&f.surface!=='floor');
}
const HEX=/^#[0-9a-f]{6}$/i;
/** Чтение отделки из файла проекта: мусор молча отбрасывается (отделка — только показ, не должна мешать открыть проект). */
export function parseRoomFinish(raw:unknown):RoomFinish|undefined{
  if(!raw||typeof raw!=='object')return undefined;
  const x=raw as {floor?:{id?:unknown;along?:unknown};walls?:Record<string,{id?:unknown;paint?:unknown}>},out:RoomFinish={};
  const okId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=40;
  if(x.floor&&okId(x.floor.id))out.floor={id:x.floor.id,...(x.floor.along==='width'||x.floor.along==='depth'?{along:x.floor.along}:{})};
  if(x.walls&&typeof x.walls==='object'){
    const walls:Partial<Record<FinishWall,WallFinish>>={};
    for(const w of FINISH_WALLS){const v=x.walls[w];if(!v||typeof v!=='object')continue;if(typeof v.paint==='string'&&HEX.test(v.paint))walls[w]={paint:v.paint.toLowerCase()};else if(okId(v.id))walls[w]={id:v.id};}
    if(Object.keys(walls).length)out.walls=walls;
  }
  return out.floor||out.walls?out:undefined;
}
/** Заменить отделку пола/стен; пустая отделка убирается из помещения целиком (файл без лишнего поля). */
export function withFinish<R extends {finish?:RoomFinish}>(room:R,finish:RoomFinish):R{
  const clean:RoomFinish={...(finish.floor?{floor:finish.floor}:{}),...(finish.walls&&Object.keys(finish.walls).length?{walls:finish.walls}:{})};
  const {finish:_,...rest}=room;return (clean.floor||clean.walls?{...rest,finish:clean}:rest) as R;
}
export function setWallFinish<R extends {finish?:RoomFinish}>(room:R,walls:readonly FinishWall[],value:WallFinish|undefined):R{
  const next={...room.finish?.walls};for(const w of walls){if(value)next[w]=value;else delete next[w];}
  return withFinish(room,{...room.finish,walls:next});
}

/** Новое помещение вместо старого (замер из Базиса в пустую комнату): отделка привязана к стенам по названию (задняя, левая…)
 *  и к полу, а не к размерам — переносится, если в новом помещении своей нет (критик 29.10 п.4). */
export function keepFinish<R extends {finish?:RoomFinish}>(previous:{finish?:RoomFinish},next:R):R{return next.finish||!previous.finish?next:{...next,finish:previous.finish};}
/** Подпись размера: доска 1292×193 мм · 33 кл.; плитка 60×120 см; рулон 1,06×10,05 м. */
export function finishSize(f:FinishItem){
  const cm=(v:number)=>String(Math.round(v)/10).replace('.',',');
  if(f.kind==='wallpaper')return `рулон ${String(f.size[0]/1000).replace('.',',')}×${String(f.size[1]/1000).replace('.',',')} м`+(f.repeat?` · раппорт ${cm(f.repeat)} см`:f.repeat===0?' · без подбора рисунка':'');
  if(f.kind==='tile')return `${cm(f.size[1])}×${cm(f.size[0])} см`+(f.thickness?` · ${String(f.thickness).replace('.',',')} мм`:'');
  return `${f.look==='herringbone'?'ёлочка, ':''}доска ${f.size[0]}×${f.size[1]} мм`+(f.grade?` · ${f.grade} кл.`:'')+(f.thickness?` · ${f.thickness} мм`:'');
}

// ── Раскладка (чистая геометрия, мм) — по ней рисуется текстура и проверяется масштаб ──
export type Rect={x:number;y:number;w:number;h:number;/** доска/плитка повёрнута на 90° (ёлочка: «вертикальная» планка) */rot?:boolean;/** номер варианта рисунка */n:number};
/** Раппорт текстуры: прямоугольник w×h мм (ось w — вдоль длинной стороны доски/плитки или поперёк рулона), повторяется встык.
 *  rotate45 — ёлочка: раппорт рисуется в осях планок и поворачивается на 45° к стенам. joint — шов/фаска, мм. */
const mod=(v:number,p:number)=>((v%p)+p)%p;
/** Номер рисунка детали по её месту в раппорте: доска, выходящая за край, и её повтор с другой стороны рисуются одинаково (без шва). */
function seedAt(x:number,y:number,w:number,h:number,rot?:boolean){return mod(Math.round(x),Math.round(w))*7919+mod(Math.round(y),Math.round(h))*104729+(rot?1:0);}
export type FinishUnit={w:number;h:number;rects:Rect[];rotate45?:boolean;joint:number;/** ёлочка: ширина планки после подгонки кратности, мм */plankWidth?:number};
export function finishUnit(f:FinishItem):FinishUnit{
  const [a,b]=f.size;
  if(f.kind==='wallpaper'){
    const h=f.repeat&&f.repeat>0?f.repeat:Math.max(530,a/2);
    return {w:a,h,rects:[{x:0,y:0,w:a,h,n:0}],joint:0.6};
  }
  if(f.look==='herringbone'){
    // Ёлочка из планок L×W: решётка (W,W) и (L,−L); кратность L/W до половины → раппорт 2qL × 2qL (q = 1 или 2).
    const ratio=Math.max(2,Math.round(a/b*2)/2),q=Number.isInteger(ratio)?1:2,W=a/ratio,P=2*q*a,rects:Rect[]=[];
    const ni=Math.ceil(2*(P+a)/W)+2,nj=Math.ceil(2*(P+a)/a)+2;
    for(let i=-ni;i<=ni;i++)for(let j=-nj;j<=nj;j++){
      const x=i*W+j*a,y=i*W-j*a;
      for(const r of [{x,y,w:a,h:W},{x,y:y+W,w:W,h:a,rot:true}] as Omit<Rect,'n'>[])
        if(r.x<P&&r.x+r.w>0&&r.y<P&&r.y+r.h>0)rects.push({...r,n:seedAt(r.x,r.y,P,P,r.rot)});
    }
    return {w:P,h:P,rects,rotate45:true,joint:f.chamfer?1.5:0.6,plankWidth:W};
  }
  if(f.kind==='laminate'){
    // Палуба: 6 рядов, в раппорте 2 длины доски, ряды со смещением торцов (разбежка ≥ 1/4 доски).
    const rows=6,shift=[0,0.5,0.25,0.75,0.4,0.9],rects:Rect[]=[];
    for(let r=0;r<rows;r++)for(let k=-1;k<=2;k++){const x=(shift[r]+k)*a;if(x<2*a&&x+a>0)rects.push({x,y:r*b,w:a,h:b,n:seedAt(x,r*b,2*a,rows*b)});}
    return {w:2*a,h:rows*b,rects,joint:f.chamfer?1.5:0.6};
  }
  // Плитка: 2×2 крупного формата, 3×3 мелкой (разные рисунки камня/мрамора), шов 2 мм.
  const k=Math.max(a,b)<=400?3:2,rects:Rect[]=[];
  for(let i=0;i<k;i++)for(let j=0;j<k;j++)rects.push({x:i*a,y:j*b,w:a,h:b,n:i*k+j});
  return {w:k*a,h:k*b,rects,joint:2};
}
/** Разрешение рисунка раппорта, px на мм: не больше 1 и так, чтобы большая сторона ≤ maxPx. */
export function texturePxPerMm(unit:{w:number;h:number},maxPx:number){return Math.min(1,maxPx/Math.max(unit.w,unit.h));}
/** Текстурные координаты точки пола (x — от левой стены, z — от задней, мм) для раппорта unit. */
export function floorUv(x:number,z:number,unit:FinishUnit,along:'width'|'depth'='width'):[number,number]{
  let s=along==='width'?x:z,t=along==='width'?z:x;
  if(unit.rotate45){const r=Math.SQRT1_2;[s,t]=[(s+t)*r,(t-s)*r];}
  return [s/unit.w,t/unit.h];
}
/** Текстурные координаты точки стены: u — вдоль стены от её начала, y — от пола, мм. */
export function wallUv(u:number,y:number,unit:FinishUnit):[number,number]{return [u/unit.w,y/unit.h];}
/** Направление укладки по умолчанию — вдоль длинной стороны комнаты. */
export function defaultAlong(room:{width:number;depth:number}):'width'|'depth'{return room.depth>room.width?'depth':'width';}
