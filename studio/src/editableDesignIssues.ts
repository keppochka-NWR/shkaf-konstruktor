/** Constructive violations safe to display for repair. Corrupt data remains fatal.
 * This does not waive manufacturing validation or change saved geometry. */
export function isEditableDesignIssue(message:string):boolean {
 return /упирается в царги корпуса: верх/.test(message)
  || /(?:^|: )Фасад шире \d+(?:\.\d+)? мм при высоте \d+\./.test(message)
  || /(?:^|: )Распашной фасад ниже \d+ мм\./.test(message)
  || /(?:^|: )Ряд фасадов \d+ мм — ниже \d+ мм\./.test(message)
  || message.endsWith('корпус выходит за границы помещения. Измените замер или положение.')
  || /^«.+» пересекается с «.+»\. Сдвиньте корпус или поставьте его сверху\.$/.test(message)
  || message==='Окна и двери не должны пересекаться.';
}
export function blockingDesignChanges(previous:readonly string[],next:readonly string[]):string[]{
 const retained=new Set(previous.filter(isEditableDesignIssue));
 return next.filter(e=>!retained.has(e));
}
