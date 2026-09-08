import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  ApiError,
  api,
  type Declaration,
  type InspectionAnalysis,
  type OcrRegion,
} from "@/lib/api";
import { useAsyncTask } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import {
  Button,
  Callout,
  DefinitionRow,
  InlineLoading,
  Mono,
  PageHeader,
  Panel,
  PanelHeader,
  SectionHeading,
} from "@/components/ui";
import { Dropzone } from "@/components/Dropzone";
import {
  Annotation,
  BlueprintField,
  Bracket,
  Motif,
  PhotoFragment,
  Ticks,
} from "@/components/decor";
import { ImageInspector } from "./ImageInspector";

type Phase = "upload" | "analyzing" | "workspace" | "error";

export function InspectionView() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const task = useAsyncTask(api.analyzeInspection);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function start(files: File[]) {
    const file = files[0];
    if (!file) return;

    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setImageUrl(url);
    setSelectedRegion(null);
    setPhase("analyzing");

    task
      .run(file)
      .then(() => setPhase("workspace"))
      .catch(() => setPhase("error"));
  }

  function reset() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setImageUrl(null);
    setSelectedRegion(null);
    task.reset();
    setPhase("upload");
  }

  /* ------------------------------------------------------------- upload --- */

  if (phase === "upload") {
    return (
      <div className="space-y-12">
        <PageHeader
          eyebrow="Inspection"
          title="Start an inspection"
          lead="Upload an image of the product package. MetrIQ runs local OCR on the declaration panel and returns the detected text with its bounding boxes and confidence. Declaration extraction and the legal-metrology rule checks come in later phases."
          annotation={<Annotation lead="right">Capture → OCR → Review</Annotation>}
        />

        <ol className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {[
            ["01", "Capture", "Package & declaration panel"],
            ["02", "OCR", "Local PaddleOCR text detection"],
            ["03", "Extract", "Product → Indian Standard (next phase)"],
            ["04", "Review", "Officer verifies each finding (next phase)"],
          ].map(([n, t, d], i) => (
            <li key={n} className="relative bg-raised p-5">
              <div className="flex items-center gap-2">
                <Mono className="text-[11px] text-accent">{n}</Mono>
                {i < 3 && (
                  <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />
                )}
              </div>
              <div className="mt-3 text-[13px] font-semibold">{t}</div>
              <div className="mt-1 text-[12px] leading-snug text-ink-faint">{d}</div>
            </li>
          ))}
        </ol>

        <div className="relative">
          <Annotation className="absolute -top-6 left-0 hidden sm:inline-flex">
            Place evidence
          </Annotation>
          <div className="relative overflow-hidden border border-line-strong bg-surface">
            <BlueprintField fade="radial" variant="dots" />
            <Motif
              name="fingerprint"
              className="absolute left-1/2 top-1/2 h-[130%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
            />
            <PhotoFragment
              src="/blue-botanical.png"
              className="absolute inset-y-0 left-0 hidden w-12 object-cover object-[8%_45%] opacity-30 md:block lg:w-16"
            />
            <PhotoFragment
              src="/blue-botanical.png"
              className="absolute inset-y-0 right-0 hidden w-12 scale-x-[-1] object-cover object-[8%_45%] opacity-30 md:block lg:w-16"
            />
            <Ticks edge="top" count={13} className="opacity-60" />
            <Ticks edge="bottom" count={13} className="opacity-60" />
            <div className="relative [&>div]:!border-0 [&>div]:!bg-transparent">
              <Dropzone onFiles={start} />
            </div>
          </div>
          <Bracket tone="accent" className="-inset-2" />
          <Annotation className="absolute -bottom-6 right-0">
            PNG · JPG · WEBP
          </Annotation>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- analyzing --- */

  if (phase === "analyzing") {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-16">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Analysing package</span>
          <span className="h-px w-8 bg-accent/40" aria-hidden />
        </div>
        {imageUrl && (
          <div className="relative border border-line bg-raised">
            <img
              src={imageUrl}
              alt="Uploaded package"
              className="block max-h-[320px] w-full object-contain opacity-80"
            />
            <Bracket tone="accent" />
          </div>
        )}
        <div className="flex items-center gap-3 text-[13px] text-ink-soft">
          <InlineLoading label="Running local OCR" />
          <span>· first run loads the model, this can take a few seconds</span>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------- error --- */

  if (phase === "error") {
    const err = task.error;
    const apiErr = err instanceof ApiError ? err : null;
    const msg =
      apiErr?.detail ??
      (err instanceof Error ? err.message : "Something went wrong during analysis.");
    return (
      <div className="mx-auto max-w-lg space-y-6 py-16">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Inspection</span>
          <span className="h-px w-8 bg-accent/40" aria-hidden />
        </div>
        <Callout tone="abstain" title="Could not analyse this image">
          {msg}
        </Callout>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          No inspection result is shown — MetrIQ never substitutes placeholder
          data for a failed analysis. Try a sharper, straight-on photo of the
          declaration panel, or a different image.
        </p>
        <Button variant="secondary" size="sm" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Try another image
        </Button>
      </div>
    );
  }

  /* ---------------------------------------------------------- workspace --- */

  const result = task.data;
  if (!result || !imageUrl) {
    // Defensive — should not happen; recover to upload.
    return (
      <div className="py-16">
        <Button variant="secondary" size="sm" onClick={reset}>
          Restart
        </Button>
      </div>
    );
  }

  return (
    <Workspace
      result={result}
      imageUrl={imageUrl}
      selectedRegion={selectedRegion}
      setSelectedRegion={setSelectedRegion}
      onReset={reset}
    />
  );
}

/* ------------------------------------------------------------- workspace --- */

function Workspace({
  result,
  imageUrl,
  selectedRegion,
  setSelectedRegion,
  onReset,
}: {
  result: InspectionAnalysis;
  imageUrl: string;
  selectedRegion: string | null;
  setSelectedRegion: (id: string | null) => void;
  onReset: () => void;
}) {
  const { image, quality, ocr, declaration_stage, classification, standard_match } =
    result;
  const region = ocr.regions.find((r) => r.id === selectedRegion) ?? null;
  const declForRegion = selectedRegion
    ? declaration_stage.declarations.find(
        (d) => d.source_region_id === selectedRegion,
      ) ?? null
    : null;

  const productLabel =
    classification.status === "CLASSIFIED" && classification.normalized_product
      ? classification.normalized_product
      : "Needs review";
  const standardLabel =
    standard_match.status === "MATCHED" && standard_match.standard
      ? standard_match.standard.number
      : "Needs review";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          kicker={`Inspection · ${result.inspection_id}`}
          title={image.filename}
          className="[&_h1]:text-2xl [&_h1]:break-all"
        />
        <Button variant="secondary" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          New inspection
        </Button>
      </div>

      <Callout>
        <span className="font-medium">Live pipeline.</span> Local OCR, then
        deterministic declaration extraction, product classification and a
        lookup against a verified Indian Standards registry. Every value traces
        back to the OCR region it came from. The legal-metrology PASS/FAIL rule
        engine is the next phase; unresolved stages read “review”, never a guess.
      </Callout>

      {result.notes.length > 0 && (
        <Callout tone="abstain" title="Notes on this image">
          <ul className="list-disc space-y-1 pl-4">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        {/* LEFT — image + summary */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ImageInspector
            src={imageUrl}
            label={`Package image · ${image.width}×${image.height}`}
            width={image.width}
            height={image.height}
            regions={ocr.regions}
            selectedId={selectedRegion}
            onSelect={setSelectedRegion}
          />
          <Panel flush>
            <dl className="px-5 py-2">
              <DefinitionRow label="OCR engine">
                <Mono muted className="text-[11px]">
                  {ocr.engine}
                </Mono>
              </DefinitionRow>
              <DefinitionRow label="Regions">
                <Mono>{String(ocr.region_count).padStart(2, "0")}</Mono>
              </DefinitionRow>
              <DefinitionRow label="Mean confidence">
                <Mono>
                  {ocr.region_count
                    ? `${Math.round(ocr.mean_confidence * 100)}%`
                    : "—"}
                </Mono>
              </DefinitionRow>
              <DefinitionRow label="OCR time">
                <Mono muted>{ocr.duration_ms} ms</Mono>
              </DefinitionRow>
              <DefinitionRow label="Product">
                <span
                  className={cn(
                    classification.status === "CLASSIFIED"
                      ? "text-ink"
                      : "text-review",
                  )}
                >
                  {productLabel}
                </span>
              </DefinitionRow>
              <DefinitionRow label="Standard">
                <span
                  className={cn(
                    standard_match.status === "MATCHED" ? "text-ink" : "text-review",
                  )}
                >
                  {standardLabel}
                </span>
              </DefinitionRow>
            </dl>
          </Panel>
        </div>

        {/* RIGHT — OCR + pipeline results */}
        <div className="space-y-6">
          <QualityPanel quality={quality} />
          <DeclarationsPanel
            stage={declaration_stage}
            selected={selectedRegion}
            onSelect={setSelectedRegion}
          />
          <StandardPanel
            match={standard_match}
            classification={classification}
          />
          <RegionsPanel
            regions={ocr.regions}
            selected={selectedRegion}
            onSelect={setSelectedRegion}
          />
          {region && (
            <RegionDetail
              region={region}
              declaration={declForRegion}
              imageW={image.width}
              imageH={image.height}
            />
          )}
          <RawTextPanel text={ocr.text} />
          <DownstreamPanel result={result} />
        </div>
      </div>
    </div>
  );
}

/* -- panels ------------------------------------------------------------- */

function QualityPanel({
  quality,
}: {
  quality: InspectionAnalysis["quality"];
}) {
  return (
    <Panel flush>
      <PanelHeader
        title="Image quality"
        meta={quality.is_low_quality ? "flagged" : "ok"}
      />
      <dl className="grid grid-cols-3 gap-px border-b border-line bg-line">
        {[
          ["Sharpness", quality.blur_score.toFixed(0)],
          ["Brightness", quality.brightness.toFixed(0)],
          ["Contrast", quality.contrast.toFixed(0)],
        ].map(([k, v]) => (
          <div key={k} className="bg-raised px-3 py-3 text-center">
            <div className="font-mono text-xl font-semibold tabular-nums">{v}</div>
            <div className="kicker mt-1">{k}</div>
          </div>
        ))}
      </dl>
      {quality.notes.length > 0 ? (
        <ul className="space-y-1 px-5 py-3 text-[12px] text-review">
          {quality.notes.map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-3 text-[12px] text-ink-faint">
          No quality issues detected.
        </p>
      )}
    </Panel>
  );
}

function RegionsPanel({
  regions,
  selected,
  onSelect,
}: {
  regions: OcrRegion[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <Panel flush>
      <PanelHeader
        title="Detected text regions"
        meta={`${regions.length} ${regions.length === 1 ? "region" : "regions"}`}
      />
      {regions.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-ink-soft">
          OCR found no legible text in this image.
        </p>
      ) : (
        <ul>
          {regions.map((r, i) => {
            const active = r.id === selected;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseEnter={() => onSelect(r.id)}
                  onFocus={() => onSelect(r.id)}
                  onClick={() => onSelect(active ? null : r.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-4 px-5 py-3 text-left transition-colors",
                    i > 0 && "border-t border-line",
                    active ? "bg-accent-soft" : "hover:bg-surface",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">
                      {r.text}
                    </div>
                    <Mono muted className="mt-0.5 block text-[10px]">
                      {r.id} · box [{r.bbox.join(", ")}]
                    </Mono>
                  </div>
                  <Mono muted className="shrink-0 text-[11px]">
                    {Math.round(r.confidence * 100)}%
                  </Mono>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RegionDetail({
  region,
  declaration,
  imageW,
  imageH,
}: {
  region: OcrRegion;
  declaration: Declaration | null;
  imageW: number;
  imageH: number;
}) {
  const [x1, y1, x2, y2] = region.bbox;
  return (
    <Panel flush>
      <PanelHeader title="Region evidence" meta={region.id} />
      <dl className="px-5 py-2">
        <DefinitionRow label="Raw text">
          <Mono className="text-ink">{region.text}</Mono>
        </DefinitionRow>
        <DefinitionRow label="Confidence">
          <Mono>{(region.confidence * 100).toFixed(1)}%</Mono>
        </DefinitionRow>
        <DefinitionRow label="Bounding box">
          <Mono muted className="text-[12px]">
            x {x1}–{x2} · y {y1}–{y2} px (of {imageW}×{imageH})
          </Mono>
        </DefinitionRow>
        <DefinitionRow label="Polygon">
          <Mono muted className="text-[11px]">
            {region.polygon.map((p) => `(${p[0]},${p[1]})`).join(" ")}
          </Mono>
        </DefinitionRow>
        <DefinitionRow label="Interpretation">
          {declaration ? (
            <span className="text-ink">
              <span className="font-medium">{declaration.label}:</span>{" "}
              {declaration.value}
              <Mono muted className="mt-0.5 block text-[10px] uppercase tracking-[0.1em]">
                {declaration.method} · extracted declaration
              </Mono>
            </span>
          ) : (
            <span className="text-ink-faint">
              Not part of an extracted declaration.
            </span>
          )}
        </DefinitionRow>
      </dl>
    </Panel>
  );
}

/* -- pipeline panels -------------------------------------------------- */

function stageTone(status: string): string {
  switch (status) {
    case "COMPLETED":
    case "CLASSIFIED":
    case "MATCHED":
      return "text-accent";
    case "PARTIAL":
    case "REVIEW":
      return "text-review";
    case "NEXT":
      return "text-ink-soft";
    default:
      return "text-ink-faint";
  }
}

function methodTone(method: Declaration["method"]): string {
  return method === "heuristic" ? "text-ink-faint" : "text-ink-soft";
}

function DeclarationsPanel({
  stage,
  selected,
  onSelect,
}: {
  stage: InspectionAnalysis["declaration_stage"];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <Panel flush>
      <PanelHeader
        title="Declared fields"
        meta={
          <span className={stageTone(stage.status)}>
            {stage.status}
            {stage.principal_display_panel ? " · PDP" : ""}
          </span>
        }
      />
      {stage.declarations.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-ink-soft">
          No declaration fields could be read from the OCR text. This inspection
          needs officer review — no values are shown.
        </p>
      ) : (
        <ul>
          {stage.declarations.map((d, i) => {
            const active = d.source_region_id === selected && selected !== null;
            return (
              <li key={d.field}>
                <button
                  type="button"
                  onMouseEnter={() =>
                    d.source_region_id && onSelect(d.source_region_id)
                  }
                  onFocus={() =>
                    d.source_region_id && onSelect(d.source_region_id)
                  }
                  onClick={() =>
                    onSelect(active ? null : d.source_region_id ?? null)
                  }
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
                    <Mono muted className="mt-0.5 block text-[10px]">
                      {d.source_region_id ?? "—"} ·{" "}
                      <span className={methodTone(d.method)}>{d.method}</span>
                      {" · OCR "}
                      {Math.round(d.ocr_confidence * 100)}%
                    </Mono>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {stage.missing_fields.length > 0 && (
        <p className="border-t border-line px-5 py-3 text-[11px] text-ink-faint">
          Not found on this panel: {stage.missing_fields.join(", ")}
        </p>
      )}
    </Panel>
  );
}

function StandardPanel({
  match,
  classification,
}: {
  match: InspectionAnalysis["standard_match"];
  classification: InspectionAnalysis["classification"];
}) {
  const matched = match.status === "MATCHED" && match.standard;

  return (
    <Panel flush>
      <PanelHeader
        title="Applicable Indian Standard"
        meta={
          <span className={stageTone(match.status)}>{match.status}</span>
        }
      />
      {matched ? (
        <dl className="px-5 py-2">
          <DefinitionRow label="Standard">
            <Mono className="text-[13px] font-semibold text-ink">
              {match.standard!.number}
            </Mono>
          </DefinitionRow>
          <DefinitionRow label="Title">
            <span className="text-ink">{match.standard!.title}</span>
          </DefinitionRow>
          <DefinitionRow label="Source">
            <a
              href={match.standard!.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              {match.standard!.source}
            </a>
            {match.standard!.reference ? (
              <Mono muted className="mt-0.5 block text-[10px]">
                {match.standard!.reference}
              </Mono>
            ) : null}
          </DefinitionRow>
          <DefinitionRow label="Confidence">
            <Mono>{Math.round(match.confidence * 100)}%</Mono>
          </DefinitionRow>
          <DefinitionRow label="Normalized product">
            <span className="text-ink">{classification.normalized_product}</span>
            <Mono muted className="mt-0.5 block text-[10px] uppercase tracking-[0.1em]">
              {classification.method} · {Math.round(classification.confidence * 100)}%
            </Mono>
          </DefinitionRow>
          <DefinitionRow label="Why this match">
            <span className="text-ink-soft">{match.reason}</span>
          </DefinitionRow>
        </dl>
      ) : (
        <div className="px-5 py-4">
          <p className="text-[13px] text-review">
            No verified Indian Standard was matched with enough confidence — sent
            for officer review.
          </p>
          <p className="mt-2 text-[12px] text-ink-faint">
            {match.reason || classification.reason}
          </p>
          <p className="mt-2 text-[11px] text-ink-faint">
            MetrIQ only cites standards from its verified registry. It never
            generates an IS number.
          </p>
        </div>
      )}
    </Panel>
  );
}

function DownstreamPanel({ result }: { result: InspectionAnalysis }) {
  const p = result.pipeline;
  const rows: [string, string, string][] = [
    ["OCR", "Local PaddleOCR text detection", p.ocr],
    [
      "Declaration extraction",
      "Deterministic parse of OCR text into declared fields",
      p.declaration_extraction,
    ],
    [
      "Product classification",
      result.classification.method === "llm"
        ? "Local Qwen3-4B, strict JSON"
        : "Deterministic product rules",
      p.product_classification,
    ],
    [
      "Indian Standard lookup",
      "Verified standards registry — never generated",
      p.standard_lookup,
    ],
    ["Legal-metrology rules", "Deterministic PASS / FAIL / REVIEW engine", p.legal_metrology],
    ["Officer review & report", "Human verification, PDF report, history", p.officer_review],
  ];
  return (
    <Panel flush>
      <PanelHeader title="Downstream pipeline" meta="OCR → standard live" />
      <ul>
        {rows.map(([k, v, status], i) => (
          <li
            key={k}
            className={cn(
              "flex items-baseline justify-between gap-4 px-5 py-3",
              i > 0 && "border-t border-line",
            )}
          >
            <div>
              <div className="text-[13px] font-medium text-ink-soft">{k}</div>
              <div className="text-[12px] text-ink-faint">{v}</div>
            </div>
            <Mono
              className={cn(
                "shrink-0 text-[10px] uppercase tracking-[0.1em]",
                stageTone(status),
              )}
            >
              {status}
            </Mono>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RawTextPanel({ text }: { text: string }) {
  return (
    <Panel flush>
      <PanelHeader title="Raw OCR text" meta="verbatim" />
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[12px] leading-relaxed text-ink">
        {text || "— no text —"}
      </pre>
    </Panel>
  );
}

