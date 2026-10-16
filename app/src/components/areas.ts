// The sidebar (Docs: Main Navigation). Brendan, 2026-10-15: perfect Contacts & Companies, Pipeline and Follow-ups first,
// so Leads, Network, Activities and Outreach are built but kept out of the sidebar (HIDDEN) until he asks for them.
export type Area = { href: string; label: string; icon: string; soon?: string; count?: "contacts" | "companies" | "todos" | "deals" | "followups" };
export const MAIN: Area[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/follow-ups", label: "Follow-ups", icon: "calendar", count: "followups" },
  { href: "/contacts", label: "Contacts", icon: "contacts", count: "contacts" },
  { href: "/companies", label: "Companies", icon: "companies", count: "companies" },
  { href: "/todos", label: "To-dos", icon: "todos", count: "todos" },
];
export const SALES: Area[] = [
  { href: "/pipeline", label: "Pipeline", icon: "pipeline", count: "deals" },
];
const HIDDEN: Area[] = [
  { href: "/leads", label: "Leads", icon: "leads" },
  { href: "/network", label: "Network", icon: "network" },
  { href: "/activities", label: "Activities", icon: "activities" },
  { href: "/outreach", label: "Outreach", icon: "outreach" },
];
export const WORKSPACE: Area[] = [
  { href: "/import", label: "Import", icon: "import" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/deleted", label: "Recently Deleted", icon: "deleted" },
];
export const PHONE_BAR = ["/dashboard", "/contacts", "/companies", "/todos"];
const ALL = [...MAIN, ...SALES, ...HIDDEN, ...WORKSPACE, { href: "/more", label: "More", icon: "more" }, { href: "/account", label: "My account", icon: "user" }];
export const inArea = (path: string, a: Area) => path === a.href || path.startsWith(a.href + "/");
export const areaFor = (path: string) => ALL.find((a) => inArea(path, a));
