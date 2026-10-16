import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listCookie } from "./list-memory";

/**
 * A list opened plain (no ?… in the address) opens with its last sort and filters again (lib/list-memory.ts). Only
 * the list's own `keys` come back; a pick set back to the default was saved as nothing, so nothing comes back.
 */
export async function reopenWithLastPicks(path: string, sp: Record<string, string | string[] | undefined>, keys: string[]) {
  if (Object.keys(sp).length) return;
  let raw = (await cookies()).get(listCookie(path))?.value ?? "";
  // Still percent-encoded when the cookie reader left it as written ("=" arrives as %3D).
  if (!raw.includes("=") && /%[0-9a-f]{2}/i.test(raw)) { try { raw = decodeURIComponent(raw); } catch { raw = ""; } }
  const saved = new URLSearchParams(raw), keep = new URLSearchParams();
  for (const k of keys) { const v = saved.get(k); if (v) keep.set(k, v); }
  if (keep.size) redirect(path + "?" + keep.toString());
}
