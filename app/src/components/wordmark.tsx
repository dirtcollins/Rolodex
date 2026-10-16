/** The supplied Rolodex logo, kept intact. Compact headers show its symbol with an accessible product name. */
export function Wordmark({ small = false, horizontal = false }: { small?: boolean; horizontal?: boolean }) {
 return <span className={"rolodex-brand" + (small ? " is-small" : "") + (horizontal ? " is-horizontal" : "")} aria-label="Rolodex by Collins Creative"><span className="logo-plate"><img src="/rolodex-logo.png" alt="Rolodex" width={1158} height={1358} /></span>{(small || horizontal) && <span className="brand-label">Rolodex</span>}</span>;
}
