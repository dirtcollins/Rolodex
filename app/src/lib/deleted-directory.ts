import "server-only";
import { query } from "./db";
import type { DeletedSnapshotItem } from "./purge-deleted";

const BATCH = 50;
const SOURCES = [
  ["contact", "contacts", "trim(first_name || ' ' || last_name)", "job_title"],
  ["company", "companies", "name", "industry"], ["note", "notes", "left(body, 80)", "''"],
  ["todo", "todos", "title", "''"], ["opportunity", "opportunities", "name", "''"],
  ["campaign", "campaigns", "name", "''"], ["template", "email_templates", "name", "subject"],
] as const;
const window = "deleted_at > $1::timestamptz - interval '30 days' and deleted_at <= $1::timestamptz";
const stamp = `to_char(deleted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const rows = SOURCES.map(([kind, table, title, sub]) => `select '${kind}' as kind, id::int, ${title} as title, ${sub} as sub, ${stamp} as deleted_at, deleted_at as ordered_at from ${table} where ${window}`).join(" union all ");
const snapshots = SOURCES.map(([kind, table]) => `select '${kind}' as kind, id::int, ${stamp} as deleted_at from ${table} where ${window}`).join(" union all ");

export type DeletedRow = DeletedSnapshotItem & { title: string; sub: string };
export type DeletedBatch = { items: DeletedRow[]; page: number; more: boolean; cutoff: string };

/** Names and previews are bounded to one batch; the delete-all snapshot contains only IDs and timestamps. */
export async function deletedDirectory(page = 1, cutoff = new Date().toISOString()): Promise<DeletedBatch> {
  const found = await query<DeletedRow>(`select kind, id, title, sub, deleted_at from (${rows}) deleted
    order by ordered_at desc, kind, id desc limit $2 offset $3`, [cutoff, BATCH + 1, (page - 1) * BATCH]);
  return { items: found.slice(0, BATCH), page, more: found.length > BATCH, cutoff };
}
export async function deletedSnapshot(cutoff: string): Promise<DeletedSnapshotItem[]> {
  return query<DeletedSnapshotItem>(snapshots, [cutoff]);
}
