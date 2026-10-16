/** A confirmation contains only the records the person reviewed, never a fresh "delete everything" query. */
export type DeletedSnapshotItem = { kind: string; id: number; deleted_at: string };
type PurgeTx = { query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> };

const TARGETS = [
  { kind: "note", table: "notes", references: [] },
  { kind: "todo", table: "todos", references: [] },
  { kind: "opportunity", table: "opportunities", references: [["notes", "opportunity_id"], ["todos", "opportunity_id"]] },
  { kind: "campaign", table: "campaigns", references: [["campaign_people", "campaign_id"], ["emails", "campaign_id"]] },
  { kind: "template", table: "email_templates", references: [] },
  { kind: "company", table: "companies", references: [["contact_companies", "company_id"], ["notes", "company_id"], ["todos", "company_id"], ["leads", "company_id"], ["opportunities", "company_id"], ["campaign_people", "company_id"], ["emails", "company_id"]] },
  { kind: "contact", table: "contacts", references: [["contacts", "introduced_by"], ["contact_companies", "contact_id"], ["notes", "contact_id"], ["todos", "contact_id"], ["leads", "contact_id"], ["opportunities", "contact_id"], ["relationships", "contact_id"], ["relationships", "other_id"], ["campaign_people", "contact_id"], ["emails", "contact_id"]] },
] as const;

export const PURGE_KINDS = new Set<string>(TARGETS.map((t) => t.kind));

/** Called inside one transaction. No cascade, unlink, or update of any surviving record. */
export async function purgeDeletedSnapshot(tx: PurgeTx, items: DeletedSnapshotItem[], cutoff: string) {
  const removed = new Set<string>();
  let progress: number;
  do {
    progress = 0;
    for (const target of TARGETS) {
      const candidates = items.filter((item) => item.kind === target.kind && !removed.has(item.kind + ":" + item.id));
      if (!candidates.length) continue;
      const guards = target.references.map(([table, column]) => `and not exists (select 1 from ${table} dependency where dependency.${column} = record.id)`).join("\n");
      // The second-level timestamp matches the list's existing ISO serialization; the exact render cutoff
      // also excludes anything restored and deleted again after the reviewed page was rendered.
      const rows = await tx.query(`delete from ${target.table} record
        using jsonb_to_recordset($1::jsonb) chosen(id bigint, deleted_at timestamptz)
        where record.id = chosen.id and record.deleted_at is not null
          and record.deleted_at <= $2::timestamptz
          and date_trunc('second', record.deleted_at) = chosen.deleted_at
          ${guards}
        returning record.id`, [JSON.stringify(candidates), cutoff]);
      for (const row of rows) removed.add(target.kind + ":" + Number(row.id));
      progress += rows.length;
    }
    // A deleted contact may have introduced another deleted contact. Repeat for the remaining leaves.
  } while (progress);
  return { removed: removed.size, retained: items.length - removed.size };
}
