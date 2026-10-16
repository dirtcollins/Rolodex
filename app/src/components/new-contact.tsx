"use client";
import { ContactForm, type Pickers } from "./contact-form";
import { useOpen } from "./ui";
import { Icon } from "./icons";

export function NewContact({ pickers, company, label = "New contact", primary = true }: { pickers: Pickers; company?: { id: number; name: string }; label?: string; primary?: boolean }) {
  const o = useOpen();
  return <><button type="button" className={"btn" + (primary ? " btn-primary" : "")} onClick={o.show}><Icon name="plus" />{label}</button>{o.open && <ContactForm pickers={pickers} company={company} onClose={o.hide} />}</>;
}
