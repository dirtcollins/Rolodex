"use client";
import { useEffect, useId, useState } from "react";
import { Popup, useSave } from "./ui";
import { Icon } from "./icons";
import { AnchoredMenu } from "./anchored-menu";
import { phoneText, today } from "@/lib/format";
import type { Labeled } from "@/lib/data";
import "./contact-actions.css";

// Text · Email · Call use the same labeled buttons on records and lists. A tap opens the
// Mac's Messages, email or calling app; back in Rolodex, a popup offers to log the interaction.
// Someone with two numbers or emails gets a small menu to pick one.

type Kind = "call" | "text" | "email";
export type ReachLog = { contact_id?: number | null; company_id?: number | null; opportunity_id?: number | null };
export type Reachable = { name: string; phones: Labeled[]; emails: Labeled[]; log: ReachLog };
type Pending = { kind: Kind; name: string; log: ReachLog; at: number };

const KEY = "rx-reach";
const WORDS: Record<Kind, { label: string; icon: string; none: string; did: string; ask: string }> = {
  call: { label: "Call", icon: "phone", none: "No phone number", did: "Called", ask: "call" },
  text: { label: "Text", icon: "text", none: "No phone number", did: "Texted", ask: "text" },
  email: { label: "Email", icon: "mail", none: "No email", did: "Emailed", ask: "email" },
};
const hrefFor = (kind: Kind, value: string) =>
  kind === "email" ? "mailto:" + value.trim() : (kind === "call" ? "tel:" : "sms:") + value.replace(/[^\d+]/g, "");

function open(kind: Kind, value: string, who: Reachable) {
  const p: Pending = { kind, name: who.name, log: who.log, at: Date.now() };
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the bar still shows this time */ }
  window.dispatchEvent(new CustomEvent<Pending>("rx-reach", { detail: p }));
  // A plain link click hands tel:, sms: and mailto: to the right app without leaving the page.
  const a = document.createElement("a");
  a.href = hrefFor(kind, value);
  a.click();
}

/** Keep all three actions discoverable, even when the record needs contact details. */
export function ReachButtons({ who, big }: { who: Reachable; big?: boolean }) {
  const [menu, setMenu] = useState<{ kind: Kind; anchor: HTMLElement } | null>(null);
  const menuId = useId();
  const list = (kind: Kind) => (kind === "email" ? who.emails : who.phones).filter((x) => x.value.trim());
  const press = (kind: Kind, e: React.MouseEvent<HTMLButtonElement>) => {
    const items = list(kind);
    if (!items.length) return;
    if (items.length === 1) return open(kind, items[0].value, who);
    setMenu(menu?.kind === kind ? null : { kind, anchor: e.currentTarget });
  };
  return (
    <div className={"reach-btns contact-actions" + (big ? " is-big" : "")} role="group" aria-label={"Contact " + who.name}>
      {(["text", "email", "call"] as Kind[]).map((k) => {
        const n = list(k).length, w = WORDS[k];
        return (
          <button key={k} type="button" className="reach-btn contact-action" disabled={!n}
            title={n ? w.label + " " + who.name : w.none + ". Add contact details using Edit."}
            aria-label={w.label + " " + who.name + (n ? "" : " — " + w.none.toLowerCase())}
            aria-haspopup={n > 1 ? "menu" : undefined}
            aria-expanded={n > 1 ? menu?.kind === k : undefined} aria-controls={menu?.kind === k ? menuId : undefined} onClick={(e) => press(k, e)}>
            <span className="reach-ico"><Icon name={w.icon} /></span><span className="reach-label">{w.label}</span>
          </button>
        );
      })}
      {menu && (
        <AnchoredMenu anchor={menu.anchor} onClose={() => setMenu(null)} className="ctx-menu" matchWidth={false} minWidth={200} role="menu" id={menuId} ariaLabel={WORDS[menu.kind].label + " " + who.name}>
          <div className="ctx-title">{WORDS[menu.kind].label} {who.name}</div>
          {list(menu.kind).map((x, i) => (
            <button key={i} type="button" role="menuitem" onClick={() => { menu.anchor.focus({ preventScroll: true }); setMenu(null); open(menu.kind, x.value, who); }}>
              <Icon name={WORDS[menu.kind].icon} /><span style={{ minWidth: 0 }}>{menu.kind === "email" ? x.value : phoneText(x.value)}{x.label && <small className="muted"> · {x.label}</small>}</span>
            </button>
          ))}
        </AnchoredMenu>
      )}
    </div>
  );
}

/** Mounted once in the shell: after a Call, Text or Email, "Log this call with David?" — one tap puts it in the history. */
export function LogReachPrompt() {
  const { run, busy } = useSave();
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => {
    // Still waiting from before the phone app took over (a phone browser may reload the page): show it again.
    try {
      const was = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Pending | null;
      if (was && Date.now() - was.at < 30 * 60_000) setP(was); else sessionStorage.removeItem(KEY);
    } catch { /* nothing waiting */ }
    const show = (e: Event) => setP((e as CustomEvent<Pending>).detail);
    addEventListener("rx-reach", show);
    return () => removeEventListener("rx-reach", show);
  }, []);
  if (!p) return null;
  const done = () => { setP(null); try { sessionStorage.removeItem(KEY); } catch { /* fine */ } };
  const log = async () => {
    const r = await run("note.add", { ...p.log, kind: p.kind, body: WORDS[p.kind].did, happened_on: today() }, "Logged · " + WORDS[p.kind].label + " with " + p.name);
    if (r.ok) done();
  };
  return (
    <Popup title={"Log this " + p.kind + "?"} onClose={done} guard={false}><div className="form-grid">
      <strong>Log this {WORDS[p.kind].ask} with {p.name}?</strong>
      <span className="grow" />
      <button type="button" className="btn btn-sm" onClick={done}>Not now</button>
      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={log}>Log it</button>
    </div></Popup>
  );
}
