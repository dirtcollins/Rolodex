"use client";
import { useRouter } from "next/navigation";
import { useDelete, useOpen, useSave } from "./ui";
import { MoreMenu } from "./merge";
import { StageMenu } from "./stage-menu";
import { Icon } from "./icons";
import { OpportunityForm, type ProjectNames } from "./opportunity-form";
import { OPEN_STAGES, OPP_STAGES, TZ, dayLabel, daysBetween, money, stageLabel, today, when } from "@/lib/format";
import type { Opportunity } from "@/lib/data";

// The client pieces of a project's page (an opportunity, called a project on screen), and the stage pill every
// project list uses.

/** Open stages in blue, Won in green, Lost grey. */
export function StagePill({ stage }: { stage: string }) {
  return <span className={"pill" + (stage === "won" ? " is-ok" : OPEN_STAGES.includes(stage) ? " is-accent" : "")}>{stageLabel(OPP_STAGES, stage)}</span>;
}

/** A moment (ISO) as its Bakersfield day, for dayLabel. */
const ymd = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

/**
 * The top of a project: its stage (changes as soon as it's picked), Won and Lost in one click while it's open, Edit and
 * Delete. A new stage puts it at the top of that column on the board.
 */
export function OpportunityActions({ opp, names }: { opp: Opportunity; names: ProjectNames }) {
  const edit = useOpen();
  const router = useRouter(), del = useDelete(), { run, busy } = useSave();
  const move = (stage: string, say = "Moved to " + stageLabel(OPP_STAGES, stage)) => { if (stage !== opp.stage) void run("opportunity.move", { id: opp.id, stage }, say); };
  return (
    <div className="page-acts opp-acts">
      <StageMenu stage={opp.stage} onChange={move} disabled={busy} label="Stage" />
      <button type="button" className="btn" onClick={edit.show}><Icon name="edit" />Edit</button>
      <MoreMenu items={[{label:"Delete project",icon:"deleted",bad:true,onClick:()=>del("opportunity",opp.id,()=>router.push("/pipeline"))}]} />
      {edit.open && <OpportunityForm opp={opp} names={names} onClose={edit.hide} />}
    </div>
  );
}

/** The side card: what the project is worth, where it stands, and when it should close. */
export function ProjectCard({ opp }: { opp: Opportunity }) {
  const t = today(), since = ymd(opp.stage_at), days = daysBetween(since, t), open = OPEN_STAGES.includes(opp.stage);
  return (
    <div className="card card-pad follow">
      <h3>Project</h3>
      <div className="follow-line"><span>Estimated value</span><b>{opp.value_cents ? money(opp.value_cents) : "Not set"}</b></div>
      <div className="follow-line"><span>Stage</span><b>{stageLabel(OPP_STAGES, opp.stage)}</b></div>
      <div className="follow-line"><span>In this stage since</span><b>{dayLabel(since)}{days > 1 ? " · " + days + " days" : ""}</b></div>
      {open || !opp.closed_at
        ? <div className="follow-line"><span>Expected close</span><b className={open && opp.close_date && opp.close_date < t ? "is-late" : ""}>{dayLabel(opp.close_date) || "Not set"}</b></div>
        : <div className="follow-line"><span>{opp.stage === "won" ? "Won" : opp.stage === "lost" ? "Lost" : "Closed"}</span><b>{dayLabel(ymd(opp.closed_at))}</b></div>}
      <div className="follow-line"><span>Created</span><b>{when(opp.created_at)}</b></div>
    </div>
  );
}
