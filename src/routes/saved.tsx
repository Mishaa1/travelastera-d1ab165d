import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, GitCompare, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Reveal } from "@/components/common/Reveal";
import { ScoreRing } from "@/components/common/ScoreRing";
import { PageShell } from "@/components/layout/PageShell";
import { CompareTable } from "@/components/trip/CompareTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";

const TITLE = "Saved trips — Safara";
const DESCRIPTION =
  "Your saved Safara routes, stored in this browser. Rename them, compare them side by side or open the full itinerary.";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { trips, remove, rename } = useSavedTrips();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const compared = trips.filter((trip) => compareIds.includes(trip.id)).map((trip) => trip.route);

  const commitRename = (id: string) => {
    if (draftName.trim()) rename(id, draftName.trim());
    setEditingId(null);
  };

  return (
    <PageShell>
      <div className="gradient-canvas">
        <div className="mx-auto max-w-6xl px-5 pt-28 pb-10 md:px-8 md:pt-40">
          <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] leading-[1.02] font-semibold">
            Saved trips
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Stored in this browser only — no account, nothing uploaded.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        {trips.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-border bg-card/60 px-6 py-20 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl gradient-sea text-primary-foreground">
              <Bookmark className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-6 font-display text-2xl font-semibold">Nothing saved yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Run an optimisation and tap the bookmark on any route you want to keep.
            </p>
            <Button asChild variant="hero" className="mt-8">
              <Link to="/plan">Optimise a trip</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {trips.map((trip, index) => (
              <Reveal as="li" key={trip.id} delay={index * 0.06}>
                <article className="card-lift overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={trip.route.image}
                      alt={trip.route.stops.map((stop) => stop.name).join(", ")}
                      width={1280}
                      height={960}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                    <div className="absolute right-4 bottom-4">
                      <ScoreRing value={trip.route.scores.overall} size={56} />
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    {editingId === trip.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitRename(trip.id);
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          autoFocus
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={() => commitRename(trip.id)}
                          className="h-10 rounded-2xl"
                          aria-label="Trip name"
                        />
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <h2 className="font-display text-xl font-semibold">{trip.name}</h2>
                    )}

                    <p className="text-sm text-muted-foreground">
                      {trip.route.stops.map((stop) => stop.name).join(" → ")}
                    </p>
                    <p className="text-sm tabular-nums">
                      {formatCurrency(trip.route.cost, trip.route.preferences.currency)} ·{" "}
                      {formatHours(trip.route.journeyHours)} in transit · saved{" "}
                      {formatDate(trip.savedAt)}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="hero" size="sm" className="flex-1 min-w-28">
                        <Link to="/trip/$tripId" params={{ tripId: trip.route.id }}>
                          Open
                        </Link>
                      </Button>
                      <Button
                        variant={compareIds.includes(trip.id) ? "default" : "outline"}
                        size="icon"
                        aria-label={`Compare ${trip.name}`}
                        aria-pressed={compareIds.includes(trip.id)}
                        onClick={() =>
                          setCompareIds((current) =>
                            current.includes(trip.id)
                              ? current.filter((id) => id !== trip.id)
                              : current.length >= 3
                                ? current
                                : [...current, trip.id],
                          )
                        }
                      >
                        <GitCompare />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Rename ${trip.name}`}
                        onClick={() => {
                          setEditingId(trip.id);
                          setDraftName(trip.name);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Delete ${trip.name}`}
                        onClick={() => {
                          remove(trip.id);
                          setCompareIds((ids) => ids.filter((id) => id !== trip.id));
                          toast.success("Trip deleted");
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        )}

        {compared.length >= 2 && (
          <div className="mt-10">
            <CompareTable routes={compared} onClear={() => setCompareIds([])} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
