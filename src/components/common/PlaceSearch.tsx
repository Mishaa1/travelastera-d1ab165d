import { Building2, Clock3, MapPin, Plane, Search, Star } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { flagEmoji, PLACE_BY_ID, suggestedPlaces, type PlaceOption } from "@/data/places";
import { recentPlacesStore } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface PlaceSearchProps {
  id?: string;
  value: string;
  onChange: (value: string, place?: PlaceOption) => void;
  placeholder?: string;
  className?: string;
  /** Compact styling for the landing hero. */
  size?: "default" | "lg";
}

const KIND_ICON = {
  city: MapPin,
  airport: Plane,
  country: Building2,
} as const;

/**
 * Smart location search — cities, airports and countries with instant
 * suggestions, recent picks and popular destinations. Free text is always
 * allowed so the field never blocks a traveller.
 */
export function PlaceSearch({
  id,
  value,
  onChange,
  placeholder = "City, airport or country",
  className,
  size = "default",
}: PlaceSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<PlaceOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const results = useMemo(() => suggestedPlaces(query, 7), [query]);
  const showRecent = !query.trim() && recent.length > 0;
  const options = showRecent ? [...recent, ...results].slice(0, 7) : results;

  function commit(place: PlaceOption) {
    setQuery(place.value);
    setRecent(
      recentPlacesStore
        .push(place.id)
        .map((placeId) => PLACE_BY_ID.get(placeId))
        .filter((entry): entry is PlaceOption => Boolean(entry)),
    );
    onChange(place.value, place);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
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
          }
        }}
        className={cn(
          "w-full rounded-2xl border border-input bg-background pr-3 pl-9 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "lg" ? "h-12" : "h-10",
        )}
      />

      {open && options.length > 0 && (
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
          {!query.trim() && !showRecent && (
            <li className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Star className="h-3 w-3" aria-hidden /> Popular right now
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
                    index === active ? "bg-secondary" : "hover:bg-secondary/60",
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
        </ul>
      )}
    </div>
  );
}
