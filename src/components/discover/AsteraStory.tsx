import { Clock3, Compass, Landmark, MapPin, Star, Sparkles, Sunrise } from "lucide-react";

import { DataBadge } from "@/components/common/DataBadge";
import { ExperienceImage } from "@/components/common/ExperienceImage";
import { FavouriteButton } from "@/components/discover/FavouriteButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrbitMark } from "@/components/layout/Wordmark";
import { SLOT_BEST_TIME, type DayExperience } from "@/services/dayExperienceService";
import { CATEGORY_LABEL, formatMinutes } from "@/services/experienceService";

interface AsteraStoryProps {
  experience: DayExperience | null;
  onOpenChange: (open: boolean) => void;
}

/** Expanded, inspirational detail panel for one itinerary experience. */
export function AsteraStory({ experience, onOpenChange }: AsteraStoryProps) {
  const attraction = experience?.attraction;

  return (
    <Dialog open={Boolean(experience)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {experience && attraction && (
          <>
            <div className="relative">
              <ExperienceImage
                src={attraction.image}
                alt={`${attraction.name} in ${attraction.city}`}
                ratioClassName="aspect-[16/9]"
                zoomOnHover={false}
                overlay
              />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-primary-foreground/80 uppercase">
                  <OrbitMark className="h-3.5 w-3.5" />
                  Astera Story · {experience.label}
                </p>
                <DialogTitle className="mt-1.5 font-display text-2xl leading-tight font-semibold text-primary-foreground sm:text-3xl">
                  {attraction.name}
                </DialogTitle>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/85">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                    {attraction.rating.toFixed(1)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {attraction.location}
                  </span>
                  <span>{attraction.priceLabel}</span>
                </p>
              </div>
            </div>

            <DialogHeader className="sr-only">
              <DialogDescription>
                Why Astera selected {attraction.name} for this day of your trip.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 p-5 sm:p-6">
              {attraction.gallery.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {attraction.gallery.slice(0, 3).map((image, index) => (
                    <ExperienceImage
                      key={`${image}-${index}`}
                      src={image}
                      alt={`${attraction.name}, view ${index + 1}`}
                      ratioClassName="aspect-[3/2] rounded-2xl"
                      zoomOnHover={false}
                      width={480}
                      height={320}
                    />
                  ))}
                </div>
              )}

              <section>
                <SectionLabel icon={<Compass className="h-3.5 w-3.5" aria-hidden />}>
                  Why visit
                </SectionLabel>
                <p className="mt-1.5 text-sm leading-relaxed">{experience.hook}</p>
              </section>

              <section className="rounded-3xl bg-secondary/70 p-4">
                <SectionLabel icon={<Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />}>
                  Why Astera picked this
                </SectionLabel>
                <p className="mt-1.5 text-sm leading-relaxed">{attraction.why}</p>
              </section>

              <section>
                <SectionLabel icon={<Landmark className="h-3.5 w-3.5" aria-hidden />}>
                  Significance
                </SectionLabel>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {attraction.historicNote} · {CATEGORY_LABEL[attraction.category]}
                </p>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Fact
                  icon={<Sunrise className="h-4 w-4 text-sunset" aria-hidden />}
                  label="Best time to visit"
                  value={SLOT_BEST_TIME[experience.slot]}
                />
                <Fact
                  icon={<Clock3 className="h-4 w-4 text-teal" aria-hidden />}
                  label="Typical visit"
                  value={formatMinutes(attraction.visitMinutes)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {experience.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
                <DataBadge quality={attraction.quality} showProvider className="ml-auto" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FavouriteButton
                  variant="inline"
                  item={{
                    id: attraction.id,
                    kind: "attraction",
                    title: attraction.name,
                    subtitle: attraction.location,
                    image: attraction.image,
                    meta: CATEGORY_LABEL[attraction.category],
                  }}
                />
                <Button asChild variant="outline">
                  <a
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(
                      `${attraction.name}, ${attraction.location}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <MapPin aria-hidden />
                    Open in Maps
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {icon}
      {children}
    </h4>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm leading-snug">{value}</p>
    </div>
  );
}
