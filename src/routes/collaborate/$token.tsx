import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blankTravellerProfile } from "@/lib/collaboration/aggregate";
import type { SharedTripView, TravellerProfile } from "@/lib/collaboration/types";
import type { Diet, Interest } from "@/lib/types";
import { collaborationApi } from "@/services/collaborationService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collaborate/$token")({ component: CollaboratePage });
const interests: Interest[] = ["food", "history", "museums", "nature", "photography", "nightlife", "shopping", "adventure", "luxury"];
const diets: Diet[] = ["local-cuisine", "vegetarian", "vegan", "halal", "gluten-free", "seafood"];

function CollaboratePage() {
  const { token } = Route.useParams();
  const [trip, setTrip] = useState<SharedTripView | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<TravellerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { collaborationApi.get(token).then(setTrip).catch((e: Error) => setError(e.message)); }, [token]);
  const traveller = useMemo(() => trip?.travellers.find((item) => item.id === selectedId), [trip, selectedId]);
  useEffect(() => {
    if (!traveller || !trip) return;
    setForm(trip.responses[traveller.id] ?? blankTravellerProfile(traveller.id, traveller.name));
  }, [traveller, trip]);
  const toggle = <T,>(items: T[], value: T) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

  if (error) return <PageShell><main className="mx-auto max-w-2xl px-5 pt-36 pb-24"><h1 className="font-display text-4xl">Invite unavailable</h1><p className="mt-3 text-muted-foreground">{error}</p></main></PageShell>;
  if (!trip) return <PageShell><main className="mx-auto max-w-2xl px-5 pt-36 pb-24">Loading shared trip…</main></PageShell>;

  return <PageShell><main className="mx-auto max-w-3xl px-5 pt-32 pb-24 md:px-8">
    <div className="flex items-center gap-3 text-teal"><Users aria-hidden/><p className="text-xs font-semibold tracking-widest uppercase">Shared trip</p></div>
    <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Add your preferences.</h1>
    <p className="mt-3 text-muted-foreground">{trip.organizerName} invited you to help shape {trip.basePreferences.startCity} → {trip.basePreferences.endCity || "somewhere worth going"}. Hard limits are protected, never averaged away.</p>
    <div className="mt-8 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-8">
      {!form ? <div><Label htmlFor="traveller">Who are you?</Label><select id="traveller" value={selectedId} onChange={(e)=>setSelectedId(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4"><option value="">Choose your name</option>{trip.travellers.map((item)=><option key={item.id} value={item.id}>{item.name}{trip.responses[item.id] ? " · submitted" : ""}</option>)}</select></div> : <form className="space-y-7" onSubmit={async(e)=>{e.preventDefault();setBusy(true);try{const updated=await collaborationApi.submitResponse(token,form);setTrip(updated);toast.success("Your preferences were added.");}catch(err){toast.error(err instanceof Error?err.message:"Could not save");}finally{setBusy(false);}}}>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Your name"><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field><Field label="Your budget ceiling"><Input type="number" min={0} value={form.budgetCeiling ?? ""} onChange={(e)=>setForm({...form,budgetCeiling:e.target.value?Number(e.target.value):null})}/></Field></div>
        <ChoiceSet label="Top interests" values={interests} selected={form.interests} onToggle={(v)=>setForm({...form,interests:toggle(form.interests,v as Interest)})}/>
        <div className="grid gap-5 sm:grid-cols-3"><Select label="Pace" value={form.pace} values={["relaxed","balanced","fast"]} onChange={(v)=>setForm({...form,pace:v as TravellerProfile["pace"]})}/><Select label="Walking tolerance" value={form.walkingTolerance} values={["short","moderate","long"]} onChange={(v)=>setForm({...form,walkingTolerance:v as TravellerProfile["walkingTolerance"]})}/><Select label="Nightlife" value={form.nightlifePreference} values={["avoid","optional","important"]} onChange={(v)=>setForm({...form,nightlifePreference:v as TravellerProfile["nightlifePreference"]})}/></div>
        <ChoiceSet label="Food preferences" values={diets} selected={form.foodPreferences} onToggle={(v)=>setForm({...form,foodPreferences:toggle(form.foodPreferences,v as Diet)})}/>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Must-have"><Textarea value={form.mustHave} onChange={(e)=>setForm({...form,mustHave:e.target.value})}/></Field><Field label="Deal-breaker"><Textarea value={form.dealBreaker} onChange={(e)=>setForm({...form,dealBreaker:e.target.value})}/></Field></div>
        <div className="rounded-3xl bg-secondary/45 p-5"><p className="text-xs font-semibold tracking-wide uppercase">Hard constraints</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Allergies (comma separated)"><Input value={form.allergies.join(", ")} onChange={(e)=>setForm({...form,allergies:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></Field><Field label="Accessibility needs"><Input value={form.accessibilityNeeds.join(", ")} onChange={(e)=>setForm({...form,accessibilityNeeds:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></Field><Field label="Existing accommodation"><Input value={form.existingAccommodation} onChange={(e)=>setForm({...form,existingAccommodation:e.target.value})}/></Field><ChoiceSet label="Transport I cannot use" values={["flight","train","car"]} selected={form.transportExclusions} onToggle={(v)=>setForm({...form,transportExclusions:toggle(form.transportExclusions,v as "flight"|"train"|"car")})}/></div></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={()=>{setSelectedId("");setForm(null);}}>Choose another traveller</Button><Button type="submit" variant="hero" disabled={busy}>{busy?"Saving…":<><Check aria-hidden/>Save my preferences</>}</Button></div>
      </form>}
    </div>
    <Button asChild variant="ghost" className="mt-5"><Link to="/">Back to ASTERA</Link></Button>
  </main></PageShell>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block"><span className="text-xs font-semibold tracking-wide uppercase">{label}</span><span className="mt-2 block">{children}</span></label>; }
function Select({label,value,values,onChange}:{label:string;value:string;values:string[];onChange:(v:string)=>void}) { return <Field label={label}><select value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 w-full rounded-2xl border border-border bg-background px-3 capitalize">{values.map(v=><option key={v}>{v}</option>)}</select></Field>; }
function ChoiceSet({label,values,selected,onToggle}:{label:string;values:readonly string[];selected:readonly string[];onToggle:(v:string)=>void}) { return <fieldset><legend className="text-xs font-semibold tracking-wide uppercase">{label}</legend><div className="mt-3 flex flex-wrap gap-2">{values.map(v=><button key={v} type="button" aria-pressed={selected.includes(v)} onClick={()=>onToggle(v)} className={cn("rounded-full border px-3 py-2 text-sm capitalize",selected.includes(v)?"border-teal bg-teal/10":"border-border bg-background")}>{v.replaceAll("-"," ")}</button>)}</div></fieldset>; }
