// Export V2's database (a copy) into V3's data shape. Usage: node export.mjs <pglite dir> <V2 public dir> <V3 dir>
import { PGlite } from '/Users/brendan-macpro/Documents/Codex/Rolodex Software/app/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs'; import path from 'node:path';
const [dbDir, pub, v3] = process.argv.slice(2);
const db = new PGlite(dbDir); const q = async (s) => (await db.query(s)).rows;
const day = v => v ? new Date(v).toISOString().slice(0, 10) : null;                       // date columns (UTC midnight)
const localDay = v => v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) : null; // timestamps
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RANK = ['client','former','referral','vendor','prospect','friend','connection'];
const bestKind = ks => RANK.find(k => (ks || []).includes(k)) || null;

const users = await q(`select id,name,email,phone,role,signature from users order by id`);
const key = new Map(users.map((u, i) => [u.id, i === 0 ? 'bc' : 'u' + u.id]));       // V3 treats 'bc' as "me"
const who = id => key.get(id) || 'bc';
const coRows = await q(`select * from companies where deleted_at is null order by id`);
const ctRows = await q(`select * from contacts where deleted_at is null order by id`);
const links = await q(`select cc.* from contact_companies cc join companies c on c.id=cc.company_id and c.deleted_at is null order by cc.contact_id, cc.company_id`);
const leads = await q(`select company_id, contact_id from leads where deleted_at is null`);
const notesR = await q(`select * from notes where deleted_at is null order by coalesce(happened_at, created_at) desc`);
const opps = await q(`select * from opportunities where deleted_at is null order by position, id`);
const todosR = await q(`select * from todos where deleted_at is null order by id`);
const svc = (await q(`select value from settings where key='services'`))[0];

const firstCo = new Map(); links.forEach(l => { if (!firstCo.has(l.contact_id)) firstCo.set(l.contact_id, l); });
const ctName = new Map(ctRows.map(c => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ').trim()]));
const leadCo = new Set(leads.map(l => l.company_id).filter(Boolean));
const coKinds = new Map(); links.forEach(l => { const c = ctRows.find(x => x.id === l.contact_id); if (c) coKinds.set(l.company_id, [...(coKinds.get(l.company_id) || []), ...(c.kinds || [])]); });

const companies = coRows.map(c => ({
  id: c.id, name: c.name.trim(), industry: (c.industry || '').split(';')[0].trim(), city: c.city || '',
  kind: bestKind((coKinds.get(c.id) || []).filter(k => k !== 'connection' && k !== 'friend')) || (leadCo.has(c.id) ? 'prospect' : null),
  website: (c.website || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), phone: c.phone || '', size: c.size || '', about: c.description || '', next: day(c.next_follow_up),
}));
// Website, LinkedIn and social links, each typed by its address (same rules as index.html's linkType).
const LINK_TYPES = [['linkedin', /(^|[/.])linkedin\.com/], ['messenger', /(^|[/.])(m\.me|messenger\.com)\//], ['facebook', /(^|[/.])(facebook|fb)\.com/], ['whatsapp', /(^|[/.])(wa\.me|whatsapp\.com)/], ['instagram', /(^|[/.])instagram\.com/], ['x', /(^|[/.])(twitter|x)\.com(\/|$)/], ['tiktok', /(^|[/.])tiktok\.com/], ['youtube', /(^|[/.])(youtube\.com|youtu\.be)/], ['threads', /(^|[/.])threads\.(net|com)/]];
const linkType = u => (LINK_TYPES.find(([, re]) => re.test(u)) || ['website'])[0];
const linksOf = c => { const seen = new Set(), out = [];
  [c.website, c.linkedin, ...String(c.socials || '').split(/[\s,]+/)].map(u => (u || '').trim()).filter(Boolean).forEach(u => {
    const url = /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, ''), k = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push({ type: linkType(url), url }); } });
  return out; };
const contacts = ctRows.map(c => {
  const l = firstCo.get(c.id), b = c.birthday ? new Date(c.birthday) : null;
  return { id: c.id, first: c.first_name || '', last: c.last_name || '', name: ctName.get(c.id) || '(No name)', title: (l && l.title) || c.job_title || '', companyId: l ? l.company_id : null,
    kind: bestKind(c.kinds), phone: (c.phones || [])[0]?.value || '', email: (c.emails || [])[0]?.value || '', city: c.city || '',
    lastContact: day(c.last_contacted), next: day(c.next_follow_up), cadence: c.keep_in_touch || null,
    links: linksOf(c), birthday: b ? MONL[b.getUTCMonth()] + ' ' + b.getUTCDate() : '', howMet: c.how_met || '', introducedBy: c.introduced_by ? (ctName.get(c.introduced_by) || '') : '', tags: c.tags || [] };
});
const ctIds = new Set(contacts.map(c => c.id)), coIds = new Set(companies.map(c => c.id));
const deals = opps.map(o => ({ id: o.id, name: o.name, companyId: coIds.has(o.company_id) ? o.company_id : (firstCo.get(o.contact_id)?.company_id ?? null), contactId: ctIds.has(o.contact_id) ? o.contact_id : null,
  value: Math.round((o.value_cents || 0) / 100), stage: o.stage, close: day(o.close_date) || localDay(o.closed_at), next: day(o.next_follow_up), owner: 'bc' }));
const dealCo = new Map(deals.map(d => [d.id, d.companyId]));
const KIND = { note: 'note', call: 'call', email: 'email', text: 'text', meeting: 'meeting', video: 'meeting', linkedin: 'text' };
const notes = notesR.map(n => {
  let type = 'contact', rid = n.contact_id;
  if (!ctIds.has(rid)) { type = 'company'; rid = coIds.has(n.company_id) ? n.company_id : dealCo.get(n.opportunity_id); }
  if (rid == null) return null;
  const label = n.kind === 'introduction' ? 'Introduction: ' : n.kind === 'linkedin' ? 'LinkedIn: ' : '';
  return { id: 'n' + n.id, type, rid, kind: KIND[n.kind] || 'note', date: localDay(n.happened_at || n.created_at), body: label + n.body, by: who(n.created_by), att: [] };
}).filter(Boolean);
const todos = todosR.map(t => ({ id: t.id, text: t.title, due: day(t.due), who: who(t.assigned_to || t.created_by),
  link: ctIds.has(t.contact_id) ? { type: 'contact', id: t.contact_id } : coIds.has(t.company_id) ? { type: 'company', id: t.company_id } : t.opportunity_id && dealCo.get(t.opportunity_id) ? { type: 'company', id: dealCo.get(t.opportunity_id) } : null,
  done: !!t.done_at, doneAt: localDay(t.done_at), prio: t.high ? 1 : 4, desc: t.notes || '', repeat: null, subtasks: [], comments: [], order: t.id, created: localDay(t.created_at), by: who(t.created_by), deleted: false }));

// Photos and logos: copy the 104px WebP files V2 already has.
const photos = {}, logos = {};
const out = path.join(v3, 'data'); fs.mkdirSync(path.join(out, 'photos'), { recursive: true }); fs.mkdirSync(path.join(out, 'logos'), { recursive: true });
const man = JSON.parse(fs.readFileSync(path.join(pub, 'contact-avatars/manifest.json'), 'utf8'));
contacts.forEach(c => { const m = man[c.id]; if (!m) return; const f = path.join(pub, m.src104); if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, 'photos', c.id + '.webp')); photos[c.name] = 'data/photos/' + c.id + '.webp'; } });
companies.forEach(c => { const f = path.join(pub, 'company-avatars', c.id + '-104.webp'); if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, 'logos', c.id + '.webp')); logos[c.name] = 'data/logos/' + c.id + '.webp'; } });
const me = users[0]; const ua = path.join(pub, 'user-avatars/brendan-collins-112.webp');
if (me && fs.existsSync(ua)) photos[me.name] = 'assets/brendan-collins-112.webp';

const team = users.map(u => ({ k: key.get(u.id), name: u.name, email: u.email, role: u.role === 'owner' ? 'Owner' : 'Salesperson', active: true }));
const prefs = { name: me.name, email: me.email, phone: me.phone || '', signature: me.signature || '', services: svc ? String(svc.value).split('\n').map(s => s.trim()).filter(Boolean) : null };
const data = { exportedAt: new Date().toISOString(), source: 'Rolodex V2 database', team, prefs, companies, contacts, notes, deals, todos, photos, logos };
fs.writeFileSync(path.join(out, 'rolodex-data.js'), '// Real Rolodex records exported from V2. Private: kept out of git.\nwindow.RX_DATA = ' + JSON.stringify(data) + ';\n');
console.log({ companies: companies.length, contacts: contacts.length, notes: notes.length, deals: deals.length, todos: todos.length, photos: Object.keys(photos).length, logos: Object.keys(logos).length,
  dealsNoCompany: deals.filter(d => d.companyId == null).length, contactsNoCompany: contacts.filter(c => c.companyId == null).length, noName: contacts.filter(c => c.name === '(No name)').length,
  dupContactNames: contacts.length - new Set(contacts.map(c => c.name)).size, dupCoNames: companies.length - new Set(companies.map(c => c.name)).size, team });
await db.close();
