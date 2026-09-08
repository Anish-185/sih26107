import type { Confidence } from "./api";

export function confidenceLabel(c: string): string {
  switch (c) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "None";
  }
}

/** 0..1 fill for a confidence meter. */
export function confidenceFill(c: string): number {
  switch (c) {
    case "high":
      return 1;
    case "medium":
      return 0.66;
    case "low":
      return 0.33;
    default:
      return 0.08;
  }
}

export function isAbstention(c: Confidence | string): boolean {
  return c === "none";
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function categoryLabel(category: string): string {
  return titleCase(category.replace(/_/g, " "));
}
