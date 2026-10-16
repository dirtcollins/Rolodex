"use client";
import { useId, useState } from "react";
import { AnchoredMenu } from "./anchored-menu";
import { Icon } from "./icons";
import { OPP_STAGES, stageLabel } from "@/lib/format";
import "./stage-menu.css";

const STAGE_ICONS: Record<string, string> = {
  lead: "leads", meeting: "calendar", proposal_sent: "mail", negotiating: "text", won: "check", lost: "close",
};

/** The same stage choices on a pipeline card and a project's full page. */
export function StageMenu({ stage, onChange, disabled = false, label = "Change project stage", compact = false }: {
  stage: string; onChange: (stage: string) => void; disabled?: boolean; label?: string; compact?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return <>
    <button type="button" className={compact ? "icon-btn stage-menu-trigger" : "btn stage-menu-trigger"}
      disabled={disabled} aria-busy={disabled} aria-haspopup="menu" aria-expanded={!!anchor} aria-controls={anchor ? id : undefined}
      aria-label={label} title={label} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
      <Icon name={compact ? "more" : STAGE_ICONS[stage] ?? "pipeline"} />
      {!compact && <><span>{stageLabel(OPP_STAGES, stage)}</span><Icon name="chevron" /></>}
    </button>
    {anchor && <AnchoredMenu anchor={anchor} onClose={() => setAnchor(null)} className="ctx-menu stage-menu" matchWidth={!compact} minWidth={compact ? 220 : 180} role="menu" id={id} ariaLabel={label}>
      {OPP_STAGES.map(([value, name]) => <button key={value} type="button" role="menuitemradio" aria-checked={stage === value}
        className={stage === value ? "is-active" : undefined} onClick={() => { anchor.focus({ preventScroll: true }); setAnchor(null); if (value !== stage && !disabled) { anchor.dispatchEvent(new CustomEvent("rx-draft-change", { bubbles: true })); onChange(value); } }}>
        <Icon name={STAGE_ICONS[value]} /><span style={{ flex: 1 }}>{name}</span>{stage === value && <Icon name="check" />}
      </button>)}
    </AnchoredMenu>}
  </>;
}
