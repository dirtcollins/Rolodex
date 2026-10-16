import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { one, query } from "./db";
import { config, localDb } from "./config";

// Signing in, Light Ops' way (lib/auth.ts there): salted scrypt passwords, a signed httpOnly cookie for 30 days that
// carries the account and its session version (a new password or turning an account off signs it out everywhere),
// 8 tries per 15 minutes per IP. One users table for owners and salespeople.

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "rolodex";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 12;

export type Role = "owner" | "sales";
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", sales: "Sales" };
export interface User { id: number; name: string; email: string; phone: string; role: Role; active: boolean; password_hash: string; session_version: number }
export interface Session { user: User; noLogin: boolean }

const g = globalThis as unknown as { __rxKey?: string };
function key(): string {
  const s = config.authSecret;
  if (s) {
    if (s.length < 32) throw new Error("RX_AUTH_SECRET must be at least 32 random characters.");
    return createHmac("sha256", s).update("rolodex-auth:v1").digest("hex");
  }
  if (localDb) return (g.__rxKey ??= randomBytes(32).toString("hex"));
  throw new Error("RX_AUTH_SECRET is missing.");
}
const sign = (payload: string) => createHmac("sha256", key()).update("session|" + payload).digest("base64url");
function same(a: string, b: string) {
  const x = createHmac("sha256", "cmp").update(a).digest(), y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

export function newSessionValue(user: User): string {
  const payload = Buffer.from(JSON.stringify({ i: Math.floor(Date.now() / 1000), u: user.id, v: user.session_version })).toString("base64url");
  return payload + "." + sign(payload);
}
function readSessionValue(value: string | undefined): { user: number; version: number } | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !same(sign(payload), mac)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!(Date.now() / 1000 - Number(d.i) <= SESSION_DAYS * 86400)) return null;
    return Number.isSafeInteger(d.u) && Number.isSafeInteger(d.v) ? { user: d.u, version: d.v } : null;
  } catch { return null; }
}
export const cookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });

const userRow = (r: Record<string, unknown> | null): User | null => r && {
  id: Number(r.id), name: String(r.name), email: String(r.email), phone: String(r.phone ?? ""), role: r.role === "owner" ? "owner" : "sales",
  active: r.active === true, password_hash: String(r.password_hash ?? ""), session_version: Number(r.session_version) || 1,
};
export const userById = async (id: number) => userRow(await one("select * from users where id = $1", [id]));
export const userByEmail = async (email: string) => userRow(await one("select * from users where lower(email) = lower($1)", [email.trim()]));
export const allUsers = async () => (await query("select * from users order by active desc, role, lower(name)")).map((r) => userRow(r)!);

let seeded: Promise<void> | null = null;
/** The first owner, once, when nobody exists yet (RX_OWNER_*). */
export function ensureOwner(): Promise<void> {
  return (seeded ??= (async () => {
    if (await one("select 1 from users limit 1")) return;
    await query("insert into users (name, email, role, password_hash) values ($1, $2, 'owner', $3) on conflict do nothing",
      [config.ownerName, config.ownerEmail.toLowerCase(), config.ownerPassword ? await hashPassword(config.ownerPassword) : ""]);
  })().catch((e) => { seeded = null; throw e; }));
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);
export function clientIp(h: Headers): string {
  const f = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "").trim();
  return f ? f.split(",")[0].trim() : (h.get("x-real-ip") ?? "").trim() || "unknown";
}
const isLocal = (h: Headers) => LOOPBACK.has((h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "")) && [...LOOPBACK, "unknown"].includes(clientIp(h));

export async function sessionFrom(h: Headers, cookie: string | undefined): Promise<Session | null> {
  await ensureOwner();
  const s = readSessionValue(cookie);
  if (s) {
    const u = await userById(s.user);
    if (u && u.active && u.password_hash && u.session_version === s.version) return { user: u, noLogin: false };
  }
  if (config.noLogin && localDb && isLocal(h)) {
    const owner = userRow(await one("select * from users where role = 'owner' order by id limit 1"));
    if (owner) return { user: owner, noLogin: true };
  }
  return null;
}

/** The signed-in person for pages, actions and routes (once per request). */
export const session = cache(async (): Promise<Session | null> => {
  const { cookies, headers } = await import("next/headers");
  return sessionFrom(await headers(), (await cookies()).get(SESSION_COOKIE)?.value);
});

export function safeNext(next: string | null | undefined): string {
  const n = String(next ?? "");
  return /^\/[A-Za-z0-9]/.test(n) && !n.startsWith("//") && !n.includes("\\") && !n.startsWith("/login") ? n : "/dashboard";
}

/** A new cookie value when the email and password match, else null ("short": a first password under MIN_PASSWORD). */
export async function signIn(email: string, password: string, h: Headers): Promise<string | null | "short"> {
  await ensureOwner();
  if (!(await takeRateSlot("login|" + clientIp(h), 8, 900))) return null;
  const u = await userByEmail(email);
  // An account with no password yet: the first password typed on this Mac becomes its password.
  if (u && u.active && !u.password_hash && isLocal(h)) {
    if (password.length < MIN_PASSWORD) return "short";
    await query("update users set password_hash = $1, session_version = session_version + 1 where id = $2 and password_hash = ''", [await hashPassword(password), u.id]);
    const set = await userById(u.id);
    return set && set.password_hash ? newSessionValue(set) : null;
  }
  // A password is always checked, so a wrong email takes as long.
  const ok = await verifyPassword(password, u?.password_hash || "scrypt$" + "A".repeat(32) + "$" + "A".repeat(86));
  return ok && u && u.active && u.password_hash ? newSessionValue(u) : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24);
  return "scrypt$" + salt.toString("base64url") + "$" + ((await scrypt(password, salt, 64)) as Buffer).toString("base64url");
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, s, h] = stored.split("$");
  if (kind !== "scrypt" || !s || !h) return false;
  try {
    const salt = Buffer.from(s, "base64url"), expected = Buffer.from(h, "base64url");
    if (salt.length !== 24 || expected.length !== 64) return false;
    return timingSafeEqual((await scrypt(password, salt, 64)) as Buffer, expected);
  } catch { return false; }
}

export function accountProblem(i: { name: string; email: string; password?: string }): string {
  if (i.name.trim().length < 2 || i.name.length > 80) return "Enter a name between 2 and 80 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return "Enter a valid email address.";
  if (i.password !== undefined && i.password !== "" && i.password.length < MIN_PASSWORD) return "Use at least " + MIN_PASSWORD + " characters for the password.";
  return "";
}

/** False when the bucket already had `limit` hits in the last `windowSeconds`. */
async function takeRateSlot(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const k = createHash("sha256").update(bucket).digest("hex");
  try {
    if (Math.random() < 0.02) await query("delete from rate_hits where at < now() - interval '2 days'");
    const rows = await query(`with c as (select count(*) as n from rate_hits where bucket = $1 and at > now() - ($2::int * interval '1 second'))
      insert into rate_hits (bucket) select $1 from c where c.n < $3 returning id`, [k, windowSeconds, limit]);
    return rows.length > 0;
  } catch { return true; }
}
