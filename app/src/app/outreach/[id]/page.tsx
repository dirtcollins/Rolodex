import Link from "next/link";
import { notFound } from "next/navigation";
import { allTags, campaignById, campaignPeople, contactById, reachable, sentEmails, templates } from "@/lib/data";
import { session } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { CampaignEmail, CampaignPeople, DeleteCampaign, RenameCampaign } from "@/components/campaign-parts";
import { BackLink } from "@/components/back";
import "../outreach.css";

export const metadata = { title: "Campaign · Rolodex" };

// One campaign (Docs: 8. "Organize target-company lists, prepare personalized outreach, and track who was contacted,
// who responded, and who needs follow-up"). Replies arrive in the normal inbox, so their status is set by hand here.
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = Number.isSafeInteger(id) ? await campaignById(id) : null;
  if (!c) notFound();
  const [people, list, everyone, tags, s, last] = await Promise.all([campaignPeople(id), templates(), reachable(), allTags(), session(), sentEmails({ limit: 1 })]);

  // The preview is for the first person the next send goes to (else the first on the list), filled in as the server will.
  const first = people.find((p) => p.status === "to_send" && p.email) ?? people[0];
  const person = first?.contact_id ? await contactById(first.contact_id) : null;
  const me = { name: s?.user.name ?? "", email: s?.user.email ?? "" };
  const vars = !first ? null : person
    ? { first_name: person.first_name || "there", name: person.name, company: person.companies[0]?.name ?? "", my_name: me.name }
    : { first_name: "there", name: first.name, company: first.name, my_name: me.name };

  return (
    <>
      <BackLink href="/outreach" label="Outreach" />
      <div className="record-head">
        <span className="avatar lg"><Icon name="outreach" /></span>
        <div style={{ minWidth: 0 }}>
          <h1>{c.name}</h1>
          <p className="muted">{c.people} {c.people === 1 ? "person" : "people"} · {c.to_send} to send · {c.sent} sent · {c.replied} replied · {c.follow_up} follow up</p>
        </div>
        <RenameCampaign c={c} />
      </div>
      <div className="out">
        <CampaignEmail c={c} people={people} templates={list} vars={vars} previewFor={first?.name ?? ""} me={me} testNote={last[0]?.status === "test"} />
        <CampaignPeople id={c.id} people={people} everyone={everyone} tags={tags} />
        <div><DeleteCampaign id={c.id} /></div>
      </div>
    </>
  );
}
