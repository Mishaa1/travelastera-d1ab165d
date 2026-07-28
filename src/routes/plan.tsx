import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Save } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { POPULAR_ORIGINS } from "@/data/cities";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency, nightsBetween } from "@/lib/format";
import type { Interest, LuxuryLevel, TransportMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const TITLE = "Plan a trip — Safara trip optimiser";
const DESCRIPTION =
  "Set your budget, dates, start and end city, interests and transport limits. Safara searches every combination and returns four optimised routes.";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: PlanPage,
});

const INTERESTS: { id: Interest; label: string; hint: string }[] = [
  { id: "nature", label: "Nature", hint: "Lakes, ridges, coastline" },
  { id: "food", label: "Food", hint: "Markets, tastings, tables" },
  { id: "shopping", label: "Shopping", hint: "Design, vintage, makers" },
  { id: "photography", label: "Photography", hint: "Light, views, texture" },
  { id: "history", label: "History", hint: "Old towns, ruins, castles" },
  { id: "museums", label: "Museums", hint: "Art and collections" },
  { id: "nightlife", label: "Nightlife", hint: "Bars and late music" },
  { id: "adventure", label: "Adventure", hint: "Hikes, water, altitude" },
  { id: "luxury", label: "Luxury", hint: "Fine stays and service" },
];

const TRANSPORT: { id: TransportMode; label: string; hint: string }[] = [
  { id: "flight", label: "Flight", hint: "Fastest between far stops" },
  { id: "train", label: "Train", hint: "City centre to city centre" },
  { id: "car", label: "Car", hint: "Villages in between" },
  { id: "mixed", label: "Mixed", hint: "Best mode per leg" },
];

const LUXURY: { id: LuxuryLevel; label: string; hint: string }[] = [
  { id: "hostel", label: "Budget", hint: "Hostels and simple rooms" },
  { id: "midscale", label: "Comfortable", hint: "Solid 3-star equivalent" },
  { id: "boutique", label: "Boutique", hint: "Character over chains" },
  { id: "luxury", label: "Luxury", hint: "Best in each city" },
];

const STEPS = ["The basics", "What you enjoy", "How you move"] as const;

function PlanPage() {
  const navigate = useNavigate();
  const { preferences, update, reset } = useTripDraft();
  const [step, setStep] = useState(0);

  const nights = nightsBetween(preferences.startDate, preferences.endDate);
  const perDay = Math.round(preferences.budget / Math.max(1, nights * preferences.travellers));
  const progress = ((step + 1) / STEPS.length) * 100;

  const toggleInterest = (interest: Interest) => {
    const next = preferences.interests.includes(interest)
      ? preferences.interests.filter((item) => item !== interest)
      : [...preferences.interests, interest];
    update("interests", next);
  };

  return (
    <PageShell footer={false}>
      <div className="mx-auto max-w-4xl px-5 pt-28 pb-20 md:px-8 md:pt-40">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-teal uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-2 truncate font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold">
              {STEPS[step]}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="shrink-0">
            <RotateCcw aria-hidden />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>

        <div
          className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Planner progress"
        >
          <motion.div
            className="h-full gradient-dawn"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Save className="h-3.5 w-3.5" aria-hidden />
          Progress saves automatically in this browser.
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 space-y-8"
          >
            {step === 0 && (
              <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-9">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Start city" id="start-city">
                    <Input
                      id="start-city"
                      list="origin-options"
                      className="h-12 rounded-2xl"
                      value={preferences.startCity}
                      onChange={(event) => update("startCity", event.target.value)}
                      placeholder="London"
                    />
                  </Field>
                  <Field label="End city" id="end-city">
                    <Input
                      id="end-city"
                      list="origin-options"
                      className="h-12 rounded-2xl"
                      value={preferences.endCity}
                      onChange={(event) => update("endCity", event.target.value)}
                      placeholder="London"
                    />
                  </Field>
                  <datalist id="origin-options">
                    {POPULAR_ORIGINS.map((origin) => (
                      <option key={origin} value={origin} />
                    ))}
                  </datalist>

                  <Field label="Leaving" id="start-date">
                    <Input
                      id="start-date"
                      type="date"
                      className="h-12 rounded-2xl"
                      value={preferences.startDate}
                      onChange={(event) => update("startDate", event.target.value)}
                    />
                  </Field>
                  <Field label="Returning" id="end-date">
                    <Input
                      id="end-date"
                      type="date"
                      className="h-12 rounded-2xl"
                      value={preferences.endDate}
                      onChange={(event) => update("endDate", event.target.value)}
                    />
                  </Field>
                </div>

                <Field label={`Travellers · ${preferences.travellers}`} id="travellers">
                  <Slider
                    id="travellers"
                    min={1}
                    max={8}
                    step={1}
                    value={[preferences.travellers]}
                    onValueChange={([value]) => update("travellers", value)}
                    className="mt-4"
                  />
                </Field>

                <Field
                  label={`Total budget · ${formatCurrency(preferences.budget, preferences.currency)}`}
                  id="budget"
                >
                  <Slider
                    id="budget"
                    min={400}
                    max={12000}
                    step={100}
                    value={[preferences.budget]}
                    onValueChange={([value]) => update("budget", value)}
                    className="mt-4"
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {nights} nights · about{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(perDay, preferences.currency)}
                    </span>{" "}
                    per traveller per day, all in.
                  </p>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-4xl border border-border bg-card p-6 shadow-soft md:p-9">
                <p className="text-sm text-muted-foreground">
                  Pick as many as you like. These weight every city in the search.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {INTERESTS.map((interest) => {
                    const active = preferences.interests.includes(interest.id);
                    return (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => toggleInterest(interest.id)}
                        aria-pressed={active}
                        className={cn(
                          "group min-h-16 rounded-3xl border p-4 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          active
                            ? "border-primary/40 bg-primary/8 shadow-soft"
                            : "border-border bg-background hover:-translate-y-0.5 hover:shadow-soft",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{interest.label}</span>
                          {active && <Check className="h-4 w-4 text-emerald" aria-hidden />}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {interest.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-9">
                <fieldset>
                  <legend className="text-xs font-semibold tracking-wide uppercase">
                    Preferred transport
                  </legend>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {TRANSPORT.map((mode) => (
                      <OptionTile
                        key={mode.id}
                        label={mode.label}
                        hint={mode.hint}
                        active={preferences.transport === mode.id}
                        onClick={() => update("transport", mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <Field
                  label={`Maximum total travel time · ${preferences.maxTravelHours}h`}
                  id="max-hours"
                >
                  <Slider
                    id="max-hours"
                    min={3}
                    max={40}
                    step={1}
                    value={[preferences.maxTravelHours]}
                    onValueChange={([value]) => update("maxTravelHours", value)}
                    className="mt-4"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ToggleRow
                    id="avoid-flights"
                    label="Avoid flights"
                    hint="Rail and road only, whatever the distance"
                    checked={preferences.avoidFlights}
                    onChange={(value) => update("avoidFlights", value)}
                  />
                  <ToggleRow
                    id="fewer-changes"
                    label="Fewer hotel changes"
                    hint="Longer stays, less packing and unpacking"
                    checked={preferences.fewerHotelChanges}
                    onChange={(value) => update("fewerHotelChanges", value)}
                  />
                </div>

                <fieldset>
                  <legend className="text-xs font-semibold tracking-wide uppercase">
                    Accommodation level
                  </legend>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {LUXURY.map((level) => (
                      <OptionTile
                        key={level.id}
                        label={level.label}
                        hint={level.hint}
                        active={preferences.luxuryLevel === level.id}
                        onClick={() => update("luxuryLevel", level.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            <ArrowLeft aria-hidden />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button variant="hero" size="lg" onClick={() => setStep((value) => value + 1)}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button variant="hero" size="lg" onClick={() => navigate({ to: "/results" })}>
              Optimise my trip
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="text-xs font-semibold tracking-wide uppercase">
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function OptionTile({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-16 rounded-3xl border p-4 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        active
          ? "border-primary/40 bg-primary/8 shadow-soft"
          : "border-border bg-background hover:-translate-y-0.5 hover:shadow-soft",
      )}
    >
      <span className="block font-semibold">{label}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-background p-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="font-semibold">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}
