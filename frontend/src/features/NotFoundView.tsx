import { LinkButton, PageHeader } from "@/components/ui";
import { Annotation, BlueprintField } from "@/components/decor";

export function NotFoundView() {
  return (
    <div className="relative space-y-10 py-6">
      <BlueprintField fade="radial" />
      <div className="relative">
        <PageHeader
          eyebrow="404"
          title="This page is not part of MetrIQ"
          lead="The route you followed does not exist in the inspection workspace."
          annotation={<Annotation>Route not found</Annotation>}
        />
        <LinkButton to="/" variant="secondary" size="lg" className="mt-8">
          Back to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
