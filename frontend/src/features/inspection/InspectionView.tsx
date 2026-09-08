import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { api, type ProductStandardResponse } from "@/lib/api";
import { useAsyncTask } from "@/lib/hooks";
import { standardTitle } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Button,
  Callout,
  Chip,
  ConfidenceMeter,
  DefinitionRow,
  LinkButton,
  Mono,
  Panel,
  PanelHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import { Dropzone } from "@/components/Dropzone";
import { ImageInspector } from "./ImageInspector";
import {
  ACTIVE_MOCK_INSPECTION,
  MockDataBanner,
  summariseChecks,
  type MockCheck,
  type MockDeclaration,
} from "@/mocks";

type Phase = "upload" | "analyzing" | "workspace";

const STEPS = [
  "Reading image",
  "Extracting declared values",
  "Matching product",
  "Retrieving applicable standard",
  "Running legal-metrology rule checks",
];

export function InspectionView() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [step, setStep] = useState(0);
  const [selectedDeclaration, setSelectedDeclaration] = useState<string | null>(
    null,
  );
  const [selectedCheck, setSelectedCheck] = useState<string | null>("CHK-02");

  const inspection = ACTIVE_MOCK_INSPECTION;
  const standardTask = useAsyncTask(api.productStandard);

  function start(files: File[]) {
    if (!files.length) return;
    setPhase("analyzing");
    setStep(0);
    // Real call: resolve the applicable standard for the detected product.
    standardTask.run(inspection.product).catch(() => {});
  }

  useEffect(() => {
    if (phase !== "analyzing") return;
    if (step >= STEPS.length) {
      const t = setTimeout(() => setPhase("workspace"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [phase, step]);

  function reset() {
    setPhase("upload");
    setStep(0);
    standardTask.reset();
    setSelectedDeclaration(null);
    setSelectedCheck("CHK-02");
  }

  if (phase === "upload") {
    return (
      <div className="space-y-10">
        <SectionHeading
          kicker="Inspection"
          title="Start an inspection"
          description="Upload one or more images of the product package. MetrIQ extracts the declared values, retrieves the applicable Indian Standard, and runs the legal-metrology rule checks."
        />
        <Dropzone onFiles={start} />
        <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
          {[
            ["1", "Capture", "Front-of-pack and declaration panel"],
            ["2", "Extract & match", "OCR values → product → standard"],
            ["3", "Review", "Officer verifies each finding"],
          ].map(([n, t, d]) => (
            <div key={n} className="bg-raised p-5">
              <Mono muted className="text-[11px]">
                {n}
              </Mono>
              <div className="mt-1.5 text-[13px] font-medium">{t}</div>
              <div className="mt-1 text-[12px] text-ink-faint">{d}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-16">
        <div className="kicker">Analysing package</div>
        <ul className="space-y-3">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-3 text-[13px]">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center border",
                    done
                      ? "border-accent bg-accent text-white"
                      : active
                        ? "border-accent text-accent"
                        : "border-line text-ink-faint",
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : active ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                  )}
                </span>
                <span className={done || active ? "text-ink" : "text-ink-faint"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="h-px w-full bg-line">
          <div
            className="h-px bg-accent transition-[width] duration-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <Workspace
      inspection={inspection}
      standard={standardTask.data}
      standardLoading={standardTask.loading}
      selectedDeclaration={selectedDeclaration}
      setSelectedDeclaration={setSelectedDeclaration}
      selectedCheck={selectedCheck}
      setSelectedCheck={setSelectedCheck}
      onReset={reset}
    />
  );
}

/* ------------------------------------------------------------- workspace --- */

function Workspace({
  inspection,
  standard,
  standardLoading,
  selectedDeclaration,
  setSelectedDeclaration,
  selectedCheck,
  setSelectedCheck,
  onReset,
}: {
  inspection: typeof ACTIVE_MOCK_INSPECTION;
  standard: ProductStandardResponse | null;
  standardLoading: boolean;
  selectedDeclaration: string | null;
  setSelectedDeclaration: (id: string | null) => void;
  selectedCheck: string | null;
  setSelectedCheck: (id: string | null) => void;
  onReset: () => void;
}) {
  const counts = useMemo(
    () => summariseChecks(inspection.checks),
    [inspection.checks],
  );
  const check = inspection.checks.find((c) => c.id === selectedCheck) ?? null;
  const linkedDeclaration =
    inspection.declarations.find((d) => d.id === check?.declarationId) ?? null;

  const apiStandard = standard?.grounded ? standard.results[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          kicker={`Inspection · ${inspection.id}`}
          title={inspection.product}
          className="[&_h1]:text-2xl"
        />
        <Button variant="secondary" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          New inspection
        </Button>
      </div>

      <MockDataBanner scope="This inspection uses a sample package image." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        {/* LEFT — image anchor */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ImageAndSummary
            inspection={inspection}
            apiStandardNumber={apiStandard?.standard_number ?? null}
            standardLoading={standardLoading}
            selectedDeclaration={selectedDeclaration}
            setSelectedDeclaration={setSelectedDeclaration}
          />
        </div>

        {/* RIGHT — inspection information */}
        <div className="space-y-6">
          <InspectionResultCard status={inspection.status} counts={counts} />

          <DeclarationsPanel
            declarations={inspection.declarations}
            selected={selectedDeclaration}
            onSelect={setSelectedDeclaration}
          />

          <RequirementsPanel
            inspection={inspection}
            standard={standard}
            standardLoading={standardLoading}
          />

          <ChecksPanel
            checks={inspection.checks}
            selected={selectedCheck}
            onSelect={(id) => {
              setSelectedCheck(id);
              const c = inspection.checks.find((x) => x.id === id);
              setSelectedDeclaration(c?.declarationId ?? null);
            }}
          />

          {check && (
            <EvidencePanel check={check} declaration={linkedDeclaration} />
          )}

          <div className="flex items-center justify-between border border-line bg-surface px-5 py-4">
            <div className="text-[13px] text-ink-soft">
              Findings need officer verification before sign-off.
            </div>
            <LinkButton to={`/history/${inspection.id}`} size="sm">
              Open officer review
              <ArrowRight className="h-3.5 w-3.5" />
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- left column ---------------------------------------------------------- */

function ImageAndSummary({
  inspection,
  apiStandardNumber,
  standardLoading,
  selectedDeclaration,
  setSelectedDeclaration,
}: {
  inspection: typeof ACTIVE_MOCK_INSPECTION;
  apiStandardNumber: string | null;
  standardLoading: boolean;
  selectedDeclaration: string | null;
  setSelectedDeclaration: (id: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <ImageInspector
        images={inspection.images}
        declarations={inspection.declarations}
        selectedId={selectedDeclaration}
        onSelect={setSelectedDeclaration}
      />
      <Panel flush>
        <dl className="px-5 py-2">
          <DefinitionRow label="Product">{inspection.product}</DefinitionRow>
          <DefinitionRow label="Standard">
            {standardLoading ? (
              <Mono muted>resolving…</Mono>
            ) : apiStandardNumber ? (
              <span className="inline-flex items-center gap-2">
                <Mono>{apiStandardNumber}</Mono>
                <Chip tone="accent">live · /product-standard</Chip>
              </span>
            ) : (
              <Mono muted>{inspection.standardNumber}</Mono>
            )}
          </DefinitionRow>
          <DefinitionRow label="Status">
            <StatusBadge status={inspection.status} size="sm" />
          </DefinitionRow>
          <DefinitionRow label="Confidence" align="start">
            <ConfidenceMeter confidence={inspection.confidence} />
          </DefinitionRow>
        </dl>
      </Panel>
    </div>
  );
}

/* -- result card -------------------------------------------------------- */

function InspectionResultCard({
  status,
  counts,
}: {
  status: "PASS" | "FAIL" | "REVIEW";
  counts: { total: number; passed: number; failed: number; review: number };
}) {
  const message =
    status === "PASS"
      ? "All checks passed. Ready for officer sign-off."
      : status === "FAIL"
        ? "One or more mandatory checks failed."
        : "Evidence requires officer verification before a result can be issued.";

  return (
    <Panel flush>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="kicker">Inspection result</div>
        <Mono muted className="text-[11px]">
          {String(counts.total).padStart(2, "0")} checks
        </Mono>
      </div>
      <div className="px-5 py-5">
        <StatusBadge status={status} />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{message}</p>
        <div className="mt-5 grid grid-cols-3 gap-px border border-line bg-line">
          {[
            ["Passed", counts.passed, "text-pass"],
            ["Failed", counts.failed, "text-fail"],
            ["Review", counts.review, "text-review"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="bg-raised px-3 py-3 text-center">
              <div
                className={cn(
                  "font-mono text-2xl font-semibold tabular-nums",
                  tone as string,
                )}
              >
                {String(value).padStart(2, "0")}
              </div>
              <div className="kicker mt-1">{label as string}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* -- declarations ------------------------------------------------------- */

function DeclarationsPanel({
  declarations,
  selected,
  onSelect,
}: {
  declarations: MockDeclaration[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <Panel flush>
      <PanelHeader title="Detected declarations" meta={`${declarations.length} fields`} />
      <ul>
        {declarations.map((d, i) => {
          const active = d.id === selected;
          return (
            <li key={d.id}>
              <button
                type="button"
                onMouseEnter={() => onSelect(d.id)}
                onFocus={() => onSelect(d.id)}
                onClick={() => onSelect(active ? null : d.id)}
                className={cn(
                  "flex w-full items-start justify-between gap-4 px-5 py-3 text-left transition-colors",
                  i > 0 && "border-t border-line",
                  active ? "bg-accent-soft" : "hover:bg-surface",
                )}
              >
                <div className="min-w-0">
                  <div className="kicker">{d.label}</div>
                  <div className="mt-1 text-[13px] font-medium text-ink">
                    {d.value}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Mono muted className="text-[11px]">
                    {Math.round(d.confidence * 100)}%
                  </Mono>
                  <Mono muted className="mt-0.5 block text-[10px]">
                    {d.id}
                  </Mono>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* -- requirements ------------------------------------------------------- */

function RequirementsPanel({
  inspection,
  standard,
  standardLoading,
}: {
  inspection: typeof ACTIVE_MOCK_INSPECTION;
  standard: ProductStandardResponse | null;
  standardLoading: boolean;
}) {
  return (
    <Panel flush>
      <PanelHeader
        title="Applicable requirements"
        meta={`${inspection.requirements.length} rules`}
      />
      <div className="border-b border-line bg-surface px-5 py-3">
        <div className="kicker mb-1.5">Standard basis · live retrieval</div>
        {standardLoading ? (
          <Mono muted className="text-[12px]">
            querying /product-standard…
          </Mono>
        ) : standard?.grounded ? (
          <div className="space-y-1">
            {standard.results.slice(0, 2).map((r) => (
              <div key={r.id} className="text-[12px]">
                <Mono>{r.standard_number}</Mono>{" "}
                <span className="text-ink-soft">— {standardTitle(r.title)}</span>
                {r.source_url && (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-accent hover:underline"
                  >
                    source →
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Mono muted className="text-[12px]">
            {standard?.note || "no standard resolved"}
          </Mono>
        )}
      </div>
      <ul>
        {inspection.requirements.map((r, i) => (
          <li
            key={r.id}
            className={cn("px-5 py-3", i > 0 && "border-t border-line")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">{r.label}</span>
              <Mono muted className="shrink-0 text-[10px]">
                {r.id}
              </Mono>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {r.detail}
            </p>
            <Mono muted className="mt-1 block text-[11px]">
              {r.basis}
            </Mono>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* -- checks ----------------------------------------------------------- */

function ChecksPanel({
  checks,
  selected,
  onSelect,
}: {
  checks: MockCheck[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel flush>
      <PanelHeader title="Compliance checks" meta={`${checks.length} checks`} />
      <ul>
        {checks.map((c, i) => {
          const active = c.id === selected;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-4 px-5 py-3 text-left transition-colors",
                  i > 0 && "border-t border-line",
                  active ? "bg-accent-soft" : "hover:bg-surface",
                )}
              >
                <StatusBadge status={c.status} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{c.title}</div>
                  <div className="mt-0.5 truncate text-[12px] text-ink-faint">
                    observed <Mono muted>{c.observed}</Mono>
                  </div>
                </div>
                <Mono muted className="shrink-0 text-[10px]">
                  {c.ruleId}
                </Mono>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* -- evidence detail ------------------------------------------------- */

function EvidencePanel({
  check,
  declaration,
}: {
  check: MockCheck;
  declaration: MockDeclaration | null;
}) {
  return (
    <Panel flush>
      <PanelHeader title="Evidence" meta={check.ruleId} />
      <dl className="px-5 py-2">
        <DefinitionRow label="Rule">
          <Mono>{check.ruleId}</Mono> — {check.title}
        </DefinitionRow>
        <DefinitionRow label="Observed">
          <Mono className="text-ink">{check.observed}</Mono>
        </DefinitionRow>
        <DefinitionRow label="Required">{check.expected}</DefinitionRow>
        <DefinitionRow label="Requirement">{check.requirement}</DefinitionRow>
        {declaration ? (
          <>
            <DefinitionRow label="Source">
              Package Image · declaration <Mono>{declaration.id}</Mono>
            </DefinitionRow>
            <DefinitionRow label="Bounding box">
              <Mono muted className="text-[12px]">
                x {declaration.bbox.x.toFixed(0)} · y {declaration.bbox.y.toFixed(0)} ·
                w {declaration.bbox.w.toFixed(0)} · h {declaration.bbox.h.toFixed(0)} (%)
              </Mono>
            </DefinitionRow>
          </>
        ) : (
          <DefinitionRow label="Source">
            <span className="text-ink-faint">
              Not linked to a single declaration — requires manual measurement
            </span>
          </DefinitionRow>
        )}
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
      {check.status === "REVIEW" && (
        <div className="border-t border-line px-5 py-3">
          <Callout tone="abstain">
            This finding is not conclusive. An officer must confirm, modify, or
            reject it in review.
          </Callout>
        </div>
      )}
    </Panel>
  );
}
