/** Physical key codes keep undo/redo working with Russian keyboard layouts. */
export function historyShortcut(e:KeyboardEvent):'undo'|'redo'|null {
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return null;
  if(e.code==='KeyZ'||e.key.toLowerCase()==='z')return e.shiftKey?'redo':'undo';
  if(e.code==='KeyY'||e.key.toLowerCase()==='y')return 'redo';
  return null;
}
/** Виды сцены клавишами, как WASD в Базисе (п.28 волны 22.10; точная раскладка Базиса не найдена в справке — вопрос Максу):
 *  W — сверху, S — спереди, A — слева, D — справа, E — 3D (Q — вспомогательная линия в Scene.tsx, решение Макса 29.10.2026). По физической клавише (работает в русской раскладке: Ц/Ы/Ф/В/Й/У).
 *  С модификаторами, автоповтором и в списках выбора не срабатывает; поля ввода отсекает editsText у вызывающего. */
export function viewShortcut(e:KeyboardEvent):'iso'|'front'|'side'|'left'|'top'|null {
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.repeat)return null;
  if(typeof Element!=='undefined'&&e.target instanceof Element&&e.target.closest('select'))return null;
  return ({KeyW:'top',KeyS:'front',KeyA:'left',KeyD:'side',KeyE:'iso'} as const)[e.code as 'KeyW']??null;
}
export function editsText(target:EventTarget|null):boolean {
  if(!(target instanceof Element))return false;
  if(target.closest('textarea,[contenteditable="true"],[contenteditable=""]'))return true;
  const input=target.closest('input');
  return !!input&&!['checkbox','radio','range','button','submit','reset','color','file'].includes(input.type);
}
