// Light Ops' line icons (24px grid, 1.8 stroke), drawn inline so they take the text color; plus Rolodex's own areas.
const PATHS: Record<string, string> = {
  tag: "M3 3h8l10 10-8 8L3 11zM7 7h.01",
  person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-2a7 5 0 0 1 14 0v2z",
  buildings: "M3 21V3h11v18M14 9h7v12M7 7h.01M10 7h.01M7 11h.01M10 11h.01M7 15h.01M10 15h.01M17 13h.01M17 17h.01M7 21v-3h3v3M2 21h20",
  sliders: "M3 6h3M10 6h11M3 12h10M17 12h4M3 18h3M10 18h11M10 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M17 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M10 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  contacts: "M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M7.5 17.5a4.5 4.5 0 0 1 9 0M2 7h2M2 12h2M2 17h2",
  companies: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4",
  leads: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  pipeline: "M3 4h18l-7 8v6l-4 2v-8z",
  network: "M12 5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M5 24a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M19 24a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M12 5v6M12 11l-6 8.5M12 11l6 8.5",
  activities: "M22 12h-4l-3 9L9 3l-3 9H2",
  outreach: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  todos: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  import: "M12 3v12M7 10l5 5 5-5M5 21h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35",
  close: "M18 6 6 18M6 6l12 12",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  deleted: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  chevron: "m6 9 6 6 6-6",
  back: "M15 18l-6-6 6-6",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  text: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-3.8-.8L3 20.5l1.5-4.3A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  touch: "M20 6 9 17l-5-5",
  merge: "M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21V9a9 9 0 0 0 9 9",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
