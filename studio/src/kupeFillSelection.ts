// Glass and mirror thicker than 4 mm stay readable in saved projects, but cannot be newly selected.
export const selectableKupeFill = (f: {n:string}) => !(/(?:стекло|зеркало)/i.test(f.n) && Number(f.n.match(/(\d+(?:[.,]\d+)?)\s*мм/i)?.[1]?.replace(',', '.')) > 4);
