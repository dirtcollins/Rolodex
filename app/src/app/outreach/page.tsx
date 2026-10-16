import { RecordSections } from "@/components/record-sections";
import Link from "next/link";
import { listCampaigns, sentEmails, templates } from "@/lib/data";
import { TZ, dayLabel } from "@/lib/format";
import { NewCampaign, NewTemplate, SentRows, TemplateRows } from "@/components/outreach-parts";
import "./outreach.css";

export const metadata = { title: "Outreach · Rolodex" };

/** A moment (ISO) as its Bakersfield day, for dayLabel. */
const ymd = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
/** "12 people · 8 sent · 2 replied · 1 follow up" (on a phone it goes under the subject). */
const campaignCounts = (c: { people: number; sent: number; replied: number; follow_up: number }) =>
  `${c.people} ${c.people === 1 ? "person" : "people"} · ${c.sent} sent · ${c.replied} replied · ${c.follow_up} follow up`;

// Outreach (Docs: 8). Send-only, like Light Ops: Rolodex sends from your own address and keeps what it sent; replies
// come to your normal inbox, so Replied and Follow up are marked by hand on the campaign.
export default async function Outreach() {
  const [campaigns, list, sent] = await Promise.all([listCampaigns(), templates(), sentEmails({ limit: 30 })]);
  return (
    <>
      <div className="page-head"><div><h1>Outreach</h1></div>
        <div className="page-acts"><NewTemplate /><NewCampaign /></div></div>
      <RecordSections sections={[
{ id: "campaigns", label: "Campaigns", content: <><div className="card card-pad">
            <div className="out-head"><h3>Campaigns</h3><small>{campaigns.length || ""}</small></div>
            {!campaigns.length ? <p className="out-empty">No campaigns yet. Start one, write the email, then add who it goes to.</p> : (
              <div className="out-list">
                {campaigns.map((c) => (
                  <Link key={c.id} href={"/outreach/" + c.id} className="out-item out-camp">
                    <span className="out-copy"><strong>{c.name}</strong><small>{c.subject || "No subject yet"}</small><small className="out-sub">{campaignCounts(c)}</small></span>
                    <span className="out-counts">{campaignCounts(c)}</span>
                    <span className="out-when">{dayLabel(ymd(c.created_at))}</span>
                  </Link>
                ))}
              </div>
            )}
          </div></> },
{ id: "templates", label: "Templates", content: <><div className="card card-pad">
            <div className="out-head"><h3>Templates</h3><small>{list.length || ""}</small></div>
            {!list.length ? <p className="out-empty">No templates yet. Save an email you send often, then copy it into a campaign.</p> : <TemplateRows list={list} />}
          </div></> },
{ id: "history", label: "Sent history", content: <><div className="card card-pad">
            <div className="out-head"><h3>Recently sent</h3><small>{sent.length ? "Latest " + sent.length : ""}</small></div>
            {!sent.length ? <p className="out-empty">Nothing sent yet.</p> : <SentRows list={sent} />}
          </div></> }
      ]} />
    </>
  );
}
