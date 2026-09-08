import { Link } from "react-router-dom";
import { Mono, Panel, SectionHeading, StatusBadge } from "@/components/ui";
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
    <div className="space-y-8">
      <SectionHeading
        kicker="History"
        title="Inspection history"
        description="Every inspection MetrIQ has processed, with its verification state."
      />

      <MockDataBanner scope="This table lists placeholder inspections." />

      <Panel flush className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Inspection", "Product", "Standard", "Result", "Date", "Reviewer", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    className="kicker px-4 py-3 font-normal first:pl-5 last:pr-5"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((ins) => (
              <tr
                key={ins.id}
                className="group border-b border-line last:border-0 hover:bg-surface"
              >
                <td className="px-4 py-3 pl-5">
                  <Link
                    to={`/history/${ins.id}`}
                    className="font-mono text-[12px] text-accent hover:underline"
                  >
                    {ins.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[13px]">{ins.product}</td>
                <td className="px-4 py-3">
                  <Mono muted className="text-[12px]">
                    {ins.standardNumber}
                  </Mono>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ins.status} size="sm" />
                </td>
                <td className="px-4 py-3 text-[12px] text-ink-soft">
                  {formatDate(ins.createdAt)}
                </td>
                <td className="px-4 py-3 text-[12px] text-ink-soft">
                  {ins.reviewer ?? "—"}
                </td>
                <td className="px-4 py-3 pr-5 text-[12px] text-ink-soft">
                  {REVIEW_LABEL[ins.reviewStatus]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
