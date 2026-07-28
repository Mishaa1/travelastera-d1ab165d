import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

import { OPTIMISE_GOALS } from "@/services/tripOptimizer";
import { Button } from "@/components/ui/button";
import type { OptimiseGoal } from "@/lib/types";

interface OptimisePanelProps {
  busy: boolean;
  activeGoal?: OptimiseGoal;
  onSelect: (goal: OptimiseGoal) => void;
}

export function OptimisePanel({ busy, activeGoal, onSelect }: OptimisePanelProps) {
  return (
    <div className="rounded-4xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h3 className="font-display text-lg font-semibold">Optimise further</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Nudge one constraint and the engine re-searches every combination.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OPTIMISE_GOALS.map((goal) => (
          <Button
            key={goal.id}
            variant={activeGoal === goal.id ? "default" : "outline"}
            size="sm"
            disabled={busy}
            onClick={() => onSelect(goal.id)}
          >
            {busy && activeGoal === goal.id ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            {goal.label}
          </Button>
        ))}
      </div>
      {busy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className="h-1.5 gradient-dawn"
            initial={{ width: "5%" }}
            animate={{ width: ["5%", "70%", "92%"] }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </div>
  );
}
