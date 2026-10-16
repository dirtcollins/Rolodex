"use client";

import { useState } from "react";
import { initials } from "@/lib/format";
import assets from "../../public/contact-avatars/manifest.json";

type ContactPhoto = {
  src64: string;
  src104: string;
  /** Kept in the build artifact so an image is only rendered after provenance is recorded. */
  permissionBasis: "contact_consent" | "copyright_license" | "user_provided" | "owner_authorized";
  matchBasis: string;
};

const photos = assets as Record<string, ContactPhoto>;

/**
 * Locally stored and verified contact artwork. A photo never hotlinks to LinkedIn,
 * Facebook, or another external profile; without an audited local asset, initials stay visible.
 */
export function ContactAvatar({ id, name, large = false, eager = false }: { id: number; name: string; large?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = photos[String(id)];
  const label = `${name} profile photo`;
  const src = photo && (large ? photo.src104 : photo.src64);

  return <span className={"avatar contact-avatar" + (large ? " lg" : "")} aria-label={src ? label : `${name} initials`}>
    {failed || !src ? initials(name) : <img
      src={src}
      width={large ? 52 : 32}
      height={large ? 52 : 32}
      alt={label}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />}
  </span>;
}
