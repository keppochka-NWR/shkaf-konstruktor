import {parts,type Module} from './model';
import {hingeCollisions,partCollisions} from './collisions';

/** Opt-in repair: never silently migrate legacy or Bazis geometry. */
export function repairHinges(m:Module):Module {
  if(m.kitchen||m.raw||m.corner||m.kupe)throw new Error('Эта команда предназначена для прямых распашных шкафов студии.');
  const next=structuredClone(m);next.hingeFit=true;
  if(hingeCollisions(partCollisions(parts(next),next)).length)throw new Error('Для петель не найдено свободного места. Измените наполнение или сторону открывания.');
  return next;
}
