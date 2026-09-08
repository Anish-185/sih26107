import { type FormEvent, useState } from "react";
import { api, type Confidence } from "@/lib/api";
import { useAsyncTask } from "@/lib/hooks";
import {
  Button,
  Callout,
  EmptyState,
  InlineLoading,
  Panel,
  SectionHeading,
  TextArea,
} from "@/components/ui";
import { GroundedAnswer } from "@/components/GroundedAnswer";
import { ErrorNote } from "@/features/StandardsView";

const EXAMPLES = [
  "What is HUID and how can a consumer verify it?",
  "What are the three marks on a hallmarked gold article?",
  "What should I check when buying hallmarked jewellery?",
  "Which gold purities can be hallmarked in India?",
  "Is hallmarking of gold jewellery mandatory?",
];

export function HallmarkingView() {
  const [question, setQuestion] = useState("");
  const task = useAsyncTask(api.ask);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q) task.run(q).catch(() => {});
  }

  const res = task.data;
  // /ask has no confidence field; derive it from the retrieved evidence.
  const confidence: Confidence = res
    ? res.grounded
      ? ((res.sources[0]?.confidence as Confidence) ?? "medium")
      : "none"
    : "none";

  return (
    <div className="space-y-10">
      <SectionHeading
        kicker="Hallmarking / HUID"
        title="Hallmarking & HUID information"
        description="Grounded answers about BIS hallmarking and the six-digit HUID, drawn from official BIS sources. This is an information feature — it does not verify a specific article's HUID."
      />

      <Callout>
        MetrIQ does not run live HUID verification. To check a real article, use
        the six-digit HUID printed on it with the BIS Care App, as BIS describes
        below.
      </Callout>

      <Panel flush>
        <form onSubmit={submit} className="space-y-3 p-4">
          <label className="kicker mb-1.5 block">Question</label>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about hallmarking, HUID, purity grades, or consumer verification…"
            rows={3}
          />
          <div className="flex justify-end">
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
                task.run(ex).catch(() => {});
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

      {res && (
        <GroundedAnswer
          question={res.question}
          answer={res.answer}
          grounded={res.grounded}
          confidence={confidence}
          note=""
          sources={res.sources}
          context={null}
          abstentionMessage="The available BIS knowledge base does not contain enough verified information to answer this reliably."
        />
      )}

      {!res && task.error == null && !task.loading && (
        <EmptyState
          title="No question asked yet"
          description="The answer and every BIS source used will appear here. Sources come from the BIS Hallmarking FAQ, the mandatory-hallmarking order, and BIS consumer pages."
        />
      )}
    </div>
  );
}
