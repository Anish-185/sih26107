/*
  Typed client for the MetrIQ FastAPI backend.

  The backend is the source of truth. The frontend never re-implements retrieval,
  ranking, grounding or abstention logic — it renders exactly what the API
  returns, including when the API says an answer is unsupported.

  Contracts mirror backend/app/api.py:
    GET  /health
    POST /product-standard   (+ deterministic "why this result" per candidate)
    POST /certification-guidance
    POST /laboratory-search
    POST /ask                (grounded BIS Q&A — used by the Hallmarking view)
*/

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** True when the local language model was unreachable (backend returns 503). */
  get isModelUnavailable(): boolean {
    return this.status === 503;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 45_000,
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      ...init,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        408,
        "The request timed out — the local language model is taking too long to respond. Please try again in a moment.",
      );
    }
    throw new ApiError(0, "Cannot reach the MetrIQ backend. Is the API running?");
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const body = text ? safeParse(text) : null;

  if (!response.ok) {
    const detail =
      (body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : null) ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, detail);
  }

  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ------------------------------------------------------------------ types --- */

export type Confidence = "high" | "medium" | "low" | "none";

export interface Reason {
  field: string;
  term: string;
  weight: number;
  detail: string;
}

export interface EvidenceSource {
  id: string;
  title: string;
  category: string;
  standard_number: string | null;
  score: number;
  confidence: string;
  matched_terms: string[];
  source_organization: string;
  source_url: string | null;
  document_name: string | null;
  reference: string | null;
  verification_status: string;
  last_verified: string | null;
}

export interface Health {
  status: string;
  service: string;
  version: string;
}

export interface WhyThisResult {
  standard_number: string;
  strength: string;
  signals: string[];
  summary: string;
}

export interface ProductStandardResult {
  id: string;
  title: string;
  standard_number: string;
  score: number;
  confidence: string;
  matched_terms: string[];
  reasons: Reason[];
  why: WhyThisResult;
  source_organization: string;
  source_url: string | null;
  document_name: string | null;
  reference: string | null;
  verification_status: string;
  last_verified: string | null;
}

export interface ProductStandardResponse {
  product: string;
  results: ProductStandardResult[];
  grounded: boolean;
  confidence: Confidence;
  note: string;
}

export interface CertificationGuidanceResponse {
  question: string;
  product_context: string | null;
  answer: string;
  grounded: boolean;
  confidence: Confidence;
  source_count: number;
  sources: EvidenceSource[];
  note: string;
}

export interface LaboratorySearchResponse {
  query: string;
  standard_context: string | null;
  answer: string;
  grounded: boolean;
  confidence: Confidence;
  source_count: number;
  sources: EvidenceSource[];
  note: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  grounded: boolean;
  source_count: number;
  sources: EvidenceSource[];
}

/* --------------------------------------------------------------- endpoints --- */

export const api = {
  health: () => request<Health>("/health"),

  productStandard: (product: string, limit = 6) =>
    request<ProductStandardResponse>("/product-standard", {
      method: "POST",
      body: JSON.stringify({ product, limit }),
    }),

  certificationGuidance: (question: string, product = "") =>
    request<CertificationGuidanceResponse>(
      "/certification-guidance",
      { method: "POST", body: JSON.stringify({ question, product }) },
      90_000,
    ),

  laboratorySearch: (query: string, standard = "", explain = false) =>
    request<LaboratorySearchResponse>(
      "/laboratory-search",
      { method: "POST", body: JSON.stringify({ query, standard, explain }) },
      explain ? 90_000 : 20_000,
    ),

  // Grounded BIS Q&A (Phase 4). Used for the Hallmarking / HUID information view.
  ask: (question: string) =>
    request<AskResponse>(
      "/ask",
      { method: "POST", body: JSON.stringify({ question }) },
      90_000,
    ),
};
