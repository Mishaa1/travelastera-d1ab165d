import { Building2, Clock3, Loader2, MapPin, Plane, Search, Star, WifiOff } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { flagEmoji, PLACE_BY_ID, POPULAR_PLACES, type PlaceOption } from "@/data/places";
import { recentPlacesStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { searchLocations, searchLocationsLocal } from "@/services/locationService";

export interface LocationAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string, place?: PlaceOption) => void;
  placeholder?: string;
  className?: string;
  /** Compact styling for the landing hero. */
  size?: "default" | "lg";
  /** Optional icon slot override, e.g. a plane for the origin field. */
  icon?: "search" | "pin" | "plane";
  "aria-label"?: string;
}

const KIND_ICON = {
  city: MapPin,
  airport: Plane,
  country: Building2,
} as const;

const LEAD_ICON = { search: Search, pin: MapPin, plane: Plane } as const;

const DEBOUNCE_MS = 180;
const MAX_RESULTS = 8;

/**
 * The single location field used everywhere in Astera.
 *
 * Searches cities, airports (by name or IATA) and countries. The bundled
 * gazetteer answers instantly and a remote lookup widens coverage in the
 * background — if the network is unavailable the field still works, so a
 * traveller is never blocked. Free text is always accepted.
 */
export function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder = "City, airport or country",
  className,
  size = "default",
  icon = "search",
  "aria-label": ariaLabel,
}: LocationAutocompleteProps) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<PlaceOption[]>([]);
  const [results, setResults] = useState<PlaceOption[]>(() => searchLocationsLocal("", MAX_RESULTS));
  const [loading, setLoading] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    setRecent(
      recentPlacesStore
        .all()
        .map((placeId) => PLACE_BY_ID.get(placeId))
        .filter((place): place is PlaceOption => Boolean(place)),
    );
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Local results are painted synchronously; remote widening arrives after.
  useEffect(() => {
    const trimmed = query.trim();
    const local = searchLocationsLocal(trimmed, MAX_RESULTS);
    setResults(local);

    if (trimmed.length < 3) {
      setLoading(false);
      setLocalOnly(false);
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      const { places, localOnly: offline } = await searchLocations(
        trimmed,
        MAX_RESULTS,
        controller.signal,
      );
      if (id !== requestId.current) return;
      if (places.length) setResults(places);
      setLocalOnly(offline && local.length === 0);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const trimmed = query.trim();
  const showRecent = !trimmed && recent.length > 0;
  const options = useMemo(() => {
    if (showRecent) {
      const seen = new Set(recent.map((place) => place.id));
      return [...recent, ...results.filter((place) => !seen.has(place.id))].slice(0, MAX_RESULTS);
    }
    return results;
  }, [showRecent, recent, results]);

  const commit = useCallback(
    (place: PlaceOption) => {
      setQuery(place.value);
      setRecent(
        recentPlacesStore
          .push(place.id)
          .map((placeId) => PLACE_BY_ID.get(placeId))
          .filter((entry): entry is PlaceOption => Boolean(entry)),
      );
      onChange(place.value, place);
      setOpen(false);
    },
    [onChange],
  );

  const LeadIcon = LEAD_ICON[icon];
  const noResults = Boolean(trimmed) && !loading && options.length === 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <LeadIcon
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      {loading && (
        <Loader2
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      )}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          onChange(event.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % Math.max(1, options.length));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + options.length) % Math.max(1, options.length));
          } else if (event.key === "Enter" && options[active]) {
            event.preventDefault();
            commit(options[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
        }}
        className={cn(
          "w-full rounded-2xl border border-input bg-background pr-9 pl-9 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "lg" ? "h-12" : "h-10",
        )}
      />

      {open && (options.length > 0 || noResults) && (
        <ul
          id={listId}
          role="listbox"
          className="animate-fade-in absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-popover p-1.5 shadow-float"
        >
          {showRecent && (
            <li className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock3 className="h-3 w-3" aria-hidden /> Recent
            </li>
          )}
          {!trimmed && !showRecent && (
            <li className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Star className="h-3 w-3" aria-hidden /> Popular right now
            </li>
          )}
          {localOnly && trimmed && (
            <li className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground">
              <WifiOff className="h-3 w-3" aria-hidden /> Showing our offline list
            </li>
          )}

          {options.map((place, index) => {
            const Icon = KIND_ICON[place.kind];
            return (
              <li key={place.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(place)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                    index === active
                      ? "bg-aegean text-primary-foreground"
                      : "transition-colors duration-200 hover:bg-aegean hover:text-primary-foreground",
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {flagEmoji(place.countryCode)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {place.subtitle}
                    </span>
                  </span>
                  {place.code && (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide">
                      {place.code}
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {noResults && (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No match for “{trimmed}”</p>
              <p className="mt-0.5 text-xs">
                We'll still use it as typed. Try a nearby city or an airport code like LHR.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {POPULAR_PLACES.slice(0, 4).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => commit(place)}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-aegean hover:text-primary-foreground"
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
