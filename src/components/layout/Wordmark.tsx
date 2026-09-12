import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Renders the small orbit/star mark before the wordmark. */
  withMark?: boolean;
  size?: "sm" | "md" | "lg";
  signature?: boolean;
}

const SIZE: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl md:text-4xl",
};

/** ASTERA — elegant high-contrast serif, generous tracking, always uppercase. */
export function Wordmark({ className, withMark = false, size = "md", signature = false }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {withMark && <OrbitMark className="h-[1em] w-[1em] shrink-0" />}
      <span className="inline-flex flex-col leading-none">
        <span className={cn("font-display font-semibold wordmark-track", SIZE[size])}>ASTERA</span>
        {signature && (
          <span className="mt-1 text-center font-serif-display text-[8px] font-light italic tracking-[.16em] opacity-55">
            by Mehrmah labs
          </span>
        )}
      </span>
    </span>
  );
}

/** Minimal star-in-orbit glyph. */
export function OrbitMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="5.2"
        transform="rotate(-24 12 12)"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.55"
      />
      <path
        d="M12 5.4l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"
        fill="currentColor"
      />
    </svg>
  );
}
