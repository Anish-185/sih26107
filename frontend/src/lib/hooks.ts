import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Number of completed runs — useful to tell "not started" from "empty". */
  runs: number;
}

/**
 * Run an async task on demand and track its state. Stale results from an
 * earlier call are discarded so rapid re-submits don't race.
 */
export function useAsyncTask<Args extends unknown[], T>(
  task: (...args: Args) => Promise<T>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: false,
    runs: 0,
  });
  const callId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: Args) => {
      const id = ++callId.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await task(...args);
        if (mounted.current && id === callId.current) {
          setState((s) => ({ data, error: null, loading: false, runs: s.runs + 1 }));
        }
        return data;
      } catch (error) {
        if (mounted.current && id === callId.current) {
          setState((s) => ({ data: null, error, loading: false, runs: s.runs + 1 }));
        }
        throw error;
      }
    },
    [task],
  );

  const reset = useCallback(() => {
    callId.current++;
    setState({ data: null, error: null, loading: false, runs: 0 });
  }, []);

  return { ...state, run, reset };
}

/** Fetch once on mount. */
export function useOnMount<T>(task: () => Promise<T>) {
  const { run, ...state } = useAsyncTask(task);
  useEffect(() => {
    run().catch(() => {});
  }, [run]);
  return state;
}
