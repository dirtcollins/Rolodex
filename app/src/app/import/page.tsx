import "./import.css";
import { ImportCsv } from "@/components/import-csv";

export const metadata = { title: "Import · Rolodex" };

// Bring people in from a spreadsheet (Docs, Phase 1: "Contacts, companies, notes, tags, search, and imports").
export default function ImportPage() {
  return (
    <>
      <div className="page-head"><div><h1>Import contacts</h1></div></div>
      <ImportCsv />
    </>
  );
}
