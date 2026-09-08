/*
  MOCK DATA — clearly isolated.

  The MetrIQ backend currently exposes deterministic BIS retrieval and grounded
  explanation (standards / certification / laboratories). It does NOT yet expose
  an OCR / extraction / rules / compliance engine. Everything in this file is
  placeholder data for the inspection, evidence, review and history surfaces so
  the workflow is visible end to end.

  Rules for this file:
   - every consumer renders <MockDataBanner /> so it is never mistaken for a
     real inspection result;
   - nothing here is presented as a verified compliance outcome;
   - the Standards lookup inside the workspace calls the REAL /product-standard
     endpoint with the detected product — that part is not mocked.
*/
import { FlaskConical } from "lucide-react";

export const MOCK_ENABLED = true;

export type ComplianceStatus = "PASS" | "FAIL" | "REVIEW";
export type ReviewState = "pending" | "accepted" | "modified" | "rejected";

export interface BBox {
  /** All values are percentages (0–100) of the source image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MockDeclaration {
  id: string;
  label: string;
  value: string;
  confidence: number; // 0–1
  imageIndex: number;
  bbox: BBox;
}

export interface MockCheck {
  id: string;
  ruleId: string;
  title: string;
  requirement: string;
  observed: string;
  expected: string;
  status: ComplianceStatus;
  declarationId: string | null;
  confidence: number;
}

export interface MockRequirement {
  id: string;
  label: string;
  detail: string;
  basis: string;
}

export interface MockInspection {
  id: string;
  product: string;
  standardNumber: string;
  standardTitle: string;
  status: ComplianceStatus;
  confidence: "high" | "medium" | "low";
  createdAt: string;
  reviewer: string | null;
  reviewStatus: "unreviewed" | "in_review" | "signed_off";
  images: { index: number; src: string; label: string }[];
  declarations: MockDeclaration[];
  requirements: MockRequirement[];
  checks: MockCheck[];
}

const BOTTLE: MockInspection = {
  id: "INS-2026-0042",
  product: "Stainless Steel Water Bottle",
  standardNumber: "IS 17526:2021",
  standardTitle: "Domestic Stainless Steel Vacuum Flask / Bottle",
  status: "REVIEW",
  confidence: "high",
  createdAt: "2026-09-08T09:24:00+05:30",
  reviewer: null,
  reviewStatus: "unreviewed",
  images: [
    { index: 0, src: "/mock/label-bottle.svg", label: "Package Image 01" },
  ],
  declarations: [
    {
      id: "DCL-01",
      label: "Product",
      value: "Stainless Steel Water Bottle",
      confidence: 0.97,
      imageIndex: 0,
      bbox: { x: 7.5, y: 23.5, w: 55, h: 4.6 },
    },
    {
      id: "DCL-02",
      label: "Net Quantity",
      value: "1000 ml",
      confidence: 0.99,
      imageIndex: 0,
      bbox: { x: 7.5, y: 37.4, w: 22, h: 4.4 },
    },
    {
      id: "DCL-03",
      label: "MRP",
      value: "₹ 999",
      confidence: 0.94,
      imageIndex: 0,
      bbox: { x: 51.5, y: 37.4, w: 18, h: 4.4 },
    },
    {
      id: "DCL-04",
      label: "Manufacturer",
      value: "ABC Industries Pvt Ltd",
      confidence: 0.96,
      imageIndex: 0,
      bbox: { x: 7.5, y: 51.8, w: 48, h: 4.2 },
    },
    {
      id: "DCL-05",
      label: "Address",
      value: "Plot 14, MIDC Industrial Area, Pune 411019",
      confidence: 0.9,
      imageIndex: 0,
      bbox: { x: 7.5, y: 55.4, w: 66, h: 3.4 },
    },
    {
      id: "DCL-06",
      label: "Mfg. Date",
      value: "03 / 2026",
      confidence: 0.92,
      imageIndex: 0,
      bbox: { x: 7.5, y: 66.5, w: 18, h: 4.2 },
    },
    {
      id: "DCL-07",
      label: "Consumer Care",
      value: "care@abcind.example",
      confidence: 0.88,
      imageIndex: 0,
      bbox: { x: 51.5, y: 66.5, w: 40, h: 4.2 },
    },
    {
      id: "DCL-08",
      label: "Standard Mark",
      value: "IS 17526 · CM/L-1234567",
      confidence: 0.86,
      imageIndex: 0,
      bbox: { x: 7.5, y: 79.8, w: 45, h: 4.4 },
    },
  ],
  requirements: [
    {
      id: "REQ-01",
      label: "Net quantity declaration",
      detail:
        "Net quantity to be declared in standard units, in the prescribed manner and position.",
      basis: "Legal Metrology (Packaged Commodities) Rules, 2011 — r.9",
    },
    {
      id: "REQ-02",
      label: "Retail sale price",
      detail: "MRP to be declared as 'Maximum Retail Price ₹ ... inclusive of all taxes'.",
      basis: "Legal Metrology (Packaged Commodities) Rules, 2011 — r.6(1)(e)",
    },
    {
      id: "REQ-03",
      label: "Manufacturer name & address",
      detail: "Complete name and address of the manufacturer / packer / importer.",
      basis: "Legal Metrology (Packaged Commodities) Rules, 2011 — r.6(1)(a)",
    },
    {
      id: "REQ-04",
      label: "Month & year of manufacture",
      detail: "Month and year in which the commodity was manufactured or packed.",
      basis: "Legal Metrology (Packaged Commodities) Rules, 2011 — r.6(1)(c)",
    },
    {
      id: "REQ-05",
      label: "Consumer care details",
      detail: "Name, address, phone/email of the person to contact for complaints.",
      basis: "Legal Metrology (Packaged Commodities) Rules, 2011 — r.6(1)(f)",
    },
    {
      id: "REQ-06",
      label: "BIS Standard Mark",
      detail:
        "Product notified for compulsory certification must bear the Standard Mark with licence number.",
      basis: "IS 17526:2021 · Quality Control Order (retrieved from BIS)",
    },
  ],
  checks: [
    {
      id: "CHK-01",
      ruleId: "LM-RULE-009",
      title: "Net quantity in standard unit",
      requirement: "Declared in millilitre / litre",
      observed: "1000 ml",
      expected: "Volume in ml or l",
      status: "PASS",
      declarationId: "DCL-02",
      confidence: 0.99,
    },
    {
      id: "CHK-02",
      ruleId: "LM-RULE-004",
      title: "MRP declaration format",
      requirement: "'Maximum Retail Price ₹ ... incl. of all taxes'",
      observed: "₹ 999",
      expected: "Prefixed 'Maximum Retail Price' + 'inclusive of all taxes'",
      status: "REVIEW",
      declarationId: "DCL-03",
      confidence: 0.94,
    },
    {
      id: "CHK-03",
      ruleId: "LM-RULE-002",
      title: "Manufacturer name present",
      requirement: "Name of manufacturer / packer",
      observed: "ABC Industries Pvt Ltd",
      expected: "Non-empty legal entity name",
      status: "PASS",
      declarationId: "DCL-04",
      confidence: 0.96,
    },
    {
      id: "CHK-04",
      ruleId: "LM-RULE-003",
      title: "Complete address with PIN",
      requirement: "Full address including 6-digit PIN code",
      observed: "Plot 14, MIDC Industrial Area, Pune 411019",
      expected: "Street + city + PIN",
      status: "PASS",
      declarationId: "DCL-05",
      confidence: 0.9,
    },
    {
      id: "CHK-05",
      ruleId: "LM-RULE-006",
      title: "Month & year of manufacture",
      requirement: "MM/YYYY present",
      observed: "03 / 2026",
      expected: "Month and year",
      status: "PASS",
      declarationId: "DCL-06",
      confidence: 0.92,
    },
    {
      id: "CHK-06",
      ruleId: "LM-RULE-007",
      title: "Consumer care contact",
      requirement: "Phone or email for complaints",
      observed: "care@abcind.example",
      expected: "Email and/or phone",
      status: "REVIEW",
      declarationId: "DCL-07",
      confidence: 0.88,
    },
    {
      id: "CHK-07",
      ruleId: "BIS-RULE-001",
      title: "Standard Mark & licence number",
      requirement: "ISI mark + CM/L number for IS 17526",
      observed: "IS 17526 · CM/L-1234567",
      expected: "Standard Mark with a valid licence number",
      status: "REVIEW",
      declarationId: "DCL-08",
      confidence: 0.86,
    },
    {
      id: "CHK-08",
      ruleId: "LM-RULE-011",
      title: "Principal display panel legibility",
      requirement: "Declarations legible, min type height for pack size",
      observed: "Type height not measured",
      expected: "≥ required height for 1000 ml pack",
      status: "FAIL",
      declarationId: null,
      confidence: 0.71,
    },
  ],
};

const HISTORY: MockInspection[] = [
  BOTTLE,
  {
    ...BOTTLE,
    id: "INS-2026-0041",
    product: "Cow Ghee (Clarified Butter)",
    standardNumber: "—",
    standardTitle: "Packaged edible fat — Legal Metrology only",
    status: "FAIL",
    confidence: "medium",
    createdAt: "2026-09-07T16:10:00+05:30",
    reviewer: "R. Menon",
    reviewStatus: "signed_off",
    images: [{ index: 0, src: "/mock/label-ghee.svg", label: "Package Image 01" }],
  },
  {
    ...BOTTLE,
    id: "INS-2026-0040",
    product: "LED Bulb 9W",
    standardNumber: "IS 16102 (Part 1)",
    standardTitle: "Self-ballasted LED lamps",
    status: "PASS",
    confidence: "high",
    createdAt: "2026-09-07T11:02:00+05:30",
    reviewer: "A. Iyer",
    reviewStatus: "signed_off",
  },
  {
    ...BOTTLE,
    id: "INS-2026-0039",
    product: "Packaged Drinking Water 1L",
    standardNumber: "IS 14543:2016",
    standardTitle: "Packaged drinking water",
    status: "REVIEW",
    confidence: "medium",
    createdAt: "2026-09-06T18:47:00+05:30",
    reviewer: null,
    reviewStatus: "in_review",
  },
];

export function getMockInspection(id: string): MockInspection | undefined {
  return HISTORY.find((i) => i.id === id);
}

export function listMockInspections(): MockInspection[] {
  return HISTORY;
}

/** The inspection the Inspection workspace opens after an upload. */
export const ACTIVE_MOCK_INSPECTION = BOTTLE;

export function summariseChecks(checks: MockCheck[]) {
  return {
    total: checks.length,
    passed: checks.filter((c) => c.status === "PASS").length,
    failed: checks.filter((c) => c.status === "FAIL").length,
    review: checks.filter((c) => c.status === "REVIEW").length,
  };
}

export const MOCK_DASHBOARD_STATS = {
  inspections: 24,
  pass: 16,
  review: 5,
  fail: 3,
};

/* --------------------------------------------------------------- banner --- */

export function MockDataBanner({ scope }: { scope: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 border border-review/40 bg-review-soft px-4 py-3 text-[12px] leading-relaxed text-ink">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-review" />
      <p>
        <span className="font-medium">Demo data.</span> {scope} The OCR,
        rule-engine and compliance outputs shown here are placeholder values —
        the extraction and rules services are not part of the current backend.
        Standards lookups on this screen use the live{" "}
        <code className="font-mono text-[11px]">/product-standard</code> API.
      </p>
    </div>
  );
}
