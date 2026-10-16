import { deletedDirectory, deletedSnapshot } from "@/lib/deleted-directory";
import { DeleteAllButton, DeletedList } from "@/components/deleted-parts";

export const metadata = { title: "Recently Deleted · Rolodex" };

// Deleting never loses anything at once: it lands here for 30 days, and Restore puts it back as it was.
export default async function DeletedPage() {
  const cutoff = new Date().toISOString();
  const [initial, items] = await Promise.all([deletedDirectory(1, cutoff), deletedSnapshot(cutoff)]);
  return (
    <>
      <div className="page-head"><div><h1>Recently Deleted</h1></div><div className="page-acts"><DeleteAllButton items={items} cutoff={cutoff} /></div></div>
      {!items.length ? <div className="card empty"><strong>Nothing deleted lately.</strong>Anything you delete shows here for 30 days, so you can bring it back.</div> : (
        <DeletedList initial={initial} total={items.length} />
      )}
    </>
  );
}
