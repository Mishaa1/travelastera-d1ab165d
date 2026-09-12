import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { persistRoute } from "@/lib/storage";
import type { TripRoute } from "@/lib/types";
import { editTripWithAI, TripEditClarificationError, type TripEditResult } from "@/services/tripEditService";

const EXAMPLES = ["Reduce budget by €300", "More local food", "Luxury hotel instead", "Fewer train changes", "Keep Day 3 exactly the same"];

export function EditTripWithAI({ route, open, onClose, onRouteChange }: { route: TripRoute; open: boolean; onClose: () => void; onRouteChange: (route: TripRoute) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TripEditResult | null>(null);
  const [clarification, setClarification] = useState("");
  const reduceMotion = useReducedMotion();
  const submit = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setResult(null); setClarification("");
    try {
      const edited = await editTripWithAI(route, prompt);
      persistRoute(edited.route);
      onRouteChange(edited.route);
      setResult(edited);
      toast.success("Your trip has been updated.");
    } catch (error) { if (error instanceof TripEditClarificationError) setClarification(error.question); else toast.error(error instanceof Error ? error.message : "ASTERA could not apply that edit."); }
    finally { setBusy(false); }
  };
  return <AnimatePresence>{open && <>
    <motion.button type="button" aria-label="Close AI editor" className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}/>
    <motion.aside role="dialog" aria-modal="true" aria-labelledby="ai-editor-title" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }} transition={{ duration: reduceMotion ? 0 : 0.28 }} className="fixed top-3 right-3 bottom-3 z-50 flex w-[calc(100%-1.5rem)] max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-card shadow-2xl sm:top-5 sm:right-5 sm:bottom-5">
      <header className="relative overflow-hidden bg-ink px-6 py-6 text-white sm:px-8">
        <div className="absolute -top-20 -right-12 h-52 w-52 rounded-full bg-teal/25 blur-3xl" aria-hidden/>
        <div className="relative flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase"><Sparkles className="h-4 w-4 text-teal"/>Edit with AI</p><h2 id="ai-editor-title" className="mt-3 font-serif-display text-3xl font-light">Tell ASTERA what should change.</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">Unmentioned days and decisions stay in place. Only relevant changes from the provider-backed recalculation are applied.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-4 w-4"/></button></div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <label className="text-xs font-semibold tracking-wide uppercase" htmlFor="ai-trip-edit">What would you like to change?</label>
        <Textarea id="ai-trip-edit" rows={5} value={prompt} onChange={(event)=>setPrompt(event.target.value)} placeholder="e.g. Replace Prague with Salzburg, but keep Day 3 exactly the same." className="mt-3 resize-none rounded-2xl text-base" onKeyDown={(event)=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")void submit();}}/>
        <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((example)=><button type="button" key={example} onClick={()=>setPrompt(example)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ink hover:bg-ink hover:text-white">{example}</button>)}</div>
        {clarification && <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm"><p className="font-semibold">One quick detail</p><p className="mt-1 text-muted-foreground">{clarification}</p><p className="mt-2 text-xs text-muted-foreground">Add the answer to your request above, then try again.</p></motion.div>}
        <Button variant="hero" size="lg" className="mt-5 w-full" disabled={!prompt.trim()||busy} onClick={()=>void submit()}>{busy?<><Loader2 className="animate-spin"/>Reworking only what changed…</>:<>Update my trip<ArrowRight/></>}</Button>

        <AnimatePresence mode="wait">{result && <motion.section key={result.route.generatedAt} initial={reduceMotion?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} className="mt-7 rounded-3xl border border-teal/25 bg-teal/6 p-5">
          <p className="flex items-center gap-2 font-display text-xl font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-teal text-white"><Check className="h-4 w-4"/></span>Here’s what changed</p>
          <ul className="mt-4 space-y-2">{result.changes.map((change,index)=><motion.li key={change} initial={reduceMotion?false:{opacity:0,x:8}} animate={{opacity:1,x:0}} transition={{delay:index*.06}} className="flex gap-2 text-sm leading-relaxed"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal"/>{change}</motion.li>)}</ul>
          <div className="mt-5 grid grid-cols-2 gap-3"><Diff label="Estimated cost" before={formatCurrency(result.before.cost,route.preferences.currency)} after={formatCurrency(result.after.cost,route.preferences.currency)} delta={result.after.cost-result.before.cost}/><Diff label="Trip score" before={`${Math.round(result.before.score)}`} after={`${Math.round(result.after.score)}`} delta={result.after.score-result.before.score}/></div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Updated: {Object.entries(result.intent.impacted).filter(([,value])=>value).map(([key])=>key).join(", ") || "saved constraints"}. All named hotels and places remain provider-backed or explicitly traveller-provided.</p>
        </motion.section>}</AnimatePresence>
      </div>
    </motion.aside>
  </>}</AnimatePresence>;
}

function Diff({label,before,after,delta}:{label:string;before:string;after:string;delta:number}) { return <div className="rounded-2xl bg-background p-4"><p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p><p className="mt-2 text-xs text-muted-foreground line-through">{before}</p><motion.p key={after} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="mt-1 font-display text-xl font-semibold">{after}</motion.p><p className="mt-1 text-[11px] text-muted-foreground">{delta===0?"No change":`${delta>0?"+":""}${Math.round(delta)} difference`}</p></div>; }
