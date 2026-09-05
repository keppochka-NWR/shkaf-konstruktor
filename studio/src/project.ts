import { id, initialModule, parseModule, validate, type Module } from "./model";
export type Room = { width: number; depth: number; height: number };
export type PlacedModule = { id: string; x: number; z: number; module: Module };
export type Project = {
  version: 2;
  room: Room;
  modules: PlacedModule[];
  offer?: { customer: string; price: string; notes: string };
};
export function newProject(module = initialModule()): Project {
  return {
    version: 2,
    room: { width: 4000, depth: 3000, height: 2700 },
    modules: [{ id: id(), x: 50, z: 30, module }],
  };
}
export function projectErrors(p: Project): string[] {
  const errors: string[] = [];
  if (
    p.offer &&
    (typeof p.offer.customer !== "string" ||
      p.offer.customer.length > 120 ||
      typeof p.offer.notes !== "string" ||
      p.offer.notes.length > 2000 ||
      typeof p.offer.price !== "string" ||
      (p.offer.price !== "" &&
        (!Number.isFinite(Number(p.offer.price)) ||
          Number(p.offer.price) < 0 ||
          Number(p.offer.price) > 1e12)))
  )
    return ["Проверьте поля коммерческого предложения."];
  if (!p.modules.length || p.modules.length > 20)
    return ["В проекте должно быть от 1 до 20 модулей."];
  if (new Set(p.modules.map((m) => m.id)).size !== p.modules.length)
    return ["Идентификаторы модулей повторяются."];
  for (const v of Object.values(p.room))
    if (!Number.isFinite(v) || v < 500 || v > 20000)
      return ["Размеры помещения: от 500 до 20 000 мм."];
  p.modules.forEach((a, i) => {
    errors.push(...validate(a.module).map((e) => `${a.module.name}: ${e}`));
    if (
      !Number.isFinite(a.x) ||
      !Number.isFinite(a.z) ||
      a.x < 0 ||
      a.z < 3 ||
      a.x + a.module.width > p.room.width ||
      a.z + a.module.depth + (a.module.doors ? 18 : 0) > p.room.depth ||
      a.module.height > p.room.height
    )
      errors.push(
        `${a.module.name}: корпус выходит за границы помещения. Измените замер или положение.`,
      );
    for (const b of p.modules.slice(0, i))
      if (
        a.x < b.x + b.module.width &&
        a.x + a.module.width > b.x &&
        a.z - 3 < b.z + b.module.depth + (b.module.doors ? 18 : 0) &&
        a.z + a.module.depth + (a.module.doors ? 18 : 0) > b.z - 3
      )
        errors.push(
          `«${a.module.name}» пересекается с «${b.module.name}». Измените положение.`,
        );
  });
  return errors;
}
export function parseProject(data: unknown): Project {
  const x = data as Project;
  if (x?.version !== 2) return newProject(parseModule(data));
  if (!x.room || !Array.isArray(x.modules) || x.modules.length > 20)
    throw new Error("Некорректный файл проекта.");
  const p: Project = {
    version: 2,
    room: { width: x.room.width, height: x.room.height, depth: x.room.depth },
    modules: x.modules.map((a) => {
      if (!a || typeof a.id !== "string")
        throw new Error("Некорректный модуль проекта.");
      return { id: a.id, x: a.x, z: a.z, module: parseModule(a.module) };
    }),
  };
  if (x.offer)
    p.offer = {
      customer: x.offer.customer,
      price: x.offer.price,
      notes: x.offer.notes,
    };
  const e = projectErrors(p);
  if (e.length) throw new Error(e[0]);
  return p;
}
export function appendModule(p: Project, source: Module): Project {
  const next = structuredClone(p),
    module = structuredClone(source);
  module.sections.forEach((s) => (s.id = id()));
  module.name = `Модуль ${p.modules.length + 1}`;
  const x = Math.max(...p.modules.map((a) => a.x + a.module.width));
  next.modules.push({ id: id(), x, z: 30, module });
  return next;
}
