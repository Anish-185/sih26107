import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Mono, PageHeader, StatusBadge } from "@/components/ui";
import { Annotation } from "@/components/decor";
import { MockDataBanner, listMockInspections } from "@/mocks";
import { formatDate } from "@/lib/format";

const REVIEW_LABEL: Record<string, string> = {
  unreviewed: "Unreviewed",
  in_review: "In review",
  signed_off: "Signed off",
};

export function HistoryView() {
  const rows = listMockInspections();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="History"
        title="Inspection history"
        lead="Every inspection MetrIQ has processed, with its verification state."
        annotation={<Annotation lead="right">{`${rows.length} records`}</Annotation>}
      />

      <MockDataBanner scope="This table lists placeholder inspections." />

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface">
              {[
                "Inspection",
                "Product",
                "Standard",
                "Result",
                "Date",
                "Reviewer",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="kicker px-4 py-3 font-normal first:pl-5 last:pr-5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((ins) => (
              <tr
                key={ins.id}
                className="group border-b border-line last:border-0 transition-colors hover:bg-surface"
              >
                <td className="px-4 py-3.5 pl-5">
                  <Link
                    to={`/history/${ins.id}`}
                    className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:text-accent-hover"
                  >
                    {ins.id}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] font-medium">
                  {ins.product}
                </td>
                <td className="px-4 py-3.5">
                  <Mono muted className="text-[12px]">
                    {ins.standardNumber}
                  </Mono>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={ins.status} size="sm" />
                </td>
                <td className="px-4 py-3.5 text-[12px] text-ink-soft">
                  {formatDate(ins.createdAt)}
                </td>
                <td className="px-4 py-3.5 text-[12px] text-ink-soft">
                  {ins.reviewer ?? "—"}
                </td>
                <td className="px-4 py-3.5 pr-5">
                  <Mono muted className="text-[11px] uppercase tracking-[0.08em]">
                    {REVIEW_LABEL[ins.reviewStatus]}
                  </Mono>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
