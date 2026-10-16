import "server-only";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "./config";

// Sending email (Outreach, send-only like Light Ops): through Resend's API, from the person's own address with replies
// to them. A copy without a Resend key (this Mac) writes each email to .data/emails.log instead and calls it a test.

export interface Outgoing { to: string; fromName: string; fromEmail: string; subject: string; text: string }
export type Sent = { status: "sent" | "test"; id: string } | { status: "failed"; error: string };

export async function sendEmail(m: Outgoing): Promise<Sent> {
  if (!config.resendKey || config.emailTest) {
    const dir = path.resolve(process.cwd(), process.env.RX_DATA || ".data");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "emails.log"), JSON.stringify({ at: new Date().toISOString(), ...m }) + "\n");
    return { status: "test", id: "" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + config.resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${m.fromName.replace(/[<>"]/g, "")} <${m.fromEmail}>`, to: [m.to], reply_to: m.fromEmail, subject: m.subject, text: m.text }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "failed", error: String(b?.message ?? "Resend answered " + r.status).slice(0, 300) };
    return { status: "sent", id: String(b?.id ?? "") };
  } catch (e) {
    return { status: "failed", error: (e as Error).message.slice(0, 300) };
  }
}

/** Fills {{first_name}}, {{name}}, {{company}} and {{my_name}} (an unknown one is left as it is, so it's easy to spot). */
export function fill(text: string, v: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, k: string) => (k in v ? v[k] : all));
}
export const looksLikeEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s.trim());
