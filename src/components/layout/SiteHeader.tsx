import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/Wordmark";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/auth/types";
import { authApi } from "@/services/authService";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/plan", label: "Plan" },
  { to: "/results", label: "Routes" },
  { to: "/saved", label: "Saved" },
] as const;

const LANDING_NAV = [
  { to: "/", label: "Home" },
  { to: "/plan", label: "How it works" },
  { to: "/results", label: "Trips" },
  { to: "/saved", label: "Saved" },
] as const;

const TRIP_NAV = [
  { to: "/results", label: "Discover" },
  { to: "/saved", label: "Itineraries" },
  { to: "/results", label: "Destinations" },
  { to: "/", label: "About" },
] as const;

export function SiteHeader({
  landing = false,
  tripDetail = false,
}: {
  landing?: boolean;
  tripDetail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  useEffect(() => { void authApi.me().then(({ user }) => setUser(user)).catch(() => undefined); }, []);
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [0, 1]);
  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 72));
  const lightOnHero = landing && !scrolled && !open;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        aria-hidden
        style={{ opacity: blur }}
        className="absolute inset-0 surface-glass border-x-0 border-t-0"
      />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:h-20 md:px-8">
        <Link to="/" className="flex min-w-0 items-center" aria-label="Astera home">
          <Wordmark
            withMark={!landing}
            signature
            size="md"
            className={lightOnHero ? "text-white" : "text-foreground"}
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {(tripDetail ? TRIP_NAV : landing ? LANDING_NAV : NAV).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-250 hover:bg-aegean hover:text-primary-foreground",
                lightOnHero ? "text-white/80" : "text-muted-foreground",
              )}
              activeProps={{
                className: lightOnHero ? "text-white" : "text-foreground bg-secondary",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className={cn("hidden sm:inline-flex", lightOnHero && "text-white hover:bg-white/10 hover:text-white")}>
            <Link to={user ? "/account" : "/login"}>{user ? user.name.split(" ")[0] : "Log in"}</Link>
          </Button>
          {tripDetail && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
            >
              <Link to="/saved">Saved</Link>
            </Button>
          )}
          <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex">
            <Link to="/plan">{landing || tripDetail ? "Plan my trip" : "Optimise a trip"}</Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn("overflow-hidden md:hidden", open && "surface-glass")}
      >
        <nav className="flex flex-col gap-1 px-5 pb-5" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-base font-medium text-muted-foreground transition-colors duration-250 hover:bg-aegean hover:text-primary-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </motion.div>
    </header>
  );
}
