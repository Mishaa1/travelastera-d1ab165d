import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sand/60">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl gradient-sea text-primary-foreground">
                <Compass className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold">Safara</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              An optimisation engine for travel. Tell us the constraints, we search the
              combinations and hand back the trip worth taking.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { to: "/plan", label: "Trip planner" },
              { to: "/results", label: "Optimised routes" },
              { to: "/saved", label: "Saved trips" },
            ]}
          />
          <FooterColumn
            title="Data"
            links={[
              { to: "/", label: "Open-Meteo weather" },
              { to: "/", label: "OpenStreetMap + Nominatim" },
              { to: "/", label: "MapLibre GL" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { to: "/", label: "How it works" },
              { to: "/", label: "FAQ" },
              { to: "/", label: "Contact" },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Safara. Prototype — prices shown are estimates, not live fares.</p>
          <p>Map data © OpenStreetMap contributors</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold tracking-wide uppercase">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
