import { initials } from "@/lib/format";

const BRENDAN_COLLINS = "brendan collins";

/**
 * Account avatars are stored locally so the shell never depends on an external
 * profile image. Keep initials for team members who have not supplied a photo.
 */
export function UserAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const hasPhoto = name.trim().toLocaleLowerCase() === BRENDAN_COLLINS;
  const size = large ? 56 : 37;

  return <span className={"avatar user-avatar" + (large ? " lg" : "")} aria-label={hasPhoto ? `${name} profile photo` : `${name} initials`}>
    {hasPhoto ? <img
      src={`/user-avatars/brendan-collins-${large ? 112 : 74}.webp`}
      width={size}
      height={size}
      alt=""
      decoding="async"
    /> : initials(name)}
  </span>;
}
