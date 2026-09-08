import { Link } from "react-router-dom";
import { ArrowUpRight, ScanLine } from "lucide-react";
import {
  LinkButton,
  Mono,
  Panel,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import {
  MOCK_DASHBOARD_STATS,
  listMockInspections,
  type ComplianceStatus,
} from "@/mocks";
import { formatDate } from "@/lib/format";

const QUICK_ACTIONS = [
  { to: "/inspection", label: "New inspection", hint: "Upload a package image" },
  { to: "/standards", label: "Product → Standard", hint: "Find the applicable IS" },
  { to: "/certification", label: "Certification guidance", hint: "Grounded BIS answers" },
  { to: "/laboratories", label: "Laboratory search", hint: "BIS recognised labs" },
];

export function DashboardView() {
  const recent = listMockInspections().slice(0, 4);
  const s = MOCK_DASHBOARD_STATS;

  return (
    <div className="space-y-14">
      <div className="flex flex-col gap-8 border-b border-line pb-14 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="kicker mb-4">AI-Assisted Legal Metrology Inspection</div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[var(--tracking-tightest)] sm:text-6xl">
            Inspect a package.
            <br />
            Get evidence, not opinions.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            MetrIQ reads declared values from a product image, retrieves the
            applicable Indian Standard, runs deterministic legal-metrology rule
            checks, and produces an inspection report that an officer verifies —
            with every finding traced to its source.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton to="/inspection">
              <ScanLine className="h-4 w-4" />
              Start inspection
            </LinkButton>
            <LinkButton to="/standards" variant="secondary">
              Explore standards
            </LinkButton>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:w-[360px]">
          {[
            ["Inspections", s.inspections, undefined],
            ["Pass", s.pass, "PASS"],
            ["Review", s.review, "REVIEW"],
            ["Fail", s.fail, "FAIL"],
          ].map(([label, value, status]) => (
            <div key={label as string} className="bg-raised p-4">
              <dt className="kicker">{label as string}</dt>
              <dd className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {String(value).padStart(2, "0")}
                </span>
                {status && (
                  <StatusBadge status={status as ComplianceStatus} size="sm" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeading
            kicker="Recent inspections"
            title="Latest activity"
            className="mb-5 [&_h1]:text-xl"
          />
          <Panel flush>
            <ul>
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
            <Link
              to="/history"
              className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] font-medium text-accent hover:bg-surface"
            >
              View all inspections
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        </div>

        <div>
          <SectionHeading
            kicker="Quick actions"
            title="Jump in"
            className="mb-5 [&_h1]:text-xl"
          />
          <div className="grid gap-px border border-line bg-line">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center justify-between bg-raised px-5 py-4 transition-colors hover:bg-surface"
              >
                <div>
                  <div className="text-[13px] font-medium">{a.label}</div>
                  <div className="text-[12px] text-ink-faint">{a.hint}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
