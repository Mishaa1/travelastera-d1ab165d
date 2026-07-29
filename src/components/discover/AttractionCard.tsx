import { motion } from "motion/react";
import { ArrowUpRight, Clock3, Info, Sparkles, Star } from "lucide-react";

import { DataBadge } from "@/components/common/DataBadge";
import { ExperienceImage } from "@/components/common/ExperienceImage";
import { FavouriteButton } from "@/components/discover/FavouriteButton";
import { CATEGORY_LABEL, formatMinutes, type Attraction } from "@/services/experienceService";
import { cn } from "@/lib/utils";

interface AttractionCardProps {
  attraction: Attraction;
  index?: number;
  /** Small label above the title, e.g. the itinerary period. */
  eyebrow?: string;
  /** Short descriptive hook shown instead of the historic note. */
  hook?: string;
  /** Overrides the "best for" chips. */
  tags?: string[];
  /** Denser layout used inside the day timeline. */
  variant?: "default" | "compact";
  /** Opens the Astera Story panel. */
  onOpen?: () => void;
  className?: string;
}

/** Visual-first attraction card that always explains itself. */
export function AttractionCard({
  attraction,
  index = 0,
  eyebrow,
  hook,
  tags,
  variant = "default",
  onOpen,
  className,
}: AttractionCardProps) {
  const compact = variant === "compact";
  const chips = tags ?? attraction.bestFor.map((tag) => `Best for ${tag.toLowerCase()}`);

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index, 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "card-lift group flex flex-col overflow-hidden rounded-4xl border border-border bg-card shadow-soft",
        compact && "rounded-3xl",
        className,
      )}
    >
      <div className="relative">
        <ExperienceImage
          src={attraction.image}
          alt={`${attraction.name} in ${attraction.city}`}
          ratioClassName={compact ? "aspect-[3/2]" : "aspect-[4/3]"}
          overlay
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
          <span className="rounded-full bg-ink/45 px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground uppercase backdrop-blur-sm">
            {eyebrow ?? CATEGORY_LABEL[attraction.category]}
          </span>
          <FavouriteButton
            item={{
              id: attraction.id,
              kind: "attraction",
              title: attraction.name,
              subtitle: attraction.location,
              image: attraction.image,
              meta: CATEGORY_LABEL[attraction.category],
            }}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3
            className={cn(
              "font-display leading-tight font-semibold text-primary-foreground",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            {attraction.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/85">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {attraction.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {formatMinutes(attraction.visitMinutes)}
            </span>
            {!compact && <span>{attraction.priceLabel}</span>}
          </p>
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col gap-3 p-4 sm:p-5", !compact && "gap-4")}>
        {hook && <p className="text-sm leading-relaxed text-foreground/90">{hook}</p>}

        <div className="rounded-2xl bg-secondary/70 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Why Astera picked this
          </p>
          <p className="mt-1 leading-relaxed">{attraction.why}</p>
        </div>

        {!hook && (
          <p className="flex gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {attraction.historicNote}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {chips.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          <DataBadge quality={attraction.quality} className="ml-auto" />
        </div>

        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 self-start rounded-full text-sm font-semibold text-primary transition-colors duration-200 hover:text-teal focus-visible:underline"
          >
            Astera Story
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        )}
      </div>
    </motion.article>
  );
}
