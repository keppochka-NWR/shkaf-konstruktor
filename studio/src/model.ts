import { drawerHasHandle, SLIDES, type DrawerConfig } from "./hardware";
export const RULES = {
  panel: 16,
  back: 3,
  plinth: 80,
  plinthInset: 50,
  shelfDepthMinus: 25,
  shelfGap: 1,
  minW: 250,
  maxW: 900,
  minH: 400,
  maxH: 2200,
  minD: 250,
  maxD: 700,
  minSection: 180,
  maxSections: 4,
  maxShelves: 10,
  maxDrawers: 5,
  drawerH: 140,
  drawerStep: 40,
  drawerSideGap: 13,
  drawerFrontGap: 3,
  rodDiameter: 25,
  rodTopOffset: 70,
  rodMinClear: 900,
  shelfMinClear: 80,
  sheetW: 2750,
  sheetH: 1830,
  hdfW: 2800,
  hdfH: 2070,
  // Conservative preview envelope from G code/RULES.md; production release requires confirmation.
  sheetMargin: 10,
  faceGap: 2,
  doorMax: 600,
  drawerFiller: 16,
} as const;
export type Section = {
  id: string;
  weight: number;
  shelves: number[];
  drawers: number;
  rod: boolean;
  drawerConfigs?: DrawerConfig[];
  pantograph?: boolean;
  rodAt?: number;
};
export type Module = {
  version: 1;
  name: string;
  width: number;
  height: number;
  depth: number;
  decor: string;
  facadeDecor: string;
  drawerFacadeDecor?: string;
  doors: boolean;
  sections: Section[];
  backType?: "nailed" | "groove" | "board" | "none";
  grooveInset?: number;
  grooveDepth?: number;
  hingeSide?: "left" | "right";
  plinthHeight?: number;
};
export type Part = {
  id: string;
  name: string;
  sectionId?: string;
  size: [number, number, number];
  position: [number, number, number];
  length: number;
  width: number;
  thickness: number;
  material: "board" | "hdf" | "metal";
  decor: string;
  role: "body" | "shelf" | "drawer" | "door" | "rod" | "flange" | "pantograph" | "handle" | "hinge";
  hinge?: "left" | "right";
  grain: "length";
  edge: [number, number, number, number];
};
export type SectionBox = {
  id: string;
  x: number;
  width: number;
  bottom: number;
  top: number;
};
export const id = () => crypto.randomUUID();
export const section = (): Section => ({
  id: id(),
  weight: 1,
  shelves: [],
  drawers: 0,
  rod: false,
});
export function drawerConfig(m: Module, s: Section, j: number): DrawerConfig {
  return (
    s.drawerConfigs?.[j] || {
      slide: "ball",
      height: RULES.drawerH,
      length:
        [...SLIDES.ball.lengths].reverse().find((l) => l <= m.depth - rearClear(m) - (m.doors ? 44 : 25)) ||
        250,
    }
  );
}
export function plinth(m:Module){return m.plinthHeight ?? RULES.plinth;}
export function rearClear(m:Module){return m.backType==='board'?RULES.panel+1:m.backType==='groove'?(m.grooveInset??16)+RULES.back+1:0;}
export function drawerOffsets(s:Section){let y=0;return Array.from({length:Math.max(0,Math.min(5,s.drawers))},(_,j)=>{const start=s.drawerConfigs?.[j]?.y??y;y=start+(s.drawerConfigs?.[j]?.height??RULES.drawerH)+RULES.drawerStep;return start;});}
export function doorCount(m:Module,s:Section){const b=boxes(m).find(b=>b.id===s.id)!;return b.width+RULES.panel>RULES.doorMax?2:1;}
export function fillerSides(m:Module,s:Section){if(!m.doors||!s.drawers)return {left:0,right:0};const both=doorCount(m,s)===2;return {left:both||m.hingeSide!=='right'?RULES.drawerFiller:0,right:both||m.hingeSide==='right'?RULES.drawerFiller:0};}
export function drawerStackHeight(s: Section) {
  const yy=drawerOffsets(s);return Math.max(0,...yy.map((y,j)=>y+(s.drawerConfigs?.[j]?.height??RULES.drawerH)+RULES.drawerStep));
}
export function initialModule(): Module {
  return {
    version: 1,
    name: "Шкаф в прихожую",
    width: 600,
    height: 2000,
    depth: 600,
    decor: "Дуб Вотан",
    facadeDecor: "Белый",
    doors: true,
    sections: [
      { ...section(), shelves: [0.72], drawers: 2, rod: false },
    ],
  };
}
export function boxes(m: Module): SectionBox[] {
  const t = RULES.panel;
  const available = m.width - t * (m.sections.length + 1);
  const total = m.sections.reduce((s, x) => s + x.weight, 0);
  let x = t;
  return m.sections.map((s, i) => {
    const width =
      i === m.sections.length - 1
        ? m.width - t - x
        : Math.round(((available * s.weight) / total) * 10) / 10;
    const b = {
      id: s.id,
      x,
      width,
      bottom: plinth(m) + t,
      top: m.height - t,
    };
    x += width + t;
    return b;
  });
}
export function parts(m: Module): Part[] {
  const out: Part[] = [];
  const t = RULES.panel;
  const d = m.depth;
  const bottom = plinth(m);
  const rear=rearClear(m);
  function add(
    key: string,
    name: string,
    size: Part["size"],
    pos: Part["position"],
    length: number,
    width: number,
    thickness: number,
    role: Part["role"] = "body",
    sid?: string,
    material: Part["material"] = "board",
  ) {
    out.push({
      id: key,
      name,
      sectionId: sid,
      size,
      position: pos,
      length,
      width,
      thickness,
      role,
      material,
      decor: role === "door" ? m.facadeDecor : m.decor,
      grain: "length",
      edge: material === "board" ? role === "door" ? [2,2,2,2] : [0.4, 0.4, 2, 0.4] : [0, 0, 0, 0],
    });
  }
  add(
    "left",
    "Боковина левая",
    [t, m.height, d],
    [t / 2, m.height / 2, d / 2],
    m.height,
    d,
    t,
  );
  add(
    "right",
    "Боковина правая",
    [t, m.height, d],
    [m.width - t / 2, m.height / 2, d / 2],
    m.height,
    d,
    t,
  );
  add(
    "bottom",
    "Дно",
    [m.width - 2 * t, t, d],
    [m.width / 2, bottom + t / 2, d / 2],
    m.width - 2 * t,
    d,
    t,
  );
  add(
    "top",
    "Крыша",
    [m.width - 2 * t, t, d],
    [m.width / 2, m.height - t / 2, d / 2],
    m.width - 2 * t,
    d,
    t,
  );
  if(bottom>0)add(
    "plinth",
    "Цоколь",
    [m.width - 2 * t, bottom, t],
    [m.width / 2, bottom / 2, d - RULES.plinthInset - t / 2],
    m.width - 2 * t,
    bottom,
    t,
  );
  const groove=m.backType==='groove',gd=m.grooveDepth??8;
  const backW=groove?m.width-2*t+2*gd-1:m.width-4;
  const backH=groove?m.height-bottom-2*t+2*gd-1:m.height-4;
  if(m.backType==='board'){add('back','Задняя стенка · ЛДСП вкладная',[m.width-2*t,m.height-bottom-2*t,t],[m.width/2,(bottom+m.height)/2,t/2],m.height-bottom-2*t,m.width-2*t,t,'body');out.at(-1)!.edge=[0.4,0.4,0.4,0.4];}
  else if(m.backType!=='none')add('back',groove?'Задняя стенка · в паз':'Задняя стенка · набивная',[backW,backH,RULES.back],[m.width/2,groove?(bottom+m.height)/2:m.height/2,groove?(m.grooveInset??16)+RULES.back/2:-RULES.back/2],backH,backW,RULES.back,'body',undefined,'hdf');
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      sd = d - rear - RULES.shelfDepthMinus;
    if (i > 0)
      add(
        `${s.id}:divider`,
        "Перегородка",
        [t, h, sd],
        [b.x - t / 2, b.bottom + h / 2, rear + sd / 2],
        h,
        sd,
        t,
        "body",
        s.id,
      );
    s.shelves.forEach((f, j) =>
      add(
        `${s.id}:shelf:${j}`,
        "Полка съёмная",
        [b.width - 2 * RULES.shelfGap, t, sd],
        [b.x + b.width / 2, b.bottom + f * h, rear + sd / 2],
        b.width - 2 * RULES.shelfGap,
        sd,
        t,
        "shelf",
        s.id,
      ),
    );
    const f=fillerSides(m,s),filler=f.left+f.right;
    for(const side of ['left','right'] as const)if(f[side]) add(s.id+':filler:'+side,'Фальш-панель '+(side==='left'?'левая':'правая'),[t,drawerStackHeight(s),sd],[side==='left'?b.x+t/2:b.x+b.width-t/2,b.bottom+drawerStackHeight(s)/2,rear+sd/2],drawerStackHeight(s),sd,t,'body',s.id);
    if(s.drawers>0)add(s.id+':drawer-cap','Обязательная полка над ящиками',[b.width,t,sd],[b.x+b.width/2,b.bottom+drawerStackHeight(s)+t/2,rear+sd/2],b.width,sd,t,'shelf',s.id);
    let nextY = b.bottom + RULES.drawerStep / 2;
    for (let j = 0; j < s.drawers; j++) {
      const cfg = drawerConfig(m, s, j),
        hidden = cfg.slide === "gtv0fpo";
      const sideGap = hidden ? 5 : RULES.drawerSideGap,
        boxW = b.width - filler - 2 * sideGap;
      const boxD = cfg.length - (hidden ? 10 : 0),
        bh = cfg.height;
      const bx = b.x + f.left + sideGap,
        y = b.bottom + RULES.drawerStep/2 + drawerOffsets(s)[j],
        z = d - (m.doors ? 44 : 20) - boxD;
      nextY += bh + RULES.drawerStep;
      for (const side of ["left", "right"])
        add(
          s.id + ":drawer:" + j + ":" + side,
          "Ящик " + (j + 1) + " · боковина",
          [t, bh, boxD],
          [
            side === "left" ? bx + t / 2 : bx + boxW - t / 2,
            y + bh / 2,
            z + boxD / 2,
          ],
          boxD,
          bh,
          t,
          "drawer",
          s.id,
        );
      const endH = hidden ? bh - 28 : bh,
        endY = hidden ? y + 28 : y;
      for (const end of ["front", "back"])
        add(
          s.id + ":drawer:" + j + ":" + end,
          "Ящик " +
            (j + 1) +
            " · " +
            (end === "front" ? "передняя стенка" : "задняя стенка"),
          [boxW - 2 * t, endH, t],
          [
            bx + boxW / 2,
            endY + endH / 2,
            end === "front" ? z + boxD - t / 2 : z + t / 2,
          ],
          boxW - 2 * t,
          endH,
          t,
          "drawer",
          s.id,
        );
      const bw = hidden ? boxW - 2 * t : boxW,
        bd = boxD,
        bt = t;
      add(
        s.id + ":drawer:" + j + ":bottom",
        "Ящик " + (j + 1) + " · дно",
        [bw, bt, bd],
        [bx + boxW / 2, hidden ? y + 12 + t / 2 : y - bt / 2, z + boxD / 2],
        bw,
        bd,
        bt,
        "drawer",
        s.id,
        "board",
      );
      const fh=bh+RULES.drawerStep-RULES.drawerFrontGap,fw=b.width-filler-2*RULES.drawerFrontGap;
      add(s.id+':drawer:'+j+':facade','Ящик '+(j+1)+' · фасад',[fw,fh,t],[b.x+f.left+(b.width-filler)/2,y-RULES.drawerStep/2+(bh+RULES.drawerStep)/2,m.doors?d-36:d+t/2+2],fh,fw,t,'drawer',s.id);
      out.at(-1)!.decor=m.drawerFacadeDecor??m.facadeDecor;out.at(-1)!.edge=[2,2,2,2];
      if(drawerHasHandle(cfg))add(s.id+':drawer:'+j+':handle','Ручка ящика',[128,10,18],[b.x+f.left+(b.width-filler)/2,y+bh/2,m.doors?d-20:d+28],128,10,18,'handle',s.id,'metal');
      for (const side of [0, 1])
        add(
          s.id + ":drawer:" + j + ":slide:" + side,
          "Направляющая " + cfg.slide,
          [hidden ? 20 : 12, hidden ? 12 : 45, cfg.length],
          [
            hidden ? bx + (side ? boxW - 10 : 10) : bx + (side ? boxW + 6 : -6),
            hidden ? y + 6 : y + bh / 2,
            z + boxD - cfg.length / 2,
          ],
          cfg.length,
          20,
          12,
          "drawer",
          s.id,
          "metal",
        );
    }
    if (s.rod) {
      const topShelf = s.shelves.length
        ? Math.min(...s.shelves.map((f) => b.bottom + f * h))
        : b.top;
      const ry = s.rodAt===undefined?topShelf-RULES.rodTopOffset:b.bottom+s.rodAt*h;
      add(
        `${s.id}:rod`,
        "Штанга",
        [b.width, RULES.rodDiameter, RULES.rodDiameter],
        [b.x + b.width / 2, ry, d / 2],
        b.width,
        RULES.rodDiameter,
        RULES.rodDiameter,
        "rod",
        s.id,
        "metal",
      );
    }
    if(s.rod){const rp=out.find(p=>p.id===s.id+':rod')!;for(const side of [0,1])add(s.id+':flange:'+side,'Фланец штанги D25',[5,48,48],[side?b.x+b.width-2.5:b.x+2.5,rp.position[1],rp.position[2]],48,48,5,'flange',s.id,'metal');}
    if(s.pantograph){
      const ry=b.bottom+(s.rodAt??0.87)*h,cy=ry-360;
      for(const side of [0,1]){
        const xx=side?b.x+b.width-24:b.x+24;
        add(s.id+':pantograph:mount:'+side,'Пантограф · механизм',[48,160,95],[xx,cy, d/2],160,95,48,'pantograph',s.id,'metal');
        add(s.id+':pantograph:arm:'+side,'Пантограф · рычаг',[18,400,22],[xx,cy+200,d/2],400,22,18,'pantograph',s.id,'metal');
      }
      add(s.id+':pantograph:rod','Пантограф · штанга',[b.width-48,25,25],[b.x+b.width/2,ry,d/2],b.width-48,25,25,'rod',s.id,'metal');
      add(s.id+':pantograph:pull','Пантограф · ручка',[18,550,18],[b.x+b.width/2,ry-275,d/2+40],550,18,18,'pantograph',s.id,'metal');
    }
    if (m.doors) {
      const left = i === 0 ? RULES.faceGap : b.x - t / 2 + RULES.faceGap / 2;
      const right =
        i === m.sections.length - 1
          ? m.width - RULES.faceGap
          : b.x + b.width + t / 2 - RULES.faceGap / 2;
      const count=doorCount(m,s),dw=(right-left-(count-1)*RULES.faceGap)/count;
      for(let k=0;k<count;k++){
        const hinge=count===2?(k===0?'left':'right'):(m.hingeSide??'left'),cx=left+k*(dw+RULES.faceGap)+dw/2;
        add(s.id+':door:'+k,'Фасад распашной',[dw,m.height-bottom-4,t],[cx,(m.height+bottom)/2,d+t/2+2],m.height-bottom-4,dw,t,'door',s.id);out.at(-1)!.hinge=hinge;
        add(s.id+':handle:'+k,'Ручка фасада',[10,128,25],[cx+(hinge==='left'?1:-1)*(dw/2-40),m.height/2,d+31],128,25,10,'handle',s.id,'metal');
      }

    }
  });
  return out;
}
export function validate(m: Module): string[] {
  const errors: string[] = [];
  for (const [key, label, min, max] of [
    ["width", "Ширина", RULES.minW, RULES.maxW],
    ["height", "Высота", RULES.minH, RULES.maxH],
    ["depth", "Глубина", RULES.minD, RULES.maxD],
  ] as const) {
    const n = m[key];
    if (!Number.isFinite(n) || n < min || n > max)
      errors.push(`${label}: допустимо от ${min} до ${max} мм.`);
  }
  if (m.backType!==undefined && !["nailed","groove","board","none"].includes(m.backType)) errors.push("Выберите допустимый тип задней стенки.");
  if(m.hingeSide!==undefined&&!['left','right'].includes(m.hingeSide))errors.push('Выберите сторону петель.');
  if(m.plinthHeight!==undefined && ![0,80,100,120,150].includes(m.plinthHeight))errors.push("Выберите высоту цоколя из списка.");
  if(m.backType==="groove" && (![m.grooveInset??16,m.grooveDepth??8].every(Number.isFinite)||(m.grooveInset??16)<8||(m.grooveInset??16)>30||(m.grooveDepth??8)<4||(m.grooveDepth??8)>10))errors.push("Паз: отступ 8–30 мм, глубина 4–10 мм.");
  if (errors.length) return errors;
  if (m.sections.length < 1 || m.sections.length > RULES.maxSections)
    return [...errors, "Допустимо от 1 до 4 секций."];
  if (m.sections.some((s) => !Number.isFinite(s.weight) || s.weight <= 0))
    return [...errors, "Ширина секции должна быть положительной."];
  if (new Set(m.sections.map((s) => s.id)).size !== m.sections.length)
    errors.push("Идентификаторы секций повторяются.");
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      prefix = `Секция ${i + 1}: `;
    if (b.width < RULES.minSection)
      errors.push(
        prefix +
          `нужно не менее ${RULES.minSection} мм внутри. Уберите перегородку или увеличьте ширину.`,
      );
    if (
      s.shelves.length > RULES.maxShelves ||
      !Number.isInteger(s.drawers) ||
      s.drawers < 0 ||
      s.drawers > RULES.maxDrawers
    )
      errors.push(prefix + "слишком много элементов.");
    if (
      s.drawerConfigs &&
      (!Array.isArray(s.drawerConfigs) || s.drawerConfigs.length > 5)
    )
      errors.push(prefix + "некорректные параметры ящиков.");
    for (let j = 0; j < s.drawers && j < 5; j++) {
      const c = drawerConfig(m, s, j),
        hw = SLIDES[c.slide];
      if (
        !hw ||
        (c.handle!==undefined&&typeof c.handle!=='boolean') ||
        (c.handle===false&&c.slide==='ball') ||
        !Number.isFinite(c.height) ||
        c.height < 68 ||
        c.height > 300 ||
        !hw.lengths.some((l) => l === c.length)
      ) {
        errors.push(prefix + "неверный размер или тип направляющих.");
        continue;
      }
      if (c.length > m.depth - rearClear(m) - (m.doors ? 44 : 25))
        errors.push(prefix + "направляющая слишком длинная для этой глубины.");

    }
    const offsets=drawerOffsets(s);
    for(let j=0;j<offsets.length;j++){
      if(!Number.isFinite(offsets[j])||offsets[j]<0)errors.push(prefix+'неверное положение ящика.');
      for(let k=0;k<j;k++)if(offsets[j]<offsets[k]+drawerConfig(m,s,k).height+RULES.drawerStep&&offsets[k]<offsets[j]+drawerConfig(m,s,j).height+RULES.drawerStep)errors.push(prefix+'ящики пересекаются.');
    }
    if(s.pantograph && (b.width<545||b.width>910||h<1100))errors.push(prefix+'пантографу нужен проём шириной 545–910 мм и высотой от 1100 мм.');
    if(s.rod&&s.pantograph)errors.push(prefix+'выберите штангу или пантограф.');
    if(s.rodAt!==undefined&&(!Number.isFinite(s.rodAt)||s.rodAt<0.1||s.rodAt>0.97))errors.push(prefix+'измените высоту штанги.');
    if(s.pantograph!==undefined&&typeof s.pantograph!=='boolean')errors.push(prefix+'неверный тип пантографа.');
    const shelfY = s.shelves.map((f) => f * h).sort((a, b) => a - b);
    const drawerTop = drawerStackHeight(s);
    if (s.drawers && drawerTop + RULES.panel > h - RULES.shelfMinClear)
      errors.push(
        prefix +
          "ящики не помещаются по высоте. Уберите один ящик или увеличьте высоту.",
      );
    shelfY.forEach((y, j) => {
      if (
        !Number.isFinite(y) ||
        y < RULES.shelfMinClear + RULES.panel / 2 - .001 ||
        y > h - RULES.shelfMinClear - RULES.panel / 2 + .001 ||
        y < drawerTop + (s.drawers ? RULES.panel : 0) + RULES.shelfMinClear + RULES.panel / 2 - .001 ||
        (j > 0 && y - shelfY[j - 1] < RULES.shelfMinClear + RULES.panel - .001)
      )
        errors.push(
          prefix +
            "между поверхностями полок, дна и крыши нужно не менее 80 мм. Измените положение полок.",
        );
    });
    if (
      s.drawers > 0 &&
      (b.width - (m.doors ? RULES.drawerFiller : 0) < 250 || dTooSmall(m))
    )
      errors.push(
        prefix +
          "для ящиков нужно от 250 мм внутри и глубина корпуса от 300 мм.",
      );
    const rodY=s.rodAt===undefined?(shelfY[0]??h)-RULES.rodTopOffset:s.rodAt*h;
    const support=Math.max(drawerTop+(s.drawers?RULES.panel:0),0,...shelfY.filter(y=>y<rodY).map(y=>y+RULES.panel/2));
    if(s.rod&&shelfY.some(y=>Math.abs(y-rodY)<(RULES.panel+RULES.rodDiameter)/2))errors.push(prefix+'штанга пересекает полку. Измените высоту.');
    if (
      s.rod && rodY - support < RULES.rodMinClear
    )
      errors.push(
        prefix +
          "под штангой нужно 900 мм до полки, ящиков или дна. Измените высоту штанги или наполнение.",
      );
  });
  if (errors.length) return [...new Set(errors)];
  const geometry=parts(m);
  for(const section of m.sections.filter(s=>s.pantograph)){
    const b=boxes(m).find(b=>b.id===section.id)!;
    const mechanism=geometry.filter(p=>p.id.startsWith(section.id+':pantograph:'));
    if(mechanism.some(p=>p.position[1]-p.size[1]/2<b.bottom||p.position[1]+p.size[1]/2>b.top))errors.push('Пантограф выходит за внутреннюю высоту корпуса. Измените его положение.');
    const filling=geometry.filter(p=>p.sectionId===section.id&&(p.role==='shelf'||p.role==='drawer')&&p.material==='board');
    if(mechanism.some(a=>filling.some(b=>a.size.every((size,k)=>Math.abs(a.position[k]-b.position[k])<(size+b.size[k])/2-.1))))errors.push('Пантограф пересекает полку или ящик. Освободите место для механизма.');
  }
  for (const p of geometry) {
    if (p.material === "metal") continue;
    const sw = p.material === "hdf" ? RULES.hdfW : RULES.sheetW,
      sh = p.material === "hdf" ? RULES.hdfH : RULES.sheetH;
    if (
      !p.size.every((n) => Number.isFinite(n) && n > 0) ||
      p.length > sw - 2 * RULES.sheetMargin ||
      p.width > sh - 2 * RULES.sheetMargin
    )
      errors.push(
        `«${p.name}» не помещается в полезное поле листа или имеет неверный размер.`,
      );
    if (p.role === "door" && p.width > RULES.doorMax)
      errors.push(
        "Фасад шире 600 мм. Разделите модуль на секции или уберите фасады.",
      );
  }
  return [...new Set(errors)];
}
function dTooSmall(m: Module) {
  return m.depth < 300;
}
export function distribute(m: Module, s: Section, count: number): number[] {
  const h=m.height-plinth(m)-2*RULES.panel;
  let base=s.drawers?drawerStackHeight(s)+RULES.panel:0;
  if(s.rod)base=Math.max(base+RULES.rodMinClear+RULES.rodTopOffset,s.rodAt===undefined?0:s.rodAt*h+RULES.rodTopOffset-RULES.panel/2);
  const clear=(h-base-count*RULES.panel)/(count+1);
  return Array.from({length:count},(_,i)=>(base+clear*(i+1)+RULES.panel*i+RULES.panel/2)/h);
}
export function splitSection(m: Module, sid: string): Module {
  const next = structuredClone(m),
    i = next.sections.findIndex((s) => s.id === sid),
    s = next.sections[i];
  if (!s) return next;
  next.sections.splice(
    i,
    1,
    { ...s, weight: s.weight / 2 },
    { ...section(), weight: s.weight / 2 },
  );
  return next;
}
/** Clear openings, measured between actual panel faces, bottom to top. */
export function shelfGaps(m: Module, sid: string) {
  const b = boxes(m).find((b) => b.id === sid)!;
  const s = m.sections.find((s) => s.id === sid)!;
  const centers = s.shelves
    .map((f) => b.bottom + f * (b.top - b.bottom))
    .sort((a, b) => a - b);
  return [...centers, b.top + RULES.panel / 2].map((y, i) => {
    const bottom = i === 0 ? b.bottom + (s.drawers ? drawerStackHeight(s)+RULES.panel : 0) : centers[i - 1] + RULES.panel / 2;
    const top = y - RULES.panel / 2;
    return { bottom, top, height: Math.round((top - bottom) * 10) / 10 };
  });
}
export function setShelfGap(
  m: Module,
  sid: string,
  index: number,
  value: number,
) {
  const b = boxes(m).find((b) => b.id === sid)!,
    s = m.sections.find((s) => s.id === sid)!;
  s.shelves.sort((a, b) => a - b);
  const gaps = shelfGaps(m, sid);
  if (!s.shelves.length || !gaps[index]) return;
  const j = Math.min(index, s.shelves.length - 1);
  const center =
    index === s.shelves.length
      ? b.top - value - RULES.panel / 2
      : gaps[index].bottom + value + RULES.panel / 2;
  s.shelves[j] = (center - b.bottom) / (b.top - b.bottom);
}
export function parseModule(input: unknown): Module {
  if (!input || typeof input !== "object")
    throw new Error("Файл не содержит модуль.");
  const x = input as Record<string, unknown>;
  if (
    x.version !== 1 ||
    typeof x.name !== "string" ||
    x.name.length > 80 ||
    typeof x.decor !== "string" ||
    typeof x.facadeDecor !== "string" ||
    (x.drawerFacadeDecor!==undefined&&(typeof x.drawerFacadeDecor!=="string"||x.drawerFacadeDecor.length>150)) ||
    typeof x.doors !== "boolean" ||
    !Array.isArray(x.sections) ||
    x.sections.length > 4
  )
    throw new Error("Нужен файл модуля из 3D-редактора (.json).");
  for (const s of x.sections) {
    if (
      !s ||
      typeof s.id !== "string" ||
      typeof s.weight !== "number" ||
      !Array.isArray(s.shelves) ||
      s.shelves.length > 10 ||
      !s.shelves.every((v: unknown) => typeof v === "number") ||
      typeof s.drawers !== "number" ||
      typeof s.rod !== "boolean" ||
      (s.drawerConfigs !== undefined &&
        (!Array.isArray(s.drawerConfigs) || s.drawerConfigs.length > 5))
    )
      throw new Error("Некорректные данные секции.");
  }
  const m: Module = {
    version: 1,
    name: x.name,
    width: x.width as number,
    height: x.height as number,
    depth: x.depth as number,
    decor: x.decor,
    facadeDecor: x.facadeDecor,
    ...(x.drawerFacadeDecor===undefined?{}:{drawerFacadeDecor:x.drawerFacadeDecor}),
    doors: x.doors,
    ...(x.backType===undefined?{}:{backType:x.backType as Module["backType"]}),
    ...(x.grooveInset===undefined?{}:{grooveInset:x.grooveInset as number}),
    ...(x.grooveDepth===undefined?{}:{grooveDepth:x.grooveDepth as number}),
    ...(x.plinthHeight===undefined?{}:{plinthHeight:x.plinthHeight as number}),
    ...(x.hingeSide===undefined?{}:{hingeSide:x.hingeSide as Module["hingeSide"]}),
    sections: x.sections.map((s) => ({
      id: s.id,
      weight: s.weight,
      shelves: [...s.shelves],
      drawers: s.drawers,
      rod: s.rod,
      ...(s.pantograph===undefined?{}:{pantograph:s.pantograph}),
      ...(s.rodAt===undefined?{}:{rodAt:s.rodAt}),
      ...(s.drawerConfigs === undefined
        ? {}
        : {
            drawerConfigs: s.drawerConfigs.map((c: DrawerConfig) => ({
              slide: c?.slide,
              height: c?.height,
              length: c?.length,
              ...(c?.handle===undefined?{}:{handle:c.handle}),
                  ...(c?.y===undefined?{}:{y:c.y}),
            })),
          }),
    })),
  };
  const errors = validate(m);
  if (errors.length) throw new Error(errors[0]);
  return m;
}

