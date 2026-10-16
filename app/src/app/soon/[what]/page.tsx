import { notFound } from "next/navigation";
import { SALES } from "@/components/areas";
import { Icon } from "@/components/icons";

// The sales pages, greyed in the sidebar until their phase (Docs: Recommended Build Phases).
const WHAT: Record<string, string> = {
  leads: "Track prospective customers before a project is identified: prospect lists by industry and location, outreach status, priority and source.",
  pipeline: "Specific potential projects with an estimated value, from Discovery to Won or Lost. A company can have several.",
  network: "How people know one another: introductions, referral partners and mutual connections, and which ones lead to work.",
  activities: "Every call, email, meeting and LinkedIn message in one history, with follow-ups and reminders.",
  outreach: "Email from contact pages, reusable templates and campaigns to target-company lists, with who replied.",
};
export default async function Soon({ params }: { params: Promise<{ what: string }> }) {
  const { what } = await params;
  const a = SALES.find((x) => x.href === "/soon/" + what);
  if (!a || !WHAT[what]) notFound();
  return <div className="soon"><span className="avatar lg" style={{ margin: "0 auto" }}><Icon name={a.icon} /></span><h1>{a.label}</h1><p>{WHAT[what]}</p><span className="pill is-accent">Coming in {a.soon}</span></div>;
}
