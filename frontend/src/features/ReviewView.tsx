import { type ReactNode, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Button,
  Callout,
  ConfidenceMeter,
  DefinitionRow,
  LinkButton,
  Mono,
  Panel,
  PanelHeader,
  SectionHeading,
  StatusBadge,
  TextArea,
} from "@/components/ui";
import {
  MockDataBanner,
  getMockInspection,
  summariseChecks,
  type MockCheck,
  type ReviewState,
} from "@/mocks";
import { formatDate } from "@/lib/format";

interface Decision {
  state: ReviewState;
  note: string;
}

export function ReviewView() {
  const { inspectionId } = useParams();
  const inspection = inspectionId ? getMockInspection(inspectionId) : undefined;

  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [signedOff, setSignedOff] = useState(false);

  const counts = useMemo(
    () => (inspection ? summariseChecks(inspection.checks) : null),
    [inspection],
  );

  if (!inspection || !counts) {
    return (
      <div className="space-y-6 py-10">
        <SectionHeading
          kicker="Officer review"
          title="Inspection not found"
          description="No inspection matches this identifier."
        />
        <LinkButton to="/history">Back to history</LinkButton>
      </div>
    );
  }

  const actioned = inspection.checks.filter((c) => decisions[c.id]).length;
  const allActioned = actioned === inspection.checks.length;

  function decide(id: string, state: ReviewState) {
    setDecisions((d) => ({
      ...d,
      [id]: { state, note: d[id]?.note ?? "" },
    }));
  }
  function note(id: string, value: string) {
    setDecisions((d) => ({
      ...d,
      [id]: { state: d[id]?.state ?? "modified", note: value },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          kicker={`Officer review · ${inspection.id}`}
          title={inspection.product}
          className="[&_h1]:text-2xl"
        />
        <Link to="/history" className="text-[12px] text-accent hover:underline">
          ← All inspections
        </Link>
      </div>

      <MockDataBanner scope="This review acts on placeholder findings; decisions are not persisted." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {inspection.checks.map((c) => (
            <FindingCard
              key={c.id}
              check={c}
              decision={decisions[c.id]}
              onDecide={(s) => decide(c.id, s)}
              onNote={(v) => note(c.id, v)}
            />
          ))}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Panel flush>
            <PanelHeader title="Sign-off" />
            <dl className="px-5 py-2">
              <DefinitionRow label="Inspection">
                <Mono>{inspection.id}</Mono>
              </DefinitionRow>
              <DefinitionRow label="Standard">
                <Mono muted>{inspection.standardNumber}</Mono>
              </DefinitionRow>
              <DefinitionRow label="Created">
                {formatDate(inspection.createdAt)}
              </DefinitionRow>
              <DefinitionRow label="System result">
                <StatusBadge status={inspection.status} size="sm" />
              </DefinitionRow>
              <DefinitionRow label="Progress">
                <Mono>
                  {actioned}/{inspection.checks.length}
                </Mono>{" "}
                findings actioned
              </DefinitionRow>
            </dl>
            <div className="border-t border-line px-5 py-4">
              <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{
                    width: `${(actioned / inspection.checks.length) * 100}%`,
                  }}
                />
              </div>
              {signedOff ? (
                <Callout tone="info" title="Report signed off">
                  The officer verified all findings. (Prototype — not persisted.)
                </Callout>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={!allActioned}
                    onClick={() => setSignedOff(true)}
                  >
                    Sign off inspection report
                  </Button>
                  {!allActioned && (
                    <p className="mt-2 text-[11px] text-ink-faint">
                      Action every finding to enable sign-off.
                    </p>
                  )}
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- finding card --- */

function FindingCard({
  check,
  decision,
  onDecide,
  onNote,
}: {
  check: MockCheck;
  decision: Decision | undefined;
  onDecide: (s: ReviewState) => void;
  onNote: (v: string) => void;
}) {
  const state = decision?.state;
  return (
    <Panel flush>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={check.status} size="sm" />
          <span className="text-[13px] font-medium">{check.title}</span>
        </div>
        <Mono muted className="text-[11px]">
          {check.ruleId}
        </Mono>
      </div>

      <dl className="px-5 py-2">
        <DefinitionRow label="Observed">
          <Mono>{check.observed}</Mono>
        </DefinitionRow>
        <DefinitionRow label="Required">{check.expected}</DefinitionRow>
        <DefinitionRow label="Confidence" align="start">
          <ConfidenceMeter
            confidence={
              check.confidence >= 0.9
                ? "high"
                : check.confidence >= 0.75
                  ? "medium"
                  : "low"
            }
          />
        </DefinitionRow>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
        <DecisionButton
          active={state === "accepted"}
          tone="pass"
          onClick={() => onDecide("accepted")}
          icon={<Check className="h-3.5 w-3.5" />}
        >
          Accept
        </DecisionButton>
        <DecisionButton
          active={state === "modified"}
          tone="review"
          onClick={() => onDecide("modified")}
          icon={<Pencil className="h-3.5 w-3.5" />}
        >
          Modify
        </DecisionButton>
        <DecisionButton
          active={state === "rejected"}
          tone="fail"
          onClick={() => onDecide("rejected")}
          icon={<X className="h-3.5 w-3.5" />}
        >
          Reject
        </DecisionButton>
      </div>

      {state === "modified" && (
        <div className="border-t border-line px-5 py-3">
          <label className="kicker mb-1.5 block">Officer note</label>
          <TextArea
            rows={2}
            value={decision?.note ?? ""}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Record the corrected observation or the reason for modification…"
          />
        </div>
      )}
    </Panel>
  );
}

function DecisionButton({
  active,
  tone,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  tone: "pass" | "review" | "fail";
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const toneCls =
    tone === "pass"
      ? "border-pass-line text-pass bg-pass-soft"
      : tone === "review"
        ? "border-review-line text-review bg-review-soft"
        : "border-fail-line text-fail bg-fail-soft";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? toneCls
          : "border-line-strong text-ink-soft hover:border-ink hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
