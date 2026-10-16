import Link from "next/link";
import { connectors, contactNames, referralPartners } from "@/lib/data";
import { query } from "@/lib/db";
import { moneyShort } from "@/lib/format";
import { AddConnection, ConnectionList, type Connection } from "@/components/network-parts";
import { ContactAvatar } from "@/components/contact-avatar";
import "./network.css";

export const metadata = { title: "Network · Rolodex" };

/** Every connection between two people, newest first (only this page needs them all at once). */
const allConnections = () => query<Connection>(`select r.id::int, r.kind, r.note, a.id::int as a_id, trim(a.first_name || ' ' || a.last_name) as a, b.id::int as b_id, trim(b.first_name || ' ' || b.last_name) as b
  from relationships r join contacts a on a.id = r.contact_id and a.deleted_at is null join contacts b on b.id = r.other_id and b.deleted_at is null
  where r.deleted_at is null order by r.created_at desc, r.id desc limit 500`);

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
const cash = (cents: number) => (cents ? moneyShort(cents) : "—");

// Network (Docs: 6. Network): how people know one another, and whether the people someone brings turn into work.
export default async function Network() {
  const [brings, partners, conns, people] = await Promise.all([connectors(), referralPartners(), allConnections(), contactNames()]);
  return (
    <>
      <div className="page-head"><div><h1>Network</h1></div>
        <div className="page-acts"><AddConnection people={people} /></div></div>
      <div className="net">
        <section className="card card-pad">
          <div className="card-head"><h3>Who brings us work</h3>{brings.length > 0 && <small>{plural(brings.length, "person", "people")}</small>}</div>
          {!brings.length ? (
            <p className="net-help">No introductions yet. Set “Introduced by” when you edit a contact, or add an Introduced or Referred connection. Then you’ll see who brings people to Collins Creative and what their projects are worth.</p>
          ) : (
            <div>
              <div className="net-row is-head"><span>Person</span><span className="num">Brought</span><span className="num">Projects</span><span className="num">Open</span><span className="num">Won</span></div>
              {brings.map((c) => (
                <Link key={c.id} className="net-row" href={"/contacts/" + c.id}>
                  <span className="who"><ContactAvatar id={c.id} name={c.name} /><span style={{ minWidth: 0 }}><strong>{c.name}</strong>
                    <small>{c.sub || " "}</small>
                    <small className="net-sub">{[plural(c.people, "person", "people"), plural(c.projects, "project", "projects"), c.open_value ? moneyShort(c.open_value) + " open" : ""].filter(Boolean).join(" · ")}</small></span></span>
                  <span className="num">{c.people}</span>
                  <span className="num">{c.projects || "—"}</span>
                  <span className="num">{cash(c.open_value)}</span>
                  <span className={"num" + (c.won_value ? " is-won" : "")}>{cash(c.won_value)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <div className="grid-2">
          <section className="card card-pad">
            <div className="card-head"><h3>Connections</h3>{conns.length > 0 && <small>{conns.length}</small>}</div>
            {conns.length ? <ConnectionList connections={conns} people={people} />
              : <p className="net-help">Nobody’s connected yet. Add who knows whom: business partners, coworkers, family, who introduced whom.</p>}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h3>Referral partners</h3>{partners.length > 0 && <small>{partners.length}</small>}</div>
            {partners.length ? (
              <div className="linked">{partners.map((p) => (
                <Link key={p.id} href={"/contacts/" + p.id}><ContactAvatar id={p.id} name={p.name} />
                  <span style={{ minWidth: 0 }}><strong>{p.name}</strong><small>{[p.sub, p.people ? "Brought " + plural(p.people, "person", "people") : "Hasn’t brought anyone yet"].filter(Boolean).join(" · ")}</small></span></Link>))}
              </div>
            ) : <p className="net-help">No referral partners yet. Mark someone as a Referral partner under “Who they are to us” when you edit them.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
