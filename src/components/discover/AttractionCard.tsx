import { motion } from "motion/react";
import { Clock3, Info, Sparkles, Star } from "lucide-react";

import { DataBadge } from "@/components/common/DataBadge";
import { FavouriteButton } from "@/components/discover/FavouriteButton";
import { CATEGORY_LABEL, formatMinutes, type Attraction } from "@/services/experienceService";

interface AttractionCardProps {
  attraction: Attraction;
  index?: number;
}

/** Visual-first attraction card that always explains itself. */
export function AttractionCard({ attraction, index = 0 }: AttractionCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: Math.min(index, 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="card-lift group overflow-hidden rounded-4xl border border-border bg-card shadow-soft"
    >
      <div className="relative h-56 overflow-hidden sm:h-64">
        <img
          src={attraction.image}
          alt={`${attraction.name} in ${attraction.city}`}
          width={1280}
          height={960}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <span className="rounded-full bg-ink/45 px-3 py-1 text-[11px] font-semibold text-primary-foreground backdrop-blur-sm">
            {CATEGORY_LABEL[attraction.category]}
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

        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="font-display text-2xl leading-tight font-semibold text-primary-foreground">
            {attraction.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {attraction.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {formatMinutes(attraction.visitMinutes)}
            </span>
            <span>{attraction.priceLabel}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="flex gap-2 rounded-2xl bg-secondary/70 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">Why we picked this: </span>
            {attraction.why}
          </span>
        </p>

        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {attraction.historicNote}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {attraction.bestFor.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              Best for {tag.toLowerCase()}
            </span>
          ))}
          <DataBadge quality={attraction.quality} className="ml-auto" />
        </div>
      </div>
    </motion.article>
  );
}
