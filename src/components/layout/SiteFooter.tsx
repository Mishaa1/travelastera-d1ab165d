import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/layout/Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sand/60">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Wordmark withMark size="md" />
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
          <p>© {new Date().getFullYear()} Astera. Prototype — prices shown are estimates, not live fares.</p>
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
              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-aegean"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
