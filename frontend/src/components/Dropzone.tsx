import { type DragEvent, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { Mono } from "@/components/ui";

const ACCEPT = "image/png,image/jpeg,image/webp";

export function Dropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(list: FileList | null) {
    if (!list || disabled) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(files);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-4 border px-6 py-16 text-center transition-colors",
        dragging
          ? "border-accent bg-accent-soft"
          : "border-line-strong bg-surface hover:border-ink",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center border transition-colors",
          dragging ? "border-accent text-accent" : "border-line-strong text-ink-faint",
        )}
      >
        {dragging ? (
          <ImagePlus className="h-5 w-5" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
      </div>

      <div>
        <p className="text-[14px] font-medium text-ink">
          Drop package images here
          <span className="text-ink-faint">, or </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-accent underline-offset-2 hover:underline"
          >
            browse files
          </button>
        </p>
        <Mono muted className="mt-2 block text-[11px] uppercase tracking-[0.1em]">
          PNG · JPG · WEBP · multiple images supported
        </Mono>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => accept(e.target.files)}
      />
    </div>
  );
}
