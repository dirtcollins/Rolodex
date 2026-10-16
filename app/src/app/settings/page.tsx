import { Appearance } from "@/components/appearance";
import { redirect } from "next/navigation";
import { allUsers, MIN_PASSWORD, session } from "@/lib/auth";
import { services } from "@/lib/data";
import { Services, Team, type Member } from "@/components/settings-parts";

export const metadata = { title: "Settings · Rolodex" };

// Settings (Docs: "Team members, services…"). Owners change them; salespeople can look.
export default async function SettingsPage() {
  const s = await session();
  if (!s) redirect("/login?next=/settings");
  const [users, list] = await Promise.all([allUsers(), services()]);
  // Only what the screen shows goes to the browser (never password hashes).
  const members: Member[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }));
  const owner = s.user.role === "owner";
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1></div></div>
      <div className="settings-stack">
        <Appearance />
        <Team members={members} me={s.user.id} canEdit={owner} minPassword={MIN_PASSWORD} />
        <Services services={list} canEdit={owner} />
      </div>
    </>
  );
}
