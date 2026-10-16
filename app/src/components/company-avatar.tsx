"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

/**
 * Locally stored company artwork. Every company has a generated, branded-in-app
 * fallback, so a newly added company or a failed image never shifts a row.
 */
export function CompanyAvatar({ id, name, large = false, eager = false }: { id: number; name: string; large?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = large ? 104 : 64;
  const label = `${name} logo`;

  return <span className={"avatar company-avatar" + (large ? " lg" : "")} aria-label={label}>
    {failed ? initials(name) : <img
      src={`/company-avatars/${id}-${size}.webp`}
      width={large ? 52 : 32}
      height={large ? 52 : 32}
      alt={label}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />}
  </span>;
}
