import {Component,type ErrorInfo,type ReactNode} from 'react';
/** БЛОКЕР 1 критика релиза 22.10: исключение расчёта или раскроя в одной панели не должно ронять всю студию (белый экран).
 *  Граница показывает ошибку на месте панели, проект остаётся в состоянии редактора; «Повторить» — сброс после правки.
 *  resetKey — при смене (новый проект/правка) граница пробует отрисовать содержимое заново. */
type Props={label:string;resetKey?:unknown;children:ReactNode;className?:string};
type State={error:Error|null;key:unknown};
export class SafeBoundary extends Component<Props,State>{
  state:State={error:null,key:this.props.resetKey};
  static getDerivedStateFromError(error:unknown):Partial<State>{return {error:error instanceof Error?error:Error(String(error))};}
  static getDerivedStateFromProps(props:Props,state:State):Partial<State>|null{return props.resetKey!==state.key?{key:props.resetKey,error:null}:null;}
  componentDidCatch(error:unknown,info:ErrorInfo){console.error('Ошибка в «'+this.props.label+'»:',error,info.componentStack);}
  render(){
    if(!this.state.error)return this.props.children;
    return <div className={'safe-boundary '+(this.props.className??'')} role="alert" data-testid="safe-boundary">
      <b>Не удалось показать «{this.props.label}»</b>
      <p>{this.state.error.message||'Ошибка расчёта.'}</p>
      <p className="safe-boundary-note">Проект не потерян: исправьте модуль (Назад отменяет последнюю правку) или нажмите «Повторить».</p>
      <button type="button" className="outline" onClick={()=>this.setState({error:null})}>Повторить</button>
    </div>;
  }
}
