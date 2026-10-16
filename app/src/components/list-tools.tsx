"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { listCookie, rememberable } from '@/lib/list-memory';
import { Popup, useOpen } from './ui';
import { Icon } from './icons';
// Filter controls share their requested query immediately. Two changes made before
// the router commits must merge with each other, rather than with an older URL.
const requestedQueries = new Map<string, string>();
const queryListeners = new Set<() => void>();
const queryUsers = new Map<string, number>();
function notifyQuery() { for (const listener of queryListeners) listener(); }
function subscribeQuery(listener: () => void) { queryListeners.add(listener); return () => { queryListeners.delete(listener); }; }
function rememberQuery(path: string, next: URLSearchParams) {
 const search = next.toString();
 requestedQueries.set(path, search);
 document.cookie = listCookie(path) + '=' + encodeURIComponent(rememberable(next)) + '; path=/; max-age=31536000; samesite=lax';
 notifyQuery();
}
function useListQuery() {
 const path = usePathname(), actual = useSearchParams().toString();
 const requested = useSyncExternalStore(subscribeQuery, () => requestedQueries.get(path), () => undefined);
 useEffect(() => {
  if (requestedQueries.get(path) === actual) { requestedQueries.delete(path); notifyQuery(); }
 }, [path, actual, requested]);
 useEffect(() => {
  queryUsers.set(path, (queryUsers.get(path) ?? 0) + 1);
  const back = () => { requestedQueries.delete(path); notifyQuery(); };
  addEventListener('popstate', back);
  return () => {
   removeEventListener('popstate', back);
   const remaining = (queryUsers.get(path) ?? 1) - 1;
   if (remaining) queryUsers.set(path, remaining);
   else { queryUsers.delete(path); requestedQueries.delete(path); }
  };
 }, [path]);
 return new URLSearchParams(requested ?? actual);
}
export function useParam() {
 const router = useRouter(), path = usePathname();
 return useCallback((key: string, value: string) => {
  const next = new URLSearchParams(requestedQueries.get(path) ?? location.search);
  if (value) next.set(key, value); else next.delete(key);
  next.delete('page');
  rememberQuery(path, next);
  router.replace(path + (next.size ? '?' + next : ''), { scroll: false });
 }, [router, path]);
}
export function FilterSearch({placeholder}:{placeholder:string}) {
 const sp=useListQuery(),set=useParam(),query=sp.get('q')??'';
 const [q,setQ]=useState(query),submitted=useRef(query),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{if(query!==submitted.current){setQ(query);if(timer.current)clearTimeout(timer.current);submitted.current=query;}},[query]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 return <input className="in" type="search" value={q} placeholder={placeholder} aria-label={placeholder} onChange={e=>{const value=e.target.value;setQ(value);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{submitted.current=value;set('q',value);},200);}}/>;
}
export function FilterSelect({name,label,options}:{name:string;label:string;options:[string,string][]}) {
 const sp=useListQuery(),set=useParam();
 return <select className="in" aria-label={label} value={sp.get(name)??''} onChange={e=>set(name,e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>;
}
export function FilterSummary() {
 const sp=useListQuery(),path=usePathname(),router=useRouter();
 const filters=[...sp.entries()].filter(([k,v])=>v&&!['sort','view','page','todo'].includes(k));
 if(!filters.length)return null;
 return <div className="filter-summary"><span>{filters.length===1?'1 filter active':filters.length+' filters active'}</span>{filters.map(([k,v])=><span className="tag" key={k}>{k==='q'?'Search: ':''}{v.replaceAll('_',' ')}</span>)}<button type="button" className="btn btn-sm btn-quiet" onClick={()=>{const next=new URLSearchParams();for(const key of ['sort','view']){const v=sp.get(key);if(v)next.set(key,v);}rememberQuery(path,next);router.replace(path+(next.size?'?'+next:''),{scroll:false});}}>Clear filters</button></div>;
}
export function MoreFilters({children,keys}:{children:React.ReactNode;keys:string[]}) {
 const o=useOpen(),sp=useListQuery(),count=keys.filter(k=>sp.get(k)).length;
 return <><button type="button" className="btn" onClick={o.show}><Icon name="settings"/>Filters{count?' ('+count+')':''}</button>{o.open&&<Popup title="Filter results" onClose={o.hide} guard={false} foot={<><span className="grow"/><button type="button" className="btn btn-primary" onClick={o.hide}>Done</button></>}><div className="form-grid">{children}</div></Popup>}</>;
}
