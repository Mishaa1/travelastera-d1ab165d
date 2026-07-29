import { Info, Radio, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DataQuality } from "@/lib/types";

const STYLES = {
  live: {
    label: "Live price",
    className: "bg-emerald/12 text-emerald border-emerald/30",
    Icon: Radio,
  },
  estimate: {
    label: "Estimated",
    className: "bg-teal/12 text-teal border-teal/30",
    Icon: Sparkles,
  },
  mock: {
    label: "Sample data",
    className: "bg-sunset/15 text-sunset-foreground border-sunset/40",
    Icon: Info,
  },
} as const;


interface DataBadgeProps {
  quality: DataQuality;
  className?: string;
  showProvider?: boolean;
}

/** Never let a number look live when it isn't. */
export function DataBadge({ quality, className, showProvider = false }: DataBadgeProps) {
  const style = STYLES[quality.source];
  const Icon = style.Icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        style.className,
        className,
      )}
      title={`${style.label} · ${quality.provider}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {style.label}
      {showProvider && <span className="font-normal normal-case opacity-70">· {quality.provider}</span>}
    </span>
  );
}
