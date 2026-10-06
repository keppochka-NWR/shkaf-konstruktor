import {useState} from 'react';
import {studioApi as api,type StudioUser} from './studioApi';
import './account-settings.css';

export function AccountSettings({user}:{user:StudioUser}){
  const [accounts,setAccounts]=useState<StudioUser[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [login,setLogin]=useState(''),[name,setName]=useState(''),[role,setRole]=useState<'manager'|'admin'>('manager'),[password,setPassword]=useState(''),[show,setShow]=useState(false);
  const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState('');
  const [resetLogin,setResetLogin]=useState(''),[resetPassword,setResetPassword]=useState('');
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function reload(){setAccounts((await api('/accounts')).items);}
  function generate(){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';setPassword(Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>alphabet[n%64]).join(''));setShow(true);}
  return <section className="cloud-accounts">
    {error&&<p role="alert" className="cloud-error">{error}</p>}{message&&<p role="status" className="cloud-success">{message}</p>}
    <details><summary>Изменить мой пароль</summary><form className="cloud-login" onSubmit={e=>{e.preventDefault();void run(async()=>{if(next!==repeat)throw Error('Новые пароли не совпадают.');await api('/auth/password',{currentPassword:current,password:next});setCurrent('');setNext('');setRepeat('');setMessage('Пароль изменён. На остальных устройствах нужно войти заново.');});}}>
      <label className="hardware-field">Текущий пароль<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} maxLength={128} required/></label>
      <label className="hardware-field">Новый пароль<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} minLength={15} maxLength={128} required/></label>
      <label className="hardware-field">Повторите новый пароль<input type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} minLength={15} maxLength={128} required/></label>
      <p className="field-note">От 15 символов. Можно использовать запоминающуюся фразу с пробелами.</p><button className="outline" disabled={busy}>Изменить пароль</button>
    </form></details>
    {user.role==='admin'&&<details onToggle={e=>{if(e.currentTarget.open)void run(reload);}}><summary>Сотрудники и доступ</summary>
      <p className="field-note">Вы создаёте аккаунты и передаёте сотрудникам логин и пароль. Менеджеры видят свои проекты; администраторы — все.</p>
      <form className="cloud-login" onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/accounts',{login,name,role,password});setPassword('');setLogin('');setName('');setShow(false);await reload();setMessage('Аккаунт создан. Сотрудник может войти по своему логину и паролю.');});}}>
        <label className="hardware-field">Имя сотрудника<input autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={80} required/></label>
        <label className="hardware-field">Логин сотрудника<input autoComplete="off" autoCapitalize="none" spellCheck={false} value={login} onChange={e=>setLogin(e.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,63}" title="От 3 символов: латинские буквы, цифры, точка, дефис, подчёркивание" minLength={3} maxLength={64} required/></label>
        <label className="hardware-field">Роль сотрудника<select value={role} onChange={e=>setRole(e.target.value as 'manager'|'admin')}><option value="manager">Менеджер — свои проекты</option><option value="admin">Администратор — все проекты и сотрудники</option></select></label>
        <label className="hardware-field">Пароль сотрудника<input type={show?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={15} maxLength={128} required/></label>
        <div className="cloud-save"><button type="button" disabled={busy} onClick={generate}>Сгенерировать пароль</button><button type="button" aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Скрыть пароль':'Показать пароль'}</button></div>
        <p className="field-note">Пароль от 15 символов. Сохраните его для передачи сотруднику до создания аккаунта: после сохранения он больше не показывается.</p>
        <button className="primary" disabled={busy}>Создать аккаунт</button>
      </form>
      {accounts.map(account=><div className="cloud-account" key={account.login}><span><strong>{account.name}</strong><small>{account.login} · {account.role==='admin'?'Администратор':'Менеджер'}{!account.active?' · доступ отключён':''}</small></span>{account.login!==user.login&&<div className="cloud-save"><button disabled={busy} onClick={()=>{setResetLogin(account.login);setResetPassword('');}}>Задать новый пароль: {account.login}</button><button disabled={busy} onClick={()=>void run(async()=>{await api('/accounts/'+account.login+'/active',{active:!account.active});await reload();setMessage(account.active?'Доступ отключён. Проекты сохранены.':'Доступ восстановлен.');})}>{account.active?'Отключить':'Включить'}: {account.login}</button></div>}</div>)}
      {resetLogin&&<form className="cloud-login" onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/accounts/'+resetLogin+'/password',{password:resetPassword});setResetLogin('');setResetPassword('');setMessage('Новый пароль задан. Прежние сессии сотрудника завершены.');});}}>
        <label className="hardware-field">Новый пароль для {resetLogin}<input type="password" autoComplete="new-password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} minLength={15} maxLength={128} required/></label>
        <button className="primary" disabled={busy}>Сохранить новый пароль</button><button type="button" disabled={busy} onClick={()=>{setResetLogin('');setResetPassword('');}}>Отмена</button>
      </form>}
    </details>}
  </section>;
}
