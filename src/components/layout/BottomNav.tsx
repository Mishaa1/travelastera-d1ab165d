import { Link } from "@tanstack/react-router";
import { Bookmark, Home, Route as RouteIcon, Wand2 } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", Icon: Home, exact: true },
  { to: "/plan", label: "Plan", Icon: Wand2, exact: false },
  { to: "/results", label: "Routes", Icon: RouteIcon, exact: false },
  { to: "/saved", label: "Saved", Icon: Bookmark, exact: false },
] as const;

/** Mobile-first primary navigation. Hidden from md upwards. */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-3 mb-3 flex items-stretch justify-between gap-1 rounded-3xl surface-glass p-1.5 shadow-float">
        {ITEMS.map(({ to, label, Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            activeProps={{ className: "bg-secondary text-foreground" }}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
