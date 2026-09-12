import { CheckCircle2, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import heroSatellite from "@/assets/hero-satellite.png";
import { Wordmark } from "@/components/layout/Wordmark";

export function AuthBrandPanel() {
  return <aside className="relative hidden min-h-[680px] overflow-hidden rounded-l-[1.75rem] bg-ink text-white lg:block">
    <img src={heroSatellite} alt="Earth at night showing connected destinations" className="absolute inset-0 h-full w-full object-cover opacity-75" />
    <div className="absolute inset-0 bg-gradient-to-b from-[#03101f]/45 via-[#03101f]/45 to-[#03101f]/95" />
    <div className="relative flex h-full flex-col justify-between p-10">
      <Wordmark withMark signature className="text-white" />
      <div className="max-w-sm py-16"><h2 className="font-serif-display text-5xl leading-[.94] font-light">The trips<br/>you dream of,<br/>planned <em className="text-teal">perfectly.</em></h2><p className="mt-7 max-w-xs text-sm leading-relaxed text-white/72">Travel intelligence that balances your budget, time and style—and learns what matters to you.</p></div>
      <div><div className="flex -space-x-2" aria-hidden>{["MK","SA","LR","AM"].map((name)=><span key={name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-[#d8b78f] text-[9px] font-bold text-ink">{name}</span>)}</div><div className="mt-3 text-[#efb642]">★★★★★ <span className="ml-2 text-[10px] text-white/65">Loved by ASTERA travellers</span></div><div className="mt-8 flex gap-5 border-t border-white/15 pt-5 text-[10px] text-white/55"><span className="flex items-center gap-1"><LockKeyhole className="h-3 w-3"/>Secure</span><span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3"/>Private</span><span className="flex items-center gap-1"><Users className="h-3 w-3"/>Built for travellers</span></div></div>
    </div>
  </aside>;
}

export function AuthBenefits() {
  const items = ["Personalised recommendations", "Trips saved across devices", "Travel preferences remembered", "Plan together", "Private by design"];
  return <section className="mx-auto mt-5 grid max-w-6xl gap-3 rounded-3xl border border-border/60 bg-white/70 p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-5">{items.map((item)=><div key={item} className="flex items-center gap-3 text-xs text-ink/75"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><CheckCircle2 className="h-4 w-4"/></span>{item}</div>)}</section>;
}
