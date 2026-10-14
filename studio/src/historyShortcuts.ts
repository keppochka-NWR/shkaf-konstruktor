/** Physical key codes keep undo/redo working with Russian keyboard layouts. */
export function historyShortcut(e:KeyboardEvent):'undo'|'redo'|null {
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return null;
  if(e.code==='KeyZ'||e.key.toLowerCase()==='z')return e.shiftKey?'redo':'undo';
  if(e.code==='KeyY'||e.key.toLowerCase()==='y')return 'redo';
  return null;
}
export function editsText(target:EventTarget|null):boolean {
  if(!(target instanceof Element))return false;
  if(target.closest('textarea,[contenteditable="true"],[contenteditable=""]'))return true;
  const input=target.closest('input');
  return !!input&&!['checkbox','radio','range','button','submit','reset','color','file'].includes(input.type);
}
