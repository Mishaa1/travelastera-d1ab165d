import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/BottomNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

interface PageShellProps {
  children: ReactNode;
  /** Extra bottom padding so the mobile nav never covers content. */
  footer?: boolean;
}

export function PageShell({ children, footer = true }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 pb-28 md:pb-0">
        {children}
      </main>
      {footer && <SiteFooter />}
      <BottomNav />
    </div>
  );
}
