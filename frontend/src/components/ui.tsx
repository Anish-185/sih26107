import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { confidenceFill, confidenceLabel } from "@/lib/format";

/* ---------------------------------------------------------------- Button --- */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-sm " +
  "transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover border border-transparent",
  secondary:
    "bg-raised text-ink border border-line-strong hover:border-ink hover:bg-surface",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-surface",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-10 px-4 text-[13px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
});

export function LinkButton({
  to,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ Mono --- */

export function Mono({
  children,
  className,
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[0.92em] tracking-tight",
        muted ? "text-ink-faint" : "text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Chip --- */

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-1.5 py-0.5 font-mono text-[11px] leading-none",
        tone === "accent"
          ? "border-accent-line bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Divider --- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/* ----------------------------------------------------------- StatusBadge --- */

export type ComplianceStatus = "PASS" | "FAIL" | "REVIEW";

const statusStyles: Record<ComplianceStatus, string> = {
  PASS: "border-pass-line bg-pass-soft text-pass",
  FAIL: "border-fail-line bg-fail-soft text-fail",
  REVIEW: "border-review-line bg-review-soft text-review",
};

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: ComplianceStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-xs font-mono font-medium uppercase tracking-[0.08em]",
        statusStyles[status],
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        className,
      )}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden
      />
      {status}
    </span>
  );
}

/* ------------------------------------------------------- ConfidenceMeter --- */

export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: string;
  className?: string;
}) {
  const fill = confidenceFill(confidence);
  const abstain = confidence === "none";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-line">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            abstain ? "bg-ink-faint" : "bg-accent",
          )}
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
      <Mono muted className="text-[11px] uppercase tracking-[0.1em]">
        {confidenceLabel(confidence)}
      </Mono>
    </div>
  );
}

/* ----------------------------------------------------------------- Panel --- */

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article";
  flush?: boolean;
}

export function Panel({ as: Tag = "div", flush, className, ...props }: PanelProps) {
  return (
    <Tag
      className={cn(
        "border border-line bg-raised",
        !flush && "p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {meta && <div className="text-[12px] text-ink-faint">{meta}</div>}
      {children}
    </div>
  );
}

/* -------------------------------------------------------- SectionHeading --- */

export function SectionHeading({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {kicker && <div className="kicker mb-3">{kicker}</div>}
        <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-[var(--tracking-tightest)] sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- DefinitionRow --- */

export function DefinitionRow({
  label,
  children,
  align = "baseline",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "baseline" | "start";
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(96px,120px)_1fr] gap-4 py-2.5",
        align === "baseline" ? "items-baseline" : "items-start",
      )}
    >
      <dt className="kicker pt-0.5">{label}</dt>
      <dd className="min-w-0 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- Callout --- */

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "abstain";
  title?: ReactNode;
  children: ReactNode;
}) {
  const abstain = tone === "abstain";
  return (
    <div
      className={cn(
        "flex gap-3 border p-4 text-[13px] leading-relaxed",
        abstain
          ? "border-review-line bg-review-soft text-ink"
          : "border-line bg-surface text-ink-soft",
      )}
    >
      {abstain ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-review" />
      ) : (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
      )}
      <div className="min-w-0">
        {title && <div className="mb-1 font-medium text-ink">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState --- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-line-strong bg-surface p-8">
      <div className="text-[14px] font-medium">{title}</div>
      {description && (
        <p className="max-w-md text-[13px] leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Spinner --- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function InlineLoading({ label = "Working" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-soft">
      <Spinner />
      <Mono muted className="uppercase tracking-[0.12em]">
        {label}
      </Mono>
    </div>
  );
}

/* ----------------------------------------------------------------- Field --- */

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full border border-line-strong bg-raised px-3 text-[13px]",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y border border-line-strong bg-raised p-3 text-[13px] leading-relaxed",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------------- ArrowLink --- */

export function ArrowLink({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "group inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover";
  const inner = (
    <>
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to ?? "#"} className={cls}>
      {inner}
    </Link>
  );
}
