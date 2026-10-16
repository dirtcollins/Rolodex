import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { followUps } from "@/lib/data";
import { FOLLOW_SHOW_COOKIE } from "@/lib/format";
import { FollowUpGroups, type FollowShow } from "@/components/follow-ups";

export const metadata = { title: "Follow-ups · Rolodex" };

// Follow-ups (Brendan 10-15, a core feature): every follow-up on a person, a company or a project, and everyone a
// keep-in-touch rhythm says to reconnect with. Late, Today, This week, then the rest of the next 30 days.
export default async function FollowUpsPage() {
  const s = await session();
  if (!s) redirect("/login");
  const [items, jar] = await Promise.all([followUps(30), cookies()]);
  const saved = jar.get(FOLLOW_SHOW_COOKIE)?.value;
  const show: FollowShow = saved === "contact" || saved === "company" || saved === "project" ? saved : "all";
  return (
    <>
      <div className="page-head"><div><h1>Follow-ups</h1></div></div>
      <FollowUpGroups items={items} show={show} />
    </>
  );
}
