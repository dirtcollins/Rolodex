import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "./config";
import { SCHEMA_FILES } from "./schema-files";

// One way to talk to the database (Light Ops 2.0's lib/db.ts, made smaller). This Mac: a PGlite file in .data/.
// Live: Supabase Postgres (DATABASE_URL) in Rolodex's own schema. Either way database/NNN_*.sql run once, in order.

type Row = Record<string, unknown>;
type Tx = { query(sql: string, params?: unknown[]): Promise<Row[]> };
interface Driver { query(sql: string, params?: unknown[]): Promise<Row[]>; exec(sql: string): Promise<void>; transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }

const DATA_DIR = path.resolve(process.cwd(), process.env.RX_DATA || ".data", "pglite");

async function applySchemaFiles(d: Pick<Driver, "query" | "exec">) {
  await d.exec("create table if not exists schema_files (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await d.query("select name from schema_files")).map((r) => String(r.name)));
  for (const { name, sql } of SCHEMA_FILES) {
    if (done.has(name)) continue;
    await d.exec(sql);
    await d.query("insert into schema_files (name) values ($1)", [name]);
  }
}

async function open(): Promise<Driver> {
  if (config.databaseUrl) {
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(config.schema)) throw new Error("Bad schema name: " + config.schema);
    const { default: postgres } = await import("postgres");
    // Light Ops' settings for Supabase's pooler: few connections, let go when idle, search_path set at connect.
    const sql = postgres(config.databaseUrl, {
      max: 5, idle_timeout: 60, connect_timeout: 15, onnotice: () => {},
      connection: { options: `-c search_path=${config.schema}`, application_name: "rolodex" },
      types: { int8: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) } },
    });
    process.once("SIGTERM", () => { void sql.end({ timeout: 5 }); });
    const d: Driver = {
      query: async (q, p = []) => [...(await sql.unsafe(q, p as never[]))] as Row[],
      exec: async (q) => { await sql.unsafe(q); },
      transaction: (fn) => sql.begin((t) => fn({ query: async (q, p = []) => [...(await t.unsafe(q, p as never[]))] as Row[] })) as never,
    };
    await d.exec(`create schema if not exists ${config.schema}`);
    await applySchemaFiles(d);
    return d;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  const db = new PGlite(DATA_DIR);
  const d: Driver = {
    query: async (q, p) => (await db.query<Row>(q, p)).rows,
    exec: async (q) => { await db.exec(q); },
    transaction: (fn) => db.transaction((t) => fn({ query: async (q, p) => (await t.query<Row>(q, p)).rows })),
  };
  await applySchemaFiles(d);
  return d;
}

// One connection per server process (dev reloads keep it on globalThis).
const g = globalThis as unknown as { __rxDb?: Promise<Driver> };
const driver = () => (g.__rxDb ??= open().catch((e) => { g.__rxDb = undefined; throw e; }));

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await (await driver()).query(sql, params)) as T[];
}
export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null;
}
/** Several writes that go together: all kept, or (it throws) none. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await driver()).transaction(fn);
}
