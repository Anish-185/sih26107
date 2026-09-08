import { LinkButton, SectionHeading } from "@/components/ui";

export function NotFoundView() {
  return (
    <div className="space-y-8 py-10">
      <SectionHeading
        kicker="404"
        title="This page is not part of MetrIQ"
        description="The route you followed does not exist in the inspection workspace."
      />
      <LinkButton to="/">Back to dashboard</LinkButton>
    </div>
  );
}
