import { type FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { ApiError, api, type ProductStandardResult } from "@/lib/api";
import { useAsyncTask } from "@/lib/hooks";
import { standardTitle } from "@/lib/format";
import {
  Button,
  Callout,
  Chip,
  ConfidenceMeter,
  EmptyState,
  InlineLoading,
  Mono,
  Panel,
  SectionHeading,
  TextInput,
} from "@/components/ui";

const EXAMPLES = [
  "stainless steel water bottle",
  "LED lamp",
  "packaged drinking water",
  "electric iron",
];

export function StandardsView() {
  const [query, setQuery] = useState("");
  const task = useAsyncTask(api.productStandard);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) task.run(q).catch(() => {});
  }

  const res = task.data;

  return (
    <div className="space-y-10">
      <SectionHeading
        kicker="Product → Standard"
        title="Find the Indian Standard for a product"
        description="Describe a product in plain words. MetrIQ runs deterministic retrieval over the BIS knowledge base and only returns a standard when the retrieved evidence actually describes that product."
      />

      <Panel flush>
        <form onSubmit={submit} className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. stainless steel water bottle"
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={task.loading || !query.trim()}>
            {task.loading ? <InlineLoading label="Retrieving" /> : "Search"}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <span className="kicker mr-1">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                task.run(ex).catch(() => {});
              }}
              className="rounded-xs border border-line bg-surface px-2 py-1 font-mono text-[11px] text-ink-soft hover:border-ink hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </Panel>

      {task.loading && (
        <p className="text-[12px] text-ink-faint">
          Running deterministic retrieval over the BIS knowledge base…
        </p>
      )}
      {task.error != null && <ErrorNote error={task.error} />}

      {res && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {res.grounded ? "Relevant standards" : "No standard returned"}
            </h2>
            <div className="flex items-center gap-3">
              <Mono muted className="text-[12px]">
                query: “{res.product}”
              </Mono>
              <ConfidenceMeter confidence={res.confidence} />
            </div>
          </div>

          {res.grounded ? (
            <ol className="grid gap-px border border-line bg-line">
              {res.results.map((r, i) => (
                <StandardResult key={r.id} result={r} rank={i + 1} />
              ))}
            </ol>
          ) : (
            <Callout tone="abstain" title="Retrieval abstained">
              {res.note ||
                "No Indian Standard in the knowledge base clearly describes this product. MetrIQ does not guess a standard number."}
            </Callout>
          )}
        </section>
      )}

      {!res && task.error == null && !task.loading && (
        <EmptyState
          title="No search yet"
          description="Results appear here with the matched terms and the retrieval reasons behind each candidate standard."
        />
      )}
    </div>
  );
}

function StandardResult({
  result,
  rank,
}: {
  result: ProductStandardResult;
  rank: number;
}) {
  const topReasons = [...result.reasons]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  return (
    <li className="bg-raised p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mono muted className="text-[11px]">
              {String(rank).padStart(2, "0")}
            </Mono>
            <Mono className="text-[15px] font-semibold">
              {result.standard_number}
            </Mono>
          </div>
          <h3 className="mt-1 text-[15px] font-medium text-ink">
            {standardTitle(result.title)}
          </h3>
          <p className="mt-1 text-[12px] text-ink-faint">
            {result.source_organization}
            {result.document_name ? ` · ${result.document_name}` : ""}
            {result.last_verified ? ` · verified ${result.last_verified}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <ConfidenceMeter confidence={result.confidence} />
          <Mono muted className="mt-1 block text-[11px]">
            score {result.score.toFixed(1)}
          </Mono>
        </div>
      </div>

      {result.matched_terms.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1">Matched</span>
          {result.matched_terms.map((t) => (
            <Chip key={t} tone="accent">
              {t}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="kicker mb-2">Why this result</div>
        {result.why?.summary && (
          <p className="text-[13px] leading-relaxed text-ink">
            {result.why.summary}
          </p>
        )}
        {topReasons.length > 0 && (
          <>
            <div className="kicker mb-2 mt-3">Retrieval signals</div>
            <ul className="space-y-1.5">
              {topReasons.map((reason, i) => (
                <li
                  key={`${reason.field}-${reason.term}-${i}`}
                  className="flex items-baseline gap-2 text-[12px] text-ink-soft"
                >
                  <Mono muted className="w-24 shrink-0 text-[11px] uppercase">
                    {reason.field}
                  </Mono>
                  <span>
                    term <Mono>{reason.term}</Mono>
                    {reason.detail ? ` — ${reason.detail}` : ""}
                  </span>
                  <Mono muted className="ml-auto text-[11px]">
                    +{reason.weight}
                  </Mono>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {result.source_url && (
        <a
          href={result.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-[12px] font-medium text-accent hover:text-accent-hover"
        >
          Official BIS source →
        </a>
      )}
    </li>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const apiError = error instanceof ApiError ? error : null;
  // A timeout or an unreachable local model is an environment condition, not a
  // failed request the user should worry about — label it accordingly.
  const modelSlow = apiError?.status === 408 || apiError?.isModelUnavailable;
  const msg =
    apiError?.detail ??
    (error instanceof Error ? error.message : "Something went wrong.");
  return (
    <Callout title={modelSlow ? "The local model didn’t respond" : "Request failed"}>
      {msg}
    </Callout>
  );
}
