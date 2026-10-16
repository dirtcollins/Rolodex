import Link from 'next/link';
import { redirect } from 'next/navigation';
import { session } from '@/lib/auth';
import { dashboardCounts, followUps, listTodos, pipelineSummary, recentNotes } from '@/lib/data';
import { pickers, todoPick } from '@/lib/pickers';
import { TZ, moneyShort, noteWhen } from '@/lib/format';
import { NewContact } from '@/components/new-contact';
import { DashTodos } from '@/components/dashboard-parts';
import { FollowUpRows } from '@/components/follow-ups';
import './dashboard.css';
export const metadata = { title: 'Dashboard · Rolodex' };
export default async function Dashboard() {
 const s = await session(); if (!s) redirect('/login');
 const [counts, follow, todos, notes, pick, sales] = await Promise.all([dashboardCounts(),followUps(7),listTodos({mine:s.user.id}),recentNotes(4),pickers(),pipelineSummary()]);
 const hour = Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:TZ}).format(new Date()));
 const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
 const due=follow.filter(f=>f.tone!=='soon'), upcoming=follow.filter(f=>f.tone==='soon');
 const stats=[{label:'Open pipeline',value:moneyShort(sales.open_value),href:'/pipeline'},{label:'Won this month',value:moneyShort(sales.won_value),href:'/pipeline?view=list'},{label:'Proposals waiting',value:sales.proposals,href:'/pipeline'},{label:'Contacts',value:counts.contacts,href:'/contacts'}];
 return <>
  <div className="page-head"><div><h1>{greeting}, {s.user.name.trim().split(/\s+/)[0]}</h1></div><div className="page-acts"><NewContact pickers={pick}/></div></div>
  <div className="dash-work">
   <section className="card card-pad dash-reach"><div className="card-head"><h2>Who should I contact today? <span className="section-count">{due.length}</span></h2><Link className="link" href="/follow-ups">All follow-ups</Link></div>{due.length ? <FollowUpRows items={due.slice(0,8)}/> : <div className="empty"><strong>You’re all caught up.</strong>Your next follow-ups will appear here.</div>}{due.length>8&&<Link className="link" href="/follow-ups">View {due.length-8} more</Link>}</section>
   <section className="card card-pad dash-todos"><div className="card-head"><h2>My to-dos</h2><Link className="link" href="/todos">All to-dos</Link></div>{todos.length ? <DashTodos todos={todos.slice(0,5)} pick={todoPick(pick,s.user.id)}/> : <p className="muted">Nothing on your list. You have room to focus.</p>}</section>
   <div className="dash-summary" aria-label="Business overview">{stats.map(x=><Link href={x.href} key={x.label}><span>{x.label}</span><strong>{x.value}</strong></Link>)}</div>
   <section className="card card-pad dash-upcoming"><div className="card-head"><h2>Coming up</h2><Link className="link" href="/follow-ups">All follow-ups</Link></div>{upcoming.length ? <FollowUpRows items={upcoming.slice(0,4)}/> : <p className="muted">No follow-ups in the next seven days.</p>}</section>
   <section className="card card-pad dash-notes"><div className="card-head"><h2>Recent notes</h2></div>{notes.length ? <ul className="timeline">{notes.map(n=>{const href=n.contact_id?'/contacts/'+n.contact_id:n.company_id?'/companies/'+n.company_id:n.opportunity_id?'/pipeline/'+n.opportunity_id:'';return <li key={n.id} className={'tap is-'+n.kind}>{href&&<Link className="tap-link" href={href} aria-label={'Open '+(n.about??'record')}/>}<div className="timeline-meta"><strong>{n.about??'Note'}</strong><span>{noteWhen(n)}</span></div><div className="timeline-body">{n.body}</div></li>})}</ul> : <p className="muted">Your notes and conversations will appear here.</p>}</section>
  </div>
 </>;
}
