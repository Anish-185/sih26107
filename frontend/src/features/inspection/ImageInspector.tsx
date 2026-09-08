import { useState } from "react";
import { cn } from "@/lib/cn";
import { Mono } from "@/components/ui";
import type { MockDeclaration } from "@/mocks";

/**
 * Package image with OCR bounding regions overlaid. Selecting a declaration
 * elsewhere highlights its region here (and vice-versa). Coordinates are
 * percentages of the image so the overlay tracks any rendered size.
 */
export function ImageInspector({
  images,
  declarations,
  selectedId,
  onSelect,
}: {
  images: { index: number; src: string; label: string }[];
  declarations: MockDeclaration[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const regions = declarations.filter((d) => d.imageIndex === activeImage);
  const image = images[activeImage];

  return (
    <div className="border border-line bg-raised">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <Mono muted className="text-[11px] uppercase tracking-[0.12em]">
          {image.label}
        </Mono>
        <Mono muted className="text-[11px]">
          {regions.length} regions
        </Mono>
      </div>

      <div className="relative overflow-hidden bg-[#efeee9]">
        <img
          src={image.src}
          alt={`${image.label} — inspected package`}
          className="block w-full select-none"
          draggable={false}
        />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {regions.map((d) => {
            const active = d.id === selectedId || d.id === hoverId;
            return (
              <rect
                key={d.id}
                x={d.bbox.x}
                y={d.bbox.y}
                width={d.bbox.w}
                height={d.bbox.h}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-[fill-opacity,stroke] duration-150"
                fill="var(--color-accent)"
                fillOpacity={active ? 0.12 : 0}
                stroke={active ? "var(--color-accent)" : "rgba(23,24,27,0.4)"}
                strokeWidth={active ? 2 : 1}
                onMouseEnter={() => setHoverId(d.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => onSelect(d.id === selectedId ? null : d.id)}
              />
            );
          })}
        </svg>

        {/* label tag for the hovered/selected region */}
        {regions
          .filter((d) => d.id === (hoverId ?? selectedId))
          .map((d) => (
            <div
              key={d.id}
              className="pointer-events-none absolute -translate-y-full border border-accent bg-accent px-1.5 py-0.5 font-mono text-[10px] text-white"
              style={{ left: `${d.bbox.x}%`, top: `${d.bbox.y}%` }}
            >
              {d.label}
            </div>
          ))}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 border-t border-line p-2">
          {images.map((img) => (
            <button
              key={img.index}
              type="button"
              onClick={() => setActiveImage(img.index)}
              className={cn(
                "h-14 w-11 overflow-hidden border",
                img.index === activeImage
                  ? "border-accent"
                  : "border-line hover:border-ink",
              )}
            >
              <img src={img.src} alt={img.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-line px-4 py-2.5">
        <Mono muted className="text-[10px] uppercase tracking-[0.12em]">
          Bounding coordinates are OCR estimates · demo data
        </Mono>
      </div>
    </div>
  );
}
