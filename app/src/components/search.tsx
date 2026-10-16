"use client";
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { SearchResults } from '@/lib/data';
import { ACTIVITY_KINDS, OPP_STAGES, dayLabel, money, stageLabel } from '@/lib/format';
import { Popup } from './ui';
import { Icon } from './icons';
type Row = { key:string;icon:string;title:string;sub:string;meta?:string;href:string };
const EMPTY:SearchResults={contacts:[],companies:[],projects:[],todos:[],notes:[]};
export function Search({phone=false,sidebar=false}:{phone?:boolean;sidebar?:boolean}) {
 const router=useRouter(),path=usePathname();
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[res,setRes]=useState(EMPTY),[active,setActive]=useState(0),[error,setError]=useState(false),[got,setGot]=useState(''),[retry,setRetry]=useState(0);
 const list=useRef<HTMLDivElement>(null),term=q.trim();
 useEffect(()=>setOpen(false),[path]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&matchMedia('(max-width:820px)').matches===phone){e.preventDefault();setOpen(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[phone]);
 useEffect(()=>{
  if(!open)return;setError(false);if(term.length<2){setRes(EMPTY);setGot(term);return;}
  const controller=new AbortController();const t=setTimeout(async()=>{try{const r=await fetch('/api/search?q='+encodeURIComponent(term),{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(!controller.signal.aborted){setRes(data);setGot(term);setActive(0);}}catch{if(!controller.signal.aborted)setError(true);}},150);
  return()=>{clearTimeout(t);controller.abort();};
 },[open,term,retry]);
 const groups:[string,Row[]][]=[
 ['Contacts',res.contacts.map(c=>({key:'c'+c.id,icon:'user',title:c.name,sub:c.sub,href:'/contacts/'+c.id}))],
 ['Companies',res.companies.map(c=>({key:'co'+c.id,icon:'companies',title:c.name,sub:c.sub,href:'/companies/'+c.id}))],
 ['Projects',res.projects.map(o=>({key:'o'+o.id,icon:'pipeline',title:o.name,sub:[o.company,stageLabel(OPP_STAGES,o.stage)].filter(Boolean).join(' · '),meta:o.value_cents?money(o.value_cents):'',href:'/pipeline/'+o.id}))],
 ['To-dos',res.todos.map(t=>({key:'t'+t.id,icon:'todos',title:t.title,sub:[t.done?'Done':dayLabel(t.due),t.about].filter(Boolean).join(' · '),href:'/todos?view='+(t.done?'done':'all')+'&todo='+t.id}))],
 ['Notes',res.notes.map(n=>({key:'n'+n.id,icon:'edit',title:n.about??'Note',sub:n.body,meta:stageLabel(ACTIVITY_KINDS,n.kind),href:n.contact_id?'/contacts/'+n.contact_id:n.company_id?'/companies/'+n.company_id:n.opportunity_id?'/pipeline/'+n.opportunity_id:'/todos'}))]
 ];
 const rows=groups.flatMap(([,rs])=>rs),ready=got===term;
 const go=(r:Row)=>{setOpen(false);setQ('');router.push(r.href);};
 useEffect(()=>{list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});},[active]);
 return <>
 <button type="button" className={phone?'top-icon':'search-trigger'+(sidebar?' is-sidebar':'')} aria-label="Search" aria-haspopup="dialog" onClick={()=>setOpen(true)}><Icon name="search"/>{!phone&&<><span>{sidebar?'Search…':'Search anything…'}</span><kbd>⌘ K</kbd></>}</button>
 {open&&<Popup title="Search Rolodex" onClose={()=>setOpen(false)} wide guard={false}><div className="search-dialog">
  <label className="search-box"><Icon name="search"/><input autoFocus value={q} onChange={e=>{setQ(e.target.value);setActive(0);}} placeholder="Contacts, companies, projects, notes…" aria-label="Search Rolodex" role="combobox" aria-autocomplete="list" aria-controls="command-results" aria-expanded={ready&&rows.length>0} aria-activedescendant={ready&&rows[active]?'command-'+rows[active].key:undefined} onKeyDown={e=>{if((e.key==='ArrowDown'||e.key==='ArrowUp')&&ready&&rows.length){e.preventDefault();setActive(a=>(a+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length);}else if(e.key==='Enter'&&ready&&rows[active]){e.preventDefault();go(rows[active]);}}}/></label>
  {error&&<p className="form-error" role="alert">Search couldn’t connect. <button className="link" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}
  <div className="search-panel"><div className="search-results" ref={list} id="command-results" role="listbox" aria-label="Search results" aria-busy={term.length>=2&&!ready&&!error}>
   {term.length<2?<p className="search-empty">Search your people, companies, projects, to-dos, and conversations.</p>:!ready?<p className="search-empty">Searching…</p>:rows.length?groups.filter(([,rs])=>rs.length).map(([name,rs])=><div key={name} role="group" aria-label={name}><div className="search-group">{name}</div>{rs.map(r=><a href={r.href} key={r.key} id={'command-'+r.key} role="option" aria-selected={rows[active]?.key===r.key} className={'search-item'+(rows[active]?.key===r.key?' is-active':'')} onMouseEnter={()=>setActive(rows.indexOf(r))} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();go(r);}}><span className="search-ico"><Icon name={r.icon}/></span><span className="search-copy"><strong>{r.title}</strong><small>{r.sub}</small></span>{r.meta&&<span className="search-meta">{r.meta}</span>}</a>)}</div>):<p className="search-empty">Nothing matches “{term}”. Try another name or keyword.</p>}
  </div><div className="search-foot"><span>↑ ↓ to move</span><span>Return to open</span><span>Esc to close</span></div></div>
 </div></Popup>}
 </>;
}
