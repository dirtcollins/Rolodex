// Small formatting helpers, safe on the server and in the browser.

export const TZ = "America/Los_Angeles";
// Construct locale formatters once; lists can call these hundreds of times per render.
const localDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const dateYearFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const momentFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const momentYearFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
/** An instant's calendar day in Bakersfield, as YYYY-MM-DD. */
export const localDay = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "Invalid Date" : localDayFormat.format(d);
};
/** Today in Bakersfield as YYYY-MM-DD. */
export const today = () => localDay(new Date());
export const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);

/** "Today", "Tomorrow", "Yesterday", "Oct 18" (with the year when it isn't this one). */
export function dayLabel(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const t = today(), n = daysBetween(t, ymd);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  const d = new Date(ymd + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? "Invalid Date" : (ymd.slice(0, 4) !== t.slice(0, 4) ? dateYearFormat : dateFormat).format(d);
}
/** due | late | "" for a follow-up or to-do date. */
export const dueState = (ymd: string | null | undefined) => {
  if (!ymd) return "";
  const t = today();
  return ymd < t ? "late" : ymd === t ? "due" : "";
};

/** A timeline entry's when: the day for a call or meeting logged by day, else the moment. */
export const noteWhen = (n: { created_at: string; day_only: boolean }) => (n.day_only ? dayLabel(localDay(n.created_at)) : when(n.created_at));
/** "Oct 14, 3:05 PM" for a moment (ISO). */
export function when(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return Number.isNaN(d.getTime()) ? "Invalid Date" : (sameYear ? momentFormat : momentYearFormat).format(d);
}

export const fullName = (c: { first_name: string; last_name: string }) => [c.first_name, c.last_name].filter(Boolean).join(" ");
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export function phoneText(p: string): string {
  const d = p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}
export const telHref = (p: string) => "tel:" + p.replace(/[^\d+]/g, "");
/** A website as a link: adds https:// when it's missing. */
export const webHref = (u: string) => (/^https?:\/\//i.test(u) ? u : "https://" + u);
export const webText = (u: string) => u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

/** Who a contact is to Collins Creative (Docs: "A contact can be a prospect, client…"). */
export const KINDS: [string, string][] = [
  ["prospect", "Prospect"], ["client", "Client"], ["former_client", "Former client"], ["referral_partner", "Referral partner"],
  ["vendor", "Vendor"], ["friend", "Friend"], ["connection", "Connection"],
];
export const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] ?? k;
export const CADENCES: [number, string][] = [[30, "Every 30 days"], [60, "Every 60 days"], [90, "Every 90 days"], [180, "Every 6 months"]];

// ---------------------------------------------------------------- sales (Docs sections 4 and 5)
export const LEAD_STAGES: [string, string][] = [
  ["new", "New"], ["researching", "Researching"], ["ready", "Ready to contact"], ["contacted", "Contacted"],
  ["responded", "Responded"], ["meeting", "Meeting scheduled"], ["qualified", "Qualified"], ["not_interested", "Not interested"],
];
export const PRIORITIES: [string, string][] = [["high", "High"], ["medium", "Medium"], ["low", "Low"]];
export const OPP_STAGES: [string, string][] = [
  ["lead", "Lead"], ["meeting", "Meeting"], ["proposal_sent", "Proposal sent"], ["negotiating", "Negotiating"], ["won", "Won"], ["lost", "Lost"],
];
export const OPEN_STAGES = ["lead", "meeting", "proposal_sent", "negotiating"];
export const stageLabel = (list: [string, string][], k: string) => list.find(([v]) => v === k)?.[1] ?? k;
/** "$35,000" (whole dollars; cents only when there are some). */
export const money = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
/** "$35K", "$1.2M" for tight spots (board columns, stats). */
export const moneyShort = (cents: number) => { const d = cents / 100; return d >= 1e6 ? "$" + +(d / 1e6).toFixed(1) + "M" : d >= 1e4 ? "$" + Math.round(d / 1e3) + "K" : money(cents); };

// ---------------------------------------------------------------- relationships (Docs sections 6 and 7)
/** What can go on a timeline. A note and an observation are written down; the rest are interactions (they count as a touch). */
export const ACTIVITY_KINDS: [string, string][] = [
  ["note", "Note"], ["call", "Call"], ["email", "Email"], ["text", "Text"], ["meeting", "Meeting"], ["video", "Video call"],
  ["linkedin", "LinkedIn"], ["introduction", "Introduction"], ["observation", "Observation"],
];
export const INTERACTIONS = ["call", "email", "text", "meeting", "video", "linkedin", "introduction"];
export const RELATION_KINDS: [string, string][] = [
  ["knows", "Knows"], ["introduced", "Introduced"], ["referred", "Referred"], ["partner", "Business partner"],
  ["coworker", "Works with"], ["former_coworker", "Former coworker"], ["family", "Family"], ["friend", "Friend"],
];

/**
 * The Pipeline remembers each last pick in a cookie the page reads on the server, so it opens the same way at once:
 * Board or List, the list's sort, whether Won and Lost are open on the board, and the phone's stage.
 */
export const PIPELINE_VIEW_COOKIE = "rx-pipeline-view";
export const PIPELINE_SORT_COOKIE = "rx-pipeline-sort";
export const PIPELINE_OPEN_COOKIE = "rx-pipeline-open";
export const PIPELINE_STAGE_COOKIE = "rx-pipeline-stage";
export const PIPELINE_SORTS: [string, string][] = [["stage", "By stage"], ["value", "Highest value"], ["close", "Closing soonest"], ["follow_up", "Next follow-up"], ["newest", "Newest first"], ["name", "Name A–Z"]];
/** Remember a pick for a year (browser only). */
export const remember = (name: string, value: string) => { document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; max-age=31536000; samesite=lax"; };
/** Follow-ups: All, People, Companies or Projects, remembered in this cookie (read on the server, so the page opens on it). */
export const FOLLOW_SHOW_COOKIE = "rx-followups-show";
