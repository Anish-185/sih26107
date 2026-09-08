import type { ReactNode } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { EvidenceSource } from "@/lib/api";
import { categoryLabel } from "@/lib/format";
import {
  Callout,
  Chip,
  ConfidenceMeter,
  DefinitionRow,
  Divider,
  Mono,
  Panel,
  PanelHeader,
} from "@/components/ui";

/**
 * Shared renderer for the grounded-explanation endpoints
 * (/certification-guidance and /laboratory-search). It keeps the visual
 * hierarchy the backend implies: QUESTION -> ANSWER -> EVIDENCE -> SOURCES ->
 * CONFIDENCE, and renders abstention distinctly so the UI never implies
 * certainty the backend did not give.
 */
export function GroundedAnswer({
  question,
  answer,
  grounded,
  confidence,
  note,
  sources,
  context,
  abstentionMessage,
}: {
  question: string;
  answer: string;
  grounded: boolean;
  confidence: string;
  note: string;
  sources: EvidenceSource[];
  context?: { label: string; value: string | null } | null;
  abstentionMessage: string;
}) {
  return (
    <div className="grid gap-px border border-line bg-line lg:grid-cols-[1fr_360px]">
      <div className="bg-raised">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <div className="kicker mb-2">Question</div>
          <p className="text-[15px] leading-relaxed text-ink">{question}</p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="kicker mb-3">
            {grounded ? "Grounded answer" : "Result"}
          </div>

          {grounded ? (
            <Prose text={answer} />
          ) : (
            <Callout tone="abstain" title="Insufficient verified evidence">
              {abstentionMessage}
            </Callout>
          )}

          {note && !answer.includes(note.slice(0, 40)) && (
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
              {note}
            </p>
          )}
        </div>
      </div>

      <aside className="bg-surface">
        <div className="border-b border-line px-5 py-4">
          <div className="kicker mb-3">Assessment</div>
          <dl>
            {context && (
              <DefinitionRow label={context.label}>
                {context.value ? (
                  <Mono>{context.value}</Mono>
                ) : (
                  <span className="text-ink-faint">Not identified</span>
                )}
              </DefinitionRow>
            )}
            <DefinitionRow label="Grounded">
              <Mono className={grounded ? "text-pass" : "text-review"}>
                {grounded ? "yes" : "no"}
              </Mono>
            </DefinitionRow>
            <DefinitionRow label="Confidence" align="start">
              <ConfidenceMeter confidence={confidence} />
            </DefinitionRow>
            <DefinitionRow label="Sources">
              <Mono>{sources.length}</Mono>
            </DefinitionRow>
          </dl>
        </div>
      </aside>

      {sources.length > 0 && (
        <div className="bg-raised lg:col-span-2">
          <PanelHeader
            title="Evidence"
            meta={`${sources.length} BIS ${sources.length === 1 ? "source" : "sources"}`}
          />
          <ul>
            {sources.map((s, i) => (
              <li key={s.id}>
                {i > 0 && <Divider />}
                <SourceRow source={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Prose({ text }: { text: string }) {
  // The backend answer is short plain text / light markdown. Render paragraphs
  // and simple bullets without pulling in a markdown dependency.
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-ink">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*(\d+[.)]|[-*])\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{stripMarkers(l)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{stripMarkers(block)}</p>;
      })}
    </div>
  );
}

function stripMarkers(s: string): string {
  return s
    .replace(/^\s*(\d+[.)]|[-*])\s+/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

export function SourceRow({ source }: { source: EvidenceSource }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {source.standard_number && (
              <Mono className="text-[13px] font-medium">
                {source.standard_number}
              </Mono>
            )}
            <Chip>{categoryLabel(source.category)}</Chip>
            <Chip
              tone={source.verification_status === "verified" ? "accent" : "neutral"}
            >
              {source.verification_status}
            </Chip>
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-ink">
            {source.title}
          </div>
          <div className="mt-1 text-[12px] text-ink-faint">
            {source.source_organization}
            {source.document_name ? ` · ${source.document_name}` : ""}
            {source.last_verified ? ` · verified ${source.last_verified}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Mono muted className="text-[11px]">
            score {source.score.toFixed(1)}
          </Mono>
        </div>
      </div>

      {source.matched_terms.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1">Matched</span>
          {source.matched_terms.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}

      {source.source_url && (
        <a
          href={source.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent-hover"
        >
          {source.source_url.endsWith(".pdf") ? (
            <FileText className="h-3.5 w-3.5" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          Official BIS source
        </a>
      )}
    </div>
  );
}

export function ResultShell({
  children,
}: {
  children: ReactNode;
}) {
  return <Panel flush>{children}</Panel>;
}
