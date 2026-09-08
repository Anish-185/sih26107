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
  // JSON by default; for FormData let the browser set the multipart boundary.
  const isForm = init?.body instanceof FormData;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: isForm ? undefined : { "content-type": "application/json" },
      signal: controller.signal,
      ...init,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Please try again.");
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

/* ---- inspection: real IMAGE -> OCR pipeline (POST /inspection/analyze) --- */

export interface OcrRegion {
  id: string;
  text: string;
  confidence: number; // 0–1
  bbox: [number, number, number, number]; // [x1,y1,x2,y2] in source pixels
  polygon: number[][]; // [[x,y] x4]
}

export interface InspectionAnalysis {
  inspection_id: string;
  created_at: string;
  image: {
    filename: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  };
  quality: {
    blur_score: number;
    brightness: number;
    contrast: number;
    is_low_quality: boolean;
    notes: string[];
  };
  ocr: {
    engine: string;
    text: string;
    region_count: number;
    mean_confidence: number;
    duration_ms: number;
    regions: OcrRegion[];
  };
  // Downstream phases — not implemented yet, returned explicitly empty/pending.
  product: string;
  declarations: unknown[];
  checks: unknown[];
  status: string;
  pipeline_stage: string;
  notes: string[];
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
      120_000,
    ),

  // Inspection: send the package image, get real OCR back.
  analyzeInspection: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<InspectionAnalysis>(
      "/inspection/analyze",
      { method: "POST", body: form },
      120_000,
    );
  },
};
