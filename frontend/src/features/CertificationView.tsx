import { type FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useAsyncTask } from "@/lib/hooks";
import {
  Button,
  EmptyState,
  InlineLoading,
  Panel,
  SectionHeading,
  TextArea,
  TextInput,
} from "@/components/ui";
import { GroundedAnswer } from "@/components/GroundedAnswer";
import { ErrorNote } from "@/features/StandardsView";

const EXAMPLES = [
  "How do I get BIS certification for a stainless steel water bottle?",
  "What is the BIS certification process?",
  "Is BIS certification required for an LED lamp?",
];

export function CertificationView() {
  const [question, setQuestion] = useState("");
  const [product, setProduct] = useState("");
  const task = useAsyncTask(api.certificationGuidance);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q) task.run(q, product.trim()).catch(() => {});
  }

  return (
    <div className="space-y-10">
      <SectionHeading
        kicker="Certification guidance"
        title="BIS certification — grounded in evidence"
        description="MetrIQ retrieves certification evidence from the BIS knowledge base and asks the local model to explain only that evidence. When the knowledge base does not support an answer, it abstains — it does not decide the legal requirement."
      />

      <Panel flush>
        <form onSubmit={submit} className="space-y-3 p-4">
          <div>
            <label className="kicker mb-1.5 block">Question</label>
            <TextArea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about the certification process, scheme, or whether certification applies…"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="kicker mb-1.5 block">
                Product context <span className="normal-case">(optional)</span>
              </label>
              <TextInput
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. stainless steel water bottle"
              />
            </div>
            <Button type="submit" disabled={task.loading || !question.trim()}>
              {task.loading ? <InlineLoading label="Reasoning" /> : "Ask"}
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
          <span className="kicker">Examples</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                task.run(ex, "").catch(() => {});
              }}
              className="text-left text-[12px] text-ink-soft hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      </Panel>

      {task.loading && (
        <p className="text-[12px] text-ink-faint">
          The local model is reading the retrieved BIS evidence — this can take a
          moment.
        </p>
      )}
      {task.error != null && <ErrorNote error={task.error} />}

      {task.data && (
        <GroundedAnswer
          question={task.data.question}
          answer={task.data.answer}
          grounded={task.data.grounded}
          confidence={task.data.confidence}
          note={task.data.note}
          sources={task.data.sources}
          context={{
            label: "Product",
            value: task.data.product_context,
          }}
          abstentionMessage={
            task.data.answer ||
            "The available BIS knowledge base does not contain sufficient verified information to answer this certification question."
          }
        />
      )}

      {!task.data && task.error == null && !task.loading && (
        <EmptyState
          title="No question asked yet"
          description="The answer, its confidence, and every BIS source used will appear here."
        />
      )}
    </div>
  );
}
