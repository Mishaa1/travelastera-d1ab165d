import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScoreRing } from "@/components/common/ScoreRing";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/Wordmark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatHours } from "@/lib/format";
import type { TripRoute } from "@/lib/types";

/** Shareable "experience card" — a poster of the optimised trip. */
export function ShareCard({ route }: { route: TripRoute }) {
  const [copied, setCopied] = useState<"link" | "summary" | null>(null);

  const summary = [
    `${route.title} — ${route.stops.map((stop) => stop.name).join(" → ")}`,
    `${route.stops.reduce((total, stop) => total + stop.nights, 0)} nights · ${formatCurrency(route.cost, route.preferences.currency)} · ${formatHours(route.journeyHours)} in transit`,
    `Optimisation score ${route.scores.overall}/100 — planned with Astera.`,
  ].join("\n");

  async function copy(text: string, kind: "link" | "summary") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "link" ? "Link copied" : "Trip summary copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Your browser blocked the clipboard — copy it manually.");
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 aria-hidden />
          Share this trip
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share your experience card</DialogTitle>
          <DialogDescription>
            A snapshot of the route, the score and what it costs. Send it to whoever you're
            travelling with.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-3xl border border-border">
          <img
            src={route.image}
            alt=""
            width={1280}
            height={800}
            className="h-44 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
          <Wordmark
            withMark
            size="sm"
            className="absolute top-3 right-4 text-primary-foreground/90"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-widest text-primary-foreground/75 uppercase">
                {route.countries.join(" · ")}
              </p>
              <p className="truncate font-display text-xl font-semibold text-primary-foreground">
                {route.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-primary-foreground/80">
                {route.stops.map((stop) => stop.name).join(" → ")}
              </p>
            </div>
            <ScoreRing value={route.scores.overall} size={56} className="shrink-0" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Total" value={formatCurrency(route.cost, route.preferences.currency)} />
          <Stat label="In transit" value={formatHours(route.journeyHours)} />
          <Stat
            label="Nights"
            value={String(route.stops.reduce((total, stop) => total + stop.nights, 0))}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="hero" className="flex-1" onClick={() => copy(shareUrl, "link")}>
            {copied === "link" ? <Check aria-hidden /> : <Link2 aria-hidden />}
            Copy link
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => copy(summary, "summary")}>
            {copied === "summary" ? <Check aria-hidden /> : <Copy aria-hidden />}
            Copy summary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/70 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-display text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
