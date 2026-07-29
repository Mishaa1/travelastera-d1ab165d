import { Crown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

interface PremiumTeaserProps {
  title: string;
  description: string;
  items: string[];
  className?: string;
}

/**
 * Placeholder for the paid tier. Deliberately non-functional — it signals
 * where Astera Premium lands without pretending the feature exists yet.
 */
export function PremiumTeaser({ title, description, items, className }: PremiumTeaserProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-secondary/80 to-card p-6 shadow-soft sm:p-8",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground uppercase">
        <Crown className="h-3.5 w-3.5" aria-hidden />
        Astera Premium · coming soon
      </span>

      <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-muted-foreground">
        Nothing here is billable yet — these panels mark where the paid tier will slot in.
      </p>
    </section>
  );
}
