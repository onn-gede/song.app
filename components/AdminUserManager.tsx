"use client";
import { useState,useTransition } from "react";
import { createManagedUserAction,updateManagedUserAction,type ManagedUser } from "@/app/(app)/admin/users/actions";
const roles=[['viewer','Vizualizare'],['worship_leader','Coordonator'],['editor','Editor'],['admin','Administrator']];
export function AdminUserManager({initial,currentId,canCreate}:{initial:ManagedUser[];currentId:string;canCreate:boolean}){
 const [users,setUsers]=useState(initial),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const waiting=users.filter(u=>!u.is_active);
 return <div><div className="admin-user-caption"><span>{users.filter(u=>u.role==='admin'&&u.is_active).length} administratori activi</span><span>{waiting.length} conturi inactive / în așteptare</span></div>
 <details className="card user-create-panel"><summary>+ Creează cont</summary>{!canCreate?<p className="error">Configurează SUPABASE_SERVICE_ROLE_KEY în variabilele private Netlify pentru crearea conturilor.</p>:<form className="form-grid" action={data=>start(async()=>{setError('');setMessage('');try{setUsers(await createManagedUserAction(data));setMessage('Cont creat în așteptare. Aprobă-l din listă.');}catch(err){setError(err instanceof Error?err.message:'Crearea a eșuat.');}})}>
  <div className="form-two"><label className="label">Nume<input className="input" name="full_name" maxLength={120} required/></label><label className="label">Email<input className="input" name="email" type="email" maxLength={320} required/></label></div>
  <div className="form-two"><label className="label">Parolă inițială<input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label className="label">Rol<select className="select" name="role" defaultValue="viewer">{roles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
  <button className="btn" disabled={pending}>Creează în așteptare</button><p className="muted small">Contul are acces numai după aprobare. Utilizatorul își poate schimba parola după autentificare.</p>
 </form>}</details>
 {error?<p className="error" role="alert">{error}</p>:null}{message?<p className="success" role="status">{message}</p>:null}
 <div className="admin-user-list">{users.map(u=><form key={`${u.id}:${u.role}:${u.is_active}`} className="card admin-user-row" action={data=>start(async()=>{setError('');setMessage('');try{setUsers(await updateManagedUserAction(u.id,String(data.get('role')||u.role),String(data.get('active'))==='true'));setMessage('Cont actualizat.');}catch(err){setError(err instanceof Error?err.message:'Actualizarea a eșuat.');}})}>
   <div><strong>{u.full_name||u.email}</strong><small>{u.email}</small></div><span className={`badge ${u.is_active?'':'warning'}`}>{u.is_active?'Activ':'În așteptare / inactiv'}</span>
   <label className="sr-only" htmlFor={`role-${u.id}`}>Rol pentru {u.email}</label><select id={`role-${u.id}`} className="select" name="role" defaultValue={u.role} disabled={pending||u.id===currentId}>{roles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
   {u.id===currentId?<span className="muted small">Contul tău</span>:<div className="inline-form"><button className="btn secondary" name="active" value={String(u.is_active)} disabled={pending}>Salvează rolul</button><button className={u.is_active?'btn secondary':'btn'} name="active" value={String(!u.is_active)} disabled={pending}>{u.is_active?'Dezactivează':'Aprobă accesul'}</button></div>}
 </form>)}</div></div>;
}
