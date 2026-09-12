import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, Pencil, RotateCcw, Save, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PlaceSearch } from "@/components/common/PlaceSearch";
import { Textarea } from "@/components/ui/textarea";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency, formatDate, nightsBetween } from "@/lib/format";
import type {
  Activity,
  Diet,
  Interest,
  LuxuryLevel,
  TransportMode,
  TravelStyle,
} from "@/lib/types";
import { DIET_LABEL } from "@/services/experienceService";
import { isDiscoveryTrip } from "@/services/tripOptimizer";
import { cn } from "@/lib/utils";
import { collaborationApi } from "@/services/collaborationService";
import { toast } from "sonner";

const TITLE = "Plan a trip — Astera trip optimiser";
const DESCRIPTION =
  "Five short steps: basics, travel style, interests, food and practicalities. Astera searches every combination and returns four optimised routes.";

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
  { id: "food", label: "Food", hint: "Markets, tastings, tables" },
  { id: "history", label: "History & culture", hint: "Old towns, ruins, castles" },
  { id: "museums", label: "Museums", hint: "Art and collections" },
  { id: "nature", label: "Nature", hint: "Lakes, ridges, coastline" },
  { id: "adventure", label: "Adventure", hint: "Hikes, water, altitude" },
  { id: "photography", label: "Photography", hint: "Light, views, texture" },
  { id: "shopping", label: "Shopping", hint: "Design, vintage, makers" },
  { id: "nightlife", label: "Nightlife", hint: "Bars and late music" },
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

const DIETS: Diet[] = [
  "local-cuisine",
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "seafood",
  "fine-dining",
  "street-food",
  "coffee",
  "dessert",
];

const STYLES: { id: TravelStyle; label: string; hint: string }[] = [
  { id: "couple", label: "Couple", hint: "Two of you, quieter evenings" },
  { id: "family", label: "Family", hint: "Shorter transfers, green space" },
  { id: "friends", label: "Friends", hint: "Central stays, late nights" },
  { id: "solo", label: "Solo", hint: "Safe, social, easy to navigate" },
  { id: "business", label: "Business", hint: "Transit links and reliability" },
  { id: "honeymoon", label: "Honeymoon", hint: "Views, privacy, one big dinner" },
];

/** Pace maps onto how much ground the engine is allowed to cover. */
const PACE: { id: string; label: string; hint: string; hours: number; fewerHotels: boolean }[] = [
  { id: "relaxed", label: "Relaxed", hint: "Few moves, long mornings", hours: 8, fewerHotels: true },
  { id: "balanced", label: "Balanced", hint: "A good mix", hours: 14, fewerHotels: false },
  { id: "fast", label: "Fast-paced", hint: "See as much as possible", hours: 26, fewerHotels: false },
];

const ACTIVITIES: { id: Activity; label: string }[] = [
  { id: "nature", label: "Nature" },
  { id: "mountains", label: "Mountains" },
  { id: "lakes", label: "Lakes" },
  { id: "beaches", label: "Beaches" },
  { id: "museums", label: "Museums" },
  { id: "castles", label: "Castles" },
  { id: "architecture", label: "Architecture" },
  { id: "shopping", label: "Shopping" },
  { id: "luxury", label: "Luxury" },
  { id: "hidden-gems", label: "Hidden gems" },
  { id: "photography", label: "Photography" },
  { id: "hiking", label: "Hiking" },
  { id: "theme-parks", label: "Theme parks" },
  { id: "nightlife", label: "Nightlife" },
];

const STEPS = [
  { title: "Trip basics", why: "Origin, dates and budget set the search space — nothing is priced without them." },
  { title: "Travel style", why: "Pace and company change how far apart your stops can be." },
  { title: "Interests", why: "Every candidate city is scored against what you actually enjoy." },
  { title: "Food & practical", why: "We filter restaurants and transport instead of suggesting things you can't use." },
  { title: "Review", why: "One last look before the engine searches every combination." },
] as const;

function PlanPage() {
  const navigate = useNavigate();
  const { preferences, update, reset } = useTripDraft();
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const [groupOpen, setGroupOpen] = useState(false);
  const [organizerName, setOrganizerName] = useState("");
  const [travellerNames, setTravellerNames] = useState(["", ""]);
  const [groupToken, setGroupToken] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const nights = nightsBetween(preferences.startDate, preferences.endDate);
  const perDay = Math.round(preferences.budget / Math.max(1, nights * preferences.travellers));
  const progress = ((step + 1) / STEPS.length) * 100;
  const discovery = isDiscoveryTrip(preferences);

  const datesReady =
    preferences.dateMode === "flexible"
      ? Boolean(preferences.flexibleMonth) && preferences.flexibleNights >= 2
      : Boolean(preferences.startDate && preferences.endDate);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(preferences.startCity.trim()) && datesReady && preferences.budget > 0;
      case 1:
        return Boolean(preferences.travelStyle);
      case 2:
        return preferences.interests.length > 0;
      default:
        return true;
    }
  }, [step, preferences, datesReady]);

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

  const activePace =
    PACE.find((pace) => pace.hours === preferences.maxTravelHours)?.id ?? "balanced";

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <PageShell footer={false}>
      <div className="mx-auto max-w-6xl px-5 pt-28 pb-20 md:px-8 md:pt-40">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-teal uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-2 truncate font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold">
              {STEPS[step].title}
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
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Takes about one minute
          </span>
          <span className="flex items-center gap-2">
            <Save className="h-3.5 w-3.5" aria-hidden /> Progress saves automatically in this browser
          </span>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card/75 shadow-soft">
          <button type="button" onClick={() => setGroupOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal/10 text-teal"><Users className="h-5 w-5" aria-hidden /></span><span><strong className="block font-display text-lg">Planning with others?</strong><span className="text-sm text-muted-foreground">Invite everyone to add their own preferences before ASTERA optimises.</span></span></span>
            <span className="text-sm font-semibold text-teal">{groupOpen ? "Close" : "Set up"}</span>
          </button>
          {groupOpen && <div className="border-t border-border px-5 py-5">
            {groupToken ? <div className="rounded-2xl bg-secondary/55 p-4"><p className="text-sm font-semibold">Your invite is ready</p><p className="mt-1 text-xs text-muted-foreground">Responses are stored with this shared trip and survive reloads.</p><div className="mt-3 flex gap-2"><Input readOnly value={typeof window === "undefined" ? `/collaborate/${groupToken}` : `${window.location.origin}/collaborate/${groupToken}`} /><Button type="button" variant="outline" onClick={async()=>{await navigator.clipboard.writeText(`${window.location.origin}/collaborate/${groupToken}`);toast.success("Invite link copied");}}><Copy aria-hidden/>Copy</Button></div></div> : <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr_auto] md:items-end"><Field label="Organiser name" id="organizer-name"><Input id="organizer-name" value={organizerName} onChange={(e)=>setOrganizerName(e.target.value)} placeholder="Your name" /></Field><Field label="Traveller names" id="traveller-names"><Input id="traveller-names" value={travellerNames.join(", ")} onChange={(e)=>setTravellerNames(e.target.value.split(","))} placeholder="Alex, Sam, Jamie" /></Field><Button type="button" variant="hero" disabled={creatingGroup || !organizerName.trim() || !travellerNames.some(n=>n.trim())} onClick={async()=>{setCreatingGroup(true);try{const result=await collaborationApi.create(organizerName,travellerNames.map(n=>n.trim()).filter(Boolean),preferences);setGroupToken(result.token);toast.success("Shared trip created");}catch(error){toast.error(error instanceof Error?error.message:"Could not create invite");}finally{setCreatingGroup(false);}}}>{creatingGroup?"Creating…":"Create invite"}</Button></div>}
          </div>}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0">
            <p className="mb-4 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
              Why we ask this — {STEPS[step].why}
            </p>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                transition={transition}
                className="space-y-8"
              >
                {step === 0 && (
                  <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Starting from" id="start-city">
                        <PlaceSearch
                          id="start-city"
                          size="lg"
                          icon="plane"
                          value={preferences.startCity}
                          onChange={(value) => update("startCity", value)}
                          placeholder="City or airport"
                        />
                      </Field>
                      <Field label="End city · optional" id="end-city">
                        <PlaceSearch
                          id="end-city"
                          size="lg"
                          icon="pin"
                          value={preferences.endCity}
                          onChange={(value) => update("endCity", value)}
                          placeholder="Leave blank and ASTERA will discover destinations"
                        />
                      </Field>
                    </div>

                    <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                      {discovery
                        ? "ASTERA will compare destinations that fit your budget and preferences."
                        : `Destination-specific: flights, schedule, experiences and budget are optimised around ${preferences.endCity.trim()}.`}
                    </p>

                    <fieldset>
                      <legend className="text-xs font-semibold tracking-wide uppercase">Dates</legend>
                      <div className="mt-3 flex gap-2">
                        {(["exact", "flexible"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={preferences.dateMode === mode}
                            onClick={() => update("dateMode", mode)}
                            className={cn(
                              "rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                              preferences.dateMode === mode
                                ? "border-primary/40 bg-primary/10"
                                : "border-border text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {mode} dates
                          </button>
                        ))}
                      </div>

                      {preferences.dateMode === "exact" ? (
                        <div className="mt-4 grid gap-5 sm:grid-cols-2">
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
                      ) : (
                        <div className="mt-4 grid gap-5 sm:grid-cols-2">
                          <Field label="Month" id="flex-month">
                            <Input
                              id="flex-month"
                              type="month"
                              className="h-12 rounded-2xl"
                              value={preferences.flexibleMonth}
                              onChange={(event) => update("flexibleMonth", event.target.value)}
                            />
                          </Field>
                          <Field label="Nights" id="flex-nights">
                            <Input
                              id="flex-nights"
                              type="number"
                              min={2}
                              max={30}
                              className="h-12 rounded-2xl"
                              value={preferences.flexibleNights}
                              onChange={(event) =>
                                update(
                                  "flexibleNights",
                                  Math.max(2, Math.min(30, Number(event.target.value) || 7)),
                                )
                              }
                            />
                          </Field>
                        </div>
                      )}
                    </fieldset>

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
                  <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
                    <fieldset>
                      <legend className="text-xs font-semibold tracking-wide uppercase">Pace</legend>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {PACE.map((pace) => (
                          <OptionTile
                            key={pace.id}
                            label={pace.label}
                            hint={pace.hint}
                            active={activePace === pace.id}
                            onClick={() => {
                              update("maxTravelHours", pace.hours);
                              update("fewerHotelChanges", pace.fewerHotels);
                            }}
                          />
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="text-xs font-semibold tracking-wide uppercase">
                        Who is travelling
                      </legend>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {STYLES.map((style) => (
                          <OptionTile
                            key={style.id}
                            label={style.label}
                            hint={style.hint}
                            active={preferences.travelStyle === style.id}
                            onClick={() => update("travelStyle", style.id)}
                          />
                        ))}
                      </div>
                    </fieldset>

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

                {step === 2 && (
                  <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Pick at least one. These weight every city in the search.
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {INTERESTS.map((interest) => (
                          <OptionTile
                            key={interest.id}
                            label={interest.label}
                            hint={interest.hint}
                            active={preferences.interests.includes(interest.id)}
                            onClick={() =>
                              update("interests", toggle(preferences.interests, interest.id))
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <fieldset>
                      <legend className="text-xs font-semibold tracking-wide uppercase">
                        Activities you want
                      </legend>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {ACTIVITIES.map((activity) => (
                          <Chip
                            key={activity.id}
                            label={activity.label}
                            active={(preferences.activities ?? []).includes(activity.id)}
                            onClick={() =>
                              update("activities", toggle(preferences.activities ?? [], activity.id))
                            }
                          />
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
                    <fieldset>
                      <legend className="text-xs font-semibold tracking-wide uppercase">
                        Food preferences
                      </legend>
                      <p className="mt-2 text-sm text-muted-foreground">
                        We use these to filter every restaurant we suggest — and to say why.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Chip
                          label="No dietary preference"
                          active={(preferences.diets ?? []).length === 0}
                          onClick={() => update("diets", [])}
                        />
                        {DIETS.map((diet) => (
                          <Chip
                            key={diet}
                            label={DIET_LABEL[diet]}
                            active={(preferences.diets ?? []).includes(diet)}
                            onClick={() => update("diets", toggle(preferences.diets ?? [], diet))}
                          />
                        ))}
                      </div>
                    </fieldset>

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
                        label="Avoid flying"
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

                    <fieldset className="rounded-3xl border border-teal/20 bg-teal/[0.045] p-5">
                      <legend className="px-2 text-xs font-semibold tracking-wide uppercase">
                        Explore nearby possibilities
                      </legend>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Optional. ASTERA verifies nearby places, then lets the AI compare regional routes without replacing your requested destination.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {([
                          ["off", "Off"],
                          ["day-trips", "Day trips"],
                          ["nearby-cities", "Nearby cities"],
                          ["surprise", "Surprise me"],
                        ] as const).map(([value, label]) => (
                          <Chip key={value} label={label} active={(preferences.regionalDiscovery ?? "nearby-cities") === value} onClick={() => update("regionalDiscovery", value)} />
                        ))}
                      </div>
                      {(preferences.regionalDiscovery ?? "nearby-cities") !== "off" && (
                        <div className="mt-5 grid gap-5 lg:grid-cols-3">
                          <fieldset>
                            <legend className="text-xs font-semibold text-muted-foreground">Maximum extra travel</legend>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {([60, 120, 240] as const).map((minutes) => <Chip key={minutes} label={minutes < 120 ? "1 hour" : `${minutes / 60} hours`} active={(preferences.maxAdditionalTravelMinutes ?? 120) === minutes} onClick={() => update("maxAdditionalTravelMinutes", minutes)} />)}
                            </div>
                          </fieldset>
                          <fieldset>
                            <legend className="text-xs font-semibold text-muted-foreground">Hotel changes</legend>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {([['none','None'],['one','One'],['flexible','Flexible']] as const).map(([value,label]) => <Chip key={value} label={label} active={(preferences.regionalHotelChanges ?? "one") === value} onClick={() => update("regionalHotelChanges", value)} />)}
                            </div>
                          </fieldset>
                          <fieldset>
                            <legend className="text-xs font-semibold text-muted-foreground">New country</legend>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Chip label="Allowed" active={preferences.allowNewCountry !== false} onClick={() => update("allowNewCountry", true)} />
                              <Chip label="Same country only" active={preferences.allowNewCountry === false} onClick={() => update("allowNewCountry", false)} />
                            </div>
                          </fieldset>
                        </div>
                      )}
                    </fieldset>

                    <Field label="Anything else we should know?" id="notes">
                      <Textarea
                        id="notes"
                        rows={4}
                        className="rounded-2xl"
                        value={preferences.notes ?? ""}
                        onChange={(event) => update("notes", event.target.value)}
                        placeholder="e.g. I already have accommodation in Vienna, I want to avoid crowded cities, one of us cannot walk far."
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Free text — including accessibility needs. The optimiser reads it and
                        explains how it used it.
                      </p>
                    </Field>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
                    <ReviewRow
                      title="Trip basics"
                      onEdit={() => setStep(0)}
                      lines={[
                        `${preferences.startCity || "—"} → ${preferences.endCity.trim() || "Anywhere (discovery)"}`,
                        preferences.dateMode === "flexible"
                          ? `Flexible · ${preferences.flexibleMonth} · ${preferences.flexibleNights} nights`
                          : `${formatDate(preferences.startDate)} – ${formatDate(preferences.endDate)} · ${nights} nights`,
                        `${preferences.travellers} ${preferences.travellers === 1 ? "traveller" : "travellers"} · ${formatCurrency(preferences.budget, preferences.currency)}`,
                      ]}
                    />
                    <ReviewRow
                      title="Travel style"
                      onEdit={() => setStep(1)}
                      lines={[
                        `${PACE.find((p) => p.id === activePace)?.label ?? "Balanced"} pace · ${STYLES.find((s) => s.id === preferences.travelStyle)?.label ?? "—"}`,
                        `${LUXURY.find((l) => l.id === preferences.luxuryLevel)?.label ?? "—"} stays`,
                      ]}
                    />
                    <ReviewRow
                      title="Interests"
                      onEdit={() => setStep(2)}
                      lines={[
                        preferences.interests.length
                          ? preferences.interests
                              .map((id) => INTERESTS.find((i) => i.id === id)?.label ?? id)
                              .join(", ")
                          : "None selected",
                        (preferences.activities ?? []).length
                          ? (preferences.activities ?? []).join(", ")
                          : "No specific activities",
                      ]}
                    />
                    <ReviewRow
                      title="Food & practical"
                      onEdit={() => setStep(3)}
                      lines={[
                        (preferences.diets ?? []).length
                          ? (preferences.diets ?? []).map((d) => DIET_LABEL[d]).join(", ")
                          : "No dietary preference",
                        `${TRANSPORT.find((t) => t.id === preferences.transport)?.label} · max ${preferences.maxTravelHours}h${preferences.avoidFlights ? " · avoiding flights" : ""}${preferences.fewerHotelChanges ? " · fewer hotel changes" : ""}`,
                        `Regional discovery: ${(preferences.regionalDiscovery ?? "nearby-cities").replace("-", " ")} · max ${preferences.maxAdditionalTravelMinutes ?? 120} min extra travel · ${preferences.regionalHotelChanges ?? "one"} hotel change${(preferences.regionalHotelChanges ?? "one") === "one" ? "" : "s"} · ${preferences.allowNewCountry === false ? "same country" : "new countries allowed"}`,
                        preferences.notes?.trim() ? `“${preferences.notes.trim()}”` : "No extra notes",
                      ]}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>

              {step < STEPS.length - 1 ? (
                <Button
                  variant="hero"
                  size="lg"
                  disabled={!canContinue}
                  onClick={() => setStep((value) => value + 1)}
                >
                  Continue
                  <ArrowRight aria-hidden />
                </Button>
              ) : (
                <Button variant="hero" size="lg" onClick={async () => {
                  if (groupToken) {
                    try { await collaborationApi.updatePreferences(groupToken, preferences); }
                    catch (error) { toast.error(error instanceof Error ? error.message : "Could not sync the shared trip"); return; }
                  }
                  void navigate({ to: "/results", search: groupToken ? { group: groupToken } : {} });
                }}>
                  Find my routes
                  <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>

          {/* Persistent compact summary of everything answered so far. */}
          <aside className="rounded-4xl border border-border bg-card/70 p-5 shadow-soft lg:sticky lg:top-28">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Your trip so far
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label="Route"
                value={`${preferences.startCity || "—"} → ${preferences.endCity.trim() || "Discovery"}`}
              />
              <SummaryRow
                label="When"
                value={
                  preferences.dateMode === "flexible"
                    ? `${preferences.flexibleMonth || "—"} · ${preferences.flexibleNights}n`
                    : `${nights} nights`
                }
              />
              <SummaryRow
                label="Budget"
                value={formatCurrency(preferences.budget, preferences.currency)}
              />
              <SummaryRow label="Travellers" value={String(preferences.travellers)} />
              {step >= 1 && (
                <SummaryRow
                  label="Style"
                  value={STYLES.find((s) => s.id === preferences.travelStyle)?.label ?? "—"}
                />
              )}
              {step >= 2 && (
                <SummaryRow
                  label="Interests"
                  value={preferences.interests.length ? `${preferences.interests.length} chosen` : "—"}
                />
              )}
              {step >= 3 && (
                <SummaryRow
                  label="Food"
                  value={
                    (preferences.diets ?? []).length
                      ? `${(preferences.diets ?? []).length} preference${(preferences.diets ?? []).length === 1 ? "" : "s"}`
                      : "No preference"
                  }
                />
              )}
            </dl>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function ReviewRow({
  title,
  lines,
  onEdit,
}: {
  title: string;
  lines: string[];
  onEdit: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-3xl border border-border bg-background p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide uppercase">{title}</p>
        {lines.map((line) => (
          <p key={line} className="mt-1 text-sm text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil aria-hidden />
        Edit
      </Button>
    </div>
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
        "min-h-16 rounded-3xl border p-4 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary/50 bg-primary/10 shadow-soft ring-1 ring-primary/20"
          : "border-border bg-background hover:-translate-y-0.5 hover:shadow-soft",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {active && <Check className="h-4 w-4 shrink-0 text-emerald" aria-hidden />}
      </span>
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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary/50 bg-primary/10 text-foreground shadow-soft"
          : "border-border bg-background text-muted-foreground hover:-translate-y-0.5 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
