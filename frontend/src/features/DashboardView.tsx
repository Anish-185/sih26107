import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  FlaskConical,
  Gem,
  ScanLine,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LinkButton, Mono, StatusBadge } from "@/components/ui";
import {
  Annotation,
  Bracket,
  BlueprintField,
  Figurine,
  PhotoFragment,
  SquareField,
} from "@/components/decor";
import {
  MOCK_DASHBOARD_STATS,
  listMockInspections,
  type ComplianceStatus,
} from "@/mocks";
import { formatDate } from "@/lib/format";

interface Surface {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  flagship?: boolean;
}

const SURFACES: Surface[] = [
  { to: "/inspection", label: "Inspection", hint: "Image → declared values → report", icon: ScanLine },
  {
    to: "/standards",
    label: "Product → Standard",
    hint: "Deterministic Indian Standard discovery",
    icon: Target,
    flagship: true,
  },
  { to: "/certification", label: "Certification", hint: "Grounded BIS certification guidance", icon: BadgeCheck },
  { to: "/laboratories", label: "Laboratories", hint: "BIS recognised-lab directories", icon: FlaskConical },
  { to: "/hallmarking", label: "Hallmarking / HUID", hint: "Grounded hallmarking information", icon: Gem },
];

const SIGNAL: [string, string][] = [
  ["Retrieval", "Deterministic lexical search"],
  ["Source of truth", "Curated BIS knowledge base"],
  ["Language model", "Explains retrieved evidence only"],
  ["On weak evidence", "Abstains — never guesses"],
];

export function DashboardView() {
  const recent = listMockInspections().slice(0, 4);
  const s = MOCK_DASHBOARD_STATS;

  return (
    <div className="space-y-20 sm:space-y-24">
      {/* ============================================================ hero */}
      <section className="relative grid items-center gap-x-8 gap-y-12 lg:grid-cols-[1.02fr_0.98fr]">
        {/* left — editorial column */}
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="eyebrow">AI-Assisted Legal Metrology Inspection</span>
            <span className="h-px w-8 bg-accent/40" aria-hidden />
            <Annotation className="hidden sm:inline-flex">BIS / India</Annotation>
          </div>

          <h1 className="display mt-6 text-[2.7rem] leading-[1] sm:text-[4rem]">
            Inspect a package.
            <br />
            Get evidence,
            <br />
            <span className="text-accent">not opinions.</span>
          </h1>

          <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink-soft">
            MetrIQ reads declared values from a product image, retrieves the
            applicable Indian Standard, runs deterministic legal-metrology rule
            checks, and produces an inspection report an officer verifies — with
            every finding traced to its source.
          </p>

          <div className="mt-9 flex flex-wrap items-stretch gap-3">
            <LinkButton to="/inspection" size="lg">
              <ScanLine className="h-4 w-4" />
              Start an inspection
            </LinkButton>
            <LinkButton to="/standards" variant="secondary" size="lg">
              Explore standards
              <ArrowUpRight className="h-4 w-4" />
            </LinkButton>
          </div>

          {/* inline stats — not a dashboard grid */}
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            {[
              ["Inspections", s.inspections, undefined],
              ["Pass", s.pass, "PASS"],
              ["Review", s.review, "REVIEW"],
              ["Fail", s.fail, "FAIL"],
            ].map(([label, value, status]) => (
              <div key={label as string}>
                <dd className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    {String(value).padStart(2, "0")}
                  </span>
                  {status && (
                    <StatusBadge status={status as ComplianceStatus} size="sm" />
                  )}
                </dd>
                <dt className="kicker mt-1">{label as string}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* right — the blue Lion Capital archival image, art-directed:
            faint grid behind, small blue markers + thin annotations around,
            the image cropped and bleeding past the top and right edge. */}
        <div className="relative -mx-5 mt-2 h-[380px] sm:mx-0 sm:h-[480px] lg:h-[540px]">
          <BlueprintField
            className="inset-x-[6%] top-[6%] bottom-[10%] lg:-right-10 lg:-top-14"
            drift
          />
          <SquareField
            className="hidden sm:block"
            connect={false}
            squares={[
              { x: 9, y: 18, s: 10, v: "mid" },
              { x: 4, y: 38, s: 16, v: "soft" },
              { x: 16, y: 56, s: 7, v: "outline" },
              { x: 95, y: 14, s: 14, v: "solid" },
              { x: 98, y: 32, s: 8, v: "outline" },
              { x: 93, y: 74, s: 12, v: "mid" },
            ]}
          />

          {/* the archival image — a blue plate, cropped at the top and
              bleeding past the right edge of the column */}
          <Figurine
            blend="normal"
            className="metriq-rise absolute -top-6 bottom-0 right-[-4%] w-[74%] max-w-none object-cover object-top sm:right-[-2%] sm:w-[66%] lg:-right-6 lg:w-[62%]"
          />

          {/* measurement annotations around the artwork */}
          <Annotation lead="right" className="absolute left-[2%] top-[12%] hidden sm:inline-flex">
            Measure → Verify
          </Annotation>
          <Annotation className="absolute left-[2%] top-[44%] hidden md:inline-flex">
            Evidence first
          </Annotation>
          <span
            className="absolute left-[3%] top-[52%] hidden h-px w-[18%] bg-accent/30 md:block"
            aria-hidden
          />
          <div className="absolute bottom-[6%] left-[2%] hidden sm:block">
            <span className="flex items-center gap-2" aria-hidden>
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="h-px w-14 bg-accent/40" />
            </span>
            <Annotation className="mt-2 inline-flex">BIS / India</Annotation>
          </div>
        </div>
      </section>

      {/* ==================================================== upload strip */}
      <Link
        to="/inspection"
        className="group relative flex items-center gap-4 border border-accent bg-accent px-5 py-5 text-white transition-colors hover:bg-accent-hover sm:px-7"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center bg-white/15"
          aria-hidden
        >
          <ScanLine className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">
            Start an inspection from a package image
          </div>
          <Mono className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] !text-white/65">
            PNG · JPG · WEBP · multiple images supported
          </Mono>
        </div>
        <span className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] sm:flex">
          Inspect
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>

      {/* ======================================================= surfaces */}
      <section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="eyebrow">The five surfaces</span>
              <span className="h-px w-8 bg-accent/40" aria-hidden />
            </div>
            <h2 className="display mt-3 text-2xl sm:text-[1.9rem]">
              One evidence pipeline, five ways in
            </h2>
          </div>
          <Annotation className="hidden md:inline-flex">
            Deterministic core · grounded explanation
          </Annotation>
        </div>

        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {SURFACES.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="group relative flex flex-col gap-4 bg-raised p-5 transition-colors hover:bg-surface"
              >
                {a.flagship && (
                  <span
                    className="absolute inset-x-0 top-0 h-[2px] bg-accent"
                    aria-hidden
                  />
                )}
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-9 w-9 place-items-center border transition-colors ${
                      a.flagship
                        ? "border-accent bg-accent text-white"
                        : "border-accent-line bg-accent-soft text-accent group-hover:border-accent"
                    }`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold">{a.label}</span>
                    {a.flagship && (
                      <span className="annotation border border-accent-line bg-accent-soft px-1 py-px !text-accent">
                        Flagship
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-ink-faint">
                    {a.hint}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===================================== photographic punctuation */}
      <div className="relative -mx-5 h-20 overflow-hidden sm:mx-0 sm:h-24">
        <PhotoFragment
          src="/blue-botanical.png"
          className="absolute inset-0 h-full w-full object-cover object-[30%_45%]"
        />
        <span className="absolute inset-0 bg-accent/25 mix-blend-multiply" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-between px-5 sm:px-8">
          <span className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white/80">
            Every finding
            <ArrowRight className="h-3.5 w-3.5" />
            one source
          </span>
          <Annotation className="!text-white/70">BIS / India</Annotation>
        </div>
      </div>

      {/* =========================================== activity + signal */}
      <section className="grid gap-x-10 gap-y-12 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="eyebrow">Recent inspections</span>
              <h2 className="display mt-2 text-xl">Latest activity</h2>
            </div>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent hover:text-accent-hover"
            >
              All
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="border border-line">
            {recent.map((ins, i) => (
              <li key={ins.id}>
                <Link
                  to={`/history/${ins.id}`}
                  className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Mono muted className="text-[11px]">
                        {ins.id}
                      </Mono>
                      <span className="truncate text-[13px] font-medium">
                        {ins.product}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-faint">
                      <Mono muted>{ins.standardNumber}</Mono> ·{" "}
                      {formatDate(ins.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={ins.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-6 border-b border-line pb-4">
            <span className="eyebrow">How MetrIQ answers</span>
            <h2 className="display mt-2 text-xl">The one rule</h2>
          </div>
          <div className="relative border border-line bg-surface">
            <Bracket tone="accent" size="sm" />
            <dl className="divide-y divide-line">
              {SIGNAL.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                  <dt className="kicker">{k}</dt>
                  <dd className="text-right text-[12px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-line px-5 py-3">
              <Annotation>Verified BIS sources only</Annotation>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
